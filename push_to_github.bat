@echo off
title Push SRCC Room Finder to GitHub (anand-srcc/srcc-free-classrooms)
echo ===================================================================
echo   SRCC ROOM FINDER - 1-CLICK GITHUB PUSH
echo   Target Repository: https://github.com/anand-srcc/srcc-free-classrooms
echo ===================================================================
echo.
cd /d "%~dp0"
set "PATH=%PATH%;C:\Users\anand_fua08yg\AppData\Local\Microsoft\WinGet\Packages\Git.MinGit_Microsoft.Winget.Source_8wekyb3d8bbwe\cmd"

git remote remove origin 2>nul
git remote add origin https://github.com/anand-srcc/srcc-free-classrooms.git

echo.
echo Option 1: If you have a GitHub Personal Access Token (Classic or Fine-grained):
echo Enter your token below (or leave blank to try standard push).
set /p GH_TOKEN="GitHub Token (optional, press Enter to skip): "

if not "%GH_TOKEN%"=="" (
    echo.
    echo Pushing with Personal Access Token...
    git push -f https://anand-srcc:%GH_TOKEN%@github.com/anand-srcc/srcc-free-classrooms.git main
) else (
    echo.
    echo Pushing to main branch...
    git push -f -u origin main
)

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ===================================================================
    echo   SUCCESS! All files uploaded to https://github.com/anand-srcc/srcc-free-classrooms
    echo ===================================================================
) else (
    echo.
    echo [TIP] GitHub requires a Personal Access Token (PAT) for command-line uploads.
    echo You can generate one in 30 seconds at:
    echo https://github.com/settings/tokens/new?scopes=repo
    echo Then run this script again and paste the token.
)
echo.
pause
