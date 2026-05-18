"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";

const TABS = [
  { value: "",      label: "전체" },
  { value: "draft", label: "검토중" },
  { value: "sent",  label: "발송완료" },
  { value: "won",   label: "낙찰" },
];

export function ProposalStatusFilter({ currentStatus }: { currentStatus: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set("status", value);
    else next.delete("status");
    startTransition(() => {
      router.push(`/proposals${next.toString() ? "?" + next.toString() : ""}`);
    });
  }

  return (
    <div className="scrollbar-hide flex flex-nowrap items-center gap-2 overflow-x-auto pb-1">
      {TABS.map((t) => {
        const on = currentStatus === t.value;
        return (
          <button
            key={t.value || "all"}
            type="button"
            onClick={() => update(t.value)}
            className={[
              "whitespace-nowrap rounded-xl px-5 py-2.5 text-sm font-bold transition-colors",
              on
                ? "bg-accent text-white shadow-sm"
                : "border border-slate-200 bg-white text-on-surface hover:bg-slate-50",
            ].join(" ")}
          >
            {t.label}
          </button>
        );
      })}
      {pending && <Loader2 size={14} className="ml-1 shrink-0 animate-spin text-slate-400" />}
    </div>
  );
}
