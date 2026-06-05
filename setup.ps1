# ============================================================
# welding-apps セットアップスクリプト
# PowerShell を「管理者として実行」で開いて、
# このファイルの中身を丸ごとコピペして実行してください
# ============================================================

function 見出し($text) {
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host "  $text" -ForegroundColor Cyan
    Write-Host "============================================" -ForegroundColor Cyan
}

function 成功($text) { Write-Host "  [OK] $text" -ForegroundColor Green }
function 情報($text) { Write-Host "  -->  $text" -ForegroundColor Yellow }
function 警告($text) { Write-Host "  [!]  $text" -ForegroundColor Red }


# ============================================================
# 1. Node.js の確認
# ============================================================
見出し "1/7  Node.js の確認"

try {
    $v = node -v 2>$null
    成功 "Node.js $v が見つかりました"
} catch {
    警告 "Node.js が見つかりません"
    警告 "https://nodejs.org を開いて LTS 版をインストールしてから"
    警告 "もう一度このスクリプトを実行してください"
    Read-Host "Enterキーで終了"
    exit 1
}


# ============================================================
# 2. PM2 の確認・インストール
# ============================================================
見出し "2/7  PM2（アプリ管理ツール）の確認"

$pm2ok = $null
try { $pm2ok = Get-Command pm2 -ErrorAction Stop } catch {}

if (-not $pm2ok) {
    情報 "PM2 をインストールします（1〜2分かかります）..."
    npm install -g pm2
    npm install -g pm2-windows-startup
    成功 "PM2 をインストールしました"
} else {
    成功 "PM2 はすでにインストールされています"
}


# ============================================================
# 3. コードの取得（git clone）
# ============================================================
見出し "3/7  アプリのコードを取得"

$appDir = "C:\Users\MARK\welding-apps"

if (Test-Path $appDir) {
    情報 "すでにフォルダがあります。最新版に更新します..."
    Set-Location $appDir
    git pull
    成功 "更新しました"
} else {
    Set-Location "C:\Users\MARK"
    git clone https://github.com/ryuji407/welding-apps.git
    成功 "コードを取得しました"
}


# ============================================================
# 4. 工程表のデータファイルを自動検索してコピー
# ============================================================
見出し "4/7  工程表のデータを探してコピー"

$scheduleDir = "$appDir\apps\schedule"

foreach ($file in @("data.json", "materials.json")) {
    $dest = "$scheduleDir\$file"
    if (Test-Path $dest) {
        成功 "$file はすでにあります"
        continue
    }

    情報 "$file を探しています..."
    $found = Get-ChildItem C:\ -Recurse -Filter $file -ErrorAction SilentlyContinue |
        Where-Object {
            $_.FullName -notlike "*welding-apps*" -and
            $_.FullName -notlike "*node_modules*"
        } |
        Select-Object -First 1

    if ($found) {
        Copy-Item $found.FullName $dest
        成功 "$file をコピーしました（元の場所: $($found.FullName)）"
    } else {
        警告 "$file が見つかりませんでした"
        警告 "手動でここにコピーしてください: $dest"
    }
}


# ============================================================
# 5. パッケージのインストールとビルド
# ============================================================
見出し "5/7  パッケージのインストール・ビルド（5〜10分かかります）"

情報 "工程表のパッケージをインストール中..."
Set-Location "$appDir\apps\schedule"
npm install
成功 "工程表のインストール完了"

情報 "溶接マニュアルのパッケージをインストール中..."
Set-Location "$appDir\apps\welding-manual"
npm install
成功 "溶接マニュアルのインストール完了"

情報 "溶接マニュアルをビルド中..."
npm run build
成功 "ビルド完了"


# ============================================================
# 6. 溶接マニュアルのデータ確認
# ============================================================
見出し "6/7  溶接マニュアルのデータ確認"

$weldingDir = "$appDir\apps\welding-manual"
$dataOk = $true

if (-not (Test-Path "$weldingDir\dev.db")) {
    警告 "dev.db がありません"
    警告 "旧PCから以下の場所にコピーしてください:"
    警告 "  $weldingDir\dev.db"
    $dataOk = $false
} else {
    成功 "dev.db あり"
}

if (-not (Test-Path "$weldingDir\data")) {
    警告 "data フォルダがありません"
    警告 "旧PCから以下の場所にコピーしてください:"
    警告 "  $weldingDir\data\"
    $dataOk = $false
} else {
    成功 "data フォルダあり"
}


# ============================================================
# 7. PM2 でアプリを起動・自動起動の登録
# ============================================================
見出し "7/7  アプリを起動"

Set-Location $appDir

# 既存のプロセスを一旦停止
pm2 stop all 2>$null
pm2 delete all 2>$null

# 両アプリを起動
pm2 start ecosystem.config.cjs

# Windows 起動時に自動起動するよう登録
pm2 save
try { pm2-startup install 2>$null } catch {}


# ============================================================
# 完了メッセージ
# ============================================================
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  セットアップ完了！" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""

pm2 status

Write-Host ""
Write-Host "  ブラウザで開いて確認してください:" -ForegroundColor Cyan
Write-Host "  溶接マニュアル  →  http://localhost:3000" -ForegroundColor Cyan
Write-Host "  工程表          →  http://localhost:5173" -ForegroundColor Cyan
Write-Host ""

if (-not $dataOk) {
    Write-Host "  [重要] 上の [!] の場所にファイルをコピーしてから:" -ForegroundColor Yellow
    Write-Host "  pm2 restart welding-manual" -ForegroundColor Yellow
    Write-Host "  を実行してください" -ForegroundColor Yellow
    Write-Host ""
}

Read-Host "Enterキーで終了"
