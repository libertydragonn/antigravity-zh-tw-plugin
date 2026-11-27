@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"
title Antigravity 中文化外掛 - 安裝 Powertools
echo ============================================
echo   Antigravity 中文化外掛 - 安裝 Powertools
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
echo [*] 安裝選用的 Agy Powertools（Antigravity 原生外掛，約 10~30 秒）。
echo     會修改 Antigravity 捷徑加上本機除錯連接埠參數，並重新啟動 Antigravity。
echo.
"%PY_EXE%" %PY_ARGS% "%~dp0install.py" --install-powertools
set "AGZH_CODE=%ERRORLEVEL%"
echo.
if not "%AGZH_CODE%"=="0" (
  echo [X] 執行失敗，錯誤碼 %AGZH_CODE%，詳見上方輸出與日誌。中文化與上下文看板不受影響。
  echo.
  pause
  exit /b %AGZH_CODE%
)
echo [OK] Powertools 已啟用：左側邊欄出現「Powertools」，介面語言為繁體中文。
echo [i] 它的上下文圓環與用量看板和「上下文看板」功能重疊，只想留一套可雙擊「移除上下文看板.bat」。
echo [i] 不想要 Powertools 時，雙擊「移除 Powertools.bat」即可（捷徑會還原）。
ping -n 5 127.0.0.1 >nul
endlocal
exit /b 0
