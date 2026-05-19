/**
 * /complexes — 단지 목록 페이지 (Server Component)
 *
 * URL 쿼리:
 *   ?tier=critical|high|medium|low   점수 임계
 *   ?sido=서울|경기|인천             지역 (주소 첫 글자로 LIKE 매칭)
 *   ?sort=score|year|name            정렬 키
 *   ?page=1                          페이지 (1-based, 페이지당 20개)
 *
 * 단지 row 는 complexes 테이블 직접 조회 (stored prediction_score 사용).
 */

import { createClient } from '@/lib/supabase/server';
import { ComplexFilters } from '@/components/complexes/ComplexFilters';
import { PredictionScore } from '@/components/complexes/PredictionScore';
import { Pagination } from '@/components/complexes/Pagination';
import { SCORE_TIERS } from '@/lib/prediction';
import { predictAllCategories, WORK_CATEGORIES } from '@/lib/work-categories';

export const revalidate = 60;

const PAGE_SIZE = 20;

type SearchParams = {
  tier?: string;
  sido?: string;
  sort?: string;
  page?: string;
};

export default async function ComplexesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams> | SearchParams;
}) {
  const sp = await Promise.resolve(searchParams);
  const tier = sp.tier ?? '';
  const sido = sp.sido ?? '';
  const sort = sp.sort ?? 'score';
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);

  const supabase = await createClient();

  // 기본 쿼리 — 영업 정보 다 포함
  let query = supabase
    .from('complexes')
    .select(
      'id, name, address, sido, built_year, households, buildings, phone, management_type, prediction_score, expected_order_year, last_updated',
      { count: 'exact' },
    );

  // tier 필터 (저장된 prediction_score 기준)
  if (tier === 'critical') query = query.gte('prediction_score', SCORE_TIERS.critical.min);
  else if (tier === 'high') query = query.gte('prediction_score', SCORE_TIERS.high.min).lt('prediction_score', SCORE_TIERS.critical.min);
  else if (tier === 'medium') query = query.gte('prediction_score', SCORE_TIERS.medium.min).lt('prediction_score', SCORE_TIERS.high.min);
  else if (tier === 'low') query = query.lt('prediction_score', SCORE_TIERS.medium.min);

  // 지역 필터 — 주소 LIKE 매칭 (예: '서울'로 시작)
  if (sido) {
    query = query.ilike('address', `${sido}%`);
  }

  // 정렬
  if (sort === 'year') query = query.order('built_year', { ascending: true, nullsFirst: false });
  else if (sort === 'name') query = query.order('name', { ascending: true });
  else query = query.order('prediction_score', { ascending: false });

  // 페이지네이션
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
        단지 목록을 불러오지 못했습니다: {error.message}
      </div>
    );
  }

  type ComplexRow = {
    id: string;
    name: string;
    address: string | null;
    sido: string | null;
    built_year: number | null;
    households: number | null;
    buildings: number | null;
    phone: string | null;
    management_type: string | null;
    prediction_score: number | null;
    expected_order_year: number | null;
    last_updated: string | null;
  };
  const rows = ((data ?? []) as unknown) as ComplexRow[];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // 영업 정보 보강 — 이 페이지의 단지들에 대해 충당금 잔액 / 마지막 방수 연도 가져오기
  const ids = rows.map((r) => r.id);
  const fundMap = new Map<string, number>();
  const lastWaterproofMap = new Map<string, number>();

  if (ids.length > 0) {
    // 충당금 — 단지별 최신 month 의 잔액 1건씩
    const { data: fundData } = await supabase
      .from('maintenance_funds')
      .select('complex_id, fund_balance, year_month')
      .in('complex_id', ids)
      .order('year_month', { ascending: false });

    if (fundData) {
      for (const f of fundData as Array<{ complex_id: string; fund_balance: number | null; year_month: string }>) {
        if (!fundMap.has(f.complex_id) && f.fund_balance != null) {
          fundMap.set(f.complex_id, f.fund_balance);
        }
      }
    }

    // 마지막 방수 공사 연도 (is_waterproof=true 중 max(work_year))
    const { data: histData } = await supabase
      .from('maintenance_history')
      .select('complex_id, work_year, is_waterproof')
      .in('complex_id', ids)
      .eq('is_waterproof', true)
      .order('work_year', { ascending: false });

    if (histData) {
      for (const h of histData as Array<{ complex_id: string; work_year: number | null }>) {
        if (!lastWaterproofMap.has(h.complex_id) && h.work_year != null) {
          lastWaterproofMap.set(h.complex_id, h.work_year);
        }
      }
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div>
        <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">단지 목록</h2>
        <p className="mt-1 text-sm text-gray-500">
          예측 점수, 지역, 정렬 기준으로 영업 우선순위를 정하세요.
        </p>
      </div>

      <ComplexFilters total={total} />

      {rows.length === 0 ? (
        <EmptyResult />
      ) : (
        <>
          {/* 데스크탑 테이블 — 영업 정보 풀로딩 */}
          <div className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white md:block">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-4 py-3">단지 / 영업 정보</th>
                  <th className="w-20 px-3 py-3">준공</th>
                  <th className="w-20 px-3 py-3">세대수</th>
                  <th className="w-24 px-3 py-3">충당금</th>
                  <th className="w-24 px-3 py-3">방수이력</th>
                  <th className="w-28 px-3 py-3">추천 공종</th>
                  <th className="w-24 px-3 py-3">예상 발주</th>
                  <th className="w-24 px-3 py-3">예측 점수</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c, i) => (
                  <ComplexRowDesktop
                    key={c.id}
                    c={c}
                    index={i}
                    fundBalance={fundMap.get(c.id) ?? null}
                    lastWaterproofYear={lastWaterproofMap.get(c.id) ?? null}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* 모바일 카드 — 짝수/홀수 미세 배경 차이 + 좌측 점수 컬러바 (Card 내부) */}
          <div className="space-y-2 md:hidden">
            {rows.map((c, i) => (
              <div
                key={c.id}
                className={[
                  'rounded-xl',
                  i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60',
                ].join(' ')}
              >
                <PredictionScore
                  score={c.prediction_score ?? 0}
                  complexName={c.name}
                  expectedYear={c.expected_order_year ?? new Date().getFullYear()}
                  compact
                />
              </div>
            ))}
          </div>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            baseQuery={Object.fromEntries(
              Object.entries({ tier, sido, sort }).filter(([, v]) => v)
            )}
          />
        </>
      )}
    </div>
  );
}

// ============================================================
// 데스크탑 row
// ============================================================
import Link from 'next/link';
import { PredictionScoreBadge } from '@/components/complexes/PredictionScore';

function ComplexRowDesktop({
  c,
  index,
  fundBalance,
  lastWaterproofYear,
}: {
  c: {
    id: string; name: string; address: string | null; built_year: number | null;
    households: number | null; buildings: number | null;
    phone: string | null; management_type: string | null;
    prediction_score: number | null; expected_order_year: number | null;
    last_updated: string | null;
  };
  index: number;
  fundBalance: number | null;
  lastWaterproofYear: number | null;
}) {
  const zebra = index % 2 === 0 ? 'bg-white' : 'bg-slate-50/60';
  const currentYear = new Date().getFullYear();
  const ageYears = c.built_year ? currentYear - c.built_year : null;
  const yearsUntilOrder =
    c.expected_order_year != null ? c.expected_order_year - currentYear : null;

  // ── 칩들 ────────────────────────────────────────
  const chips: { label: string; cls: string }[] = [];

  // 1. 발주 시급도
  if (yearsUntilOrder != null) {
    if (yearsUntilOrder <= 0)
      chips.push({ label: '발주 도래', cls: 'bg-red-50 text-red-700 ring-1 ring-red-200' });
    else if (yearsUntilOrder <= 2)
      chips.push({ label: `${yearsUntilOrder}년 내`, cls: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200' });
    else if (yearsUntilOrder <= 5)
      chips.push({ label: '예정', cls: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' });
  }
  // 2. 노후도
  if (ageYears != null && ageYears >= 30)
    chips.push({ label: '노후 30년+', cls: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200' });
  else if (ageYears != null && ageYears >= 20)
    chips.push({ label: '노후 20년+', cls: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200' });
  // 3. 대단지
  if (c.households != null && c.households >= 1000)
    chips.push({ label: '대단지', cls: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200' });
  // 4. 관리방식
  if (c.management_type) {
    const isWeotak = /위탁/.test(c.management_type);
    chips.push({
      label: isWeotak ? '위탁관리' : '자치관리',
      cls: isWeotak
        ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
        : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    });
  }

  // ── 추천 공종 TOP 1 ─────────────────────────────
  const predictions = predictAllCategories({
    builtYear: c.built_year,
    households: c.households,
    lastWorkByCategory: lastWaterproofYear
      ? { waterproof: lastWaterproofYear }
      : undefined,
  });
  const topRec = predictions[0]; // 시급도 가장 높은 1개
  const topRecMeta = topRec ? WORK_CATEGORIES[topRec.code] : null;

  // ── 데이터 신선도 ───────────────────────────────
  const freshness = (() => {
    if (!c.last_updated) return null;
    const days = Math.floor(
      (Date.now() - new Date(c.last_updated).getTime()) / 86_400_000,
    );
    if (days <= 1) return { label: '오늘', cls: 'text-emerald-600' };
    if (days <= 7) return { label: `${days}일 전`, cls: 'text-on-surface-var' };
    if (days <= 30) return { label: `${days}일 전`, cls: 'text-amber-600' };
    return { label: `${days}일 전`, cls: 'text-red-500' };
  })();

  // ── 충당금 표시 헬퍼 ─────────────────────────────
  const fundDisplay = (() => {
    if (fundBalance == null) return null;
    const eok = fundBalance / 100_000_000;
    if (eok >= 1) return { val: `${eok.toFixed(1)}억`, big: true };
    const cheonman = fundBalance / 10_000_000;
    return { val: `${cheonman.toFixed(0)}천만`, big: false };
  })();

  return (
    <tr
      className={[
        'group border-b border-dashed border-slate-200/70 transition-colors',
        zebra,
        'hover:bg-blue-50/40',
      ].join(' ')}
    >
      {/* 단지명 + 주소 + 칩들 + 관리소장 전화 */}
      <td className="relative px-4 py-3 align-top">
        <span className="pointer-events-none absolute inset-y-0 left-0 w-0.5 bg-transparent transition-colors group-hover:bg-accent" />
        <Link href={`/complexes/${c.id}`} className="block">
          <div className="font-semibold text-gray-900">{c.name}</div>
          <div className="mt-0.5 truncate max-w-md text-xs text-gray-500">
            {c.address ?? '주소 정보 없음'}
          </div>
          {chips.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              {chips.map((chip, i) => (
                <span key={i} className={['rounded-md px-1.5 py-0.5 text-[10px] font-bold', chip.cls].join(' ')}>
                  {chip.label}
                </span>
              ))}
            </div>
          )}
        </Link>
        {/* 관리소장 전화 — 클릭 시 다이얼 (Link 와 형제 관계라 propagation 제어 불필요;
            Server Component 에서 onClick 을 prop 으로 넘기면 Next.js 가 거부함) */}
        {c.phone && (
          <a
            href={`tel:${c.phone.replace(/[^0-9+]/g, '')}`}
            className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline"
          >
            📞 {c.phone}
          </a>
        )}
      </td>

      {/* 준공 */}
      <td className="px-3 py-3 text-xs tabular-nums text-gray-700 align-top">
        <div className="font-semibold">{c.built_year ?? '—'}</div>
        {ageYears != null && (
          <div className="text-[10px] text-gray-400">{ageYears}년차</div>
        )}
      </td>

      {/* 세대수 / 동수 */}
      <td className="px-3 py-3 text-xs tabular-nums text-gray-700 align-top">
        <div className="font-semibold">
          {c.households ? c.households.toLocaleString() : '—'}
        </div>
        {c.buildings && (
          <div className="text-[10px] text-gray-400">{c.buildings}개동</div>
        )}
      </td>

      {/* 충당금 */}
      <td className="px-3 py-3 text-xs tabular-nums align-top">
        {fundDisplay ? (
          <span
            className={[
              'font-bold',
              fundDisplay.big ? 'text-emerald-700' : 'text-slate-700',
            ].join(' ')}
          >
            {fundDisplay.val}
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>

      {/* 마지막 방수 공사 */}
      <td className="px-3 py-3 text-xs tabular-nums align-top">
        {lastWaterproofYear ? (
          <>
            <div className="font-semibold text-gray-700">{lastWaterproofYear}</div>
            <div className="text-[10px] text-gray-400">
              {currentYear - lastWaterproofYear}년 전
            </div>
          </>
        ) : (
          <span className="text-gray-400">이력 없음</span>
        )}
      </td>

      {/* 추천 공종 TOP 1 */}
      <td className="px-3 py-3 align-top">
        {topRec && topRecMeta ? (
          <div>
            <div className="text-xs font-bold text-on-surface">
              {topRecMeta.label}
            </div>
            <div
              className={[
                'mt-0.5 text-[10px] font-medium',
                topRec.status === 'overdue'
                  ? 'text-red-600'
                  : topRec.status === 'now'
                  ? 'text-orange-600'
                  : 'text-amber-600',
              ].join(' ')}
            >
              {topRec.statusLabel}
            </div>
          </div>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>

      {/* 예상 발주 */}
      <td className="px-3 py-3 text-xs tabular-nums align-top">
        <div className="font-semibold text-gray-700">
          {c.expected_order_year ?? '—'}
        </div>
        {freshness && (
          <div className={['mt-0.5 text-[10px]', freshness.cls].join(' ')}>
            {freshness.label} 분석
          </div>
        )}
      </td>

      {/* 예측 점수 */}
      <td className="px-3 py-3 align-top">
        <PredictionScoreBadge score={c.prediction_score ?? 0} />
      </td>
    </tr>
  );
}

function EmptyResult() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
      <div className="text-sm font-semibold text-gray-700">조건에 맞는 단지가 없습니다</div>
      <p className="mt-1 text-xs text-gray-500">
        필터를 완화하거나 공공데이터 수집 스크립트를 먼저 실행해보세요.
      </p>
    </div>
  );
}
