"use client";

/**
 * 구독 취소 폼 — 인라인 클라이언트 컴포넌트
 *
 * - 취소 사유(라디오) + 자유 입력
 * - 옵션 1: 다음 결제일까지 사용 후 취소 (cancelSubscription)
 * - 옵션 2: 즉시 환불 + 취소 (refundLastPayment) — 7일 이내 + 미사용일 때만 노출
 *
 * 환불 자격은 서버에서 다시 검증함. 본 컴포넌트의 refundEligible 은 UI 노출용일 뿐 신뢰 X.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { cancelSubscription, refundLastPayment } from "../actions";

const REASON_OPTIONS = [
  { value: "price", label: "가격이 부담됩니다" },
  { value: "no_match", label: "관심 단지가 적습니다 / 지역이 맞지 않습니다" },
  { value: "missing_feature", label: "필요한 기능이 없습니다" },
  { value: "ux", label: "사용성이 불편합니다" },
  { value: "bug", label: "오류·장애가 잦습니다" },
  { value: "other", label: "기타" },
] as const;

export function CancelForm({
  refundEligible,
  amount,
}: {
  refundEligible: boolean;
  amount: number;
}) {
  const router = useRouter();
  const [reason, setReason] = useState<string>("");
  const [reasonText, setReasonText] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function buildReason(): string {
    const r = REASON_OPTIONS.find((o) => o.value === reason)?.label ?? "";
    const extra = reasonText.trim();
    if (r && extra) return `${r} — ${extra}`;
    return r || extra || "사유 미입력";
  }

  function handleCancelOnly() {
    setError(null);
    startTransition(async () => {
      const res = await cancelSubscription({ reason: buildReason() });
      if (!res.ok) { setError(res.error ?? "취소 처리에 실패했습니다."); return; }
      router.replace("/billing?canceled=1");
    });
  }

  function handleRefund() {
    if (!confirm("정말 즉시 환불 후 구독을 취소하시겠어요? 결제 카드로 환불 처리되며 영업일 기준 3~5일 소요됩니다.")) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await refundLastPayment({ reason: buildReason() });
      if (!res.ok) { setError(res.error ?? "환불 처리에 실패했습니다."); return; }
      router.replace(`/billing?refunded=${res.refundedAmount ?? amount}`);
    });
  }

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5">
      {/* 사유 라디오 */}
      <fieldset>
        <legend className="mb-2 text-sm font-bold text-on-surface">
          취소 사유 <span className="text-on-surface-var font-medium">(서비스 개선에 큰 도움이 됩니다)</span>
        </legend>
        <div className="space-y-1.5">
          {REASON_OPTIONS.map((o) => (
            <label
              key={o.value}
              className={[
                "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                reason === o.value
                  ? "border-accent bg-blue-50/40 text-on-surface"
                  : "border-slate-200 text-on-surface-var hover:bg-slate-50",
              ].join(" ")}
            >
              <input
                type="radio"
                name="reason"
                value={o.value}
                checked={reason === o.value}
                onChange={(e) => setReason(e.target.value)}
                className="size-4 text-accent focus:ring-2 focus:ring-accent/40"
              />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="reasonText" className="mb-1.5 block text-xs font-semibold text-on-surface-var">
          추가 의견 (선택, 500자 이내)
        </label>
        <textarea
          id="reasonText"
          rows={3}
          maxLength={500}
          value={reasonText}
          onChange={(e) => setReasonText(e.target.value)}
          placeholder="예: 우리 지역(전라/강원)이 아직 커버되지 않아서요."
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={handleCancelOnly}
          disabled={pending}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-on-surface transition-colors hover:bg-slate-50 disabled:opacity-60"
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : null}
          다음 결제일까지 사용 후 취소
        </button>

        {refundEligible && (
          <button
            type="button"
            onClick={handleRefund}
            disabled={pending}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-red-700 disabled:opacity-60"
          >
            {pending ? <Loader2 size={14} className="animate-spin" /> : null}
            즉시 환불 후 취소 ({amount.toLocaleString()}원)
          </button>
        )}
      </div>

      <p className="text-[11px] leading-relaxed text-on-surface-var">
        ※ 즉시 환불은 결제 후 7일 이내 + 서비스 미사용(제안서 미생성)인 경우에만 자동 처리됩니다.
        조건을 충족하지 못하면 자동 환불이 거부되며, 그 경우 고객센터로 환불 요청해주세요.
      </p>
    </section>
  );
}
