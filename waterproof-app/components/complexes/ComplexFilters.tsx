/**
 * 단지 목록 필터 + 정렬 (Client Component)
 *
 * URL 쿼리스트링과 동기화 — Server Component 에서 searchParams 로 읽어 SQL 에 반영.
 * 변경 시 router.push 로 새 URL 로 이동 (Next.js 가 RSC 데이터 재요청).
 */

'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { Filter, ArrowUpDown, Loader2 } from 'lucide-react';

const TIERS = [
  { value: '',         label: '전체 점수',  color: '#6B7280' },
  { value: 'critical', label: '80+ 즉시',   color: '#DC2626' },
  { value: 'high',     label: '60+ 6개월',  color: '#EA580C' },
  { value: 'medium',   label: '40+ 1년',    color: '#CA8A04' },
];

const SIDOS = [
  { value: '',     label: '전 지역' },
  { value: '서울', label: '서울' },
  { value: '경기', label: '경기' },
  { value: '인천', label: '인천' },
];

const SORTS = [
  { value: 'score', label: '점수 높은 순' },
  { value: 'year',  label: '준공 오래된 순' },
  { value: 'name',  label: '단지명 순' },
];

export interface ComplexFiltersProps {
  total: number;
}

export function ComplexFilters({ total }: ComplexFiltersProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const currentTier = params.get('tier') ?? '';
  const currentSido = params.get('sido') ?? '';
  const currentSort = params.get('sort') ?? 'score';

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page'); // 필터 변경 시 1페이지로
    startTransition(() => {
      router.push(`/complexes?${next.toString()}`);
    });
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        {/* 점수 tier */}
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-400" />
          <div className="flex flex-wrap gap-1.5">
            {TIERS.map((t) => {
              const on = currentTier === t.value;
              return (
                <button
                  key={t.value || 'all'}
                  type="button"
                  onClick={() => update('tier', t.value)}
                  className={[
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    on
                      ? 'border-transparent text-white'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400',
                  ].join(' ')}
                  style={on ? { backgroundColor: t.color } : undefined}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 지역 */}
        <select
          value={currentSido}
          onChange={(e) => update('sido', e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs focus:border-[#0F4C8A] focus:outline-none"
        >
          {SIDOS.map((s) => (
            <option key={s.value || 'all'} value={s.value}>{s.label}</option>
          ))}
        </select>

        {/* 정렬 */}
        <div className="flex items-center gap-1.5">
          <ArrowUpDown size={14} className="text-gray-400" />
          <select
            value={currentSort}
            onChange={(e) => update('sort', e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs focus:border-[#0F4C8A] focus:outline-none"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* 결과 카운트 */}
        <div className="ml-auto flex items-center gap-2 text-xs text-gray-500">
          {pending && <Loader2 size={12} className="animate-spin" />}
          총 <span className="font-semibold text-gray-900 tabular-nums">{total.toLocaleString()}</span> 단지
        </div>
      </div>
    </div>
  );
}
