/**
 * 영업 상태 / 우선순위 표시 + 변경 컴포넌트
 *
 * - StatusBadge: 표시 전용 (Server / Client 모두)
 * - StatusSelect / PrioritySelect: native <select> 기반 변경 (Client)
 */

"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import type {
  SalesTrackingPriority,
  SalesTrackingStatus,
} from "@/lib/supabase/database.types";
import {
  PRIORITY_META,
  STATUS_META,
  STATUS_ORDER,
} from "@/lib/sales-tracking";
import {
  updateTrackingPriority,
  updateTrackingStatus,
} from "@/app/(dashboard)/tracking/actions";

// ============================================================
// 표시 전용 뱃지
// ============================================================
export function StatusBadge({ status, size = "md" }: { status: SalesTrackingStatus; size?: "sm" | "md" }) {
  const meta = STATUS_META[status];
  const sizeCls = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs";
  return (
    <span className={["inline-flex items-center gap-1 rounded-md font-bold", sizeCls, meta.cls, meta.ringCls].join(" ")}>
      <span className={["inline-block size-1.5 rounded-full", meta.dotCls].join(" ")} aria-hidden />
      {meta.label}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: SalesTrackingPriority }) {
  const meta = PRIORITY_META[priority];
  return (
    <span className={["inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-bold", meta.cls].join(" ")}>
      {meta.label}
    </span>
  );
}

// ============================================================
// 상태 변경 셀렉트
// ============================================================
export function StatusSelect({
  trackingId,
  initial,
  className,
}: {
  trackingId: string;
  initial: SalesTrackingStatus;
  className?: string;
}) {
  const [value, setValue] = useState<SalesTrackingStatus>(initial);
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as SalesTrackingStatus;
    const prev = value;
    setValue(next);
    startTransition(async () => {
      const res = await updateTrackingStatus(trackingId, next);
      if (!res.ok) {
        setValue(prev);
        return;
      }
      setSavedAt(Date.now());
    });
  }

  const meta = STATUS_META[value];

  return (
    <span className={["inline-flex items-center gap-1.5", className ?? ""].join(" ")}>
      <span className="relative inline-flex">
        <select
          value={value}
          onChange={handleChange}
          disabled={pending}
          aria-label="영업 상태 변경"
          className={[
            "appearance-none rounded-md px-2 py-1 pr-6 text-xs font-bold transition-all focus:outline-none focus:ring-2 focus:ring-accent/40",
            meta.cls,
            meta.ringCls,
            pending && "opacity-60",
          ].join(" ")}
        >
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>{STATUS_META[s].label}</option>
          ))}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-1 flex items-center text-current opacity-70">
          ▾
        </span>
      </span>
      {pending && <Loader2 size={12} className="animate-spin text-slate-400" />}
      {!pending && savedAt && Date.now() - savedAt < 1500 && (
        <Check size={12} className="text-emerald-500" aria-label="저장됨" />
      )}
    </span>
  );
}

// ============================================================
// 우선순위 변경 셀렉트
// ============================================================
export function PrioritySelect({
  trackingId,
  initial,
}: {
  trackingId: string;
  initial: SalesTrackingPriority;
}) {
  const [value, setValue] = useState<SalesTrackingPriority>(initial);
  const [pending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as SalesTrackingPriority;
    const prev = value;
    setValue(next);
    startTransition(async () => {
      const res = await updateTrackingPriority(trackingId, next);
      if (!res.ok) setValue(prev);
    });
  }

  const meta = PRIORITY_META[value];

  return (
    <span className="relative inline-flex">
      <select
        value={value}
        onChange={handleChange}
        disabled={pending}
        aria-label="우선순위 변경"
        className={[
          "appearance-none rounded-md px-2 py-0.5 pr-5 text-[11px] font-bold transition-all focus:outline-none focus:ring-2 focus:ring-accent/40",
          meta.cls,
          pending && "opacity-60",
        ].join(" ")}
      >
        {(["high", "normal", "low"] as const).map((p) => (
          <option key={p} value={p}>{PRIORITY_META[p].label}</option>
        ))}
      </select>
      <span className="pointer-events-none absolute inset-y-0 right-0.5 flex items-center text-[10px] opacity-70">
        ▾
      </span>
    </span>
  );
}
