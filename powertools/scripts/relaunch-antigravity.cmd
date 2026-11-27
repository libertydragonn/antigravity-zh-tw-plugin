@echo off
title Agy Powertools - Restarting Antigravity
echo Restarting Antigravity...
set "WORKER=%~dp0relaunch-worker.mjs"
set "JOB=%~1"
if "%JOB%"=="" set "JOB=%USERPROFILE%\.gemini\antigravity\plugin_data\agy-powertools\relaunch-job.json"
where node.exe >nul 2>&1
if not errorlevel 1 goto :run_node
if exist "%APPDATA%\Antigravity\bin\agy-node.exe" goto :run_agynode_exe
if exist "%APPDATA%\Antigravity\bin\agy-node.cmd" goto :run_agynode_cmd
if exist "%LOCALAPPDATA%\Programs\antigravity\Antigravity.exe" goto :run_local_agy
if exist "%ProgramFiles%\Antigravity\Antigravity.exe" goto :run_prog_agy
exit /b 1

:run_node
node.exe "%WORKER%" "%JOB%"
if not errorlevel 1 exit /b 0
if not exist "%JOB%" exit /b %ERRORLEVEL%
if exist "%APPDATA%\Antigravity\bin\agy-node.exe" goto :run_agynode_exe
if exist "%APPDATA%\Antigravity\bin\agy-node.cmd" goto :run_agynode_cmd
if exist "%LOCALAPPDATA%\Programs\antigravity\Antigravity.exe" goto :run_local_agy
if exist "%ProgramFiles%\Antigravity\Antigravity.exe" goto :run_prog_agy
exit /b 1

:run_agynode_exe
"%APPDATA%\Antigravity\bin\agy-node.exe" "%WORKER%" "%JOB%"
exit /b %ERRORLEVEL%

:run_agynode_cmd
call "%APPDATA%\Antigravity\bin\agy-node.cmd" "%WORKER%" "%JOB%"
exit /b %ERRORLEVEL%

:run_local_agy
set "ELECTRON_RUN_AS_NODE=1"
"%LOCALAPPDATA%\Programs\antigravity\Antigravity.exe" "%WORKER%" "%JOB%"
exit /b %ERRORLEVEL%

:run_prog_agy
set "ELECTRON_RUN_AS_NODE=1"
"%ProgramFiles%\Antigravity\Antigravity.exe" "%WORKER%" "%JOB%"
exit /b %ERRORLEVEL%
