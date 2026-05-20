/**
 * 사업자정보 푸터 — 전자상거래법 §13 의무 표시
 *
 * 노출 위치:
 *   - 법적 문서 페이지 (/terms, /privacy, /refund) — 레이아웃에 자동 포함
 *   - 인증 페이지 (/login, /signup, /forgot-password)
 *   - 랜딩/홈 (추후)
 *
 * 대시보드 내부 페이지에는 노출하지 않음 (이미 로그인된 사용자, 화면 공간 절약).
 */

import Link from "next/link";
import { getBusinessInfo } from "@/lib/legal";

export function BusinessFooter() {
  const biz = getBusinessInfo();
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-3xl px-5 py-8 text-xs leading-relaxed text-on-surface-var sm:px-6">
        {/* 법적 문서 링크 */}
        <nav className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] font-semibold">
          <Link href="/terms" className="text-on-surface hover:text-accent">이용약관</Link>
          <span className="text-slate-300">|</span>
          <Link href="/privacy" className="text-on-surface hover:text-accent">
            <strong>개인정보처리방침</strong>
          </Link>
          <span className="text-slate-300">|</span>
          <Link href="/refund" className="text-on-surface hover:text-accent">환불·청약철회</Link>
          <span className="text-slate-300">|</span>
          <a
            href={`mailto:${biz.customerEmail}?subject=${encodeURIComponent(biz.serviceName + " 고객문의")}`}
            className="text-on-surface hover:text-accent"
          >
            고객센터
          </a>
        </nav>

        {/* 사업자정보 — 한 줄 표기 */}
        <dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
          <Row label="상호" value={biz.legalName} />
          <Row label="대표자" value={biz.ceo} />
          <Row label="사업자등록번호" value={biz.businessNumber} />
          <Row label="통신판매업 신고번호" value={biz.mailOrderNumber} />
          <Row label="사업장 주소" value={biz.address} className="sm:col-span-2" />
          <Row label="개인정보보호책임자" value={biz.privacyOfficer} />
          <Row label="고객센터" value={`${biz.customerEmail} · ${biz.customerPhone}`} />
          <Row label="호스팅" value={biz.hosting} className="sm:col-span-2" />
        </dl>

        <p className="mt-5 text-[11px] text-slate-400">
          © {new Date().getFullYear()} {biz.legalName}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={["flex gap-2", className ?? ""].join(" ")}>
      <dt className="shrink-0 font-semibold text-on-surface">{label}</dt>
      <dd className="text-on-surface-var">{value}</dd>
    </div>
  );
}
