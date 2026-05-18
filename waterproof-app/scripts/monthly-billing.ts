/**
 * 월 정기결제 자동 실행 스크립트
 *
 * 실행:
 *   npx tsx scripts/monthly-billing.ts                # 정기 (production)
 *   npx tsx scripts/monthly-billing.ts --dry-run      # 조회만, 결제 안함
 *   npx tsx scripts/monthly-billing.ts --user=<uuid>  # 특정 사용자만
 *
 * 환경변수:
 *   TOSS_SECRET_KEY
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * 처리 흐름:
 *   1) subscriptions WHERE status='active' AND next_billing_at <= NOW()
 *   2) 각 구독:
 *      a) orderId = sub-{userId}-{YYYYMM} 생성
 *      b) 이미 같은 orderId 로 성공한 billing_logs 있으면 SKIP (멱등성)
 *      c) chargeBillingKey() 호출
 *      d) 성공: billing_logs(success) + last_billed_at + next_billing_at += 1mo
 *      e) 실패: billing_logs(failed) + status='failed' 표시 (1회 실패 즉시 — 운영 정책 따라 조정)
 *   3) 요약 통계 출력
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { chargeBillingKey, buildMonthlyOrderId, PLANS } from '../lib/toss';

// ============================================================
// CLI
// ============================================================
const args = parseArgs(process.argv.slice(2));
const DRY_RUN = !!args['dry-run'];
const TARGET_USER = typeof args.user === 'string' ? args.user : null;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY;

function assertEnv() {
  const missing: string[] = [];
  if (!TOSS_SECRET_KEY) missing.push('TOSS_SECRET_KEY');
  if (!DRY_RUN) {
    if (!SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL');
    if (!SUPABASE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  }
  if (missing.length) {
    console.error(`\n[ERROR] 환경변수 누락: ${missing.join(', ')}`);
    process.exit(1);
  }
}

// ============================================================
async function main() {
  assertEnv();

  const banner = '━'.repeat(60);
  console.log(banner);
  console.log('  발주Up — 월 정기결제 자동 실행');
  console.log(banner);
  console.log(`  드라이런   : ${DRY_RUN ? 'YES' : 'NO'}`);
  console.log(`  대상 사용자 : ${TARGET_USER ?? '전체 (next_billing_at <= NOW)'}`);
  console.log(banner);

  const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!, {
    auth: { persistSession: false },
  });

  // 대상 구독 조회
  let query = supabase
    .from('subscriptions')
    .select('id, user_id, plan, amount, billing_key, customer_key, card_company, card_number_masked, next_billing_at')
    .eq('status', 'active')
    .lte('next_billing_at', new Date().toISOString());
  if (TARGET_USER) query = query.eq('user_id', TARGET_USER);

  const { data, error } = await query;
  if (error) {
    console.error(`[FATAL] subscriptions 조회 실패: ${error.message}`);
    process.exit(1);
  }

  type SubRow = {
    id: string; user_id: string; plan: string; amount: number;
    billing_key: string; customer_key: string;
    card_company: string | null; card_number_masked: string | null;
    next_billing_at: string | null;
  };
  const subs = ((data ?? []) as unknown) as SubRow[];
  console.log(`\n결제 대상: ${subs.length}건\n`);

  if (!subs.length) {
    console.log('결제 대상 없음. 종료.');
    return;
  }

  const stats = { success: 0, failed: 0, skipped: 0 };
  const startedAt = Date.now();

  for (const sub of subs) {
    const planMeta = PLANS[sub.plan as keyof typeof PLANS];
    const orderId = buildMonthlyOrderId(sub.user_id);
    const label = `[${stats.success + stats.failed + stats.skipped + 1}/${subs.length}] ${sub.user_id.slice(0, 8)} · ${sub.plan} · ${sub.amount.toLocaleString()}원`;

    // 1) 멱등성 — 같은 orderId 로 성공한 이력 있으면 스킵
    const { count: existingCount } = await supabase
      .from('billing_logs')
      .select('id', { count: 'exact', head: true })
      .eq('order_id', orderId)
      .eq('status', 'success');

    if ((existingCount ?? 0) > 0) {
      console.log(`${label} → SKIP (이미 ${orderId} 성공 이력 있음)`);
      stats.skipped++;
      await advanceNextBilling(supabase, sub);
      continue;
    }

    if (DRY_RUN) {
      console.log(`${label} → [dry-run] charge ${orderId}`);
      stats.success++;
      continue;
    }

    // 2) 결제 실행
    const charge = await chargeBillingKey(sub.billing_key, {
      customerKey: sub.customer_key,
      amount: sub.amount,
      orderId,
      orderName: `발주Up ${planMeta?.name ?? sub.plan} (월 정기결제)`,
    });

    // 3) 이력 기록
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('billing_logs') as any).insert({
      subscription_id: sub.id,
      user_id: sub.user_id,
      amount: sub.amount,
      status: charge.ok ? 'success' : 'failed',
      payment_key: charge.ok ? charge.data.paymentKey : null,
      order_id: orderId,
      failure_code: !charge.ok ? charge.code : null,
      failure_message: !charge.ok ? charge.message : null,
      raw_response: charge.ok ? charge.data : { code: charge.code, message: charge.message },
    });

    if (charge.ok) {
      console.log(`${label} → OK (${charge.data.paymentKey})`);
      stats.success++;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('subscriptions') as any).update({
        last_billed_at: new Date().toISOString(),
        next_billing_at: addOneMonth(sub.next_billing_at ?? new Date().toISOString()),
      }).eq('id', sub.id);
    } else {
      console.error(`${label} → FAIL (${charge.code}: ${charge.message})`);
      stats.failed++;
      // 1회 실패 즉시 'failed' 로 표시 (운영 정책에 따라 재시도 후로 변경 가능)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('subscriptions') as any).update({ status: 'failed' }).eq('id', sub.id);
    }
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log('\n' + banner);
  console.log('  최종 결과');
  console.log(banner);
  console.log(`  성공     : ${stats.success}건`);
  console.log(`  실패     : ${stats.failed}건`);
  console.log(`  스킵     : ${stats.skipped}건`);
  console.log(`  소요시간  : ${elapsed}s`);
  console.log(banner);

  if (stats.failed > 0) process.exit(2);  // Actions 에서 워크플로우 실패로 인식
}

// ============================================================
// 헬퍼
// ============================================================
async function advanceNextBilling(supabase: SupabaseClient, sub: { id: string; next_billing_at: string | null }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('subscriptions') as any).update({
    next_billing_at: addOneMonth(sub.next_billing_at ?? new Date().toISOString()),
  }).eq('id', sub.id);
}

function addOneMonth(iso: string): string {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const a of argv) {
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      out[k] = v ?? true;
    }
  }
  return out;
}

main().catch((err) => {
  console.error('\n[FATAL]', err);
  process.exit(1);
});
