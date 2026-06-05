# welding-apps

溶接マニュアル（port 3000）と工程表（port 5173）のモノレポ。

---

## 新サーバーへのセットアップ

### 1. 前提（一度だけ）

```powershell
# Node.js をインストール（https://nodejs.org から LTS版）
# PM2 をグローバルインストール
npm install -g pm2
```

### 2. リポジトリを取得

```powershell
git clone https://github.com/<ユーザー名>/welding-apps.git
cd welding-apps
```

### 3. 依存パッケージをインストール・ビルド

```powershell
# 溶接マニュアル
cd apps\welding-manual
npm install
npm run build
cd ..\..

# 工程表
cd apps\schedule
npm install
cd ..\..
```

### 4. データファイルをコピー（旧PCから手動）

| コピー元（旧PC） | コピー先（新サーバー） |
|---|---|
| `welding-manual\dev.db` | `welding-apps\apps\welding-manual\dev.db` |
| `welding-manual\data\` フォルダ | `welding-apps\apps\welding-manual\data\` |
| `schedule\data.json` | `welding-apps\apps\schedule\data.json` |
| `schedule\materials.json` | `welding-apps\apps\schedule\materials.json` |

### 5. アプリを起動

```powershell
# welding-apps フォルダで実行
pm2 start ecosystem.config.cjs

# Windows 起動時に自動起動するよう登録
pm2 save
pm2 startup
```

### 6. 動作確認

| アプリ | URL |
|---|---|
| 溶接マニュアル | http://localhost:3000 |
| 工程表 | http://localhost:5173 |

---

## 日常操作

```powershell
pm2 status          # 稼働状況確認
pm2 logs            # ログ表示
pm2 restart all     # 両アプリ再起動
pm2 stop all        # 両アプリ停止
```

## コードを更新するとき

```powershell
git pull
cd apps\welding-manual && npm run build && cd ..\..
pm2 restart all
```
