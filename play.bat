@echo off
setlocal
cd /d "%~dp0"
title BREAK A LEG

where node >nul 2>nul
if errorlevel 1 (
  echo [BREAK A LEG] Node.js was not found. Install it from https://nodejs.org and run this again.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [BREAK A LEG] Installing dependencies ^(first run only^)...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo [BREAK A LEG] npm install failed.
    pause
    exit /b 1
  )
)

echo [BREAK A LEG] Building...
call npm run build
if errorlevel 1 (
  echo [BREAK A LEG] Build failed.
  pause
  exit /b 1
)

echo [BREAK A LEG] Opening http://localhost:4173  ^(close this window to stop the game server^)
call npx vite preview --port 4173 --open
