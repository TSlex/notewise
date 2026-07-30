@echo off
setlocal EnableExtensions

cd /d "%~dp0"
call npm run dev -- --host 127.0.0.1 --port 3000 --strictPort
