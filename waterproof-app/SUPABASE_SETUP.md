# Supabase 프로젝트 설정 가이드

발주Up MVP의 데이터베이스·인증·파일 저장소를 Supabase에서 한 번에 설정합니다.
**소요 시간**: 15~20분  ·  **비용**: 무료 (Free 플랜으로 시작 가능)

---

## 0. 사전 준비

- Google 또는 GitHub 계정 (Supabase 로그인용)
- 이 폴더의 `supabase/migrations/001_initial.sql` (이미 작성되어 있음)
- 텍스트 에디터에서 `.env.local.example` 열어 두기 (값을 채워 넣을 자리)

---

## 1. Supabase 프로젝트 생성

1. https://supabase.com 접속 → 우측 상단 **Start your project** 클릭
2. GitHub/Google 계정으로 로그인
3. **Organization** 선택 또는 새로 생성 (개인이면 본인 이름)
4. **New project** 클릭
5. 다음 정보 입력:
   - **Name**: `waterproof-saas` (자유)
   - **Database Password**: 강력한 비밀번호 (반드시 기록 — 나중에 직접 접속 시 필요)
   - **Region**: `Northeast Asia (Seoul)` ⭐ 한국 사용자 응답속도가 가장 빠름
   - **Pricing Plan**: `Free` (월 50,000 MAU, 500MB DB, 1GB Storage)
6. **Create new project** → 약 2~3분 프로비저닝 대기

> Free 플랜 한계: 7일간 미사용 시 일시 정지(다시 접속하면 즉시 복구). 출시 후 트래픽 발생 시 Pro($25/월)로 업그레이드.

---

## 2. API 키 발급 (.env.local 채우기)

프로젝트 생성 완료 후:

1. 좌측 사이드바 **⚙️ Project Settings** → **API**
2. 다음 3개 값을 복사:

| Supabase 화면 라벨 | .env.local 변수 | 비고 |
|---|---|---|
| **Project URL** | `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` |
| **Project API keys → anon, public** | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 브라우저 노출 OK |
| **Project API keys → service_role, secret** | `SUPABASE_SERVICE_ROLE_KEY` | ⚠️ 절대 클라이언트 노출 금지 |

3. `.env.local.example` 을 `.env.local` 로 복사:
   ```powershell
   # Windows PowerShell
   cd "E:\#앱 개발\방수 SaaS MVP\waterproof-app"
   Copy-Item .env.local.example .env.local
   notepad .env.local
   ```

4. 위 3개 변수에 복사한 값을 붙여넣고 저장

> `service_role` 키는 RLS(Row Level Security)를 우회하므로 **반드시 서버 코드에서만** 사용. `scripts/collect-complexes.ts` 같은 백엔드 작업용입니다.

---

## 3. 스키마 마이그레이션 적용

`supabase/migrations/001_initial.sql` 의 내용을 Supabase 데이터베이스에 반영합니다.

### 방법 A — Supabase 대시보드 SQL Editor (가장 쉬움 ⭐)

1. 좌측 사이드바 **🗃️ SQL Editor** 클릭
2. 우측 상단 **+ New query**
3. 로컬에서 `supabase/migrations/001_initial.sql` 파일을 열고 **전체 내용 복사**
4. SQL Editor에 붙여넣기 → 우측 하단 **Run** (Ctrl+Enter)
5. 좌측 **🗂️ Table Editor** 에서 생성된 테이블 확인:
   - `complexes`
   - `maintenance_history`
   - `bid_announcements`
   - `maintenance_funds`
   - `user_profiles`
   - `proposals`
   - View: `complex_predictions`

### 방법 B — Supabase CLI (CI/CD 자동화 시)

```bash
# 한 번만 설치
npm install -g supabase

# 프로젝트 폴더에서
cd waterproof-app
supabase login                            # 브라우저 인증
supabase link --project-ref <YOUR_REF>    # Settings > General 에서 Reference ID 확인
supabase db push                          # supabase/migrations/ 전체 적용
```

> CLI는 GitHub Actions로 자동 배포할 때 유용. MVP 단계에서는 방법 A로 충분.

---

## 4. 이메일 인증 활성화

방수업체 회원가입 시 이메일/비밀번호 인증을 쓰려면:

1. 좌측 사이드바 **🔐 Authentication** → **Providers**
2. **Email** 토글 ON (기본 활성화 상태)
3. 다음 옵션 점검:
   - ✅ **Enable Email provider**
   - ✅ **Confirm email** — 운영 환경에서는 켜기 (이메일 인증 메일 발송)
   - 개발 중에는 끄면 가입 즉시 로그인 가능
4. **Save**

### 이메일 템플릿 한국어로 변경 (선택)

좌측 **🔐 Authentication → Email Templates** 에서 5개 메일 (확인, 비밀번호 재설정 등)을 한국어로 수정. 발신자 이름은 `발주Up` 권장.

> 출시 단계에서는 자체 도메인 SMTP(SES, Sendgrid) 연동 필요. Supabase 기본 발송은 시간당 4통 제한.

---

## 5. Storage 버킷 생성 (제안서 PDF + 비포/애프터 이미지)

`proposals.pdf_url`, `before_image_url`, `after_image_url` 에 저장할 파일 보관소.

1. 좌측 사이드바 **🪣 Storage** → **+ New bucket**
2. 다음 2개 버킷 생성:

| Name | Public | 용도 |
|---|---|---|
| `proposals` | ❌ Private | 사용자 제안서 PDF (본인만 다운로드) |
| `proposal-images` | ✅ Public | 비포/애프터 이미지 (제안서 미리보기에 표시) |

3. **Policies** 설정 (proposals 버킷, 본인 파일만 접근):

   ```sql
   -- SQL Editor 에서 실행
   CREATE POLICY "users can read own proposal files"
     ON storage.objects FOR SELECT
     USING ( bucket_id = 'proposals' AND auth.uid()::text = (storage.foldername(name))[1] );

   CREATE POLICY "users can upload to own folder"
     ON storage.objects FOR INSERT
     WITH CHECK ( bucket_id = 'proposals' AND auth.uid()::text = (storage.foldername(name))[1] );
   ```

   → 파일은 `proposals/{user_id}/{proposal_id}.pdf` 경로로 업로드해야 본인 식별이 됨.

---

## 6. RLS (Row Level Security) 확인

`001_initial.sql` 에 이미 다음 정책이 포함되어 있습니다:

```sql
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can view own profile"  ON user_profiles FOR ALL USING ( auth.uid() = id );
CREATE POLICY "users can manage own proposals" ON proposals FOR ALL USING ( auth.uid() = user_id );
```

**검증 방법:**
1. **🗂️ Table Editor → user_profiles** → 우측 상단 자물쇠 아이콘 🔒 **확인** (RLS Enabled)
2. **🗂️ Table Editor → proposals** → 동일 확인

> `complexes` 등 공공 데이터 테이블은 RLS를 켜지 않아도 됨 (모든 사용자가 열람).
> 다만 운영 단계에서는 anon 키로 무단 대량 조회를 막기 위해 `SELECT` 정책을 별도 추가 권장.

---

## 7. 로컬에서 연결 테스트

```bash
cd "E:\#앱 개발\방수 SaaS MVP\waterproof-app"
npm install                  # 처음 한 번
npm run dev                  # http://localhost:3000
```

별도 터미널에서 공공데이터 dry-run:

```bash
# .env.local 에 DATA_GO_KR_KEY 까지 채워야 함
npm run collect:dry          # Supabase 적재 없이 fetch 만 확인
```

콘솔에 `[INFO] 시도 11 페이지 01 · 이번 1000건 · 누적 1000건` 같은 진행이 보이면 공공 API 정상.

**실제 적재 (서울만, 약 5분):**
```bash
npm run collect -- --sido=11
```

**유지이력·충당금 보강까지 (서울 한 시도 기준 30~60분):**
```bash
npm run collect:enrich -- --sido=11
```

---

## 8. 문제 해결

### "Invalid API key" 오류
- `.env.local` 의 키가 따옴표 없이 들어갔는지 확인 (`KEY=eyJ...` 형태)
- 줄 끝에 공백이 있는지 확인
- Next.js 개발 서버는 `.env.local` 변경 후 **재시작** 필요

### "permission denied for table xxx"
- RLS 정책 미설정 또는 anon 키로 INSERT/UPDATE 시도
- 서버 작업(예: collect 스크립트)에서는 `SUPABASE_SERVICE_ROLE_KEY` 사용

### "relation 'complex_predictions' does not exist"
- 001_initial.sql 실행 시 중간에 에러가 나서 뒷부분이 누락된 경우
- SQL Editor에서 다시 실행 (이미 만들어진 테이블은 `CREATE TABLE IF NOT EXISTS` 가 아니므로 에러 발생 가능 — 그 경우 해당 줄을 주석 처리하거나 전체 DROP 후 재실행)

### 한 번에 전체 초기화하려면
```sql
-- ⚠️ 모든 데이터 삭제됨. 개발 단계에서만.
DROP TABLE IF EXISTS proposals CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS maintenance_funds CASCADE;
DROP TABLE IF EXISTS bid_announcements CASCADE;
DROP TABLE IF EXISTS maintenance_history CASCADE;
DROP TABLE IF EXISTS complexes CASCADE;
DROP VIEW IF EXISTS complex_predictions;
-- 그 후 001_initial.sql 다시 실행
```

---

## 9. 다음 단계 (이 가이드 범위 외)

- [ ] `lib/supabase/client.ts` / `lib/supabase/server.ts` 작성 (브라우저/서버 클라이언트)
- [ ] `app/(auth)/login`, `app/(auth)/signup` 페이지 구현
- [ ] `app/(dashboard)/` 페이지들을 Server Component 로 전환해 Supabase 데이터 조회
- [ ] 주간 자동 갱신 (`.github/workflows/weekly-collect.yml`) — GitHub Actions 크론
- [ ] Vercel 배포 시 환경변수 동일하게 등록

---

## 체크리스트

배포 전 한 번 점검:

- [ ] `.env.local` 에 3개 Supabase 키 모두 입력
- [ ] SQL Editor 에서 6개 테이블 + 1개 뷰 생성 확인
- [ ] Authentication → Email Provider 활성화
- [ ] Storage 에 `proposals`, `proposal-images` 2개 버킷 생성
- [ ] `user_profiles`, `proposals` 테이블 RLS 켜진 상태 확인
- [ ] `npm run dev` 정상 기동
- [ ] `npm run collect:dry -- --sido=11` 진행률 정상 출력
