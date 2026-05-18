[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

function Say($text, $color = "White") {
  Write-Host $text -ForegroundColor $color
}

Say ""
Say "===================================================" "Cyan"
Say "  Push update to GitHub" "Cyan"
Say "===================================================" "Cyan"
Say ""

# Check git
try {
  $gitVer = git --version
  Say "[OK] $gitVer" "Green"
}
catch {
  Say "[ERROR] Git not installed." "Red"
  Read-Host "Press Enter to exit"
  exit 1
}

# Check repo exists
if (-not (Test-Path .git)) {
  Say "[ERROR] No .git folder found." "Red"
  Say "        Run push.bat first to set up the repo." "Red"
  Read-Host "Press Enter to exit"
  exit 1
}

Say ""
Say "[1/4] Checking changes..." "Cyan"
$changes = git status --short
if (-not $changes) {
  Say "       -> No changes to push" "Yellow"
  Read-Host "Press Enter to exit"
  exit 0
}
$changes | ForEach-Object { Say "       $_" "White" }

Say ""
Say "[2/4] Staging changes..." "Cyan"
git add .

Say "[3/4] Committing..." "Cyan"
git commit -m "fix: remove node:buffer import for webpack client bundle"

Say "[4/4] Pushing to GitHub..." "Cyan"
Say ""
Say "  >> If a login popup appears:" "Yellow"
Say "     Username = GitHub username" "Yellow"
Say "     Password = Personal Access Token (ghp_...)" "Yellow"
Say ""

git push

if ($LASTEXITCODE -eq 0) {
  Say ""
  Say "===================================================" "Green"
  Say "  SUCCESS!" "Green"
  Say "===================================================" "Green"
  Say ""
  Say "  -> Go to Vercel: deployment will start automatically" "Cyan"
  Say "  -> Wait 2-3 minutes for the new build" "Cyan"
  Say ""
}
else {
  Say ""
  Say "[ERROR] Push failed." "Red"
}

Read-Host "Press Enter to exit"
