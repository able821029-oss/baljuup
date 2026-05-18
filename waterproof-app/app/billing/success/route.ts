/**
 * GET /billing/success?authKey=...&customerKey=...&plan=starter
 *
 * 토스 카드 등록 위젯 성공 후 호출됨.
 * authKey 를 빌링키로 교환 → activateSubscription 호출 → /billing/complete 로 이동.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { issueBillingKey, PLANS, type PlanCode } from '@/lib/toss';
import { activateSubscription } from '@/app/(dashboard)/billing/actions';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const authKey = searchParams.get('authKey');
  const customerKey = searchParams.get('customerKey');
  const planParam = (searchParams.get('plan') ?? 'pro') as PlanCode;

  if (!authKey || !customerKey) {
    return NextResponse.redirect(`${origin}/billing/fail?reason=missing_params`);
  }
  if (!PLANS[planParam]) {
    return NextResponse.redirect(`${origin}/billing/fail?reason=invalid_plan`);
  }

  // 1) authKey -> billingKey 교환
  const issued = await issueBillingKey({ authKey, customerKey });
  if (!issued.ok) {
    return NextResponse.redirect(
      `${origin}/billing/fail?reason=${encodeURIComponent(issued.message)}`
    );
  }

  // 2) 구독 활성화 + 즉시 첫 결제
  const result = await activateSubscription({
    plan: planParam,
    billingKey: issued.data.billingKey,
    customerKey: issued.data.customerKey,
    cardCompany: issued.data.card.company,
    cardNumberMasked: issued.data.card.number,
  });

  if (!result.ok) {
    return NextResponse.redirect(
      `${origin}/billing/fail?reason=${encodeURIComponent(result.error ?? 'unknown')}`
    );
  }

  return NextResponse.redirect(`${origin}/billing/complete?plan=${planParam}`);
}
