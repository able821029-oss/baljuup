/**
 * /settings — 설정 메인 (Server Component)
 *
 * Stitch 디자인 반영:
 *   - 프로필 카드 (아바타 + 인증 배지 + 회사명 + 이메일 + 프로필 편집 버튼)
 *   - 시스템 설정 메뉴 4종 (내 정보 / 알림 / 구독 플랜 / 고객센터)
 *   - 로그아웃 (별도 카드, 빨강)
 *   - 푸터 (버전, 약관, 카피라이트)
 *
 * 하위 페이지:
 *   - /settings/profile  → 내 정보 수정 (ProfileForm + DangerZone)
 *   - /settings/notifications → (추후 — 현재는 alert)
 *   - /billing           → 구독 플랜 관리
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Bell,
  Search,
  Mail,
  BadgeCheck,
  Pencil,
  User as UserIcon,
  CreditCard,
  HelpCircle,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/(auth)/login/actions";

export const revalidate = 0;

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profileData } = await supabase
    .from("user_profiles")
    .select("company_name,owner_name,phone,plan,trial_ends_at")
    .eq("id", user.id)
    .maybeSingle();

  type Profile = {
    company_name: string | null;
    owner_name: string | null;
    phone: string | null;
    plan: string | null;
    trial_ends_at: string | null;
  };
  const profile = (profileData as unknown) as Profile | null;

  const companyName = profile?.company_name ?? "(미설정) 회사명";
  const ownerName = profile?.owner_name ?? "사장";
  const plan = profile?.plan ?? "trial";
  const isVerified = plan === "starter" || plan === "pro" || plan === "enterprise";
  const planBadge = plan === "pro" ? "PRO" : plan === "starter" ? "STARTER" : plan === "enterprise" ? "ENT" : null;

  return (
    <div className="mx-auto w-full max-w-md px-4 pt-4 lg:max-w-2xl">
      {/* 상단 액션 (모바일 헤더가 있으므로 간소) */}
      <div className="mb-2 flex items-center justify-end gap-1">
        <Link
          href="/alerts"
          className="rounded-full p-2 transition-colors hover:bg-slate-100"
          aria-label="알림"
        >
          <Bell size={20} className="text-on-surface-var" />
        </Link>
        <button
          type="button"
          className="rounded-full p-2 transition-colors hover:bg-slate-100"
          aria-label="검색"
        >
          <Search size={20} className="text-on-surface-var" />
        </button>
      </div>

      <h2 className="mb-4 text-2xl font-bold text-on-surface">설정</h2>

      {/* 프로필 카드 */}
      <section className="mb-6">
        <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          {/* 아바타 + verified 배지 */}
          <div className="relative mb-4">
            <div className="flex size-24 items-center justify-center rounded-2xl border border-slate-200 bg-gradient-to-br from-blue-100 to-slate-200 text-3xl font-bold text-accent">
              {(ownerName || companyName).slice(0, 1).toUpperCase()}
            </div>
            {isVerified && (
              <div className="absolute -bottom-1 -right-1 flex items-center justify-center rounded-full border-2 border-white bg-accent p-1">
                <BadgeCheck size={14} className="text-white" fill="currentColor" stroke="white" />
              </div>
            )}
          </div>

          <div className="mb-2 flex flex-col items-center gap-1.5">
            <h3 className="text-2xl font-bold text-on-surface">{ownerName} 대표님</h3>
            {isVerified ? (
              <span className="rounded-full bg-blue-100 px-3 py-0.5 text-[11px] font-bold text-accent">
                인증 파트너
              </span>
            ) : (
              <span className="rounded-full bg-amber-100 px-3 py-0.5 text-[11px] font-bold text-amber-700">
                체험 사용자
              </span>
            )}
          </div>

          <p className="text-base font-medium text-on-surface-var">{companyName}</p>
          <p className="mt-1 flex items-center justify-center gap-1 text-sm text-on-surface-var/80">
            <Mail size={16} />
            {user.email ?? "이메일 미상"}
          </p>

          <Link
            href="/settings/profile"
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-3 font-bold text-on-surface transition-colors hover:bg-slate-100"
          >
            <Pencil size={16} />
            프로필 편집
          </Link>
        </div>
      </section>

      {/* 시스템 설정 메뉴 */}
      <section className="mb-6 space-y-4">
        <h4 className="px-1 text-sm font-bold text-on-surface-var">시스템 설정</h4>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <MenuItem
            href="/settings/profile"
            icon={UserIcon}
            title="내 정보 수정"
            subtitle="계정, 연락처, 사업자 정보"
          />
          <MenuItem
            href="/settings/profile#notifications"
            icon={Bell}
            title="알림 설정"
            subtitle="공고 및 채팅 푸시 알림"
            disabled
          />
          <MenuItem
            href="/billing"
            icon={CreditCard}
            title="구독 플랜 관리"
            subtitle="멤버십 및 결제 내역"
            badge={planBadge ?? undefined}
          />
          <MenuItem
            href="mailto:support@baljuup.co.kr?subject=발주Up 문의"
            icon={HelpCircle}
            title="고객센터"
            subtitle="1:1 문의 및 FAQ"
            external
            last
          />
        </div>
      </section>

      {/* 로그아웃 */}
      <section className="mb-6">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center justify-between p-4 transition-colors hover:bg-red-50 active:bg-red-100"
            >
              <div className="flex items-center gap-4">
                <div className="flex size-10 items-center justify-center rounded-xl bg-slate-100">
                  <LogOut size={20} className="text-red-600" />
                </div>
                <div className="text-left">
                  <h5 className="text-base font-bold text-red-600">로그아웃</h5>
                  <p className="text-xs text-on-surface-var">안전하게 접속 종료</p>
                </div>
              </div>
              <ChevronRight size={20} className="text-slate-400" />
            </button>
          </form>
        </div>
      </section>

      {/* 푸터 */}
      <footer className="pb-8 pt-4 text-center">
        <p className="text-xs text-slate-400">버전 v0.1.0 (베타)</p>
        <div className="mt-2 flex justify-center gap-4">
          <Link href="/terms" className="text-xs text-on-surface-var hover:underline">
            이용약관
          </Link>
          <Link href="/privacy" className="text-xs font-bold text-on-surface-var hover:underline">
            개인정보처리방침
          </Link>
        </div>
        <p className="mt-4 text-[10px] text-slate-300">
          © {new Date().getFullYear()} 발주Up.
        </p>
      </footer>
    </div>
  );
}

// ============================================================
// 메뉴 행
// ============================================================
import type { LucideIcon } from "lucide-react";

function MenuItem({
  href,
  icon: Icon,
  title,
  subtitle,
  badge,
  disabled,
  external,
  last,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  badge?: string;
  disabled?: boolean;
  external?: boolean;
  last?: boolean;
}) {
  const inner = (
    <div className="flex w-full items-center justify-between p-4 transition-colors hover:bg-slate-50 active:bg-slate-100">
      <div className="flex items-center gap-4">
        <div className="flex size-10 items-center justify-center rounded-xl bg-blue-50">
          <Icon size={22} className="text-accent" />
        </div>
        <div className="text-left">
          <div className="flex items-center gap-2">
            <h5 className="text-base font-bold text-on-surface">{title}</h5>
            {badge && (
              <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                {badge}
              </span>
            )}
          </div>
          <p className="text-xs font-medium text-on-surface-var">
            {subtitle}
            {disabled && <span className="ml-1 text-slate-400">(준비 중)</span>}
          </p>
        </div>
      </div>
      <ChevronRight size={20} className="text-slate-400" />
    </div>
  );

  const className = `block border-b border-slate-200 ${last ? "border-b-0" : ""} ${disabled ? "pointer-events-none opacity-60" : ""}`;

  if (external) {
    return (
      <a href={href} className={className}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {inner}
    </Link>
  );
}
