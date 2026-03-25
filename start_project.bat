@echo off
setlocal EnableDelayedExpansion

echo =========================================
echo   CaiTi Web Application - Dev Server
echo =========================================
echo.

cd /d "%~dp0"

echo Current directory: %CD%
echo.

set "NODE_PATH="
set "NPM_PATH="

for /f "tokens=2*" %%a in ('reg query "HKLM\SOFTWARE\Node.js" /v InstallPath 2^>nul') do (
    set "NODE_PATH=%%b"
)

if not defined NODE_PATH if exist "C:\Program Files\nodejs\node.exe" (
    set "NODE_PATH=C:\Program Files\nodejs\"
)

if not defined NODE_PATH if exist "%APPDATA%\npm\node.exe" (
    set "NODE_PATH=%APPDATA%\npm\"
)

if defined NODE_PATH (
    set "NPM_PATH=%NODE_PATH%"
    echo Found Node.js at: %NODE_PATH%
) else (
    echo.
    echo =========================================
    echo ERROR: Node.js not found!
    echo =========================================
    echo.
    echo Please install Node.js from: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo.

if not exist package.json (
    echo ERROR: package.json not found!
    pause
    exit /b 1
)

if not exist node_modules\vite (
    echo Installing dependencies...
    echo This may take a few minutes...
    echo.
    call "%NPM_PATH%npm.cmd" install
    if errorlevel 1 (
        echo.
        echo ERROR: Failed to install dependencies
        pause
        exit /b 1
    )
    echo.
    echo Dependencies installed!
    echo.
) else (
    echo Dependencies already installed.
    echo.
)

echo Starting development server...
echo Open: http://localhost:5173
echo.
echo Press Ctrl+C to stop.
echo.

start http://localhost:5173
call "%NPM_PATH%npm.cmd" run dev

pause
