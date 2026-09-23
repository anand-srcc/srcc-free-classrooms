@echo off
title SRCC Faculty Leaves Automated Synchronizer
echo =======================================================
echo   SRCC FACULTY LEAVES AUTO-SYNC
echo   Syncing live leaves from studentassistsrcc.app...
echo =======================================================
echo.

cd /d "%~dp0"

python sync_leaves.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Leave sync failed or encountered an error.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo =======================================================
echo   Sync Complete! web_app/faculty_leaves.js updated.
echo =======================================================
echo.
timeout /t 3 >nul
