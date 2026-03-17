@echo off
echo Starting Caution Web Application...
echo.

REM Change to the project directory
cd /d "%~dp0"

REM Install dependencies if not already installed
if not exist node_modules (
    echo Installing dependencies...
    npm install
    if errorlevel 1 (
        echo Failed to install dependencies
        pause
        exit /b 1
    )
)

REM Start the development server
echo Starting development server...
npm run dev

pause