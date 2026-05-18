# 발주Up — 랜딩페이지 폼 백엔드 연동 가이드

랜딩페이지 폼 제출을 Google Sheets에 자동 수집하기 위한 설정 가이드입니다.
작업 시간: **15분 내외**, 비용: **무료**.

---

## 산출물 요약

| 파일 | 역할 |
|---|---|
| `landing_page.html` | 폼 → `GAS_ENDPOINT`로 POST 전송 (수정 완료) |
| `apps_script.gs` | Google Apps Script 백엔드 코드 (붙여넣기용) |
| `GAS_SETUP.md` | 이 문서 (배포 가이드) |

---

## STEP 1. Google Sheets 생성

1. https://sheets.google.com 접속 → **+ 빈 스프레드시트** 클릭
2. 파일 이름 변경: `발주Up — 사전 신청자` (자유)
3. 브라우저 주소창에서 **시트 ID**를 복사해 둡니다.

   ```
   https://docs.google.com/spreadsheets/d/[이부분을_복사]/edit
                                          └────── 시트 ID ──────┘
   ```

> 첫 행 헤더는 따로 만들지 않아도 됩니다. Apps Script가 자동으로 채웁니다.

---

## STEP 2. Apps Script 프로젝트 생성

1. https://script.google.com 접속 → **+ 새 프로젝트**
2. 프로젝트 이름 변경: `발주Up — 신청 백엔드` (좌상단 "제목 없는 프로젝트" 클릭)
3. 좌측 코드 에디터의 기본 `function myFunction() {}` 를 모두 지우고,
   **`apps_script.gs` 파일 내용을 통째로 복사해서 붙여넣기**
4. 코드 상단의 한 줄을 본인 환경으로 교체:

   ```js
   const SPREADSHEET_ID = 'REPLACE_WITH_YOUR_SHEET_ID';
   //                     ↑ STEP 1에서 복사한 시트 ID로 교체
   ```
5. 상단 디스크 아이콘(💾)으로 **저장** (Ctrl+S)

---

## STEP 3. 권한 부여 + 동작 테스트

1. 코드 에디터 상단의 함수 선택 드롭다운에서 **`testInsert`** 선택
2. **▶ 실행** 버튼 클릭
3. "권한 검토 필요" 팝업 → **권한 검토** → 본인 Google 계정 선택
4. "Google에서 확인하지 않은 앱" 경고 화면 → 좌측 하단 **고급** → **`발주Up — 신청 백엔드`(으)로 이동(안전하지 않음)**
   - 본인이 만든 스크립트이므로 안전합니다.
5. 권한 허용 → 자동으로 다시 실행됨
6. **Google Sheets로 돌아가서 확인**: `신청자` 시트가 생성되고 테스트 데이터 1줄이 들어가 있으면 성공 ✅

---

## STEP 4. 웹앱 배포

1. Apps Script 에디터 우측 상단 **배포 > 새 배포** 클릭
2. 좌측 톱니바퀴 ⚙ → **웹 앱** 선택
3. 다음과 같이 설정:
   - **설명**: `v1` (자유)
   - **다음 사용자로 실행**: `나 (본인 이메일)`
   - **액세스 권한이 있는 사용자**: `모든 사용자` ⚠️ 반드시 선택
4. **배포** 클릭
5. 표시되는 **웹 앱 URL**을 복사 — 형태:
   ```
   https://script.google.com/macros/s/AKfycb.................../exec
   ```
6. URL이 잘 동작하는지 브라우저에서 한 번 열어보면 JSON이 반환되어야 합니다:
   ```json
   { "ok": true, "service": "발주Up 사전 신청 API", "total": 1 }
   ```

---

## STEP 5. landing_page.html에 엔드포인트 연결

`landing_page.html` 1029번째 줄 근처의 한 줄만 교체:

```js
// BEFORE
const GAS_ENDPOINT = 'https://script.google.com/macros/s/REPLACE_WITH_YOUR_DEPLOYMENT_ID/exec';

// AFTER (STEP 4에서 복사한 URL)
const GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycb...../exec';
```

저장 후 브라우저로 `landing_page.html`을 열어 폼을 제출해 보세요.
시트에 새 행이 들어오면 연결 완료입니다.

---

## 동작 흐름

```
사용자 폼 입력
    ↓
landing_page.html : handleSubmit() / handleSubmit2()
    ↓ fetch POST (JSON, text/plain content-type)
Apps Script 웹앱 : doPost(e)
    ↓
Google Sheets "신청자" 시트에 append_row
    ↓
JSON 응답 { ok: true, total: N, tier: 'super_earlybird'|'earlybird'|'waitlist' }
    ↓
프런트엔드: 성공 상태 표시 / 오류 시 alert
```

---

## 수집되는 데이터 (헤더)

| 컬럼 | 설명 |
|---|---|
| `submittedAt` | ISO 8601 (UTC) — 정렬·필터용 |
| `submittedKST` | `2026-05-18 14:23:01` — 사람이 보기 좋은 KST 시간 |
| `form` | `hero` / `bottom` — 어느 폼에서 들어왔는지 |
| `company` | 사업체명 |
| `phone` | 숫자만 (예: `01012345678`) |
| `phoneRaw` | 원본 입력값 (예: `010-1234-5678`) |
| `region` | 활동 지역 (하단 폼은 공란) |
| `userAgent` | 디바이스/브라우저 |
| `referrer` | 유입 출처 (광고 효율 측정) |
| `path` | 랜딩 경로 + utm 쿼리스트링 |

---

## 코드에 포함된 안전장치

- **중복 신청 차단**: 같은 전화번호로 두 번째 신청 시 새 행을 만들지 않고 `{ ok: true, duplicate: true }` 반환 (사용자에게는 동일한 성공 화면이 보입니다).
- **CORS 우회**: `Content-Type: text/plain` 으로 전송해 브라우저 preflight를 발생시키지 않음 (Apps Script는 OPTIONS를 지원하지 않음).
- **에러 핸들링**: 폼 제출 실패 시 버튼이 다시 활성화되고 사용자에게 알림.
- **티어 자동 분류**: 신청 순서에 따라 `super_earlybird`(1~10) / `earlybird`(11~100) / `waitlist`(101~) 자동 분류 → 응답에 포함.

---

## 자주 묻는 문제

**Q. 폼 제출 시 "일시적인 오류" 알림이 뜬다**
A. 브라우저 개발자도구(F12) → Console 탭에서 실제 에러 확인.
   가장 흔한 원인:
   - `GAS_ENDPOINT` 가 아직 placeholder인 경우 → STEP 5 다시 확인
   - 웹앱 배포 시 "액세스 권한"이 `나`로 설정된 경우 → `모든 사용자`로 재배포 필요
   - 시트 ID 오타

**Q. 시트에 데이터가 안 쌓인다**
A. Apps Script 에디터의 "실행 기록"(좌측 시계 아이콘)에서 `doPost` 실행 로그와 에러 메시지 확인.

**Q. 코드를 수정했는데 반영이 안 된다**
A. Apps Script 웹앱은 **재배포** 해야 변경이 적용됩니다.
   `배포 > 배포 관리` → 연필 아이콘 → 버전을 `새 버전`으로 → 배포.
   URL은 동일하게 유지됩니다.

---

## 다음 단계 (이번 작업 범위 외)

- [ ] 신청 시 카카오 알림톡 웰컴 메시지 자동 발송 (Apps Script → 카카오 비즈메시지 API)
- [ ] 신청 1시간 후 후속 안내 메시지 자동 발송 (`onSubmit` trigger + delay)
- [ ] Supabase 마이그레이션 (`waterproof-app` MVP 빌드 이후)
- [ ] Vercel 배포 (정적 호스팅) — Framer 대신 자체 배포 시
