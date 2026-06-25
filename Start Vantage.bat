@echo off
setlocal
title Vantage
cd /d "%~dp0"

cls
echo.
echo   VANTAGE  ^|  Power Platform Engineering Toolkit
echo   ================================================
echo.

if exist "runtime\node.exe" goto :portable_release

if not exist "backend\.env" type nul > "backend\.env"

where docker >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    docker info >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo   Docker detected. Starting Vantage...
        docker compose up --build -d
        if %ERRORLEVEL% EQU 0 (
            timeout /t 2 >nul
            start http://127.0.0.1:3001
            echo.
            echo   Vantage is running at http://127.0.0.1:3001
            echo   To stop: docker compose down
            pause
            exit /b 0
        )
    )
)

where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo   [ERROR] This source checkout requires Docker Desktop or Node.js.
    pause
    exit /b 1
)

if not exist "backend\node_modules" (
    pushd backend
    call npm install
    popd
)
if not exist "frontend\node_modules" (
    pushd frontend
    call npm install
    popd
)
if not exist "frontend\dist" (
    pushd frontend
    call npm run build
    popd
)
if not exist "backend\dist" (
    pushd backend
    call npm run build
    popd
)

set "HOST=127.0.0.1"
set "PORT=3001"
start /B cmd /c "timeout /t 3 >nul && start http://127.0.0.1:3001"
pushd backend
node dist\index.js
popd
exit /b %ERRORLEVEL%

:portable_release
if not exist ".env" (
    if exist ".env.example" copy ".env.example" ".env" >nul
)

set "NODE_ENV=production"
set "HOST=127.0.0.1"
set "PORT=3001"
set "VANTAGE_DATA_DIR=%~dp0data"
set "VANTAGE_ENV_PATH=%~dp0.env"

echo   Starting the portable release...
echo   Vantage will open at http://127.0.0.1:3001
echo   Close this window to stop Vantage.
echo.

start /B cmd /c "timeout /t 3 >nul && start http://127.0.0.1:3001"
"%~dp0runtime\node.exe" "%~dp0backend\dist\index.js"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo   [ERROR] Vantage stopped unexpectedly.
    pause
)
