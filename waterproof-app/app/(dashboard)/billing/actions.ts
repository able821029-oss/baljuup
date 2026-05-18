'use server';

import { revalidatePath } from 'next/cache';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { PLANS, chargeBillingKey, buildMonthlyOrderId, type PlanCode } from '@/lib/toss';

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
// ============================================================
export async function cancelSubscription(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: '로그인이 필요합니다.' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('subscriptions') as any)
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
    })
    .eq('user_id', user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/', 'layout');
  return { ok: true };
}
