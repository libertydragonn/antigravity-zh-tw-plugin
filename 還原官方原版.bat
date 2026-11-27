@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"
title Antigravity 中文化外掛 - 還原官方原版
echo ============================================
echo   Antigravity 中文化外掛 - 還原官方原版
echo ============================================
echo.
set "PYTHONUTF8=1"
set "PYTHONIOENCODING=utf-8"
set "PY_EXE="
set "PY_ARGS="
if exist "%~dp0runtime\python.exe" set "PY_EXE=%~dp0runtime\python.exe"
if not defined PY_EXE (
  where python >nul 2>&1
  if not errorlevel 1 set "PY_EXE=python"
)
if not defined PY_EXE (
  where py >nul 2>&1
  if not errorlevel 1 (
    set "PY_EXE=py"
    set "PY_ARGS=-3"
  )
)
if not defined PY_EXE (
  echo.
  echo [ERR] 未找到 Python 執行環境。
  echo       外掛包自帶 runtime\python.exe；若解壓時丟失，請安裝 Python 3.8+ 後重試。
  echo       下載：https://www.python.org/downloads/
  echo.
  pause
  exit /b 1
)
echo [*] 正在還原官方原版（會校驗備份與當前客戶端版本是否一致）...
echo.
"%PY_EXE%" %PY_ARGS% "%~dp0install.py" --restore
set "AGZH_CODE=%ERRORLEVEL%"
echo.
if not "%AGZH_CODE%"=="0" (
  if "%AGZH_CODE%"=="4" (
    echo [X] 沒有可用於當前版本的官方備份，已拒絕還原（這是為了保護客戶端不被舊版本檔案破壞）。
    echo     解決辦法：先雙擊「安裝中文化外掛.bat」重新生成當前版本的官方備份，再還原；
    echo     或在 Antigravity 裡執行「重新安裝 / 修復」。
  ) else (
    echo [X] 還原失敗，錯誤碼 %AGZH_CODE%。
  )
  echo.
  pause
  exit /b %AGZH_CODE%
)
echo [OK] 已還原，下次啟動即為官方英文版。
ping -n 5 127.0.0.1 >nul
endlocal
exit /b 0
