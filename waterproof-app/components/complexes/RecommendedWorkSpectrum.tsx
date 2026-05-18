/**
 * 추천 공종 스펙트럼 — 단지 상세 페이지의 6대 공종 한눈에 보기
 *
 * 입력:
 *   - 단지의 builtYear / households / lastWorkByCategory
 *
 * 출력:
 *   - 6대 공종(방수/도장/엘리베이터/배관/주차장/조경)을 시급도 순으로 표시
 *   - 각 공종마다: 아이콘 + 상태(즉시/임박/예정/장기) + 마지막 공사 + 예상 발주 + 추정 공사비
 */

import {
  Umbrella,
  Paintbrush,
  ArrowUpDown,
  Wrench,
  ParkingCircle,
  TreePine,
  type LucideIcon,
} from 'lucide-react';
import {
  predictAllCategories,
  type CategoryPrediction,
  type LastWorkByCategory,
} from '@/lib/work-categories';

const ICONS: Record<string, LucideIcon> = {
  Umbrella,
  Paintbrush,
  ArrowUpDown,
  Wrench,
  ParkingCircle,
  TreePine,
};

const COLOR_STYLES: Record<CategoryPrediction['color'], {
  iconBg: string; iconColor: string; statusText: string; bar: string;
}> = {
  blue:   { iconBg: 'bg-blue-50',   iconColor: 'text-blue-600',   statusText: 'text-blue-700',   bar: 'bg-blue-500' },
  orange: { iconBg: 'bg-orange-50', iconColor: 'text-orange-600', statusText: 'text-orange-700', bar: 'bg-orange-500' },
  purple: { iconBg: 'bg-purple-50', iconColor: 'text-purple-600', statusText: 'text-purple-700', bar: 'bg-purple-500' },
  cyan:   { iconBg: 'bg-cyan-50',   iconColor: 'text-cyan-600',   statusText: 'text-cyan-700',   bar: 'bg-cyan-500' },
  amber:  { iconBg: 'bg-amber-50',  iconColor: 'text-amber-600',  statusText: 'text-amber-700',  bar: 'bg-amber-500' },
  green:  { iconBg: 'bg-green-50',  iconColor: 'text-green-600',  statusText: 'text-green-700',  bar: 'bg-green-500' },
};

const STATUS_BADGES: Record<CategoryPrediction['status'], { label: string; cls: string }> = {
  overdue: { label: '즉시 검토', cls: 'bg-red-100 text-red-700 border-red-200' },
  now:     { label: '발주 임박', cls: 'bg-orange-100 text-orange-700 border-orange-200' },
  soon:    { label: '예정',     cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  future:  { label: '장기',     cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

export interface RecommendedWorkSpectrumProps {
  builtYear: number | null;
  households: number | null;
  lastWorkByCategory?: LastWorkByCategory;
}

export function RecommendedWorkSpectrum({
  builtYear,
  households,
  lastWorkByCategory,
}: RecommendedWorkSpectrumProps) {
  const predictions = predictAllCategories({
    builtYear,
    households,
    lastWorkByCategory,
  });

  return (
    <section className="space-y-3">
      <h3 className="flex items-center justify-between px-1 text-base font-bold">
        <span>추천 공종 스펙트럼</span>
        <span className="text-[10px] font-normal text-on-surface-var">
          노후도·이력 기반 자동 분석
        </span>
      </h3>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="divide-y divide-slate-100">
          {predictions.map((p) => (
            <CategoryRow key={p.code} pred={p} />
          ))}
        </div>
      </div>

      <p className="px-1 text-[11px] text-on-surface-var">
        주기 기준: LH/SH 표준 장기수선계획 + K-apt 실측 평균.
        실제 발주 시점은 단지 충당금과 입주민 의결에 따라 ±3년 변동 가능.
      </p>
    </section>
  );
}

function CategoryRow({ pred }: { pred: CategoryPrediction }) {
  const Icon = ICONS[pred.icon] ?? Umbrella;
  const color = COLOR_STYLES[pred.color];
  const badge = STATUS_BADGES[pred.status];

  return (
    <div className="flex items-center gap-4 p-4 transition-colors active:bg-slate-50">
      {/* 아이콘 */}
      <div className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${color.iconBg}`}>
        <Icon size={22} className={color.iconColor} strokeWidth={2.2} />
      </div>

      {/* 본문 */}
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-sm font-bold text-on-surface">{pred.label}</span>
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${badge.cls}`}
          >
            {badge.label}
          </span>
        </div>
        <p className={`truncate text-[11px] font-medium ${color.statusText}`}>
          {pred.statusLabel}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-on-surface-var">
          {pred.recommendation}
        </p>
      </div>

      {/* 추정 공사비 */}
      {pred.estimatedCost != null && (
        <div className="hidden shrink-0 text-right md:block">
          <div className="text-[10px] font-bold uppercase tracking-wider text-on-surface-var">
            추정 공사비
          </div>
          <div className="text-sm font-bold tabular-nums text-on-surface">
            {formatKrw(pred.estimatedCost)}
          </div>
        </div>
      )}
    </div>
  );
}

function formatKrw(amount: number): string {
  if (amount >= 100_000_000) {
    return `${(amount / 100_000_000).toFixed(1)}억`;
  }
  if (amount >= 10_000_000) {
    return `${(amount / 10_000_000).toFixed(1)}천만`;
  }
  return `${Math.round(amount / 10_000).toLocaleString()}만`;
}
