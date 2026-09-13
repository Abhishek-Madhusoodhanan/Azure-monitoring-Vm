@echo off
title Azure Demo Launcher
echo ====================================================
echo Launching Azure Demo (Django Backend + React Frontend)
echo ====================================================

start "Azure Demo - Django Backend (Port 8000)" cmd /k "cd /d "%~dp0backend" && echo Starting Django on 127.0.0.1:8000... && py manage.py runserver 127.0.0.1:8000"

timeout /t 2 >nul

start "Azure Demo - React Frontend (Port 5173)" cmd /k "cd /d "%~dp0frontend" && set "PATH=C:\Users\abhishek.m\AppData\Local\nodejs-portable\node-v22.16.0-win-x64;%%PATH%%" && echo Starting Vite Dev Server on http://localhost:5173... && npm run dev"

echo.
echo Both servers are starting!
echo Backend:  http://127.0.0.1:8000
echo Frontend: http://localhost:5173
echo.
