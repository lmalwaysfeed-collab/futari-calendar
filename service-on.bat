@echo off
rem futari-calendar: run the bot in the background from PC startup,
rem even when nobody is logged in or after you sign out.
rem Right-click this file and choose "Run as administrator".

net session >nul 2>&1
if not %errorlevel%==0 (
  echo.
  echo  Please right-click this file and choose "Run as administrator".
  echo.
  pause
  exit /b 1
)

cd /d "%~dp0"
if not exist ".env" (
  echo .env is missing. Put your .env in this folder first.
  pause
  exit /b 1
)

echo Stopping the bot that is running now...
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*start-bot.bat*' -or ($_.CommandLine -like '*bot.js*' -and $_.CommandLine -like '*env-file*') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
if exist "%~dp0start-bot.bat.new" move /y "%~dp0start-bot.bat.new" "%~dp0start-bot.bat" > nul
schtasks /delete /tn "FutariCalendar" /f >nul 2>&1

echo.
echo Registering. Windows will ask for the password of "%USERNAME%".
echo (If you sign in with a PIN, type your Microsoft account password.)
echo.
schtasks /create /tn "FutariCalendar" /tr "\"%~dp0start-bot.bat\"" /sc onstart /delay 0001:00 /ru "%USERDOMAIN%\%USERNAME%" /rp * /rl highest /f
if not %errorlevel%==0 (
  echo.
  echo Failed. Check the password and try again.
  pause
  exit /b 1
)
schtasks /run /tn "FutariCalendar" >nul
echo.
echo OK: futari-calendar now runs in the background.
echo  - It starts 1 minute after the PC turns on, even if nobody logs in.
echo  - Signing out or switching accounts does not stop it.
echo  - Logs are in bot.log in this folder.
echo  - To turn this off, run autostart-off.bat.
echo.
pause
