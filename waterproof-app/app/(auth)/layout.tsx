/**
 * 인증 페이지(/login, /signup, /signup/check-email) 공통 레이아웃
 *
 * Stitch 디자인 반영:
 *   - 상단 헤더 (뒤로 / 발주Up / 도움말)
 *   - 중앙 정렬된 큰 카드
 *   - 미세한 파랑 도트 패턴 배경
 *   - 하단 신뢰 푸터 (검증된 현장 / 신속한 발주)
 */

import Link from "next/link";
import { ArrowLeft, HelpCircle, BadgeCheck, ClipboardCheck } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background text-on-surface">
      {/* 배경 도트 패턴 */}
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.05]"
        style={{
          backgroundImage: "radial-gradient(#2563eb 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
        aria-hidden="true"
      />

      {/* 상단 헤더 */}
      <header className="fixed left-0 right-0 top-0 z-50 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/80 px-4 backdrop-blur-md md:px-8">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="rounded-full p-2 transition-all hover:bg-slate-100 active:scale-95"
            aria-label="홈으로"
          >
            <ArrowLeft size={22} className="text-accent" />
          </Link>
          <Logo size="sm" href="/" priority />
        </div>
        <a
          href="mailto:support@baljuup.co.kr?subject=발주Up 문의"
          className="rounded-full p-2 transition-all hover:bg-slate-100 active:scale-95"
          aria-label="도움말"
        >
          <HelpCircle size={22} className="text-accent" />
        </a>
      </header>

      {/* 메인 영역 — 중앙 정렬 (콘텐츠 길어지면 위에서부터 시작) */}
      <main className="flex flex-1 flex-col items-center px-4 pb-12 pt-24">
        {children}

        {/* 하단 신뢰 푸터 */}
        <div className="mt-10 max-w-[320px] space-y-2 text-center">
          <p className="text-xs font-medium text-slate-400">
            전국 방수 공사업체 대표님들을 위한 전용 관리 시스템
          </p>
          <div className="flex justify-center gap-4">
            <div className="flex items-center gap-1 text-on-surface-var">
              <BadgeCheck size={16} />
              <span className="text-xs font-medium">검증된 현장</span>
            </div>
            <div className="flex items-center gap-1 text-on-surface-var">
              <ClipboardCheck size={16} />
              <span className="text-xs font-medium">신속한 발주</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}