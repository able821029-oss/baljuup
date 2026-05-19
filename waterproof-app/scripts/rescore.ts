/**
 * 기존 DB 데이터로 prediction_score 재계산 (공공 API 재호출 없음)
 *
 * 실행:
 *   npm run rescore             # 전체 재계산
 *   npm run rescore -- --limit=500   # 처음 500개만 (디버깅)
 *   npm run rescore -- --dry-run     # 콘솔만, 업데이트 안 함
 *
 * 사용 시점:
 *   - lib/prediction.ts 의 가중치/곡선이 바뀌었을 때
 *   - 공공 API 재호출은 비싸므로 (수십 분~몇 시간) 기존 DB 만으로 빠르게 갱신할 때
 *
 * 동작:
 *   1) complexes 페이지 단위로 로드 (배치 500)
 *   2) 각 배치의 단지 ID로 maintenance_history / maintenance_funds / bid_announcements 일괄 조회
 *   3) 메모리에서 단지별 lastWaterproofYear / latestFund / activeBids 추출
 *   4) calcPredictionScore() 호출 → prediction_score + expected_order_year + last_updated 갱신
 *
 * 환경변수: .env.local 의 NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 사용
 */

// .env.local 명시 로딩 — Next.js 컨텍스트 밖(독립 tsx 실행)에서도 동작 보장
import { config as loadEnv } from 'dotenv';
import path from 'path';
loadEnv({ path: path.resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import { calcPredictionScore } from '../lib/prediction';
import { isWaterproofWork } from '../lib/kapt-api';

const args = parseArgs(process.argv.slice(2));
const LIMIT = typeof args.limit === 'string' ? Number(args.limit) : Infinity;
const DRY_RUN = !!args['dry-run'];
const BATCH = 500;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('\n[ERROR] NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수 누락');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

interface ComplexRow {
  id: string;
  built_year: number | null;
  households: number | null;
  buildings: number | null;
  prediction_score: number | null;
}

interface HistoryRow {
  complex_id: string;
  work_type: string | null;
  work_year: number | null;
  is_waterproof: boolean | null;
}

interface FundRow {
  complex_id: string;
  fund_balance: number | null;
  year_month: string | null;
}

interface BidRow {
  complex_id: string;
  status: string | null;
}

async function main() {
  console.log('━'.repeat(60));
  console.log('  발주Up — DB 예측 점수 재계산');
  console.log('━'.repeat(60));
  console.log(`  모드        : ${DRY_RUN ? 'DRY-RUN (변경 안함)' : 'WRITE'}`);
  console.log(`  대상 제한   : ${LIMIT === Infinity ? '전체' : LIMIT.toLocaleString() + '건'}`);
  console.log(`  배치 크기   : ${BATCH}`);
  console.log('━'.repeat(60));

  const startedAt = Date.now();
  let totalProcessed = 0;
  let totalUpdated = 0;
  let scoreChanges = 0;
  const scoreBuckets = { critical: 0, high: 0, medium: 0, low: 0 };

  // 진행 — 페이지 단위로 complexes 순회
  let offset = 0;
  while (totalProcessed < LIMIT) {
    const take = Math.min(BATCH, LIMIT - totalProcessed);
    const { data, error } = await supabase
      .from('complexes')
      .select('id, built_year, households, buildings, prediction_score')
      .order('id', { ascending: true })
      .range(offset, offset + take - 1);

    if (error) {
      console.error(`\n  [FAIL] complexes 페이지 ${offset}: ${error.message}`);
      break;
    }
    const complexes = (data ?? []) as ComplexRow[];
    if (complexes.length === 0) break;

    const ids = complexes.map((c) => c.id);

    // 자식 테이블 일괄 조회
    const [histRes, fundRes, bidRes] = await Promise.all([
      supabase
        .from('maintenance_history')
        .select('complex_id, work_type, work_year, is_waterproof')
        .in('complex_id', ids),
      supabase
        .from('maintenance_funds')
        .select('complex_id, fund_balance, year_month')
        .in('complex_id', ids)
        .order('year_month', { ascending: false }),
      supabase
        .from('bid_announcements')
        .select('complex_id, status')
        .in('complex_id', ids)
        .eq('status', 'active'),
    ]);

    if (histRes.error) console.warn(`  [WARN] history: ${histRes.error.message}`);
    if (fundRes.error) console.warn(`  [WARN] funds: ${fundRes.error.message}`);
    if (bidRes.error) console.warn(`  [WARN] bids: ${bidRes.error.message}`);

    const history = ((histRes.data ?? []) as unknown) as HistoryRow[];
    const funds = ((fundRes.data ?? []) as unknown) as FundRow[];
    const bids = ((bidRes.data ?? []) as unknown) as BidRow[];

    // 단지별 lastWaterproofYear (방수 이력 중 최신 work_year)
    const lastWpMap = new Map<string, number>();
    for (const h of history) {
      const isWp = h.is_waterproof ?? isWaterproofWork(h.work_type ?? '');
      if (!isWp) continue;
      const y = Number(h.work_year);
      if (!Number.isFinite(y) || y <= 0) continue;
      const prev = lastWpMap.get(h.complex_id);
      if (prev == null || y > prev) lastWpMap.set(h.complex_id, y);
    }

    // 단지별 최신 충당금 (year_month DESC 로 정렬되어 첫 값이 최신)
    const latestFundMap = new Map<string, number>();
    for (const f of funds) {
      if (latestFundMap.has(f.complex_id)) continue;
      if (f.fund_balance != null) latestFundMap.set(f.complex_id, f.fund_balance);
    }

    // 단지별 활성 입찰공고 수
    const activeBidMap = new Map<string, number>();
    for (const b of bids) {
      activeBidMap.set(b.complex_id, (activeBidMap.get(b.complex_id) ?? 0) + 1);
    }

    // 신규 점수 계산 + 업데이트 페이로드 준비
    const updates: Array<{
      id: string;
      prediction_score: number;
      expected_order_year: number;
      last_updated: string;
    }> = [];
    const nowIso = new Date().toISOString();

    for (const c of complexes) {
      const pred = calcPredictionScore({
        builtYear: c.built_year,
        lastWaterproofYear: lastWpMap.get(c.id) ?? null,
        fundBalance: latestFundMap.get(c.id) ?? null,
        activeBids: activeBidMap.get(c.id) ?? 0,
        households: c.households,
        buildings: c.buildings,
      });

      if ((c.prediction_score ?? 0) !== pred.score) scoreChanges++;
      scoreBuckets[pred.tier]++;

      updates.push({
        id: c.id,
        prediction_score: pred.score,
        expected_order_year: pred.expectedOrderYear,
        last_updated: nowIso,
      });
    }

    // 업데이트 — per-row UPDATE (upsert 는 INSERT 부분에서 NOT NULL 컬럼인 kapt_code 제약 위반)
    // 동시 50개씩 묶어 보내 전체 ~9000건도 30초 내 처리
    if (!DRY_RUN && updates.length) {
      const CONCURRENCY = 50;
      let failed = 0;
      for (let i = 0; i < updates.length; i += CONCURRENCY) {
        const slice = updates.slice(i, i + CONCURRENCY);
        const results = await Promise.all(
          slice.map((u) =>
            supabase
              .from('complexes')
              .update({
                prediction_score: u.prediction_score,
                expected_order_year: u.expected_order_year,
                last_updated: u.last_updated,
              })
              .eq('id', u.id),
          ),
        );
        for (const r of results) {
          if (r.error) failed++;
          else totalUpdated++;
        }
      }
      if (failed > 0) {
        console.error(`\n  [WARN] 이 배치에서 ${failed}건 업데이트 실패`);
      }
    }

    totalProcessed += complexes.length;
    offset += complexes.length;
    process.stdout.write(
      `\r  처리 ${totalProcessed.toLocaleString()}건 · 변경 ${scoreChanges.toLocaleString()} · ` +
        `티어: 즉시 ${scoreBuckets.critical} / 6개월 ${scoreBuckets.high} / 1년 ${scoreBuckets.medium} / 장기 ${scoreBuckets.low}`,
    );

    if (complexes.length < take) break; // 마지막 페이지
  }

  process.stdout.write('\n');
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log('━'.repeat(60));
  console.log(`  처리 완료    : ${totalProcessed.toLocaleString()}건`);
  console.log(`  실제 갱신    : ${DRY_RUN ? '(dry-run)' : totalUpdated.toLocaleString() + '건'}`);
  console.log(`  점수 변경    : ${scoreChanges.toLocaleString()}건`);
  console.log('  티어 분포:');
  console.log(`    즉시 접촉   : ${scoreBuckets.critical.toLocaleString()}건`);
  console.log(`    6개월 내    : ${scoreBuckets.high.toLocaleString()}건`);
  console.log(`    1년 내      : ${scoreBuckets.medium.toLocaleString()}건`);
  console.log(`    장기 모니터링: ${scoreBuckets.low.toLocaleString()}건`);
  console.log(`  소요 시간    : ${elapsed}s`);
  console.log('━'.repeat(60));
}

function parseArgs(argv: string[]): Record<string, string | true> {
  const out: Record<string, string | true> = {};
  for (const a of argv) {
    if (!a.startsWith('--')) continue;
    const [k, v] = a.slice(2).split('=');
    out[k] = v ?? true;
  }
  return out;
}

main().catch((err) => {
  console.error('\n[FATAL]', err);
  process.exit(1);
});
