import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, BookOpen } from 'lucide-react';
import type { Job } from '../types/job';

interface EditJobModalProps {
    job: Job;
    isOpen: boolean;
    onClose: () => void;
    onSave: (updatedJob: Job) => void;
    isAdmin?: boolean;
    isFixedJob?: boolean;
}

export function EditJobModal({ job, isOpen, onClose, onSave, isAdmin = false, isFixedJob = false }: EditJobModalProps) {
    const [editedJob, setEditedJob] = useState<Job>(job);

    useEffect(() => {
        setEditedJob(job);
    }, [job]);

    if (!isOpen) return null;

    const handleClose = () => {
        onSave(editedJob);
        onClose();
    };

    const handleFieldChange = (name: string, value: any) => {
        let updatedJob = {
            ...editedJob,
            [name]: name === 'progress' ? parseInt(value, 10) : value
        };

        // Recalculate productionTime if dependencies change (setupTime, cycleTime, dailyQuantity)
        if (['setupTime', 'cycleTime', 'dailyQuantity'].includes(name)) {
            const setup = parseInt((updatedJob.setupTime || '0').replace(/,/g, ''), 10) || 0;
            const ct = parseInt((updatedJob.cycleTime || '0').replace(/,/g, ''), 10) || 0;
            const qty = parseInt((updatedJob.dailyQuantity || '0').replace(/,/g, ''), 10) || 0;
            updatedJob.productionTime = (setup + (ct * qty)).toString();
        }

        setEditedJob(updatedJob);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        handleFieldChange(name, value);
    };

    const toggleCompleted = () => {
        const updatedJob = { ...editedJob, isCompleted: !editedJob.isCompleted };
        setEditedJob(updatedJob);
        onSave(updatedJob);
    };

    // Compact layout classes
    const rowClass = "grid grid-cols-[130px_1fr] items-center gap-4 py-3 border-b border-gray-50 last:border-0";
    const labelClass = "text-xs font-bold text-gray-800 text-right pr-4 border-r border-gray-100 whitespace-nowrap";
    const inputClass = "w-full px-2 py-1.5 text-sm border-0 focus:ring-0 bg-transparent rounded hover:bg-gray-50 transition-all disabled:text-gray-800 font-medium text-gray-800";

    // 自動挿入ジョブ用のシンプル表示
    if (isFixedJob) {
        const durationMin = job.manualDurationMinutes ||
            (job.startTime && job.endTime
                ? (() => {
                    const [sh, sm] = job.startTime.split(':').map(Number);
                    const [eh, em] = job.endTime.split(':').map(Number);
                    return (eh * 60 + em) - (sh * 60 + sm);
                })()
                : 0);
        return (
            <>
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
                    style={{ zIndex: 99998 }}
                    onClick={handleClose}
                />
                <div
                    className="fixed inset-0 flex items-center justify-center p-4 cursor-pointer"
                    style={{ zIndex: 99999 }}
                    onClick={handleClose}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 fade-in duration-200 cursor-default border border-amber-100"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 px-6 py-3 flex items-center justify-between">
                            <div>
                                <p className="text-amber-100 text-xs font-medium">自動挿入ジョブ</p>
                                <h3 className="text-base font-bold text-white">{editedJob.name || '自動挿入ジョブ'}</h3>
                            </div>
                            <button
                                onClick={handleClose}
                                className="text-white hover:bg-white/20 p-2 rounded-xl transition-all"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        {/* Body */}
                        <div className="p-6 space-y-4 bg-white">
                            {/* 名称 */}
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-600">名称</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={editedJob.name || ''}
                                    onChange={handleChange}
                                    disabled={!isAdmin}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-700 font-bold"
                                    placeholder="ジョブ名"
                                />
                            </div>
                            {/* 所要時間 */}
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-600">所要時間</label>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 px-3 py-2 text-sm bg-amber-50 border border-amber-200 rounded-lg text-amber-800 font-bold text-center">
                                        {durationMin > 0 ? durationMin : '-'}
                                    </div>
                                    <span className="text-sm font-bold text-gray-600">分</span>
                                </div>
                                <p className="text-[10px] text-gray-400">時間は自動挿入ジョブ設定から変更してください</p>
                            </div>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            {/* Backdrop with blur */}
            <div
                className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
                style={{ zIndex: 99998 }}
                onClick={handleClose}
            />

            {/* Modal - Centered Container */}
            <div
                className="fixed inset-0 flex items-center justify-center p-4 cursor-pointer"
                style={{ zIndex: 99999 }}
                onClick={handleClose}
            >
                {/* Modal Inner */}
                <div
                    className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 fade-in duration-200 cursor-default border border-gray-100"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header - Compact Gradient */}
                    <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 px-6 py-3 flex items-center justify-between flex-none">
                        <div className="flex flex-col gap-0.5">
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                                {editedJob.finishedProductNumber || editedJob.name || '新規ジョブ'}
                            </h3>
                        </div>
                        <button
                            onClick={handleClose}
                            className="text-white hover:bg-white/20 p-2 rounded-xl transition-all"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    {/* Form Content - Compressed */}
                    <div className="flex-1 overflow-y-auto p-4 bg-white text-gray-800">
                        <div className="space-y-4">
                            {/* Completion Status Toggle + Manual Link */}
                            <div className="grid grid-cols-2 gap-3 mb-2">
                                {/* 左：着完ボタン */}
                                <button
                                    type="button"
                                    onClick={toggleCompleted}
                                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all duration-300 ${
                                        editedJob.isCompleted
                                            ? 'bg-gradient-to-r from-blue-500 to-indigo-500 border-transparent text-white shadow-lg shadow-blue-500/20 font-bold scale-[1.01]'
                                            : 'bg-white border-gray-200 text-gray-800 font-semibold hover:border-gray-300 hover:bg-gray-50'
                                    }`}
                                >
                                    <CheckCircle2 size={22} />
                                    <span className="text-sm font-bold tracking-widest">
                                        {editedJob.isCompleted ? '完　了' : '未 着 手'}
                                    </span>
                                </button>
                                {/* 右：マニュアルボタン（SHOP6は製品情報ページ、それ以外は段取りマニュアル） */}
                                {editedJob.operationCode ? (
                                    <a
                                        href={(() => {
                                            const code = editedJob.operationCode.includes(':') ? editedJob.operationCode.split(':').slice(1).join(':') : editedJob.operationCode;
                                            const isShop6 = editedJob.equipmentColumn === 'SHOP6' || editedJob.allEquipmentColumns?.includes('SHOP6');
                                            return isShop6
                                                ? `http://192.168.1.249:3000/products/code/${encodeURIComponent(code)}`
                                                : `http://192.168.1.249:3000/manual/${code}`;
                                        })()}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-400 transition-all font-semibold"
                                    >
                                        <BookOpen size={22} />
                                        <span className="text-sm font-bold">マニュアル</span>
                                    </a>
                                ) : (
                                    <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed">
                                        <BookOpen size={22} />
                                        <span className="text-sm font-bold">マニュアル</span>
                                    </div>
                                )}
                            </div>

                            {/* Data Rows - All horizontal */}
                            <div className="bg-gray-50/50 rounded-xl p-2 space-y-0.5 border border-gray-100">
                                {/* 0. 試作番号 / 工程名 (試作時は試作番号のみ) */}
                                {editedJob.prototypeNumber ? (
                                    <div className={rowClass}>
                                        <label className={labelClass}>試作番号</label>
                                        <input
                                            type="text"
                                            name="prototypeNumber"
                                            value={editedJob.prototypeNumber}
                                            onChange={handleChange}
                                            disabled={!isAdmin}
                                            className={`${inputClass} !py-1`}
                                            placeholder="未設定"
                                        />
                                    </div>
                                ) : (
                                    <div className={rowClass}>
                                        <label className={labelClass}>工程名</label>
                                        <input
                                            type="text"
                                            name="componentOfficialName"
                                            value={editedJob.componentOfficialName || ''}
                                            onChange={handleChange}
                                            disabled={!isAdmin}
                                            className={`${inputClass} !py-1`}
                                            placeholder="未設定"
                                        />
                                    </div>
                                )}

                                {/* 2. 当日生産数 / 全数 */}
                                <div className={rowClass}>
                                    <label className={labelClass}>当日生産数/全数</label>
                                    <div className="flex items-center gap-1 pl-2">
                                        <input
                                            type="text"
                                            name="dailyQuantity"
                                            value={editedJob.dailyQuantity || ''}
                                            onChange={handleChange}
                                            disabled={!isAdmin}
                                            className="w-20 px-2 py-1 text-sm bg-white border border-gray-200 rounded focus:ring-1 focus:ring-indigo-500 outline-none text-center font-bold text-gray-800"
                                        />
                                        <span className="text-gray-800 font-bold">/</span>
                                        <input
                                            type="text"
                                            name="totalQuantity"
                                            value={editedJob.totalQuantity || ''}
                                            onChange={handleChange}
                                            disabled={!isAdmin}
                                            className="w-20 px-2 py-1 text-sm bg-gray-100 border border-gray-100 rounded text-gray-800 outline-none text-center"
                                        />
                                    </div>
                                </div>

                                {/* 3. 段取り時間 */}
                                <div className={rowClass}>
                                    <label className={labelClass}>段取り</label>
                                    <div className="flex items-center gap-2 pl-2">
                                        <input
                                            type="text"
                                            value={Math.round((parseInt((editedJob.setupTime || '0').replace(/,/g, ''), 10) || 0) / 60).toString()}
                                            inputMode="numeric"
                                            onChange={(e) => {
                                                const mins = parseInt(e.target.value, 10) || 0;
                                                handleFieldChange('setupTime', (mins * 60).toString());
                                            }}
                                            disabled={!isAdmin}
                                            className="w-20 px-2 py-1 text-sm bg-white border border-gray-200 rounded focus:ring-1 focus:ring-indigo-500 outline-none text-right font-medium text-gray-800"
                                        />
                                        <span className="text-xs text-gray-800 font-bold ml-1">分</span>
                                    </div>
                                </div>

                                {/* 4. CT */}
                                <div className={rowClass}>
                                    <label className={labelClass}>CT</label>
                                    <div className="flex items-center gap-2 pl-2">
                                        <input
                                            type="text"
                                            name="cycleTime"
                                            value={editedJob.cycleTime || ''}
                                            onChange={handleChange}
                                            disabled={!isAdmin}
                                            className="w-20 px-2 py-1 text-sm bg-white border border-gray-200 rounded focus:ring-1 focus:ring-indigo-500 outline-none text-right font-medium text-gray-800"
                                        />
                                        <span className="text-xs text-gray-800 font-bold ml-1">秒</span>
                                    </div>
                                </div>

                                {/* 5. 生産時間 (自動計算) */}
                                <div className={rowClass}>
                                    <div className="flex flex-col items-end border-r border-gray-100 pr-4">
                                        <label className="text-xs font-bold text-gray-800 whitespace-nowrap">総生産時間</label>
                                        <span className="text-[9px] text-gray-500 font-medium tracking-tighter">(段取り+CT×生産数)</span>
                                    </div>
                                    <div className="flex items-center gap-2 pl-2">
                                        {(() => {
                                            const setup = parseInt((editedJob.setupTime || '0').replace(/,/g, ''), 10) || 0;
                                            const ct = parseInt((editedJob.cycleTime || '0').replace(/,/g, ''), 10) || 0;
                                            const qty = parseInt((editedJob.dailyQuantity || '0').replace(/,/g, ''), 10) || 0;
                                            const calculatedSeconds = setup + (ct * qty);
                                            
                                            return (
                                                <>
                                                    <div className="w-20 px-2 py-1 text-sm bg-gray-50 border border-gray-100 rounded text-right font-medium text-gray-800">
                                                        {calculatedSeconds.toLocaleString()}
                                                    </div>
                                                    <span className="text-xs text-gray-800 font-bold ml-1">秒</span>
                                                    <span className="text-[11px] text-gray-800 font-medium ml-1.5 whitespace-nowrap">
                                                        ({Math.round(calculatedSeconds / 60)}分)
                                                    </span>
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>

                                {/* 6. 後工程・日程 統合 (表示のみ) */}
                                <div className={rowClass}>
                                    <label className="text-xs font-bold text-gray-500 text-right pr-4 border-r border-gray-100 whitespace-nowrap">後工程</label>
                                    <div className="flex items-center gap-1 pl-2 text-sm text-gray-500 font-medium overflow-hidden">
                                        <span className="truncate">{editedJob.nextProcessSchedule || '-'}</span>
                                        <span className="text-gray-300 font-bold">・</span>
                                        <span className="truncate">{editedJob.nextProcessShop || '-'}</span>
                                    </div>
                                </div>
                                
                                {/* 7. 塗装色 (表示のみ) */}
                                <div className={rowClass}>
                                    <label className="text-xs font-bold text-gray-500 text-right pr-4 border-r border-gray-100 whitespace-nowrap">色</label>
                                    <div className="flex pl-2 w-full text-sm text-gray-500 font-medium overflow-hidden">
                                        <span className="truncate">{editedJob.paintColor || '未設定'}</span>
                                    </div>
                                </div>

                                {/* 8. 備考 (表示のみ) */}
                                <div className={rowClass}>
                                    <label className="text-xs font-bold text-gray-500 text-right pr-4 border-r border-gray-100 whitespace-nowrap">備考</label>
                                    <div className="flex pl-2 w-full text-sm text-gray-500 font-medium overflow-hidden">
                                        <span className="truncate">{editedJob.note || '備考なし'}</span>
                                    </div>
                                </div>

                                {/* 9. 作業コード (表示のみ) */}
                                <div className={rowClass}>
                                    <label className="text-xs font-bold text-gray-500 text-right pr-4 border-r border-gray-100 whitespace-nowrap">作業コード</label>
                                    <div className="flex pl-2 w-full text-xs text-gray-500 font-medium font-mono">
                                        {editedJob.operationCode || '-'}
                                    </div>
                                </div>

                                {/* 10. 治具番地 (治具場所 / 番地) */}
                                <div className={rowClass}>
                                    <label className="text-xs font-bold text-gray-500 text-right pr-4 border-r border-gray-100 whitespace-nowrap">治具番地</label>
                                    <div className="flex pl-2 w-full text-sm text-gray-500 font-medium text-gray-500">
                                        {(() => {
                                            const loc = editedJob.jigLocation?.trim();
                                            const addr = editedJob.jigAddress?.trim();
                                            if (!loc && !addr) return '-';
                                            if (loc && addr) return `${loc} / ${addr}`;
                                            return loc || addr;
                                        })()}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
