@echo off
setlocal enabledelayedexpansion
title Vantage
cd /d "%~dp0"

cls
echo.
echo   VANTAGE  ^|  Power Platform Engineering Toolkit
echo   ================================================
echo.

:: ── 1. Ensure backend\.env exists ────────────────────────────────────────────
if not exist "backend\.env" (
    echo   First-time setup: credentials file not found.
    echo.
    copy "backend\.env.example" "backend\.env" >nul 2>&1
    echo   A template has been opened in Notepad.
    echo   Fill in your Azure credentials and API key, then save and close Notepad.
    echo   This window will continue automatically.
    echo.
    notepad "backend\.env"
    echo.
)

:: Abort if credentials are still placeholders
findstr /c:"<AZURE_TENANT_ID>" "backend\.env" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo   [ERROR] Credentials not filled in. Edit backend\.env and try again.
    echo.
    pause
    exit /b 1
)

:: ── 2. Try Docker (preferred — no Node.js install needed) ────────────────────
where docker >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    docker info >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo   Docker detected. Starting Vantage...
        echo.
        docker compose up --build -d
        if %ERRORLEVEL% NEQ 0 goto :node_fallback
        echo.
        echo   Vantage is running at http://localhost:3001
        timeout /t 2 >nul
        start http://localhost:3001
        echo.
        echo   To stop:  docker compose down
        echo   To view logs:  docker compose logs -f
        echo.
        pause
        exit /b 0
    )
)

:node_fallback
:: ── 3. Fall back to Node.js ──────────────────────────────────────────────────
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo   [ERROR] Neither Docker nor Node.js is installed.
    echo.
    echo   Option A (recommended): Install Docker Desktop
    echo     https://www.docker.com/products/docker-desktop
    echo.
    echo   Option B: Install Node.js
    echo     https://nodejs.org
    echo.
    start https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

echo   Node.js detected. Starting Vantage...
echo.

:: Install backend deps (first run only)
if not exist "backend\node_modules" (
    echo   Installing backend dependencies (first run, ~30 seconds)...
    pushd backend && call npm install --silent 2>nul && popd
    echo   Done.
)

:: Install frontend deps (first run only)
if not exist "frontend\node_modules" (
    echo   Installing frontend dependencies (first run, ~30 seconds)...
    pushd frontend && call npm install --silent 2>nul && popd
    echo   Done.
)

:: Build frontend (first run only — API key fetched at runtime)
if not exist "frontend\dist" (
    echo   Building frontend (first run, ~30 seconds)...
    (
        echo VITE_API_URL=
        echo VITE_API_KEY=
    ) > "frontend\.env"
    pushd frontend && call npm run build 2>nul && popd
    echo   Done.
)

:: Build backend (first run only)
if not exist "backend\dist" (
    echo   Compiling backend (first run, ~10 seconds)...
    pushd backend && call npm run build 2>nul && popd
    echo   Done.
)

echo.
echo   Starting Vantage...
echo   Opening http://localhost:3001 in a few seconds...
echo   Close this window to stop Vantage.
echo.

start /B cmd /c "timeout /t 4 >nul && start http://localhost:3001"

pushd backend
node dist\index.js
popd
