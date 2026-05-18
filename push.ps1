[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

function Say($text, $color = "White") {
  Write-Host $text -ForegroundColor $color
}

Say ""
Say "===================================================" "Cyan"
Say "  baljuup - GitHub Upload" "Cyan"
Say "===================================================" "Cyan"
Say ""

# ---- 0. Git installed? -----------------------------------
try {
  $gitVer = git --version
  Say "[OK] $gitVer" "Green"
}
catch {
  Say "[ERROR] Git is not installed." "Red"
  Say "        Install from: https://git-scm.com/download/win" "Red"
  Read-Host "Press Enter to exit"
  exit 1
}

# ---- 1. Clean broken .git folder if exists ---------------
if (Test-Path .git) {
  Say ""
  Say "Existing .git folder found. Resetting..." "Yellow"
  try {
    Remove-Item -Recurse -Force .git -ErrorAction Stop
  }
  catch {
    Say "[ERROR] Cannot remove .git folder. Delete it manually and retry." "Red"
    Read-Host "Press Enter to exit"
    exit 1
  }
}

# ---- 2. git init -----------------------------------------
Say ""
Say "[1/5] Initializing git repository..." "Cyan"
git init -b main | Out-Null

git config user.email "able821029@gmail.com"
git config user.name "able"
git config core.quotepath false

# ---- 3. Stage files --------------------------------------
Say "[2/5] Staging files..." "Cyan"
git add .

$fileCount = (git diff --cached --name-only | Measure-Object -Line).Lines
Say "       -> $fileCount files staged" "Green"

# ---- 4. Check no sensitive files -------------------------
Say "[3/5] Checking for sensitive files..." "Cyan"
$staged = git diff --cached --name-only
$sensitive = $staged | Where-Object {
  ($_ -match "\.env" -and $_ -notmatch "\.example$") -or
  $_ -match "node_modules" -or
  $_ -match "\.next/" -or
  $_ -match "files\.zip$"
}
if ($sensitive) {
  Say "[ERROR] Sensitive files staged:" "Red"
  $sensitive | ForEach-Object { Say "        - $_" "Red" }
  Read-Host "Press Enter to exit. Check .gitignore."
  exit 1
}
Say "       -> OK: real .env / node_modules excluded (templates allowed)" "Green"

# ---- 5. First commit -------------------------------------
Say "[4/5] Creating first commit..." "Cyan"
git commit -m "Initial commit: baljuup MVP" | Out-Null
Say "       -> OK" "Green"

# ---- 6. Ask for GitHub URL -------------------------------
Say ""
Say "===================================================" "Yellow"
Say "  Paste your GitHub repo URL" "Yellow"
Say "===================================================" "Yellow"
Say ""
Say "  Example: https://github.com/yourname/baljuup.git"
Say ""
$repoUrl = Read-Host "GitHub URL"

if ([string]::IsNullOrWhiteSpace($repoUrl)) {
  Say "[ERROR] No URL entered." "Red"
  Read-Host "Press Enter to exit"
  exit 1
}

# ---- 7. Add remote + push --------------------------------
Say ""
Say "[5/5] Connecting remote and pushing..." "Cyan"
git remote add origin $repoUrl

Say ""
Say "  >> If a login popup appears:" "Yellow"
Say "     Username = GitHub username" "Yellow"
Say "     Password = Personal Access Token (ghp_... NOT your password)" "Yellow"
Say ""

git push -u origin main

if ($LASTEXITCODE -eq 0) {
  Say ""
  Say "===================================================" "Green"
  Say "  SUCCESS!" "Green"
  Say "===================================================" "Green"
  Say ""
  Say "  Repo: $repoUrl" "Green"
  Say ""
  Say "  Next: go to vercel.com -> Sign Up with GitHub" "Cyan"
  Say "        -> Import this repo" "Cyan"
  Say "        -> Root Directory = waterproof-app" "Cyan"
  Say "        -> Add env vars (see hwangyongbyeonsu_checklist.md)" "Cyan"
  Say "        -> Deploy" "Cyan"
  Say ""
}
else {
  Say ""
  Say "[ERROR] Push failed. Check the error message above." "Red"
  Say ""
  Say "Common causes:" "Yellow"
  Say "  1) You typed your password instead of a Personal Access Token" "Yellow"
  Say "  2) Repo is not empty (already has README/license)" "Yellow"
  Say "  3) URL typo" "Yellow"
}

Read-Host "Press Enter to exit"
