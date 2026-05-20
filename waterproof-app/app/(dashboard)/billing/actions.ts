'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import {
  PLANS,
  cancelPayment,
  chargeBillingKey,
  buildMonthlyOrderId,
  type PlanCode,
} from '@/lib/toss';

// ============================================================
// 구독 시작 마무리 — billingKey 저장 + 즉시 첫 결제
// (Toss 위젯에서 받은 authKey 를 /billing/success 라우트에서 교환한 뒤 호출)
// ============================================================
export async function activateSubscription(input: {
  plan: PlanCode;
  billingKey: string;
  customerKey: string;
  cardCompany: string;
  cardNumberMasked: string;
}): Promise<{ ok: boolean; error?: string; paymentKey?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: '로그인이 필요합니다.' };

  const planMeta = PLANS[input.plan];
  if (!planMeta) return { ok: false, error: '잘못된 플랜' };

  const admin = createAdminClient();

  // 1) subscriptions 테이블에 upsert
  const nextBilling = new Date();
  nextBilling.setMonth(nextBilling.getMonth() + 1);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: subError } = await (admin.from('subscriptions') as any).upsert({
    user_id: user.id,
    plan: input.plan,
    amount: planMeta.amount,
    billing_key: input.billingKey,
    customer_key: input.customerKey,
    card_company: input.cardCompany,
    card_number_masked: input.cardNumberMasked,
    status: 'active',
    started_at: new Date().toISOString(),
    next_billing_at: nextBilling.toISOString(),
  }, { onConflict: 'user_id' });

  if (subError) return { ok: false, error: subError.message };

  // 2) 즉시 첫 결제
  const orderId = buildMonthlyOrderId(user.id);
  const charge = await chargeBillingKey(input.billingKey, {
    customerKey: input.customerKey,
    amount: planMeta.amount,
    orderId,
    orderName: `발주Up ${planMeta.name} (월 정기결제)`,
    customerEmail: user.email ?? undefined,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin.from('billing_logs') as any).insert({
    user_id: user.id,
    amount: planMeta.amount,
    status: charge.ok ? 'success' : 'failed',
    payment_key: charge.ok ? charge.data.paymentKey : null,
    order_id: orderId,
    failure_code: !charge.ok ? charge.code : null,
    failure_message: !charge.ok ? charge.message : null,
    raw_response: charge.ok ? charge.data : { code: charge.code, message: charge.message, status: charge.status },
  });

  if (!charge.ok) {
    // 첫 결제 실패 시 구독을 failed 로 표시 (사용자가 재시도 가능)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin.from('subscriptions') as any).update({ status: 'failed' }).eq('user_id', user.id);
    return { ok: false, error: `첫 결제 실패: ${charge.message}` };
  }

  // 3) user_profiles.plan 도 업데이트
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin.from('user_profiles') as any).update({ plan: input.plan }).eq('id', user.id);

  // 4) 마지막 결제일 기록
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin.from('subscriptions') as any).update({
    last_billed_at: new Date().toISOString(),
  }).eq('user_id', user.id);

  revalidatePath('/', 'layout');
  return { ok: true, paymentKey: charge.data.paymentKey };
}

// ============================================================
// 구독 취소 (다음 결제 전까지는 계속 사용 가능)
//
// 정책: 다음 결제일까지는 유료 기능 그대로 이용 가능.
//       즉시 환불을 원하면 별도 환불 요청(`refundLastPayment`) 필요.
// ============================================================
export async function cancelSubscription(input?: {
  reason?: string;     // 취소 사유 (선택 — 회수 기능 개선 목적)
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: '로그인이 필요합니다.' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('subscriptions') as any)
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
      // 사유는 last_failure_message 컬럼을 재사용하지 않고 별도 컬럼이 필요하나,
      // MVP 에서는 billing_logs.cancel_reason 으로 다음 결제 시점 기록 (즉시 환불 시 reuse).
    })
    .eq('user_id', user.id);

  if (error) return { ok: false, error: error.message };

  // 취소 사유는 별도 감사 로그가 없으므로 billing_logs 에 메모 행 추가 (운영 분석용).
  if (input?.reason) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (createAdminClient().from('billing_logs') as any).insert({
      user_id: user.id,
      amount: 0,
      status: 'canceled',
      cancel_reason: input.reason.slice(0, 500),
      canceled_at: new Date().toISOString(),
    });
  }

  revalidatePath('/', 'layout');
  return { ok: true };
}

// ============================================================
// 최근 성공 결제 환불 — 본인 요청
//
// 정책 (refund 페이지와 동일):
//   - 결제 후 7일 이내 + 미사용 → 전액 환불 허용
//   - 사용 흔적이 있으면 운영자 검토 필요 → 본 액션은 거부, 고객센터로 안내
//
// 본 함수는 정책 검증과 Toss 호출까지 수행. 호출 성공 시:
//   1) 해당 paymentKey 의 billing_logs 행을 status='canceled' + canceled_at 으로 갱신
//   2) subscriptions 도 status='canceled' (재청구 방지)
//   3) user_profiles.plan='trial' 로 강등
// ============================================================
export async function refundLastPayment(input?: {
  reason?: string;
}): Promise<{ ok: boolean; error?: string; refundedAmount?: number }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: '로그인이 필요합니다.' };

  const reason = (input?.reason ?? '회원 요청 환불').slice(0, 200);

  // 1) 최근 성공 결제 조회
  const { data: lastLog } = await supabase
    .from('billing_logs')
    .select('id, payment_key, amount, attempted_at, status')
    .eq('user_id', user.id)
    .eq('status', 'success')
    .order('attempted_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const log = lastLog as unknown as {
    id: string; payment_key: string | null;
    amount: number; attempted_at: string; status: string;
  } | null;

  if (!log || !log.payment_key) {
    return { ok: false, error: '환불 가능한 결제 이력이 없습니다.' };
  }

  // 2) 7일 정책 — 결제일로부터 7일 이내만 자동 환불
  const daysSince = (Date.now() - new Date(log.attempted_at).getTime()) / 86_400_000;
  if (daysSince > 7) {
    return {
      ok: false,
      error: '결제 후 7일이 지난 경우 자동 환불이 불가합니다. 고객센터로 문의해주세요.',
    };
  }

  // 3) 사용 흔적 검사 — 사용한 흔적이 있으면 자동 환불 거부 (운영자 처리 유도)
  //    사용 기준: 제안서 1건 이상 생성
  const { count: proposalCount } = await supabase
    .from('proposals')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', log.attempted_at);

  if ((proposalCount ?? 0) > 0) {
    return {
      ok: false,
      error: '결제 이후 서비스 사용 흔적이 확인되어 자동 환불이 불가합니다. 고객센터로 문의해주세요.',
    };
  }

  // 4) Toss 취소 호출
  const cancelRes = await cancelPayment(log.payment_key, { cancelReason: reason });
  if (!cancelRes.ok) {
    return { ok: false, error: `결제 취소 실패: ${cancelRes.message}` };
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  // 5) billing_logs 갱신
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin.from('billing_logs') as any)
    .update({
      status: 'canceled',
      cancel_reason: reason,
      canceled_at: now,
      canceled_amount: log.amount,
    })
    .eq('id', log.id);

  // 6) subscriptions 종료
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin.from('subscriptions') as any)
    .update({ status: 'canceled', canceled_at: now })
    .eq('user_id', user.id);

  // 7) user_profiles 강등
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin.from('user_profiles') as any)
    .update({ plan: 'trial' })
    .eq('id', user.id);

  revalidatePath('/', 'layout');
  return { ok: true, refundedAmount: log.amount };
}
