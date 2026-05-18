import Link from "next/link";

export type AlertCategory = "bid" | "ai" | "proposal" | "system";

const META: Record<AlertCategory, { label: string; barColor: string; badgeBg: string; badgeText: string; ringColor: string }> = {
  bid: {
    label: "NEW BID",
    barColor: "bg-accent",
    badgeBg: "bg-accent",
    badgeText: "text-white",
    ringColor: "ring-blue-100",
  },
  ai: {
    label: "AI RECOMMEND",
    barColor: "bg-cyan-600",
    badgeBg: "bg-cyan-600",
    badgeText: "text-white",
    ringColor: "ring-cyan-100",
  },
  proposal: {
    label: "PROPOSAL",
    barColor: "bg-slate-400",
    badgeBg: "bg-slate-200",
    badgeText: "text-slate-700",
    ringColor: "ring-slate-100",
  },
  system: {
    label: "SYSTEM",
    barColor: "bg-slate-300",
    badgeBg: "bg-slate-100",
    badgeText: "text-slate-600",
    ringColor: "ring-slate-100",
  },
};

export interface AlertCardProps {
  category: AlertCategory;
  title: string;
  message: string;
  timeAgo: string;
  href?: string;
  /** true 면 강조 (좌측 컬러바 + 두꺼운 글씨) */
  unread?: boolean;
}

export function AlertCard({ category, title, message, timeAgo, href, unread = true }: AlertCardProps) {
  const meta = META[category];
  const Wrapper: React.ElementType = href ? Link : "div";
  const wrapperProps = href ? { href } : {};

  if (!unread) {
    // 읽은 알림 — 옅은 배경, 좌측 바 없음
    return (
      <Wrapper
        {...wrapperProps}
        className="group relative block cursor-pointer overflow-hidden rounded-xl border border-slate-200/60 bg-slate-50/50 transition-all"
      >
        <div className="flex items-start gap-3 p-4">
          <div className="size-2.5 shrink-0" />
          <div className="flex-1">
            <div className="mb-1.5 flex items-center justify-between">
              <span
                className={`rounded px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${meta.badgeBg} ${meta.badgeText}`}
              >
                {meta.label}
              </span>
              <span className="text-xs font-semibold text-on-surface/80">{timeAgo}</span>
            </div>
            <h3 className="mb-2 text-base font-bold leading-snug text-on-surface/80">{title}</h3>
            <p className="line-clamp-2 text-sm font-medium leading-relaxed text-on-surface-var/80">
              {message}
            </p>
          </div>
        </div>
      </Wrapper>
    );
  }

  // 안 읽은 알림 — 좌측 컬러바 + 둥근 점
  return (
    <Wrapper
      {...wrapperProps}
      className="group relative block cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all active:bg-slate-50 hover:border-accent"
    >
      <div className={`absolute bottom-0 left-0 top-0 w-1 ${meta.barColor}`} />
      <div className="flex items-start gap-3 p-4">
        <div className="shrink-0 pt-1">
          <div className={`size-3.5 rounded-full ring-4 ${meta.barColor} ${meta.ringColor}`} />
        </div>
        <div className="flex-1">
          <div className="mb-1.5 flex items-center justify-between">
            <span className={`rounded px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${meta.badgeBg} ${meta.badgeText}`}>
              {meta.label}
            </span>
            <span className="text-xs font-semibold text-on-surface">{timeAgo}</span>
          </div>
          <h3 className="mb-2 text-base font-extrabold leading-snug text-on-surface">{title}</h3>
          <p className="line-clamp-2 text-sm font-medium leading-relaxed text-on-surface-var">
            {message}
          </p>
        </div>
      </div>
    </Wrapper>
  );
}
