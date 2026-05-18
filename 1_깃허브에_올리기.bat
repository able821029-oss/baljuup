@echo off
chcp 65001 > nul
REM ════════════════════════════════════════════════════════════
REM  발주Up — GitHub 업로드 (더블클릭용)
REM
REM  이 파일을 더블클릭하면 PowerShell 스크립트가 자동 실행됩니다.
REM ════════════════════════════════════════════════════════════

cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp01_깃허브에_올리기.ps1"

pause
