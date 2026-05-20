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
  '방수', '우레탄', '도막', '실링', '코킹',
  '옥상방수', '외벽방수', '지하방수', '시트방수', '복합방수',
  '수밀', '누수', '옥상', '지붕'
];

export function isWaterproofWork(workType: string | undefined | null): boolean {
  if (!workType) return false;
  const s = String(workType);
  return WATERPROOF_KEYWORDS.some((kw) => s.includes(kw));
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
  // 정규화된 표준 필드 (fetchMaintenanceHistory 가 채움)
  workType?: string | null;            // 공종 분류 텍스트 — subject + parentName + parentParentName 합성
  workYear?: string | number | null;   // 시공 연도 (YYYY 숫자)
  workAmount?: string | number | null;
  is_waterproof?: boolean;

  // K-apt API 원본 필드 (참고용 — 응답 raw 키)
  subject?: string;             // 공사 제목 ("방수공사", "부분수리")
  parentName?: string;          // 중분류
  parentParentName?: string;    // 대분류
  mnthEtime?: string;           // 시공일 'YYYY-MM-DD'
  costType?: string;            // 비용 유형 ('장기수선충당금' 등)

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

// 수의계약 공지 — data.go.kr ID 15057758
//   "국토교통부_공동주택 수의계약 공지 정보제공 서비스"
//   입찰 없이 특정 업체와 직접 계약하는 방식. 소규모 방수공사가 많아 영업 가치 큼.
export interface NegotiatedContractRaw {
  ntceNo?: string;                    // 공지번호 (announcement_no)
  ntceTitle?: string;                 // 공지 제목
  workType?: string;                  // 공종
  contractAmount?: string | number;   // 계약금액
  ntceDate?: string;                  // 공지일
  contractDate?: string;              // 계약일
  status?: string;                    // 'active' | 'closed'
  kaptCode?: string;                  // 단지 코드 (날짜 범위 검색 시 응답에 포함)
  [k: string]: unknown;
}

export interface MaintenanceFundRaw {
  yearMonth?: string | null;    // 'YYYY-MM'
  fundBalance?: string | number | null;
  monthlyAmount?: string | number | null;
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
// API 2. 유지관리 이력 (특정 단지) — V2 엔드포인트
// 공동주택 유지관리 이력 정보제공 서비스 (ApHusMntMngHistInfoOfferServiceV2)
// 메서드: getBuldExtrlMntncHistInfoSearchV2 (건물 외부 유지이력 — 방수/도장/외벽)
// ============================================================
export async function fetchMaintenanceHistory(
  kaptCode: string
): Promise<ApiResult<MaintenanceHistoryRaw[]>> {
  const url = buildUrl(
    '/ApHusMntMngHistInfoOfferServiceV2/getBuldExtrlMntncHistInfoSearchV2',
    { kaptCode },
  );
  const res = await fetchWithRetry<any>(url);
  if (!res.ok) return res;

  // 실제 K-apt V2 응답 raw 키 (진단으로 확인):
  //   { costType, parentParentName, parentName, subject, year, mnthEtime, useYear, useDate, ... }
  // 다른 endpoint/버전 대비 추가 alias 도 시도.
  const items = extractItems<Record<string, unknown>>(res.data).map((raw) => {
    // workType — 분류 키워드 매칭용. 실제 응답은 subject/parentName/parentParentName 셋이 분류 정보.
    // alias 우선순위: 명시적 workType > 합성(parentParentName+parentName+subject) > 기타 alias
    const explicitType = pickStr(raw, 'workType', 'wrkType', 'cdName', 'wrkSj', 'repairCntnts', 'repairSj', 'codeName', 'workNm');
    const composedParts = [
      pickStr(raw, 'parentParentName'),
      pickStr(raw, 'parentName'),
      pickStr(raw, 'subject'),
    ].filter((s): s is string => !!s && s !== '기타');
    const composedType = composedParts.length > 0 ? composedParts.join(' ') : null;
    const workType = explicitType ?? composedType
      ?? pickStr(raw, 'subject', 'parentName', 'parentParentName');

    // workYear — 'mnthEtime' (YYYY-MM-DD) 가 실제 응답의 시공일. 그 외 alias 도 시도.
    const dateStr = pickStr(raw, 'mnthEtime', 'cntrctYmd', 'wrkYmd', 'completeDate', 'cntrctEnd');
    const yearFromDate = dateStr && /^\d{4}/.test(dateStr) ? Number(dateStr.slice(0, 4)) : NaN;
    const workYear =
      (Number.isFinite(yearFromDate) && yearFromDate > 1900 ? yearFromDate : null)
      ?? pickIntFromAny(raw, 'workYear', 'wrkYear', 'repairYr', 'repairYear', 'yr');
    // 응답의 'year' 필드는 0이 많아 후순위로
    const workYearFinal = workYear ?? pickIntFromAny(raw, 'year');

    const workAmount =
      pickIntFromAny(raw, 'workAmount', 'wrkAmount', 'contractAmount', 'ctrtAmt', 'amount', 'wrkAmt');

    const item: MaintenanceHistoryRaw = {
      ...raw,
      workType: workType ?? null,
      workYear: workYearFinal ?? null,
      workAmount: workAmount ?? null,
      is_waterproof: isWaterproofWork(workType ?? ''),
    };
    return item;
  });

  return { ok: true, data: items };
}

// ============================================================
// 다중 필드명 매핑 헬퍼 — 공공 API 응답의 short alias 대응
// ============================================================
function pickStr(obj: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (v != null && String(v).trim().length > 0) return String(v).trim();
  }
  return null;
}

function pickIntFromAny(obj: Record<string, unknown>, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = obj[k];
    if (v == null) continue;
    // 정수 그대로
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) {
      // 'YYYYMMDD' 같은 8자리 날짜면 연도만
      if (n > 1_000_0000_0) {
        const s = String(n);
        if (s.length === 8) return parseInt(s.slice(0, 4), 10);
      }
      return n;
    }
    // 문자열 'YYYY-MM-DD' 또는 'YYYYMMDD' → 연도
    const s = String(v).trim();
    const m = s.match(/^(\d{4})/);
    if (m) {
      const y = parseInt(m[1], 10);
      if (Number.isFinite(y) && y > 1900 && y < 2100) return y;
    }
  }
  return null;
}

// ============================================================
// API 3-A. 입찰공고 — 단지 코드별 조회
// 국토교통부_공동주택 입찰공고 정보제공 서비스
// data.go.kr ID: 15058166
// 엔드포인트: /ApHusBidPblancInfoService/getAphusBidPblancListInfoSearch
//
// ⚠️  data.go.kr 에서 반드시 별도 신청 필요:
//   1) https://www.data.go.kr/data/15058166/openapi.do 접속
//   2) "활용신청" → 즉시 자동 승인
//   3) 마이페이지 → 개발계정 → End Point 확인 (동일 serviceKey 사용 가능)
// ============================================================
export async function fetchBidAnnouncements(
  kaptCode: string,
  opts: { pageNo?: number; numOfRows?: number } = {}
): Promise<ApiResult<BidAnnouncementRaw[]>> {
  const url = buildUrl(
    '/ApHusBidPblancInfoService/getAphusBidPblancListInfoSearch',
    {
      kaptCode,
      pageNo: opts.pageNo ?? 1,
      numOfRows: opts.numOfRows ?? 100,
    }
  );
  const res = await fetchWithRetry<any>(url);
  if (!res.ok) return res;

  const items = extractItems<Record<string, unknown>>(res.data).map((raw) => {
    const item: BidAnnouncementRaw = {
      ...raw,
      // 공식 응답 필드명 정규화 (Swagger 확인 후 조정 가능)
      bidNo:       pickStr(raw, 'bidNo', 'bddprNo', 'pbancNo') ?? undefined,
      bidTitle:    pickStr(raw, 'bidTitle', 'pbancNm', 'bidNm', 'subject') ?? undefined,
      bidWorkType: pickStr(raw, 'bidWorkType', 'bidWorkTy', 'workType', 'cnstrtnNm') ?? undefined,
      bidAmount:   pickIntFromAny(raw, 'bidAmount', 'estimatedAmt', 'presmptAmt', 'amount') ?? undefined,
      noticeDate:  pickStr(raw, 'noticeDate', 'pbancBgn', 'bidBeginDt', 'registDt') ?? undefined,
      closeDate:   pickStr(raw, 'closeDate', 'pbancEnd', 'bidCloseDt', 'deadline') ?? undefined,
      status:      pickStr(raw, 'status', 'pbancSttus', 'bidSttus') ?? 'active',
    };
    return item;
  });

  return { ok: true, data: items };
}

// ============================================================
// API 3-B. 입찰공고 — 날짜 범위 전체 조회 (수집 스크립트용)
// 단지별 순회 없이 기간으로 한 번에 가져오는 방식
// ============================================================
export async function fetchBidsByDateRange(opts: {
  startYmd: string;   // 'YYYYMMDD'
  endYmd: string;     // 'YYYYMMDD'
  sidoCode?: string;
  pageNo?: number;
  numOfRows?: number;
}): Promise<ApiResult<BidAnnouncementRaw[]>> {
  const params: Record<string, string | number> = {
    searchStartYmd: opts.startYmd,
    searchEndYmd:   opts.endYmd,
    pageNo:         opts.pageNo ?? 1,
    numOfRows:      opts.numOfRows ?? 999,
  };
  if (opts.sidoCode) params.sidoCode = opts.sidoCode;

  const url = buildUrl(
    '/ApHusBidPblancInfoService/getAphusBidPblancDateListInfoSearch',
    params
  );
  const res = await fetchWithRetry<any>(url);
  if (!res.ok) return res;

  const items = extractItems<Record<string, unknown>>(res.data).map((raw) => ({
    ...raw,
    bidNo:       pickStr(raw, 'bidNo', 'bddprNo', 'pbancNo') ?? undefined,
    bidTitle:    pickStr(raw, 'bidTitle', 'pbancNm', 'bidNm', 'subject') ?? undefined,
    bidWorkType: pickStr(raw, 'bidWorkType', 'bidWorkTy', 'workType', 'cnstrtnNm') ?? undefined,
    bidAmount:   pickIntFromAny(raw, 'bidAmount', 'estimatedAmt', 'presmptAmt', 'amount') ?? undefined,
    noticeDate:  pickStr(raw, 'noticeDate', 'pbancBgn', 'bidBeginDt', 'registDt') ?? undefined,
    closeDate:   pickStr(raw, 'closeDate', 'pbancEnd', 'bidCloseDt', 'deadline') ?? undefined,
    status:      pickStr(raw, 'status', 'pbancSttus', 'bidSttus') ?? 'active',
    // 날짜 범위 검색은 kaptCode 가 응답에 포함됨
    kaptCode:    pickStr(raw, 'kaptCode', 'kaptCd') ?? undefined,
  } as BidAnnouncementRaw));

  return { ok: true, data: items };
}

// ============================================================
// API 3-C. 수의계약 공지 — 단지 코드별 조회
// 국토교통부_공동주택 수의계약 공지 정보제공 서비스
// data.go.kr ID: 15057758
// 서비스/메서드명은 입찰공고와 동일한 명명 규칙으로 추정:
//   /ApHusSdmCntrctNtcInfoOfferService/getAphusSdmCntrctNtcListInfoSearch
// 정확한 명칭은 Swagger 확인 후 환경변수로 override 가능:
//   KAPT_SDM_SERVICE_NAME    (기본 ApHusSdmCntrctNtcInfoOfferService)
//   KAPT_SDM_LIST_METHOD     (기본 getAphusSdmCntrctNtcListInfoSearch)
//   KAPT_SDM_DATE_METHOD     (기본 getAphusSdmCntrctNtcDateListInfoSearch)
//
// ⚠️  data.go.kr 에서 별도 활용신청 필요:
//   https://www.data.go.kr/data/15057758/openapi.do
// ============================================================
const SDM_SERVICE = process.env.KAPT_SDM_SERVICE_NAME || 'ApHusSdmCntrctNtcInfoOfferService';
const SDM_LIST_METHOD = process.env.KAPT_SDM_LIST_METHOD || 'getAphusSdmCntrctNtcListInfoSearch';
const SDM_DATE_METHOD = process.env.KAPT_SDM_DATE_METHOD || 'getAphusSdmCntrctNtcDateListInfoSearch';

export async function fetchNegotiatedContracts(
  kaptCode: string,
  opts: { pageNo?: number; numOfRows?: number } = {}
): Promise<ApiResult<NegotiatedContractRaw[]>> {
  const url = buildUrl(
    `/${SDM_SERVICE}/${SDM_LIST_METHOD}`,
    {
      kaptCode,
      pageNo: opts.pageNo ?? 1,
      numOfRows: opts.numOfRows ?? 100,
    }
  );
  const res = await fetchWithRetry<any>(url);
  if (!res.ok) return res;

  const items = extractItems<Record<string, unknown>>(res.data).map((raw) => {
    const item: NegotiatedContractRaw = {
      ...raw,
      ntceNo:         pickStr(raw, 'ntceNo', 'pbancNo', 'cntrctNo', 'noticeNo') ?? undefined,
      ntceTitle:      pickStr(raw, 'ntceTitle', 'pbancNm', 'ntceNm', 'subject', 'title') ?? undefined,
      workType:       pickStr(raw, 'workType', 'bidWorkType', 'cnstrtnNm', 'wrkType') ?? undefined,
      contractAmount: pickIntFromAny(raw, 'contractAmount', 'cntrctAmt', 'ctrtAmt', 'amount', 'presmptAmt') ?? undefined,
      ntceDate:       pickStr(raw, 'ntceDate', 'pbancBgn', 'noticeDate', 'registDt') ?? undefined,
      contractDate:   pickStr(raw, 'contractDate', 'cntrctYmd', 'ctrtYmd', 'ctrtDt') ?? undefined,
      status:         pickStr(raw, 'status', 'pbancSttus', 'cntrctSttus') ?? 'active',
    };
    return item;
  });

  return { ok: true, data: items };
}

// 수의계약 공지 — 날짜 범위 전체 조회 (수집 스크립트용)
export async function fetchNegotiatedByDateRange(opts: {
  startYmd: string;   // 'YYYYMMDD'
  endYmd: string;     // 'YYYYMMDD'
  sidoCode?: string;
  pageNo?: number;
  numOfRows?: number;
}): Promise<ApiResult<NegotiatedContractRaw[]>> {
  const params: Record<string, string | number> = {
    searchStartYmd: opts.startYmd,
    searchEndYmd:   opts.endYmd,
    pageNo:         opts.pageNo ?? 1,
    numOfRows:      opts.numOfRows ?? 999,
  };
  if (opts.sidoCode) params.sidoCode = opts.sidoCode;

  const url = buildUrl(`/${SDM_SERVICE}/${SDM_DATE_METHOD}`, params);
  const res = await fetchWithRetry<any>(url);
  if (!res.ok) return res;

  const items = extractItems<Record<string, unknown>>(res.data).map((raw) => ({
    ...raw,
    ntceNo:         pickStr(raw, 'ntceNo', 'pbancNo', 'cntrctNo', 'noticeNo') ?? undefined,
    ntceTitle:      pickStr(raw, 'ntceTitle', 'pbancNm', 'ntceNm', 'subject', 'title') ?? undefined,
    workType:       pickStr(raw, 'workType', 'bidWorkType', 'cnstrtnNm', 'wrkType') ?? undefined,
    contractAmount: pickIntFromAny(raw, 'contractAmount', 'cntrctAmt', 'ctrtAmt', 'amount', 'presmptAmt') ?? undefined,
    ntceDate:       pickStr(raw, 'ntceDate', 'pbancBgn', 'noticeDate', 'registDt') ?? undefined,
    contractDate:   pickStr(raw, 'contractDate', 'cntrctYmd', 'ctrtYmd', 'ctrtDt') ?? undefined,
    status:         pickStr(raw, 'status', 'pbancSttus', 'cntrctSttus') ?? 'active',
    // 날짜 범위 조회는 응답에 kaptCode 포함됨
    kaptCode:       pickStr(raw, 'kaptCode', 'kaptCd') ?? undefined,
  } as NegotiatedContractRaw));

  return { ok: true, data: items };
}

// ============================================================
// API 4. 장기수선충당금 잔액 (특정 단지) — V2 엔드포인트
// 공동주택관리 서비스" — 관련 API 없는 경우 빈 배열 반환
export async function fetchMaintenanceFund(
  kaptCode: string
): Promise<ApiResult<MaintenanceFundRaw[]>> {
  // K-apt 공식 API: 장기수선충당금 잔액 정보
  const url = buildUrl('/ApHusLtrmRprFundService/getApHusLtrmRprFundList', {
    kaptCode,
    pageNo: 1,
    numOfRows: 12,  // 최근 12개월
  });
  const res = await fetchWithRetry<any>(url);
  if (!res.ok) return res;

  const items = extractItems<Record<string, unknown>>(res.data).map((raw) => ({
    yearMonth:     pickStr(raw, 'yearMonth', 'mngMt', 'ym') ?? null,
    fundBalance:   pickIntFromAny(raw, 'fundBalance', 'ltrmRprAmt', 'blncAmt') ?? null,
    monthlyAmount: pickIntFromAny(raw, 'monthlyAmount', 'monthlyAmt', 'mnthlyChrg') ?? null,
    ...raw,
  } as MaintenanceFundRaw));

  return { ok: true, data: items };
}

// ============================================================
// API 5. 단지 기본정보 (특정 단지) — 준공연도 보완용
// ============================================================
export async function fetchComplexBasicInfo(
  kaptCode: string
): Promise<ApiResult<ComplexRaw>> {
  const url = buildUrl('/ApHusKaptInfoService/getAphusBassInfoSearch', {
    kaptCode,
  });
  const res = await fetchWithRetry<any>(url);
  if (!res.ok) return res;

  const items = extractItems<Record<string, unknown>>(res.data);
  if (items.length === 0) {
    return { ok: false, error: '단지 기본정보 없음', retryable: false };
  }
  const raw = items[0];
  return {
    ok: true,
    data: {
      kaptCode: String(raw.kaptCode ?? raw.kaptCd ?? kaptCode),
      kaptName: String(raw.kaptName ?? raw.kaptNm ?? ''),
      kaptAddr: pickStr(raw, 'kaptAddr', 'bjdongAddr', 'rdnmaAddr') ?? undefined,
      kaptUsedate: pickStr(raw, 'kaptUsedate', 'useAprvYmd', 'useAprDay') ?? undefined,
      kaptDongCnt: raw.kaptDongCnt ?? raw.dongCnt ?? undefined,
      kaptdaCnt:   raw.kaptdaCnt ?? raw.hhldCnt ?? undefined,
      codeMgr:     pickStr(raw, 'codeMgr', 'mgrType', 'mgrSe') ?? undefined,
      kaptTel:     pickStr(raw, 'kaptTel', 'mgrOfcTelNo', 'tel') ?? undefined,
      ...raw,
    } as ComplexRaw,
  };
}

// ============================================================
// normalizeComplex — ComplexRaw → 표준 DB row 형태
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
  const builtYearRaw = raw.kaptUsedate ?? '';
  let built_year: number | null = null;
  if (typeof builtYearRaw === 'string' && builtYearRaw.length >= 4) {
    const y = parseInt(builtYearRaw.slice(0, 4), 10);
    if (y > 1950 && y <= new Date().getFullYear()) built_year = y;
  }

  const addr = raw.doroJuso ?? raw.kaptAddr ?? null;
  let sido: string | null = null;
  let sigungu: string | null = null;
  if (addr) {
    const parts = addr.split(' ');
    sido    = parts[0] ?? null;
    sigungu = parts[1] ?? null;
  }

  return {
    kapt_code:       raw.kaptCode,
    name:            raw.kaptName,
    address:         typeof addr === 'string' ? addr : null,
    sido,
    sigungu,
    built_year,
    households:      typeof raw.kaptdaCnt !== 'undefined' ? Number(raw.kaptdaCnt) || null : null,
    buildings:       typeof raw.kaptDongCnt !== 'undefined' ? Number(raw.kaptDongCnt) || null : null,
    management_type: raw.codeMgr ? String(raw.codeMgr) : null,
    phone:           raw.kaptTel ? String(raw.kaptTel) : null,
  };
}
