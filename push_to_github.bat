@echo off
title Push SRCC Room Finder to GitHub
echo =======================================================
echo   SRCC ROOM FINDER - 1-CLICK GITHUB PUSH
echo =======================================================
echo.
cd /d "%~dp0"
set "PATH=%PATH%;C:\Users\anand_fua08yg\AppData\Local\Microsoft\WinGet\Packages\Git.MinGit_Microsoft.Winget.Source_8wekyb3d8bbwe\cmd"

echo Checking remote repository...
git remote -v
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo No remote found. Please enter your GitHub Repository URL.
    echo Example: https://github.com/your-username/srcc-room-finder.git
    set /p REPO_URL="Enter GitHub Repo URL: "
    git remote add origin %REPO_URL%
)

echo.
echo Pushing latest code to GitHub (branch: main)...
git push -u origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo =======================================================
    echo   SUCCESS! Pushed all files to GitHub repository.
    echo =======================================================
) else (
    echo.
    echo [NOTE] If GitHub asks for a password, use your GitHub Personal Access Token (PAT).
)
echo.
pause
