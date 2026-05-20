/**
 * POST /api/bids/collect
 *
 * 최근 N일 신규 입찰공고 + 수의계약 공지를 수집해
 * bid_announcements / negotiated_contracts 테이블에 저장합니다.
 * 저장 후 notified=false 행은 /api/alerts/check 크론이 알림톡을 발송합니다.
 *
 * ── 호출 주체 ────────────────────────────────────────────────
 *  - GitHub Actions cron (매일 오전 8시 권장)
 *  - Vercel Cron Jobs
 *  - 외부 스케줄러
 *
 * ── 인증 ────────────────────────────────────────────────────
 *  Authorization: Bearer ${CRON_SECRET}
 *
 * ── Body (선택) ──────────────────────────────────────────────
 *  { "days": 7, "sidoCodes": ["11", "41"] }
 *
 * ── 응답 ────────────────────────────────────────────────────
 *  200: {
 *         ok: true,
 *         fetched, saved,                  // 입찰공고
 *         fetched_contracts, saved_contracts,  // 수의계약
 *         duration_ms,
 *         errors?: string[]
 *       }
 *  401: { ok: false, error: 'unauthorized' }
 *  500: { ok: false, error: '...' }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import {
  fetchBidsByDateRange,
  fetchNegotiatedByDateRange,
  SIDO_CODES,
  type BidAnnouncementRaw,
  type NegotiatedContractRaw,
} from '@/lib/kapt-api';

export const runtime = 'nodejs';
export const maxDuration = 60;

const DEFAULT_DAYS = 3;   // 매일 실행 시 최근 3일 → 누락 방지
const DEFAULT_SIDO = [SIDO_CODES.서울, SIDO_CODES.경기];

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

export async function POST(req: NextRequest) {
  const t0 = Date.now();

  // ── 1. 인증 ─────────────────────────────────────────────────
  const auth     = req.headers.get('authorization') ?? '';
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ ok: false, error: 'CRON_SECRET 환경변수 누락' }, { status: 500 });
  }
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  // ── 2. 파라미터 ──────────────────────────────────────────────
  let body: { days?: number; sidoCodes?: string[] } = {};
  try { body = await req.json(); } catch { /* body 없어도 OK */ }

  const days      = Number(body.days ?? DEFAULT_DAYS);
  const sidoCodes = body.sidoCodes ?? DEFAULT_SIDO;

  // ── 3. 날짜 범위 계산 ────────────────────────────────────────
  const endDate   = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const endYmd   = toYmd(endDate);
  const startYmd = toYmd(startDate);

  // ── 4. 입찰공고 + 수의계약 병렬 수집 ───────────────────────
  const supabase = createAdminClient();
  const errors: string[] = [];

  const [bids, contracts] = await Promise.all([
    collectBids(supabase, { startYmd, endYmd, sidoCodes, errors }),
    collectContracts(supabase, { startYmd, endYmd, sidoCodes, errors }),
  ]);

  return NextResponse.json({
    ok: true,
    fetched:           bids.fetched,
    saved:             bids.saved,
    fetched_contracts: contracts.fetched,
    saved_contracts:   contracts.saved,
    duration_ms:       Date.now() - t0,
    ...(errors.length > 0 ? { errors } : {}),
  });
}

// ============================================================
// 입찰공고 수집 (기존 로직 — 함수로 분리)
// ============================================================
async function collectBids(
  supabase: SupabaseAdmin,
  opts: { startYmd: string; endYmd: string; sidoCodes: string[]; errors: string[] }
): Promise<{ fetched: number; saved: number }> {
  let totalFetched = 0;
  let totalSaved   = 0;

  for (const sidoCode of opts.sidoCodes) {
    let page = 1;
    while (true) {
      const res = await fetchBidsByDateRange({
        startYmd: opts.startYmd,
        endYmd:   opts.endYmd,
        sidoCode,
        pageNo:   page,
        numOfRows: 999,
      });

      if (!res.ok) {
        opts.errors.push(`[bids 시도 ${sidoCode} p${page}] ${res.error}`);
        break;
      }
      if (res.data.length === 0) break;
      totalFetched += res.data.length;

      const idMap = await getComplexIdMap(supabase, res.data);
      const rows = res.data
        .map((raw) => {
          const kaptCode = (raw as any).kaptCode;
          const complexId = kaptCode ? idMap.get(kaptCode) : undefined;
          if (!complexId) return null;
          return buildBidRow(raw, complexId);
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      if (rows.length > 0) {
        const { error: upsertErr } = await (supabase.from('bid_announcements') as any)
          .upsert(rows, { onConflict: 'announcement_no,complex_id', ignoreDuplicates: true });
        if (upsertErr) {
          opts.errors.push(`bid_announcements upsert: ${upsertErr.message}`);
        } else {
          totalSaved += rows.length;
        }
      }

      if (res.data.length < 999) break;
      page++;
    }
  }

  return { fetched: totalFetched, saved: totalSaved };
}

// ============================================================
// 수의계약 공지 수집
// ============================================================
async function collectContracts(
  supabase: SupabaseAdmin,
  opts: { startYmd: string; endYmd: string; sidoCodes: string[]; errors: string[] }
): Promise<{ fetched: number; saved: number }> {
  let totalFetched = 0;
  let totalSaved   = 0;

  for (const sidoCode of opts.sidoCodes) {
    let page = 1;
    while (true) {
      const res = await fetchNegotiatedByDateRange({
        startYmd: opts.startYmd,
        endYmd:   opts.endYmd,
        sidoCode,
        pageNo:   page,
        numOfRows: 999,
      });

      if (!res.ok) {
        opts.errors.push(`[contracts 시도 ${sidoCode} p${page}] ${res.error}`);
        break;
      }
      if (res.data.length === 0) break;
      totalFetched += res.data.length;

      const idMap = await getComplexIdMap(supabase, res.data);
      const rows = res.data
        .map((raw) => {
          const kaptCode = (raw as any).kaptCode;
          const complexId = kaptCode ? idMap.get(kaptCode) : undefined;
          if (!complexId) return null;
          return buildContractRow(raw, complexId);
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      if (rows.length > 0) {
        const { error: upsertErr } = await (supabase.from('negotiated_contracts') as any)
          .upsert(rows, { onConflict: 'announcement_no,complex_id', ignoreDuplicates: true });
        if (upsertErr) {
          opts.errors.push(`negotiated_contracts upsert: ${upsertErr.message}`);
        } else {
          totalSaved += rows.length;
        }
      }

      if (res.data.length < 999) break;
      page++;
    }
  }

  return { fetched: totalFetched, saved: totalSaved };
}

// ============================================================
// 공통 유틸
// ============================================================
async function getComplexIdMap(
  supabase: SupabaseAdmin,
  data: (BidAnnouncementRaw | NegotiatedContractRaw)[]
): Promise<Map<string, string>> {
  const codes = Array.from(
    new Set(data.map((r) => (r as any).kaptCode).filter(Boolean) as string[])
  );
  if (codes.length === 0) return new Map();

  const { data: rows } = await (supabase as any)
    .from('complexes')
    .select('id, kapt_code')
    .in('kapt_code', codes);

  const map = new Map<string, string>();
  for (const row of (rows ?? []) as { kapt_code: string; id: string }[]) {
    map.set(row.kapt_code, row.id);
  }
  return map;
}

function buildBidRow(raw: BidAnnouncementRaw, complexId: string) {
  return {
    complex_id:       complexId,
    announcement_no:  (raw as any).bidNo ?? null,
    title:            (raw as any).bidTitle ?? null,
    work_type:        (raw as any).bidWorkType ?? null,
    estimated_amount: typeof (raw as any).bidAmount === 'number' ? (raw as any).bidAmount : null,
    announced_at:     parseDate((raw as any).noticeDate),
    deadline_at:      parseDate((raw as any).closeDate),
    status:           (raw as any).status ?? 'active',
    notified:         false,
  };
}

function buildContractRow(raw: NegotiatedContractRaw, complexId: string) {
  return {
    complex_id:      complexId,
    announcement_no: (raw as any).ntceNo ?? null,
    title:           (raw as any).ntceTitle ?? null,
    work_type:       (raw as any).workType ?? null,
    contract_amount: typeof (raw as any).contractAmount === 'number' ? (raw as any).contractAmount : null,
    announced_at:    parseDateTime((raw as any).ntceDate),
    contract_date:   parseDateTime((raw as any).contractDate),
    status:          (raw as any).status ?? 'active',
    notified:        false,
  };
}

function toYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function parseDate(s: string | undefined): string | null {
  if (!s) return null;
  if (/^\d{8}$/.test(s)) return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

function parseDateTime(s: string | undefined): string | null {
  if (!s) return null;
  if (/^\d{8}$/.test(s)) return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}T00:00:00Z`;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.length >= 10 ? s : `${s}T00:00:00Z`;
  return null;
}
