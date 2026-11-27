@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"
title Antigravity 中文化外掛 - 移除上下文看板
echo ============================================
echo   Antigravity 中文化外掛 - 移除上下文看板
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
echo [*] 正在移除上下文看板（還原官方原版後只重新安裝中文化，約 20~40 秒）...
echo.
"%PY_EXE%" %PY_ARGS% "%~dp0install.py" --remove-viewer
set "AGZH_CODE=%ERRORLEVEL%"
echo.
if not "%AGZH_CODE%"=="0" (
  if "%AGZH_CODE%"=="3" (
    echo [X] 補丁與當前客戶端版本不相容。
    echo     安裝器已【自動還原官方版本】，客戶端仍然可以正常開啟。
    echo     請把上面的日誌檔案發給作者，等待適配。
  ) else (
    echo [X] 執行失敗，錯誤碼 %AGZH_CODE%，詳見上方輸出與日誌。
  )
  echo.
  pause
  exit /b %AGZH_CODE%
)
echo [OK] 上下文看板已移除，中文化保留。
echo [i] 想再裝回看板，雙擊「安裝上下文看板.bat」。
ping -n 5 127.0.0.1 >nul
endlocal
exit /b 0
