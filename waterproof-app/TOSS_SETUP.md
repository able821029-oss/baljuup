# 토스페이먼츠 정기결제 설정 가이드

발주Up의 월 구독을 토스페이먼츠 정기결제(빌링)로 처리합니다.

## 1. 토스페이먼츠 가입 + 키 발급

1. https://developers.tosspayments.com 가입
2. 로그인 → **내 개발정보** → **결제 시스템 연동**
3. 다음 키를 복사:
   - **테스트 클라이언트 키** (`test_ck_...`) → `NEXT_PUBLIC_TOSS_CLIENT_KEY`
   - **테스트 시크릿 키** (`test_sk_...`) → `TOSS_SECRET_KEY`
4. `.env.local` 에 추가 (이미 .env.local.example 에 자리 잡혀 있음)

> 정식 출시 전 라이브 키로 교체. 라이브 키는 **사업자등록 후** 정산 정보 등록 필수.

## 2. DB 마이그레이션

Supabase SQL Editor 에서 `supabase/migrations/002_subscriptions.sql` 실행 →
`subscriptions` + `billing_logs` 두 테이블 + RLS 정책 + updated_at 트리거 생성.

## 3. 토스 대시보드 설정

- **결제 위젯 (정기결제)**: 카드 등록만 사용 (KEY-IN)
- **successUrl / failUrl 등록**:
  - successUrl: `https://your-domain.com/billing/success`
  - failUrl:    `https://your-domain.com/billing/fail`
  - 로컬 개발: `http://localhost:3000/billing/success` 도 추가
- **웹훅** (선택): `https://your-domain.com/api/webhooks/toss` 등록해 결제 이벤트 수신

## 4. 동작 흐름

```
1. /billing 페이지 → 사용자 [스타터/프로 구독 시작] 클릭
2. CheckoutButton 이 Toss SDK 위젯 호출
3. 토스 카드 입력 페이지로 이동
4. 사용자 카드 등록 완료
5. 토스가 /billing/success?authKey=...&customerKey=... 로 리다이렉트
6. /billing/success 라우트:
   - issueBillingKey 로 billingKey 발급
   - activateSubscription 으로 subscriptions 테이블 upsert
   - 즉시 첫 결제 (chargeBillingKey)
   - 성공: /billing/complete 로 이동
   - 실패: /billing/fail 로 이동
7. 다음 결제: GitHub Actions 또는 cron 으로 매월 같은 일자에 chargeBillingKey 호출
```

## 5. 월 정기결제 자동화

별도 워크플로우 `.github/workflows/monthly-billing.yml` 작성 권장 (향후):

```yaml
on:
  schedule:
    - cron: '0 1 * * *'  # 매일 새벽 1시 — 결제일 도래한 구독만 처리
```

스크립트는 `subscriptions WHERE status = 'active' AND next_billing_at <= NOW()` 를 조회 후
각각에 `chargeBillingKey` 호출 + 성공 시 `next_billing_at` 을 +1개월 갱신.

## 6. 테스트 카드 번호

토스 테스트 환경에서 사용 가능:

| 카드 | 번호 |
|---|---|
| 신한 (성공) | 4242 4242 4242 4242 |
| 비씨 (성공) | 9442 9442 9442 9442 |
| 결제 실패 시뮬레이션 | 4030 0000 0000 0000 |

CVC: 아무 3자리, 유효기간: 미래 아무 날짜, 비밀번호 앞 2자리: 아무 숫자.

## 7. 자주 발생하는 문제

- **`AUTH_FAILED`** — TOSS_SECRET_KEY 가 잘못됨. .env.local 재확인 → 서버 재시작.
- **`INVALID_REDIRECT_URL`** — 토스 대시보드에 등록한 URL 과 코드의 successUrl 이 다름.
- **첫 결제 즉시 실패** — 한도 부족, 본인 인증 미완료, 외국발급 카드 등. billing_logs 에 사유 기록됨.
- **CORS 에러** — 발생하지 않음 (서버에서 Toss API 호출).
