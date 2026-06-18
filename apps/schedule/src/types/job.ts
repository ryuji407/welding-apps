export interface Job {
    id: string;
    name: string;
    assignee?: string;
    startTime: string; // 'HH:mm' format
    endTime: string;   // 'HH:mm' format
    progress: number; // 0-100
    color?: string;
    machine: string; // 'LT7' | 'LT Fiber' | 'E-TURN'

    // New fields from CSV
    finishedProductNumber?: string; // 完成品番
    prototypeNumber?: string; // 試作番号
    componentOfficialName?: string; // 子品番の正式名称
    componentNumber?: string; // 子品番
    dailyQuantity?: string; // 当日数量
    totalQuantity?: string; // 全数
    workerCount?: string; // 作業人数
    usageAmount?: string; // 使用数
    setupTime?: string; // 前段取り時間(秒)
    productionTime?: string; // 製造時間(秒)
    operationCode?: string; // 作業コード
    note?: string; // 備考
    s3TotalTime?: string; // S3合計時間(段取り含む)
    s4TotalTime?: string; // S4合計時間(段取り含む)
    s6TotalTime?: string; // S6合計時間(段取り含む)
    nextProcessShop?: string; // 後工程SHOP
    calendarComment?: string; // カレンダーコメント
    pipeDeliveryDate?: string; // パイプ納入日
    equipment?: string; // 設備
    equipmentRegistration?: string; // 設備登録
    cycleTime?: string; // サイクルタイム(秒)
    shipDate?: string; // 出荷日
    nextProcessSchedule?: string; // 後工程日程
    s4Robot2?: string; // S4-ロボット2台
    pipeMaterialCode?: string; // パイプ資材コード
    pipeMaterialName?: string; // パイプ資材名称
    customer?: string; // 顧客
    isCompleted?: boolean; // 着完 (True if '済')
    completedAt?: string; // 完了した時刻 (ISO 8601形式)
    jigAddress?: string; // 治具番地
    jigLocation?: string; // 治具場所
    manualDurationMinutes?: number; // 手動調整された期間（分）
    durationMinutes?: number; // 計算された期間（分）
    originalDate?: string; // YYYY-MM-DD or similar format, date of original creation/import
    paintColor?: string; // 塗装色
    textColor?: string; // テキスト色 (緑色などに個別設定)
    changeInstruction?: string; // 変更指示 (追加/削除など)
    allEquipmentColumns?: string[]; // 複数設備対応（パース時のみ使用）
    isPickingListOnly?: boolean; // ピッキングリストのみ表示（ガントチャートに表示しない）

    // 工程外項目（生産計画外の対応・遅れ・事務作業など）
    isNonProduction?: boolean;
    nonProductionCategory?: string;           // 大分類 (例: '事務作業', 'トラブル対応')
    nonProductionDetail?: string;             // 具体的な内容（自由記述）
    nonProductionChildren?: NonProductionChildItem[]; // 子項目バー群
    relatedProductionJobId?: string;          // 関連する生産ジョブのID
    relatedProductionName?: string;           // 関連する生産ジョブの工程名（スナップショット）
}

export interface NonProductionSubItem {
    name: string;
    children?: NonProductionSubItem[];
}

export interface NonProductionChildItem {
    id: string;
    path: string[];     // 選択パス例: ['トラブル', '設備', 'ロボット']
    minutes: number;
    name?: string;      // 後方互換用（旧データ）
}

export interface NonProductionCategory {
    name: string;
    color: string;
    children?: NonProductionSubItem[];
}

export interface FixedJob {
    id: string;
    name: string;
    duration: number; // minutes
    laneIndex: number; // 0-based index of the lane
    color?: string; // hex color code
}

export interface BreakTime {
    id: string;
    start: string; // 'HH:mm'
    end: string;   // 'HH:mm'
}
