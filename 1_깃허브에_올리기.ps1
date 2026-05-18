# ════════════════════════════════════════════════════════════
#  발주Up — GitHub 업로드 스크립트
#
#  사용법:
#    1) 이 파일을 마우스 우클릭 → "PowerShell로 실행"
#       (또는 PowerShell 열고 이 파일 경로 실행)
#    2) 화면에 나오는 안내를 따라 GitHub URL 만 입력하면 끝
#
#  사전조건:
#    - Git for Windows 설치 (https://git-scm.com/download/win)
#    - GitHub 계정 + 빈 저장소 1개 (Public 권장)
#    - GitHub Personal Access Token (아래에서 안내)
# ════════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"

# 이 스크립트 위치를 작업 폴더로
Set-Location -Path $PSScriptRoot

Write-Host ""
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  발주Up — GitHub 업로드" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# ── 0. Git 설치 확인 ───────────────────────────────────────
try {
  $gitVer = git --version
  Write-Host "[OK] $gitVer" -ForegroundColor Green
}
catch {
  Write-Host "[ERROR] Git 이 설치되지 않았습니다." -ForegroundColor Red
  Write-Host "        https://git-scm.com/download/win 에서 설치 후 다시 실행하세요." -ForegroundColor Red
  Read-Host "엔터를 누르면 종료"
  exit 1
}

# ── 1. 기존에 깨진 .git 폴더가 있으면 정리 ────────────────
if (Test-Path .git) {
  Write-Host ""
  Write-Host "기존 .git 폴더가 있습니다. 깨끗하게 초기화합니다." -ForegroundColor Yellow
  Remove-Item -Recurse -Force .git
}

# ── 2. git init ───────────────────────────────────────────
Write-Host ""
Write-Host "[1/6] Git 저장소 초기화..." -ForegroundColor Cyan
git init -b main | Out-Null

# 사용자 정보
git config user.email "able821029@gmail.com"
git config user.name "able"

# Windows 한글 파일명 깨짐 방지
git config core.quotepath false

# ── 3. 파일 staging ────────────────────────────────────────
Write-Host "[2/6] 커밋할 파일 추가..." -ForegroundColor Cyan
git add .

$fileCount = (git diff --cached --name-only | Measure-Object -Line).Lines
Write-Host "       → $fileCount 개 파일 추가됨" -ForegroundColor Green

# ── 4. 민감 파일 검사 ──────────────────────────────────────
Write-Host "[3/6] 민감 파일 검사 (.env, node_modules)..." -ForegroundColor Cyan
$sensitive = git diff --cached --name-only | Select-String -Pattern "\.env|node_modules|\.next/|files\.zip"
if ($sensitive) {
  Write-Host "[ERROR] 민감 파일이 staging 됐습니다:" -ForegroundColor Red
  $sensitive | ForEach-Object { Write-Host "        - $_" -ForegroundColor Red }
  Read-Host "엔터를 누르면 종료. .gitignore 를 확인하세요."
  exit 1
}
Write-Host "       → OK: .env 등 민감 파일은 제외됨" -ForegroundColor Green

# ── 5. 첫 커밋 ─────────────────────────────────────────────
Write-Host "[4/6] 첫 커밋 생성..." -ForegroundColor Cyan
git commit -m "Initial commit: 발주Up MVP" | Out-Null
Write-Host "       → OK: 'Initial commit' 생성됨" -ForegroundColor Green

# ── 6. GitHub URL 입력 ─────────────────────────────────────
Write-Host ""
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Yellow
Write-Host "  GitHub 저장소 URL 을 입력하세요" -ForegroundColor Yellow
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Yellow
Write-Host ""
Write-Host "  예시: https://github.com/myname/baljuup.git"
Write-Host ""
Write-Host "  (아직 저장소가 없다면: github.com 우상단 [+] -> New repository"
Write-Host "   -> 이름 입력 -> Public -> README/gitignore/license 체크 끄기 -> Create)"
Write-Host ""
$repoUrl = Read-Host "GitHub URL"

if ([string]::IsNullOrWhiteSpace($repoUrl)) {
  Write-Host "[ERROR] URL 이 입력되지 않았습니다." -ForegroundColor Red
  exit 1
}

# ── 7. remote 등록 + push ──────────────────────────────────
Write-Host ""
Write-Host "[5/6] 원격 저장소 연결..." -ForegroundColor Cyan
git remote add origin $repoUrl

Write-Host "[6/6] GitHub 로 업로드 중 (push)..." -ForegroundColor Cyan
Write-Host ""
Write-Host "  → 사용자명/비밀번호 창이 뜨면:" -ForegroundColor Yellow
Write-Host "    Username = GitHub 사용자명" -ForegroundColor Yellow
Write-Host "    Password = Personal Access Token (비밀번호 아님!)" -ForegroundColor Yellow
Write-Host ""
Write-Host "    토큰 만드는 법:" -ForegroundColor Yellow
Write-Host "    github.com -> 우상단 프로필 -> Settings -> Developer settings" -ForegroundColor Yellow
Write-Host "    -> Personal access tokens -> Tokens (classic)" -ForegroundColor Yellow
Write-Host "    -> Generate new token (classic)" -ForegroundColor Yellow
Write-Host "    -> 권한 'repo' 만 체크 -> 생성된 토큰 복사" -ForegroundColor Yellow
Write-Host ""

git push -u origin main

if ($LASTEXITCODE -eq 0) {
  Write-Host ""
  Write-Host "════════════════════════════════════════════════════" -ForegroundColor Green
  Write-Host "  ✓ 성공!" -ForegroundColor Green
  Write-Host "════════════════════════════════════════════════════" -ForegroundColor Green
  Write-Host ""
  Write-Host "  GitHub 저장소를 새로고침해서 파일들이 보이는지 확인하세요." -ForegroundColor Green
  Write-Host "  URL: $repoUrl" -ForegroundColor Green
  Write-Host ""
  Write-Host "  다음 단계:" -ForegroundColor Cyan
  Write-Host "    1) vercel.com 접속 -> Sign Up with GitHub" -ForegroundColor White
  Write-Host "    2) Add New -> Project -> 방금 만든 저장소 Import" -ForegroundColor White
  Write-Host "    3) Root Directory 를 'waterproof-app' 으로 변경" -ForegroundColor White
  Write-Host "    4) 환경변수 6개 입력 (환경변수_체크리스트.md 참고)" -ForegroundColor White
  Write-Host "    5) Deploy 클릭" -ForegroundColor White
  Write-Host ""
}
else {
  Write-Host ""
  Write-Host "[ERROR] push 실패. 위 에러 메시지를 확인하세요." -ForegroundColor Red
  Write-Host ""
  Write-Host "자주 발생하는 원인:" -ForegroundColor Yellow
  Write-Host "  1) Personal Access Token 이 아닌 비밀번호 입력" -ForegroundColor Yellow
  Write-Host "  2) GitHub 저장소가 비어있지 않음 (README 가 이미 있으면 충돌)" -ForegroundColor Yellow
  Write-Host "  3) URL 오타" -ForegroundColor Yellow
}

Read-Host "엔터를 누르면 종료"
