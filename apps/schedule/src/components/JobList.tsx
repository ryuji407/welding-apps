import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronUp, ChevronDown, ArrowRight } from 'lucide-react';
import type { Job } from '../types/job';

interface JobListProps {
    jobs: Job[];
    date?: string;
    onJobUpdate?: (job: Job) => void;
    onJobClick?: (job: Job) => void;
    onJobDelete?: (jobId: string) => void;
    onMoveJobUp?: (jobId: string) => void;
    onMoveJobDown?: (jobId: string) => void;
    schedules?: { id: string; date: string }[];
    activeScheduleId?: string;
    onMoveJobToSchedule?: (jobId: string, targetScheduleId: string) => void;
    isFullHeight?: boolean;
    visibleMachines?: string[];
    isSheetMetal?: boolean;
    isAdmin?: boolean;
    titleField?: 'name' | 'finishedProductNumber';
}

const MACHINES = ['LT7', 'LT Fiber', 'E-TURN'];

export function JobList({
    jobs,
    date,
    onJobUpdate,
    onJobClick,
    onJobDelete,
    onMoveJobUp,
    onMoveJobDown,
    schedules,
    activeScheduleId,
    onMoveJobToSchedule,
    isFullHeight = false,
    selectedMachine = 'all',
    onSelectMachine,
    visibleMachines,
    isSheetMetal,
    isAdmin = false,
    titleField = 'finishedProductNumber'
}: JobListProps & { selectedMachine?: string | 'all', onSelectMachine?: (machine: string | 'all') => void }) {
    const targetMachines = visibleMachines || MACHINES;

    const filteredJobs = jobs.filter(job => {
        const matchesMachine = selectedMachine === 'all' || job.machine === selectedMachine;
        return matchesMachine;
    });

    const handleToggleComplete = (job: Job) => {
        if (onJobUpdate) {
            onJobUpdate({ ...job, isCompleted: !job.isCompleted });
        }
    };

    // date propが渡されていない場合は現在日付を表示（フォールバック）
    const displayDate = date || (() => {
        const today = new Date();
        return `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
    })();

    // 機械ごとにグループ化
    const jobsByMachine: Record<string, Job[]> = {};
    targetMachines.forEach(machine => {
        jobsByMachine[machine] = filteredJobs.filter(j => j.machine === machine);
    });

    return (
        <div className={`bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden flex flex-col ${isFullHeight ? 'h-full' : ''}`}>
            {/* ヘッダー */}
            <div className="px-4 py-2 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 flex items-center justify-between flex-none">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                    📋 製造スケジュール <span className="text-sm font-bold text-gray-600">({displayDate})</span>
                </h3>
            </div>

            {/* フィルター (検索削除) */}
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex-none">
                <div className="flex gap-4 items-center flex-wrap">
                    <div className="flex gap-2">
                        <button
                            onClick={() => onSelectMachine?.('all')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${selectedMachine === 'all'
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                                }`}
                        >
                            全て ({jobs.length})
                        </button>
                        {targetMachines.map(machine => {
                            const machineJobs = jobs.filter(j => j.machine === machine);
                            const count = machineJobs.length;
                            return (
                                <button
                                    key={machine}
                                    onClick={() => onSelectMachine?.(machine)}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${selectedMachine === machine
                                        ? 'bg-indigo-600 text-white shadow-md'
                                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                                        }`}
                                >
                                    {machine} ({count})
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ジョブリスト (ヘッダー行削除) */}
            <div className={`overflow-auto ${isFullHeight ? 'flex-1' : 'max-h-[35vh]'}`}>
                {selectedMachine === 'all' ? (
                    // 機械ごとにグループ表示
                    <>
                        {targetMachines.map(machine => {
                            const machineJobs = jobsByMachine[machine];
                            if (machineJobs.length === 0) return null;

                            return (
                                <div key={machine} className="border-b border-gray-200 last:border-b-0">
                                    <div className="space-y-3 p-4 bg-gray-50/50">
                                        {machineJobs.map(job => (
                                            <JobRow
                                                key={job.id}
                                                job={job}
                                                onToggleComplete={handleToggleComplete}
                                                onEdit={onJobClick}
                                                onDelete={onJobDelete}
                                                onMoveJobUp={onMoveJobUp}
                                                onMoveJobDown={onMoveJobDown}
                                                schedules={schedules}
                                                activeScheduleId={activeScheduleId}
                                                onMoveJobToSchedule={onMoveJobToSchedule}
                                                isAdmin={isAdmin}
                                                titleField={titleField}
                                            />
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </>
                ) : (
                    // 選択された機械のジョブのみ表示
                    <div className="space-y-3 p-4 bg-gray-50/50">
                        {filteredJobs.map(job => (
                            <JobRow
                                key={job.id}
                                job={job}
                                onToggleComplete={handleToggleComplete}
                                onEdit={onJobClick}
                                onDelete={onJobDelete}
                                onMoveJobUp={onMoveJobUp}
                                onMoveJobDown={onMoveJobDown}
                                schedules={schedules}
                                activeScheduleId={activeScheduleId}
                                onMoveJobToSchedule={onMoveJobToSchedule}
                                isSheetMetal={isSheetMetal}
                                isAdmin={isAdmin}
                                titleField={titleField}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

interface JobRowProps {
    job: Job;
    onToggleComplete: (job: Job) => void;
    onEdit?: (job: Job) => void;
    onDelete?: (jobId: string) => void;
    onMoveJobUp?: (jobId: string) => void;
    onMoveJobDown?: (jobId: string) => void;
    schedules?: { id: string; date: string }[];
    activeScheduleId?: string;
    onMoveJobToSchedule?: (jobId: string, targetScheduleId: string) => void;
    isSheetMetal?: boolean;
    isAdmin?: boolean;
    titleField?: 'name' | 'finishedProductNumber';
}

const SHEET_METAL_PROCESS_COLORS: Record<string, string> = {
    'S1': '#3b82f6', // Blue
    'S2': '#10b981', // Emerald/Green
    'S7': '#f97316', // Orange
};

function JobRow({
    job,
    onToggleComplete,
    onEdit,
    onDelete,
    onMoveJobUp,
    onMoveJobDown,
    schedules,
    activeScheduleId,
    onMoveJobToSchedule,
    isSheetMetal,
    isAdmin = false,
    titleField = 'finishedProductNumber'
}: JobRowProps) {
    const isComplete = job.isCompleted;
    const [moveMenuPos, setMoveMenuPos] = useState<{ top: number; left: number } | null>(null);

    const handleMoveClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        // Adjust position to stay on screen (simple logic: place below button, align left)
        setMoveMenuPos({
            top: rect.bottom + 5,
            left: rect.left
        });
    };

    const closeMoveMenu = () => setMoveMenuPos(null);

    return (
        <div
            className={`group relative rounded-xl border p-4 transition-all duration-200 ${isComplete
                ? 'bg-emerald-50/40 border-emerald-100 shadow-sm'
                : 'bg-white border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-200'
                } flex gap-0 overflow-hidden`}
        >
            {isSheetMetal && (
                <div
                    className="absolute left-0 top-0 bottom-0 w-1.5 opacity-80"
                    style={{
                        backgroundColor: (() => {
                            const processKey = Object.keys(SHEET_METAL_PROCESS_COLORS).find(key => job.name.includes(key));
                            return processKey ? SHEET_METAL_PROCESS_COLORS[processKey] : '#cbd5e1';
                        })()
                    }}
                />
            )}
            <div className={`flex items-start gap-4 flex-1 ${isSheetMetal ? 'pl-2' : ''}`}>
                {/* チェックボックス */}
                <div className="flex items-center pt-1">
                    <button
                        onClick={() => onToggleComplete(job)}
                        className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all ${isComplete
                            ? 'bg-green-600 border-green-600'
                            : 'border-gray-300 hover:border-green-500 hover:bg-green-50'
                            }`}
                    >
                        {isComplete && (
                            <svg className="w-5 h-5 text-white" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" viewBox="0 0 24 24" stroke="currentColor">
                                <path d="M5 13l4 4L19 7"></path>
                            </svg>
                        )}
                    </button>
                </div>

                {/* ジョブ情報 */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                        <h5 className={`text-sm font-bold flex items-center gap-1 ${isComplete ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                            {job.usageAmount && (
                                <span className="text-yellow-500 font-bold" title={`使用数: ${job.usageAmount}`}>★</span>
                            )}
                            {(() => {
                                const isS4 = job.componentOfficialName === '試作S4';
                                const displayName = (isS4 && job.prototypeNumber)
                                    ? job.prototypeNumber
                                    : (titleField === 'name' ? (job.name || job.finishedProductNumber) : (job.finishedProductNumber || job.name));
                                return displayName;
                            })()}
                        </h5>
                        {job.prototypeNumber && (
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-sm font-bold rounded">
                                試作: {job.prototypeNumber}
                            </span>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-sm">

                        {job.usageAmount && (
                            <div>
                                <span className="text-gray-500">使用数:</span>
                                <span className="ml-2 text-indigo-600 font-bold bg-indigo-50 px-1 rounded">{job.usageAmount}</span>
                            </div>
                        )}
                        {(job.dailyQuantity || job.totalQuantity) && (
                            <div>
                                <span className="text-gray-500 font-bold">数量:</span>
                                <span className="ml-2 text-gray-900 font-bold">
                                    {job.dailyQuantity}/{job.totalQuantity}
                                </span>
                            </div>
                        )}
                        {(job.setupTime || job.productionTime || job.s4TotalTime) && (
                            <div>
                                <span className="text-gray-500 font-bold">作業時間:</span>
                                <span className="ml-2 text-gray-900 font-bold">
                                    {(() => {
                                        const setupSeconds = parseInt((job.setupTime || '0').replace(/,/g, ''), 10) || 0;
                                        const productionSeconds = parseInt((job.productionTime || '0').replace(/,/g, ''), 10) || 0;
                                        const s4TotalMinutes = parseFloat((job.s4TotalTime || '0').replace(/,/g, '')) || 0;

                                        let totalMinutes = 0;
                                        if (productionSeconds > 0) {
                                            totalMinutes = Math.ceil((setupSeconds + productionSeconds) / 60);
                                        } else if (s4TotalMinutes > 0) {
                                            totalMinutes = Math.ceil(setupSeconds / 60 + s4TotalMinutes);
                                        } else {
                                            totalMinutes = Math.ceil(setupSeconds / 60);
                                        }
                                        return `${totalMinutes}分`;
                                    })()}
                                </span>
                            </div>
                        )}

                        {job.componentOfficialName && (
                            <div>
                                <span className="text-gray-500 font-bold">子品番名称:</span>
                                <span className="ml-2 text-gray-900 font-bold">
                                    {(job.componentOfficialName === '試作S4' && job.prototypeNumber) ? job.prototypeNumber : job.componentOfficialName}
                                </span>
                            </div>
                        )}
                        {job.note && (
                            <div className="col-span-full">
                                <span className="text-gray-500 font-bold">備考:</span>
                                <span className="ml-2 text-gray-900 font-bold">{job.note}</span>
                            </div>
                        )}
                        {(job.nextProcessShop || job.nextProcessSchedule) && (
                            <div className="col-span-full flex flex-wrap gap-x-6 gap-y-2">
                                {job.nextProcessShop && (
                                    <div>
                                        <span className="text-gray-500 font-bold">後工程SHOP:</span>
                                        <span className="ml-2 text-gray-900 font-bold">{job.nextProcessShop}</span>
                                    </div>
                                )}
                                {job.nextProcessSchedule && (
                                    <div>
                                        <span className="text-gray-500 font-bold">後工程日程:</span>
                                        <span className="ml-2 text-gray-900 font-bold">{job.nextProcessSchedule}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* アクションボタン */}
                <div className="flex items-center gap-2">
                    {isAdmin && onMoveJobToSchedule && schedules && schedules.filter(s => s.id !== activeScheduleId).length > 0 && (
                        <>
                            <button
                                onClick={handleMoveClick}
                                className={`px-2 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center ${moveMenuPos ? 'bg-indigo-50 border-indigo-200 ring-2 ring-indigo-100' : ''}`}
                                title="別のページへ移動"
                            >
                                <ArrowRight size={16} />
                            </button>

                            {moveMenuPos && createPortal(
                                <div className="fixed inset-0 z-[9999] isolate">
                                    <div className="fixed inset-0 bg-transparent" onClick={closeMoveMenu} />
                                    <div
                                        className="fixed bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[180px] animate-in fade-in zoom-in-95 duration-100"
                                        style={{
                                            top: moveMenuPos.top,
                                            left: moveMenuPos.left - 140, // Shift left to align roughly securely
                                            maxHeight: '300px',
                                            overflowY: 'auto'
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <div className="px-3 py-2 border-b border-gray-100 text-xs font-semibold text-gray-500 bg-gray-50/50">
                                            移動先を選択
                                        </div>
                                        {schedules.filter(s => s.id !== activeScheduleId).map(s => (
                                            <button
                                                key={s.id}
                                                onClick={() => {
                                                    onMoveJobToSchedule(job.id, s.id);
                                                    closeMoveMenu();
                                                }}
                                                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors border-b border-gray-50 last:border-0"
                                            >
                                                {s.date}
                                            </button>
                                        ))}
                                    </div>
                                </div>,
                                document.body
                            )}
                        </>
                    )}
                    {isAdmin && onMoveJobUp && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onMoveJobUp(job.id);
                            }}
                            className="px-2 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                            title="上に移動"
                        >
                            <ChevronUp size={16} />
                        </button>
                    )}
                    {isAdmin && onMoveJobDown && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onMoveJobDown(job.id);
                            }}
                            className="px-2 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                            title="下に移動"
                        >
                            <ChevronDown size={16} />
                        </button>
                    )}
                    {onEdit && (
                        <button
                            onClick={() => onEdit(job)}
                            className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-bold text-sm flex items-center gap-1"
                        >
                            ✏️ 編集
                        </button>
                    )}
                    {isAdmin && onDelete && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                console.log('Delete button clicked, job id:', job.id);
                                onDelete(job.id);
                            }}
                            className="px-3 py-1.5 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors font-bold text-sm flex items-center gap-1"
                        >
                            🗑️ 削除
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
