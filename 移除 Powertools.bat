@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"
title Antigravity 中文化外掛 - 移除 Powertools
echo ============================================
echo   Antigravity 中文化外掛 - 移除 Powertools
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
echo [*] 解除安裝 Agy Powertools（先備份它的設定，重新安裝時還原），還原 Antigravity 捷徑並重新啟動 Antigravity ...
echo.
"%PY_EXE%" %PY_ARGS% "%~dp0install.py" --remove-powertools
set "AGZH_CODE=%ERRORLEVEL%"
echo.
if not "%AGZH_CODE%"=="0" (
  echo [X] 執行失敗，錯誤碼 %AGZH_CODE%，詳見上方輸出與日誌。中文化與上下文看板不受影響。
  echo.
  pause
  exit /b %AGZH_CODE%
)
echo [OK] Powertools 已移除，中文化與上下文看板保留。
echo [i] 想再裝回，雙擊「安裝 Powertools.bat」。
ping -n 5 127.0.0.1 >nul
endlocal
exit /b 0
