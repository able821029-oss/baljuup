"use client";

/**
 * 관심단지 별표 토글 버튼
 *
 * - 단지 목록 행 / 단지 상세 페이지에서 사용
 * - 초기 `tracked` 상태를 서버에서 받아 렌더 (Server Component → Client Boundary)
 * - 클릭 시 toggleTracking server action 호출 → optimistic update
 * - 클릭은 행 클릭 이벤트(상세 페이지 이동)와 충돌하지 않게 stopPropagation
 *
 * 사용:
 *   <TrackingStar complexId={c.id} initialTracked={trackedIds.has(c.id)} />
 *   <TrackingStar complexId={c.id} initialTracked={true} variant="detail" />
 */

import { useState, useTransition } from "react";
import { Star, Loader2 } from "lucide-react";
import { toggleTracking } from "@/app/(dashboard)/tracking/actions";

interface TrackingStarProps {
  complexId: string;
  initialTracked: boolean;
  /**
   * 'row' (기본) — 단지 목록 행 안에 들어가는 작은 아이콘 버튼
   * 'detail'    — 단지 상세 페이지의 큰 토글 칩 (라벨 포함)
   */
  variant?: "row" | "detail";
}

export function TrackingStar({ complexId, initialTracked, variant = "row" }: TrackingStarProps) {
  const [tracked, setTracked] = useState(initialTracked);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;

    // optimistic
    const prev = tracked;
    setTracked(!prev);
    setErr(null);

    startTransition(async () => {
      const result = await toggleTracking(complexId);
      if (!result.ok) {
        setTracked(prev);
        setErr(result.error);
      } else {
        setTracked(result.data?.tracked ?? !prev);
      }
    });
  }

  if (variant === "detail") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        aria-pressed={tracked}
        aria-label={tracked ? "관심단지에서 제거" : "관심단지로 추가"}
        title={err ?? (tracked ? "관심단지에서 제거" : "관심단지로 추가")}
        className={[
          "inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all active:scale-[0.98]",
          tracked
            ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
          pending && "opacity-60",
        ].join(" ")}
      >
        {pending ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Star size={16} fill={tracked ? "currentColor" : "none"} />
        )}
        <span>{tracked ? "관심단지 추적 중" : "관심단지로 추가"}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-pressed={tracked}
      aria-label={tracked ? "관심단지에서 제거" : "관심단지로 추가"}
      title={err ?? (tracked ? "관심단지 추적 중" : "관심단지로 추가")}
      className={[
        "inline-flex size-7 items-center justify-center rounded-md transition-colors",
        tracked
          ? "text-amber-500 hover:bg-amber-50"
          : "text-slate-300 hover:bg-slate-100 hover:text-slate-500",
        pending && "opacity-60",
      ].join(" ")}
    >
      {pending ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <Star size={16} fill={tracked ? "currentColor" : "none"} strokeWidth={tracked ? 2 : 1.75} />
      )}
    </button>
  );
}
