@echo off
rem futari-calendar: start the bot and restart it automatically if it stops
chcp 65001 > nul
cd /d "%~dp0"
if not exist "node_modules\discord.js" (
  echo [futari-calendar] installing packages... please wait 1-2 minutes
  call npm.cmd install
)
if not exist ".env" (
  echo [futari-calendar] .env is missing. Copy .env.example to .env and write your token.
  pause
  exit /b 1
)
set BOT_LOOP=1
:loop
node --env-file=.env bot.js
echo [futari-calendar] bot stopped. restarting in 10 seconds... (close this window to quit)
ping -n 11 127.0.0.1 > nul
goto loop
