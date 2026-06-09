import React, { useMemo, useState, useRef } from 'react';
import { DndContext, useDraggable, useDroppable, DragOverlay, type DragEndEvent, type DragOverEvent, PointerSensor, useSensor, useSensors, pointerWithin } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Package, X, Plus } from 'lucide-react';
import type { Job, BreakTime, NonProductionCategory } from '../types/job';
import { AddNonProductionModal } from './AddNonProductionModal';
import { useAuth } from '../context/AuthContext';

interface WeldingGanttChartProps {
    jobs: Job[];
    onJobUpdate?: (job: Job) => void;
    onJobClick?: (job: Job) => void;
    onJobDelete?: (jobId: string | string[]) => void;
    onSplitJob?: (jobId: string) => void;
    visibleMachines?: string[];
    laneHeight?: number;
    pixelsPerTenMinutes?: number;
    showMaterialList?: boolean;
    laneStartTimes?: Record<string, string>;
    isSheetMetal?: boolean;
    isWeldingLine?: boolean;
    laneColors?: Record<string, string>;
    processColors?: Record<string, string>;
    laneBreakTimes?: Record<string, BreakTime[]>;
    jobBarDisplayMode?: 'standard' | 'simple' | 'detailed' | 'custom';
    jobBarCustomFields?: string[];
    twoRowLayout?: boolean;
    masterSkills?: string[];
    laneSkills?: Record<string, string[]>;
    equipmentColors?: Record<string, string>;
    jobBarTextColor?: string;
    setupTimeColor?: string;
    isAdmin?: boolean;
    // Keyboard navigation callbacks
    onMoveJobsToLane?: (jobIds: string[], newLane: string) => void;
    onSwapJobsOrder?: (jobIds: string[], direction: 'left' | 'right') => void;
    // Cross-schedule move
    schedules?: Array<{ id: string; date: string }>;
    currentScheduleId?: string | null;
    currentScheduleDate?: string;
    onMoveJobsToSchedule?: (jobIds: string[], targetScheduleId: string) => void;
    onCopyJobs?: (jobIds: string[]) => void;
    onPasteJobs?: () => void;
    // 自動挿入ジョブ名リスト（これに該当するジョブは名称+分数のみ表示）
    fixedJobNames?: string[];
    // 工程外項目（生産外時間記録）
    nonProductionCategories?: NonProductionCategory[];
    onAddJob?: (job: Omit<Job, 'id'> & { id?: string }) => Promise<string | null | undefined> | void;
}

interface DraggableJobProps {
    job: Job;
    machineStartMinutes: number;
    machineTotalVisualMinutes: number;
    pixelsPerMinute: number;
    chainedVisualStart: number;
    laneIndex: number;
    onClick?: (job: Job, shiftKey: boolean) => void;
    onDoubleClick?: (job: Job) => void;
    onJobDelete?: (jobId: string | string[]) => void;
    onJobContextMenu?: (job: Job, x: number, y: number, ctrlKey: boolean) => void;
    laneHeight: number;
    laneColors?: Record<string, string>;
    processColors?: Record<string, string>;
    isSheetMetal?: boolean;
    isWeldingLine?: boolean;
    getVisualPos: (mins: number) => number;
    jobBarDisplayMode?: 'standard' | 'simple' | 'detailed' | 'custom';
    jobBarCustomFields?: string[];
    masterSkills?: string[];
    laneSkills?: Record<string, string[]>;
    equipmentColors?: Record<string, string>;
    jobBarTextColor?: string;
    setupTimeColor?: string;
    isAdmin?: boolean;
    isInsertTarget?: boolean;
    isSelected?: boolean;
    currentScheduleDate?: string;
    fixedJobNames?: string[];
}

const MACHINES = ['LT7', 'LT Fiber', 'E-TURN'];

const MACHINE_COLORS: Record<string, string> = {
    'LT7': '#3b82f6',      // Blue
    'LT Fiber': '#8b5cf6', // Violet/Purple
    'E-TURN': '#f97316',   // Orange
};

const DEFAULT_BREAKS: BreakTime[] = [{ id: 'default', start: '12:00', end: '12:50' }];

const DYNAMIC_COLORS = [
    '#3b82f6', // Blue
    '#8b5cf6', // Violet
    '#f97316', // Orange
    '#10b981', // Emerald
    '#ef4444', // Red
    '#06b6d4', // Cyan
    '#d946ef', // Fuchsia
    '#eab308', // Yellow
    '#64748b', // Slate
    '#ec4899', // Pink
    '#84cc16', // Lime
];

const SHEET_METAL_PROCESS_COLORS: Record<string, string> = {
    'S1': '#3b82f6', // Blue
    'S2': '#10b981', // Emerald/Green
    'S7': '#f97316', // Orange
};


const getMachineColor = (machine: string | undefined): string => {
    if (!machine) return DYNAMIC_COLORS[0];

    // Check override first
    if (MACHINE_COLORS[machine]) return MACHINE_COLORS[machine];

    // Generate consistent index from string
    let hash = 0;
    for (let i = 0; i < machine.length; i++) {
        hash = machine.charCodeAt(i) + ((hash << 5) - hash);
    }

    const index = Math.abs(hash) % DYNAMIC_COLORS.length;
    return DYNAMIC_COLORS[index];
};

const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};

// ガントチャートのバー幅用「純生産時間（分）」を計算する共通ヘルパー。
// `getJobStyle`（バー幅）と `chainedStartMap`（バー位置の連鎖計算）の両方から呼ばれる。
//
// 優先順位:
//   1. manualDurationMinutes（手動上書き）
//   2. cycleTime × dailyQuantity  ← CT×個数が最も正確（800秒×6個=80分）
//   3. productionTime のみ（段取りを含まない）
//   4. s4TotalTime - setupTime（S4合計から段取りを引いた純生産時間）
//   5. setupTime のみ（段取り専用ジョブ）
//   6. durationMinutes（旧フォールバック）
function computeJobDurationMinutes(job: Job): number {
    const setupSec   = parseInt((job.setupTime      || '0').toString().replace(/,/g, ''), 10) || 0;
    const prodSec    = parseInt((job.productionTime || '0').toString().replace(/,/g, ''), 10) || 0;
    const cycleSec   = parseInt((job.cycleTime      || '0').toString().replace(/,/g, ''), 10) || 0;
    const qty        = parseInt((job.dailyQuantity  || '0').toString().replace(/,/g, ''), 10) || 0;
    const s4TotalMin = parseFloat((job.s4TotalTime  || '0').toString().replace(/,/g, '')) || 0;

    if (job.manualDurationMinutes && job.manualDurationMinutes > 0) return job.manualDurationMinutes;
    // バー幅は「段取り + CT×個数」の合計。段取りオレンジストライプもこの幅を基準に描画される。
    // 例: setupTime=900秒(15分), cycleTime=800秒, qty=6 → (900+4800)÷60=95分
    if (cycleSec > 0 && qty > 0) return Math.ceil((setupSec + cycleSec * qty) / 60);
    // productionTime のみのジョブ（cycleTime未設定）: 段取り込みの合計として扱う
    if (prodSec > 0) return Math.ceil((setupSec + prodSec) / 60);
    // s4TotalTime は元々「段取り含む」合計なのでそのまま使う
    if (s4TotalMin > 0) return Math.ceil(s4TotalMin);
    // 段取りのみのジョブ（productionTime=0, cycleTime=0）
    if (setupSec > 0) return Math.ceil(setupSec / 60);
    if (job.durationMinutes && job.durationMinutes > 0) return job.durationMinutes;
    return 0;
}

const minutesToTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

// Format schedule date for display (e.g. 2026/04/01 -> 4月1日(水))
const formatScheduleDate = (date: string): string => {
    const match = date.match(/(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})/);
    if (match) {
        const d = new Date(+match[1], +match[2] - 1, +match[3]);
        const dow = ['日','月','火','水','木','金','土'][d.getDay()];
        return `${+match[2]}月${+match[3]}日(${dow})`;
    }
    // MMDD fallback
    const m2 = date.match(/^(\d{2})(\d{2})/);
    if (m2) {
        const d = new Date(new Date().getFullYear(), +m2[1] - 1, +m2[2]);
        const dow = ['日','月','火','水','木','金','土'][d.getDay()];
        return `${+m2[1]}月${+m2[2]}日(${dow})`;
    }
    return date;
};

interface MenuItem {
    label: string;
    action: () => void;
    icon?: React.ReactNode;
    colorClass?: string;
}


function DraggableJob({ job, machineStartMinutes, machineTotalVisualMinutes: _machineTotalVisualMinutes, pixelsPerMinute, chainedVisualStart, laneIndex, onClick, onDoubleClick, onJobDelete, onJobContextMenu, laneHeight, laneColors, processColors, isSheetMetal, isWeldingLine = false, getVisualPos: _getVisualPos, jobBarDisplayMode = 'standard', jobBarCustomFields = [], masterSkills = [], laneSkills = {}, equipmentColors = {}, jobBarTextColor = '#ffffff', setupTimeColor = '#f59e0b', isAdmin = false, isInsertTarget = false, isSelected = false, currentScheduleDate, fixedJobNames = [] }: DraggableJobProps) {
    // ... (Hooks remain same)
    const isTouchDevice = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;

    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useDraggable({
        id: job.id,
        data: { job, type: 'job' },
        disabled: !isAdmin, // Only disable drag when user is not admin
    });

    // Make jobs droppable too, to serve as anchor points for "insertion"
    const { setNodeRef: setDroppableNodeRef } = useDroppable({
        id: job.id,
    });

    // Combine refs
    const setCombinedRef = (node: HTMLElement | null) => {
        setNodeRef(node);
        setDroppableNodeRef(node);
    };

    const lastTap = useRef<number>(0);
    const lastClick = useRef<number>(0);

    // Handle single click (select) and double click (open modal)
    const handleClick = (e: React.MouseEvent) => {
        const now = Date.now();
        const DOUBLE_CLICK_DELAY = 300;

        // Ensure the element gets focus so it can receive keyboard events
        (e.currentTarget as HTMLElement).focus();
        e.stopPropagation();

        if (now - lastClick.current < DOUBLE_CLICK_DELAY) {
            // Double click - open modal
            if (onDoubleClick) {
                onDoubleClick(job);
            }
        } else {
            // Single click - select for keyboard navigation
            // Ctrl+click (or Cmd+click on Mac) for multi-select
            if (onClick && isAdmin) {
                onClick(job, e.ctrlKey || e.metaKey);
            }
        }
        lastClick.current = now;
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        // タブレットでのダブルタップ時にモーダルがすぐ閉じるバグの修正
        // すべてのタッチイベントでpreventDefaultとstopPropagationを呼び出す
        e.preventDefault();
        e.stopPropagation();

        const now = Date.now();
        const DOUBLE_TAP_DELAY = 300;
        if (now - lastTap.current < DOUBLE_TAP_DELAY) {
            // Double tap - open modal
            if (onDoubleClick) {
                if (navigator.vibrate) navigator.vibrate(50);
                // 少し遅延させてモーダルを開く（タッチイベントの処理完了後）
                setTimeout(() => {
                    onDoubleClick(job);
                }, 50);
            }
        } else {
            // Single tap - select (no shift key on touch)
            if (onClick && isAdmin) {
                onClick(job, false);
            }
        }
        lastTap.current = now;
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (onJobDelete && isAdmin) {
                e.stopPropagation();
                onJobDelete(job.id);
            }
        }
    };

    const getJobStyle = (): React.CSSProperties => {
        // バー位置は親 (MachineRow) で計算したチェイン済みの視覚開始位置を使う。
        // これにより、レーン内で連続する複数ジョブのバーが端数なく連結される。
        const calcDuration = computeJobDurationMinutes(job);
        const visualJobStart = chainedVisualStart;
        const startOffset = visualJobStart - machineStartMinutes;
        // バー幅は常に「秒数情報から計算した実時間」を優先する。
        const duration = Math.max(calcDuration > 0 ? calcDuration : 1, 1);

        // 時間軸と同じ pixelsPerMinute を使い、絶対ピクセル単位でバーを配置する。
        const leftPx = startOffset * pixelsPerMinute;
        const widthPx = duration * pixelsPerMinute;

        return {
            left: `${Math.max(0, leftPx)}px`,
            width: `${Math.max(2, widthPx)}px`,
            top: `${laneIndex * laneHeight + 5}px`,
            height: `${laneHeight - 10}px`
        };
    };

    const style = getJobStyle();
    const dragStyle = transform ? {
        transform: CSS.Translate.toString(transform),
    } : undefined;

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (onJobContextMenu) {
            onJobContextMenu(job, e.clientX, e.clientY, e.ctrlKey || e.metaKey);
        }
    };

    const effectiveProcessColors = processColors || SHEET_METAL_PROCESS_COLORS;

    // Calculate text color based on originalDate vs currentScheduleDate
    const calculatedTextColor = (() => {
        if (job.originalDate && currentScheduleDate && job.originalDate !== currentScheduleDate) {
            const parseDate = (d: string) => {
                let m = d.match(/^(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})/);
                if (m) return new Date(+m[1], +m[2] - 1, +m[3]).getTime();
                m = d.match(/^(\d{2})(\d{2})/);
                if (m) return new Date(new Date().getFullYear(), +m[1] - 1, +m[2]).getTime();
                return 0;
            };
            const orig = parseDate(job.originalDate);
            const curr = parseDate(currentScheduleDate);
            if (orig > 0 && curr > 0) {
                if (orig < curr) return '#ff0000'; // delayed (pure red)
                if (orig > curr) return '#00bfff'; // advanced (vivid light blue)
            }
        }
        return job.textColor || jobBarTextColor;
    })();

    const isDateChanged = job.originalDate && currentScheduleDate && job.originalDate !== currentScheduleDate;

    return (
        <div
            ref={setCombinedRef}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            data-job-bar="true"
            className={`absolute rounded-md shadow-md flex items-center justify-between px-2 text-sm font-medium outline-none select-none ${isDragging ? 'opacity-75 scale-105 shadow-xl ring-2 ring-indigo-400' : (isSelected ? 'ring-2 ring-orange-400 shadow-lg' : 'hover:shadow-lg hover:scale-[1.02]')}`}
            style={{
                ...style,
                ...dragStyle,
                color: calculatedTextColor,
                fontWeight: isDateChanged ? 900 : undefined,
                background: (() => {
                    // 工程外項目はカテゴリ色を優先（ハッチングは別レイヤーで重ねる）
                    if (job.isNonProduction) {
                        return job.color || '#64748b';
                    }
                    const checkSkillMatch = (): boolean => {
                        const jobEquipment = job.equipment || (job as any).equipmentColumn || '';
                        if (masterSkills.length > 0) {
                            const matchesMaster = masterSkills.some(skill =>
                                jobEquipment.includes(skill)
                            );
                            return matchesMaster;
                        }
                        const assignedLaneSkills = laneSkills[job.machine] || [];
                        if (assignedLaneSkills.length > 0) {
                            const matchesLane = assignedLaneSkills.some(skill =>
                                jobEquipment.includes(skill)
                            );
                            return matchesLane;
                        }
                        return false;
                    };

                    if (isSheetMetal) {
                        const equipmentColumn = (job as any).equipmentColumn || '';
                        if (equipmentColumn) {
                            const normalizedEquip = equipmentColumn.trim().replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s: string) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)).toUpperCase();
                            if (effectiveProcessColors[normalizedEquip]) {
                                return effectiveProcessColors[normalizedEquip];
                            }
                        }
                        const targets = [
                            job.machine || '',
                            job.name || '',
                            job.componentOfficialName || '',
                            job.operationCode || '',
                            job.finishedProductNumber || ''
                        ];
                        for (const target of targets) {
                            const processKey = Object.keys(effectiveProcessColors).find(key => target.toUpperCase().includes(key));
                            if (processKey) return effectiveProcessColors[processKey];
                        }
                        const isDefaultGray = job.color === '#94a3b8' || job.color === '#9ca3af';
                        if (job.color && !isDefaultGray) return job.color;

                        return (laneColors && laneColors[job.machine]) || getMachineColor(job.machine);
                    }

                    if (isWeldingLine) {
                        if (job.prototypeNumber && equipmentColors['試作']) {
                            return equipmentColors['試作'];
                        }
                        const jobEquipment = job.equipment || (job as any).equipmentColumn || '';
                        if (jobEquipment) {
                            if (equipmentColors[jobEquipment]) {
                                return equipmentColors[jobEquipment];
                            }
                            for (const [key, color] of Object.entries(equipmentColors)) {
                                if (key !== 'その他' && key !== '試作') {
                                    if (jobEquipment.includes(key) || key.includes(jobEquipment)) {
                                        return color;
                                    }
                                }
                            }
                        }
                        const skillMatches = checkSkillMatch();
                        if (!skillMatches) {
                            return equipmentColors['その他'] || '#9ca3af';
                        }
                        const isDefaultGray = job.color === '#94a3b8' || job.color === '#9ca3af';
                        if (job.color && !isDefaultGray) {
                            return job.color;
                        }
                        return equipmentColors['その他'] || '#6366f1';
                    }

                    const isDefaultGray = job.color === '#94a3b8' || job.color === '#9ca3af';
                    if (job.color && !isDefaultGray) return job.color;
                    return (laneColors && laneColors[job.machine]) || getMachineColor(job.machine);
                })(),
                zIndex: isDragging ? 50 : (isSelected ? 20 : 10),
                border: isSelected 
                    ? '3px solid #f97316' 
                    : (job.changeInstruction === '追加' 
                        ? '3.5px solid #3b82f6' 
                        : (job.isCompleted ? '2px solid #10b981' : '1px solid rgba(255, 255, 255, 0.2)')),
                boxShadow: (isDragging || isSelected) ? '0 10px 15px -3px rgba(0, 0, 0, 0.2), 0 4px 6px -2px rgba(0, 0, 0, 0.1)' : '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
                opacity: 1,
                outline: 'none',
                cursor: isTouchDevice ? 'default' : 'grab',
            }}
            title={isTouchDevice ? "ダブルタップで編集" : "クリックして選択、Deleteキーで削除"}
            onTouchEnd={handleTouchEnd}
            onClick={handleClick}
            onContextMenu={handleContextMenu}
        >
            {isInsertTarget && (
                <div
                    className="absolute -left-1 top-0 bottom-0 w-1 bg-orange-500 rounded-full animate-pulse z-50"
                    style={{
                        boxShadow: '0 0 8px 2px rgba(249, 115, 22, 0.6)',
                    }}
                />
            )}
            <div
                ref={setActivatorNodeRef}
                {...attributes}
                {...listeners}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 35
                }}
            />
            <div
                className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-md pointer-events-none z-0"
                style={{ width: `${job.progress}%` }}
            />
            {(() => {
                // 工程外項目（生産外時間記録）
                if (job.isNonProduction) {
                    const dur = job.manualDurationMinutes || computeJobDurationMinutes(job);
                    const children = job.nonProductionChildren;

                    // 子項目あり → 親バー(上60%) + 子バー群(下40%)
                    if (children && children.length > 0) {
                        const totalChildMins = children.reduce((s, c) => s + c.minutes, 0);
                        return (
                            <div className="absolute inset-0 flex flex-col rounded-md overflow-hidden pointer-events-none">
                                {/* 上部: 大分類バー */}
                                <div className="relative flex-[60] flex items-center min-h-0 overflow-hidden px-2 gap-1">
                                    <div
                                        className="absolute inset-0 pointer-events-none"
                                        style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(255,255,255,0.35) 6px, rgba(255,255,255,0.35) 12px)' }}
                                    />
                                    <span className="relative z-10 font-bold text-xs truncate">
                                        {job.nonProductionCategory || job.name}
                                    </span>
                                    {dur > 0 && (
                                        <span className="relative z-10 text-[10px] opacity-75 flex-none">{dur}分</span>
                                    )}
                                </div>
                                {/* 区切り線 */}
                                <div className="h-px flex-none bg-white/40" />
                                {/* 下部: 子項目バー群 */}
                                <div className="flex-[40] flex min-h-0 overflow-hidden" style={{ gap: '1px' }}>
                                    {children.map(child => {
                                        const widthPct = totalChildMins > 0
                                            ? (child.minutes / totalChildMins) * 100
                                            : (100 / children.length);
                                        return (
                                            <div
                                                key={child.id}
                                                className="h-full flex items-center justify-center overflow-hidden"
                                                style={{
                                                    width: `${widthPct}%`,
                                                    flexShrink: 0,
                                                    background: 'rgba(0,0,0,0.2)',
                                                }}
                                                title={`${child.path ? child.path.join(' > ') : (child.name || '')} ${child.minutes}分`}
                                            >
                                                <span className="text-[9px] font-bold truncate px-0.5 text-white/90">
                                                    {child.path?.at(-1) || child.name || ''}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    }

                    // 子項目なし → 従来の表示
                    return (
                        <>
                            {/* 斜線ハッチング */}
                            <div
                                className="absolute inset-0 rounded-md pointer-events-none z-[2]"
                                style={{
                                    backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(255,255,255,0.35) 6px, rgba(255,255,255,0.35) 12px)'
                                }}
                            />
                            <div
                                className="relative z-10 flex flex-col justify-center gap-0.5 flex-1 min-w-0 px-[5px] overflow-hidden pointer-events-none"
                                style={{ color: 'inherit' }}
                            >
                                <span className="font-bold text-xs truncate">
                                    {job.nonProductionCategory || job.name}
                                </span>
                                {job.nonProductionDetail && (
                                    <span className="text-[10px] opacity-90 truncate font-medium">
                                        {job.nonProductionDetail}
                                    </span>
                                )}
                                {dur > 0 && (
                                    <span className="text-[10px] opacity-80 truncate font-medium">{dur}分</span>
                                )}
                            </div>
                        </>
                    );
                }

                // 自動挿入ジョブ判定
                const isFixedJob = fixedJobNames.length > 0 && fixedJobNames.includes(job.name);

                if (isFixedJob) {
                    // 自動挿入ジョブ: 名称 + 分数のみ表示（段取りセグメントなし）
                    const startMin = timeToMinutes(job.startTime);
                    const endMin = timeToMinutes(job.endTime);
                    const durationMin = endMin - startMin;
                    return (
                        <div
                            className="relative z-10 flex flex-col justify-center gap-0.5 flex-1 min-w-0 px-[5px] overflow-hidden pointer-events-none"
                            style={{ color: 'inherit' }}
                        >
                            <span className={`font-bold text-xs truncate ${job.isCompleted ? 'line-through' : ''}`}>
                                {job.name}
                            </span>
                            {durationMin > 0 && (
                                <span className="text-[10px] opacity-80 truncate font-medium">{durationMin}分</span>
                            )}
                        </div>
                    );
                }

                // 通常ジョブ: 段取りセグメント + フィールド表示
                const setupSeconds = parseInt((job.setupTime || '0').replace(/,/g, ''), 10) || 0;
                const productionSeconds = parseInt((job.productionTime || '0').replace(/,/g, ''), 10) || 0;
                const totalSeconds = setupSeconds + productionSeconds;
                const setupRatio = totalSeconds > 0 ? (setupSeconds / totalSeconds) * 100 : 0;
                return (
                    <>
                        {setupRatio > 0 && (
                            <div
                                className="absolute left-0 top-0 bottom-0 rounded-l-md pointer-events-none z-5 flex items-center justify-center"
                                style={{
                                    width: `${setupRatio}%`,
                                    backgroundColor: setupTimeColor,
                                    opacity: 0.85
                                }}
                            >
                                <div
                                    className="flex flex-col items-center justify-center h-full pointer-events-none overflow-hidden gap-1.5"
                                    style={{ color: 'inherit' }}
                                >
                                    <span className="text-[9px] font-bold leading-tight mb-0.5" style={{ writingMode: 'vertical-rl' }}>段取り</span>
                                    <span className="text-[9px] font-extrabold leading-tight text-center break-all">{Math.ceil(setupSeconds / 60)}分</span>
                                </div>
                            </div>
                        )}
                        <div
                            className="relative z-10 flex flex-col justify-center gap-0.5 flex-1 min-w-0 px-[3px] overflow-hidden pointer-events-none"
                            style={{ 
                                paddingLeft: setupRatio > 0 ? `calc(${setupRatio}% + 3px)` : undefined,
                                color: 'inherit'
                            }}
                        >
                            {(() => {
                                const fieldRenderers: Record<string, () => React.ReactNode> = {
                                    finishedProductNumber: () => job.finishedProductNumber ? (
                                        <span className={`font-bold text-xs truncate ${job.isCompleted ? 'line-through' : ''}`}>
                                            {job.finishedProductNumber}
                                        </span>
                                    ) : null,
                                    name: () => {
                                        const displayName = (job.componentOfficialName === '試作S4' && job.prototypeNumber)
                                            ? job.prototypeNumber
                                            : job.name;
                                        return (
                                            <span className={`font-bold text-xs truncate ${job.isCompleted ? 'line-through' : ''}`}>
                                                {displayName}
                                            </span>
                                        );
                                    },
                                    prototypeNumber: () => job.prototypeNumber ? (
                                        <span className="text-[10px] bg-white/20 px-1 rounded truncate">試作: {job.prototypeNumber}</span>
                                    ) : null,
                                    componentOfficialName: () => {
                                        const isS4 = job.componentOfficialName === '試作S4';
                                        const displayValue = (isS4 && job.prototypeNumber)
                                            ? job.prototypeNumber
                                            : (job.componentOfficialName || job.name);
                                        return (
                                            <span className={`font-bold text-xs truncate ${job.isCompleted ? 'line-through' : ''}`}>
                                                {displayValue}{job.paintColor ? <span className="opacity-50 font-medium"> : {job.paintColor}</span> : ''}
                                            </span>
                                        );
                                    },
                                    dailyQuantity: () => (job.dailyQuantity || job.totalQuantity) ? (
                                        <div className="text-[11px] opacity-95 truncate font-bold">
                                            数量: {job.dailyQuantity || '-'}/{job.totalQuantity || '-'}
                                        </div>
                                    ) : null,
                                    jigAddress: () => job.jigAddress ? (
                                        <div className="text-[10px] opacity-90 truncate">治具: {job.jigAddress}</div>
                                    ) : null,
                                    equipment: () => job.equipment ? (
                                        <div className="text-[10px] opacity-90 truncate">設備: {job.equipment}</div>
                                    ) : null,
                                    nextProcessShop: () => {
                                        const formatDateWithoutYear = (dateStr: string | undefined) => {
                                            if (!dateStr) return '';
                                            const match = dateStr.match(/(\d{1,2})[\/-](\d{1,2})(?:[\/-]\d{2,4})?$|(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
                                            if (match) {
                                                if (match[3]) {
                                                    return `${parseInt(match[4])}/${parseInt(match[5])}`;
                                                } else if (match[1]) {
                                                    return `${parseInt(match[1])}/${parseInt(match[2])}`;
                                                }
                                            }
                                            return dateStr;
                                        };
                                        const scheduleDisplay = formatDateWithoutYear(job.nextProcessSchedule);
                                        return (job.nextProcessShop || job.nextProcessSchedule) ? (
                                            <div className="text-[10px] opacity-90 truncate">
                                                後工程: {job.nextProcessShop || '-'}{scheduleDisplay ? ` (${scheduleDisplay})` : ''}
                                            </div>
                                        ) : null;
                                    },
                                    note: () => job.note ? (
                                        <div className="text-[10px] opacity-80 truncate">備考: {job.note}</div>
                                    ) : null,
                                    workDuration: () => {
                                        const setupSeconds = parseInt((job.setupTime || '0').replace(/,/g, ''), 10) || 0;
                                        const productionSeconds = parseInt((job.productionTime || '0').replace(/,/g, ''), 10) || 0;
                                        const totalMinutes = Math.ceil((setupSeconds + productionSeconds) / 60);
                                        return totalMinutes > 0 ? (
                                            <div className="text-[10px] opacity-90 truncate font-medium">{totalMinutes}分</div>
                                        ) : null;
                                    },
                                    paintColor: () => job.paintColor ? (
                                        <div className="text-[10px] opacity-90 truncate font-semibold">塗装色: {job.paintColor}</div>
                                    ) : null,
                                    ctProductionTime: () => {
                                        const ctSeconds = parseInt((job.cycleTime || '0').replace(/,/g, ''), 10) || 0;
                                        const prodSeconds = parseInt((job.productionTime || '0').replace(/,/g, ''), 10) || 0;
                                        const qty = parseInt((job.dailyQuantity || '0').replace(/,/g, ''), 10) || 0;
                                        // ラベルは CT×個数のみ（段取りなし）。cycleTime 未設定時は productionTime÷60 で代替。
                                        const prodMinutes = (ctSeconds > 0 && qty > 0)
                                            ? Math.ceil(ctSeconds * qty / 60)
                                            : Math.floor(prodSeconds / 60);
                                        return (ctSeconds > 0 || prodSeconds > 0) ? (
                                            <div className="text-[10px] opacity-95 truncate font-bold">
                                                {ctSeconds}秒/{prodMinutes}分
                                            </div>
                                        ) : null;
                                    },
                                };

                                const getFieldsForMode = () => {
                                    switch (jobBarDisplayMode) {
                                        case 'simple':
                                            return ['name'];
                                        case 'detailed':
                                            return ['finishedProductNumber', 'prototypeNumber', 'componentOfficialName', 'dailyQuantity', 'jigAddress', 'equipment', 'nextProcessShop', 'note'];
                                        case 'custom':
                                            return jobBarCustomFields.length > 0 ? jobBarCustomFields : ['finishedProductNumber'];
                                        case 'standard':
                                        default:
                                            if (job.componentOfficialName === '試作S4') {
                                                return ['componentOfficialName', 'finishedProductNumber', 'dailyQuantity', 'ctProductionTime', 'nextProcessShop'];
                                            }
                                            return ['componentOfficialName', 'dailyQuantity', 'ctProductionTime', 'nextProcessShop'];
                                    }
                                };

                                const fields = getFieldsForMode();
                                const mainField = fields[0] || 'finishedProductNumber';
                                const secondaryFields = fields.slice(1);

                                return (
                                    <>
                                        <div className="flex items-center gap-0.5 flex-wrap">
                                            {job.usageAmount && (
                                                <span className="text-yellow-300 font-extrabold text-sm drop-shadow-sm" title={`使用数: ${job.usageAmount}`}>★</span>
                                            )}
                                            {fieldRenderers[mainField]?.()}
                                            {job.isCompleted && (
                                                <span className="text-[11px] bg-green-500 text-white px-1 rounded font-bold">完</span>
                                            )}
                                        </div>
                                        {secondaryFields.map(field => (
                                            <React.Fragment key={field}>{fieldRenderers[field]?.()}</React.Fragment>
                                        ))}
                                    </>
                                );
                            })()}
                        </div>
                    </>
                );
            })()}
        </div>
    );
}

// ... (Lane assignment same)
function assignJobsToLanes(jobs: Job[], timeToMinutes: (time: string) => number): Map<string, number> {
    const laneAssignments = new Map<string, number>();
    const lanes: Array<{ jobId: string; startMinutes: number; endMinutes: number }[]> = [];
    const sortedJobs = [...jobs].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
    console.log('[assignJobsToLanes] Processing', sortedJobs.length, 'jobs');
    for (const job of sortedJobs) {
        const startMinutes = timeToMinutes(job.startTime);
        const endMinutes = timeToMinutes(job.endTime);
        let assignedLane = -1;
        for (let i = 0; i < lanes.length; i++) {
            const lane = lanes[i];
            const overlaps = lane.some(existingJob => !(endMinutes <= existingJob.startMinutes || startMinutes >= existingJob.endMinutes));
            if (!overlaps) {
                assignedLane = i;
                break;
            }
        }
        if (assignedLane === -1) {
            assignedLane = lanes.length;
            lanes.push([]);
        }
        lanes[assignedLane].push({ jobId: job.id, startMinutes, endMinutes });
        laneAssignments.set(job.id, assignedLane);
        console.log(`[assignJobsToLanes] Job "${job.name?.slice(0, 15)}" (${job.startTime}-${job.endTime}) -> laneIndex: ${assignedLane}`);
    }
    return laneAssignments;
}

interface MachineRowProps {
    machine: string;
    jobs: Job[];
    range: { start: number; end: number; timeSlots: string[]; endLabel: string; visualTotal: number };
    idx: number;
    onJobClick?: (job: Job, shiftKey: boolean) => void;
    onDoubleClick?: (job: Job) => void;
    onJobDelete?: (jobId: string | string[]) => void;
    onJobContextMenu?: (job: Job, x: number, y: number, ctrlKey: boolean) => void;
    laneHeight: number;
    pixelsPerTenMinutes: number;
    intervalMinutes: number;
    onShowSummary?: (machine: string) => void;
    showMaterialList?: boolean;
    isSheetMetal?: boolean;
    isWeldingLine?: boolean;
    laneStartTimes?: Record<string, string>;
    laneColors?: Record<string, string>;
    processColors?: Record<string, string>;
    getVisualPos: (mins: number) => number;
    breakTimes: BreakTime[];
    jobBarDisplayMode?: 'standard' | 'simple' | 'detailed' | 'custom';
    jobBarCustomFields?: string[];
    masterSkills?: string[];
    laneSkills?: Record<string, string[]>;
    equipmentColors?: Record<string, string>;
    jobBarTextColor?: string;
    setupTimeColor?: string;
    isAdmin?: boolean;
    dragOverTargetJobId?: string | null;
    selectedJobIds?: string[];
    currentScheduleDate?: string;
    fixedJobNames?: string[];
    onAddNonProductionClick?: (machine: string, defaultStartTime: string) => void;
    laneDefaultStartTime?: string;
}

function MaterialSummaryModal({ machine, jobs, isOpen, onClose }: { machine: string, jobs: Job[], isOpen: boolean, onClose: () => void }) {
    if (!isOpen) return null;

    // Aggregate materials
    const materialSummaries = useMemo(() => {
        const summaries: Record<string, number> = {};
        jobs.forEach(job => {
            const material = job.pipeMaterialName || '不明な材料';
            const amount = parseFloat((job.usageAmount || '0').replace(/,/g, ''));
            if (!isNaN(amount) && amount > 0) {
                summaries[material] = (summaries[material] || 0) + amount;
            }
        });
        return Object.entries(summaries).sort((a, b) => b[1] - a[1]);
    }, [jobs]);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
                    <h3 className="text-white font-bold text-lg flex items-center gap-2">
                        <Package size={20} />
                        {machine} 必要材料集計
                    </h3>
                    <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>
                <div className="p-6">
                    {materialSummaries.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            集計対象の材料データはありません
                        </div>
                    ) : (
                        <div className="overflow-hidden border border-gray-100 rounded-xl">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">材料名</th>
                                        <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">必要数</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {materialSummaries.map(([name, total]) => (
                                        <tr key={name} className="hover:bg-blue-50/30 transition-colors">
                                            <td className="px-4 py-3 text-sm text-gray-700 font-medium">{name}</td>
                                            <td className="px-4 py-3 text-sm text-blue-600 font-bold text-right">{total.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-all shadow-sm active:scale-95"
                    >
                        閉じる
                    </button>
                </div>
            </div>
        </div>
    );
}

function MachineRow({ machine, jobs, range, idx, onJobClick, onDoubleClick, onJobDelete, onJobContextMenu, laneHeight, pixelsPerTenMinutes, intervalMinutes, onShowSummary, showMaterialList, isSheetMetal, isWeldingLine = false, laneStartTimes: _laneStartTimes, laneColors, processColors, getVisualPos, breakTimes, jobBarDisplayMode, jobBarCustomFields, masterSkills = [], laneSkills = {}, equipmentColors = {}, jobBarTextColor, setupTimeColor = '#f59e0b', isAdmin = false, dragOverTargetJobId = null, selectedJobIds = [], currentScheduleDate, fixedJobNames = [], onAddNonProductionClick, laneDefaultStartTime = '08:30' }: MachineRowProps) {
    console.log(`[MachineRow] Machine: "${machine}", Jobs: ${jobs.length}, First 3:`, jobs.slice(0, 3).map(j => ({ name: j.name?.slice(0, 10), start: j.startTime })));
    const { setNodeRef } = useDroppable({
        id: machine,
        data: { machine, range }
    });

    const laneAssignments = useMemo(() => assignJobsToLanes(jobs, timeToMinutes), [jobs]);

    // 各レーン内でジョブを startTime 昇順にソートし、calcDuration ベースで「次のバー位置」を
    // 連鎖計算する。レーン先頭バーだけ自身の startTime をアンカーにし、2 個目以降は
    // 無条件に「前バーの終端」から始める。これによりデータ startTime に含まれる端数や
    // 秒単位のバッファをすべて吸収し、隣接バーは常にピクセルレベルで密着する。
    const chainedStartMap = useMemo(() => {
        const map = new Map<string, number>(); // jobId -> 視覚分（getVisualPos 後）
        const lanesById = new Map<number, Job[]>();
        for (const job of jobs) {
            const laneIdx = laneAssignments.get(job.id) ?? 0;
            if (!lanesById.has(laneIdx)) lanesById.set(laneIdx, []);
            lanesById.get(laneIdx)!.push(job);
        }
        for (const laneJobs of lanesById.values()) {
            laneJobs.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
            let prevChainedEnd: number | null = null;
            for (const job of laneJobs) {
                const dur = computeJobDurationMinutes(job);
                const chainedStart: number = (prevChainedEnd === null)
                    ? getVisualPos(timeToMinutes(job.startTime))   // 先頭はデータ通り
                    : prevChainedEnd;                              // 2個目以降は無条件で前バー終端
                map.set(job.id, chainedStart);
                prevChainedEnd = chainedStart + Math.max(dur, 1);
            }
        }
        return map;
    }, [jobs, laneAssignments, getVisualPos]);

    // 各レーンの「最後のジョブの終端」と「最後のジョブの実時間 endTime」を計算
    const lanesLastEnd = useMemo(() => {
        // laneIdx -> { visualEnd, lastJobEndTime }
        const result = new Map<number, { visualEnd: number; lastJobEndTime: string | null }>();
        const lanesById = new Map<number, Job[]>();
        for (const job of jobs) {
            const laneIdx = laneAssignments.get(job.id) ?? 0;
            if (!lanesById.has(laneIdx)) lanesById.set(laneIdx, []);
            lanesById.get(laneIdx)!.push(job);
        }
        for (const [laneIdx, laneJobs] of lanesById.entries()) {
            laneJobs.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
            let lastEnd = range.start;
            let lastJobEndTime: string | null = null;
            for (const job of laneJobs) {
                const chainedStart = chainedStartMap.get(job.id) ?? getVisualPos(timeToMinutes(job.startTime));
                const dur = Math.max(computeJobDurationMinutes(job), 1);
                lastEnd = chainedStart + dur;
                lastJobEndTime = job.endTime;
            }
            result.set(laneIdx, { visualEnd: lastEnd, lastJobEndTime });
        }
        return result;
    }, [jobs, laneAssignments, chainedStartMap, getVisualPos, range.start]);

    const laneCount = Math.max(1, ...Array.from(laneAssignments.values()).map(l => l + 1));
    const rowHeight = laneCount * laneHeight;
    const pixelsPerMinute = pixelsPerTenMinutes / 10;
    const slotWidth = intervalMinutes * pixelsPerMinute;

    // totalWidth は「視覚総分数 × pixelsPerMinute」で算出。
    // スロット数依存をやめ、ジョブバーと完全に同じ単位系（分→ピクセル）で揃える。
    const totalWidth = range.visualTotal * pixelsPerMinute;

    // Dynamic sizing based on laneHeight
    const namePadding = laneHeight >= 70 ? 'p-2' : laneHeight >= 50 ? 'p-1.5' : 'p-1';
    const nameFontSize = laneHeight >= 70 ? 'text-sm' : laneHeight >= 50 ? 'text-xs' : 'text-[10px]';
    const timeAxisHeight = Math.max(16, Math.min(28, laneHeight * 0.4)); // 16px to 28px
    const timeAxisFontSize = laneHeight >= 70 ? 'text-[11px]' : laneHeight >= 50 ? 'text-[10px]' : 'text-[9px]';
    const timeAxisPadding = laneHeight >= 70 ? 'p-1' : 'p-0.5';

    const totalMinutes = jobs.reduce((sum, job) => sum + computeJobDurationMinutes(job), 0);
    const totalHours = Math.floor(totalMinutes / 60);
    const remainMinutes = Math.round((totalMinutes % 60) * 10) / 10;
    const totalLabel = `${totalHours}時間${remainMinutes}分`;

    // 定時: 8:20〜17:20 = 540分、そこから休憩合計を引いた実質労働時間
    const REGULAR_START_MIN = 8 * 60 + 20;
    const REGULAR_END_MIN = 17 * 60 + 20;
    const REGULAR_MINUTES = REGULAR_END_MIN - REGULAR_START_MIN; // 540分
    // 定時内（8:20〜17:20）に重なる休憩のみカウント（定時外の休憩は除外）
    const totalBreakMinutes = breakTimes.reduce((sum, b) => {
        const bStart = timeToMinutes(b.start);
        const bEnd = timeToMinutes(b.end);
        const effectiveStart = Math.max(bStart, REGULAR_START_MIN);
        const effectiveEnd = Math.min(bEnd, REGULAR_END_MIN);
        return sum + Math.max(0, effectiveEnd - effectiveStart);
    }, 0);
    const netWorkMinutes = REGULAR_MINUTES - totalBreakMinutes;
    const diffMinutes = Math.round((totalMinutes - netWorkMinutes) * 10) / 10;
    const absDiff = Math.abs(diffMinutes);
    const diffH = Math.floor(absDiff / 60);
    const diffM = Math.round((absDiff % 60) * 10) / 10;
    const diffLabel = diffMinutes > 0
        ? (diffH > 0 ? `定時+${diffH}時間${diffM}分` : `定時+${diffM}分`)
        : diffMinutes < 0
        ? (diffH > 0 ? `定時－${diffH}時間${diffM}分` : `定時－${diffM}分`)
        : '定時ちょうど';
    const diffColor = diffMinutes > 0 ? 'text-red-600' : diffMinutes < 0 ? 'text-blue-600' : 'text-gray-500';

    return (
        <div ref={setNodeRef} className={`border-b border-gray-400 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50 print:bg-white'}`}>
            <div className="flex">
                <div
                    className={`flex-none ${namePadding} border-r border-gray-400 sticky left-0 z-30 flex flex-col items-center justify-center text-gray-600 leading-tight gap-1 ${isSheetMetal ? 'w-[150px]' : 'w-[100px]'} print-bg-white`}
                    style={{ backgroundColor: '#e5e7eb', minWidth: isSheetMetal ? '150px' : '100px' }}
                >
                    <div className={`font-bold ${nameFontSize} text-gray-800 mb-1`}>{machine}</div>
                    {jobs.length > 0 && (
                        <div className="flex flex-col items-start">
                            <div className="text-[10px] text-gray-500 leading-tight">生産 {totalLabel}</div>
                            <div className="text-[10px] text-gray-500 leading-tight">
                                定時<span className={diffColor}>{diffLabel.replace('定時', '')}</span>
                            </div>
                        </div>
                    )}
                    {showMaterialList && (
                        <button
                            onClick={() => onShowSummary?.(machine)}
                            className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all text-[10px] font-bold shadow-sm active:scale-95"
                        >
                            <Package size={12} />
                            材料リスト
                        </button>
                    )}
                </div>
                <div
                    className="flex-none relative gantt-grid-container"
                    style={{
                        height: `${rowHeight + (isSheetMetal ? timeAxisHeight : 0)}px`,
                        width: `${totalWidth}px`,
                        minWidth: `${totalWidth}px`,
                    }}
                >
                    {isSheetMetal && (
                        <div
                            className="absolute top-0 left-0 border-b border-gray-200 bg-gray-50/80 z-10"
                            style={{ height: `${timeAxisHeight}px`, width: `${totalWidth}px` }}
                        >
                            {range.timeSlots.map((time, index) => {
                                const nextTime = range.timeSlots[index + 1] ?? range.endLabel;
                                const is1720 = nextTime === '17:20';
                                const is1730 = nextTime === '17:30';
                                return (
                                    <div
                                        key={index}
                                        className={`absolute top-0 ${timeAxisPadding} text-left ${timeAxisFontSize} font-bold ${time === '17:20' ? 'text-red-600' : 'text-gray-600'} ${is1720 ? 'border-r-4 border-red-500 z-5' : is1730 ? 'border-r-0' : 'border-r-2 border-gray-300'} pl-0.5`}
                                        style={{
                                            left: `${index * slotWidth}px`,
                                            width: `${slotWidth}px`,
                                            height: `${timeAxisHeight}px`,
                                        }}
                                    >
                                        {time}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    <div
                        className="absolute inset-0 pointer-events-none"
                        style={{ paddingTop: isSheetMetal ? `${timeAxisHeight}px` : '0' }}
                    >
                        {range.timeSlots.map((_, index) => {
                            const nextTime = range.timeSlots[index + 1] ?? range.endLabel;
                            const is1720 = nextTime === '17:20';
                            const is1730 = nextTime === '17:30';
                            return (
                                <div
                                    key={index}
                                    className={`absolute top-0 bottom-0 ${is1720 ? 'border-r-4 border-red-500 z-5' : is1730 ? 'border-r-0' : 'border-r-2 border-gray-300'}`}
                                    style={{
                                        left: `${index * slotWidth}px`,
                                        width: `${slotWidth}px`,
                                    }}
                                />
                            );
                        })}
                    </div>

                    {breakTimes.filter(b => timeToMinutes(b.start) < timeToMinutes('20:50')).map(b => {
                        const start = timeToMinutes(b.start);
                        const visualStart = getVisualPos(start);
                        return (
                            <div
                                key={b.id}
                                style={{
                                    position: 'absolute',
                                    left: `${visualStart * pixelsPerMinute}px`,
                                    top: 0,
                                    bottom: 0,
                                    width: '2px',
                                    borderLeft: '2px dashed rgba(249, 115, 22, 0.3)',
                                    zIndex: 5,
                                    pointerEvents: 'none',
                                }}
                            />
                        );
                    })}

                    {/* 12:50, 15:10, 17:20 Red Marker Lines */}
                    {['12:50', '15:10', '17:20'].map(markerTime => {
                        const markerMin = timeToMinutes(markerTime);
                        if (markerMin >= range.start && markerMin <= range.end) {
                            const offsetPx = (getVisualPos(markerMin) - getVisualPos(range.start)) * pixelsPerMinute;
                            return (
                                <div
                                    key={`marker-${markerTime}`}
                                    style={{
                                        position: 'absolute',
                                        left: `${offsetPx}px`,
                                        top: 0,
                                        bottom: 0,
                                        width: '1px',
                                        borderLeft: markerTime === '17:20' ? '2px solid #ef4444' : '2px solid rgba(239, 68, 68, 0.85)',
                                        zIndex: 8,
                                        pointerEvents: 'none',
                                    }}
                                />
                            );
                        }
                        return null;
                    })}

                    <div className="relative" style={{ height: `${rowHeight}px`, marginTop: isSheetMetal ? `${timeAxisHeight}px` : '0' }}>
                        {jobs.map((job) => {
                            const laneIndex = laneAssignments.get(job.id) ?? 0;
                            return (
                                <DraggableJob
                                    key={job.id}
                                    job={job}
                                    machineStartMinutes={range.start}
                                    machineTotalVisualMinutes={range.visualTotal}
                                    pixelsPerMinute={pixelsPerMinute}
                                    chainedVisualStart={chainedStartMap.get(job.id) ?? getVisualPos(timeToMinutes(job.startTime))}
                                    laneIndex={laneIndex}
                                    onClick={onJobClick}
                                    onDoubleClick={onDoubleClick}
                                    onJobDelete={onJobDelete}
                                    onJobContextMenu={onJobContextMenu}
                                    laneHeight={laneHeight}
                                    laneColors={laneColors}
                                    processColors={processColors}
                                    isSheetMetal={isSheetMetal}
                                    isWeldingLine={isWeldingLine}
                                    getVisualPos={getVisualPos}
                                    jobBarDisplayMode={jobBarDisplayMode}
                                    jobBarCustomFields={jobBarCustomFields}
                                    masterSkills={masterSkills}
                                    laneSkills={laneSkills}
                                    equipmentColors={equipmentColors}
                                    jobBarTextColor={jobBarTextColor}
                                    setupTimeColor={setupTimeColor}
                                    isAdmin={isAdmin}
                                    isInsertTarget={job.id === dragOverTargetJobId}
                                    isSelected={selectedJobIds.includes(job.id)}
                                    currentScheduleDate={currentScheduleDate}
                                    fixedJobNames={fixedJobNames}
                                />
                            );
                        })}
                        {/* 「予定追加」ボタン（各レーンの最後のジョブ右端） */}
                        {onAddNonProductionClick && Array.from({ length: laneCount }).map((_, li) => {
                            const info = lanesLastEnd.get(li);
                            const visualEnd = info?.visualEnd ?? range.start;
                            const defaultStart = info?.lastJobEndTime ?? laneDefaultStartTime;
                            const leftPx = Math.max(0, (visualEnd - range.start) * pixelsPerMinute);
                            return (
                                <button
                                    key={`add-np-${li}`}
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onAddNonProductionClick(machine, defaultStart);
                                    }}
                                    title="工程外項目を追加"
                                    className="absolute flex items-center justify-center gap-1 rounded-md border-2 border-dashed border-gray-400 bg-white/80 hover:bg-indigo-50 hover:border-indigo-500 text-gray-500 hover:text-indigo-600 text-xs font-bold transition-all z-[15] shadow-sm"
                                    style={{
                                        left: `${leftPx + 2}px`,
                                        top: `${li * laneHeight + 5}px`,
                                        height: `${laneHeight - 10}px`,
                                        width: `${Math.max(60, pixelsPerMinute * 12)}px`,
                                    }}
                                >
                                    <Plus size={14} />
                                    <span>予定追加</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}


export function WeldingGanttChart({ jobs, onJobUpdate, onJobClick, onJobDelete, onSplitJob, visibleMachines, laneHeight = 80, pixelsPerTenMinutes = 80, showMaterialList = false, laneStartTimes, isSheetMetal = false, isWeldingLine = false, laneColors = {}, processColors, laneBreakTimes, jobBarDisplayMode = 'standard', jobBarCustomFields = [], twoRowLayout = false, masterSkills = [], laneSkills = {}, equipmentColors = {}, jobBarTextColor, setupTimeColor = '#f59e0b', isAdmin = false, onMoveJobsToLane, onSwapJobsOrder, schedules = [], currentScheduleId, currentScheduleDate, onMoveJobsToSchedule, onCopyJobs, onPasteJobs, fixedJobNames = [], nonProductionCategories = [], onAddJob }: WeldingGanttChartProps) {
    const [activeJob, setActiveJob] = useState<Job | null>(null);
    const [summaryMachine, setSummaryMachine] = useState<string | null>(null);
    const [dragOverInfo, setDragOverInfo] = useState<{ targetJobId: string; machine: string } | null>(null);
    // Multi-selection state (as array to preserve selection order)
    const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
    // Context menu state for cross-schedule move
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; jobIds: string[] } | null>(null);
    const [menuIndex, setMenuIndex] = useState(0);
    // 工程外項目モーダル
    const [nonProdModal, setNonProdModal] = useState<{
        isOpen: boolean;
        mode: 'create' | 'edit';
        machine: string;
        defaultStartTime: string;
        editingJob: Job | null;
    }>({ isOpen: false, mode: 'create', machine: '', defaultStartTime: '08:30', editingJob: null });

    const openAddNonProduction = (machine: string, defaultStartTime: string) => {
        setNonProdModal({ isOpen: true, mode: 'create', machine, defaultStartTime, editingJob: null });
    };
    const openEditNonProduction = (job: Job) => {
        setNonProdModal({ isOpen: true, mode: 'edit', machine: job.machine, defaultStartTime: job.startTime, editingJob: job });
    };
    const closeNonProductionModal = () => {
        setNonProdModal(prev => ({ ...prev, isOpen: false }));
    };
    const handleSaveNonProduction = async (job: Job) => {
        if (nonProdModal.mode === 'edit') {
            if (onJobUpdate) onJobUpdate(job);
        } else {
            if (onAddJob) {
                const { id: _omit, ...rest } = job;
                await onAddJob(rest);
            }
        }
    };
    const handleDeleteNonProduction = (jobId: string) => {
        if (onJobDelete) onJobDelete(jobId);
    };

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    const displayedMachines = visibleMachines && visibleMachines.length > 0 ? visibleMachines : MACHINES;

    // Determine interval based on zoom level
    // User requested 30 mins at max zoom out.
    let intervalMinutes = 10;
    if (pixelsPerTenMinutes < 35) {
        intervalMinutes = 30;
    } else if (pixelsPerTenMinutes < 50) {
        intervalMinutes = 20;
    }

    // Compute the global max end time from ALL jobs: latest end + 1 hour, rounded to 30 mins
    // Used for print-only dynamic range (see WeldingSchedulePage beforeprint handler)
    // Screen display always uses fixed 21:00

    const machineTimeRanges = useMemo(() => {
        const ranges: Record<string, { start: number; end: number; timeSlots: string[]; endLabel: string; visualTotal: number }> = {};
        displayedMachines.forEach(machineName => {
            const startTimeStr = (laneStartTimes && laneStartTimes[machineName]) || '08:30';
            const minStart = timeToMinutes(startTimeStr);
            const maxEnd = 21 * 60; // 21:00 fixed for screen display

            const machineBreaks = (laneBreakTimes && laneBreakTimes[machineName]) || DEFAULT_BREAKS;
            const sortedBreaks = [...machineBreaks].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

            const getVisualPosLocal = (minutes: number): number => {
                let visual = minutes;
                for (const b of sortedBreaks) {
                    const bStart = timeToMinutes(b.start);
                    const bEnd = timeToMinutes(b.end);
                    const bDuration = bEnd - bStart;
                    if (minutes > bStart) {
                        visual -= Math.min(minutes - bStart, bDuration);
                    }
                }
                return visual;
            };

            const getActualTimeLocal = (visualMinutes: number): number => {
                let actual = visualMinutes;
                for (const b of sortedBreaks) {
                    const bStart = timeToMinutes(b.start);
                    const bEnd = timeToMinutes(b.end);
                    const bDuration = bEnd - bStart;
                    if (visualMinutes >= getVisualPosLocal(bStart)) {
                        actual += bDuration;
                    }
                }
                return actual;
            };

            // Calculate visual start and end for the machine's operating hours
            const visualStart = getVisualPosLocal(minStart);
            const visualEnd = getVisualPosLocal(maxEnd);

            // 視覚時間ベースで時間軸ラベルを生成し、表示は実時間に戻す。
            // ループは排他的 (`<`)。slot[i] は「visualStart + i*interval ～ visualStart + (i+1)*interval」の区間を示す。
            // 終端時刻（visualEnd）は別途 endLabel として保持し、境界線判定に使う。
            const slots: string[] = [];
            for (let vMin = visualStart; vMin < visualEnd; vMin += intervalMinutes) {
                const actualMin = getActualTimeLocal(vMin);
                slots.push(minutesToTime(actualMin));
            }
            const endLabel = minutesToTime(getActualTimeLocal(visualEnd));

            const totalVisualMinutes = visualEnd - visualStart;

            ranges[machineName] = { start: visualStart, end: maxEnd, timeSlots: slots, endLabel, visualTotal: totalVisualMinutes };
        });
        return ranges;
    }, [displayedMachines, intervalMinutes, laneStartTimes, laneBreakTimes]);

    const jobsByMachine = useMemo(() => {
        const grouped: Record<string, Job[]> = {};
        displayedMachines.forEach(m => {
            grouped[m] = jobs.filter(j => j.machine === m);
        });
        return grouped;
    }, [jobs, displayedMachines]);

    const grandTotalMinutes = useMemo(() => {
        return jobs.reduce((sum, job) => sum + computeJobDurationMinutes(job), 0);
    }, [jobs]);
    const grandTotalH = Math.floor(grandTotalMinutes / 60);
    const grandTotalM = Math.round((grandTotalMinutes % 60) * 10) / 10;
    const grandTotalLabel = `生産 ${grandTotalH}時間${grandTotalM}分`;

    const { role } = useAuth();

    const handleKeyDown = React.useCallback((e: KeyboardEvent) => {
        if (contextMenu) return; // コンテキストメニューが開いている時はジョブ移動を無効化
        
        if (selectedJobIds.length === 0) return;
        // For keyboard navigation base calculations, use the first selected job
        const firstSelectedId = selectedJobIds[0];
        const selectedJob = jobs.find(j => j.id === firstSelectedId);
        if (!selectedJob) return;

        const currentMachine = selectedJob.machine;
        const currentMachineIndex = displayedMachines.indexOf(currentMachine);

        switch (e.key) {
            case 'c':
            case 'C':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    if (onCopyJobs) onCopyJobs(selectedJobIds);
                }
                break;
            case 'v':
            case 'V':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    if (onPasteJobs) onPasteJobs();
                }
                break;
            case 'ArrowUp':
                e.preventDefault();
                if (currentMachineIndex > 0 && onMoveJobsToLane) {
                    const newLane = displayedMachines[currentMachineIndex - 1];
                    onMoveJobsToLane(selectedJobIds, newLane);
                }
                break;
            case 'ArrowDown':
                e.preventDefault();
                if (currentMachineIndex < displayedMachines.length - 1 && onMoveJobsToLane) {
                    const newLane = displayedMachines[currentMachineIndex + 1];
                    onMoveJobsToLane(selectedJobIds, newLane);
                }
                break;
            case 'ArrowLeft':
                e.preventDefault();
                if (onSwapJobsOrder) {
                    onSwapJobsOrder(selectedJobIds, 'left');
                }
                break;
            case 'ArrowRight':
                e.preventDefault();
                if (onSwapJobsOrder) {
                    onSwapJobsOrder(selectedJobIds, 'right');
                }
                break;
            case 'Escape':
                setSelectedJobIds([]);
                break;
        }
    }, [selectedJobIds, jobs, displayedMachines, onMoveJobsToLane, onSwapJobsOrder, onCopyJobs, onPasteJobs, contextMenu]);

    // Add keyboard event listener with capture to prevent default browser behaviors like scrolling
    React.useEffect(() => {
        window.addEventListener('keydown', handleKeyDown, { capture: true });
        return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
    }, [handleKeyDown]);

    // Context menu handler: called when a job bar is right-clicked
    const handleJobContextMenu = React.useCallback((job: Job, x: number, y: number, ctrlKey: boolean) => {
        if (!isAdmin || !onMoveJobsToSchedule) return;
        
        // Use functional state update to handle selection logic
        setSelectedJobIds(prev => {
            let next: string[];
            if (ctrlKey) {
                // If Ctrl is held, add/toggle (as per additive request, but user didn't specify toggle here, just "also select")
                next = prev.includes(job.id) ? prev : [...prev, job.id];
            } else {
                // Without Ctrl, clear selection and only select the new job
                next = [job.id];
            }
            
            // Display context menu for the result selection
            setContextMenu({ x, y, jobIds: next });
            setMenuIndex(0);
            return next;
        });
    }, [isAdmin, onMoveJobsToSchedule]);

    const menuItems = React.useMemo(() => {
        if (!contextMenu) return [] as MenuItem[];
        const items: MenuItem[] = [
            { label: 'コピー (Ctrl+C)', action: () => onCopyJobs?.(contextMenu.jobIds), icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg> },
            { label: 'ペースト (Ctrl+V)', action: () => onPasteJobs?.(), icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /></svg> },
            { label: '削除', action: () => onJobDelete?.(contextMenu.jobIds), colorClass: 'text-red-500', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6L17.6 20.2a2 2 0 0 1-2 1.8H8.4a2 2 0 0 1-2-1.8L5 6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg> }
        ];
        if (contextMenu.jobIds.length === 1) {
            items.push({ label: '分割', action: () => onSplitJob?.(contextMenu.jobIds[0]), colorClass: 'text-indigo-500', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M7 21v-4m0-4V7m0-4v4m0 4v4m7 4v-4m0-4V7m0-4v4m0 4v4M3 12h18" /></svg> });
        }
        schedules.filter(s => s.id !== currentScheduleId).forEach(s => {
            items.push({ label: formatScheduleDate(s.date), action: () => onMoveJobsToSchedule?.(contextMenu.jobIds, s.id) });
        });
        items.push({ label: 'キャンセル', action: () => setContextMenu(null) });
        return items;
    }, [contextMenu, schedules, currentScheduleId, onCopyJobs, onPasteJobs, onJobDelete, onSplitJob, onMoveJobsToSchedule]);

    // Keyboard navigation for context menu
    React.useEffect(() => {
        if (!contextMenu || menuItems.length === 0) return;
        const handleMenuKey = (e: KeyboardEvent) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setMenuIndex(prev => (prev + 1) % menuItems.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setMenuIndex(prev => (prev - 1 + menuItems.length) % menuItems.length);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                menuItems[menuIndex]?.action();
                if (menuItems[menuIndex].label !== 'キャンセル') setContextMenu(null);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                setContextMenu(null);
            }
        };
        window.addEventListener('keydown', handleMenuKey);
        return () => window.removeEventListener('keydown', handleMenuKey);
    }, [contextMenu, menuIndex, menuItems]);

    // Close context menu on click outside
    React.useEffect(() => {
        if (!contextMenu) return;
        const close = () => setContextMenu(null);
        // Slight delay so the current click doesn't immediately close the menu
        const t = setTimeout(() => window.addEventListener('click', close), 100);
        return () => {
            clearTimeout(t);
            window.removeEventListener('click', close);
        };
    }, [contextMenu]);



    // Handle job click with Ctrl-based multi-selection
    const handleJobClickWithSelect = (job: Job, ctrlKey: boolean) => {
        if (ctrlKey) {
            // Ctrl+click: toggle in selection list
            setSelectedJobIds(prev => {
                if (prev.includes(job.id)) {
                    return prev.filter(id => id !== job.id); // Ctrl+re-click removes from selection
                } else {
                    return [...prev, job.id]; // Ctrl+click adds to selection (preserve order)
                }
            });
        } else {
            // Normal click: select only this job (clear others)
            setSelectedJobIds([job.id]);
        }
    };

    // Handle job double click to actually open the modal
    const handleJobDoubleClick = (job: Job) => {
        if (job.isNonProduction) {
            openEditNonProduction(job);
            return;
        }
        if (onJobClick) onJobClick(job);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over, delta } = event;
        setActiveJob(null);

        if (!over || !active.data.current?.job) return;

        const job = active.data.current.job as Job;
        let targetMachine = over.id as string;

        // If dropped over another job, get its machine
        if (over.data.current?.type === 'job' && over.data.current.job) {
            targetMachine = over.data.current.job.machine;
        }

        // Restriction for general users (Unless overridden)
        if (!isAdmin && role !== 'admin' && job.machine !== targetMachine) {
            alert('権限がありません。一般ユーザーは機械間の移動はできません。');
            return;
        }

        const targetRange = machineTimeRanges[targetMachine];
        if (!targetRange) return;

        const machineBreaks = (laneBreakTimes && laneBreakTimes[targetMachine]) || DEFAULT_BREAKS;
        const sortedBreaks = [...machineBreaks].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

        const getVisualPosLocal = (minutes: number): number => {
            let visual = minutes;
            for (const b of sortedBreaks) {
                const bStart = timeToMinutes(b.start);
                const bEnd = timeToMinutes(b.end);
                const bDuration = bEnd - bStart;
                if (minutes > bStart) {
                    visual -= Math.min(minutes - bStart, bDuration);
                }
            }
            return visual;
        };

        const getActualTimeLocal = (visualMinutes: number): number => {
            let actual = visualMinutes;
            for (const b of sortedBreaks) {
                const bStart = timeToMinutes(b.start);
                const bEnd = timeToMinutes(b.end);
                const bDuration = bEnd - bStart;
                if (visualMinutes >= getVisualPosLocal(bStart)) {
                    actual += bDuration;
                }
            }
            return actual;
        };

        // Calculate original start and duration using Visual Coords
        const currentStartMinutes = timeToMinutes(job.startTime);
        const currentEndMinutes = timeToMinutes(job.endTime);

        const currentVisualStart = getVisualPosLocal(currentStartMinutes);
        const currentVisualEnd = getVisualPosLocal(currentEndMinutes);
        const visualDuration = currentVisualEnd - currentVisualStart;

        // Calculate visual shift
        const pixelsPerMinute = pixelsPerTenMinutes / 10;
        const visualShift = Math.round(delta.x / pixelsPerMinute);

        // New Visual Start
        let newVisualStart = currentVisualStart + visualShift;
        // Snap to 5 mins
        newVisualStart = Math.max(targetRange.start, Math.round(newVisualStart / 5) * 5);

        // New Visual End (preserving duration)
        const newVisualEnd = newVisualStart + visualDuration;

        // Convert back to Actual Time
        const newStartTimeStr = minutesToTime(getActualTimeLocal(newVisualStart));
        const newEndTimeStr = minutesToTime(getActualTimeLocal(newVisualEnd));

        if (onJobUpdate) {
            onJobUpdate({
                ...job,
                machine: targetMachine,
                startTime: newStartTimeStr,
                endTime: newEndTimeStr
            });
        }

        // Reset drag over info
        setDragOverInfo(null);
    };

    const handleDragStart = (event: { active: { data: { current?: { job?: Job } } } }) => {
        const job = event.active.data.current?.job;
        if (job) {
            setActiveJob(job);
        }
    };

    const handleDragOver = (event: DragOverEvent) => {
        const { over } = event;
        if (!over) {
            setDragOverInfo(null);
            return;
        }

        // Check if hovering over a job
        const overData = over.data.current as { job?: Job; machine?: string; type?: string } | undefined;
        if (overData?.type === 'job' && overData.job) {
            setDragOverInfo({
                targetJobId: overData.job.id,
                machine: overData.job.machine
            });
        } else if (overData?.machine) {
            // Hovering over a machine lane (not a specific job)
            setDragOverInfo(null);
        } else {
            setDragOverInfo(null);
        }
    };

    const firstMachine = displayedMachines[0];
    const firstRange = machineTimeRanges[firstMachine];
    const slotWidthGlobal = (intervalMinutes / 10) * pixelsPerTenMinutes;
    const totalWidthGlobal = firstRange.timeSlots.length * slotWidthGlobal;

    // 2行表示モード用: 12:00を分割点として設定
    const TWO_ROW_SPLIT_TIME = 12 * 60; // 12:00 = 720分


    // 2行表示モードのレンダリング
    if (twoRowLayout) {
        const row1Start = 8 * 60 + 30; // 8:30
        const row1End = TWO_ROW_SPLIT_TIME; // 12:00
        const row2Start = TWO_ROW_SPLIT_TIME; // 12:00
        const row2End = 21 * 60; // 21:00

        // 1行モードと同じ時間軸を使用（休憩時間のスキップを反映）
        // firstRangeのtimeSlotsを12:00で分割
        const allTimeSlots = firstRange.timeSlots;
        const row1Slots = allTimeSlots.filter(time => timeToMinutes(time) < TWO_ROW_SPLIT_TIME);
        const row2Slots = allTimeSlots.filter(time => timeToMinutes(time) >= TWO_ROW_SPLIT_TIME);

        const row1Width = row1Slots.length * slotWidthGlobal;
        const row2Width = row2Slots.length * slotWidthGlobal;
        const maxRowWidth = Math.max(row1Width, row2Width);

        // 最初のマシンの休憩時間を使用（全体の時間軸と合わせる）
        const defaultBreaks = (laneBreakTimes && laneBreakTimes[firstMachine]) || DEFAULT_BREAKS;
        const sortedDefaultBreaks = [...defaultBreaks].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

        // 休憩時間を考慮したビジュアル位置計算
        const getVisualPos = (minutes: number): number => {
            let visual = minutes;
            for (const b of sortedDefaultBreaks) {
                const bStart = timeToMinutes(b.start);
                const bEnd = timeToMinutes(b.end);
                const bDuration = bEnd - bStart;
                if (minutes > bStart) {
                    visual -= Math.min(minutes - bStart, bDuration);
                }
            }
            return visual;
        };

        // 午前/午後の開始ビジュアル位置
        const row1VisualStart = getVisualPos(row1Start);
        const row2VisualStart = getVisualPos(row2Start);

        // ピクセル/分計算
        const pixelsPerMinute = pixelsPerTenMinutes / 10;

        // ジョブが時間範囲と重なるかチェック（範囲とオーバーラップするかどうか）
        const jobOverlapsRange = (job: Job, rangeStart: number, rangeEnd: number): boolean => {
            const jobStart = timeToMinutes(job.startTime);
            const jobEnd = timeToMinutes(job.endTime);
            return jobStart < rangeEnd && jobEnd > rangeStart;
        };

        // ジョブバーをレンダリング（クリップ付き、ビジュアル位置で計算）
        // 1行モードと同じ表示ロジックを使用
        const renderClippedJobBar = (job: Job, rangeStart: number, rangeEnd: number, rowVisualStart: number) => {
            const jobStart = timeToMinutes(job.startTime);
            const jobEnd = timeToMinutes(job.endTime);

            // 表示範囲にクリップ
            const displayStart = Math.max(jobStart, rangeStart);
            const displayEnd = Math.min(jobEnd, rangeEnd);

            // 表示する部分がなければスキップ
            if (displayStart >= displayEnd) return null;

            // ビジュアル位置を計算（休憩時間を考慮）
            const displayVisualStart = getVisualPos(displayStart);
            const displayVisualEnd = getVisualPos(displayEnd);

            // 位置と幅を計算（rowVisualStartからの相対位置）
            const left = (displayVisualStart - rowVisualStart) * pixelsPerMinute;
            const width = (displayVisualEnd - displayVisualStart) * pixelsPerMinute;

            // 色を決定
            let bgColor = job.color || '#6b7280';
            if (isWeldingLine && equipmentColors) {
                // Priority 0: Check if job is a prototype - use prototype color if set
                if (job.prototypeNumber && equipmentColors['試作']) {
                    bgColor = equipmentColors['試作'];
                } else {
                    const equipment = job.equipment || job.finishedProductNumber?.match(/^([A-Z]+)/)?.[1] || '';
                    if (equipment && equipmentColors[equipment]) {
                        bgColor = equipmentColors[equipment];
                    } else if (equipmentColors['その他']) {
                        bgColor = equipmentColors['その他'];
                    }
                }
            }

            // ジョブが12:00をまたぐかどうかを判定
            const isClippedRight = jobEnd > rangeEnd;
            const isClippedLeft = jobStart < rangeStart;

            // 1行モードと同じフィールドレンダラー
            const fieldRenderers: Record<string, () => React.ReactNode> = {
                finishedProductNumber: () => (
                    <span className={`font-bold text-xs truncate ${job.isCompleted ? 'line-through opacity-70' : ''}`}>
                        {job.finishedProductNumber || job.name}
                    </span>
                ),
                name: () => (
                    <span className={`font-bold text-xs truncate ${job.isCompleted ? 'line-through opacity-70' : ''}`}>
                        {job.name}
                    </span>
                ),
                prototypeNumber: () => job.prototypeNumber ? (
                    <span className="text-[10px] bg-white/20 px-1 rounded truncate">試作: {job.prototypeNumber}</span>
                ) : null,
                componentOfficialName: () => job.componentOfficialName ? (
                    <div className="text-[11px] opacity-90 truncate font-medium">{job.componentOfficialName}</div>
                ) : null,
                dailyQuantity: () => (job.dailyQuantity || job.totalQuantity) ? (
                    <div className="text-[11px] opacity-95 truncate font-bold">
                        数量: {job.dailyQuantity || '-'}/{job.totalQuantity || '-'}
                    </div>
                ) : null,
                jigAddress: () => job.jigAddress ? (
                    <div className="text-[10px] opacity-90 truncate">治具: {job.jigAddress}</div>
                ) : null,
                equipment: () => job.equipment ? (
                    <div className="text-[10px] opacity-90 truncate">設備: {job.equipment}</div>
                ) : null,
                nextProcessShop: () => {
                    // 日付から西暦を除去してM/D形式に
                    const formatDateWithoutYear = (dateStr: string | undefined) => {
                        if (!dateStr) return '';
                        // YYYY/MM/DD, YYYY-MM-DD, MM/DD, M/D などに対応
                        const match = dateStr.match(/(\d{1,2})[\/-](\d{1,2})(?:[\/-]\d{2,4})?$|(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
                        if (match) {
                            if (match[3]) {
                                // YYYY-MM-DD format
                                return `${parseInt(match[4])}/${parseInt(match[5])}`;
                            } else if (match[1]) {
                                // MM/DD or MM-DD format
                                return `${parseInt(match[1])}/${parseInt(match[2])}`;
                            }
                        }
                        return dateStr;
                    };
                    const scheduleDisplay = formatDateWithoutYear(job.nextProcessSchedule);
                    return (job.nextProcessShop || job.nextProcessSchedule) ? (
                        <div className="text-[10px] opacity-90 truncate">
                            後工程: {job.nextProcessShop || '-'}{scheduleDisplay ? ` (${scheduleDisplay})` : ''}
                        </div>
                    ) : null;
                },
                note: () => job.note ? (
                    <div className="text-[10px] opacity-80 truncate">備考: {job.note}</div>
                ) : null,
                paintColor: () => job.paintColor ? (
                    <div className="text-[10px] opacity-90 truncate font-semibold">塗装色: {job.paintColor}</div>
                ) : null,
                workDuration: () => {
                    const setupSeconds = parseInt((job.setupTime || '0').replace(/,/g, ''), 10) || 0;
                    const productionSeconds = parseInt((job.productionTime || '0').replace(/,/g, ''), 10) || 0;
                    const totalMinutes = Math.ceil((setupSeconds + productionSeconds) / 60);
                    return totalMinutes > 0 ? (
                        <div className="text-[10px] opacity-90 truncate font-medium">{totalMinutes}分</div>
                    ) : null;
                },
            };

            const getFieldsForMode = () => {
                switch (jobBarDisplayMode) {
                    case 'simple':
                        return ['name'];
                    case 'detailed':
                        return ['finishedProductNumber', 'prototypeNumber', 'componentOfficialName', 'dailyQuantity', 'jigAddress', 'equipment', 'nextProcessShop', 'note'];
                    case 'custom':
                        return jobBarCustomFields.length > 0 ? jobBarCustomFields : ['finishedProductNumber'];
                    case 'standard':
                    default:
                        if (isSheetMetal) {
                            return ['finishedProductNumber', 'componentOfficialName', 'dailyQuantity', 'workDuration', 'nextProcessShop'];
                        }
                        if (isWeldingLine) {
                            return ['finishedProductNumber', 'prototypeNumber', 'componentOfficialName', 'dailyQuantity', 'nextProcessShop'];
                        }
                        return ['finishedProductNumber', 'prototypeNumber', 'componentOfficialName', 'dailyQuantity'];
                }
            };

            const fields = getFieldsForMode();
            const mainField = fields[0] || 'finishedProductNumber';
            const secondaryFields = fields.slice(1);

            // ジョブが12:00をまたぐ場合、どちらが広いかを判定
            // 狭い方はテキストを表示しない（同じ幅なら午前を優先）
            const jobSpansSplit = jobStart < TWO_ROW_SPLIT_TIME && jobEnd > TWO_ROW_SPLIT_TIME;
            let showContent = true;
            if (jobSpansSplit) {
                // 午前部分の幅（開始〜12:00）
                const amWidth = TWO_ROW_SPLIT_TIME - jobStart;
                // 午後部分の幅（12:00〜終了）
                const pmWidth = jobEnd - TWO_ROW_SPLIT_TIME;

                // 現在の部分が狭い方ならテキストを非表示
                // 午前: 午前の幅が午後以上ならテキスト表示
                // 午後: 午後の幅が午前より大きい場合のみテキスト表示（同じなら午前優先）
                if (rangeEnd === TWO_ROW_SPLIT_TIME) {
                    // 午前をレンダリング中
                    showContent = amWidth >= pmWidth;
                } else {
                    // 午後をレンダリング中
                    showContent = pmWidth > amWidth;
                }
            }

            return (
                <div
                    key={`${job.id}-${rangeStart}`}
                    className={`absolute rounded-md shadow-md flex flex-col justify-center px-[3px] text-xs font-medium cursor-pointer hover:shadow-lg overflow-hidden ${isClippedRight ? 'rounded-r-none' : ''} ${isClippedLeft ? 'rounded-l-none' : ''}`}
                    style={{
                        left: `${left}px`,
                        width: `${Math.max(width, 20)}px`,
                        height: `${laneHeight * 0.6}px`,
                        top: `${laneHeight * 0.1}px`,
                        backgroundColor: bgColor,
                        color: (() => {
                            if (job.originalDate && currentScheduleDate && job.originalDate !== currentScheduleDate) {
                                const parseDate = (d: string) => {
                                    let m = d.match(/^(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})/);
                                    if (m) return new Date(+m[1], +m[2] - 1, +m[3]).getTime();
                                    m = d.match(/^(\d{2})(\d{2})/);
                                    if (m) return new Date(new Date().getFullYear(), +m[1] - 1, +m[2]).getTime();
                                    return 0;
                                };
                                const orig = parseDate(job.originalDate);
                                const curr = parseDate(currentScheduleDate);
                                if (orig > 0 && curr > 0) {
                                    if (orig < curr) return '#ff0000'; // delayed (pure red)
                                    if (orig > curr) return '#00bfff'; // advanced (vivid light blue)
                                }
                            }
                            return job.textColor || jobBarTextColor;
                        })(),
                        fontWeight: (job.originalDate && currentScheduleDate && job.originalDate !== currentScheduleDate) ? 900 : undefined,
                        opacity: job.isCompleted ? 0.6 : 1,
                    }}
                    onDoubleClick={() => onJobClick && onJobClick(job)}
                    title={`${job.name || job.finishedProductNumber} (${job.startTime}-${job.endTime})`}
                >
                    {showContent && (
                        <>
                            <div className="flex items-center gap-0.5 flex-wrap">
                                {job.usageAmount && (
                                    <span className="text-yellow-300 font-extrabold text-sm drop-shadow-sm" title={`使用数: ${job.usageAmount}`}>★</span>
                                )}
                                {fieldRenderers[mainField]?.()}
                                {job.isCompleted && (
                                    <span className="text-[11px] bg-green-500 text-white px-1 rounded font-bold">済</span>
                                )}
                            </div>
                            {secondaryFields.map((field, idx) => (
                                <React.Fragment key={idx}>
                                    {fieldRenderers[field]?.()}
                                </React.Fragment>
                            ))}
                        </>
                    )}
                </div>
            );
        };

        // 担当者ごとの午前/午後レンダリング
        const renderMachineWithTwoRows = (m: string, idx: number) => {
            const machineJobs = jobs.filter(j => j.machine === m);
            const row1Jobs = machineJobs.filter(j => jobOverlapsRange(j, row1Start, row1End));
            const row2Jobs = machineJobs.filter(j => jobOverlapsRange(j, row2Start, row2End));

            return (
                <div key={m} className={`border-b-2 border-indigo-200 ${idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                    {/* 担当者名ヘッダー */}
                    <div className="bg-gray-200 px-3 py-1 text-sm font-bold text-gray-800 border-b border-gray-300 flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-gray-500"></span>
                        {m}
                    </div>

                    {/* 午前と午後を共通のスクロールコンテナで包む */}
                    <div className="overflow-x-auto">
                        <div style={{ minWidth: `${maxRowWidth + 100}px` }}>
                            {/* 午前行 */}
                            <div className="flex border-b border-gray-200">
                                <div className="flex-none w-[100px] p-1 text-xs font-bold text-center border-r border-gray-300 bg-gray-100 text-gray-700 flex items-center justify-center sticky left-0 z-30">
                                    午前
                                </div>
                                <div className="flex-1 gantt-grid-container">
                                    <div style={{ width: `${row1Width}px` }}>
                                        <div className="flex bg-gray-50 border-b border-gray-100">
                                            {row1Slots.map((time, index) => {
                                                const nextTime = row1Slots[index + 1];
                                                const is1720 = nextTime === '17:20';
                                                const is1730 = nextTime === '17:30';
                                                return (
                                                    <div
                                                        key={index}
                                                        className={`p-1 text-left text-[10px] ${time === '17:20' ? 'text-red-600 font-extrabold' : 'text-gray-600'} ${is1720 ? 'border-r-4 border-red-500 z-40' : is1730 ? 'border-r-0' : 'border-r-2 border-gray-300'} pl-0.5`}
                                                        style={{ minWidth: `${slotWidthGlobal}px` }}
                                                    >
                                                        {time}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {/* ジョブバー表示エリア */}
                                        <div className="relative" style={{ height: `${laneHeight * 0.8}px` }}>
                                            {/* Standalone markers for row1 */}
                                            {['12:50', '15:10'].map(t => {
                                                const min = timeToMinutes(t);
                                                if (min >= row1Start && min <= row1End) {
                                                    const leftPx = (getVisualPos(min) - getVisualPos(row1Start)) * (pixelsPerTenMinutes / 10);
                                                    return <div key={t} className="absolute top-0 bottom-0 border-l-2 border-red-500/80 z-[8] pointer-events-none" style={{ left: `${leftPx}px`, width:'1px' }} />;
                                                }
                                                return null;
                                            })}
                                            {row1Jobs.map(job => renderClippedJobBar(job, row1Start, row1End, row1VisualStart))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 午後行 */}
                            <div className="flex">
                                <div className="flex-none w-[100px] p-1 text-xs font-bold text-center border-r border-gray-300 bg-gray-100 text-gray-700 flex items-center justify-center sticky left-0 z-30">
                                    午後
                                </div>
                                <div className="flex-1 gantt-grid-container">
                                    <div style={{ width: `${row2Width}px` }}>
                                        <div className="flex bg-gray-50 border-b border-gray-100">
                                            {row2Slots.map((time, index) => {
                                                const nextTime = row2Slots[index + 1];
                                                const is1720 = nextTime === '17:20';
                                                const is1730 = nextTime === '17:30';
                                                return (
                                                    <div
                                                        key={index}
                                                        className={`p-1 text-left text-[10px] ${time === '17:20' ? 'text-red-600 font-extrabold' : 'text-gray-600'} ${is1720 ? 'border-r-4 border-red-500 z-40' : is1730 ? 'border-r-0' : 'border-r-2 border-gray-300'} pl-0.5`}
                                                        style={{ minWidth: `${slotWidthGlobal}px` }}
                                                    >
                                                        {time}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {/* ジョブバー表示エリア */}
                                        <div className="relative" style={{ height: `${laneHeight * 0.8}px` }}>
                                            {/* Standalone markers for row2 */}
                                            {['12:50', '15:10', '17:20'].map(t => {
                                                const min = timeToMinutes(t);
                                                if (min >= row2Start && min <= row2End) {
                                                    const leftPx = (getVisualPos(min) - getVisualPos(row2Start)) * (pixelsPerTenMinutes / 10);
                                                    return <div key={t} className="absolute top-0 bottom-0 border-l-2 z-[8] pointer-events-none" style={{ left: `${leftPx}px`, width:'1px', borderColor: t === '17:20' ? '#ef4444' : 'rgba(239,68,68,0.85)' }} />;
                                                }
                                                return null;
                                            })}
                                            {row2Jobs.map(job => renderClippedJobBar(job, row2Start, row2End, row2VisualStart))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            );
        };

        // 2行モードではDndContextを使わずシンプルにレンダリング（ドラッグ無効）
        return (
            <div className="flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 h-full">
                <div className="flex-1 min-h-0 always-show-scrollbar" style={{ scrollbarGutter: 'stable' }}>
                    {displayedMachines.map((m, idx) => renderMachineWithTwoRows(m, idx))}
                </div>

                <MaterialSummaryModal
                    machine={summaryMachine || ''}
                    jobs={summaryMachine ? jobsByMachine[summaryMachine] || [] : []}
                    isOpen={!!summaryMachine}
                    onClose={() => setSummaryMachine(null)}
                />
            </div>
        );
    }

    return (
        <DndContext onDragEnd={handleDragEnd} onDragStart={handleDragStart} onDragOver={handleDragOver} sensors={sensors} collisionDetection={pointerWithin}>
            <div className="flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 h-full" onClick={(e) => {
                // Clear selection when clicking on empty area (not on a job bar)
                if ((e.target as HTMLElement).closest('[data-job-bar]') === null) {
                    setSelectedJobIds([]);
                }
            }}>
                <div className="flex-1 min-h-0 always-show-scrollbar" style={{ scrollbarGutter: 'stable' }}>
                    <div className="w-fit min-w-full">
                        {!isSheetMetal && (
                            <div className="flex border-b border-gray-400 bg-gray-200 print:bg-white sticky top-0 z-40" style={{ minWidth: `${totalWidthGlobal + (isSheetMetal ? 150 : 100)}px` }}>
                                <div className={`flex-none p-2 font-bold text-xs text-center border-r border-gray-400 bg-gray-200 print:bg-white flex flex-col items-center justify-center text-gray-700 sticky left-0 z-50 ${isSheetMetal ? 'w-[150px]' : 'w-[100px]'}`}>
                                    <span>時間 / 担当者</span>
                                    {jobs.length > 0 && (
                                        <span className="text-[10px] font-normal text-gray-500 mt-0.5">{grandTotalLabel}</span>
                                    )}
                                </div>
                                <div className="flex flex-none gantt-grid-container">
                                    {firstRange.timeSlots.map((time, index) => {
                                        const nextTime = firstRange.timeSlots[index + 1];
                                        const is1720 = nextTime === '17:20';
                                        const is1730 = nextTime === '17:30';
                                        return (
                                            <div
                                                key={index}
                                                className={`flex-none p-2 text-left text-sm font-bold ${time === '17:20' ? 'text-red-600' : 'text-gray-800'} ${is1720 ? 'border-r-4 border-red-500 z-5' : is1730 ? 'border-r-0' : 'border-r-2 border-gray-300'} pl-0.5`}
                                                style={{ width: `${slotWidthGlobal}px` }}
                                            >
                                                {time}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {displayedMachines.map((m, idx) => {
                            const range = machineTimeRanges[m];
                            const mBreaks = (laneBreakTimes && laneBreakTimes[m]) || DEFAULT_BREAKS;
                            const sortedBreaks = [...mBreaks].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

                            const getVisualPosLocal = (minutes: number): number => {
                                let visual = minutes;
                                for (const b of sortedBreaks) {
                                    const bStart = timeToMinutes(b.start);
                                    const bEnd = timeToMinutes(b.end);
                                    const bDuration = bEnd - bStart;
                                    if (minutes > bStart) {
                                        visual -= Math.min(minutes - bStart, bDuration);
                                    }
                                }
                                return visual;
                            };

                            return (
                                <MachineRow
                                    key={m}
                                    machine={m}
                                    jobs={jobs.filter(j => j.machine === m)}
                                    range={range}
                                    idx={idx}
                                    onJobClick={handleJobClickWithSelect}
                                    onDoubleClick={handleJobDoubleClick}
                                    onJobDelete={onJobDelete}
                                    laneHeight={laneHeight}
                                    pixelsPerTenMinutes={pixelsPerTenMinutes}
                                    intervalMinutes={intervalMinutes}
                                    onShowSummary={(machine) => setSummaryMachine(machine)}
                                    showMaterialList={showMaterialList}
                                    isSheetMetal={isSheetMetal}
                                    isWeldingLine={isWeldingLine}
                                    laneStartTimes={laneStartTimes}
                                    laneColors={laneColors}
                                    processColors={processColors}
                                    getVisualPos={getVisualPosLocal}
                                    breakTimes={sortedBreaks}
                                    jobBarDisplayMode={jobBarDisplayMode}
                                    jobBarCustomFields={jobBarCustomFields}
                                    masterSkills={masterSkills}
                                    laneSkills={laneSkills}
                                    equipmentColors={equipmentColors}
                                    jobBarTextColor={jobBarTextColor}
                                    setupTimeColor={setupTimeColor}
                                    isAdmin={isAdmin}
                                    dragOverTargetJobId={dragOverInfo?.targetJobId}
                                    selectedJobIds={selectedJobIds}
                                    onJobContextMenu={handleJobContextMenu}
                                    currentScheduleDate={currentScheduleDate}
                                    fixedJobNames={fixedJobNames}
                                    onAddNonProductionClick={
                                        nonProductionCategories.length > 0 && onAddJob
                                            ? openAddNonProduction
                                            : undefined
                                    }
                                    laneDefaultStartTime={(laneStartTimes && laneStartTimes[m]) || '08:30'}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>

            <DragOverlay>
                {activeJob && (
                    <div
                        className="h-16 rounded-xl shadow-2xl flex items-center justify-between px-4 text-sm font-bold"
                        style={{
                            background: `linear-gradient(135deg, ${activeJob.color || '#3b82f6'} 0%, ${activeJob.color || '#3b82f6'}dd 100%)`,
                            width: '250px',
                            border: '2px solid rgba(255, 255, 255, 0.3)',
                            color: jobBarTextColor,
                        }}
                    >
                        <span>{activeJob.name}</span>
                        <span>{activeJob.progress}%</span>
                    </div>
                )}
            </DragOverlay>

            <MaterialSummaryModal
                machine={summaryMachine || ''}
                jobs={summaryMachine ? jobsByMachine[summaryMachine] || [] : []}
                isOpen={!!summaryMachine}
                onClose={() => setSummaryMachine(null)}
            />

            {nonProductionCategories.length > 0 && (
                <AddNonProductionModal
                    isOpen={nonProdModal.isOpen}
                    mode={nonProdModal.mode}
                    machine={nonProdModal.machine}
                    defaultStartTime={nonProdModal.defaultStartTime}
                    categories={nonProductionCategories}
                    editingJob={nonProdModal.editingJob}
                    onClose={closeNonProductionModal}
                    onSave={handleSaveNonProduction}
                    onDelete={handleDeleteNonProduction}
                    allJobs={jobs}
                    lanes={displayedMachines}
                />
            )}

            {/* Cross-schedule move context menu */}
            {contextMenu && (
                <div
                    className="fixed z-[9999] min-w-[180px] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onClick={e => e.stopPropagation()}
                >
                    <div className="px-3 py-2 bg-indigo-600 text-white text-xs font-bold flex justify-between items-center relative">
                        <span>操作メニュー ({contextMenu.jobIds.length}件)</span>
                    </div>
                    
                    {/* Compiled Menu Items */}
                    <div className="py-1">
                        {menuItems.map((item, index) => {
                            const isSelected = index === menuIndex;
                            // If it has an icon, it's a primary action (Copy, Paste, Delete, Split)
                            const isPrimary = !!item.icon;
                            // If it's the last item, it's Cancel
                            const isCancel = index === menuItems.length - 1;
                            
                            if (isCancel) {
                                return (
                                    <button
                                        key={index}
                                        className={`w-full px-4 py-2 text-xs text-center transition-colors ${
                                            isSelected ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-600 bg-gray-50'
                                        }`}
                                        onClick={item.action}
                                    >{item.label}</button>
                                );
                            }

                            if (!isPrimary) {
                                // Schedule move item section header on first one
                                const firstScheduleIndex = menuItems.findIndex(mi => !mi.icon && mi.label !== 'キャンセル');
                                const isFirstSchedule = index === firstScheduleIndex;

                                return (
                                    <React.Fragment key={index}>
                                        {isFirstSchedule && (
                                            <div className="px-3 py-1.5 bg-gray-50 text-gray-500 text-[11px] font-bold">
                                                別の日へ移動
                                            </div>
                                        )}
                                        <button
                                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors border-b border-gray-100 last:border-0 ${
                                                isSelected ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-100 hover:text-indigo-700'
                                            }`}
                                            onClick={() => {
                                                item.action();
                                                setContextMenu(null);
                                            }}
                                        >
                                            {item.label}
                                        </button>
                                    </React.Fragment>
                                );
                            }

                            return (
                                <button
                                    key={index}
                                    className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2 ${
                                        isSelected ? 'bg-indigo-600 text-white' : `${item.colorClass || 'text-gray-700'} hover:bg-gray-100`
                                    }`}
                                    onClick={() => {
                                        item.action();
                                        setContextMenu(null);
                                    }}
                                >
                                    <span className={isSelected ? 'text-white' : ''}>{item.icon}</span>
                                    {item.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </DndContext>
    );
}
