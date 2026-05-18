# 카카오 알림톡 설정 가이드

방수업체 사용자에게 신규 입찰공고를 카카오톡으로 자동 발송합니다.
**솔루션**: 알리고(aligo.in) — 한국 알림톡 솔루션 중 진입장벽이 가장 낮음.

**소요 시간**: 1~2일 (카카오 채널 심사 1일 + 템플릿 심사 0.5~1일)  ·  **비용**: 발송 1건당 ~9원

---

## 1. 카카오톡 비즈채널 만들기

1. https://center-pf.kakao.com 접속 → 카카오 계정 로그인
2. **+ 새 채널 만들기**
   - 채널명: `발주Up`
   - 검색 ID: `@baljuup` 같은 영문 ID
3. 채널 정보 등록 후 **검색 가능** 설정 활성화
4. 채널 URL 복사 (예: `https://pf.kakao.com/_xxxx`)

> 알림톡 발송에 필요한 "비즈채널"은 무료 채널만 있어도 됨. 별도 비즈 인증은 알리고 가입 시 함께 진행.

---

## 2. 알리고 가입 + 카카오 비즈채널 연결

1. https://smartsms.aligo.in 회원가입 (사업자등록증 업로드 필요)
2. 로그인 후 **알림톡 → 발신프로필 등록**
3. STEP 1 — 카카오톡 채널 검색 ID 입력 (예: `@baljuup`)
4. STEP 2 — 채널 관리자(카카오 계정)로 들어가서 알리고 발송 권한 승인
5. **발신키(senderkey)** 발급 완료 → 환경변수 `KAKAO_SENDER_KEY` 에 등록

---

## 3. 알림톡 템플릿 등록 + 심사

알리고 관리자 → **알림톡 → 템플릿 관리 → 새 템플릿 등록**

### 템플릿: `BID_ALERT_V1` (입찰공고 알림)

**카테고리**: `서비스 이용` (또는 `정보성`)

**제목 (관리용)**: `입찰공고 알림 v1`

**본문**:
```
[발주Up] 입찰공고 발생

#{단지명}
공사: #{공사종류}
마감: #{마감일}

경쟁사보다 먼저 움직이세요.
```

**버튼 1**:
- 버튼명: `제안서 바로 만들기`
- 링크 유형: `웹링크`
- 모바일 URL: `https://your-domain.com/proposals/new?complexId=#{complexId}`
- PC URL: 위와 동일

> 변수 `#{단지명}`, `#{공사종류}`, `#{마감일}`, `#{complexId}` 는 코드에서 자동 치환됨.

심사 제출 → 보통 12~24시간 내 승인.

---

## 4. API 키 발급

알리고 관리자 → **마이페이지 → API 키 발급** → API 키 복사.

`.env.local` 에 추가:

```env
KAKAO_API_KEY=알리고에서 받은 API 키
KAKAO_SENDER_KEY=발신키 (STEP 2 에서 받음)
KAKAO_USER_ID=알리고 가입 시 ID (이메일 아님)
KAKAO_SENDER_PHONE=0212345678   # 대체 SMS 발신번호 (없어도 됨)
```

---

## 5. GitHub Secrets 등록

저장소 **Settings → Secrets and variables → Actions** 에 동일한 4개 키 + 기존 키 등록:

| Name | 비고 |
|---|---|
| `KAKAO_API_KEY` | 알리고 API 키 |
| `KAKAO_SENDER_KEY` | 비즈채널 발신키 |
| `KAKAO_USER_ID` | 알리고 ID |
| `KAKAO_SENDER_PHONE` *(선택)* | SMS 대체 발송 발신번호 |

---

## 6. 동작 확인 — 로컬 테스트

```bash
# .env.local 에 4개 키 모두 입력했다면
cd waterproof-app

# 1) 본인 사용자에 가짜 입찰공고 1건 수동 추가 (Supabase SQL Editor)
#    INSERT INTO bid_announcements (complex_id, title, work_type, deadline_at, status, created_at)
#    VALUES ('<complex_id>', '테스트 공고', '옥상방수', '2026-12-31', 'active', NOW());

# 2) dry-run 으로 발송 대상 확인
npx tsx scripts/send-alimtalks.ts --dry-run

# 3) 실제 발송 (본인 휴대폰으로 카카오톡 알림 도착해야 정상)
npx tsx scripts/send-alimtalks.ts
```

---

## 7. 자동 실행 (Production)

`.github/workflows/daily-alimtalk.yml` 가 매일 오전 9시 KST 자동 실행.

발송 흐름:
1. 어제 자정 이후 등록된 `bid_announcements WHERE status = 'active'` 조회
2. `user_profiles WHERE notify_bids = TRUE AND phone IS NOT NULL` 활성 사용자 조회
3. 사용자의 `region` 배열과 단지의 `sido` 매칭 (서울 사용자 → 서울 단지 공고만)
4. 이미 발송한 (user_id, bid_id) 쌍은 SKIP (멱등성)
5. 100건씩 batch 로 알림톡 발송
6. `alimtalk_logs` 에 결과 기록 (성공/실패 + 사유)

---

## 8. 운영 모니터링

### 사용자별 알림 비활성화
- `/settings` 페이지에서 `notify_bids` 토글 *(UI 추가 필요 — 현재는 DB 기본값 TRUE)*

### 발송 한도
- 알리고 1일 발송 한도: 솔루션 등급별 (기본 일 1만 건)
- 메시지 길이: 알림톡 1,000자 (이 템플릿은 ~100자라 안전)

### 비용 관리
- 알림톡 단가: 약 8.5~9원/건 (대량 발송 시 협상 가능)
- 대체 SMS 발송 시 단가: 약 25원/건
- 예상 월 비용: 활성 사용자 100명 × 주 평균 5건 ≈ 2,000건/월 ≈ 18,000원

### 발송 실패 처리
- 알리고 응답이 `code=0` 이 아니면 `alimtalk_logs.status = failed`
- 자주 보이는 실패: `1003` 발신키 오류 / `1004` 템플릿 본문 불일치 / `2010` 수신자 차단

---

## 9. 향후 확장

- **점수 상승 알림** (`SCORE_RISE_V1` 템플릿): 단지 점수가 80점 돌파 시
- **마감 D-3 알림** (`DEADLINE_V1` 템플릿): 활성 공고 마감 3일 전
- **수주 축하 알림** (`WON_V1` 템플릿): 본인 제안서 status=won 처리 시
- **신규 가입 환영** (`WELCOME_V1` 템플릿): user_profiles insert trigger
