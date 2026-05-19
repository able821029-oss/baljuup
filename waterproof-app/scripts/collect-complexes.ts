/**
 * 공공데이터 단지 수집 스크립트 (수동 실행)
 *
 * 실행:
 *   npx ts-node scripts/collect-complexes.ts                # 기본 (서울+경기)
 *   npx ts-node scripts/collect-complexes.ts --sido=11      # 서울만
 *   npx ts-node scripts/collect-complexes.ts --enrich       # 단지 기본 + 유지이력 + 충당금 + 예측점수
 *   npx ts-node scripts/collect-complexes.ts --dry-run      # Supabase 적재 없이 콘솔만
 *
 * 환경변수 (.env.local):
 *   DATA_GO_KR_KEY                — 공공데이터포털 인증키
 *   NEXT_PUBLIC_SUPABASE_URL      — Supabase 프로젝트 URL
 *   SUPABASE_SERVICE_ROLE_KEY     — 서버용 서비스 키 (RLS 우회)
 *
 * 동작 순서:
 *   1) 시도별 단지 전수 수집 (페이지네이션)
 *   2) Supabase `complexes` 테이블에 upsert (kapt_code 기준)
 *   3) --enrich 옵션 시: 각 단지의 유지관리이력·충당금을 fetch 후 점수 갱신
 *
 * 안전장치:
 *   - 동시 요청 수 제한 (CONCURRENCY)
 *   - 단지별 실패 시 다음 단지로 계속 진행 (배치 통계만 기록)
 *   - 진행률 한 줄 갱신 + 5초마다 누적 통계 출력
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  fetchAllComplexes,
  fetchMaintenanceHistory,
  fetchMaintenanceFund,
  fetchComplexBasicInfo,
  normalizeComplex,
  SIDO_CODES,
  isWaterproofWork,
  type ComplexRaw,
} from '../lib/kapt-api';
import { calcPredictionScore } from '../lib/prediction';

// ============================================================
// CLI 인자 파싱
// ============================================================
const args = parseArgs(process.argv.slice(2));
const TARGET_SIDOS: string[] = typeof args.sido === 'string'
  ? [args.sido]
  : [SIDO_CODES.서울, SIDO_CODES.경기];
const ENRICH = !!args.enrich;
const DRY_RUN = !!args['dry-run'];
const CONCURRENCY = Number(typeof args.concurrency === 'string' ? args.concurrency : 5);

// ============================================================
// 환경 변수 검증
// ============================================================
const DATA_GO_KR_KEY = process.env.DATA_GO_KR_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function assertEnv() {
  const missing: string[] = [];
  if (!DATA_GO_KR_KEY) missing.push('DATA_GO_KR_KEY');
  if (!DRY_RUN) {
    if (!SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL');
    if (!SUPABASE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  }
  if (missing.length) {
    console.error(`\n[ERROR] 환경변수 누락: ${missing.join(', ')}`);
    console.error('  .env.local 파일에 추가한 뒤 다시 실행하세요.');
    console.error('  (dry-run 모드는 Supabase 변수 없이도 가능)');
    process.exit(1);
  }
}

// ============================================================
// 메인
// ============================================================
async function main() {
  assertEnv();

  console.log('━'.repeat(60));
  console.log('  발주Up — 공공데이터 단지 수집 스크립트');
  console.log('━'.repeat(60));
  console.log(`  대상 시도   : ${TARGET_SIDOS.join(', ')}`);
  console.log(`  보강 모드   : ${ENRICH ? 'ON (유지이력 + 충당금 + 점수)' : 'OFF (단지 기본만)'}`);
  console.log(`  드라이런    : ${DRY_RUN ? 'YES (DB 적재 안함)' : 'NO'}`);
  console.log(`  동시 요청   : ${CONCURRENCY}`);
  console.log('━'.repeat(60));

  const supabase = DRY_RUN
    ? null
    : createClient(SUPABASE_URL!, SUPABASE_KEY!, {
        auth: { persistSession: false },
      });

  const startedAt = Date.now();
  const allStats = {
    fetched: 0,
    upserted: 0,
    enriched: 0,
    failed: 0,
  };

  for (const sido of TARGET_SIDOS) {
    console.log(`\n── 시도 ${sido} 수집 시작 ──`);

    const fetchResult = await fetchAllComplexes(sido, {
      pageSize: 1000,
      onPage: ({ page, count, cumulative }) => {
        process.stdout.write(
          `\r  페이지 ${String(page).padStart(2, '0')} · 이번 ${count}건 · 누적 ${cumulative}건`
        );
      },
    });

    process.stdout.write('\n');

    if (!fetchResult.ok) {
      console.error(`  [FAIL] 시도 ${sido}: ${fetchResult.error}`);
      allStats.failed++;
      continue;
    }

    const complexes = fetchResult.data;
    allStats.fetched += complexes.length;
    console.log(`  수집 완료: ${complexes.length.toLocaleString()}건`);

    if (!complexes.length) continue;

    // ── Supabase 적재 ──────────────────────────────────────
    if (!DRY_RUN && supabase) {
      const upserted = await upsertComplexes(supabase, complexes);
      allStats.upserted += upserted;
      console.log(`  Supabase upsert: ${upserted.toLocaleString()}건`);
    } else {
      console.log('  [dry-run] DB 적재 생략');
      console.log('  샘플 (첫 3건):', complexes.slice(0, 3).map((c) => c.kaptName));
    }

    // ── 보강 (옵션) ────────────────────────────────────────
    if (ENRICH) {
      console.log(`  보강 단계 시작 — ${complexes.length}건의 유지이력 + 충당금 조회`);
      const enriched = await enrichAndScore(supabase, complexes);
      allStats.enriched += enriched;
      console.log(`  보강 완료: ${enriched.toLocaleString()}건 갱신`);
    }
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log('\n' + '━'.repeat(60));
  console.log('  최종 결과');
  console.log('━'.repeat(60));
  console.log(`  단지 fetch  : ${allStats.fetched.toLocaleString()}건`);
  console.log(`  DB upsert   : ${allStats.upserted.toLocaleString()}건`);
  console.log(`  보강 완료    : ${allStats.enriched.toLocaleString()}건`);
  console.log(`  실패 시도   : ${allStats.failed}건`);
  console.log(`  소요 시간   : ${elapsed}s`);
  console.log('━'.repeat(60));
}

// ============================================================
// Supabase upsert (단지 기본 정보)
// ============================================================
async function upsertComplexes(
  supabase: SupabaseClient,
  complexes: ComplexRaw[]
): Promise<number> {
  const BATCH = 500;
  let count = 0;

  for (let i = 0; i < complexes.length; i += BATCH) {
    const slice = complexes.slice(i, i + BATCH);
    const rows = slice
      .map((c) => normalizeComplex(c))
      .filter((r) => r.kapt_code && r.name);

    const { error } = await supabase
      .from('complexes')
      .upsert(rows, { onConflict: 'kapt_code', ignoreDuplicates: false });

    if (error) {
      console.error(`  [WARN] upsert 배치 ${i}~${i + BATCH} 실패: ${error.message}`);
      continue;
    }
    count += rows.length;
    process.stdout.write(`\r  upsert 진행: ${count.toLocaleString()} / ${complexes.length.toLocaleString()}`);
  }
  process.stdout.write('\n');
  return count;
}

// ============================================================
// 보강 — 유지이력 + 충당금 fetch 후 점수 계산 & 갱신
// ============================================================
async function enrichAndScore(
  supabase: SupabaseClient | null,
  complexes: ComplexRaw[]
): Promise<number> {
  let processed = 0;
  let updated = 0;
  // 디버그 통계 — 첫 실행에서 API 별 성공률 확인
  const stats = {
    basicOk: 0, basicFail: 0,
    histOk: 0, histFail: 0, histHasItems: 0,
    fundOk: 0, fundFail: 0, fundHasItems: 0,
    wpFound: 0, fundFound: 0, builtFound: 0,
  };
  const sampleErrors: string[] = [];

  // 동시 요청 수 제한
  const queue = complexes.slice();
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const c = queue.shift();
      if (!c) break;
      const kaptCode = String(c.kaptCode);

      try {
        const [histRes, fundRes, basicRes] = await Promise.all([
          fetchMaintenanceHistory(kaptCode),
          fetchMaintenanceFund(kaptCode),
          fetchComplexBasicInfo(kaptCode),
        ]);

        // 통계 누적
        if (histRes.ok) {
          stats.histOk++;
          if (histRes.data.length > 0) stats.histHasItems++;
        } else {
          stats.histFail++;
          if (sampleErrors.length < 3) sampleErrors.push(`hist: ${histRes.error}`);
        }
        if (fundRes.ok) {
          stats.fundOk++;
          if (fundRes.data.length > 0) stats.fundHasItems++;
        } else {
          stats.fundFail++;
          if (sampleErrors.length < 6) sampleErrors.push(`fund: ${fundRes.error}`);
        }
        if (basicRes.ok) {
          stats.basicOk++;
        } else {
          stats.basicFail++;
          if (sampleErrors.length < 9) sampleErrors.push(`basic: ${basicRes.error}`);
        }

        // 마지막 방수 공사 연도
        let lastWaterproofYear: number | null = null;
        if (histRes.ok) {
          for (const h of histRes.data) {
            const isWp = h.is_waterproof ?? isWaterproofWork(String(h.workType ?? ''));
            const y = Number(h.workYear);
            if (isWp && Number.isFinite(y)) {
              if (lastWaterproofYear == null || y > lastWaterproofYear) lastWaterproofYear = y;
            }
          }
        }
        if (lastWaterproofYear != null) stats.wpFound++;

        // 최신 충당금 잔액
        let fundBalance: number | null = null;
        if (fundRes.ok && fundRes.data.length) {
          const sorted = fundRes.data.slice().sort((a, b) =>
            String(b.yearMonth ?? '').localeCompare(String(a.yearMonth ?? ''))
          );
          const raw = Number(sorted[0].fundBalance);
          if (Number.isFinite(raw)) fundBalance = raw;
        }
        if (fundBalance != null) stats.fundFound++;

        // 준공연도 — 1) 목록 응답에 있으면 사용, 2) 기본정보 API 응답에서 추출
        let builtYear: number | null = normalizeComplex(c).built_year;
        if (!builtYear && basicRes.ok) {
          builtYear = normalizeComplex(basicRes.data).built_year;
        }
        if (builtYear != null) stats.builtFound++;

        // 세대수/동수 — 목록 응답 또는 기본정보 API 에서 추출 (대단지 가산점 + 결정적 지터)
        const baseNorm = normalizeComplex(c);
        const basicNorm = basicRes.ok ? normalizeComplex(basicRes.data) : null;
        const householdsForScore = baseNorm.households ?? basicNorm?.households ?? null;
        const buildingsForScore = baseNorm.buildings ?? basicNorm?.buildings ?? null;

        const pred = calcPredictionScore({
          builtYear,
          lastWaterproofYear,
          fundBalance,
          households: householdsForScore,
          buildings: buildingsForScore,
        });

        if (supabase) {
          const update: Record<string, unknown> = {
            prediction_score: pred.score,
            expected_order_year: pred.expectedOrderYear,
            last_updated: new Date().toISOString(),
          };
          if (builtYear != null) update.built_year = builtYear;
          // 기본정보 API 응답에서 세대수/동수 가 있다면 같이 갱신
          if (basicRes.ok) {
            const norm = normalizeComplex(basicRes.data);
            if (norm.households != null) update.households = norm.households;
            if (norm.buildings != null) update.buildings = norm.buildings;
            if (norm.phone) update.phone = norm.phone;
            if (norm.management_type) update.management_type = norm.management_type;
          }

          const { error } = await supabase
            .from('complexes')
            .update(update)
            .eq('kapt_code', kaptCode);
          if (!error) updated++;
        }
      } catch (err: any) {
        // 단지별 실패는 무시하고 다음으로
        if (sampleErrors.length < 12) sampleErrors.push(`catch: ${String(err?.message || err)}`);
      } finally {
        processed++;
        if (processed % 10 === 0) {
          process.stdout.write(
            `\r  보강 진행: ${processed.toLocaleString()} / ${complexes.length.toLocaleString()}`
          );
        }
      }
    }
  });

  await Promise.all(workers);
  process.stdout.write('\n');

  // 디버그 통계 출력
  console.log('\n  [보강 API 통계]');
  console.log(`    basic    — OK ${stats.basicOk} / FAIL ${stats.basicFail}`);
  console.log(`    hist     — OK ${stats.histOk} / FAIL ${stats.histFail} / HAS_ITEMS ${stats.histHasItems}`);
  console.log(`    fund     — OK ${stats.fundOk} / FAIL ${stats.fundFail} / HAS_ITEMS ${stats.fundHasItems}`);
  console.log(`    추출 결과 — builtYear ${stats.builtFound} / lastWaterproof ${stats.wpFound} / fundBalance ${stats.fundFound}`);
  if (sampleErrors.length) {
    console.log('  [샘플 에러 (최대 12건)]');
    for (const e of sampleErrors) console.log(`    - ${e}`);
  }

  return updated;
}

// ============================================================
// CLI 헬퍼
// ============================================================
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

// ============================================================
// 실행
// ============================================================
main().catch((err) => {
  console.error('\n[FATAL]', err);
  process.exit(1);
});
