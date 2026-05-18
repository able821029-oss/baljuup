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

  // 기본 쿼리
  let query = supabase
    .from('complexes')
    .select('id, name, address, sido, built_year, households, phone, prediction_score, expected_order_year', { count: 'exact' });

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
    phone: string | null;
    prediction_score: number | null;
    expected_order_year: number | null;
  };
  const rows = ((data ?? []) as unknown) as ComplexRow[];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
          {/* 데스크탑 테이블 — 미세한 zebra + 점선 구분 + hover 강조 */}
          <div className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white md:block">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-4 py-3">단지</th>
                  <th className="px-4 py-3 w-20">준공</th>
                  <th className="px-4 py-3 w-20">세대수</th>
                  <th className="px-4 py-3 w-28">예상 발주</th>
                  <th className="px-4 py-3 w-28">예측 점수</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c, i) => (
                  <ComplexRowDesktop key={c.id} c={c} index={i} />
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
}: {
  c: {
    id: string; name: string; address: string | null; built_year: number | null;
    households: number | null; prediction_score: number | null; expected_order_year: number | null;
  };
  index: number;
}) {
  // 미세 zebra (짝수행 살짝 어두움) + 점선 하단 보더 + hover 시 좌측 파란 라인
  const zebra = index % 2 === 0 ? 'bg-white' : 'bg-slate-50/60';
  const currentYear = new Date().getFullYear();
  const ageYears = c.built_year ? currentYear - c.built_year : null;
  const yearsUntilOrder =
    c.expected_order_year != null ? c.expected_order_year - currentYear : null;

  // 영업 우선순위 라벨 (왼쪽 여백 채움용)
  const urgencyChip = (() => {
    if (yearsUntilOrder == null) return null;
    if (yearsUntilOrder <= 0)
      return { label: '발주 도래', cls: 'bg-red-50 text-red-700 ring-1 ring-red-200' };
    if (yearsUntilOrder <= 2)
      return { label: `${yearsUntilOrder}년 내`, cls: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200' };
    if (yearsUntilOrder <= 5)
      return { label: '예정', cls: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' };
    return null;
  })();

  // 노후도 칩
  const ageChip =
    ageYears != null && ageYears >= 30
      ? { label: '노후 30년+', cls: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200' }
      : ageYears != null && ageYears >= 20
      ? { label: '노후 20년+', cls: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200' }
      : null;

  // 대단지 칩
  const sizeChip =
    c.households != null && c.households >= 1000
      ? { label: '대단지', cls: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200' }
      : null;

  const chips = [urgencyChip, ageChip, sizeChip].filter(Boolean) as { label: string; cls: string }[];

  return (
    <tr
      className={[
        'group border-b border-dashed border-slate-200/70 transition-colors',
        zebra,
        'hover:bg-blue-50/40',
      ].join(' ')}
    >
      <td className="relative px-4 py-3">
        {/* hover 시 좌측에 얇은 파란 라인 */}
        <span className="pointer-events-none absolute inset-y-0 left-0 w-0.5 bg-transparent transition-colors group-hover:bg-accent" />
        <Link href={`/complexes/${c.id}`} className="block">
          <div className="font-semibold text-gray-900">{c.name}</div>
          <div className="mt-0.5 truncate max-w-md text-xs text-gray-500">
            {c.address ?? '주소 정보 없음'}
          </div>
          {chips.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              {chips.map((chip, i) => (
                <span
                  key={i}
                  className={[
                    'rounded-md px-1.5 py-0.5 text-[10px] font-bold',
                    chip.cls,
                  ].join(' ')}
                >
                  {chip.label}
                </span>
              ))}
            </div>
          )}
        </Link>
      </td>
      <td className="px-4 py-3 text-xs tabular-nums text-gray-700">
        {c.built_year ?? '—'}
        {ageYears != null && (
          <span className="ml-1 text-[10px] text-gray-400">({ageYears}년)</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs tabular-nums text-gray-700">
        {c.households ? c.households.toLocaleString() : '—'}
      </td>
      <td className="px-4 py-3 text-xs tabular-nums text-gray-700">
        {c.expected_order_year ?? '—'}
      </td>
      <td className="px-4 py-3">
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
