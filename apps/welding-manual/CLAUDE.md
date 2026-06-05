# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

# プロジェクト概要

アーク溶接ロボットの生産段取りマニュアルを管理するWebアプリ。工程コード（`processCode`）をキーとしてマニュアルを保管し、工程表アプリ（別リポジトリ）のガントチャートから直接リンクされる。

## 技術スタック

- Next.js 16 (App Router, React Server Components, Server Actions)
- Prisma 7 + SQLite (better-sqlite3ドライバ)
- Tailwind CSS v4
- TypeScript / Zod

## 開発コマンド

```bash
npm run dev        # 開発サーバー起動（0.0.0.0:3000）
npm run build      # プロダクションビルド
npm run lint       # Lint

npx prisma generate          # クライアント生成
npx prisma migrate dev       # マイグレーション実行
npx prisma studio            # DBブラウザ
```

社内からは `http://192.168.1.235:3000` でアクセス可能。

## ファイル構成（重要なもの）

```
src/
  app/
    actions/manual.ts       # Server Actions（saveManual, deleteManual）
    api/
      upload/route.ts       # 画像アップロード POST
      files/[...filePath]/  # 画像配信 GET（DATA_DIR以下を安全に配信）
      master/search/        # 子品番マスタ検索 API
    manual/
      new/page.tsx          # 新規作成画面（MasterPicker → ManualForm）
      [processCode]/page.tsx        # 閲覧画面
      [processCode]/edit/page.tsx   # 編集画面
    export/page.tsx         # エクスポート画面
  components/
    ManualForm.tsx          # 新規作成・編集共通フォーム（Client Component）
    MasterPicker.tsx        # 工程コード選択UI（Client Component）
    MediaUploader.tsx       # 画像アップロードUI
  lib/
    constants.ts            # ENVIRONMENTS, ROBOTS, ManualFormInitial 型定義
    db.ts                   # Prismaクライアント（シングルトン）+ getDataDir()
    manual.ts               # getManualByCode, listManuals クエリ
    master.ts               # 子品番マスタXLSX読み込み（メモリキャッシュ）
```

## データ・ファイル管理

- **DB**: `dev.db`（SQLite）。環境変数 `DATABASE_URL` で上書き可能（`file:./dev.db` 形式）
- **マスタファイル**: `DATA_DIR/子品番マスタ.xlsx`（デフォルト `./data/`）。起動中に変更しても自動再読み込み（mtime比較）
- **アップロード画像**: `DATA_DIR/uploads/{manualId}/{uuid}.ext` に保存。`/api/files/` 経由で配信
- `public/uploads/` には保存しない（`DATA_DIR` 配下のみ）

## データモデルの要点

- `Manual` が中心。`processCode` が一意キー。
- `ProcessCodeAlias` で複数の工程コードを1つのマニュアルに紐付け可能（色違い品番など）
- `Manual.robotEnvironments` は JSON文字列（例: `["左","中","右"]`）。SQLiteのため配列型が使えない
- `Program.robots` も同様（例: `["1号機"]`）
- `EnvironmentBlock` と `Program` は保存時に完全置換（delete → recreate）
- `JigProcessStep` は画像を保持するため差分更新（stepNumberで照合）

## 新規作成フロー

1. `/manual/new` → `MasterPicker` で工程コード選択
2. `?processCode=XXX&aliases=YYY,ZZZ` にリダイレクト
3. `ManualForm` に初期値をセットして表示
4. 送信 → `saveManual()` Server Action → `/manual/{processCode}` へリダイレクト

## `getManualByCode` の挙動

`processCode` で直接検索し、なければ `ProcessCodeAlias` 経由で親マニュアルを返す。閲覧・編集どちらでもエイリアス経由でアクセス可能。
