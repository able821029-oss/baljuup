/**
 * /signup — 회원가입 (Client Component)
 *
 * Stitch 디자인 — 카드 없는 미니멀 레이아웃:
 *   - 큰 헤드라인 2줄 + 부설명
 *   - 라벨 + input + 헬퍼 텍스트 패턴
 *   - 큰 파랑 CTA "다음 단계로 이동"
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { AlertCircle, ChevronRight, Loader2 } from "lucide-react";
import { signup, type SignupState } from "./actions";

const REGIONS = ["서울", "경기", "인천", "강원", "충청", "전라", "경상", "제주"];

export default function SignupPage() {
  const [state, formAction] = useFormState<SignupState, FormData>(signup, null);
  const [regions, setRegions] = useState<string[]>(["서울", "경기"]);
  const [phoneVerified, setPhoneVerified] = useState(false);

  function toggleRegion(r: string) {
    setRegions((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));
  }

  const fe = state?.fieldErrors ?? {};

  return (
    <div className="w-full max-w-2xl">
      {/* 헤드라인 */}
      <section className="space-y-3">
        <h2 className="text-3xl font-bold leading-tight tracking-tight text-on-surface md:text-4xl">
          발주Up 회원이 되어
          <br />
          수주 기회를 잡으세요
        </h2>
        <p className="text-sm text-on-surface-var md:text-base">
          정확한 정보 입력을 통해 신뢰도 높은 프로필을 완성해보세요.
        </p>
      </section>

      {/* 폼 */}
      <form action={formAction} className="mt-10 space-y-10">
        <div className="space-y-5">
          {/* 1) 대표자명 */}
          <Field
            label="대표자명"
            name="ownerName"
            required
            placeholder="성함을 입력해주세요"
            autoComplete="name"
            helper="실명 입력을 권장합니다. 제안서·알림에 사용됩니다."
            error={fe.ownerName}
          />

          {/* 2) 사업체명 */}
          <Field
            label="사업체명"
            name="companyName"
            required
            placeholder="예: 한일방수"
            autoComplete="organization"
            helper="고객에게 노출되는 회사명입니다."
            error={fe.companyName}
          />

          {/* 3) 휴대폰 번호 + 인증 (UI placeholder) */}
          <div className="flex flex-col gap-2">
            <label htmlFor="phone" className="text-base font-semibold text-on-surface">
              휴대폰 번호 <span className="ml-0.5 text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                placeholder="010-0000-0000"
                autoComplete="tel"
                className={[
                  "h-[52px] flex-1 rounded-lg border bg-white px-4 text-base placeholder-slate-400 outline-none transition-all focus:ring-2",
                  fe.phone
                    ? "border-red-400 focus:border-red-500 focus:ring-red-200"
                    : "border-slate-300 focus:border-accent focus:ring-accent",
                ].join(" ")}
              />
              <button
                type="button"
                onClick={() => setPhoneVerified(true)}
                className="h-[52px] whitespace-nowrap rounded-lg border border-on-surface bg-white px-6 font-bold text-on-surface transition-colors hover:bg-slate-100 active:scale-95"
              >
                {phoneVerified ? "인증됨" : "인증 요청"}
              </button>
            </div>
            {phoneVerified && (
              <input
                type="text"
                placeholder="인증번호 6자리 입력"
                className="mt-2 h-[52px] w-full rounded-lg border border-slate-300 bg-white px-4 text-base placeholder-slate-400 outline-none focus:border-accent focus:ring-2 focus:ring-accent"
              />
            )}
            <p className="text-xs text-on-surface-var">
              본인 확인을 위해 휴대폰 인증이 필요합니다.{" "}
              <span className="text-slate-400">(현재는 형식만 검증, 실제 SMS 인증은 출시 직후 활성화)</span>
            </p>
            {fe.phone && <p className="text-xs text-red-600">{fe.phone}</p>}
          </div>

          {/* 4) 이메일 */}
          <Field
            label="이메일"
            name="email"
            type="email"
            required
            placeholder="company@example.com"
            autoComplete="email"
            helper="로그인 ID 로 사용됩니다. 가입 인증 메일이 발송됩니다."
            error={fe.email}
          />

          {/* 5) 비밀번호 */}
          <Field
            label="비밀번호"
            name="password"
            type="password"
            required
            minLength={8}
            placeholder="8자 이상"
            autoComplete="new-password"
            helper="영문 / 숫자 조합 8자 이상을 권장합니다."
            error={fe.password}
          />

          {/* 6) 관심 지역 */}
          <div className="flex flex-col gap-2">
            <label className="text-base font-semibold text-on-surface">
              관심 지역 <span className="text-sm font-medium text-slate-400">(다중 선택)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {REGIONS.map((r) => {
                const on = regions.includes(r);
                return (
                  <label key={r}>
                    <input
                      type="checkbox"
                      name="region"
                      value={r}
                      checked={on}
                      onChange={() => toggleRegion(r)}
                      className="sr-only"
                    />
                    <span
                      className={[
                        "inline-block cursor-pointer rounded-full border px-4 py-1.5 text-sm transition-colors",
                        on
                          ? "border-accent bg-accent text-white"
                          : "border-slate-300 bg-white text-on-surface hover:border-accent",
                      ].join(" ")}
                    >
                      {r}
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-on-surface-var">
              선택한 지역의 신규 입찰공고만 알림으로 받게 됩니다. 언제든 변경 가능합니다.
            </p>
          </div>
        </div>

        {/* 에러 표시 */}
        {state?.error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>{state.error}</span>
          </div>
        )}

        {/* CTA */}
        <div className="pt-3">
          <SubmitButton />
          <p className="mt-3 text-center text-xs text-slate-400">
            가입 시 발주Up의{" "}
            <Link href="/terms" className="underline hover:text-accent">이용약관</Link>
            {" "}및{" "}
            <Link href="/privacy" className="underline hover:text-accent">개인정보처리방침</Link>
            에 동의하게 됩니다.
          </p>
        </div>
      </form>

      {/* 로그인 링크 */}
      <div className="mt-10 flex items-center justify-center border-t border-slate-200 pt-6 text-sm text-on-surface-var">
        이미 계정이 있으신가요?
        <Link
          href="/login"
          className="ml-2 font-semibold text-accent underline decoration-blue-200 underline-offset-4 hover:decoration-accent"
        >
          로그인
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
      className="flex h-[56px] w-full items-center justify-center gap-2 rounded-lg bg-accent text-lg font-bold text-white shadow-md transition-all hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (
        <>
          <Loader2 size={18} className="animate-spin" />
          가입 중...
        </>
      ) : (
        <>
          가입 완료하기
          <ChevronRight size={20} />
        </>
      )}
    </button>
  );
}

function Field({
  label,
  helper,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  helper?: string;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={props.name} className="text-base font-semibold text-on-surface">
        {label}
        {props.required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      <input
        id={props.name}
        {...props}
        className={[
          "h-[52px] w-full rounded-lg border bg-white px-4 text-base placeholder-slate-400 outline-none transition-all focus:ring-2",
          error
            ? "border-red-400 focus:border-red-500 focus:ring-red-200"
            : "border-slate-300 focus:border-accent focus:ring-accent",
        ].join(" ")}
      />
      {helper && !error && <p className="text-xs text-on-surface-var">{helper}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
