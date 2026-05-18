# Vercel 배포 가이드

발주Up MVP를 Vercel에 배포하고, 외부 서비스(Supabase·Toss·Google Apps Script) URL을 production용으로 갱신하는 단계별 가이드입니다.

**예상 소요 시간**: 30~40분  ·  **비용**: 무료 (Vercel Hobby)

---

## 0. 사전 조건

- [ ] `npm run build` 가 로컬에서 성공
- [ ] Supabase 프로젝트가 생성되어 있고 마이그레이션 적용됨 (`001_initial.sql`, `002_subscriptions.sql`)
- [ ] 토스 테스트 키 발급 완료
- [ ] 공공데이터포털 인증키 발급 완료
- [ ] GitHub 계정 + 빈 저장소 1개

---

## 1. GitHub 저장소에 코드 푸시

```bash
cd "E:\#앱 개발\방수 SaaS MVP\waterproof-app"
git init
git add .
git commit -m "Initial commit"

# GitHub 저장소 생성 후 URL 복사 (예: https://github.com/USER/waterproof-saas.git)
git remote add origin https://github.com/USER/waterproof-saas.git
git branch -M main
git push -u origin main
```

> `.env.local` 은 `.gitignore` 에 포함되어 있어 커밋되지 않음. 환경변수는 Vercel에 따로 등록.

**중요**: 루트의 `.github/workflows/*` 파일들도 함께 푸시되어야 GitHub Actions (주간 수집 + 월 정기결제)이 동작합니다. `git status` 로 포함 여부 확인.

---

## 2. Vercel 계정 + 프로젝트 생성

1. https://vercel.com 접속 → **Sign Up** → GitHub 계정으로 가입
2. **Add New → Project** 클릭
3. GitHub 저장소 목록에서 `waterproof-saas` 선택 → **Import**
4. **Configure Project** 화면:
   - **Framework Preset**: `Next.js` (자동 감지됨)
   - **Root Directory**: `waterproof-app` 폴더로 설정 (모노레포 구조이므로 중요!)
   - **Build Command**: `npm run build` (기본값)
   - **Output Directory**: `.next` (기본값)
   - **Install Command**: `npm install` (기본값)

> Root Directory 가 `waterproof-app` 으로 설정되지 않으면 빌드 실패. **반드시 확인**.

---

## 3. 환경변수 등록 (Production)

**Configure Project → Environment Variables** 섹션에서 아래 모든 키를 추가:

| Key | Value | 환경 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxx.supabase.co` | All |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon 키 | All |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role 키 ⚠️ | Production + Preview만 |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | All |
| `DATA_GO_KR_KEY` | 공공데이터포털 인증키 | All |
| `NEXT_PUBLIC_TOSS_CLIENT_KEY` | `test_ck_...` (또는 라이브) | All |
| `TOSS_SECRET_KEY` | `test_sk_...` ⚠️ | Production + Preview만 |
| `NEXT_PUBLIC_URL` | **배포 후 받는 URL** (예: `https://waterproof-saas.vercel.app`) | All |
| `KAKAO_API_KEY` *(선택)* | 카카오 알림톡 키 | Production + Preview만 |
| `KAKAO_SENDER_KEY` *(선택)* | 알림톡 발신 키 | Production + Preview만 |

`NEXT_PUBLIC_URL` 은 처음에는 placeholder로 입력하고, 배포 완료 후 정확한 URL로 업데이트합니다.

**Deploy** 클릭 → 2~3분 대기 → 빌드 완료.

---

## 4. 배포 직후 — 외부 서비스 URL 갱신

배포가 끝나면 `https://waterproof-saas-xxx.vercel.app` 형태의 URL이 발급됩니다. 이 URL을 다음 4곳에 반영해야 모든 흐름이 정상 동작합니다.

### 4.1 Vercel 자신의 환경변수
- `NEXT_PUBLIC_URL` 을 발급받은 URL로 수정 → Deployments 에서 **Redeploy**

### 4.2 Supabase — Auth Redirect URLs
1. Supabase 대시보드 → **Authentication → URL Configuration**
2. **Site URL**: `https://waterproof-saas-xxx.vercel.app`
3. **Redirect URLs** 에 추가:
   - `https://waterproof-saas-xxx.vercel.app/auth/callback`
   - `https://waterproof-saas-xxx.vercel.app/**` *(개발 편의)*
4. **Save**

> Supabase URL 갱신을 안 하면 이메일 인증 링크 클릭 시 `localhost:3000` 으로 리다이렉트되어 동작 안 함.

### 4.3 토스페이먼츠 — successUrl/failUrl
1. 토스 개발자센터 → **내 개발정보 → 결제 시스템 연동 → URL 설정**
2. **success URL** 에 추가: `https://waterproof-saas-xxx.vercel.app/billing/success`
3. **fail URL** 에 추가: `https://waterproof-saas-xxx.vercel.app/billing/fail`
4. (선택) **웹훅 URL**: `https://waterproof-saas-xxx.vercel.app/api/webhooks/toss`

### 4.4 Google Apps Script (랜딩페이지 폼)
- 변경 없음. landing_page.html 의 `GAS_ENDPOINT` 는 그대로 사용
- 다만 landing_page.html 자체를 Vercel 에 배포한다면 그 도메인을 GAS 의 허용 origin 에 추가 *(현재는 같은 origin 정책 없음)*

---

## 5. GitHub Actions Secrets 등록

Cron 워크플로우(주간 수집 + 월 정기결제)가 동작하려면 저장소에 시크릿 등록 필요.

**저장소 → Settings → Secrets and variables → Actions → New repository secret**:

| Name | 비고 |
|---|---|
| `DATA_GO_KR_KEY` | 공공데이터포털 인증키 |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role |
| `TOSS_SECRET_KEY` | 토스 시크릿 |
| `SLACK_WEBHOOK_URL` *(선택)* | 실패 알림 |

등록 후 **Actions** 탭 → 각 워크플로우 → **Run workflow** 로 수동 1회 실행해 정상 동작 확인.

---

## 6. 커스텀 도메인 연결 (선택)

### Vercel 측
1. 프로젝트 → **Settings → Domains**
2. 도메인 입력 (예: `baljuup.co.kr`)
3. Vercel 이 보여주는 **A record** 또는 **CNAME** 을 도메인 등록 업체에 추가
4. DNS 전파 5~30분 후 자동으로 SSL 발급 (Let\'s Encrypt)

### 도메인 연결 후 다시 갱신
모든 URL 을 `https://your-domain.com` 으로 일괄 교체:
- `NEXT_PUBLIC_URL` 환경변수
- Supabase Site URL + Redirect URLs
- 토스 successUrl/failUrl

서브도메인 활용 권장:
- `baljuup.co.kr` → 랜딩페이지 (Framer 또는 별도)
- `app.baljuup.co.kr` → 본 앱 (Vercel)

---

## 7. 자동 프리뷰 활용

Vercel 의 강력한 기능: PR 마다 자동 프리뷰 URL 생성.

- `git checkout -b feature/xxx` → 작업 → `git push` → PR 오픈
- Vercel 봇이 PR 에 프리뷰 URL 댓글
- 동료/관리소장에게 공유해 피드백 받은 후 main 머지

> Preview 환경변수는 **Production 과 동일하게 설정** 권장 (Production + Preview 체크박스 모두 켜기)

---

## 8. Production 출시 체크리스트

배포 직후가 아니라 **유료 사용자 받기 직전** 점검:

### 8.1 보안
- [ ] 모든 `NEXT_PUBLIC_*` 가 아닌 변수가 **클라이언트 번들에 노출되지 않음** 확인  
      → 빌드 로그에서 `SUPABASE_SERVICE_ROLE_KEY` 등 검색 → 없어야 정상
- [ ] Supabase `user_profiles`, `proposals`, `subscriptions`, `billing_logs` 의 RLS 가 **활성화**되어 있음
- [ ] `service_role` 키가 **GitHub Actions Secrets 와 Vercel 환경변수 외에는** 어디에도 없음
- [ ] 토스 라이브 키 적용 시 **테스트 키 완전 제거**

### 8.2 결제
- [ ] 토스 사업자 정보 등록 + 정산 계좌 검증 완료
- [ ] 라이브 키 (`live_sk_...`, `live_ck_...`) 발급 후 환경변수 교체
- [ ] 본인 카드로 가장 저렴한 플랜 실결제 → DB 적재 + 영수증 발행 확인
- [ ] **취소·환불 정책** 페이지 작성 (`/terms`, `/refund-policy`)

### 8.3 데이터
- [ ] `npm run collect:enrich -- --sido=11` 1회 수동 실행 → 단지 6,000건 이상 적재 확인
- [ ] 대시보드에서 점수 분포가 자연스럽게 표시되는지 (모두 0점이면 보강 단계 실패)
- [ ] Supabase Free 한도: DB 500MB 까지 → `complexes` 풀 데이터 약 50MB 사용 → 안전

### 8.4 모니터링
- [ ] Vercel **Analytics** 활성화 (Settings → Analytics → Enable)
- [ ] Supabase **Reports → Database** 에서 daily query 수 확인 모니터링
- [ ] GitHub Actions Email 알림 ON (Settings → Notifications)
- [ ] Slack Webhook 등록 시 워크플로우 실패 즉시 알림

### 8.5 SEO + 메타
- [ ] `app/layout.tsx` 의 `<title>` `<meta description>` 한국어로 작성
- [ ] `app/opengraph-image.tsx` 또는 `og-image.png` 추가 (카카오톡 공유 시 미리보기)
- [ ] `robots.txt`, `sitemap.xml` 자동 생성 (Next.js 메타 라우트)

### 8.6 법적
- [ ] **이용약관** (`/terms`) — 환불 조건, 책임 제한
- [ ] **개인정보처리방침** (`/privacy`) — 수집 항목·보관 기간·제3자 제공
- [ ] **사업자 정보** (푸터) — 상호, 대표자, 사업자번호, 통신판매업신고

---

## 9. 자주 발생하는 배포 실패

### "Module not found: Can\'t resolve \'@/...\'"
- `tsconfig.json` 의 paths 가 안 잡힌 경우
- Root Directory 가 `waterproof-app` 으로 설정됐는지 재확인

### Build 가 4분 이상 걸리고 fail
- node_modules 너무 크거나 빌드 캐시가 깨진 경우
- Settings → General → **Build & Development Settings → Override** → Install Command 를 `npm ci` 로 변경

### 환경변수가 적용 안 됨
- 추가/수정 후 **Redeploy 필수** (Deployments 탭 → 최근 → ... → Redeploy)
- `NEXT_PUBLIC_` 접두사 빠진 변수는 클라이언트 컴포넌트에서 접근 불가

### Toss 결제 후 `/billing/success` 가 404
- 토스 대시보드의 successUrl 과 실제 Vercel URL이 정확히 일치하는지 (말미 슬래시 포함)
- Vercel 환경변수 `NEXT_PUBLIC_URL` 도 같은지

### Supabase 인증 후 무한 리다이렉트
- Site URL / Redirect URLs 미설정 시 발생
- `middleware.ts` 의 PUBLIC_PATHS 에 `/auth` 가 포함되어 있는지

---

## 10. 다음 단계

배포 완료 후 권장 작업:
- [ ] **사전 모집 랜딩페이지 (`landing_page.html`)** 를 별도 도메인 또는 `/welcome` 경로에 배포해 광고 트래픽 받기
- [ ] **카카오 알림톡** 연동 (lib/kakao-alimtalk.ts 스켈레톤 완성)
- [ ] **수동 결제 재시도 페이지** (failed 구독을 재결제할 수 있는 UI)
- [ ] **Slack 봇** 으로 신규 가입/결제/취소 실시간 알림
- [ ] **Plausible / GA4** 연동 (개인정보 친화적 분석은 Plausible 권장)

---

## 참고 명령어 모음

```bash
# 로컬 production 빌드 검증
npm run build
npm run start    # http://localhost:3000

# 환경변수 누락 시 빌드 실패 재현
unset ANTHROPIC_API_KEY && npm run build

# Vercel CLI (선택)
npm i -g vercel
vercel link        # 기존 프로젝트와 연결
vercel env pull    # production 환경변수를 .env.local 로 가져옴
vercel logs        # 최근 함수 로그
```
