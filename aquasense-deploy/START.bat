@echo off
title AquaSense - Full Stack Launcher
color 0A

echo.
echo  ==========================================
echo    AquaSense Water Quality Monitor
echo    Full Stack Startup
echo  ==========================================
echo.

REM Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
  echo  [ERROR] Docker is not running!
  echo  Please start Docker Desktop and try again.
  pause
  exit /b 1
)

echo  [1/3] Stopping any existing containers...
docker compose down >nul 2>&1

echo  [2/3] Building and starting all services...
echo        This takes 2-3 minutes on first run.
echo.
docker compose up --build -d

if %errorlevel% neq 0 (
  echo.
  echo  [ERROR] Failed to start. Check logs:
  echo    docker compose logs
  pause
  exit /b 1
)

echo.
echo  [3/3] Waiting for services to be ready...
timeout /t 20 /nobreak >nul

echo.
echo  ==========================================
echo    All services started successfully!
echo  ==========================================
echo.
echo    Dashboard  : http://localhost:3000
echo    Backend    : http://localhost:5000/health
echo    ML Service : http://localhost:8000/health
echo    MongoDB    : localhost:27017
echo.
echo  To run the sensor simulator:
echo    cd aquasense-backend
echo    node scripts\simulate.js
echo.
echo  To stop everything:
echo    docker compose down
echo.
pause
