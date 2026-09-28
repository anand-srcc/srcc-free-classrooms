@echo off
title SRCC Room Finder - GitHub 1-Click Login & Push
echo ===================================================================
echo   SRCC ROOM FINDER - GITHUB 1-CLICK AUTHENTICATION & PUSH
echo   Target: https://github.com/anand-srcc/srcc-free-classrooms
echo ===================================================================
echo.
cd /d "%~dp0"

set "GH_PATH=C:\Users\anand_fua08yg\AppData\Local\Microsoft\WinGet\Packages\GitHub.cli_Microsoft.Winget.Source_8wekyb3d8bbwe\bin"
set "GIT_PATH=C:\Users\anand_fua08yg\AppData\Local\Microsoft\WinGet\Packages\Git.MinGit_Microsoft.Winget.Source_8wekyb3d8bbwe\cmd"
set "PATH=%GH_PATH%;%GIT_PATH%;%PATH%"

echo [1/3] Checking GitHub login status...
gh auth status 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [*] Opening GitHub login in your browser...
    echo [*] A code will appear on screen - simply approve it in your browser!
    echo.
    gh auth login --web -h github.com -p https -w
)

echo.
echo [2/3] Configuring Git authentication...
gh auth setup-git

echo.
echo [3/3] Pushing latest code to https://github.com/anand-srcc/srcc-free-classrooms...
git remote remove origin 2>nul
git remote add origin https://github.com/anand-srcc/srcc-free-classrooms.git
git push -f -u origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ===================================================================
    echo   🎉 SUCCESS! All files and updates pushed to GitHub!
    echo   Repo: https://github.com/anand-srcc/srcc-free-classrooms
    echo   Pages: https://anand-srcc.github.io/srcc-free-classrooms/
    echo ===================================================================
) else (
    echo.
    echo [ERROR] Push failed. If you have a Personal Access Token (PAT),
    echo you can also use push_to_github.bat.
)

echo.
pause
