/**
 * 루트 레이아웃 — 폰트 / 메타데이터 / lang
 *
 * - Hanken Grotesk (Stitch 디자인 권장 폰트, 영문/숫자)
 * - Pretendard Variable (한글 본문)
 * - lang="ko"
 */

import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "발주Up — 아파트 방수공사 수주 예측 SaaS",
  description:
    "수도권 1.7만 단지의 발주 가능성을 AI 가 점수로 자동 분석. 신규 입찰공고 즉시 알림 + 클릭 한 번에 AI 제안서 생성.",
  applicationName: "발주Up",
  authors: [{ name: "발주Up" }],
  openGraph: {
    title: "발주Up",
    description: "아파트 방수공사 발주를 6개월 먼저 알려드립니다.",
    locale: "ko_KR",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1e293b",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <head>
        {/* Pretendard — 한글 가독성 */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        {/* Hanken Grotesk — 숫자 / 영문 강조 (Stitch 디자인 기본) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&display=swap"
        />
      </head>
      <body className="bg-background font-sans text-on-surface antialiased">
        {children}
      </body>
    </html>
  );
}
