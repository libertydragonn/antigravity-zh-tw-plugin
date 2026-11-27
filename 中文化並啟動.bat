@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"
title Antigravity 中文化並啟動
echo [*] 檢查中文化狀態...
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
"%PY_EXE%" %PY_ARGS% "%~dp0install.py" --auto
set "AGZH_CODE=%ERRORLEVEL%"
if not "%AGZH_CODE%"=="0" (
  echo.
  echo [X] 啟動失敗，錯誤碼 %AGZH_CODE%。
  echo     若提示不相容，說明中文化已自動還原，可直接雙擊原版 Antigravity 圖示。
  pause
  exit /b %AGZH_CODE%
)
ping -n 3 127.0.0.1 >nul
endlocal
exit /b 0
