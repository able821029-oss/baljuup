/**
 * 매일 신규 입찰공고를 알림톡으로 발송
 *
 * 실행:
 *   npx tsx scripts/send-alimtalks.ts                   # 어제~오늘 신규 공고
 *   npx tsx scripts/send-alimtalks.ts --since=2026-05-15
 *   npx tsx scripts/send-alimtalks.ts --dry-run         # DB 변경/발송 없이 시뮬레이션
 *
 * 흐름:
 *   1) 어제 이후 등록된 bid_announcements + complexes(sido) 조회
 *   2) user_profiles 에서 region 매칭 + notify_bids=true + phone 있는 활성 사용자 조회
 *   3) (사용자, 단지) 별로 알림톡 — 단, 같은 (user_id, bid_id) 로 발송 이력 있으면 SKIP
 *   4) alimtalk_logs 에 결과 기록
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { sendBulkAlimtalk, buildBidAlertMessage } from '../lib/kakao-alimtalk';

const args = parseArgs(process.argv.slice(2));
const DRY_RUN = !!args['dry-run'];
const SINCE_OVERRIDE = typeof args.since === 'string' ? args.since : null;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_URL = process.env.NEXT_PUBLIC_URL ?? 'https://your-domain.com';

function assertEnv() {
  const missing: string[] = [];
  if (!DRY_RUN) {
    if (!SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL');
    if (!SUPABASE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    if (!process.env.KAKAO_API_KEY) missing.push('KAKAO_API_KEY');
    if (!process.env.KAKAO_SENDER_KEY) missing.push('KAKAO_SENDER_KEY');
    if (!process.env.KAKAO_USER_ID) missing.push('KAKAO_USER_ID');
  }
  if (missing.length) {
    console.error(`\n[ERROR] 환경변수 누락: ${missing.join(', ')}`);
    process.exit(1);
  }
}

async function main() {
  assertEnv();

  const banner = '━'.repeat(60);
  console.log(banner);
  console.log('  발주Up — 일일 알림톡 발송');
  console.log(banner);
  console.log(`  드라이런  : ${DRY_RUN ? 'YES' : 'NO'}`);

  const since = SINCE_OVERRIDE ?? yesterdayIso();
  console.log(`  대상 기간 : ${since} 이후 등록된 공고`);
  console.log(banner);

  const supabase = SUPABASE_URL && SUPABASE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })
    : null;

  if (!supabase) {
    console.log('[dry-run] Supabase 클라이언트 없음 — 종료');
    return;
  }

  // 1) 신규 입찰공고
  const { data: bidData, error: bidErr } = await supabase
    .from('bid_announcements')
    .select('id, complex_id, work_type, deadline_at, announced_at, complexes(name, sido)')
    .gte('created_at', since)
    .eq('status', 'active');
  if (bidErr) throw new Error(`bid_announcements 조회 실패: ${bidErr.message}`);

  type BidJoined = {
    id: string; complex_id: string;
    work_type: string | null; deadline_at: string | null; announced_at: string | null;
    complexes: { name: string; sido: string | null } | { name: string; sido: string | null }[] | null;
  };
  const bids = (((bidData ?? []) as unknown) as BidJoined[]).map((b) => ({
    ...b,
    complex: Array.isArray(b.complexes) ? b.complexes[0] : b.complexes,
  }));

  console.log(`\n신규 공고: ${bids.length}건`);
  if (!bids.length) {
    console.log('발송 대상 없음. 종료.');
    return;
  }

  // 2) 알림 받을 사용자 (활성 구독 + notify_bids + phone 있음)
  const { data: userData, error: userErr } = await supabase
    .from('user_profiles')
    .select('id, phone, region, company_name, notify_bids, plan, trial_ends_at')
    .eq('notify_bids', true)
    .not('phone', 'is', null);
  if (userErr) throw new Error(`user_profiles 조회 실패: ${userErr.message}`);

  type UserRow = {
    id: string; phone: string | null; region: string[] | null;
    company_name: string | null; notify_bids: boolean;
    plan: string; trial_ends_at: string | null;
  };
  const users = (((userData ?? []) as unknown) as UserRow[]).filter((u) => {
    // 체험은 trial_ends_at 안 지났을 때만, 유료는 항상 OK
    if (u.plan === 'trial') {
      return u.trial_ends_at && new Date(u.trial_ends_at) > new Date();
    }
    return u.plan === 'starter' || u.plan === 'pro' || u.plan === 'enterprise';
  });

  console.log(`알림 대상 사용자: ${users.length}명`);

  // 3) 매칭 — (user, bid) 페어 생성, 단 region 일치하는 것만
  type Pair = { user: UserRow; bid: typeof bids[number] };
  const pairs: Pair[] = [];
  for (const u of users) {
    const regions = u.region ?? [];
    for (const b of bids) {
      const sido = b.complex?.sido ?? '';
      if (regions.length === 0 || regions.some((r) => sido.startsWith(r))) {
        pairs.push({ user: u, bid: b });
      }
    }
  }
  console.log(`최종 발송 쌍: ${pairs.length}건`);

  // 4) 중복 방지 — 이미 발송한 (user, bid) 는 skip
  const userIds = Array.from(new Set(pairs.map((p) => p.user.id)));
  const bidIds = Array.from(new Set(pairs.map((p) => p.bid.id)));
  const { data: existing } = await supabase
    .from('alimtalk_logs')
    .select('user_id, bid_id')
    .in('user_id', userIds)
    .in('bid_id', bidIds)
    .eq('status', 'success');
  const sentSet = new Set(
    ((existing ?? []) as { user_id: string; bid_id: string | null }[])
      .filter((r) => r.bid_id)
      .map((r) => `${r.user_id}|${r.bid_id}`)
  );
  const toSend = pairs.filter((p) => !sentSet.has(`${p.user.id}|${p.bid.id}`));
  console.log(`중복 제외 후: ${toSend.length}건`);

  if (!toSend.length) {
    console.log('모두 발송 완료 상태. 종료.');
    return;
  }

  // 5) 알림톡 발송 (100건씩 batch)
  const stats = { success: 0, failed: 0 };
  for (let i = 0; i < toSend.length; i += 100) {
    const batch = toSend.slice(i, i + 100);
    const messages = batch.map(({ user, bid }) =>
      ({ ...buildBidAlertMessage({
          complexName: bid.complex?.name ?? '단지',
          workType: bid.work_type ?? '공사',
          deadline: bid.deadline_at ?? '미정',
          proposalUrl: `${APP_URL}/proposals/new?complexId=${bid.complex_id}`,
        }), phone: user.phone! })
    );

    if (DRY_RUN) {
      console.log(`[dry-run] batch ${i}~${i + 100} : ${batch.length}건`);
      console.log('  샘플:', messages[0]);
      stats.success += batch.length;
      continue;
    }

    const result = await sendBulkAlimtalk(messages);
    console.log(`batch ${i}~${i + 100} →`, result.ok ? `OK (${result.success}/${result.total})` : `FAIL: ${result.code} ${result.message}`);

    // 이력 기록
    const logRows = batch.map(({ user, bid }, idx) => ({
      user_id: user.id,
      template_code: messages[idx].templateCode,
      phone: user.phone!,
      message: messages[idx].message,
      status: result.ok ? 'success' : 'failed',
      provider: 'aligo',
      provider_msg_id: result.ok ? result.messageId : null,
      failure_code: !result.ok ? result.code : null,
      failure_message: !result.ok ? result.message : null,
      bid_id: bid.id,
      complex_id: bid.complex_id,
      raw_response: result,
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('alimtalk_logs') as any).insert(logRows);

    if (result.ok) stats.success += result.success;
    else stats.failed += batch.length;
  }

  console.log('\n' + banner);
  console.log('  최종 결과');
  console.log(banner);
  console.log(`  성공  : ${stats.success}건`);
  console.log(`  실패  : ${stats.failed}건`);
  console.log(banner);

  if (stats.failed > 0) process.exit(2);
}

function yesterdayIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(0, 0, 0, 0);
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
