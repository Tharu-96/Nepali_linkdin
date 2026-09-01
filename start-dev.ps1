$backend = Join-Path $PSScriptRoot 'backend'
$frontend = Join-Path $PSScriptRoot 'frontend'

Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$backend'; .\.venv\Scripts\Activate.ps1; uvicorn app.main:app --host 127.0.0.1 --port 8000" -WorkingDirectory $backend
Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$frontend'; npm run dev -- --host 0.0.0.0" -WorkingDirectory $frontend
