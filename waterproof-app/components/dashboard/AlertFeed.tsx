/**
 * 대시보드 알림 피드 — 최근 발주 시그널 타임라인
 *
 * 알림 유형:
 *   - bid           입찰공고 발생 (긴급, 빨강)
 *   - score_rise    예측 점수 임계 돌파 (주황)
 *   - deadline      입찰 마감 임박 (노랑)
 *   - won           수주 성공 (초록)
 *
 * 빈 상태 처리, 로딩 스켈레톤 포함.
 */

import { AlertCircle, TrendingUp, Clock, Trophy } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type AlertType = 'bid' | 'score_rise' | 'deadline' | 'won';

export interface AlertItem {
  id: string;
  type: AlertType;
  complexName: string;
  message: string;
  timeAgo: string;        // '3시간 전', '어제', '2024-11-12'
  href?: string;          // 클릭 시 이동 URL
}

const TYPE_META: Record<AlertType, { icon: LucideIcon; color: string; bg: string; label: string }> = {
  bid:        { icon: AlertCircle, color: '#DC2626', bg: '#FEF2F2', label: '입찰공고' },
  score_rise: { icon: TrendingUp,  color: '#EA580C', bg: '#FFF7ED', label: '점수 상승' },
  deadline:   { icon: Clock,       color: '#CA8A04', bg: '#FEFCE8', label: '마감 임박' },
  won:        { icon: Trophy,      color: '#16A34A', bg: '#F0FDF4', label: '수주 성공' },
};

export interface AlertFeedProps {
  items?: AlertItem[];
  loading?: boolean;
  maxItems?: number;
}

export function AlertFeed({ items = [], loading = false, maxItems = 8 }: AlertFeedProps) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <header className="flex items-center justify-between border-b border-gray-100 px-4 py-3 sm:px-5">
        <h2 className="text-sm font-bold text-gray-900 sm:text-base">이번 주 알림</h2>
        {items.length > 0 && (
          <a
            href="/alerts"
            className="text-xs font-medium text-[#0F4C8A] hover:underline"
          >
            전체 보기 →
          </a>
        )}
      </header>

      <ul className="divide-y divide-gray-100">
        {loading && <AlertSkeleton count={3} />}

        {!loading && items.length === 0 && <EmptyAlerts />}

        {!loading &&
          items.slice(0, maxItems).map((item) => (
            <AlertRow key={item.id} item={item} />
          ))}
      </ul>
    </section>
  );
}

function AlertRow({ item }: { item: AlertItem }) {
  const meta = TYPE_META[item.type];
  const Icon = meta.icon;
  const Wrapper: any = item.href ? 'a' : 'div';

  return (
    <li>
      <Wrapper
        {...(item.href ? { href: item.href } : {})}
        className={[
          'flex items-start gap-3 px-4 py-3 sm:px-5',
          item.href ? 'transition-colors hover:bg-gray-50' : '',
        ].join(' ')}
      >
        <span
          className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: meta.bg }}
        >
          <Icon size={16} style={{ color: meta.color }} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: meta.color }}
            >
              {meta.label}
            </span>
            <span className="truncate text-sm font-semibold text-gray-900">
              {item.complexName}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-gray-600 sm:text-sm">
            {item.message}
          </p>
        </div>

        <time className="shrink-0 text-xs text-gray-400">{item.timeAgo}</time>
      </Wrapper>
    </li>
  );
}

function AlertSkeleton({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="flex items-start gap-3 px-4 py-3 sm:px-5">
          <span className="mt-0.5 size-8 shrink-0 animate-pulse rounded-lg bg-gray-100" />
          <div className="flex-1 space-y-2">
            <span className="block h-3 w-1/3 animate-pulse rounded bg-gray-100" />
            <span className="block h-3 w-2/3 animate-pulse rounded bg-gray-100" />
          </div>
        </li>
      ))}
    </>
  );
}

function EmptyAlerts() {
  return (
    <li className="px-4 py-8 text-center sm:px-5 sm:py-12">
      <div className="text-sm text-gray-500">아직 알림이 없습니다</div>
      <p className="mt-1 text-xs text-gray-400">
        공공데이터 수집이 완료되면 발주 신호가 여기에 표시됩니다.
      </p>
    </li>
  );
}
