"use client";

/**
 * 추적 항목의 메모/일정/계약금액 인라인 편집 컴포넌트들
 *
 * - MemoEditor: 메모 (자유 텍스트)
 * - NextActionInput: 다음 액션 날짜
 * - LastContactInput: 마지막 연락 날짜
 * - ContractAmountInput: 수주 금액
 * - LogContactNowButton: "지금 연락" 빠른 액션 버튼
 * - DeleteTrackingButton: 추적 항목 삭제
 *
 * 저장 패턴: onBlur / onChange (날짜) → server action → 짧은 ✓ 피드백
 */

import { useState, useTransition } from "react";
import { Check, Loader2, PhoneCall, Trash2 } from "lucide-react";
import {
  deleteTracking,
  logContactNow,
  updateTrackingDetails,
} from "@/app/(dashboard)/tracking/actions";

function SavedIndicator({ pending, savedAt }: { pending: boolean; savedAt: number | null }) {
  if (pending) return <Loader2 size={12} className="animate-spin text-slate-400" />;
  if (savedAt && Date.now() - savedAt < 1500) {
    return <Check size={12} className="text-emerald-500" aria-label="저장됨" />;
  }
  return null;
}

// ============================================================
// 메모
// ============================================================
export function MemoEditor({
  trackingId,
  initial,
  rows = 2,
  placeholder = "영업 메모 (관리소장 응대, 미팅 결과 등)",
}: {
  trackingId: string;
  initial: string | null;
  rows?: number;
  placeholder?: string;
}) {
  const [value, setValue] = useState(initial ?? "");
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);

  function commit() {
    if (!dirty) return;
    const next = value;
    startTransition(async () => {
      const res = await updateTrackingDetails(trackingId, { memo: next.trim() || null });
      if (res.ok) {
        setSavedAt(Date.now());
        setDirty(false);
      }
    });
  }

  return (
    <div className="space-y-1">
      <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-on-surface-var">
        영업 메모
        <SavedIndicator pending={pending} savedAt={savedAt} />
      </label>
      <textarea
        value={value}
        onChange={(e) => { setValue(e.target.value); setDirty(true); }}
        onBlur={commit}
        rows={rows}
        placeholder={placeholder}
        className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-relaxed text-on-surface placeholder:text-slate-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
      />
    </div>
  );
}

// ============================================================
// 날짜 입력 (date)
// ============================================================
function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // YYYY-MM-DD (로컬)
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function fromDateInputValue(s: string): string | null {
  if (!s) return null;
  // 자정으로 저장
  const d = new Date(`${s}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function NextActionInput({
  trackingId,
  initial,
}: {
  trackingId: string;
  initial: string | null;
}) {
  const [value, setValue] = useState(toDateInputValue(initial));
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setValue(v);
    startTransition(async () => {
      const res = await updateTrackingDetails(trackingId, {
        next_action_at: v ? fromDateInputValue(v) : null,
      });
      if (res.ok) setSavedAt(Date.now());
    });
  }

  return (
    <div className="space-y-1">
      <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-on-surface-var">
        다음 액션
        <SavedIndicator pending={pending} savedAt={savedAt} />
      </label>
      <input
        type="date"
        value={value}
        onChange={handleChange}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
      />
    </div>
  );
}

export function LastContactInput({
  trackingId,
  initial,
}: {
  trackingId: string;
  initial: string | null;
}) {
  const [value, setValue] = useState(toDateInputValue(initial));
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setValue(v);
    startTransition(async () => {
      const res = await updateTrackingDetails(trackingId, {
        last_contact_at: v ? fromDateInputValue(v) : null,
      });
      if (res.ok) setSavedAt(Date.now());
    });
  }

  return (
    <div className="space-y-1">
      <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-on-surface-var">
        마지막 연락
        <SavedIndicator pending={pending} savedAt={savedAt} />
      </label>
      <input
        type="date"
        value={value}
        onChange={handleChange}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
      />
    </div>
  );
}

// ============================================================
// 수주 금액 (원)
// ============================================================
export function ContractAmountInput({
  trackingId,
  initial,
}: {
  trackingId: string;
  initial: number | null;
}) {
  const [value, setValue] = useState(initial != null ? String(initial) : "");
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function commit() {
    if (!dirty) return;
    if (value === "") {
      startTransition(async () => {
        const res = await updateTrackingDetails(trackingId, { contract_amount: null });
        if (res.ok) {
          setSavedAt(Date.now());
          setDirty(false);
          setError(null);
        }
      });
      return;
    }
    const n = Number(value.replace(/[^0-9]/g, ""));
    if (!Number.isFinite(n) || n < 0) {
      setError("숫자만 입력");
      return;
    }
    startTransition(async () => {
      const res = await updateTrackingDetails(trackingId, { contract_amount: n });
      if (res.ok) {
        setSavedAt(Date.now());
        setDirty(false);
        setError(null);
        setValue(String(n));
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-1">
      <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-on-surface-var">
        수주 금액 (원)
        <SavedIndicator pending={pending} savedAt={savedAt} />
      </label>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => { setValue(e.target.value); setDirty(true); }}
        onBlur={commit}
        placeholder="예: 150000000"
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
      />
      {error && <p className="text-[11px] text-red-600">{error}</p>}
    </div>
  );
}

// ============================================================
// "지금 연락" 빠른 액션
// ============================================================
export function LogContactNowButton({ trackingId }: { trackingId: string }) {
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);

  function handleClick() {
    startTransition(async () => {
      const res = await logContactNow(trackingId);
      if (res.ok) setSavedAt(Date.now());
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-on-surface-var transition-colors hover:bg-slate-50 disabled:opacity-60"
    >
      {pending ? <Loader2 size={12} className="animate-spin" /> : <PhoneCall size={12} />}
      지금 연락 기록
      {savedAt && Date.now() - savedAt < 1500 && (
        <Check size={12} className="text-emerald-500" />
      )}
    </button>
  );
}

// ============================================================
// 추적 항목 삭제
// ============================================================
export function DeleteTrackingButton({ trackingId }: { trackingId: string }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const ok = typeof window !== "undefined"
      ? window.confirm("이 단지를 영업 추적 목록에서 삭제할까요? (메모/일정이 함께 사라집니다)")
      : false;
    if (!ok) return;
    startTransition(async () => {
      await deleteTracking(trackingId);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-lg border border-transparent px-2.5 py-1.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
      aria-label="추적 목록에서 삭제"
    >
      {pending ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
      삭제
    </button>
  );
}
