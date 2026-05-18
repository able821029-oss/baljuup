import Link from "next/link";
import { MapPin } from "lucide-react";

// 상태별 메타데이터 — 배지 색 + 좌측 보더 색
const STATUS_META: Record<string, { label: string; barColor: string; badgeBg: string; badgeText: string }> = {
  draft: { label: "검토중",     barColor: "bg-amber-500",  badgeBg: "bg-amber-600",  badgeText: "text-white" },
  sent:  { label: "발송완료",   barColor: "bg-accent",     badgeBg: "bg-accent",     badgeText: "text-white" },
  won:   { label: "낙찰 완료",  barColor: "bg-emerald-500", badgeBg: "bg-emerald-600", badgeText: "text-white" },
  lost:  { label: "낙찰 실패",  barColor: "bg-slate-400",  badgeBg: "bg-slate-500",  badgeText: "text-white" },
};

export interface ProposalCardProps {
  id: string;
  title: string;
  /** 단지명 (지역명 포함 가능) */
  complexName: string;
  /** 단지 주소 (있으면 표시) */
  address?: string | null;
  status: string;
  createdAt: string;
  wonAt: string | null;
  /** 제안 금액 (원 단위) — content.input.workScope.estimatedBudget */
  amount?: number | null;
}

export function ProposalCard({
  id,
  title,
  complexName,
  address,
  status,
  createdAt,
  amount,
}: ProposalCardProps) {
  const meta = STATUS_META[status] ?? STATUS_META.draft;
  const location = address ?? complexName;

  return (
    <Link
      href={`/proposals/${id}`}
      className="group relative flex flex-col gap-4 overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all active:bg-slate-50"
    >
      {/* 좌측 컬러 보더 (상태 표시) */}
      <span className={`absolute bottom-0 left-0 top-0 w-1.5 ${meta.barColor}`} />

      {/* 상단: 제목 + 위치  /  배지 */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h3 className="mb-1.5 line-clamp-2 text-lg font-bold leading-snug text-on-surface transition-colors group-active:text-accent">
            {title}
          </h3>
          <div className="flex items-center gap-1 text-sm text-on-surface-var">
            <MapPin size={14} className="shrink-0 text-slate-400" />
            <span className="truncate">{location}</span>
          </div>
        </div>
        <span className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold ${meta.badgeBg} ${meta.badgeText}`}>
          {meta.label}
        </span>
      </div>

      {/* 하단: 제안 금액  /  발송일 */}
      <div className="flex items-end justify-between border-t border-slate-200 pt-4">
        <div>
          <p className="mb-1 text-[11px] font-extrabold uppercase tracking-tight text-on-surface-var">
            제안 금액
          </p>
          <p className="text-xl font-extrabold text-accent">
            {amount != null && amount > 0 ? formatKRW(amount) : "—"}
          </p>
        </div>
        <div className="text-right">
          <p className="mb-1 text-[11px] font-extrabold uppercase tracking-tight text-on-surface-var">
            발송일
          </p>
          <p className="text-sm font-medium text-on-surface">{formatDate(createdAt)}</p>
        </div>
      </div>
    </Link>
  );
}

function formatKRW(won: number): string {
  return "₩ " + won.toLocaleString("ko-KR");
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}
