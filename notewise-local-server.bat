@echo off
setlocal EnableExtensions

cd /d "%~dp0"
set "APP_PORT=%~1"
if not defined APP_PORT set "APP_PORT=3000"
call npm run dev -- --host 127.0.0.1 --port %APP_PORT% --strictPort
