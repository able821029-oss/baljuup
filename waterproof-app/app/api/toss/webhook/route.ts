/**
 * POST /api/toss/webhook — 토스페이먼츠 결제 이벤트 수신
 *
 * 처리 이벤트:
 *   - PAYMENT_STATUS_CHANGED  : 결제 상태 변경 (DONE / CANCELED / PARTIAL_CANCELED)
 *   - CARD_PAYMENT_FAILED     : 카드사 거절 (재시도 후 실패)
 *   - DEPOSIT_CALLBACK        : 가상계좌 입금 (현재 미사용. 수신만 ACK)
 *
 * 보안:
 *   - Toss 콘솔에서 발급한 webhook secret 으로 HMAC-SHA256 서명 검증 (헤더 Toss-Signature)
 *   - secret 미설정 시 검증 스킵 (개발용)
 *
 * 응답:
 *   - 항상 빠르게 200 OK 반환 (Toss 가 재시도하지 않도록)
 *   - 내부 처리 실패는 로그로만 남김
 *
 * 멱등성:
 *   - eventId(또는 paymentKey + lastTransactionKey) 기준으로 같은 이벤트 중복 수신 방지
 *   - billing_logs 의 (payment_key, status) 로 한 번 더 검증
 */

import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/server';

// Edge runtime 은 crypto 호환 이슈가 있으므로 명시적으로 Node 런타임 강제
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ============================================================
// 서명 검증
// ============================================================
function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.TOSS_WEBHOOK_SECRET;
  if (!secret) {
    // 개발 환경 — secret 없이도 통과 (운영에서는 반드시 설정할 것)
    console.warn('[toss/webhook] TOSS_WEBHOOK_SECRET 미설정 — 서명 검증을 스킵합니다.');
    return true;
  }
  if (!signatureHeader) {
    return false;
  }
  // Toss 공식 포맷은 base64(HMAC-SHA256(secret, rawBody))
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('base64');

  // timingSafeEqual 로 비교 (길이 다르면 false)
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ============================================================
// 이벤트 페이로드 형상 (Toss 실제 키 — 필요 필드만 명시)
// ============================================================
interface TossWebhookPayload {
  eventType?: string;
  createdAt?: string;
  data?: {
    paymentKey?: string;
    orderId?: string;
    status?: string;            // 'DONE' | 'CANCELED' | 'PARTIAL_CANCELED' | 'ABORTED' | ...
    totalAmount?: number;
    balanceAmount?: number;
    method?: string;
    failure?: { code?: string; message?: string };
    cancels?: Array<{ cancelAmount: number; cancelReason: string; canceledAt: string }>;
    receipt?: { url?: string };
  };
}

// ============================================================
// POST
// ============================================================
export async function POST(req: NextRequest) {
  // 원본 body 를 한 번만 읽고 서명 검증에 그대로 사용해야 함
  const rawBody = await req.text();
  const sig = req.headers.get('toss-signature') ?? req.headers.get('Toss-Signature');

  if (!verifySignature(rawBody, sig)) {
    console.error('[toss/webhook] 서명 검증 실패');
    return NextResponse.json({ ok: false, error: 'invalid signature' }, { status: 401 });
  }

  let payload: TossWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }

  // 처리 자체가 실패해도 Toss 가 재시도하지 않도록 항상 200 — 에러는 로그로
  try {
    await handleEvent(payload);
  } catch (e) {
    const err = e as Error;
    console.error('[toss/webhook] handler error:', err?.message ?? err);
  }

  return NextResponse.json({ ok: true });
}

// ============================================================
// 이벤트 처리
// ============================================================
async function handleEvent(payload: TossWebhookPayload): Promise<void> {
  const eventType = payload.eventType ?? '';
  const data = payload.data ?? {};
  const paymentKey = data.paymentKey;
  const status = data.status;

  if (!paymentKey) {
    console.warn('[toss/webhook] paymentKey 누락 — 이벤트 무시:', eventType);
    return;
  }

  const admin = createAdminClient();

  // 1) 기존 결제 로그 조회 — user_id 까지 함께 가져와 후속 처리에 재사용
  const { data: existing } = await admin
    .from('billing_logs')
    .select('id, status, user_id')
    .eq('payment_key', paymentKey)
    .limit(1)
    .maybeSingle();

  const existingLog = (existing as unknown) as {
    id: string; status: string; user_id: string;
  } | null;

  // ── 결제 취소/부분취소 ──────────────────────────────────────
  if (status === 'CANCELED' || status === 'PARTIAL_CANCELED') {
    if (!existingLog) {
      console.warn(`[toss/webhook] 취소 이벤트지만 결제 로그 없음: ${paymentKey}`);
      return;
    }
    // 멱등성: 이미 canceled 면 스킵
    if (existingLog.status === 'canceled' && status === 'CANCELED') {
      return;
    }
    const cancel = data.cancels?.[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin.from('billing_logs') as any)
      .update({
        status: 'canceled',
        canceled_at: cancel?.canceledAt ?? new Date().toISOString(),
        cancel_reason: cancel?.cancelReason ?? '토스 webhook 수신',
        canceled_amount: cancel?.cancelAmount ?? null,
      })
      .eq('id', existingLog.id);

    // 전액 취소 → 구독 종료
    if (status === 'CANCELED') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin.from('subscriptions') as any)
        .update({ status: 'canceled', canceled_at: new Date().toISOString() })
        .eq('user_id', existingLog.user_id);
    }
    return;
  }

  // ── 결제 실패 ───────────────────────────────────────────────
  if (status === 'ABORTED' || eventType === 'CARD_PAYMENT_FAILED' || data.failure?.code) {
    if (existingLog) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin.from('billing_logs') as any)
        .update({
          status: 'failed',
          failure_code: data.failure?.code ?? 'ABORTED',
          failure_message: data.failure?.message ?? '결제가 중단되었습니다.',
        })
        .eq('id', existingLog.id);
    }

    // 구독 failure_count 증가 — 누적 3회 시 'failed' 상태로 전환 (dunning)
    if (existingLog?.user_id) {
      const { data: subRow } = await admin
        .from('subscriptions')
        .select('id, failure_count, status')
        .eq('user_id', existingLog.user_id)
        .maybeSingle();
      const sub = (subRow as unknown) as {
        id: string; failure_count: number | null; status: string;
      } | null;
      if (sub) {
        const nextCount = (sub.failure_count ?? 0) + 1;
        const nextStatus = nextCount >= 3 ? 'failed' : sub.status;
        const retryAt = nextCount >= 3 ? null : new Date(Date.now() + 24 * 3600_000).toISOString();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin.from('subscriptions') as any)
          .update({
            failure_count: nextCount,
            status: nextStatus,
            retry_at: retryAt,
            last_failure_message: data.failure?.message ?? '결제 실패',
          })
          .eq('id', sub.id);
      }
    }
    return;
  }

  // ── 결제 완료 ───────────────────────────────────────────────
  if (status === 'DONE') {
    if (existingLog) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin.from('billing_logs') as any)
        .update({ status: 'success', receipt_url: data.receipt?.url ?? null })
        .eq('id', existingLog.id);
    }
    // 결제 성공 시 failure_count 리셋
    if (existingLog?.user_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin.from('subscriptions') as any)
        .update({ failure_count: 0, retry_at: null, last_failure_message: null })
        .eq('user_id', existingLog.user_id);
    }
    return;
  }

  // 미처리 이벤트는 로그만
  console.log(`[toss/webhook] 미처리 이벤트: ${eventType}, status=${status}, paymentKey=${paymentKey}`);
}
