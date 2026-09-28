@echo off
title SRCC Student Assist Login & Session Saver
echo ==============================================================
echo   SRCC FACULTY LEAVE SCRAPER - 1-CLICK AUTHENTICATION
echo ==============================================================
echo.
echo This tool will open a browser window to connect to
echo https://www.studentassistsrcc.app/ and automatically save
echo the authenticated session to playwright_state.json.
echo.
echo If Cloudflare verification appears, simply click it in the browser!
echo.
cd /d "%~dp0"
python sync_leaves.py --interactive
echo.
echo ==============================================================
echo   Authentication finished.
echo   playwright_state.json is ready for automated runs.
echo ==============================================================
pause
