"use client";

/**
 * 대시보드 셸 — Stitch 디자인 톤 반영
 *
 *   데스크탑 (md+): 좌측 다크 네이비 사이드바 (primary 색)
 *   모바일 (md-):  상단 글래스 헤더 + 하단 5-탭 네비 (Stitch 스타일)
 */

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  FileText,
  Bell,
  Settings,
  Menu,
  X,
  User,
  LogOut,
  Search,
  type LucideIcon,
} from "lucide-react";
import { signOut } from "@/app/(auth)/login/actions";
import { Logo } from "@/components/brand/Logo";

interface NavItem {
  href: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard",  label: "대시보드", shortLabel: "Dashboard", icon: LayoutDashboard },
  { href: "/complexes",  label: "단지 목록", shortLabel: "Complex",   icon: Building2 },
  { href: "/proposals",  label: "제안서",   shortLabel: "Proposal",  icon: FileText },
  { href: "/alerts",     label: "알림",     shortLabel: "Alerts",    icon: Bell },
  { href: "/settings",   label: "설정",     shortLabel: "Settings",  icon: Settings },
];

export interface DashboardShellProps {
  user: {
    email: string;
    companyName: string | null;
    ownerName: string | null;
    plan: string;
  };
  children: React.ReactNode;
}

export function DashboardShell({ user, children }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const currentNav = NAV_ITEMS.find((n) => pathname.startsWith(n.href));

  const displayName = user.companyName || user.ownerName || user.email;
  const initial = (user.companyName ?? user.ownerName ?? user.email).slice(0, 2).toUpperCase();
  const planLabel =
    user.plan === "trial" ? "체험 (7일)"
    : user.plan === "starter" ? "스타터"
    : user.plan === "pro" ? "프로"
    : user.plan;

  return (
    <div className="min-h-screen bg-background">
      {/* ─── 모바일 사이드바 백드롭 ─────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ─── 데스크탑 사이드바 (md+) + 모바일 드로어 ───── */}
      <aside
        className={[
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-primary text-white transition-transform duration-200",
          "md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        ].join(" ")}
      >
        <div className="flex h-20 items-center justify-between border-b border-white/10 px-6">
          {/* 다크 사이드바 — 로고를 화이트화(brightness-0 invert)해 가독성 확보 */}
          <Logo size="sm" inverted href="/dashboard" priority />

          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="md:hidden"
            aria-label="사이드바 닫기"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={[
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-accent font-semibold text-white"
                    : "text-white/70 hover:bg-white/5 hover:text-white",
                ].join(" ")}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 px-3 py-3">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold shadow-lg shadow-accent/20">
              {initial}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-white">{displayName}</div>
              <div className="truncate text-[11px] text-white/50">{planLabel}</div>
            </div>
          </div>
          <form action={signOut} className="mt-1">
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-white/60 transition-colors hover:bg-white/5 hover:text-white"
            >
              <LogOut size={14} />
              로그아웃
            </button>
          </form>
        </div>
      </aside>

      {/* ─── 메인 영역 ─────────────────────────────────── */}
      <div className="md:pl-64">
        {/* 모바일 헤더 (Stitch 글래스 톤) */}
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-slate-100 bg-white/80 px-6 backdrop-blur-md md:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="flex size-10 items-center justify-center rounded-full transition-all hover:bg-slate-50 active:scale-95"
            aria-label="메뉴"
          >
            <Menu size={22} className="text-on-surface-var" />
          </button>
          {/* 모바일 상단 — 글래스 헤더(밝은 배경) → 원본 색상 로고 */}
          <Logo size="sm" href="/dashboard" priority />
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex size-10 items-center justify-center rounded-full transition-all hover:bg-slate-50 active:scale-95"
              aria-label="검색"
            >
              <Search size={20} className="text-on-surface-var" />
            </button>
            <button
              type="button"
              className="relative flex size-10 items-center justify-center rounded-full transition-all hover:bg-slate-50 active:scale-95"
              aria-label="알림"
            >
              <Bell size={20} className="text-on-surface-var" />
              <span className="absolute right-2.5 top-2.5 size-1.5 rounded-full border-2 border-white bg-red-500" />
            </button>
          </div>
        </header>

        {/* 데스크탑 헤더 (간소) */}
        <header className="sticky top-0 z-20 hidden h-16 items-center gap-3 border-b border-slate-100 bg-white/80 px-6 backdrop-blur-md md:flex">
          <h1 className="flex-1 text-base font-bold text-on-surface">
            {currentNav?.label || "발주Up"}
          </h1>
          <button
            type="button"
            className="relative flex size-9 items-center justify-center rounded-full text-on-surface-var hover:bg-slate-50"
            aria-label="알림"
          >
            <Bell size={18} />
            <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-accent" />
          </button>
        </header>

        {/* 컨텐츠 — 모바일 하단 nav 높이만큼 padding-bottom */}
        <main className="pb-[calc(80px+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </main>
      </div>

      {/* ─── 모바일 하단 네비게이션 (Stitch 톤) ────────── */}
      <nav className="safe-pb fixed bottom-0 left-0 right-0 z-50 flex h-20 items-center justify-around border-t border-slate-100 bg-white/90 shadow-[0_-10px_40px_rgba(0,0,0,0.04)] backdrop-blur-xl md:hidden">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex w-full flex-col items-center gap-1.5 py-2 transition-opacity active:opacity-60",
                active ? "text-accent" : "text-slate-400",
              ].join(" ")}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 2} />
              <span className="text-[10px] font-bold uppercase tracking-tight">
                {item.shortLabel}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
