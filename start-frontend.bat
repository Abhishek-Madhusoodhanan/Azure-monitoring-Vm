@echo off
title Azure Demo - React Frontend
set "PATH=C:\Users\abhishek.m\AppData\Local\nodejs-portable\node-v22.16.0-win-x64;%PATH%"
cd /d "%~dp0frontend"
echo ====================================================
echo Starting React Frontend on http://localhost:5173 ...
echo ====================================================
call npm run dev
pause
