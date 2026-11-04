# OmniAI PowerShell Localhost Launcher
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host "                  Starting OmniAI on Localhost" -ForegroundColor Cyan
Write-Host "====================================================================" -ForegroundColor Cyan
Write-Host ""

$root = $PSScriptRoot

# 1. Start Backend in a new window
Write-Host "[1/3] Starting Backend Server (http://127.0.0.1:8000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\backend'; python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

Start-Sleep -Seconds 2

# 2. Start Frontend in a new window
Write-Host "[2/3] Starting Frontend Server (http://localhost:5173)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\frontend'; npm run dev"

Start-Sleep -Seconds 3

# 3. Open Browser
Write-Host "[3/3] Opening browser at http://localhost:5173..." -ForegroundColor Green
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "OmniAI is now running on localhost!" -ForegroundColor Green
Write-Host "- Frontend: http://localhost:5173"
Write-Host "- Backend:  http://127.0.0.1:8000"
Write-Host "- Swagger:  http://127.0.0.1:8000/docs"
