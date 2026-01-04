
Write-Host "Starting CONVO..."
Write-Host "Starting Backend on http://localhost:8000..."
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd backend; uvicorn app.main:app --reload"

Write-Host "Starting Frontend on http://localhost:5173..."
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"

Write-Host "CONVO is running!"
