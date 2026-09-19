param (
    [ValidateSet("all", "backend", "frontend", "mobile")]
    [string]$Service = "all"
)

$RootDir = $PSScriptRoot

if ($Service -eq "all" -or $Service -eq "backend") {
    Write-Host "Starting Backend on http://0.0.0.0:8000..." -ForegroundColor Cyan
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$RootDir\backend'; .\venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
}

if ($Service -eq "all" -or $Service -eq "frontend") {
    Write-Host "Starting Frontend Dashboard on http://localhost:5173..." -ForegroundColor Cyan
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$RootDir\frontend'; npm run dev"
}

if ($Service -eq "all" -or $Service -eq "mobile") {
    Write-Host "Starting Mobile App (Expo Web) on http://localhost:8081..." -ForegroundColor Cyan
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$RootDir\mobile'; npx expo start --web"
}

Write-Host "Service(s) launched in separate console windows." -ForegroundColor Green
