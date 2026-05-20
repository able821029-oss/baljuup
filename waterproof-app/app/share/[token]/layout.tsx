/**
 * 공유 뷰어 레이아웃 — 비로그인 접근
 *
 *   - (dashboard) 그룹의 사이드바 / 헤더 미적용
 *   - 단일 페이지 — 카톡 인앱 브라우저에서도 가볍게 열려야 함
 *   - SEO: 본문에서 noindex 처리 (개별 페이지 metadata)
 */

import Link from 'next/link';

export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <header className="sticky top-0 z-30 flex h-12 items-center border-b border-gray-200 bg-white/90 px-4 backdrop-blur-md">
        <Link href="/" className="text-sm font-bold text-[#0F1E36]">
          발주<span className="text-[#FF6B35]">Up</span>
        </Link>
        <span className="ml-2 text-xs text-gray-500">— 방수공사 제안서</span>
      </header>
      {children}
    </div>
  );
}
