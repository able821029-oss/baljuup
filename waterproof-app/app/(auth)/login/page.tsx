/**
 * /login — 이메일/비밀번호 로그인 (Client Component)
 *
 * Stitch 디자인 반영:
 *   - 중앙 흰 카드 (max-w-[480px])
 *   - 워드마크 + 서브타이틀
 *   - 아이콘 input (Mail, Lock)
 *   - 큰 파랑 버튼 (h-15)
 *   - 하단 회원가입 / 비밀번호 찾기 링크 분리
 */

"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { AlertCircle, Loader2, Mail, Lock } from "lucide-react";
import { login, type LoginState } from "./actions";

// useSearchParams() 는 Suspense 경계 안에서 호출되어야 정적 prerender 회피 가능.
// 페이지 자체를 Suspense 로 감싸서 빌드 통과 보장.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const params = useSearchParams();
  const redirectTo = params.get("redirect") ?? "/dashboard";
  const [state, formAction] = useFormState<LoginState, FormData>(login, null);

  return (
    <div className="w-full max-w-[480px] space-y-10 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm md:p-10">
      {/* 브랜딩 */}
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex items-center gap-2">
          <span className="text-3xl font-extrabold tracking-tight text-accent">발주Up</span>
        </div>
        <p className="text-base font-semibold text-on-surface-var">
          방수 공사 수주의 시작, 발주Up
        </p>
      </div>

      {/* 로그인 폼 */}
      <form action={formAction} className="w-full space-y-5">
        <input type="hidden" name="redirect" value={redirectTo} />

        <Field
          label="이메일"
          name="email"
          type="email"
          required
          placeholder="이메일을 입력하세요"
          autoComplete="email"
          icon={<Mail size={20} />}
        />

        <Field
          label="비밀번호"
          name="password"
          type="password"
          required
          minLength={6}
          placeholder="비밀번호를 입력하세요"
          autoComplete="current-password"
          icon={<Lock size={20} />}
        />

        <div className="flex items-center space-x-2 py-2">
          <input
            id="remember"
            name="remember"
            type="checkbox"
            defaultChecked
            className="size-5 rounded border-slate-300 text-accent focus:ring-accent"
          />
          <label htmlFor="remember" className="cursor-pointer text-sm text-on-surface-var">
            로그인 상태 유지
          </label>
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
          href="/signup"
          className="text-base font-semibold text-on-surface-var underline decoration-slate-300 underline-offset-4 transition-colors hover:text-accent"
        >
          회원가입
        </Link>
        <span className="h-4 w-px bg-slate-200" />
        <Link
          href="/forgot-password"
          className="text-base font-semibold text-on-surface-var underline decoration-slate-300 underline-offset-4 transition-colors hover:text-accent"
        >
          아이디/비밀번호 찾기
        </Link>
      </div>
    </div>
  );
}

// ============================================================
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-[60px] w-full items-center justify-center gap-2 rounded-lg bg-accent text-lg font-bold text-white shadow-md transition-all hover:bg-blue-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (
        <>
          <Loader2 size={18} className="animate-spin" />
          로그인 중...
        </>
      ) : (
        <>로그인</>
      )}
    </button>
  );
}

function Field({
  label,
  icon,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; icon: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label htmlFor={props.name} className="block text-base font-semibold text-on-surface">
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
          {icon}
        </span>
        <input
          id={props.name}
          {...props}
          className="h-[56px] w-full rounded-lg border border-slate-300 bg-white pl-12 pr-4 text-base placeholder-slate-400 transition-all focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>
    </div>
  );
}
