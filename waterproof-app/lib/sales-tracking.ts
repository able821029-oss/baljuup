/**
 * 영업 추적 메타데이터 (라벨/색상/순서)
 *
 * 서버 / 클라이언트 모두에서 사용 가능 (Pure module — DB 호출 없음)
 */

import type { SalesTrackingPriority, SalesTrackingStatus } from "./supabase/database.types";

// ============================================================
// 상태 메타데이터
// ============================================================
export const STATUS_META: Record<
  SalesTrackingStatus,
  { label: string; short: string; order: number; cls: string; ringCls: string; dotCls: string }
> = {
  interested: {
    label: "관심",
    short: "관심",
    order: 1,
    cls: "bg-slate-50 text-slate-700",
    ringCls: "ring-1 ring-slate-200",
    dotCls: "bg-slate-400",
  },
  contacted: {
    label: "연락중",
    short: "연락",
    order: 2,
    cls: "bg-sky-50 text-sky-700",
    ringCls: "ring-1 ring-sky-200",
    dotCls: "bg-sky-500",
  },
  meeting: {
    label: "미팅예정",
    short: "미팅",
    order: 3,
    cls: "bg-indigo-50 text-indigo-700",
    ringCls: "ring-1 ring-indigo-200",
    dotCls: "bg-indigo-500",
  },
  proposed: {
    label: "제안완료",
    short: "제안",
    order: 4,
    cls: "bg-amber-50 text-amber-800",
    ringCls: "ring-1 ring-amber-200",
    dotCls: "bg-amber-500",
  },
  won: {
    label: "수주",
    short: "수주",
    order: 5,
    cls: "bg-emerald-50 text-emerald-700",
    ringCls: "ring-1 ring-emerald-200",
    dotCls: "bg-emerald-500",
  },
  lost: {
    label: "실패",
    short: "실패",
    order: 6,
    cls: "bg-rose-50 text-rose-700",
    ringCls: "ring-1 ring-rose-200",
    dotCls: "bg-rose-500",
  },
  on_hold: {
    label: "보류",
    short: "보류",
    order: 7,
    cls: "bg-zinc-100 text-zinc-600",
    ringCls: "ring-1 ring-zinc-200",
    dotCls: "bg-zinc-400",
  },
};

export const STATUS_ORDER: SalesTrackingStatus[] = [
  "interested",
  "contacted",
  "meeting",
  "proposed",
  "won",
  "lost",
  "on_hold",
];

// 진행중 상태(파이프라인 활성) — 대시보드 카운트용
export const ACTIVE_STATUSES: SalesTrackingStatus[] = [
  "interested",
  "contacted",
  "meeting",
  "proposed",
];

// ============================================================
// 우선순위 메타데이터
// ============================================================
export const PRIORITY_META: Record<
  SalesTrackingPriority,
  { label: string; cls: string; weight: number }
> = {
  high: { label: "높음", cls: "bg-red-50 text-red-700 ring-1 ring-red-200", weight: 3 },
  normal: { label: "보통", cls: "bg-slate-50 text-slate-600 ring-1 ring-slate-200", weight: 2 },
  low: { label: "낮음", cls: "bg-zinc-50 text-zinc-500 ring-1 ring-zinc-200", weight: 1 },
};

// ============================================================
// 다음 액션 D-Day 계산
// ============================================================
export function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

export function formatDDay(days: number | null): { label: string; cls: string } | null {
  if (days == null) return null;
  if (days < 0) return { label: `D+${-days}`, cls: "text-red-600" };
  if (days === 0) return { label: "D-DAY", cls: "text-red-600 font-bold" };
  if (days <= 3) return { label: `D-${days}`, cls: "text-orange-600" };
  if (days <= 7) return { label: `D-${days}`, cls: "text-amber-600" };
  return { label: `D-${days}`, cls: "text-slate-500" };
}
