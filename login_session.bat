@echo off
title SRCC Student Assist Login
echo ==============================================================
echo   SRCC STUDENT ASSIST - REAL CHROME DATA EXTRACTOR
echo ==============================================================
echo.
echo Launching official Google Chrome...
echo Pre-filling Roll No: 25BC070
echo.
echo Please complete the Cloudflare checkbox and click Login in Chrome!
echo The script will automatically detect the login and extract all data.
echo.
cd /d "%~dp0"
python cdp_login_and_scrape.py
echo.
echo ==============================================================
echo   Process finished.
echo ==============================================================
pause
