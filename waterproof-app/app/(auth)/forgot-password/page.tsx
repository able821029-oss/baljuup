/**
 * /forgot-password — 비밀번호 재설정 메일 요청 (Client Component)
 *
 * Stitch 디자인 동일 톤:
 *   - 흰 카드 (max-w-[480px])
 *   - "발주Up" 워드마크
 *   - 이메일 input + 큰 파랑 CTA
 *   - 발송 성공 시 안내 카드로 전환
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Mail } from "lucide-react";
import { requestPasswordReset, type ForgotPasswordState } from "./actions";

export default function ForgotPasswordPage() {
  const [state, formAction] = useFormState<ForgotPasswordState, FormData>(
    requestPasswordReset,
    null,
  );
  const [resendKey, setResendKey] = useState(0);

  // 발송 성공 화면
  if (state?.ok) {
    return (
      <div className="w-full max-w-[480px] space-y-8 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm md:p-10">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-blue-50">
            <CheckCircle2 size={36} className="text-accent" fill="white" strokeWidth={2.2} />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-on-surface">
            메일을 보냈습니다
          </h1>
          <p className="text-sm leading-relaxed text-on-surface-var">
            <Mail size={14} className="-mt-1 mr-1 inline text-accent" />
            <span className="font-semibold text-on-surface">{state.email}</span> 로 비밀번호
            재설정 링크를 발송했습니다. 메일을 열어 링크를 클릭해주세요.
          </p>
        </div>

        <div className="rounded-lg bg-slate-50 p-4 text-left text-xs leading-relaxed text-on-surface-var">
          <p className="mb-2 font-semibold text-on-surface">메일이 안 보이나요?</p>
          <ul className="space-y-1 pl-4">
            <li className="list-disc">스팸함 또는 프로모션 탭을 확인해보세요.</li>
            <li className="list-disc">5분 이상 안 오면 아래 "다시 보내기"를 눌러주세요.</li>
            <li className="list-disc">링크는 1시간 동안 유효합니다.</li>
          </ul>
        </div>

        <div className="space-y-3">
          <Link
            href="/login"
            className="flex h-[52px] w-full items-center justify-center gap-2 rounded-lg bg-accent text-base font-bold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-95"
          >
            <ArrowLeft size={18} />
            로그인 페이지로
          </Link>

          {/* 같은 이메일로 재발송 — key 변경으로 폼 리셋 */}
          <form key={resendKey} action={formAction}>
            <input type="hidden" name="email" value={state.email ?? ""} />
            <button
              type="submit"
              onClick={() => setResendKey((k) => k + 1)}
              className="h-[44px] w-full rounded-lg border border-slate-300 bg-white text-sm font-semibold text-on-surface-var transition-colors hover:bg-slate-50"
            >
              다시 보내기
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 메일 입력 폼
  return (
    <div className="w-full max-w-[480px] space-y-10 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm md:p-10">
      {/* 브랜딩 */}
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex items-center gap-2">
          <span className="text-3xl font-extrabold tracking-tight text-accent">발주Up</span>
        </div>
        <h1 className="text-xl font-bold text-on-surface">비밀번호를 잊으셨나요?</h1>
        <p className="text-sm leading-relaxed text-on-surface-var">
          가입하신 이메일을 입력하시면<br className="md:hidden" /> 비밀번호 재설정 링크를 보내드립니다.
        </p>
      </div>

      {/* 폼 */}
      <form action={formAction} className="space-y-5">
        <div className="flex flex-col gap-2">
          <label htmlFor="email" className="text-sm font-semibold text-on-surface">
            이메일
          </label>
          <div className="relative">
            <Mail
              size={18}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              defaultValue={state?.email ?? ""}
              placeholder="company@example.com"
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

      {/* 하단 링크 */}
      <div className="flex w-full items-center justify-center gap-6 border-t border-slate-200 pt-6">
        <Link
          href="/login"
          className="flex items-center gap-1.5 text-sm font-semibold text-on-surface-var transition-colors hover:text-accent"
        >
          <ArrowLeft size={14} />
          로그인으로 돌아가기
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
          발송 중...
        </>
      ) : (
        "재설정 링크 받기"
      )}
    </button>
  );
}
