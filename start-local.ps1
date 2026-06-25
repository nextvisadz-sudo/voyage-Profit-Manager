# Next Visa Travel - Local Development Startup
# This script starts both the mock API server and the travel website
# Run from the root of the project: .\start-local.ps1

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  Next Visa Travel - Local Dev Setup  " -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Start mock API server in a new PowerShell window
Write-Host "[1/2] Starting mock API server on port 5000..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "node mock-api-server.mjs" -WorkingDirectory $PSScriptRoot

Start-Sleep -Seconds 2

# Start travel website in a new PowerShell window
Write-Host "[2/2] Starting travel website on http://localhost:5173 ..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "pnpm --filter @workspace/travel-website run dev" -WorkingDirectory $PSScriptRoot

Write-Host ""
Write-Host "Both servers are starting in separate windows." -ForegroundColor Yellow
Write-Host ""
Write-Host "  Travel Website:  http://localhost:5173" -ForegroundColor White
Write-Host "  Mock API:        http://localhost:5000/api/health" -ForegroundColor White
Write-Host ""
Write-Host "To start the Admin Dashboard instead, run:" -ForegroundColor Gray
Write-Host "  pnpm --filter @workspace/admin-dashboard run dev" -ForegroundColor Gray
Write-Host ""
