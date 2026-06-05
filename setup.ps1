# ============================================================
# welding-apps setup script
# PowerShell を「管理者として実行」で開いて実行してください
# ============================================================

$appDir = "$env:USERPROFILE\welding-apps"

function Show-Step($text) {
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host "  $text" -ForegroundColor Cyan
    Write-Host "============================================" -ForegroundColor Cyan
}

function Show-OK($text)   { Write-Host "  [OK]  $text" -ForegroundColor Green }
function Show-Info($text) { Write-Host "  -->   $text" -ForegroundColor Yellow }
function Show-Warn($text) { Write-Host "  [!!]  $text" -ForegroundColor Red }


# ============================================================
# 1. Node.js
# ============================================================
Show-Step "1/7  Node.js の確認"

try {
    $v = node -v 2>$null
    Show-OK "Node.js $v が見つかりました"
} catch {
    Show-Warn "Node.js が見つかりません"
    Show-Warn "https://nodejs.org を開いて LTS 版をインストールしてから"
    Show-Warn "もう一度このスクリプトを実行してください"
    Read-Host "Enter キーで終了"
    exit 1
}


# ============================================================
# 2. PM2
# ============================================================
Show-Step "2/7  PM2（アプリ管理ツール）の確認"

$pm2ok = $null
try { $pm2ok = Get-Command pm2 -ErrorAction Stop } catch {}

if (-not $pm2ok) {
    Show-Info "PM2 をインストールします（1〜2分かかります）..."
    npm install -g pm2
    npm install -g pm2-windows-startup
    Show-OK "PM2 をインストールしました"
} else {
    Show-OK "PM2 はすでにインストールされています"
}


# ============================================================
# 3. コードの取得
# ============================================================
Show-Step "3/7  アプリのコードを取得"

# system32 に残った失敗フォルダを削除
$badDir = "C:\windows\system32\welding-apps"
if (Test-Path $badDir) {
    Show-Info "不要なフォルダを削除します: $badDir"
    Remove-Item -Recurse -Force $badDir
}

if (Test-Path $appDir) {
    Show-Info "フォルダがあります。最新版に更新します..."
    Set-Location $appDir
    git pull
    Show-OK "更新しました"
} else {
    Set-Location $env:USERPROFILE
    git clone https://github.com/ryuji407/welding-apps.git
    Show-OK "コードを取得しました: $appDir"
}


# ============================================================
# 4. 工程表のデータをコピー
# ============================================================
Show-Step "4/7  工程表のデータを探してコピー"

$scheduleDir = "$appDir\apps\schedule"
New-Item -ItemType Directory -Force $scheduleDir | Out-Null

foreach ($file in @("data.json", "materials.json")) {
    $dest = "$scheduleDir\$file"
    if (Test-Path $dest) {
        Show-OK "$file はすでにあります"
        continue
    }

    Show-Info "$file を探しています..."
    $found = Get-ChildItem C:\ -Recurse -Filter $file -ErrorAction SilentlyContinue |
        Where-Object {
            $_.FullName -notlike "*welding-apps*" -and
            $_.FullName -notlike "*node_modules*"
        } |
        Select-Object -First 1

    if ($found) {
        Copy-Item $found.FullName $dest -Force
        Show-OK "$file をコピーしました (元: $($found.FullName))"
    } else {
        Show-Warn "$file が見つかりませんでした"
        Show-Warn "手動でここにコピーしてください: $dest"
    }
}


# ============================================================
# 5. パッケージのインストール・ビルド
# ============================================================
Show-Step "5/7  パッケージのインストール・ビルド（5〜10分かかります）"

Show-Info "工程表のパッケージをインストール中..."
Set-Location "$appDir\apps\schedule"
npm install
Show-OK "工程表のインストール完了"

Show-Info "溶接マニュアルのパッケージをインストール中..."
Set-Location "$appDir\apps\welding-manual"
npm install
Show-OK "溶接マニュアルのインストール完了"

Show-Info "溶接マニュアルをビルド中..."
npm run build
Show-OK "ビルド完了"


# ============================================================
# 6. 溶接マニュアルのデータ確認
# ============================================================
Show-Step "6/7  溶接マニュアルのデータ確認"

$weldingDir = "$appDir\apps\welding-manual"
$dataOk = $true

if (-not (Test-Path "$weldingDir\dev.db")) {
    Show-Warn "dev.db がありません"
    Show-Warn "旧PCからここにコピーしてください:"
    Show-Warn "  $weldingDir\dev.db"
    $dataOk = $false
} else {
    Show-OK "dev.db あり"
}

if (-not (Test-Path "$weldingDir\data")) {
    Show-Warn "data フォルダがありません"
    Show-Warn "旧PCからここにコピーしてください:"
    Show-Warn "  $weldingDir\data\"
    $dataOk = $false
} else {
    Show-OK "data フォルダあり"
}


# ============================================================
# 7. PM2 でアプリを起動
# ============================================================
Show-Step "7/7  アプリを起動"

Set-Location $appDir

pm2 stop all 2>$null
pm2 delete all 2>$null

pm2 start ecosystem.config.cjs
pm2 save

try { pm2-startup install 2>$null } catch {}


# ============================================================
# 完了
# ============================================================
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  セットアップ完了！" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""

pm2 status

Write-Host ""
Write-Host "  ブラウザで確認してください:" -ForegroundColor Cyan
Write-Host "  溶接マニュアル  -->  http://localhost:3000" -ForegroundColor Cyan
Write-Host "  工程表          -->  http://localhost:5173" -ForegroundColor Cyan
Write-Host ""

if (-not $dataOk) {
    Write-Host "  [重要] [!!] と表示された場所にファイルをコピーしてから:" -ForegroundColor Yellow
    Write-Host "  pm2 restart welding-manual" -ForegroundColor Yellow
    Write-Host "  を実行してください" -ForegroundColor Yellow
    Write-Host ""
}

Read-Host "Enter キーで終了"
