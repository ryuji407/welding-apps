import { useState, useMemo, useEffect, useRef } from 'react';
import { ArrowLeft, RefreshCw, ChevronUp, ChevronDown, ListFilter, X, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAllJobsHistory, useWeldingSettings } from '../hooks/useWeldingFirestore';
import type { Job } from '../types/job';
import type { JobHistoryEntry } from '../hooks/useWeldingFirestore';

type Classification = '生産' | '自動追加' | '手動追加' | '工程外項目';

function classifyJob(job: Job, fixedJobNames: string[]): Classification {
    if (job.isNonProduction) return '工程外項目';
    if (fixedJobNames.includes(job.name)) return '自動追加';
    if (job.changeInstruction === '追加') return '手動追加';
    return '生産';
}

const CLASSIFICATION_STYLES: Record<Classification, string> = {
    '生産': 'bg-blue-100 text-blue-700',
    '自動追加': 'bg-green-100 text-green-700',
    '手動追加': 'bg-amber-100 text-amber-700',
    '工程外項目': 'bg-red-100 text-red-700',
};

const ALL_CLASSIFICATIONS: Classification[] = ['生産', '自動追加', '手動追加', '工程外項目'];

type ColKey = 'classification' | 'scheduleDate' | 'machine' | 'name' |
    'finishedProductNumber' | 'prototypeNumber' | 'operationCode' |
    'dailyQuantity' | 'totalQuantity' | 'nextProcessSchedule' |
    'note' | 'changeInstruction' | 'isCompleted';

interface ColDef {
    key: ColKey;
    label: string;
    getValue: (e: JobHistoryEntry, fixedJobNames: string[]) => string;
}

const COLUMNS: ColDef[] = [
    { key: 'classification',        label: '分類',      getValue: (e, f) => classifyJob(e.job, f) },
    { key: 'scheduleDate',          label: '作業日',    getValue: e => e.scheduleDate },
    { key: 'machine',               label: '担当者',    getValue: e => e.job.machine },
    { key: 'name',                  label: 'ジョブ名',  getValue: e => e.job.name },
    { key: 'finishedProductNumber', label: '完成品番',  getValue: e => e.job.finishedProductNumber || '' },
    { key: 'prototypeNumber',       label: '試作番号',  getValue: e => e.job.prototypeNumber || '' },
    { key: 'operationCode',         label: '作業コード', getValue: e => e.job.operationCode || '' },
    { key: 'dailyQuantity',         label: '当日数量',  getValue: e => e.job.dailyQuantity || '' },
    { key: 'totalQuantity',         label: '全数',      getValue: e => e.job.totalQuantity || '' },
    { key: 'nextProcessSchedule',   label: '後工程日程', getValue: e => e.job.nextProcessSchedule || '' },
    { key: 'note',                  label: '備考',      getValue: e => e.job.note || '' },
    { key: 'changeInstruction',     label: '変更指示',  getValue: e => e.job.changeInstruction || '' },
    { key: 'isCompleted',           label: '完了',      getValue: e => e.job.isCompleted ? '済' : '' },
];

interface JobHistoryPageProps {
    onBack: () => void;
}

// ── filter dropdown ──────────────────────────────────────────────────────────
function FilterPopover({
    col,
    filterValue,
    sortCol,
    sortDir,
    onFilter,
    onSort,
    onClose,
}: {
    col: ColDef;
    filterValue: string;
    sortCol: ColKey | null;
    sortDir: 'asc' | 'desc';
    onFilter: (val: string) => void;
    onSort: (dir: 'asc' | 'desc') => void;
    onClose: () => void;
}) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [onClose]);

    const isAsc  = sortCol === col.key && sortDir === 'asc';
    const isDesc = sortCol === col.key && sortDir === 'desc';

    return (
        <div
            ref={ref}
            className="absolute top-full left-0 mt-1 w-44 bg-white rounded-lg shadow-lg border border-gray-200 z-50 p-2 flex flex-col gap-1.5"
            onMouseDown={e => e.stopPropagation()}
        >
            {/* Sort buttons */}
            <div className="flex gap-1">
                <button
                    onClick={() => { onSort('asc'); onClose(); }}
                    className={`flex-1 flex items-center gap-1 text-[11px] px-2 py-1 rounded transition-colors ${isAsc ? 'bg-indigo-100 text-indigo-700 font-bold' : 'hover:bg-gray-100 text-gray-600'}`}
                >
                    <ChevronUp size={12} /> 昇順
                </button>
                <button
                    onClick={() => { onSort('desc'); onClose(); }}
                    className={`flex-1 flex items-center gap-1 text-[11px] px-2 py-1 rounded transition-colors ${isDesc ? 'bg-indigo-100 text-indigo-700 font-bold' : 'hover:bg-gray-100 text-gray-600'}`}
                >
                    <ChevronDown size={12} /> 降順
                </button>
            </div>
            <div className="border-t border-gray-100" />
            {/* Text filter */}
            <div className="relative">
                <input
                    autoFocus
                    type="text"
                    value={filterValue}
                    onChange={e => onFilter(e.target.value)}
                    placeholder="絞り込み..."
                    className="w-full text-[11px] border border-gray-200 rounded px-2 py-1 pr-6 outline-none focus:border-indigo-400"
                />
                {filterValue && (
                    <button
                        onClick={() => onFilter('')}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                    >
                        <X size={11} />
                    </button>
                )}
            </div>
        </div>
    );
}

// ── main component ────────────────────────────────────────────────────────────
export function JobHistoryPage({ onBack }: JobHistoryPageProps) {
    const { entries, loading, error, refetch } = useAllJobsHistory();
    const { fixedJobs } = useWeldingSettings();
    const fixedJobNames = useMemo(() => fixedJobs.map(j => j.name), [fixedJobs]);

    const [selectedClassifications, setSelectedClassifications] = useState<Set<Classification>>(
        new Set(ALL_CLASSIFICATIONS)
    );
    const [includeArchived, setIncludeArchived] = useState(true);

    const [sortCol, setSortCol]   = useState<ColKey | null>('scheduleDate');
    const [sortDir, setSortDir]   = useState<'asc' | 'desc'>('desc');
    const [colFilters, setColFilters] = useState<Partial<Record<ColKey, string>>>({});
    const [openFilterCol, setOpenFilterCol] = useState<ColKey | null>(null);

    const handleSort = (key: ColKey, dir: 'asc' | 'desc') => {
        setSortCol(key);
        setSortDir(dir);
    };

    const handleHeaderClick = (key: ColKey) => {
        if (openFilterCol === key) {
            setOpenFilterCol(null);
        } else {
            setOpenFilterCol(key);
        }
    };

    const setFilter = (key: ColKey, val: string) => {
        setColFilters(prev => ({ ...prev, [key]: val }));
    };

    const toggleClassification = (cls: Classification) => {
        setSelectedClassifications(prev => {
            const next = new Set(prev);
            if (next.has(cls)) next.delete(cls);
            else next.add(cls);
            return next;
        });
    };

    const activeFilterCount = Object.values(colFilters).filter(v => v).length;

    const handleExportExcel = () => {
        const rows = processed.map(({ job, scheduleDate }) => ({
            '分類':       classifyJob(job, fixedJobNames),
            '作業日':     scheduleDate,
            '担当者':     job.machine,
            'ジョブ名':   job.name,
            '完成品番':   job.finishedProductNumber || '',
            '試作番号':   job.prototypeNumber || '',
            '作業コード': job.operationCode || '',
            '当日数量':   job.dailyQuantity || '',
            '全数':       job.totalQuantity || '',
            '後工程日程': job.nextProcessSchedule || '',
            '備考':       job.note || '',
            '変更指示':   job.changeInstruction || '',
            '完了':       job.isCompleted ? '済' : '',
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'ジョブ一覧');
        XLSX.writeFile(wb, `ジョブ一覧_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    const processed = useMemo(() => {
        let result = entries
            .filter(e => includeArchived || !e.isArchived)
            .filter(e => selectedClassifications.has(classifyJob(e.job, fixedJobNames)));

        // column filters
        for (const col of COLUMNS) {
            const f = colFilters[col.key];
            if (f) {
                const lower = f.toLowerCase();
                result = result.filter(e =>
                    col.getValue(e, fixedJobNames).toLowerCase().includes(lower)
                );
            }
        }

        // sort
        if (sortCol) {
            const col = COLUMNS.find(c => c.key === sortCol)!;
            result = [...result].sort((a, b) => {
                const va = col.getValue(a, fixedJobNames);
                const vb = col.getValue(b, fixedJobNames);
                return sortDir === 'asc'
                    ? va.localeCompare(vb, 'ja')
                    : vb.localeCompare(va, 'ja');
            });
        }

        return result;
    }, [entries, includeArchived, selectedClassifications, fixedJobNames, colFilters, sortCol, sortDir]);

    return (
        <div className="h-full flex flex-col bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-3 flex-none no-print">
                <button
                    onClick={onBack}
                    className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                    <ArrowLeft size={16} />
                    <span>ガントチャートに戻る</span>
                </button>
                <div className="w-px h-5 bg-gray-300" />
                <h1 className="text-sm font-bold text-gray-800">全ジョブ一覧</h1>
                <div className="ml-auto flex items-center gap-2">
                    <button
                        onClick={handleExportExcel}
                        className="flex items-center gap-1 text-xs bg-green-600 hover:bg-green-700 text-white px-2.5 py-1 rounded-md transition-colors font-medium"
                        title="現在の表示内容をExcelでダウンロード"
                    >
                        <Download size={13} />
                        <span>Excel</span>
                    </button>
                    <button
                        onClick={refetch}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 transition-colors"
                    >
                        <RefreshCw size={14} />
                        <span>再読込</span>
                    </button>
                </div>
            </div>

            {/* Top filters bar */}
            <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-4 flex-none no-print flex-wrap">
                <span className="text-xs font-medium text-gray-500">分類</span>
                <div className="flex items-center gap-2">
                    {ALL_CLASSIFICATIONS.map(cls => (
                        <button
                            key={cls}
                            onClick={() => toggleClassification(cls)}
                            className={`text-xs px-2 py-1 rounded-full font-medium transition-all ${
                                selectedClassifications.has(cls)
                                    ? CLASSIFICATION_STYLES[cls]
                                    : 'bg-gray-100 text-gray-400'
                            }`}
                        >
                            {cls}
                        </button>
                    ))}
                </div>
                <div className="w-px h-5 bg-gray-200" />
                <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={includeArchived}
                        onChange={e => setIncludeArchived(e.target.checked)}
                        className="accent-indigo-600"
                    />
                    アーカイブ含む
                </label>
                {activeFilterCount > 0 && (
                    <>
                        <div className="w-px h-5 bg-gray-200" />
                        <button
                            onClick={() => setColFilters({})}
                            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition-colors"
                        >
                            <X size={12} />
                            列フィルタをすべてクリア ({activeFilterCount})
                        </button>
                    </>
                )}
                <span className="ml-auto text-xs text-gray-400">{processed.length} 件</span>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
                {loading ? (
                    <div className="flex items-center justify-center h-full text-gray-400 text-sm">読み込み中...</div>
                ) : error ? (
                    <div className="flex items-center justify-center h-full text-red-500 text-sm">{error}</div>
                ) : (
                    <table className="w-full text-xs border-collapse">
                        <thead className="sticky top-0 bg-gray-100 z-20">
                            <tr>
                                {COLUMNS.map(col => {
                                    const isSort   = sortCol === col.key;
                                    const hasFilter = !!colFilters[col.key];
                                    const isOpen   = openFilterCol === col.key;
                                    return (
                                        <th
                                            key={col.key}
                                            className="relative px-2 py-1.5 border-b border-gray-200 whitespace-nowrap"
                                        >
                                            <button
                                                onClick={() => handleHeaderClick(col.key)}
                                                className={`flex items-center gap-1 font-medium transition-colors group ${
                                                    isOpen ? 'text-indigo-600' : 'text-gray-600 hover:text-indigo-500'
                                                }`}
                                            >
                                                <span>{col.label}</span>
                                                {isSort && (
                                                    sortDir === 'asc'
                                                        ? <ChevronUp size={11} className="text-indigo-500" />
                                                        : <ChevronDown size={11} className="text-indigo-500" />
                                                )}
                                                <ListFilter
                                                    size={11}
                                                    className={`transition-opacity ${hasFilter ? 'text-indigo-500 opacity-100' : 'opacity-0 group-hover:opacity-60'}`}
                                                />
                                            </button>
                                            {isOpen && (
                                                <FilterPopover
                                                    col={col}
                                                    filterValue={colFilters[col.key] || ''}
                                                    sortCol={sortCol}
                                                    sortDir={sortDir}
                                                    onFilter={val => setFilter(col.key, val)}
                                                    onSort={(dir) => handleSort(col.key, dir)}
                                                    onClose={() => setOpenFilterCol(null)}
                                                />
                                            )}
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {processed.map(({ job, scheduleDate, isArchived }, i) => {
                                const cls = classifyJob(job, fixedJobNames);
                                return (
                                    <tr
                                        key={`${job.id}-${scheduleDate}-${i}`}
                                        className={`border-b border-gray-100 hover:bg-indigo-50/30 transition-colors ${
                                            isArchived ? 'opacity-60' : ''
                                        } ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                                    >
                                        <td className="px-2 py-1">
                                            <span className={`px-1.5 py-0.5 rounded-full font-medium text-[11px] whitespace-nowrap ${CLASSIFICATION_STYLES[cls]}`}>
                                                {cls}
                                            </span>
                                        </td>
                                        <td className="px-2 py-1 whitespace-nowrap text-gray-700">{scheduleDate}</td>
                                        <td className="px-2 py-1 whitespace-nowrap text-gray-700">{job.machine}</td>
                                        <td className="px-2 py-1 text-gray-800 font-medium max-w-[160px] truncate" title={job.name}>{job.name}</td>
                                        <td className="px-2 py-1 whitespace-nowrap text-gray-600">{job.finishedProductNumber || '—'}</td>
                                        <td className="px-2 py-1 whitespace-nowrap text-gray-600">{job.prototypeNumber || '—'}</td>
                                        <td className="px-2 py-1 whitespace-nowrap text-gray-600">{job.operationCode || '—'}</td>
                                        <td className="px-2 py-1 whitespace-nowrap text-gray-600 text-center">{job.dailyQuantity || '—'}</td>
                                        <td className="px-2 py-1 whitespace-nowrap text-gray-600 text-center">{job.totalQuantity || '—'}</td>
                                        <td className="px-2 py-1 whitespace-nowrap text-gray-600">{job.nextProcessSchedule || '—'}</td>
                                        <td className="px-2 py-1 text-gray-500 max-w-[200px] truncate" title={job.note}>{job.note || '—'}</td>
                                        <td className="px-2 py-1 whitespace-nowrap text-gray-600">{job.changeInstruction || '—'}</td>
                                        <td className="px-2 py-1 text-center">
                                            {job.isCompleted
                                                ? <span className="text-green-600 font-bold">済</span>
                                                : <span className="text-gray-300">—</span>
                                            }
                                        </td>
                                    </tr>
                                );
                            })}
                            {processed.length === 0 && (
                                <tr>
                                    <td colSpan={COLUMNS.length} className="text-center py-12 text-gray-400">
                                        表示するジョブがありません
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
