@echo off
echo.
echo ============================================
echo  AquaSense - Local Dev Startup (No Docker)
echo ============================================
echo.
echo This script runs the backend without Docker.
echo Requires: Node.js, MongoDB Community installed locally.
echo.
echo Step 1: Checking Node.js...
node --version
if %errorlevel% neq 0 (
  echo ERROR: Node.js not found. Download from https://nodejs.org
  pause & exit /b 1
)

echo.
echo Step 2: Installing dependencies...
call npm install
if %errorlevel% neq 0 (
  echo ERROR: npm install failed.
  pause & exit /b 1
)

echo.
echo Step 3: Starting backend (uses .env for config)...
echo  Backend  : http://localhost:5000
echo  MongoDB  : mongodb://localhost:27017/aquasense
echo  API Key  : changeme
echo.
echo Press Ctrl+C to stop.
echo.
call npm run dev
pause
