/**
 * 공동주택 입찰공고 + 수의계약 공지 수집 스크립트
 *
 * ─── 전제 조건 ───────────────────────────────────────────────
 *  data.go.kr 에서 두 API 를 별도 신청해야 합니다:
 *    입찰공고:   https://www.data.go.kr/data/15058166/openapi.do
 *    수의계약:   https://www.data.go.kr/data/15057758/openapi.do
 *    → 각각 "활용신청" 클릭 → 즉시 자동 승인
 *    → 동일한 DATA_GO_KR_KEY 로 사용 가능
 *
 * ─── 실행 방법 ───────────────────────────────────────────────
 *   npx ts-node scripts/collect-bids.ts                     # 입찰+수의계약 (최근 30일, 서울+경기)
 *   npx ts-node scripts/collect-bids.ts --type=bids         # 입찰공고만
 *   npx ts-node scripts/collect-bids.ts --type=contracts    # 수의계약만
 *   npx ts-node scripts/collect-bids.ts --type=all          # 둘 다 (기본값)
 *   npx ts-node scripts/collect-bids.ts --days=7            # 최근 7일
 *   npx ts-node scripts/collect-bids.ts --sido=11           # 서울만
 *   npx ts-node scripts/collect-bids.ts --dry-run           # DB 저장 없이 확인
 *   npx ts-node scripts/collect-bids.ts --by-complex        # 단지별 순회 모드
 *
 * ─── 환경변수 (.env.local) ────────────────────────────────────
 *   DATA_GO_KR_KEY               — 공공데이터포털 인증키
 *   NEXT_PUBLIC_SUPABASE_URL     — Supabase 프로젝트 URL
 *   SUPABASE_SERVICE_ROLE_KEY    — 서비스 롤 키 (RLS 우회)
 *
 * ─── 동작 ─────────────────────────────────────────────────────
 *  [날짜 범위 모드 - 기본]
 *   1) 오늘 기준 --days 일 이내의 신규 공고/계약을 날짜 범위로 조회
 *   2) bid_announcements / negotiated_contracts 테이블에 upsert
 *      - 충돌 키: (announcement_no, complex_id)
 *   3) /api/alerts/check 가 알아서 알림톡 발송
 *
 *  [단지별 모드 --by-complex]
 *   1) complexes 테이블에서 방수 공사 필요 단지 목록 조회 (score > 50)
 *   2) 각 단지에 fetchBidAnnouncements() / fetchNegotiatedContracts() 호출
 *   3) 동일하게 upsert
 */

import './_loadEnv';

import { createClient } from '@supabase/supabase-js';
import {
  fetchBidsByDateRange,
  fetchBidAnnouncements,
  fetchNegotiatedByDateRange,
  fetchNegotiatedContracts,
  SIDO_CODES,
  type BidAnnouncementRaw,
  type NegotiatedContractRaw,
} from '../lib/kapt-api';

// ============================================================
// CLI 인자 파싱
// ============================================================
const args = parseArgs(process.argv.slice(2));
const DRY_RUN    = !!args['dry-run'];
const BY_COMPLEX = !!args['by-complex'];
const DAYS       = Number(typeof args.days === 'string' ? args.days : 30);
const TARGET_SIDOS: string[] = typeof args.sido === 'string'
  ? [args.sido]
  : [SIDO_CODES.서울, SIDO_CODES.경기];
const CONCURRENCY = Number(typeof args.concurrency === 'string' ? args.concurrency : 5);

type CollectType = 'bids' | 'contracts' | 'all';
const TYPE_ARG: CollectType = (() => {
  const v = typeof args.type === 'string' ? args.type : 'all';
  if (v === 'bids' || v === 'contracts' || v === 'all') return v;
  console.warn(`⚠️  --type 값이 잘못됨: '${v}' → 'all' 로 진행합니다.`);
  return 'all';
})();
const RUN_BIDS      = TYPE_ARG === 'bids' || TYPE_ARG === 'all';
const RUN_CONTRACTS = TYPE_ARG === 'contracts' || TYPE_ARG === 'all';

// ============================================================
// 환경 변수 검증
// ============================================================
const DATA_GO_KR_KEY = process.env.DATA_GO_KR_KEY;
const SUPABASE_URL   = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!DATA_GO_KR_KEY) {
  console.error('❌  DATA_GO_KR_KEY 환경변수가 없습니다.');
  process.exit(1);
}
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌  Supabase 환경변수(URL/SERVICE_ROLE_KEY)가 없습니다.');
  if (!DRY_RUN) process.exit(1);
}

const supabase = (!DRY_RUN && SUPABASE_URL && SUPABASE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

// ============================================================
// 날짜 헬퍼
// ============================================================
function toYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

// ============================================================
// 입찰공고 → DB row 변환
// ============================================================
function toDbRow(raw: BidAnnouncementRaw & { kaptCode?: string }, complexId: string) {
  return {
    complex_id:       complexId,
    announcement_no:  raw.bidNo ?? null,
    title:            raw.bidTitle ?? null,
    work_type:        raw.bidWorkType ?? null,
    estimated_amount: typeof raw.bidAmount === 'number' ? raw.bidAmount : null,
    announced_at:     parseDate(raw.noticeDate),
    deadline_at:      parseDate(raw.closeDate),
    status:           raw.status ?? 'active',
    notified:         false,
  };
}

function parseDate(s: string | undefined): string | null {
  if (!s) return null;
  // 'YYYYMMDD' → 'YYYY-MM-DD'
  if (/^\d{8}$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }
  // 이미 ISO 형식
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

// ============================================================
// DB upsert — announcement_no + complex_id 중복 방지
// ============================================================
async function upsertBids(rows: ReturnType<typeof toDbRow>[]): Promise<number> {
  if (!supabase || rows.length === 0) {
    if (DRY_RUN) console.log(`  [dry-run] bid_announcements upsert 건수: ${rows.length}`);
    return rows.length;
  }

  const { error, count } = await (supabase.from('bid_announcements') as any)
    .upsert(rows, {
      onConflict: 'announcement_no,complex_id',
      ignoreDuplicates: true,
    })
    .select('id', { count: 'exact', head: true });

  if (error) {
    console.warn(`  ⚠️  upsert 오류: ${error.message}`);
    return 0;
  }
  return count ?? rows.length;
}

// ============================================================
// 수의계약 → DB row 변환 / upsert
// ============================================================
function toContractRow(raw: NegotiatedContractRaw & { kaptCode?: string }, complexId: string) {
  return {
    complex_id:      complexId,
    announcement_no: raw.ntceNo ?? null,
    title:           raw.ntceTitle ?? null,
    work_type:       raw.workType ?? null,
    contract_amount: typeof raw.contractAmount === 'number' ? raw.contractAmount : null,
    announced_at:    parseDateTime(raw.ntceDate),
    contract_date:   parseDateTime(raw.contractDate),
    status:          raw.status ?? 'active',
    notified:        false,
  };
}

async function upsertContracts(rows: ReturnType<typeof toContractRow>[]): Promise<number> {
  if (!supabase || rows.length === 0) {
    if (DRY_RUN) console.log(`  [dry-run] negotiated_contracts upsert 건수: ${rows.length}`);
    return rows.length;
  }

  const { error, count } = await (supabase.from('negotiated_contracts') as any)
    .upsert(rows, {
      onConflict: 'announcement_no,complex_id',
      ignoreDuplicates: true,
    })
    .select('id', { count: 'exact', head: true });

  if (error) {
    console.warn(`  ⚠️  upsert 오류 (negotiated_contracts): ${error.message}`);
    return 0;
  }
  return count ?? rows.length;
}

// negotiated_contracts.announced_at / contract_date 는 TIMESTAMPTZ
// 'YYYYMMDD' → 'YYYY-MM-DDT00:00:00Z' 형식으로 변환
function parseDateTime(s: string | undefined): string | null {
  if (!s) return null;
  if (/^\d{8}$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T00:00:00Z`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    // 이미 ISO 형식 — 시각 정보 유지
    return s.length >= 10 ? s : `${s}T00:00:00Z`;
  }
  return null;
}

// ============================================================
// 복잡 코드 → complex_id 매핑 (DB 조회)
// ============================================================
async function getComplexIdMap(kaptCodes: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!supabase || kaptCodes.length === 0) return map;

  const { data } = await supabase
    .from('complexes')
    .select('id, kapt_code')
    .in('kapt_code', kaptCodes);

  for (const row of data ?? []) {
    map.set(row.kapt_code, row.id);
  }
  return map;
}

// ============================================================
// 모드 A: 날짜 범위 전체 조회
// ============================================================
async function collectByDateRange() {
  const endDate   = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - DAYS);

  const endYmd   = toYmd(endDate);
  const startYmd = toYmd(startDate);

  console.log(`📅  날짜 범위: ${startYmd} ~ ${endYmd} (${DAYS}일)`);
  console.log(`📍  대상 시도: ${TARGET_SIDOS.join(', ')}`);

  let totalFetched = 0;
  let totalSaved   = 0;

  for (const sidoCode of TARGET_SIDOS) {
    let page = 1;
    while (true) {
      console.log(`  [시도 ${sidoCode}] page ${page} 조회 중...`);
      const res = await fetchBidsByDateRange({
        startYmd,
        endYmd,
        sidoCode,
        pageNo: page,
        numOfRows: 999,
      });

      if (!res.ok) {
        console.warn(`  ⚠️  API 오류 (시도 ${sidoCode}): ${res.error}`);
        // API 미신청 시 SERVICE_KEY 오류 — 더 진행 불필요
        if (/SERVICE_KEY|NOT_REGISTERED|UNAUTHORIZED/i.test(res.error)) {
          console.error('\n❌  API 미신청 상태입니다. data.go.kr 에서 신청하세요:');
          console.error('   https://www.data.go.kr/data/15058166/openapi.do\n');
          process.exit(1);
        }
        break;
      }

      if (res.data.length === 0) break;
      totalFetched += res.data.length;

      // kaptCode 목록 추출 → complex_id 매핑
      const kaptCodesSet = new Set<string>(
        res.data.map((r) => (r as any).kaptCode).filter(Boolean) as string[]
      );
      const kaptCodes = Array.from(kaptCodesSet);
      const idMap = await getComplexIdMap(kaptCodes);

      const rows = res.data
        .map((raw) => {
          const kaptCode = (raw as any).kaptCode;
          const complexId = kaptCode ? idMap.get(kaptCode) : undefined;
          if (!complexId) return null;
          return toDbRow(raw as BidAnnouncementRaw & { kaptCode: string }, complexId);
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      if (DRY_RUN) {
        console.log(`  [dry-run] ${rows.length}건 샘플:`);
        rows.slice(0, 3).forEach((r) => {
          console.log(`    - ${r.title ?? '제목없음'} | ${r.work_type ?? '-'} | ${r.announced_at ?? '-'}`);
        });
      }

      const saved = await upsertBids(rows);
      totalSaved += saved;
      console.log(`  ✅  ${res.data.length}건 수신, ${saved}건 저장`);

      if (res.data.length < 999) break;
      page++;
      await sleep(400);
    }
  }

  console.log(`\n🎉  완료: 총 ${totalFetched}건 수신, ${totalSaved}건 신규 저장`);
}

// ============================================================
// 모드 B: 단지별 순회
// ============================================================
async function collectByComplex() {
  if (!supabase) {
    console.error('단지별 모드는 Supabase 연결이 필요합니다.');
    process.exit(1);
  }

  console.log(`🏢  단지별 입찰공고 수집 (score > 50, sido: ${TARGET_SIDOS.join(', ')})`);

  // 점수 높은 단지만 대상
  const { data: complexRows, error: complexErr } = await supabase
    .from('complexes')
    .select('id, kapt_code, name, sido_code')
    .gt('score', 50)
    .in('sido_code', TARGET_SIDOS);

  if (complexErr) {
    console.error(`❌  단지 조회 오류: ${complexErr.message}`);
    process.exit(1);
  }

  const complexes = complexRows ?? [];
  console.log(`  대상 단지: ${complexes.length}개`);

  let totalSaved = 0;

  // 동시 실행 수 제한 (CONCURRENCY)
  for (let i = 0; i < complexes.length; i += CONCURRENCY) {
    const batch = complexes.slice(i, i + CONCURRENCY);

    await Promise.all(
      batch.map(async (complex) => {
        const { id: complexId, kapt_code: kaptCode, name } = complex;
        try {
          if (RUN_BIDS) {
            const res = await fetchBidAnnouncements(kaptCode);
            if (res.ok && res.data.length > 0) {
              const rows = res.data.map((raw) =>
                toDbRow(raw as BidAnnouncementRaw & { kaptCode: string }, complexId)
              );
              const saved = await upsertBids(rows);
              totalSaved += saved;
              if (saved > 0) console.log(`  [${name}] 입찰공고 ${saved}건 저장`);
            }
          }

          if (RUN_CONTRACTS) {
            const res = await fetchNegotiatedContracts(kaptCode);
            if (res.ok && res.data.length > 0) {
              const rows = res.data.map((raw) =>
                toContractRow(raw as NegotiatedContractRaw & { kaptCode: string }, complexId)
              );
              const saved = await upsertContracts(rows);
              totalSaved += saved;
              if (saved > 0) console.log(`  [${name}] 수의계약 ${saved}건 저장`);
            }
          }
        } catch (err) {
          console.warn(`  ⚠️  [${name}] 오류: ${String(err)}`);
        }
      })
    );

    await sleep(300);
  }

  console.log(`\n🎉  완료: 총 ${totalSaved}건 신규 저장`);
}

// ============================================================
// 유틸리티
// ============================================================
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};
  for (const arg of argv) {
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      if (eq === -1) {
        result[arg.slice(2)] = true;
      } else {
        result[arg.slice(2, eq)] = arg.slice(eq + 1);
      }
    }
  }
  return result;
}

// ============================================================
// 진입점
// ============================================================
async function main() {
  console.log('=================================================');
  console.log(' 발주Up — 공동주택 입찰공고 수집');
  console.log(`  모드: ${BY_COMPLEX ? '단지별' : '날짜 범위'}`);
  console.log(`  타입: ${TYPE_ARG}`);
  console.log(`  DRY_RUN: ${DRY_RUN}`);
  console.log('=================================================\n');

  if (BY_COMPLEX) {
    await collectByComplex();
  } else {
    await collectByDateRange();
  }
}

main().catch((err) => {
  console.error('예기치 못한 오류:', err);
  process.exit(1);
});
