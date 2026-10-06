@echo off
rem futari-calendar: remove autostart and stop the running bot
schtasks /delete /tn "FutariCalendar" /f
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*start-bot.bat*' -or ($_.CommandLine -like '*bot.js*' -and $_.CommandLine -like '*env-file*') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
echo OK: autostart removed and the bot was stopped.
pause
