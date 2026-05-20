/**
 * 법적 문서 페이지 공통 레이아웃 (/terms, /privacy, /refund)
 *
 * - 헤더: 뒤로 가기 + 서비스 로고
 * - 본문: prose 스타일 (Tailwind 없이 직접 클래스 — typography 플러그인 의존 안 함)
 * - 푸터: 사업자정보 + 다른 법적 문서로 이동
 *
 * 로그인 없이도 접근 가능하므로 (dashboard) 그룹에 두지 않음.
 */

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BusinessFooter } from "@/components/legal/BusinessFooter";

export const metadata = {
  robots: { index: true, follow: true },
};

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      {/* 헤더 */}
      <header className="sticky top-0 z-30 flex h-14 items-center border-b border-slate-200 bg-white/85 px-4 backdrop-blur-md">
        <Link
          href="/"
          aria-label="홈으로"
          className="-ml-2 flex items-center justify-center rounded-full p-2 transition-all hover:bg-slate-100 active:scale-90"
        >
          <ArrowLeft size={20} className="text-on-surface" />
        </Link>
        <h1 className="ml-1 text-base font-bold text-on-surface">법적 고지</h1>
      </header>

      {/* 본문 */}
      <main className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-6 sm:py-12">
        <article className="legal-prose space-y-6 text-[15px] leading-relaxed text-on-surface">
          {children}
        </article>

        {/* 다른 법적 문서로 이동 */}
        <nav className="mt-10 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-6 text-sm">
          <span className="text-on-surface-var">다른 문서:</span>
          <Link href="/terms" className="font-semibold text-accent hover:underline">이용약관</Link>
          <Link href="/privacy" className="font-semibold text-accent hover:underline">개인정보처리방침</Link>
          <Link href="/refund" className="font-semibold text-accent hover:underline">환불·청약철회 정책</Link>
        </nav>
      </main>

      <BusinessFooter />
    </div>
  );
}
