# GitHub Actions 설정 — 발주Up 주간 자동 수집

매주 월요일 새벽 6시(KST)에 수도권 단지 데이터를 자동으로 갱신합니다.

## 1. 필요한 GitHub Secrets

저장소 **Settings → Secrets and variables → Actions → New repository secret** 에서 등록:

| 이름 | 값 |
|---|---|
| `DATA_GO_KR_KEY` | 공공데이터포털 인증키 |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role 키 (⚠️ 절대 노출 금지) |
| `SLACK_WEBHOOK_URL` *(선택)* | 실패 시 알림 받을 Slack Incoming Webhook URL |

> Vercel 환경변수와 같은 값을 사용해도 됩니다.

## 2. 실행 방식

- **자동**: 매주 월요일 06:00 KST (cron `0 21 * * 0` UTC)
- **수동**: Actions 탭 → `Weekly Public Data Collection` → `Run workflow`
  - 시도 선택: 전체 / 11 (서울) / 41 (경기) / 28 (인천)
  - 모드: enrich (유지이력·충당금·점수 포함) / basic (단지 기본만)

## 3. 동작

- 서울·경기 두 시도가 **병렬 job** 으로 동시 실행 (max-parallel=2)
- 한 시도가 실패해도 다른 시도는 계속 진행 (`fail-fast: false`)
- timeout 5시간 (`timeout-minutes: 300`)
- 각 시도별 수집·upsert·보강 결과는 **Actions Summary** 에 한 줄로 기록

## 4. 비용

- GitHub Free 플랜: public repo 무제한, private repo 월 2,000분 무료
- 예상 사용량: 매주 1회 × 약 3시간 = 월 12시간 = 720분 → 무료 한도 내
- Supabase Free: API 호출 무제한, DB write 충분 (월 50GB)
- 공공데이터포털: 일 1만건 무료

## 5. 실패 시 대응

1. **이메일 알림** (기본): GitHub 가 owner 에게 자동 발송
2. **Slack 알림** (선택): `SLACK_WEBHOOK_URL` 시크릿 등록 시 자동
3. **수동 재실행**: Actions 탭 → 해당 run → `Re-run failed jobs`

## 6. 로그 확인

- Actions 탭 → `Weekly Public Data Collection` → 최근 실행 클릭
- 각 시도별 job 의 step 로그에서 `페이지 NN · 누적 NNN건` 진행률 확인
- 마지막에 `최종 결과` 박스에 수집/upsert/보강/실패 카운트 표시

## 7. 비활성화

일시적으로 끄고 싶다면 Actions 탭 → 워크플로우 선택 → `... → Disable workflow`.
완전 제거는 `.github/workflows/weekly-collect.yml` 파일 삭제.
