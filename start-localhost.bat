@echo off
title OmniAI - Localhost Launcher
echo ====================================================================
echo                   Starting OmniAI on Localhost
echo ====================================================================
echo.

:: 1. Start Python FastAPI Backend in a separate window
echo [1/3] Starting Backend Server (http://127.0.0.1:8000)...
start "OmniAI Backend (FastAPI)" cmd /k "cd /d "%~dp0backend" && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

:: Wait 2 seconds for backend to initialize
timeout /t 2 /nobreak >nul

:: 2. Start Vite React Frontend in a separate window
echo [2/3] Starting Frontend Server (http://localhost:5173)...
start "OmniAI Frontend (Vite)" cmd /k "cd /d "%~dp0frontend" && npm run dev"

:: Wait 3 seconds for Vite to boot
timeout /t 3 /nobreak >nul

:: 3. Launch Default Web Browser
echo [3/3] Opening browser at http://localhost:5173...
start http://localhost:5173

echo.
echo ====================================================================
echo OmniAI is now running locally!
echo - Frontend: http://localhost:5173
echo - Backend:  http://127.0.0.1:8000
echo - Swagger:  http://127.0.0.1:8000/docs
echo.
echo Keep the two opened command windows running while using the app.
echo ====================================================================
pause

