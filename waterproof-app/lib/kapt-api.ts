/**
 * 공공데이터포털(K-apt) API 클라이언트
 *
 * 발급:  https://www.data.go.kr
 * 키워드: "공동주택 단지", "유지관리이력", "입찰공고", "장기수선충당금"
 *
 * 사용하는 4개 API:
 *   1) 공동주택 단지 목록   (AptListService2)        → 준공연도·세대수·주소
 *   2) 유지관리 이력         (AptMgmtSvc3)            → 방수 공사 이력 (핵심)
 *   3) 입찰공고             (AptBidInfoService)       → 현재 발주 중인 단지
 *   4) 장기수선충당금        (AptMgmtSvc3)            → 예산 잔액
 *
 * 모든 함수는:
 *  - 최대 3회 자동 재시도 (지수 백오프)
 *  - 표준 ApiResult<T> 로 래핑된 결과 반환
 *  - API 키는 환경변수 DATA_GO_KR_KEY 에서 읽음
 */

const API_KEY = process.env.DATA_GO_KR_KEY!;
// 공공데이터포털 "국토교통부_공동주택 단지 목록제공 서비스" 의 공식 엔드포인트
// 서비스명: AptListService3 (V3) — V2 와 V3 둘 다 존재했으나 현재 V3 만 활성
// HTTPS 만 지원 (HTTP 는 500 반환)
const BASE_URL = process.env.KAPT_BASE_URL || 'https://apis.data.go.kr/1613000';

if (!API_KEY) {
  // 실행 시에만 에러 발생 — 빌드 단계에서 환경변수가 없는 경우를 허용
  // throw new Error('DATA_GO_KR_KEY 환경변수가 설정되지 않았습니다.');
}

// ============================================================
// 방수 키워드 (유지관리 이력 분류용)
// ============================================================
export const WATERPROOF_KEYWORDS = [
  '방수', '우레탄', '도막', '실링', '코킹', '옥상방수', '외벽방수', '지하방수', '시트방수'
];

export function isWaterproofWork(workType: string | undefined | null): boolean {
  if (!workType) return false;
  return WATERPROOF_KEYWORDS.some((kw) => workType.includes(kw));
}

// ============================================================
// 시도 코드 (sidoCode)
// ============================================================
export const SIDO_CODES = {
  서울: '11',
  부산: '26',
  대구: '27',
  인천: '28',
  광주: '29',
  대전: '30',
  울산: '31',
  세종: '36',
  경기: '41',
  강원: '42',
  충북: '43',
  충남: '44',
  전북: '45',
  전남: '46',
  경북: '47',
  경남: '48',
  제주: '50',
} as const;

export type SidoCode = typeof SIDO_CODES[keyof typeof SIDO_CODES];

// ============================================================
// 공통 타입
// ============================================================
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; retryable: boolean };

export interface ComplexRaw {
  kaptCode: string;
  kaptName: string;
  kaptAddr?: string;
  bjdCode?: string;     // 법정동 코드
  doroJuso?: string;    // 도로명 주소
  kaptUsedate?: string; // 사용승인일 'YYYYMMDD'
  kaptDongCnt?: string | number; // 동 수
  kaptdaCnt?: string | number;   // 세대 수
  codeMgr?: string;     // 자치 / 위탁
  kaptTel?: string;     // 관리사무소 전화
  kaptMgrCnt?: string;
  [k: string]: unknown;
}

export interface MaintenanceHistoryRaw {
  workType?: string;
  workYear?: string | number;
  workAmount?: string | number;
  is_waterproof?: boolean;
  [k: string]: unknown;
}

export interface BidAnnouncementRaw {
  bidNo?: string;
  bidTitle?: string;
  bidWorkType?: string;
  bidAmount?: string | number;
  noticeDate?: string;
  closeDate?: string;
  status?: string;
  [k: string]: unknown;
}

export interface MaintenanceFundRaw {
  yearMonth?: string;    // 'YYYY-MM'
  fundBalance?: string | number;
  monthlyAmount?: string | number;
  [k: string]: unknown;
}

// ============================================================
// 저수준 fetch 헬퍼 — 재시도 + 타임아웃 + 명확한 에러 메시지
// ============================================================
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1_500;
const REQUEST_TIMEOUT_MS = 15_000;

async function fetchWithRetry<T>(
  url: string,
  attempt = 1
): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      const retryable = res.status >= 500 || res.status === 429;
      // 디버깅: 응답 본문 일부 + 호출한 URL(키 마스킹) 도 같이 반환
      const body = await res.text().catch(() => '');
      const maskedUrl = url.replace(/serviceKey=[^&]+/, 'serviceKey=***');
      const detail = body ? ` body=${body.slice(0, 200).replace(/\s+/g, ' ')}` : '';
      if (retryable && attempt < MAX_RETRIES) {
        await sleep(RETRY_BASE_DELAY_MS * attempt);
        return fetchWithRetry<T>(url, attempt + 1);
      }
      return {
        ok: false,
        error: `HTTP ${res.status} url=${maskedUrl}${detail}`,
        retryable,
      };
    }

    const text = await res.text();
    // 공공 API 가 가끔 XML 에러를 JSON 자리에 반환 — 안전하게 파싱
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return {
        ok: false,
        error: `JSON 파싱 실패 (응답 앞부분: ${text.slice(0, 120)})`,
        retryable: false,
      };
    }

    // 공공 API 표준 에러 코드
    const resultCode = data?.response?.header?.resultCode;
    if (resultCode && resultCode !== '00') {
      const msg = data?.response?.header?.resultMsg || 'unknown';
      return {
        ok: false,
        error: `API ${resultCode}: ${msg}`,
        retryable: resultCode === '22' || resultCode === '23', // 호출초과/일시오류만 재시도
      };
    }

    return { ok: true, data: data as T };
  } catch (err: any) {
    clearTimeout(timer);
    const retryable = err?.name === 'AbortError' || /network|fetch/i.test(String(err?.message));
    if (retryable && attempt < MAX_RETRIES) {
      await sleep(RETRY_BASE_DELAY_MS * attempt);
      return fetchWithRetry<T>(url, attempt + 1);
    }
    return {
      ok: false,
      error: String(err?.message || err),
      retryable,
    };
  }
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function buildUrl(path: string, params: Record<string, string | number>): string {
  const qs = new URLSearchParams({
    serviceKey: API_KEY,
    _type: 'json',
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
  });
  return `${BASE_URL}${path}?${qs.toString()}`;
}

function extractItems<T>(data: any): T[] {
  // 공공데이터포털 API 응답 구조 — V2 / V3 가 다르게 줌:
  //   V2: response.body.items.item (단일 항목 시 객체, 다중 시 배열)
  //   V3: response.body.items       (직접 배열) — V3 부터 표준화
  //   일부: response.body.item       (드물게)
  const body = data?.response?.body;
  if (!body) return [];

  const candidates = [body.items?.item, body.items, body.item];
  for (const c of candidates) {
    if (c == null) continue;
    if (Array.isArray(c)) return c as T[];
    if (typeof c === 'object') return [c as T];
  }
  return [];
}

// ============================================================
// API 1. 공동주택 단지 목록 (시도/시군구별 페이지네이션)
// ============================================================
export async function fetchComplexList(
  sidoCode: string,
  page = 1,
  numOfRows = 999  // K-apt API 최대 999
): Promise<ApiResult<ComplexRaw[]>> {
  // 국토교통부_공동주택 단지 목록제공 서비스 (data.go.kr 데이터 ID 15057332)
  // 공식 엔드포인트: /AptListService3/getSidoAptList3
  //   - 서비스 V2 는 폐기, V3 만 사용 가능
  //   - 메서드명 끝에 숫자 "3" 필수 (getSidoAptList ≠ getSidoAptList3)
  const url = buildUrl('/AptListService3/getSidoAptList3', {
    sidoCode,
    pageNo: page,
    numOfRows,
  });
  const res = await fetchWithRetry<any>(url);
  if (!res.ok) return res;

  const items = extractItems<ComplexRaw>(res.data);
  // 디버그: 첫 페이지에 0건이면 응답 구조를 콘솔에 노출 (다음 push 시 제거)
  if (page === 1 && items.length === 0) {
    const preview = JSON.stringify(res.data).slice(0, 500);
    console.warn(`[DEBUG] 시도 ${sidoCode} page 1 응답에서 items 못 찾음. 응답 앞 500자:`);
    console.warn(preview);
  }
  return { ok: true, data: items };
}

/**
 * 특정 시도(예: 서울 11)의 전체 단지를 페이지네이션으로 모두 수집.
 * onPage 콜백으로 진행 상황 보고.
 */
export async function fetchAllComplexes(
  sidoCode: string,
  opts: {
    pageSize?: number;
    onPage?: (info: { page: number; count: number; cumulative: number }) => void;
    maxPages?: number;
  } = {}
): Promise<ApiResult<ComplexRaw[]>> {
  // K-apt API 최대 numOfRows = 999. 1000 이상 전달 시 API 가 HTTP 500 "Unexpected errors" 반환.
  const pageSize = Math.min(opts.pageSize ?? 999, 999);
  const maxPages = opts.maxPages ?? 100;
  const all: ComplexRaw[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const res = await fetchComplexList(sidoCode, page, pageSize);
    if (!res.ok) return res;
    if (res.data.length === 0) break;

    all.push(...res.data);
    opts.onPage?.({ page, count: res.data.length, cumulative: all.length });

    if (res.data.length < pageSize) break; // 마지막 페이지
    await sleep(300); // API 부하 완화
  }

  return { ok: true, data: all };
}

// ============================================================
// API 2. 유지관리 이력 (특정 단지)
// ============================================================
export async function fetchMaintenanceHistory(
  kaptCode: string
): Promise<ApiResult<MaintenanceHistoryRaw[]>> {
  const url = buildUrl('/AptMgmtSvc3/getAptMaintHist', { kaptCode });
  const res = await fetchWithRetry<any>(url);
  if (!res.ok) return res;

  const items = extractItems<MaintenanceHistoryRaw>(res.data).map((item) => ({
    ...item,
    is_waterproof: isWaterproofWork(String(item.workType ?? '')),
  }));

  return { ok: true, data: items };
}

// ============================================================
// API 3. 입찰공고 (특정 단지)
// ============================================================
export async function fetchBidAnnouncements(
  kaptCode: string
): Promise<ApiResult<BidAnnouncementRaw[]>> {
  const url = buildUrl('/AptBidInfoService/getAptBidInfo', { kaptCode });
  const res = await fetchWithRetry<any>(url);
  if (!res.ok) return res;
  return { ok: true, data: extractItems<BidAnnouncementRaw>(res.data) };
}

// ============================================================
// API 4. 장기수선충당금 잔액 (특정 단지, 최근 연월)
// ============================================================
export async function fetchMaintenanceFund(
  kaptCode: string
): Promise<ApiResult<MaintenanceFundRaw[]>> {
  const url = buildUrl('/AptMgmtSvc3/getAptLongMaintFund', { kaptCode });
  const res = await fetchWithRetry<any>(url);
  if (!res.ok) return res;
  return { ok: true, data: extractItems<MaintenanceFundRaw>(res.data) };
}

// ============================================================
// 정규화 헬퍼 — Raw → Supabase row
// ============================================================
export function normalizeComplex(raw: ComplexRaw): {
  kapt_code: string;
  name: string;
  address: string | null;
  sido: string | null;
  sigungu: string | null;
  built_year: number | null;
  households: number | null;
  buildings: number | null;
  management_type: string | null;
  phone: string | null;
} {
  // 사용승인일 'YYYYMMDD' → 연도 추출
  const useDate = String(raw.kaptUsedate ?? '');
  const builtYear = useDate.length >= 4 ? parseInt(useDate.slice(0, 4), 10) : null;

  // 시도/시군구 분리 (주소 첫 2단계)
  const addr = String(raw.kaptAddr ?? raw.doroJuso ?? '').trim();
  const parts = addr.split(/\s+/);
  const sido = parts[0] || null;
  const sigungu = parts[1] || null;

  return {
    kapt_code: String(raw.kaptCode),
    name: String(raw.kaptName ?? '').trim(),
    address: addr || null,
    sido,
    sigungu,
    built_year: Number.isFinite(builtYear as number) ? (builtYear as number) : null,
    households: toIntOrNull(raw.kaptdaCnt),
    buildings: toIntOrNull(raw.kaptDongCnt),
    management_type: raw.codeMgr ? String(raw.codeMgr) : null,
    phone: raw.kaptTel ? String(raw.kaptTel) : null,
  };
}

function toIntOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}
