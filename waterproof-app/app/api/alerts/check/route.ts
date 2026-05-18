/**
 * POST /api/alerts/check
 *
 * 신규 입찰공고를 감지하고 관심 지역 가입자에게 카카오 알림톡을 발송합니다.
 *
 * 호출 주체:
 *   - GitHub Actions cron (매 30분 ~ 1시간 권장)
 *   - Vercel Cron Jobs
 *   - 외부 스케줄러
 *
 * 인증:
 *   Bearer 토큰: process.env.CRON_SECRET
 *   요청 헤더: Authorization: Bearer ${CRON_SECRET}
 *
 * 동작:
 *   1) bid_announcements 에서 notified = false 인 행 조회 (상한 100건)
 *   2) 각 공고의 단지 정보 + 해당 지역(sido) 을 관심사로 가진 user_profiles 매칭
 *   3) kakao_id 가 등록된 사용자에게 알림톡 발송
 *   4) 발송 성공 시 bid_announcements.notified = true 로 업데이트
 *
 * 응답:
 *   200: { ok: true, processed, sent, failed, items: [...] }
 *   401: { ok: false, error: 'unauthorized' }
 *   500: { ok: false, error: '...' }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { sendAlimtalk, buildBidAlertMessage } from '@/lib/kakao-alimtalk';

export const runtime = 'nodejs';
export const maxDuration = 60;

const BATCH_LIMIT = 100;

// Supabase 임베드 응답의 명시적 타입
// — database.types.ts의 Relationships가 비어있어 자동 추론이 안 되므로 .returns<>()로 보강
type BidWithComplex = {
  id: string;
  title: string | null;
  estimated_amount: number | null;
  deadline_at: string | null;
  announced_at: string | null;
  complex_id: string | null;
  complex: { id: string; name: string; sido: string | null } | null;
};

type UserSlim = {
  id: string;
  phone: string | null;
  kakao_id: string | null;
  region: string[] | null;
};

export async function POST(req: NextRequest) {
  // ── 1. 인증 ─────────────────────────────────────────────
  const auth = req.headers.get('authorization') ?? '';
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: 'CRON_SECRET 환경변수 누락' },
      { status: 500 }
    );
  }
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  // ── 2. 미발송 입찰공고 조회 ───────────────────────────────
  const supabase = createAdminClient();

  const { data: bids, error: bidsErr } = await supabase
    .from('bid_announcements')
    .select(
      `
      id,
      title,
      estimated_amount,
      deadline_at,
      announced_at,
      complex_id,
      complex:complexes (
        id,
        name,
        sido
      )
    `
    )
    .eq('notified', false)
    .eq('status', 'active')
    .order('announced_at', { ascending: false })
    .limit(BATCH_LIMIT)
    .returns<BidWithComplex[]>();

  if (bidsErr) {
    return NextResponse.json(
      { ok: false, error: 'DB 조회 실패: ' + bidsErr.message },
      { status: 500 }
    );
  }
  if (!bids || bids.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, sent: 0, failed: 0, items: [] });
  }

  // ── 3. 발송 대상별 매칭 + 발송 ────────────────────────────
  let sent = 0;
  let failed = 0;
  const items: { bidId: string; recipients: number; sent: number; error?: string }[] = [];

  for (const bid of bids) {
    const complex = bid.complex;
    if (!complex || !complex.sido) {
      items.push({ bidId: bid.id, recipients: 0, sent: 0, error: '단지 정보 또는 시도 없음' });
      continue;
    }

    // 해당 시도를 관심 지역으로 가진 사용자 + kakao_id 등록자
    // supabase-js + 손으로 작성한 database.types.ts 조합에서 .contains/.not 체이닝 후
    // 타입 추론이 'never'로 떨어지므로 응답 객체 자체를 캐스팅
    const usersResp = (await (supabase.from('user_profiles') as any)
      .select('id, phone, kakao_id, region')
      .contains('region', [complex.sido])
      .not('phone', 'is', null)) as { data: UserSlim[] | null; error: { message: string } | null };
    const users = usersResp.data;
    const usersErr = usersResp.error;

    if (usersErr) {
      items.push({
        bidId: bid.id,
        recipients: 0,
        sent: 0,
        error: '사용자 조회 실패: ' + usersErr.message,
      });
      failed++;
      continue;
    }

    if (!users || users.length === 0) {
      // 발송 대상 없음 — 그래도 notified=true 로 마킹해서 다음에 재처리 안 함
      await markNotified(supabase, bid.id);
      items.push({ bidId: bid.id, recipients: 0, sent: 0 });
      continue;
    }

    let bidSent = 0;
    let bidFailed = 0;

    const baseUrl = process.env.NEXT_PUBLIC_URL ?? 'https://yarodar.app';

    for (const user of users) {
      if (!user.phone) continue;
      const tpl = buildBidAlertMessage({
        complexName: complex.name,
        workType: bid.title ?? '입찰공고',
        deadline: formatDeadline(bid.deadline_at),
        proposalUrl: `${baseUrl}/proposals/new?complex=${complex.id}`,
      });
      const result = await sendAlimtalk({ ...tpl, phone: normalizePhone(user.phone) });
      if (result.ok) {
        bidSent++;
        sent++;
      } else {
        bidFailed++;
        failed++;
      }
    }

    // 전체 실패가 아니면 마킹 (재시도 회피)
    if (bidSent > 0 || bidFailed < users.length) {
      await markNotified(supabase, bid.id);
    }

    items.push({ bidId: bid.id, recipients: users.length, sent: bidSent });
  }

  return NextResponse.json({
    ok: true,
    processed: bids.length,
    sent,
    failed,
    items,
  });
}

// ============================================================
// 헬퍼
// ============================================================
async function markNotified(
  supabase: ReturnType<typeof createAdminClient>,
  bidId: string
): Promise<void> {
  // 타입 추론 우회 — supabase-js + 손으로 작성한 database.types.ts 조합에서
  // .update()가 Update 타입 대신 'never'로 추론되는 케이스 회피
  await (supabase.from('bid_announcements') as any)
    .update({ notified: true })
    .eq('id', bidId);
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('82') && digits.length >= 11) return '0' + digits.slice(2);
  return digits;
}

function formatDeadline(d: string | null): string {
  if (!d) return '미정';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return d;
  return date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
}
