/**
 * 발주Up — 랜딩페이지 사전 신청 백엔드 (Google Apps Script)
 *
 * 역할:
 *   landing_page.html 의 폼 제출(POST)을 받아 Google Sheets에 기록한다.
 *   히어로 폼(지역 선택 포함)과 하단 폼(지역 없음) 모두 한 시트로 통합 수집.
 *
 * 배포 가이드:
 *   GAS_SETUP.md 파일 참고. 핵심 단계 요약:
 *     1) https://script.google.com 에서 새 프로젝트 생성
 *     2) 이 파일 전체를 코드 에디터에 붙여넣기
 *     3) 아래 SPREADSHEET_ID 를 본인의 Google Sheets ID로 교체
 *     4) "배포 > 새 배포" → 유형: 웹앱, 액세스: 모든 사용자
 *     5) 발급된 /exec URL을 landing_page.html 의 GAS_ENDPOINT 에 붙여넣기
 */

// ──────────────────────────────────────────────────────────
// 설정 — 본인 환경에 맞춰 수정
// ──────────────────────────────────────────────────────────
const SPREADSHEET_ID = 'REPLACE_WITH_YOUR_SHEET_ID';   // Sheets URL의 /d/ 와 /edit 사이 문자열
const SHEET_NAME     = '신청자';                         // 데이터가 쌓일 시트 이름 (없으면 자동 생성)

const HEADERS = [
  'submittedAt',  // ISO 8601 (UTC)
  'submittedKST', // 한국 시간으로 변환된 보기 좋은 포맷
  'form',         // 'hero' | 'bottom' | 'landing_v2' (어느 폼에서 왔는지)
  'source',       // 'landing_v1' | 'landing_v2' | 'kakao' | 'naver' 등 유입원
  'company',      // 사업체명 (선택)
  'phone',        // 숫자만 (예: 01012345678)
  'phoneRaw',     // 원본 입력값 (예: 010-1234-5678)
  'region',       // 활동 지역 (선택)
  'utm_source',   // UTM 마케팅 추적
  'utm_medium',
  'utm_campaign',
  'userAgent',    // 디바이스/브라우저
  'referrer',     // 유입 경로
  'path'          // 랜딩 경로 + 쿼리스트링
];

// 슈퍼 얼리버드 / 얼리버드 정원 (자동 마감 안내 용도)
const SUPER_EARLYBIRD_LIMIT = 10;
const EARLYBIRD_LIMIT       = 100;

// ──────────────────────────────────────────────────────────
// POST 핸들러 — 폼 제출 수신
// ──────────────────────────────────────────────────────────
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ ok: false, error: 'no post body' });
    }

    const data = JSON.parse(e.postData.contents);

    // 필수값: 전화번호만 (사업체명은 선택)
    if (!data.phone) {
      return jsonResponse({ ok: false, error: 'phone is required' });
    }

    const sheet = getOrCreateSheet();
    const nowIso = data.submittedAt || new Date().toISOString();
    const nowKst = toKstString(new Date(nowIso));

    // 중복 신청 차단 (같은 전화번호 1회만)
    if (isDuplicatePhone(sheet, data.phone)) {
      return jsonResponse({
        ok: true,
        duplicate: true,
        message: 'already registered'
      });
    }

    // path 에서 utm 파라미터 추출 (예: /?utm_source=kakao&utm_medium=channel)
    const utm = extractUtm(data.path || '');

    sheet.appendRow([
      nowIso,
      nowKst,
      data.form         || '',
      data.source       || '',
      data.company      || '',
      data.phone        || '',
      data.phoneRaw     || '',
      data.region       || '',
      utm.source        || '',
      utm.medium        || '',
      utm.campaign      || '',
      data.userAgent    || '',
      data.referrer     || '',
      data.path         || ''
    ]);

    // 정원 카운트 (마감 알림 / 텔레그램 트리거 용도)
    const total = sheet.getLastRow() - 1; // 헤더 제외
    const tier  = total <= SUPER_EARLYBIRD_LIMIT ? 'super_earlybird'
                : total <= EARLYBIRD_LIMIT       ? 'earlybird'
                                                 : 'waitlist';

    return jsonResponse({
      ok: true,
      total: total,
      tier: tier
    });

  } catch (err) {
    Logger.log('doPost error: ' + err);
    return jsonResponse({ ok: false, error: String(err && err.message || err) });
  }
}

// ──────────────────────────────────────────────────────────
// GET 핸들러 — 헬스체크용
// ──────────────────────────────────────────────────────────
function doGet(e) {
  try {
    const sheet = getOrCreateSheet();
    const total = Math.max(0, sheet.getLastRow() - 1);
    return jsonResponse({
      ok: true,
      service: '발주Up 사전 신청 API',
      total: total
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

// ──────────────────────────────────────────────────────────
// 헬퍼
// ──────────────────────────────────────────────────────────
function getOrCreateSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setColumnWidths(1, HEADERS.length, 140);
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function isDuplicatePhone(sheet, phone) {
  if (sheet.getLastRow() < 2) return false;
  const phoneCol = HEADERS.indexOf('phone') + 1; // 1-based
  const values = sheet.getRange(2, phoneCol, sheet.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(phone)) return true;
  }
  return false;
}

function toKstString(date) {
  // KST (UTC+9) 표시 — 시트에서 사람이 읽기 쉽게
  return Utilities.formatDate(date, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function extractUtm(pathWithQuery) {
  const out = { source: '', medium: '', campaign: '' };
  const qIdx = pathWithQuery.indexOf('?');
  if (qIdx === -1) return out;
  const qs = pathWithQuery.slice(qIdx + 1);
  qs.split('&').forEach(function (kv) {
    const eq = kv.indexOf('=');
    if (eq === -1) return;
    const k = decodeURIComponent(kv.slice(0, eq));
    const v = decodeURIComponent(kv.slice(eq + 1));
    if (k === 'utm_source') out.source = v;
    else if (k === 'utm_medium') out.medium = v;
    else if (k === 'utm_campaign') out.campaign = v;
  });
  return out;
}

// ──────────────────────────────────────────────────────────
// 개발/테스트 — Apps Script 에디터에서 직접 실행
// ──────────────────────────────────────────────────────────
function testInsert() {
  const fakeEvent = {
    postData: {
      contents: JSON.stringify({
        form: 'hero',
        company: '테스트 방수',
        phone: '01099998888',
        phoneRaw: '010-9999-8888',
        region: '서울 전체',
        submittedAt: new Date().toISOString(),
        userAgent: 'GAS test runner',
        referrer: '',
        path: '/'
      })
    }
  };
  const res = doPost(fakeEvent);
  Logger.log(res.getContent());
}
