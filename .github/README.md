# GitHub Actions — 발주Up 자동화 워크플로우

저장소에 등록된 워크플로우들. 모두 Asia/Seoul 시간 기준.

## 정기 cron

| 워크플로우 | 주기 | 시간 (KST) | 용도 |
|---|---|---|---|
| `weekly-collect.yml` | 매주 월 | 06:00 | 공공데이터 단지 목록 수집 (서울+경기) |
| `weekly-rescore.yml` | 매주 화 | 03:00 | 예측 점수 재계산 (수집 다음날) |
| `daily-alimtalk.yml` | 매일 | 09:00 | 어제 신규 입찰공고 → 알림톡 발송 |
| `monthly-billing.yml` | 매일 | 01:00 | 토스 정기결제 청구 (`next_billing_at` 도래 구독만, 멱등) |
| `lighthouse.yml` | 매일 | 04:00 | Core Web Vitals 측정 (운영 사이트) |

## 코드 품질 & 보안

| 항목 | 트리거 | 용도 |
|---|---|---|
| `ci.yml` | push / PR | TypeScript 컴파일 + ESLint 검증 (시크릿 불필요) |
| `codeql.yml` | push / PR / 매주 일 03:00 | GitHub CodeQL 보안 정적 분석 (XSS/injection 등) |
| `bundle-size.yml` | PR | 클라이언트 JS 번들 크기 main 대비 변화 PR 코멘트 |
| `pr-label.yml` + `labeler.yml` | PR | 변경 파일 경로 → area/* 라벨 자동 부착 |
| `dependabot.yml` | 주간 / 월간 | npm + GH Actions 의존성 자동 업데이트 PR |

## 1. 필수 GitHub Secrets

저장소 **Settings → Secrets and variables → Actions → New repository secret** 에 등록:

### 공통 (모든 워크플로우)
| 이름 | 값 | 어디서 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Supabase → Settings → API (⚠️ 절대 노출 금지) |

### `weekly-collect` 전용
| 이름 | 값 | 어디서 |
|---|---|---|
| `DATA_GO_KR_KEY` | 공공데이터포털 인증키 | data.go.kr → 마이페이지 → 인증키 |

### `daily-alimtalk` 전용
| 이름 | 값 |
|---|---|
| `KAKAO_API_KEY` | 알리고 API 키 |
| `KAKAO_SENDER_KEY` | 카카오 비즈채널 발신키 |
| `KAKAO_USER_ID` | 알리고 가입 ID |
| `KAKAO_SENDER_PHONE` | SMS 대체발송 발신번호 |
| `NEXT_PUBLIC_URL` | `https://baljuup.vercel.app` (알림톡 버튼 링크용) |

### `monthly-billing` 전용
| 이름 | 값 |
|---|---|
| `TOSS_SECRET_KEY` | `live_sk_...` 또는 `test_sk_...` |

### 선택 (모든 워크플로우)
| 이름 | 값 |
|---|---|
| `SLACK_WEBHOOK_URL` | Slack Incoming Webhook URL (실패 알림용) |

> Vercel 환경변수와 동일한 값을 그대로 사용하면 됩니다.  
> Settings → Secrets → Actions 에 같은 이름으로 한 번 더 입력.

## 2. 워크플로우 상세

### `weekly-collect.yml`
- **자동**: 매주 월 06:00 KST
- **수동**: Actions → `Weekly Public Data Collection` → Run workflow
  - 시도: 전체 / 11 (서울) / 41 (경기) / 28 (인천)
  - 모드: `basic` (단지 목록만) / `enrich` (유지이력+충당금+점수 보강)
- 서울·경기 두 시도가 **병렬 job** 으로 실행, max-parallel=2
- timeout 5시간

### `weekly-rescore.yml` (신규)
- **자동**: 매주 화 03:00 KST — `weekly-collect` 가 끝난 21시간 뒤
- **수동**: `--limit=100` 또는 `--dry-run` 옵션 가능
- `lib/prediction.ts` 알고리즘으로 모든 단지 `prediction_score` 재계산
- 공공 API 재호출 없이 DB 만 사용 → 약 3분 소요 (단지 9000건 기준)

### `daily-alimtalk.yml`
- **자동**: 매일 09:00 KST
- **수동**: `since=YYYY-MM-DD` 또는 `dry_run=true`
- 어제 신규 입찰공고 → 관심 지역이 매칭되는 활성 사용자에게 알림톡
- 멱등 (`alimtalk_logs` 테이블 기준 중복 방지)

### `monthly-billing.yml`
- **자동**: **매일 01:00 KST** (멱등 — 같은 사용자는 한 달에 한 번만 청구됨)
- `user_subscriptions.next_billing_at <= NOW()` 인 활성 구독에 대해서만 청구
- 결제 성공: `next_billing_at += 1개월`, `last_billed_at = NOW()`
- 결제 실패: 구독 상태 `past_due` 로 자동 전환 (다음날 다시 시도)
- 매월 1일 일괄 청구가 아니라 사용자별 구독일 기준 정기 결제 모델

## 3. 비용

| 항목 | 무료 한도 | 예상 사용량 | 결론 |
|---|---|---|---|
| GitHub Actions | private repo 월 2,000분 | 약 200분/월 | 무료 |
| Supabase | DB write 무제한 | 일 ~10K | 무료 |
| 공공데이터포털 | 일 1만건 | ~500건 (수집 시) | 무료 |
| 알리고 알림톡 | — | 발송당 ~6.5원 | 사용량 비례 |
| 토스 PG 수수료 | — | 카드결제 2.9% | 매출 비례 |

## 4. 실패 시 대응

1. **이메일 알림** (기본): GitHub 가 repo owner 에게 자동 발송
2. **Slack 알림** (선택): `SLACK_WEBHOOK_URL` 시크릿 등록 시 자동
3. **수동 재실행**: Actions 탭 → 해당 run → `Re-run failed jobs`
4. **로그 확인**: Actions 탭 → 각 워크플로우 → 최근 실행 → step 로그 펼치기

## 5. 임시 비활성화

Actions 탭 → 워크플로우 선택 → `... → Disable workflow`.  
완전 제거는 해당 `.yml` 파일 삭제 후 push.

## 6. 시간대 참고

GitHub Actions cron 은 UTC 기준입니다. KST = UTC+9 이므로:
- KST 01:00 = UTC 16:00 (전날) — monthly-billing
- KST 03:00 = UTC 18:00 (전날) — weekly-rescore (화요일)
- KST 06:00 = UTC 21:00 (전날) — weekly-collect (월요일)
- KST 09:00 = UTC 00:00          — daily-alimtalk
