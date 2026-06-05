# 段取りマニュアルアプリ (welding-manual)

アーク溶接ロボット作業の生産段取りマニュアルを管理するWebアプリ。工程コードに紐付けて保管し、工程表アプリのガントチャートから直接ジャンプできる。

## 技術スタック

- **Next.js 16** (App Router, React Server Components, Server Actions)
- **TypeScript** + **Tailwind CSS**
- **Prisma 7** + **SQLite** (将来 Postgres へ移行可能)
- ファイル保管: `public/uploads/` (将来 Supabase Storage / S3 へ移行可能)

## 起動

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

開発サーバー: http://localhost:3000

## 工程表アプリからのリンク仕様

ガントチャートのジョブバー詳細画面に「マニュアルを開く」ボタンを設置し、以下URLへ遷移させる:

```
http://<HOST>/manual/{processCode}
```

- 登録済み → マニュアル閲覧画面
- 未登録 → 「未登録です。作成しますか？」画面が表示され、`?processCode=xxx` 付きで新規作成画面へ誘導

## 画面一覧

| URL | 用途 |
|---|---|
| `/` | マニュアル一覧・検索 |
| `/manual/new` | 新規作成（`?processCode=xxx` で工程コード自動入力） |
| `/manual/{processCode}` | 閲覧 + 画像アップロード（工程表アプリのリンク先） |
| `/manual/{processCode}/edit` | テキスト系フィールドの編集 |
| `/export` | データエクスポート |
| `/api/export` | 全マニュアルのJSONダウンロード |
| `/api/upload` | 画像アップロード API (POST) |

## データモデル

詳細は [prisma/schema.prisma](./prisma/schema.prisma)。

- `Manual` (1) ── (N) `EnvironmentBlock` ── (N) `Program`
- `Manual` (1) ── (N) `JigProcessStep` ── (N) `MediaFile` (kind="jig")
- `Manual` (1) ── (N) `MediaFile` (kind="layout" | "wagon")

> 注: SQLiteを使用するため、配列型は JSON 文字列として保存。Postgres移行時は `String[]` へ変更可能。

## SEへの引き渡し

1. **ソースコード**: このリポジトリ一式
2. **DB構造**: `prisma/schema.prisma`（正本）
3. **データ移行**:
   - `/api/export` でJSON出力
   - `prisma/dev.db` ファイル本体（SQLite）
   - `public/uploads/` フォルダ（画像ファイル）
4. **リンク仕様書**: 本READMEの「工程表アプリからのリンク仕様」を参照

### Postgresへの移行手順（参考）

1. `prisma/schema.prisma` の provider を `"postgresql"` に変更
2. 配列型 JSON文字列フィールドを `String[]` に変更
   - `Manual.robotEnvironments`
   - `Program.robots`
3. `DATABASE_URL` を Postgres 接続文字列に変更
4. `npx prisma migrate dev` で再マイグレーション
5. 旧SQLiteから新Postgresへデータ移行スクリプトを書く（または `/api/export` のJSONをインポート）
6. `public/uploads/` を S3 / Supabase Storage へ移動、`MediaFile.url` をフルURLに書き換え

## 未実装 / 今後の拡張

- ユーザー認証（社内利用前提のためMVPでは省略）
- 作業動画の直アップロード（現在はURL埋め込みのみ）
- 一括ZIPエクスポート（DB+画像）
- 監査ログ（誰がいつ編集したか）
