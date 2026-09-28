@echo off
setlocal
cd /d "C:\Users\anand_fua08yg\.gemini\antigravity-ide\scratch\srcc_timetable_scraper"

echo =========================================================
echo    SRCC TIMETABLE - 1-CLICK LIVE SYNC & EXCEL REFRESH
echo =========================================================
echo.
echo [1/3] Scraping latest timetable from srcccollegetimetable.in...
.\.venv\Scripts\python.exe export_data_json.py
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to fetch latest timetable data!
    pause
    exit /b 1
)

echo.
echo [2/3] Generating fresh Excel workbook with updated schedules...
.\.venv\Scripts\python.exe srcc_scraper.py
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to generate Excel workbook!
    pause
    exit /b 1
)

echo.
echo [3/4] Syncing live faculty leaves from studentassistsrcc.app...
python sync_leaves.py
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Leave sync encountered an issue, proceeding with web package...
)

echo.
echo [4/4] Updating web app files and Netlify zip package...
copy /Y SRCC_Free_Classrooms_Timetable.xlsx web_app\SRCC_Free_Classrooms_Timetable.xlsx
copy /Y SRCC_Free_Classrooms_Timetable.xlsx preview_web_app\SRCC_Free_Classrooms_Timetable.xlsx
copy /Y SRCC_Free_Classrooms_Timetable.xlsx "%USERPROFILE%\Downloads\SRCC_Free_Classrooms_Timetable.xlsx"

powershell -Command "Compress-Archive -Path 'web_app\*' -DestinationPath '%USERPROFILE%\Downloads\srcc_web_app_for_netlify.zip' -Force"
powershell -Command "Copy-Item 'web_app\*' '%USERPROFILE%\Downloads\srcc_web_app_for_netlify' -Recurse -Force"

echo.
echo =========================================================
echo  SUCCESS! 
echo  1. Fresh Excel saved to Downloads:
echo     SRCC_Free_Classrooms_Timetable.xlsx
echo  2. Updated Netlify Zip ready in Downloads:
echo     srcc_web_app_for_netlify.zip
echo  3. Updated Folder ready in Downloads:
echo     srcc_web_app_for_netlify
echo =========================================================
echo.
pause
