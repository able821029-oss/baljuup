/**
 * 대시보드 상단 지표 카드 4개
 *   1) 모니터링 단지 수
 *   2) 즉시 접촉 필요 (점수 80+)
 *   3) 이번 달 알림
 *   4) 수주 성공
 *
 * 디자인: 흰색 카드 + 컬러 액센트 바, 숫자는 Bebas Neue
 * 반응형: 모바일 2열, sm+ 4열
 */

import { Building2, Flame, Bell, Trophy, type LucideIcon } from 'lucide-react';

export interface StatCardItem {
  key: string;
  label: string;
  value: number | string;
  unit?: string;             // '건', '단지' 등 (숫자 뒤에 작게)
  delta?: number;            // 전주 대비 변동치 (양수=증가, 음수=감소)
  icon: LucideIcon;
  accent: string;            // hex 색상 (좌측 바 + 아이콘)
}

export interface StatCardsProps {
  stats?: StatCardItem[];
  loading?: boolean;
}

const DEFAULT_STATS: StatCardItem[] = [
  {
    key: 'monitoring',
    label: '모니터링 단지',
    value: 0,
    unit: '단지',
    icon: Building2,
    accent: '#0F4C8A',
  },
  {
    key: 'critical',
    label: '즉시 접촉 필요',
    value: 0,
    unit: '단지',
    icon: Flame,
    accent: '#DC2626',
  },
  {
    key: 'alerts',
    label: '이번 달 알림',
    value: 0,
    unit: '건',
    icon: Bell,
    accent: '#FF6B35',
  },
  {
    key: 'won',
    label: '수주 성공',
    value: 0,
    unit: '건',
    icon: Trophy,
    accent: '#16A34A',
  },
];

export function StatCards({ stats = DEFAULT_STATS, loading = false }: StatCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      {stats.map((s) => (
        <StatCard key={s.key} stat={s} loading={loading} />
      ))}
    </div>
  );
}

function StatCard({ stat, loading }: { stat: StatCardItem; loading: boolean }) {
  const Icon = stat.icon;
  const deltaColor =
    stat.delta == null ? '' : stat.delta >= 0 ? 'text-emerald-600' : 'text-rose-600';
  const deltaPrefix = stat.delta == null ? '' : stat.delta > 0 ? '+' : '';

  return (
    <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md sm:p-5">
      {/* 좌측 액센트 바 */}
      <span
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: stat.accent }}
        aria-hidden="true"
      />

      <div className="flex items-start justify-between">
        <div className="text-xs font-medium text-gray-500 sm:text-sm">{stat.label}</div>
        <Icon size={18} style={{ color: stat.accent }} />
      </div>

      <div className="mt-2 flex items-baseline gap-1">
        {loading ? (
          <span className="inline-block h-8 w-16 animate-pulse rounded bg-gray-100" />
        ) : (
          <span
            className="text-[32px] font-bold leading-none tracking-tight tabular-nums text-gray-900 sm:text-4xl"
            style={{
              fontFamily:
                "var(--font-bebas, 'Bebas Neue'), 'Pretendard Variable', sans-serif",
            }}
          >
            {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
          </span>
        )}
        {stat.unit && <span className="text-xs text-gray-500">{stat.unit}</span>}
      </div>

      {stat.delta != null && !loading && (
        <div className={`mt-1 text-xs font-medium ${deltaColor}`}>
          {deltaPrefix}
          {stat.delta} <span className="text-gray-400">지난주 대비</span>
        </div>
      )}
    </div>
  );
}
