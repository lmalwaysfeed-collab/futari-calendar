@echo off
rem futari-calendar: stop every running copy of the bot (old ones too). Autostart setting is kept.
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*start-bot.bat*' -or ($_.CommandLine -like '*bot.js*' -and $_.CommandLine -like '*env-file*') } | ForEach-Object { Write-Host ('stop: ' + $_.ProcessId + ' ' + $_.CommandLine); Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
if exist "%~dp0start-bot.bat.new" move /y "%~dp0start-bot.bat.new" "%~dp0start-bot.bat" > nul
echo Done. All bots are stopped.
pause
