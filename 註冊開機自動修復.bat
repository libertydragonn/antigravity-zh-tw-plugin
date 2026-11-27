@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"
title Antigravity 中文化 - 註冊開機自動修復
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
echo [*] 正在註冊「登入時自動修復中文化」任務（客戶端更新後自動恢復中文）...
echo.
"%PY_EXE%" %PY_ARGS% "%~dp0install.py" --install-task
set "AGZH_CODE=%ERRORLEVEL%"
echo.
if not "%AGZH_CODE%"=="0" (
  echo [X] 註冊失敗，錯誤碼 %AGZH_CODE%。
  pause
  exit /b %AGZH_CODE%
)
echo [i] 取消方法：雙擊「取消開機自動修復.bat」。
ping -n 5 127.0.0.1 >nul
endlocal
exit /b 0
