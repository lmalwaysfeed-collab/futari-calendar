@echo off
rem futari-calendar: start automatically when you log in to this PC
schtasks /create /tn "FutariCalendar" /tr "wscript.exe \"%~dp0start-hidden.vbs\"" /sc onlogon /rl limited /f
if %errorlevel%==0 (
  echo OK: futari-calendar will start automatically when you log in.
  echo Starting it now...
  wscript.exe "%~dp0start-hidden.vbs"
) else (
  echo Failed. Right-click this file and choose "Run as administrator".
)
pause
