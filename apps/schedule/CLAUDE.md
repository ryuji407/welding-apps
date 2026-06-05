# 工程管理アプリ — Claude向けコンテキスト

## 技術スタック
- **フロントエンド**: React 19 + TypeScript + Vite + Tailwind CSS
- **バックエンド**: Express (server.js) + Vite dev middleware（`npm run dev` で同時起動）
- **DB**: Firebase Firestore（リアルタイム同期）
- **その他**: dnd-kit（ドラッグ&ドロップ）、lucide-react（アイコン）

## 開発サーバー
```
npm run dev   → http://localhost:5173
```

## ディレクトリ構成
```
src/
├── components/
│   ├── WeldingGanttChart.tsx   ← ガントチャート本体（最重要・巨大）
│   ├── WeldingLaneSettingsModal.tsx  ← レーン・休憩時間設定
│   ├── EditJobModal.tsx         ← ジョブ編集モーダル
│   ├── JobList.tsx              ← リスト表示
│   ├── PickingList.tsx          ← ピッキングリスト
│   └── JigMap.tsx               ← 治具マップ
├── pages/
│   └── WeldingSchedulePage.tsx  ← メインページ（状態管理の中心）
├── hooks/
│   └── useWeldingFirestore.ts   ← Firestore CRUD・設定読み込み
├── types/
│   ├── job.ts                   ← Job / FixedJob / BreakTime 型定義
│   └── schedule.ts              ← Schedule 型定義
└── utils/
    ├── weldingCsvParser.ts      ← CSV/Excel パース・ジョブ配置
    └── jobOptimizer.ts          ← ジョブ最適化
```

## 主要な型

### Job（src/types/job.ts）
- `machine: string` — 担当者（レーン）名
- `startTime / endTime: string` — 'HH:mm' 形式
- `setupTime?: string` — 前段取り時間（秒）
- `cycleTime?: string` — サイクルタイム（秒）
- `dailyQuantity?: string` — 当日数量
- `productionTime?: string` — 製造時間（秒）
- `manualDurationMinutes?: number` — 手動上書き（分）
- `durationMinutes?: number` — 旧フォールバック（分）

### BreakTime（src/types/job.ts）
- `start / end: string` — 'HH:mm' 形式

## ガントチャートの重要な関数（WeldingGanttChart.tsx）

### `computeJobDurationMinutes(job)`
純生産時間（分）を計算。優先順位：
1. `manualDurationMinutes`
2. `ceil((setupSec + cycleTime × qty) / 60)`
3. `ceil((setupSec + productionTime) / 60)`
4. `ceil(s4TotalTime)`
5. `ceil(setupSec / 60)`
6. `durationMinutes`

### `getVisualPosLocal(minutes)`
実際時刻（分）→ 視覚上の位置（分）。休憩時間をスキップして圧縮。

### `getActualTimeLocal(visualMinutes)`
視覚上の位置（分）→ 実際時刻（分）。**判定は `visualMinutes` で行うこと**（`actual` で判定すると複数休憩時にバグる）。

### `MachineRow` コンポーネント
- `machine: string` — 担当者名
- `jobs: Job[]` — そのレーンのジョブ
- `breakTimes: BreakTime[]` — レーン別休憩時間

## 定時・労働時間の設定
- **定時**: 8:20 〜 17:20（540分）
- **実質労働時間** = 540分 − 定時内の休憩時間
  - 17:20〜17:30など定時外の休憩はカウントしない
- 休憩時間は Firestore の `weldingSettings.laneBreakTimes` で管理（レーン別）

## Firestoreのコレクション
- `welding_schedules` — スケジュール一覧
- `welding_jobs/{scheduleId}/jobs` — ジョブデータ
- `weldingSettings` — レーン設定・休憩時間・色設定など

## よく触るファイルと注意点
- `WeldingGanttChart.tsx` は非常に大きい（2000行超）。Explore エージェントで先に調査してから編集する。
- `breakTimes` はレーンごとに異なる。一括設定は `lanes[0]` を代表として表示。
- ジョブのドラッグ&ドロップは dnd-kit で実装。`onJobUpdate` コールバック経由で Firestore 更新。
- `isSheetMetal` フラグで板金/溶接の表示を切り替え（ヘッダー幅 150px / 100px など）。
