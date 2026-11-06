@echo off
title SRCC Free Classroom Finder - Localhost Server
echo Starting SRCC Free Classroom Finder on http://localhost:3000 ...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_local_server.ps1"
pause
