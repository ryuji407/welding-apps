import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Trash2, Plus, Pencil, Clock } from 'lucide-react';
import type { Job, NonProductionCategory, NonProductionChildItem, NonProductionSubItem } from '../types/job';

const pathKey = (p: string[]) => p.join('\0');

// 子レベル以下の再帰描画
function SubItemPicker({
    nodes,
    pathPrefix,
    depth,
    color,
    isSelected,
    isExpanded,
    onSelect,
    onExpand,
}: {
    nodes: NonProductionSubItem[];
    pathPrefix: string[];
    depth: number;
    color: string;
    isSelected: (path: string[]) => boolean;
    isExpanded: (path: string[]) => boolean;
    onSelect: (path: string[]) => void;
    onExpand: (path: string[]) => void;
}) {
    return (
        <div className="mt-1 space-y-1" style={{ paddingLeft: depth * 14 }}>
            {nodes.map(node => {
                const path = [...pathPrefix, node.name];
                const selected = isSelected(path);
                const expanded = isExpanded(path);
                const hasChildren = (node.children?.length ?? 0) > 0;
                return (
                    <div key={node.name}>
                        <button
                            type="button"
                            onClick={() => hasChildren ? onExpand(path) : onSelect(path)}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm font-medium text-left ${
                                selected
                                    ? 'border-transparent text-white shadow-sm'
                                    : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
                            }`}
                            style={
                                selected
                                    ? { backgroundColor: color }
                                    : { borderLeftColor: color, borderLeftWidth: 3 }
                            }
                        >
                            <span className="flex-1 truncate">{node.name}</span>
                            {hasChildren && (
                                <span className="text-xs opacity-50">{expanded ? '▼' : '▶'}</span>
                            )}
                        </button>
                        {expanded && hasChildren && (
                            <SubItemPicker
                                nodes={node.children!}
                                pathPrefix={path}
                                depth={depth + 1}
                                color={color}
                                isSelected={isSelected}
                                isExpanded={isExpanded}
                                onSelect={onSelect}
                                onExpand={onExpand}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// 大分類〜子分類の階層選択
function HierarchicalCategoryPicker({
    categories,
    selectedPaths,
    onToggle,
}: {
    categories: NonProductionCategory[];
    selectedPaths: string[][];
    onToggle: (path: string[]) => void;
}) {
    const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

    const isSelected = (path: string[]) =>
        selectedPaths.some(sp => pathKey(sp) === pathKey(path));

    const isExpanded = (path: string[]) => expandedKeys.has(pathKey(path));

    const onExpand = (path: string[]) => {
        const key = pathKey(path);
        setExpandedKeys(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    return (
        <div className="space-y-1">
            {categories.map(cat => {
                const path = [cat.name];
                const selected = isSelected(path);
                const expanded = isExpanded(path);
                const hasChildren = (cat.children?.length ?? 0) > 0;
                return (
                    <div key={cat.name}>
                        <button
                            type="button"
                            onClick={() => hasChildren ? onExpand(path) : onToggle(path)}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all text-sm font-bold text-left ${
                                selected
                                    ? 'border-transparent shadow-md'
                                    : 'border-gray-200 hover:border-gray-400 bg-white text-gray-700'
                            }`}
                            style={
                                selected
                                    ? { backgroundColor: cat.color, color: '#fff', borderColor: cat.color }
                                    : {}
                            }
                        >
                            <span
                                className="inline-block w-3 h-3 rounded-full flex-none"
                                style={{ backgroundColor: cat.color }}
                            />
                            <span className="flex-1 truncate">{cat.name}</span>
                            {hasChildren && (
                                <span className="text-xs opacity-60">{expanded ? '▼' : '▶'}</span>
                            )}
                        </button>
                        {expanded && hasChildren && (
                            <SubItemPicker
                                nodes={cat.children!}
                                pathPrefix={path}
                                depth={1}
                                color={cat.color}
                                isSelected={isSelected}
                                isExpanded={isExpanded}
                                onSelect={onToggle}
                                onExpand={onExpand}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

interface AddNonProductionModalProps {
    isOpen: boolean;
    mode: 'create' | 'edit';
    machine: string;
    defaultStartTime: string;       // 'HH:mm'
    categories: NonProductionCategory[];
    editingJob?: Job | null;        // mode='edit' のとき必須
    onClose: () => void;
    onSave: (job: Job) => void;
    onDelete?: (jobId: string) => void;
    allJobs?: Job[];                // その日の全ジョブ（生産一覧表示用）
    lanes?: string[];               // 担当者一覧（フィルタ用）
}

const timeToMinutes = (time: string): number => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
};

const minutesToTime = (mins: number): string => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const getCurrentTime = (): string => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
};

// ドラムロール型時刻ピッカー
function TimePicker({ value, onChange, onClose, anchorRef }: {
    value: string;
    onChange: (time: string) => void;
    onClose: () => void;
    anchorRef: React.RefObject<HTMLButtonElement | null>;
}) {
    const [h, m] = value.split(':').map(Number);
    const hourRef = useRef<HTMLDivElement>(null);
    const minRef = useRef<HTMLDivElement>(null);
    const pickerRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<{ top: number; left?: number; right?: number }>({ top: 0 });

    const hours = Array.from({ length: 15 }, (_, i) => i + 8);
    const minutes = Array.from({ length: 60 }, (_, i) => i);

    useEffect(() => {
        if (anchorRef.current) {
            const rect = anchorRef.current.getBoundingClientRect();
            const pickerH = 440;
            const top = Math.min(rect.top, window.innerHeight - pickerH - 8);
            setPos({ top, right: window.innerWidth - rect.left + 6 });
        }
        const ITEM_H = 32;
        if (hourRef.current) hourRef.current.scrollTop = h * ITEM_H - ITEM_H * 2;
        if (minRef.current) minRef.current.scrollTop = m * ITEM_H - ITEM_H * 2;
    }, []);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [onClose]);

    const setHour = (newH: number) => onChange(`${newH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    const setMin = (newM: number) => onChange(`${h.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}`);

    const colClass = "h-[400px] overflow-y-auto w-14 scroll-smooth overscroll-contain";
    const itemBase = "h-8 flex items-center justify-center text-sm font-mono cursor-pointer select-none transition-colors rounded-lg mx-1";

    return (
        <div
            ref={pickerRef}
            className="fixed z-[100001] bg-white border border-gray-200 rounded-2xl shadow-2xl p-3 flex items-center gap-1"
            style={{ top: pos.top, left: pos.left, right: pos.right }}
            onClick={(e) => e.stopPropagation()}
        >
            <div>
                <p className="text-[10px] text-gray-400 text-center mb-1">時</p>
                <div ref={hourRef} className={colClass}>
                    {hours.map(i => (
                        <div
                            key={i}
                            className={`${itemBase} ${i === h ? 'bg-indigo-500 text-white font-bold' : 'text-gray-700 hover:bg-gray-100'}`}
                            onClick={() => setHour(i)}
                        >
                            {i.toString().padStart(2, '0')}
                        </div>
                    ))}
                </div>
            </div>
            <span className="text-2xl font-bold text-gray-400 pb-1">:</span>
            <div>
                <p className="text-[10px] text-gray-400 text-center mb-1">分</p>
                <div ref={minRef} className={colClass}>
                    {minutes.map(i => (
                        <div
                            key={i}
                            className={`${itemBase} ${i === m ? 'bg-indigo-500 text-white font-bold' : 'text-gray-700 hover:bg-gray-100'}`}
                            onClick={() => setMin(i)}
                        >
                            {i.toString().padStart(2, '0')}
                        </div>
                    ))}
                </div>
            </div>
            <button
                onClick={onClose}
                className="self-start p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg ml-1"
            >
                <X size={16} />
            </button>
        </div>
    );
}

// 時間（分）ピッカー — 時・分の2列
function DurationPicker({ value, onChange, onClose, anchorRef }: {
    value: number;
    onChange: (mins: number) => void;
    onClose: () => void;
    anchorRef: React.RefObject<HTMLButtonElement | null>;
}) {
    const h = Math.floor(value / 60);
    const m = Math.round((value % 60) / 5) * 5 % 60;
    const hourRef = useRef<HTMLDivElement>(null);
    const minRef = useRef<HTMLDivElement>(null);
    const pickerRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<{ top: number; left?: number; right?: number }>({ top: 0 });

    const hourOptions = Array.from({ length: 9 }, (_, i) => i);
    const minOptions = Array.from({ length: 60 }, (_, i) => i);

    useEffect(() => {
        if (anchorRef.current) {
            const rect = anchorRef.current.getBoundingClientRect();
            const pickerH = 440;
            const top = Math.min(rect.top, window.innerHeight - pickerH - 8);
            setPos({ top, left: rect.right + 6 });
        }
        const ITEM_H = 32;
        if (hourRef.current) hourRef.current.scrollTop = h * ITEM_H - ITEM_H * 2;
        const mIdx = minOptions.indexOf(m);
        if (minRef.current) minRef.current.scrollTop = (mIdx < 0 ? 0 : mIdx) * ITEM_H - ITEM_H * 2;
    }, []);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [onClose]);

    const setHour = (newH: number) => onChange(Math.max(1, newH * 60 + m));
    const setMin = (newM: number) => onChange(Math.max(1, h * 60 + newM));

    const colClass = "h-[400px] overflow-y-auto w-14 scroll-smooth overscroll-contain";
    const itemBase = "h-8 flex items-center justify-center text-sm font-mono cursor-pointer select-none transition-colors rounded-lg mx-1";

    return (
        <div
            ref={pickerRef}
            className="fixed z-[100001] bg-white border border-gray-200 rounded-2xl shadow-2xl p-3 flex items-center gap-1"
            style={{ top: pos.top, left: pos.left, right: pos.right }}
            onClick={(e) => e.stopPropagation()}
        >
            <div>
                <p className="text-[10px] text-gray-400 text-center mb-1">時間</p>
                <div ref={hourRef} className={colClass}>
                    {hourOptions.map(i => (
                        <div
                            key={i}
                            className={`${itemBase} ${i === h ? 'bg-indigo-500 text-white font-bold' : 'text-gray-700 hover:bg-gray-100'}`}
                            onClick={() => setHour(i)}
                        >
                            {i}
                        </div>
                    ))}
                </div>
            </div>
            <div>
                <p className="text-[10px] text-gray-400 text-center mb-1">分</p>
                <div ref={minRef} className={colClass}>
                    {minOptions.map(i => (
                        <div
                            key={i}
                            className={`${itemBase} ${i === m ? 'bg-indigo-500 text-white font-bold' : 'text-gray-700 hover:bg-gray-100'}`}
                            onClick={() => setMin(i)}
                        >
                            {i.toString().padStart(2, '0')}
                        </div>
                    ))}
                </div>
            </div>
            <button
                onClick={onClose}
                className="self-start p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg ml-1"
            >
                <X size={16} />
            </button>
        </div>
    );
}

export function AddNonProductionModal({
    isOpen, mode, machine, defaultStartTime, categories,
    editingJob, onClose, onSave, onDelete, allJobs, lanes
}: AddNonProductionModalProps) {
    const [selectedPaths, setSelectedPaths] = useState<string[][]>([]);
    const [startTime, setStartTime] = useState<string>(defaultStartTime);
    const [durationMin, setDurationMin] = useState<number>(15);
    const [detail, setDetail] = useState<string>('');
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [showDurationPicker, setShowDurationPicker] = useState(false);
    const [pickerLane, setPickerLane] = useState<string>(machine);
    const [relatedJobId, setRelatedJobId] = useState<string>('');
    const timeButtonRef = useRef<HTMLButtonElement>(null);
    const durationButtonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        setShowTimePicker(false);
        setShowDurationPicker(false);
        if (mode === 'edit' && editingJob) {
            const catName = editingJob.nonProductionCategory || categories[0]?.name || '';
            let paths: string[][] = [];
            if (catName) {
                const children = editingJob.nonProductionChildren;
                if (children && children.length > 0) {
                    const c = children[0];
                    const sub = c.path ?? (c.name ? [c.name] : []);
                    paths = [sub.length > 0 ? [catName, ...sub] : [catName]];
                } else {
                    paths = [[catName]];
                }
            }
            setSelectedPaths(paths);
            setStartTime(editingJob.startTime || defaultStartTime);
            const dur = editingJob.manualDurationMinutes
                ?? Math.max(0, timeToMinutes(editingJob.endTime || editingJob.startTime) - timeToMinutes(editingJob.startTime));
            setDurationMin(dur > 0 ? dur : 15);
            setDetail(editingJob.nonProductionDetail || '');
            setPickerLane(editingJob.machine || machine);
            setRelatedJobId(editingJob.relatedProductionJobId ?? '');
        } else {
            setSelectedPaths(categories[0]?.name ? [[categories[0].name]] : []);
            setStartTime(getCurrentTime());
            setDurationMin(15);
            setDetail('');
            setPickerLane(machine);
            setRelatedJobId('');
        }
    }, [isOpen, mode, editingJob, defaultStartTime, categories, machine]);

    // ヘッダー色・保存時のカテゴリ名に使う大分類
    const selectedCategory = useMemo(() => {
        const firstRoot = selectedPaths[0]?.[0];
        return categories.find(c => c.name === firstRoot) ?? categories[0];
    }, [selectedPaths, categories]);

    const handleToggle = (path: string[]) => {
        const key = pathKey(path);
        setSelectedPaths(prev => {
            const exists = prev.some(sp => pathKey(sp) === key);
            return exists ? [] : [path];
        });
    };

    // selectedPaths に「生産」を含む項目があるときに生産ピッカーを表示
    const showProductionPicker = selectedPaths.some(p => p.some(seg => seg.includes('生産')));

    // 選択中の担当者の生産ジョブ一覧
    const productionsForLane = (allJobs ?? []).filter(
        j => !j.isNonProduction && j.machine === pickerLane
    );

    if (!isOpen) return null;

    const handleSave = () => {
        if (!selectedCategory) return;
        if (durationMin <= 0) {
            alert('時間は1分以上で入力してください。');
            return;
        }
        const catName = selectedPaths[0]?.[0] ?? selectedCategory.name;
        // 深さ2以上のパスを子項目として保存
        const nonProductionChildren: NonProductionChildItem[] = selectedPaths
            .filter(p => p.length > 1)
            .map(p => ({ id: crypto.randomUUID(), path: p.slice(1), minutes: durationMin }));

        const startMin = timeToMinutes(startTime);
        const relatedJob = relatedJobId ? (allJobs ?? []).find(j => j.id === relatedJobId) : undefined;
        const job: Job = {
            id: mode === 'edit' && editingJob ? editingJob.id : crypto.randomUUID(),
            name: catName,
            startTime,
            endTime: minutesToTime(startMin + durationMin),
            progress: 0,
            machine,
            color: selectedCategory.color,
            manualDurationMinutes: durationMin,
            isNonProduction: true,
            nonProductionCategory: catName,
            nonProductionDetail: detail.trim(),
            ...(nonProductionChildren.length > 0 && { nonProductionChildren }),
            ...(relatedJobId && { relatedProductionJobId: relatedJobId }),
            ...(relatedJob?.name && { relatedProductionName: relatedJob.name }),
        };
        onSave(job);
        onClose();
    };

    const handleDelete = () => {
        if (mode !== 'edit' || !editingJob || !onDelete) return;
        if (!confirm('この工程外項目を削除しますか？')) return;
        onDelete(editingJob.id);
        onClose();
    };

    const headerLabel = mode === 'edit' ? '工程外項目を編集' : '工程外項目を追加';

    return (
        <>
            <div
                className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
                style={{ zIndex: 99998 }}
                onClick={onClose}
            />
            <div
                className="fixed inset-0 flex items-center justify-center p-4"
                style={{ zIndex: 99999 }}
                onClick={onClose}
            >
                <div
                    className={`bg-white rounded-2xl shadow-2xl w-full overflow-hidden animate-in zoom-in-95 fade-in duration-200 border border-gray-100 ${showProductionPicker ? 'max-w-2xl' : 'max-w-md'}`}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div
                        className="px-6 py-3 flex items-center justify-between"
                        style={{
                            background: `linear-gradient(135deg, ${selectedCategory?.color || '#64748b'} 0%, ${selectedCategory?.color || '#64748b'}dd 100%)`
                        }}
                    >
                        <div className="flex items-center gap-2 text-white">
                            {mode === 'edit' ? <Pencil size={18} /> : <Plus size={18} />}
                            <div>
                                <p className="text-white/80 text-[11px] font-medium">{machine} レーン</p>
                                <h3 className="text-base font-bold">{headerLabel}</h3>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-white hover:bg-white/20 p-2 rounded-xl transition-all"
                        >
                            <X size={22} />
                        </button>
                    </div>

                    {/* Body — 生産ピッカー表示時は左右2ペイン */}
                    <div className={`flex ${showProductionPicker ? 'divide-x divide-gray-100' : ''}`}>
                        {/* 左ペイン：既存フォーム */}
                        <div className="p-5 space-y-4 bg-white max-h-[80vh] overflow-y-auto flex-none w-full max-w-md">
                            {/* 階層カテゴリ選択（複数選択・トグル） */}
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-700">分類</label>
                                <HierarchicalCategoryPicker
                                    categories={categories}
                                    selectedPaths={selectedPaths}
                                    onToggle={handleToggle}
                                />
                            </div>

                            {/* 開始時刻 & 時間 */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-700">開始時刻</label>
                                    <div className="relative">
                                        <button
                                            ref={timeButtonRef}
                                            type="button"
                                            onClick={() => setShowTimePicker(v => !v)}
                                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg font-medium text-gray-800 bg-white flex items-center justify-between hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors"
                                        >
                                            <span className="font-mono text-base">{startTime}</span>
                                            <Clock size={15} className="text-gray-400" />
                                        </button>
                                        {showTimePicker && (
                                            <TimePicker
                                                value={startTime}
                                                onChange={(t) => setStartTime(t)}
                                                onClose={() => setShowTimePicker(false)}
                                                anchorRef={timeButtonRef}
                                            />
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-700">時間</label>
                                    <div className="relative">
                                        <button
                                            ref={durationButtonRef}
                                            type="button"
                                            onClick={() => setShowDurationPicker(v => !v)}
                                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg font-medium text-gray-800 bg-white flex items-center justify-between hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors"
                                        >
                                            <span className="font-mono text-base">
                                                {Math.floor(durationMin / 60) > 0 ? `${Math.floor(durationMin / 60)}時間` : ''}{durationMin % 60 > 0 ? `${durationMin % 60}分` : ''}
                                            </span>
                                            {durationMin >= 60 && (
                                                <span className="text-xs text-gray-300">({durationMin}分)</span>
                                            )}
                                        </button>
                                        {showDurationPicker && (
                                            <DurationPicker
                                                value={durationMin}
                                                onChange={(v) => setDurationMin(v)}
                                                onClose={() => setShowDurationPicker(false)}
                                                anchorRef={durationButtonRef}
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* 内容 */}
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-700">具体的な内容（任意）</label>
                                <textarea
                                    value={detail}
                                    onChange={(e) => setDetail(e.target.value)}
                                    rows={2}
                                    placeholder="例: ○○部品の不良対応、△△との打合せ など"
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-400 focus:border-transparent text-gray-800 resize-none"
                                />
                            </div>
                        </div>

                        {/* 右ペイン：生産関連付けパネル */}
                        {showProductionPicker && (
                            <div className="flex flex-col bg-gray-50 w-64 flex-none max-h-[80vh]">
                                <div className="px-4 pt-4 pb-2">
                                    <p className="text-xs font-bold text-gray-700 mb-2">関連する生産</p>
                                    {/* 担当者フィルタ */}
                                    <div className="flex flex-wrap gap-1">
                                        {(lanes ?? [machine]).map(lane => {
                                            const isActive = lane === pickerLane;
                                            return (
                                                <button
                                                    key={lane}
                                                    type="button"
                                                    onClick={() => setPickerLane(lane)}
                                                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all border ${
                                                        isActive
                                                            ? 'border-transparent text-white shadow-sm'
                                                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'
                                                    }`}
                                                    style={isActive ? { backgroundColor: selectedCategory?.color || '#64748b' } : {}}
                                                >
                                                    {lane}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
                                    {productionsForLane.length === 0 ? (
                                        <p className="text-xs text-gray-400 text-center py-4">生産なし</p>
                                    ) : (
                                        productionsForLane.map(job => {
                                            const isSelected = job.id === relatedJobId;
                                            return (
                                                <button
                                                    key={job.id}
                                                    type="button"
                                                    onClick={() => setRelatedJobId(prev => prev === job.id ? '' : job.id)}
                                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all border ${
                                                        isSelected
                                                            ? 'border-transparent text-white font-bold shadow-sm'
                                                            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-100'
                                                    }`}
                                                    style={isSelected ? { backgroundColor: selectedCategory?.color || '#64748b' } : {}}
                                                >
                                                    {job.name}
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-between items-center gap-2">
                        <div>
                            {mode === 'edit' && (
                                <button
                                    onClick={handleDelete}
                                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                >
                                    <Trash2 size={16} /> 削除
                                </button>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-50 transition-all"
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-5 py-2 text-white rounded-lg text-sm font-bold transition-all shadow-md active:scale-95"
                                style={{
                                    background: `linear-gradient(135deg, ${selectedCategory?.color || '#64748b'} 0%, ${selectedCategory?.color || '#64748b'}dd 100%)`
                                }}
                            >
                                {mode === 'edit' ? '保存' : '追加'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
