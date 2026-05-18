/**
 * /settings/profile — 프로필 편집 (Server Component)
 *
 * 기존 /settings 페이지의 ProfileForm + 계정 정보 + DangerZone 을
 * 별도 페이지로 분리.
 */

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ArrowLeft, Mail, CalendarDays, CreditCard } from "lucide-react";
import { ProfileForm } from "@/components/settings/ProfileForm";
import { DangerZone } from "@/components/settings/DangerZone";

export const revalidate = 0;

export default async function SettingsProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profileData } = await supabase
    .from("user_profiles")
    .select("company_name,owner_name,phone,region,plan,trial_ends_at,created_at")
    .eq("id", user.id)
    .maybeSingle();

  type Profile = {
    company_name: string | null;
    owner_name: string | null;
    phone: string | null;
    region: string[] | null;
    plan: string | null;
    trial_ends_at: string | null;
    created_at: string;
  };
  const profile = (profileData as unknown) as Profile | null;

  const planMeta = formatPlan(profile?.plan ?? "trial", profile?.trial_ends_at ?? null);

  return (
    <div className="mx-auto w-full max-w-md px-4 pt-4 lg:max-w-2xl">
      <Link
        href="/settings"
        className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-on-surface-var hover:text-accent"
      >
        <ArrowLeft size={14} />
        설정으로
      </Link>

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-on-surface">프로필 편집</h2>
        <p className="mt-1 text-sm text-on-surface-var">프로필과 구독 정보를 관리하세요.</p>
      </div>

      {/* 1) 프로필 정보 */}
      <section className="mb-6 rounded-xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-100 px-5 py-3">
          <h3 className="text-sm font-bold text-on-surface">프로필 정보</h3>
          <p className="mt-0.5 text-xs text-on-surface-var">제안서·알림에 사용되는 기본 정보입니다.</p>
        </header>
        <div className="p-5">
          <ProfileForm
            initial={{
              companyName: profile?.company_name ?? "",
              ownerName: profile?.owner_name ?? "",
              phone: profile?.phone ?? "",
              regions: profile?.region ?? [],
            }}
          />
        </div>
      </section>

      {/* 2) 계정 정보 */}
      <section className="mb-6 rounded-xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-100 px-5 py-3">
          <h3 className="text-sm font-bold text-on-surface">계정 정보</h3>
        </header>
        <dl className="divide-y divide-slate-100">
          <Item icon={Mail} label="이메일" value={user.email ?? "-"} sub="변경하려면 고객센터로 문의" />
          <Item icon={CalendarDays} label="가입일" value={profile?.created_at ? formatDate(profile.created_at) : "-"} />
          <Item icon={CreditCard} label="구독 플랜" value={planMeta.label} sub={planMeta.sub} />
        </dl>
      </section>

      {/* 3) Danger zone */}
      <section className="mb-12">
        <DangerZone />
      </section>
    </div>
  );
}

// ============================================================
import type { LucideIcon } from "lucide-react";

function Item({ icon: Icon, label, value, sub }: { icon: LucideIcon; label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
      <div className="flex items-center gap-3">
        <span className="flex size-8 items-center justify-center rounded-lg bg-slate-100">
          <Icon size={14} className="text-on-surface-var" />
        </span>
        <div>
          <dt className="text-xs text-on-surface-var">{label}</dt>
          <dd className="text-sm font-medium text-on-surface">{value}</dd>
          {sub && <p className="text-xs text-on-surface-var">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function formatPlan(plan: string, trialEndsAt: string | null): { label: string; sub?: string } {
  if (plan === "trial") {
    const daysLeft = trialEndsAt
      ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86_400_000))
      : null;
    return {
      label: "체험 (7일)",
      sub: daysLeft != null
        ? (daysLeft > 0 ? `체험 종료까지 ${daysLeft}일 남음` : "체험 기간이 종료되었습니다")
        : undefined,
    };
  }
  if (plan === "starter") return { label: "스타터 (월 9만 9천원)" };
  if (plan === "pro")     return { label: "프로 (월 12만 5천원)" };
  if (plan === "enterprise") return { label: "엔터프라이즈 (월 60만원)" };
  return { label: plan };
}
