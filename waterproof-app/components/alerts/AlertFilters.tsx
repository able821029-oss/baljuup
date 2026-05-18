"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";

const TABS = [
  { value: "",        label: "전체" },
  { value: "bid",     label: "비즈니스 기회" },
  { value: "won",     label: "제안서 관리" },
  { value: "system",  label: "시스템" },
];

export function AlertFilters({ currentType }: { currentType: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set("type", value);
    else next.delete("type");
    startTransition(() => {
      router.push(`/alerts${next.toString() ? "?" + next.toString() : ""}`);
    });
  }

  return (
    <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-2">
      {TABS.map((t) => {
        const on = currentType === t.value;
        return (
          <button
            key={t.value || "all"}
            type="button"
            onClick={() => update(t.value)}
            className={[
              "flex-shrink-0 whitespace-nowrap rounded-full px-5 py-1.5 text-sm transition-colors",
              on
                ? "bg-slate-900 font-bold text-white shadow-md"
                : "border border-slate-200/50 bg-slate-100 font-medium text-on-surface-var hover:bg-slate-200",
            ].join(" ")}
          >
            {t.label}
          </button>
        );
      })}
      {pending && <Loader2 size={14} className="my-auto shrink-0 animate-spin text-slate-400" />}
    </div>
  );
}
