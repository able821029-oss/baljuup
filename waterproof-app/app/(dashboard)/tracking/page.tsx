/**
 * /tracking — 관심단지 영업 추적 (Server Component)
 *
 * 단지 목록 페이지의 다중 선택(localStorage, CSV 다운로드용)과 별개로
 * 사용자별 영업 파이프라인을 영구 저장/관리하는 페이지.
 *
 * URL 쿼리:
 *   ?status=interested|contacted|meeting|proposed|won|lost|on_hold|all  (기본 active)
 *   ?priority=high|normal|low|all
 *   ?sort=next|priority|recent|score                                    (기본 next)
 *
 * 데이터:
 *   sales_tracking_with_complex 뷰 사용 (단지 정보 JOIN 미리 끝)
 */

import Link from "next/link";
import { Building2, Clock, MapPin, Phone, Sparkles, Target } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type {
  SalesTrackingPriority,
  SalesTrackingStatus,
  SalesTrackingWithComplexView,
} from "@/lib/supabase/database.types";
import {
  ACTIVE_STATUSES,
  PRIORITY_META,
  STATUS_META,
  STATUS_ORDER,
  daysUntil,
  formatDDay,
} from "@/lib/sales-tracking";
import {
  PriorityBadge,
  PrioritySelect,
  StatusBadge,
  StatusSelect,
} from "@/components/tracking/StatusBadge";
import {
  ContractAmountInput,
  DeleteTrackingButton,
  LastContactInput,
  LogContactNowButton,
  MemoEditor,
  NextActionInput,
} from "@/components/tracking/TrackingDetails";
import { PredictionScoreBadge } from "@/components/complexes/PredictionScore";

export const dynamic = "force-dynamic";

type SearchParams = {
  status?: string;
  priority?: string;
  sort?: string;
};

const STATUS_FILTERS: Array<{ key: string; label: string }> = [
  { key: "active", label: "진행중" },
  { key: "all", label: "전체" },
  ...STATUS_ORDER.map((s) => ({ key: s, label: STATUS_META[s].label })),
];

export default async function TrackingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams> | SearchParams;
}) {
  const sp = await Promise.resolve(searchParams);
  const statusFilter = sp.status ?? "active";
  const priorityFilter = sp.priority ?? "all";
  const sort = sp.sort ?? "next";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
        로그인이 필요합니다.
      </div>
    );
  }

  // ── 데이터 조회 ──────────────────────────────────────────
  let query = supabase
    .from("sales_tracking_with_complex")
    .select("*")
    .eq("user_id", user.id);

  if (statusFilter === "active") {
    query = query.in("status", ACTIVE_STATUSES);
  } else if (statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }
  if (priorityFilter !== "all" && (["high", "normal", "low"] as const).includes(priorityFilter as SalesTrackingPriority)) {
    query = query.eq("priority", priorityFilter);
  }

  // 정렬
  if (sort === "next") {
    query = query.order("next_action_at", { ascending: true, nullsFirst: false });
  } else if (sort === "recent") {
    query = query.order("updated_at", { ascending: false });
  } else if (sort === "score") {
    query = query.order("prediction_score", { ascending: false });
  }
  // priority 정렬은 JS 레벨에서 weight 으로 처리 (TEXT enum 정렬 불안정 방지)

  const { data, error } = await query;
  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
        영업 추적 목록을 불러오지 못했습니다: {error.message}
      </div>
    );
  }

  let rows = ((data ?? []) as unknown) as SalesTrackingWithComplexView[];

  if (sort === "priority") {
    rows = [...rows].sort(
      (a, b) => PRIORITY_META[b.priority].weight - PRIORITY_META[a.priority].weight,
    );
  }

  // ── 전체 통계 (필터와 무관, 사용자 전체) ───────────────────
  const { data: allData } = await supabase
    .from("sales_tracking")
    .select("status, contract_amount")
    .eq("user_id", user.id);

  const all = ((allData ?? []) as unknown) as Array<{
    status: SalesTrackingStatus;
    contract_amount: number | null;
  }>;
  const statusCounts: Record<SalesTrackingStatus, number> = {
    interested: 0, contacted: 0, meeting: 0, proposed: 0, won: 0, lost: 0, on_hold: 0,
  };
  let wonAmount = 0;
  for (const r of all) {
    statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
    if (r.status === "won" && r.contract_amount) wonAmount += r.contract_amount;
  }
  const activeTotal = ACTIVE_STATUSES.reduce((s, k) => s + (statusCounts[k] ?? 0), 0);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {/* ── 헤더 ───────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900 sm:text-2xl">
            <Target size={22} className="text-accent" />
            관심단지 영업 추적
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            관심 등록한 단지의 영업 단계, 우선순위, 다음 액션을 한 곳에서 관리하세요.
          </p>
        </div>
      </div>

      {/* ── KPI 카드 ──────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="진행중" value={activeTotal} accent="text-accent" hint="관심·연락·미팅·제안" />
        <KpiCard label="수주" value={statusCounts.won} accent="text-emerald-600"
          hint={wonAmount > 0 ? `${(wonAmount / 100_000_000).toFixed(1)}억원 누적` : undefined} />
        <KpiCard label="실패" value={statusCounts.lost} accent="text-rose-600" />
        <KpiCard label="보류" value={statusCounts.on_hold} accent="text-zinc-500" />
      </div>

      {/* ── 필터 / 정렬 ───────────────────────────────── */}
      <TrackingFilters statusFilter={statusFilter} priorityFilter={priorityFilter} sort={sort} />

      {/* ── 목록 ─────────────────────────────────────── */}
      {rows.length === 0 ? (
        <EmptyTracking />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <TrackingCard key={r.id} row={r} />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// KPI 카드
// ============================================================
function KpiCard({
  label,
  value,
  accent,
  hint,
}: {
  label: string;
  value: number;
  accent: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-[11px] font-bold uppercase tracking-wider text-on-surface-var">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-extrabold tabular-nums ${accent}`}>
        {value.toLocaleString()}
      </div>
      {hint && <div className="mt-0.5 text-[11px] text-on-surface-var">{hint}</div>}
    </div>
  );
}

// ============================================================
// 필터 / 정렬 — 링크 기반 (URL 쿼리)
// ============================================================
function TrackingFilters({
  statusFilter,
  priorityFilter,
  sort,
}: {
  statusFilter: string;
  priorityFilter: string;
  sort: string;
}) {
  function buildHref(patch: Record<string, string>): string {
    const params = new URLSearchParams();
    if (statusFilter && statusFilter !== "active") params.set("status", statusFilter);
    if (priorityFilter && priorityFilter !== "all") params.set("priority", priorityFilter);
    if (sort && sort !== "next") params.set("sort", sort);
    for (const [k, v] of Object.entries(patch)) {
      // 기본값이면 제거
      if ((k === "status" && v === "active") || (k === "priority" && v === "all") || (k === "sort" && v === "next")) {
        params.delete(k);
      } else {
        params.set(k, v);
      }
    }
    const qs = params.toString();
    return qs ? `/tracking?${qs}` : "/tracking";
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
      <div>
        <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-on-surface-var">상태</div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((f) => {
            const active = statusFilter === f.key;
            return (
              <Link
                key={f.key}
                href={buildHref({ status: f.key })}
                className={[
                  "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                  active
                    ? "bg-accent text-white"
                    : "bg-slate-50 text-on-surface-var hover:bg-slate-100",
                ].join(" ")}
              >
                {f.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-var">우선순위</span>
          {(["all", "high", "normal", "low"] as const).map((p) => {
            const active = priorityFilter === p;
            const label = p === "all" ? "전체" : PRIORITY_META[p].label;
            return (
              <Link
                key={p}
                href={buildHref({ priority: p })}
                className={[
                  "rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors",
                  active ? "bg-slate-900 text-white" : "bg-slate-50 text-on-surface-var hover:bg-slate-100",
                ].join(" ")}
              >
                {label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-var">정렬</span>
          {([
            { k: "next", label: "다음 액션" },
            { k: "priority", label: "우선순위" },
            { k: "recent", label: "최근 업데이트" },
            { k: "score", label: "예측 점수" },
          ] as const).map((o) => {
            const active = sort === o.k;
            return (
              <Link
                key={o.k}
                href={buildHref({ sort: o.k })}
                className={[
                  "rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors",
                  active ? "bg-slate-900 text-white" : "bg-slate-50 text-on-surface-var hover:bg-slate-100",
                ].join(" ")}
              >
                {o.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 추적 카드 — 단지 + 상태/메모/일정 인라인 편집
// ============================================================
function TrackingCard({ row }: { row: SalesTrackingWithComplexView }) {
  const nextDays = daysUntil(row.next_action_at);
  const dday = formatDDay(nextDays);
  const isClosed = row.status === "won" || row.status === "lost";

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* 상단: 단지 정보 + 상태 칩들 */}
      <header className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/40 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Building2 size={16} className="shrink-0 text-slate-400" />
            <Link
              href={`/complexes/${row.complex_id}`}
              className="truncate text-base font-bold text-on-surface hover:text-accent"
            >
              {row.complex_name}
            </Link>
            <PredictionScoreBadge score={row.prediction_score ?? 0} />
          </div>
          {row.complex_address && (
            <p className="mt-1 flex items-center gap-1 truncate text-xs text-on-surface-var">
              <MapPin size={12} className="text-slate-400" />
              {row.complex_address}
            </p>
          )}
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-on-surface-var">
            {row.complex_built_year && <span>준공 {row.complex_built_year}</span>}
            {row.complex_households != null && <span>{row.complex_households.toLocaleString()}세대</span>}
            {row.complex_management_type && <span>{row.complex_management_type}</span>}
            {row.expected_order_year && <span>예상 발주 {row.expected_order_year}</span>}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {row.complex_phone && (
            <a
              href={`tel:${row.complex_phone.replace(/[^0-9+]/g, "")}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1.5 text-[11px] font-bold text-white shadow-sm shadow-accent/20 transition-all hover:bg-accent/90 active:scale-[0.98]"
              aria-label={`관리사무소 ${row.complex_phone} 전화`}
            >
              <Phone size={12} />
              <span className="tabular-nums">{row.complex_phone}</span>
            </a>
          )}
          <StatusSelect trackingId={row.id} initial={row.status} />
          <PrioritySelect trackingId={row.id} initial={row.priority} />
        </div>
      </header>

      {/* 본문 — 메모 + 일정 + 액션 */}
      <div className="grid gap-4 p-4 sm:grid-cols-[1fr,auto]">
        <div className="space-y-3">
          <MemoEditor trackingId={row.id} initial={row.memo} rows={2} />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:w-72 sm:grid-cols-1">
          <NextActionInput trackingId={row.id} initial={row.next_action_at} />
          <LastContactInput trackingId={row.id} initial={row.last_contact_at} />
        </div>
      </div>

      {/* 수주 모드: 계약 금액 입력 */}
      {row.status === "won" && (
        <div className="border-t border-slate-100 bg-emerald-50/50 p-4">
          <ContractAmountInput trackingId={row.id} initial={row.contract_amount} />
        </div>
      )}

      {/* 푸터 — D-Day, 액션 버튼들 */}
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-white px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-on-surface-var">
          <StatusBadge status={row.status} size="sm" />
          <PriorityBadge priority={row.priority} />
          {dday && !isClosed && (
            <span className={["inline-flex items-center gap-1 font-bold tabular-nums", dday.cls].join(" ")}>
              <Clock size={11} /> {dday.label}
            </span>
          )}
          <span className="text-slate-400">
            업데이트 {new Date(row.updated_at).toLocaleDateString("ko-KR")}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <LogContactNowButton trackingId={row.id} />
          <Link
            href={`/proposals/new?complexId=${row.complex_id}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-accent/30 bg-white px-3 py-1.5 text-xs font-bold text-accent transition-colors hover:bg-accent/5"
          >
            <Sparkles size={12} />
            제안서 생성
          </Link>
          <DeleteTrackingButton trackingId={row.id} />
        </div>
      </footer>
    </article>
  );
}

// ============================================================
// 빈 상태
// ============================================================
function EmptyTracking() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
      <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-amber-50">
        <Target size={26} className="text-amber-500" />
      </div>
      <h3 className="text-base font-bold text-on-surface">아직 추적 중인 단지가 없습니다</h3>
      <p className="mt-1.5 text-xs leading-relaxed text-on-surface-var">
        <Link href="/complexes" className="font-semibold text-accent hover:underline">단지 목록</Link>{" "}
        또는 단지 상세 페이지에서 별표 ★ 를 눌러 영업 추적에 추가하세요.
      </p>
    </div>
  );
}
