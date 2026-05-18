/**
 * /reset-password — 새 비밀번호 입력 (Client Component)
 *
 * 사용자는 비밀번호 재설정 메일의 링크를 클릭해 이 페이지로 도착함.
 * 이 시점에 Supabase 세션이 자동으로 생성되어 있어야 하며,
 * 이 페이지에서 새 비밀번호를 입력하면 supabase.auth.updateUser 로 변경.
 */

"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { AlertCircle, Loader2, Lock, KeyRound } from "lucide-react";
import { resetPassword, type ResetPasswordState } from "./actions";

export default function ResetPasswordPage() {
  const [state, formAction] = useFormState<ResetPasswordState, FormData>(
    resetPassword,
    null,
  );

  return (
    <div className="w-full max-w-[480px] space-y-10 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm md:p-10">
      {/* 브랜딩 */}
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-blue-50">
          <KeyRound size={32} className="text-accent" strokeWidth={2} />
        </div>
        <h1 className="text-xl font-bold text-on-surface">새 비밀번호 설정</h1>
        <p className="text-sm leading-relaxed text-on-surface-var">
          영문/숫자 조합 8자 이상의 새 비밀번호를 입력해주세요.
        </p>
      </div>

      <form action={formAction} className="space-y-5">
        {/* 새 비밀번호 */}
        <div className="flex flex-col gap-2">
          <label htmlFor="password" className="text-sm font-semibold text-on-surface">
            새 비밀번호
          </label>
          <div className="relative">
            <Lock
              size={18}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="8자 이상"
              className="h-[52px] w-full rounded-lg border border-slate-300 bg-white pl-11 pr-4 text-base placeholder-slate-400 outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>

        {/* 비밀번호 확인 */}
        <div className="flex flex-col gap-2">
          <label htmlFor="passwordConfirm" className="text-sm font-semibold text-on-surface">
            비밀번호 확인
          </label>
          <div className="relative">
            <Lock
              size={18}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              id="passwordConfirm"
              name="passwordConfirm"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="새 비밀번호를 한 번 더 입력"
              className="h-[52px] w-full rounded-lg border border-slate-300 bg-white pl-11 pr-4 text-base placeholder-slate-400 outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>

        {state?.error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{state.error}</span>
          </div>
        )}

        <SubmitButton />
      </form>

      <div className="flex w-full items-center justify-center border-t border-slate-200 pt-6 text-sm text-on-surface-var">
        <Link href="/login" className="font-semibold text-accent hover:underline">
          로그인 페이지로
        </Link>
      </div>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-[52px] w-full items-center justify-center gap-2 rounded-lg bg-accent text-base font-bold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (
        <>
          <Loader2 size={18} className="animate-spin" />
          저장 중...
        </>
      ) : (
        "비밀번호 변경하기"
      )}
    </button>
  );
}
