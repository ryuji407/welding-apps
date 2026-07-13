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

社内からは `http://192.168.1.249:3000` でアクセス可能。

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

## 製品情報セクション（tube-manual から移植）

`/products`・`/product-notes` 配下は tube-manual（SHOP3向けアプリ）の「製品情報」機能の移植。マニュアル機能とはデータ層が完全に別物なので注意:

- **データ**: Firebase Firestore（`products` / `product_defects` / `product_templates` / `product_notes` コレクション）。tube-manual と同一プロジェクトを共有し、両アプリから同じデータが見える。Prisma/SQLite は使わない
- **接続設定**: `.env.local` の `NEXT_PUBLIC_FIREBASE_*`（gitignore対象）。初期化は `src/lib/firebase.ts`
- **写真・動画**: `PRODUCT_PHOTO_DIR`（`\\Sv-04\...\SHOP3\メンテナンスアプリ写真`）に保存。URL形式 `/uploads/<folder>/<file>` は tube-manual と互換（Firestoreに保存済みの既存URLをそのまま解決するため変更禁止）
  - 配信: `src/app/uploads/[folder]/[filename]/route.ts`（動画はRange対応）
  - アップロード: `/api/product-upload`（画像・クライアント側で圧縮済み）、`/api/product-upload-video`（ffmpeg圧縮）
- **コード配置**: `src/features/products/` に隔離（tube-manual の src と同じ相対構造を維持して移植差分を最小化）。ページは `src/app/(products)/` の薄い Server Component ラッパー + `"use client"` の View
- **product_notes の docId** は `encodeURIComponent(部品公式名)`。URL パラメータ `[encodedName]` はエンコードされたまま渡るため安全デコードしている
- 製品の削除は論理削除（`isActive: false`）、テンプレートの削除は物理削除

### 工程コード連携（工程表アプリとのリンク）

- 製品は `processCodes: string[]`（工程コード、複数可）を持つ。マニュアル機能の `processCode` と同じキー体系
- **`/products/code/[processCode]`** が工程表アプリのSHOP6ジョブのリンク着地点。該当製品があれば詳細へリダイレクト、なければ未登録案内＋工程コードプレフィル付き新規登録ボタン（`/products/new?processCode=XXX`）
- 工程表アプリ側は `EditJobModal.tsx` で分岐: SHOP6ジョブ（`equipmentColumn === 'SHOP6'`）→ `/products/code/<コード>`、それ以外 → `/manual/<コード>`
- **フレクシェCSV一括紐付け**: 製品一覧のCSVインポートはフレクシェCSV（ヘッダー3列目が `SHOP`）を自動判別し、S6行の 工程コード(0列) × 部品公式名(8列) で既存製品に紐付け・未登録は新規作成する。従来CSV（F列=製品名）のインポートも引き続き動作
