@echo off
rem futari-calendar: remove autostart and stop the running bot
schtasks /delete /tn "FutariCalendar" /f
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*start-bot.bat*' -or ($_.CommandLine -like '*bot.js*' -and $_.CommandLine -like '*env-file*') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
if exist "%~dp0start-bot.bat.new" move /y "%~dp0start-bot.bat.new" "%~dp0start-bot.bat" > nul
echo OK: autostart removed and the bot was stopped.
pause
