@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "APP_DIR=%~dp0"
set "SERVER_SCRIPT=%APP_DIR%notewise-local-server.bat"
set "PID_FILE=%APP_DIR%.notewise-local.pid"
set "PORT_FILE=%APP_DIR%.notewise-local.port"
set "LOG_FILE=%APP_DIR%notewise-local.log"

if /I "%~1"=="start" (
  call :start
  exit /b !ERRORLEVEL!
)
if /I "%~1"=="stop" (
  call :stop
  exit /b !ERRORLEVEL!
)
if /I "%~1"=="status" (
  call :status
  exit /b !ERRORLEVEL!
)
if /I "%~1"=="open" (
  call :load_port
  start "" "http://127.0.0.1:!APP_PORT!"
  exit /b 0
)
if not "%~1"=="" (
  echo Unknown command: %~1
  echo Use: start, stop, status, or open.
  exit /b 2
)

:menu
call :load_port
cls
echo.
echo   Notewise — local launcher
echo   http://127.0.0.1:!APP_PORT!
echo.
echo   [1] Start
echo   [2] Stop
echo   [3] Status
echo   [4] Open in browser
echo   [5] Exit
echo.
choice /c 12345 /n /m "Choose an action"
if errorlevel 5 exit /b 0
if errorlevel 4 (
  call :load_port
  start "" "http://127.0.0.1:!APP_PORT!"
  goto menu
)
if errorlevel 3 (
  call :status
  pause
  goto menu
)
if errorlevel 2 (
  call :stop
  pause
  goto menu
)
if errorlevel 1 (
  call :start
  pause
  goto menu
)

:start
call :get_running_pid
if defined RUNNING_PID (
  call :load_port
  echo Notewise is already running at http://127.0.0.1:!APP_PORT!
  exit /b 0
)

where npm >nul 2>&1
if errorlevel 1 (
  echo npm was not found. Install Node.js, then try again.
  exit /b 1
)

if not exist "%SERVER_SCRIPT%" (
  echo Missing server script: %SERVER_SCRIPT%
  exit /b 1
)

call :find_port
if not defined APP_PORT (
  echo Could not find a free local port between 8200 and 8210.
  exit /b 1
)
>"%PORT_FILE%" echo !APP_PORT!
if not "!APP_PORT!"=="8200" echo Port 8200 is busy. Notewise will use port !APP_PORT!.

del "%PID_FILE%" >nul 2>&1
powershell -NoProfile -ExecutionPolicy Bypass -Command "$server = '%SERVER_SCRIPT%'; $log = '%LOG_FILE%'; $quote = [char]34; $command = 'call ' + $quote + $server + $quote + ' !APP_PORT! ^> ' + $quote + $log + $quote + ' 2^>^&1'; $process = Start-Process -FilePath $env:ComSpec -ArgumentList '/d','/c',$command -WorkingDirectory '%APP_DIR%' -WindowStyle Hidden -PassThru; Set-Content -LiteralPath '%PID_FILE%' -Value $process.Id -NoNewline"
if errorlevel 1 (
  echo Could not start the local server.
  exit /b 1
)

timeout /t 2 /nobreak >nul
call :get_running_pid
if not defined RUNNING_PID (
  del "%PORT_FILE%" >nul 2>&1
  echo The server stopped during startup. See notewise-local.log for details.
  exit /b 1
)

start "" "http://127.0.0.1:!APP_PORT!"
echo Notewise is running locally. This window can now be closed.
exit /b 0

:stop
call :get_running_pid
if not defined RUNNING_PID (
  echo Notewise is not running locally.
  del "%PID_FILE%" >nul 2>&1
  del "%PORT_FILE%" >nul 2>&1
  exit /b 0
)

taskkill /PID %RUNNING_PID% /T /F >nul 2>&1
if errorlevel 1 (
  echo Could not stop the local server. Try running this file as your Windows user.
  exit /b 1
)

del "%PID_FILE%" >nul 2>&1
del "%PORT_FILE%" >nul 2>&1
echo Notewise has stopped.
exit /b 0

:status
call :get_running_pid
if defined RUNNING_PID (
  call :load_port
  echo Notewise is running locally at http://127.0.0.1:!APP_PORT!
  exit /b 0
)

echo Notewise is not running locally.
exit /b 1

:get_running_pid
set "RUNNING_PID="
if not exist "%PID_FILE%" exit /b 1

set /p "CANDIDATE_PID="<"%PID_FILE%"
if "%CANDIDATE_PID%"=="" exit /b 1

powershell -NoProfile -Command "$process = Get-CimInstance Win32_Process -Filter 'ProcessId=%CANDIDATE_PID%' -ErrorAction SilentlyContinue; if ($process -and $process.CommandLine -like '*notewise-local-server.bat*') { exit 0 }; exit 1" >nul 2>&1
if errorlevel 1 exit /b 1

set "RUNNING_PID=%CANDIDATE_PID%"
exit /b 0

:load_port
set "APP_PORT=8200"
if exist "%PORT_FILE%" set /p "APP_PORT="<"%PORT_FILE%"
exit /b 0

:find_port
set "APP_PORT="
for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "$used = [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners().Port; 8200..8210 | Where-Object { $_ -notin $used } | Select-Object -First 1"`) do set "APP_PORT=%%P"
exit /b 0
