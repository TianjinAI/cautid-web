@echo off
echo =========================================
echo   Setting up Git Repository
echo =========================================
echo.

REM Change to the project directory
cd /d "%~dp0"

echo Current directory: %CD%
echo.

REM Check if git is installed
where git >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Git is not installed or not in PATH
    echo Please install Git from https://git-scm.com/
    pause
    exit /b 1
)

echo Git version:
git --version
echo.

REM Initialize git repository
echo Initializing git repository...
git init
echo.

REM Configure git user (you can change these)
echo Configuring git user...
git config user.name "Your Name"
git config user.email "your.email@example.com"
echo.

REM Add all files
echo Adding all files to git...
git add .
echo.

REM Create initial commit
echo Creating initial commit...
git commit -m "Initial commit: WeChat mini-program to web application conversion"
echo.

REM Show git status
echo Git repository setup complete!
echo.
git status
echo.

echo =========================================
echo Next steps:
echo 1. Review the commit: git log -1
echo 2. Add a remote repository: git remote add origin <your-repo-url>
echo 3. Push to remote: git push -u origin main
echo =========================================
echo.

pause
