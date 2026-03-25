@echo off
setlocal EnableDelayedExpansion

cd /d "%~dp0"

echo =========================================
echo   CaiTi Web Application - Fix Dependencies
echo =========================================
echo.
echo Current directory: %CD%
echo.

echo Removing node_modules and package-lock.json...
rmdir /s /q node_modules 2>nul
del /q package-lock.json 2>nul

echo.
echo Installing dependencies from scratch...
echo This may take a few minutes...
echo.

set "NPM_PATH=C:\Program Files\nodejs\"
call "%NPM_PATH%npm.cmd" cache clean --force 2>nul
call "%NPM_PATH%npm.cmd" install

if errorlevel 1 (
    echo.
    echo ERROR: Failed to install dependencies
    echo.
    echo Please try running manually:
    echo   cd /d "D:\Projects\
    echo   npm install
    echo.
    pause
    exit /b 1
)

echo.
echo =========================================
echo Dependencies installed successfully!
echo =========================================
echo.
echo You can now run: start_project.bat
echo.

pause
