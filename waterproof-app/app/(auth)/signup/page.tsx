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
const MARKETING_CHANNELS = [
  { value: "email", label: "이메일" },
  { value: "sms", label: "문자(SMS)" },
  { value: "kakao", label: "카카오 알림톡" },
] as const;

export default function SignupPage() {
  const [state, formAction] = useFormState<SignupState, FormData>(signup, null);
  const [regions, setRegions] = useState<string[]>(["서울", "경기"]);
  const [phoneVerified, setPhoneVerified] = useState(false);

  // 동의 상태 (체크된 항목 시각화 + "전체 동의" 헬퍼)
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeAge14, setAgreeAge14] = useState(false);
  const [agreeMarketing, setAgreeMarketing] = useState(false);
  const [agreeNightMarketing, setAgreeNightMarketing] = useState(false);
  const [marketingChannels, setMarketingChannels] = useState<string[]>([]);

  function toggleRegion(r: string) {
    setRegions((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));
  }
  function toggleMarketingChannel(c: string) {
    setMarketingChannels((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));
  }
  function setAllAgreed(v: boolean) {
    setAgreeTerms(v);
    setAgreePrivacy(v);
    setAgreeAge14(v);
    setAgreeMarketing(v);
    setAgreeNightMarketing(v);
    if (!v) setMarketingChannels([]);
    else if (marketingChannels.length === 0) setMarketingChannels(["email", "kakao"]);
  }
  const allAgreed =
    agreeTerms && agreePrivacy && agreeAge14 && agreeMarketing && agreeNightMarketing;

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

        {/* ── 약관 동의 (정보통신망법 §50, 개보법 §22 — 필수 명시 체크) ── */}
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <header className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-sm font-bold text-on-surface">약관 동의</h3>
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-on-surface-var">
              <input
                type="checkbox"
                checked={allAgreed}
                onChange={(e) => setAllAgreed(e.target.checked)}
                className="size-4 cursor-pointer rounded border-slate-300 text-accent focus:ring-2 focus:ring-accent/40"
              />
              전체 동의
            </label>
          </header>

          <ConsentRow
            name="agreeTerms"
            required
            checked={agreeTerms}
            onChange={setAgreeTerms}
            label="이용약관 동의"
            linkHref="/terms"
          />
          <ConsentRow
            name="agreePrivacy"
            required
            checked={agreePrivacy}
            onChange={setAgreePrivacy}
            label="개인정보 수집·이용 동의"
            linkHref="/privacy"
          />
          <ConsentRow
            name="agreeAge14"
            required
            checked={agreeAge14}
            onChange={setAgreeAge14}
            label="만 14세 이상입니다"
          />
          <ConsentRow
            name="agreeMarketing"
            checked={agreeMarketing}
            onChange={(v) => {
              setAgreeMarketing(v);
              if (!v) { setMarketingChannels([]); setAgreeNightMarketing(false); }
              else if (marketingChannels.length === 0) setMarketingChannels(["email", "kakao"]);
            }}
            label="이벤트·할인 등 마케팅 정보 수신 (선택)"
            helper="신규 기능, 할인 이벤트, 단지 추천 등 영업에 도움되는 정보를 받으실 수 있습니다."
          />

          {agreeMarketing && (
            <div className="ml-6 space-y-2 rounded-lg border border-blue-100 bg-blue-50/40 p-3">
              <p className="text-[11px] font-bold text-on-surface-var">수신 채널 (다중 선택)</p>
              <div className="flex flex-wrap gap-2">
                {MARKETING_CHANNELS.map((c) => {
                  const on = marketingChannels.includes(c.value);
                  return (
                    <label key={c.value}>
                      <input
                        type="checkbox"
                        name="marketingChannel"
                        value={c.value}
                        checked={on}
                        onChange={() => toggleMarketingChannel(c.value)}
                        className="sr-only"
                      />
                      <span
                        className={[
                          "inline-block cursor-pointer rounded-full border px-3 py-1 text-xs transition-colors",
                          on
                            ? "border-accent bg-accent text-white"
                            : "border-slate-300 bg-white text-on-surface-var hover:border-accent",
                        ].join(" ")}
                      >
                        {c.label}
                      </span>
                    </label>
                  );
                })}
              </div>

              <ConsentRow
                name="agreeNightMarketing"
                checked={agreeNightMarketing}
                onChange={setAgreeNightMarketing}
                label="21시~익일 08시 야간 광고성 정보 수신 (선택)"
                helper="긴급 입찰 정보 등 야간 발송이 필요한 경우에만 사용됩니다."
              />
            </div>
          )}

          {fe.consents && (
            <p className="flex items-start gap-1.5 text-xs text-red-600">
              <AlertCircle size={12} className="mt-0.5 shrink-0" />
              {fe.consents}
            </p>
          )}
        </section>

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
            가입 시{" "}
            <Link href="/terms" className="underline hover:text-accent">이용약관</Link>,{" "}
            <Link href="/privacy" className="underline hover:text-accent">개인정보처리방침</Link>,{" "}
            <Link href="/refund" className="underline hover:text-accent">환불정책</Link>
            을 확인하시기 바랍니다.
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

function ConsentRow({
  name,
  required,
  checked,
  onChange,
  label,
  helper,
  linkHref,
}: {
  name: string;
  required?: boolean;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  helper?: string;
  linkHref?: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <input
        id={`consent-${name}`}
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 cursor-pointer rounded border-slate-300 text-accent focus:ring-2 focus:ring-accent/40"
      />
      <div className="min-w-0 flex-1 text-sm">
        <label htmlFor={`consent-${name}`} className="cursor-pointer font-semibold text-on-surface">
          {required && <span className="mr-1 text-red-500">[필수]</span>}
          {!required && <span className="mr-1 text-slate-400">[선택]</span>}
          {label}
        </label>
        {linkHref && (
          <Link
            href={linkHref}
            target="_blank"
            rel="noopener"
            className="ml-2 inline-block text-xs font-semibold text-accent underline decoration-blue-200 underline-offset-4 hover:decoration-accent"
          >
            전문 보기 →
          </Link>
        )}
        {helper && <p className="mt-0.5 text-xs text-on-surface-var">{helper}</p>}
      </div>
    </div>
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
