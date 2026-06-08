Set-Location "C:\Users\SHOP4\welding-apps"

Write-Host "=== welding-apps update ===" -ForegroundColor Cyan

$before = git rev-parse HEAD

Write-Host "[1/4] git pull..." -ForegroundColor Yellow
git pull
if ($LASTEXITCODE -ne 0) {
    Write-Host "git pull failed." -ForegroundColor Red
    exit 1
}

$after = git rev-parse HEAD

if ($before -eq $after) {
    Write-Host "No changes. Already up to date." -ForegroundColor Green
    exit 0
}

$changed = git diff --name-only $before $after
Write-Host "Changed files:" -ForegroundColor Gray
$changed | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }

$manualChanged       = @($changed | Where-Object { $_ -match "^apps/welding-manual" })
$manualDepsChanged   = @($changed | Where-Object { $_ -match "^apps/welding-manual/package" })
$scheduleChanged     = @($changed | Where-Object { $_ -match "^apps/schedule" })
$scheduleDepsChanged = @($changed | Where-Object { $_ -match "^apps/schedule/package" })

# welding-manual
if ($manualChanged.Count -gt 0) {
    Write-Host "[2/4] welding-manual changed" -ForegroundColor Yellow

    if ($manualDepsChanged.Count -gt 0) {
        Write-Host "  npm install..." -ForegroundColor Gray
        Set-Location "C:\Users\SHOP4\welding-apps\apps\welding-manual"
        npm install
        Set-Location "C:\Users\SHOP4\welding-apps"
    }

    Write-Host "  npm run build..." -ForegroundColor Gray
    Set-Location "C:\Users\SHOP4\welding-apps\apps\welding-manual"
    npm run build
    $buildResult = $LASTEXITCODE
    Set-Location "C:\Users\SHOP4\welding-apps"

    if ($buildResult -ne 0) {
        Write-Host "  Build failed!" -ForegroundColor Red
        exit 1
    }

    Write-Host "  pm2 restart welding-manual..." -ForegroundColor Gray
    pm2 restart welding-manual
} else {
    Write-Host "[2/4] welding-manual: no changes (skip)" -ForegroundColor Gray
}

# schedule
if ($scheduleChanged.Count -gt 0) {
    Write-Host "[3/4] schedule changed" -ForegroundColor Yellow

    if ($scheduleDepsChanged.Count -gt 0) {
        Write-Host "  npm install..." -ForegroundColor Gray
        Set-Location "C:\Users\SHOP4\welding-apps\apps\schedule"
        npm install
        Set-Location "C:\Users\SHOP4\welding-apps"
    }

    Write-Host "  pm2 restart schedule..." -ForegroundColor Gray
    pm2 restart schedule
} else {
    Write-Host "[3/4] schedule: no changes (skip)" -ForegroundColor Gray
}

Write-Host "[4/4] PM2 status" -ForegroundColor Yellow
pm2 status

Write-Host "=== Update complete ===" -ForegroundColor Cyan
