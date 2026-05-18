/**
 * 토스페이먼츠 — 정기결제(빌링) API 클라이언트
 *
 *  - issueBillingKey:  authKey -> billingKey 교환 (구독 시작 시)
 *  - chargeBillingKey: 정기 결제 실행 (월 1회)
 *  - getBillingKeyInfo: 카드 정보 조회 (마스킹된 번호 등)
 *
 * 시크릿 키 인증: HTTP Basic (Base64("{TOSS_SECRET_KEY}:") )
 */

// Buffer는 Node.js 글로벌이므로 별도 import 불필요.
// (`node:buffer` 명시적 import는 webpack 클라이언트 번들에서 UnhandledSchemeError 발생)

const TOSS_BASE = 'https://api.tosspayments.com';
const SECRET = process.env.TOSS_SECRET_KEY;

function authHeader(): string {
  if (!SECRET) throw new Error('TOSS_SECRET_KEY 환경변수가 없습니다.');
  const b64 = Buffer.from(SECRET + ':').toString('base64');
  return 'Basic ' + b64;
}

export type TossResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; code: string; message: string };

async function callToss<T>(
  method: 'POST' | 'GET',
  path: string,
  body?: unknown
): Promise<TossResult<T>> {
  try {
    const res = await fetch(`${TOSS_BASE}${path}`, {
      method,
      headers: {
        Authorization: authHeader(),
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        code: json?.code ?? 'UNKNOWN',
        message: json?.message ?? `HTTP ${res.status}`,
      };
    }

    return { ok: true, data: json as T };
  } catch (e) {
    const err = e as Error;
    return {
      ok: false,
      status: 0,
      code: 'NETWORK',
      message: err?.message ?? 'unknown',
    };
  }
}

// ============================================================
// 1) 빌링키 발급 — 구독 시작 시
// ============================================================
export interface IssuedBillingKey {
  billingKey: string;
  customerKey: string;
  authenticatedAt: string;
  method: string;                // '카드'
  card: {
    company: string;             // '신한'
    number: string;              // '1234********5678'
    cardType: string;            // '신용'/'체크'
    ownerType: string;
  };
}

export async function issueBillingKey(input: {
  authKey: string;
  customerKey: string;
}): Promise<TossResult<IssuedBillingKey>> {
  return callToss<IssuedBillingKey>('POST', '/v1/billing/authorizations/issue', input);
}

// ============================================================
// 2) 정기결제 — 빌링키로 카드 결제 실행
// ============================================================
export interface ChargePayload {
  customerKey: string;
  amount: number;             // 원 단위 (예: 125000)
  orderId: string;            // 유니크해야 함 (예: sub-{userId}-{YYYYMM})
  orderName: string;          // 예: '발주Up 프로 5월'
  customerEmail?: string;
  customerName?: string;
}

export interface PaymentResponse {
  paymentKey: string;
  orderId: string;
  status: string;              // 'DONE' 이면 성공
  approvedAt: string;
  totalAmount: number;
  method: string;
  card?: { company: string; number: string };
}

export async function chargeBillingKey(
  billingKey: string,
  payload: ChargePayload
): Promise<TossResult<PaymentResponse>> {
  return callToss<PaymentResponse>('POST', `/v1/billing/${billingKey}`, payload);
}

// ============================================================
// 3) 빌링키 정보 조회 (저장된 카드 정보 표시용)
// ============================================================
export async function getBillingKeyInfo(billingKey: string): Promise<TossResult<IssuedBillingKey>> {
  return callToss<IssuedBillingKey>('GET', `/v1/billing/${billingKey}`);
}

// ============================================================
// 헬퍼: orderId 생성 (월별 유니크)
// ============================================================
export function buildMonthlyOrderId(userId: string, date = new Date()): string {
  const ym = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
  return `sub-${userId.replace(/-/g, '').slice(0, 12)}-${ym}`;
}

// ============================================================
// 플랜 정의
// ============================================================
export const PLANS = {
  starter: { code: 'starter', name: '스타터', amount: 99_000,  description: '서울 단지 + AI 제안서 무제한' },
  pro:     { code: 'pro',     name: '프로',   amount: 125_000, description: '수도권 전체 + 알림톡 + 1:1 온보딩' },
  enterprise: { code: 'enterprise', name: '엔터프라이즈', amount: 600_000, description: '전국 + 멀티공정 + 전담 CS' },
} as const;

export type PlanCode = keyof typeof PLANS;
