/**
 * 법적 문서 메타데이터 — 약관/개인정보처리방침/환불정책
 *
 * 약관 개정 시:
 *   1) 본 파일의 TERMS_VERSION / PRIVACY_VERSION 을 갱신
 *   2) (선택) 기존 사용자에게 첫 로그인 시 재동의 모달
 *
 * 사업자정보는 환경변수에서 읽어 PII 노출 면피 + 환경별 다른 값 지원.
 */

export const TERMS_VERSION = "2026-05-19";
export const PRIVACY_VERSION = "2026-05-19";
export const REFUND_VERSION = "2026-05-19";

// ============================================================
// 사업자정보 (전자상거래법 §13, §17 — 푸터/거래조건 화면 노출 의무)
// 환경변수 미설정 시 안전한 placeholder. 운영 환경에서는 반드시 채울 것.
// ============================================================
export interface BusinessInfo {
  serviceName: string;        // 서비스명
  legalName: string;          // 상호 (법인명)
  ceo: string;                // 대표자
  address: string;            // 사업장 주소
  businessNumber: string;     // 사업자등록번호 (xxx-xx-xxxxx)
  mailOrderNumber: string;    // 통신판매업 신고번호
  privacyOfficer: string;     // 개인정보보호책임자
  customerEmail: string;
  customerPhone: string;
  hosting: string;            // 호스팅 제공자
}

export function getBusinessInfo(): BusinessInfo {
  return {
    serviceName:      process.env.NEXT_PUBLIC_BIZ_SERVICE      ?? "발주Up",
    legalName:        process.env.NEXT_PUBLIC_BIZ_LEGAL_NAME   ?? "발주Up (사업자명 미설정)",
    ceo:              process.env.NEXT_PUBLIC_BIZ_CEO          ?? "(대표자명 미설정)",
    address:          process.env.NEXT_PUBLIC_BIZ_ADDRESS      ?? "(사업장 주소 미설정)",
    businessNumber:   process.env.NEXT_PUBLIC_BIZ_REG_NUMBER   ?? "(사업자등록번호 미설정)",
    mailOrderNumber:  process.env.NEXT_PUBLIC_BIZ_MAIL_ORDER   ?? "(통신판매업 신고번호 미설정)",
    privacyOfficer:   process.env.NEXT_PUBLIC_BIZ_PRIVACY_OFFICER ?? "(개인정보보호책임자 미설정)",
    customerEmail:    process.env.NEXT_PUBLIC_BIZ_EMAIL        ?? "support@baljuup.co.kr",
    customerPhone:    process.env.NEXT_PUBLIC_BIZ_PHONE        ?? "(고객센터 번호 미설정)",
    hosting:          process.env.NEXT_PUBLIC_BIZ_HOSTING      ?? "Vercel Inc.",
  };
}
