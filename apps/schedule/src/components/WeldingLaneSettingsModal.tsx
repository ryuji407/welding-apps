import React, { useState, useEffect } from 'react';
import { X, Plus, RefreshCw, Trash2, Clock, ArrowUp, ArrowDown, Copy, Scissors } from 'lucide-react';
import type { FixedJob, BreakTime, NonProductionCategory, NonProductionSubItem } from '../types/job';

// --- ツリー操作ヘルパー（再帰・純粋関数） ---
function treeUpdateName(nodes: NonProductionSubItem[], path: number[], name: string): NonProductionSubItem[] {
    if (path.length === 0) return nodes;
    return nodes.map((n, i) => {
        if (i !== path[0]) return n;
        if (path.length === 1) return { ...n, name };
        return { ...n, children: treeUpdateName(n.children || [], path.slice(1), name) };
    });
}
function treeAddChild(nodes: NonProductionSubItem[], path: number[], newName: string): NonProductionSubItem[] {
    if (path.length === 0) return [...nodes, { name: newName }];
    return nodes.map((n, i) => {
        if (i !== path[0]) return n;
        if (path.length === 1) return { ...n, children: [...(n.children || []), { name: newName }] };
        return { ...n, children: treeAddChild(n.children || [], path.slice(1), newName) };
    });
}
function treeRemove(nodes: NonProductionSubItem[], path: number[]): NonProductionSubItem[] {
    if (path.length === 0) return nodes;
    if (path.length === 1) return nodes.filter((_, i) => i !== path[0]);
    return nodes.map((n, i) => {
        if (i !== path[0]) return n;
        return { ...n, children: treeRemove(n.children || [], path.slice(1)) };
    });
}

interface WeldingLaneSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentLanes: string[];
    currentSkills: Record<string, string[]>;
    currentStartTimes?: Record<string, string>;
    currentLaneColors?: Record<string, string>;
    currentMasterSkills: string[];
    currentFixedJobs?: FixedJob[];
    currentBreakTimes?: Record<string, BreakTime[]>;
    currentJobBarCustomFields?: string[];
    currentProcessColors?: Record<string, string>;
    onSave: (
        newLanes: string[],
        newSkills: Record<string, string[]>,
        newStartTimes: Record<string, string>,
        newColors: Record<string, string>,
        newMasterSkills: string[],
        oldLanes: string[],
        newFixedJobs?: FixedJob[],
        newBreakTimes?: Record<string, BreakTime[]>,
        newJobBarCustomFields?: string[],
        newProcessColors?: Record<string, string>,
        newEquipmentColors?: Record<string, string>,
        newJobBarTextColor?: string,
        newEquipmentWorkerPriority?: Record<string, string[]>,
        newSetupTimeColor?: string
    ) => Promise<void>;
    machineLabel?: string;
    showFixedJobs?: boolean;
    showProcessColors?: boolean;
    showEquipmentColors?: boolean;
    currentEquipmentColors?: Record<string, string>;
    currentJobBarTextColor?: string;
    currentEquipmentWorkerPriority?: Record<string, string[]>;
    currentSetupTimeColor?: string;
    currentNonProductionCategories?: NonProductionCategory[];
    onSaveNonProductionCategories?: (categories: NonProductionCategory[]) => Promise<void> | void;
}

export function WeldingLaneSettingsModal({
    isOpen,
    onClose,
    currentLanes,
    currentSkills,
    currentStartTimes,
    currentLaneColors,
    currentMasterSkills,
    currentFixedJobs = [],
    currentBreakTimes = {},
    currentJobBarCustomFields = ['finishedProductNumber', 'prototypeNumber', 'componentOfficialName', 'dailyQuantity'],
    currentProcessColors = { 'S1': '#3b82f6', 'S2': '#10b981', 'S7': '#f97316' },
    onSave,
    machineLabel = '溶接ライン',
    showFixedJobs = false,
    showProcessColors = false,
    showEquipmentColors = false,
    currentEquipmentColors = {},
    currentJobBarTextColor = '#ffffff',
    currentEquipmentWorkerPriority = {},
    currentSetupTimeColor = '#f59e0b',
    currentNonProductionCategories = [],
    onSaveNonProductionCategories,
}: WeldingLaneSettingsModalProps) {
    const [lanes, setLanes] = useState<string[]>([]);
    const [skills, setSkills] = useState<Record<string, string[]>>({});
    const [startTimes, setStartTimes] = useState<Record<string, string>>({});
    const [colors, setColors] = useState<Record<string, string>>({});
    const [processColors, setProcessColors] = useState<Record<string, string>>(currentProcessColors);
    const [equipmentColors, setEquipmentColors] = useState<Record<string, string>>(currentEquipmentColors);
    const [jobBarTextColor, setJobBarTextColor] = useState<string>(currentJobBarTextColor);
    const [fixedJobs, setFixedJobs] = useState<FixedJob[]>([]);
    const [localBreakTimes, setLocalBreakTimes] = useState<Record<string, BreakTime[]>>(currentBreakTimes || {});
    const [masterSkills, setMasterSkills] = useState<string[]>([]);
    const [newMasterSkillInput, setNewMasterSkillInput] = useState('');

    const [jobBarCustomFields, setJobBarCustomFields] = useState<string[]>(currentJobBarCustomFields);
    const [equipmentWorkerPriority, setEquipmentWorkerPriority] = useState<Record<string, string[]>>(currentEquipmentWorkerPriority);
    const [setupTimeColor, setSetupTimeColor] = useState<string>(currentSetupTimeColor);
    const [nonProdCategories, setNonProdCategories] = useState<NonProductionCategory[]>(currentNonProductionCategories);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setLanes(currentLanes);
            setSkills(currentSkills);
            setStartTimes(currentStartTimes || {});
            setColors(currentLaneColors || {});

            // Ensure '試作' is in masterSkills
            const initialMasterSkills = currentMasterSkills || [];
            if (!initialMasterSkills.includes('試作')) {
                setMasterSkills([...initialMasterSkills, '試作']);
            } else {
                setMasterSkills(initialMasterSkills);
            }
            setFixedJobs(currentFixedJobs || []);
            setLocalBreakTimes(currentBreakTimes || {});
            setJobBarCustomFields(currentJobBarCustomFields);
            setProcessColors(currentProcessColors);
            setEquipmentColors(() => {
                const source = currentEquipmentColors || {};
                const allSkills = currentMasterSkills || [];
                const synced: Record<string, string> = {};
                // 固定エントリを維持
                if (source['その他']) synced['その他'] = source['その他'];
                if (source['試作']) synced['試作'] = source['試作'];
                // マスタースキル順にカラーを追加（存在しないものはデフォルト色）
                allSkills.forEach(skill => {
                    if (skill !== 'その他' && skill !== '試作') {
                        synced[skill] = source[skill] || '#94a3b8';
                    }
                });
                return synced;
            });
            setJobBarTextColor(currentJobBarTextColor);
            setEquipmentWorkerPriority(currentEquipmentWorkerPriority);
            setSetupTimeColor(currentSetupTimeColor);
            setNonProdCategories(currentNonProductionCategories || []);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const handleLaneChange = (index: number, value: string) => {
        const oldName = lanes[index];
        const newLanes = [...lanes];
        newLanes[index] = value;
        setLanes(newLanes);

        if (oldName !== value) {
            const newSkills = { ...skills };
            newSkills[value] = newSkills[oldName] || [];
            delete newSkills[oldName];
            setSkills(newSkills);

            const newStartTimes = { ...startTimes };
            newStartTimes[value] = newStartTimes[oldName] || '08:30';
            delete newStartTimes[oldName];
            setStartTimes(newStartTimes);

            const newColors = { ...colors };
            newColors[value] = newColors[oldName] || '#4f46e5';
            delete newColors[oldName];
            setColors(newColors);

            const newBreakTimes = { ...localBreakTimes };
            newBreakTimes[value] = newBreakTimes[oldName] || [];
            delete newBreakTimes[oldName];
            setLocalBreakTimes(newBreakTimes);
        }
    };

    const handleStartTimeChange = (laneName: string, time: string) => {
        setStartTimes(prev => ({
            ...prev,
            [laneName]: time
        }));
    };

    const handleColorChange = (laneName: string, color: string) => {
        setColors(prev => ({
            ...prev,
            [laneName]: color
        }));
    };

    const handleToggleSkill = (laneName: string, skill: string) => {
        setSkills(prev => {
            const currentLaneSkills = prev[laneName] || [];
            if (currentLaneSkills.includes(skill)) {
                return {
                    ...prev,
                    [laneName]: currentLaneSkills.filter(s => s !== skill)
                };
            } else {
                return {
                    ...prev,
                    [laneName]: [...currentLaneSkills, skill]
                };
            }
        });
    };

    const handleAddLane = () => {
        const newName = `Lane ${lanes.length + 1}`;
        setLanes([...lanes, newName]);
        setSkills(prev => ({ ...prev, [newName]: [] }));
        setStartTimes(prev => ({ ...prev, [newName]: '08:30' }));
        setColors(prev => ({ ...prev, [newName]: '#4f46e5' }));
        
        // 既存の休憩時間（もしあれば一人目のもの）をコピー
        const existingBreaks = lanes.length > 0 ? (localBreakTimes[lanes[0]] || []) : [];
        setLocalBreakTimes(prev => ({ 
            ...prev, 
            [newName]: existingBreaks.map(bt => ({...bt, id: `${Date.now()}-${Math.random()}`})) 
        }));
    };

    const handleRemoveLane = (index: number) => {
        const laneName = lanes[index];
        const newLanes = lanes.filter((_, i) => i !== index);
        setLanes(newLanes);

        const newSkills = { ...skills };
        delete newSkills[laneName];
        setSkills(newSkills);

        const newStartTimes = { ...startTimes };
        delete newStartTimes[laneName];
        setStartTimes(newStartTimes);

        const newColors = { ...colors };
        delete newColors[laneName];
        setColors(newColors);

        const newBreakTimes = { ...localBreakTimes };
        delete newBreakTimes[laneName];
        setLocalBreakTimes(newBreakTimes);
    };

    const handleMoveLane = (index: number, direction: 'up' | 'down') => {
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= lanes.length) return;

        const newLanes = [...lanes];
        [newLanes[index], newLanes[newIndex]] = [newLanes[newIndex], newLanes[index]];
        setLanes(newLanes);
    };

    const handleAddMasterSkill = () => {
        const trimmed = newMasterSkillInput.trim();
        if (trimmed && !masterSkills.includes(trimmed)) {
            setMasterSkills([...masterSkills, trimmed]);
            setNewMasterSkillInput('');
            // 設備カラー設定にも自動追加（まだ存在しない場合）
            if (!equipmentColors[trimmed]) {
                setEquipmentColors(prev => ({ ...prev, [trimmed]: '#94a3b8' }));
            }
        }
    };

    const handleRemoveMasterSkill = (skillToRemove: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        setMasterSkills(masterSkills.filter(s => s !== skillToRemove));
        // Cleanup checked skills
        const newSkills = { ...skills };
        Object.keys(newSkills).forEach(lane => {
            newSkills[lane] = newSkills[lane].filter(s => s !== skillToRemove);
        });
        setSkills(newSkills);
        // 設備カラー設定からも削除（固定エントリ「その他」「試作」は除く）
        if (skillToRemove !== 'その他' && skillToRemove !== '試作') {
            setEquipmentColors(prev => {
                const updated = { ...prev };
                delete updated[skillToRemove];
                return updated;
            });
        }
    };

    const handleMoveSkill = (index: number, direction: 'up' | 'down') => {
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= masterSkills.length) return;

        const newMasterSkills = [...masterSkills];
        [newMasterSkills[index], newMasterSkills[newIndex]] = [newMasterSkills[newIndex], newMasterSkills[index]];
        setMasterSkills(newMasterSkills);
    };

    const handleAddFixedJob = () => {
        const newJob: FixedJob = {
            id: `fixed-${Date.now()}`,
            name: '新規自動挿入ジョブ',
            duration: 30,
            laneIndex: 0
        };
        setFixedJobs([...fixedJobs, newJob]);
    };

    const handleUpdateFixedJob = (id: string, updates: Partial<FixedJob>) => {
        setFixedJobs(fixedJobs.map(job => job.id === id ? { ...job, ...updates } : job));
    };

    const handleRemoveFixedJob = (id: string) => {
        setFixedJobs(fixedJobs.filter(job => job.id !== id));
    };

    const handleDuplicateFixedJob = (id: string) => {
        const idx = fixedJobs.findIndex(job => job.id === id);
        if (idx === -1) return;
        const original = fixedJobs[idx];
        const copy: FixedJob = {
            ...original,
            id: `fixed-${Date.now()}`,
            name: `${original.name} (コピー)`
        };
        const newList = [...fixedJobs];
        newList.splice(idx + 1, 0, copy);
        setFixedJobs(newList);
    };

    const handleSplitFixedJob = (id: string) => {
        const idx = fixedJobs.findIndex(job => job.id === id);
        if (idx === -1) return;
        const original = fixedJobs[idx];
        const dur1 = Math.floor(original.duration / 2);
        const dur2 = original.duration - dur1;
        const job1: FixedJob = { ...original, id: `fixed-${Date.now()}`, duration: dur1 };
        const job2: FixedJob = { ...original, id: `fixed-${Date.now() + 1}`, duration: dur2 };
        const newList = [...fixedJobs];
        newList.splice(idx, 1, job1, job2);
        setFixedJobs(newList);
    };

    const handleMoveFixedJob = (id: string, direction: 'up' | 'down') => {
        const idx = fixedJobs.findIndex(job => job.id === id);
        if (idx === -1) return;
        const newIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (newIdx < 0 || newIdx >= fixedJobs.length) return;
        const newList = [...fixedJobs];
        [newList[idx], newList[newIdx]] = [newList[newIdx], newList[idx]];
        setFixedJobs(newList);
    };

    const addBreakTime = () => {
        const newBreakId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newBreak: BreakTime = {
            id: newBreakId,
            start: '12:00',
            end: '12:50'
        };

        const updatedBreakTimes: Record<string, BreakTime[]> = {};
        lanes.forEach(lane => {
            const current = localBreakTimes[lane] || [];
            updatedBreakTimes[lane] = [...current, { ...newBreak }];
        });
        setLocalBreakTimes(updatedBreakTimes);
    };

    const updateBreakTime = (index: number, field: 'start' | 'end', value: string) => {
        const updatedBreakTimes: Record<string, BreakTime[]> = {};
        lanes.forEach(lane => {
            const current = [...(localBreakTimes[lane] || [])];
            if (current[index]) {
                current[index] = { ...current[index], [field]: value };
            }
            updatedBreakTimes[lane] = current;
        });
        setLocalBreakTimes(updatedBreakTimes);
    };

    const removeBreakTime = (index: number) => {
        const updatedBreakTimes: Record<string, BreakTime[]> = {};
        lanes.forEach(lane => {
            const current = [...(localBreakTimes[lane] || [])];
            current.splice(index, 1);
            updatedBreakTimes[lane] = current;
        });
        setLocalBreakTimes(updatedBreakTimes);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave(lanes, skills, startTimes, colors, masterSkills, currentLanes, fixedJobs, localBreakTimes, jobBarCustomFields, processColors, equipmentColors, jobBarTextColor, equipmentWorkerPriority, setupTimeColor);
            if (onSaveNonProductionCategories) {
                await onSaveNonProductionCategories(
                    nonProdCategories.filter(c => c.name.trim().length > 0)
                );
            }
            onClose();
        } catch (error) {
            console.error(error);
            alert('保存に失敗しました');
        } finally {
            setIsSaving(false);
        }
    };

    const [expandedCatIndex, setExpandedCatIndex] = useState<number | null>(null);

    const handleAddNonProdCategory = () => {
        const palette = ['#3b82f6', '#ef4444', '#f97316', '#10b981', '#8b5cf6', '#64748b', '#ec4899', '#eab308'];
        const color = palette[nonProdCategories.length % palette.length];
        setNonProdCategories(prev => [...prev, { name: `項目${prev.length + 1}`, color, children: [] }]);
    };
    const handleUpdateNonProdCategory = (index: number, key: 'name' | 'color', value: string) => {
        setNonProdCategories(prev => prev.map((c, i) => i === index ? { ...c, [key]: value } : c));
    };
    const handleRemoveNonProdCategory = (index: number) => {
        setNonProdCategories(prev => prev.filter((_, i) => i !== index));
        if (expandedCatIndex === index) setExpandedCatIndex(null);
    };
    const handleMoveNonProdCategory = (index: number, direction: 'up' | 'down') => {
        const target = direction === 'up' ? index - 1 : index + 1;
        setNonProdCategories(prev => {
            if (target < 0 || target >= prev.length) return prev;
            const next = [...prev];
            [next[index], next[target]] = [next[target], next[index]];
            return next;
        });
        if (expandedCatIndex === index) setExpandedCatIndex(target);
        else if (expandedCatIndex === target) setExpandedCatIndex(index);
    };

    const handleTreeUpdateName = (catIdx: number, path: number[], name: string) => {
        setNonProdCategories(prev => prev.map((c, i) =>
            i !== catIdx ? c : { ...c, children: treeUpdateName(c.children || [], path, name) }
        ));
    };
    const handleTreeAddChild = (catIdx: number, path: number[]) => {
        setNonProdCategories(prev => prev.map((c, i) => {
            if (i !== catIdx) return c;
            const newName = `項目${Date.now() % 1000}`;
            return { ...c, children: treeAddChild(c.children || [], path, newName) };
        }));
    };
    const handleTreeRemove = (catIdx: number, path: number[]) => {
        setNonProdCategories(prev => prev.map((c, i) =>
            i !== catIdx ? c : { ...c, children: treeRemove(c.children || [], path) }
        ));
    };

    const renderTreeNodes = (
        nodes: NonProductionSubItem[],
        catIdx: number,
        path: number[],
        depth: number,
        color: string
    ): React.ReactNode => nodes.map((node, ni) => {
        const nodePath = [...path, ni];
        const hasChildren = (node.children?.length ?? 0) > 0;
        return (
            <div key={ni}>
                <div className="flex items-center gap-1.5 py-0.5" style={{ paddingLeft: depth * 14 }}>
                    <div
                        className="w-1.5 h-1.5 rounded-full flex-none"
                        style={{ background: hasChildren ? color : '#d1d5db' }}
                    />
                    <input
                        type="text"
                        value={node.name}
                        onChange={(e) => handleTreeUpdateName(catIdx, nodePath, e.target.value)}
                        placeholder="項目名"
                        className="flex-1 px-2 py-0.5 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-indigo-500 outline-none min-w-0"
                    />
                    {depth < 4 && (
                        <button
                            type="button"
                            onClick={() => handleTreeAddChild(catIdx, nodePath)}
                            className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded flex-none"
                            title="子項目を追加"
                        >
                            <Plus size={12} />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => handleTreeRemove(catIdx, nodePath)}
                        className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded flex-none"
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
                {hasChildren && renderTreeNodes(node.children!, catIdx, nodePath, depth + 1, color)}
            </div>
        );
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between p-4 border-b">
                    <h3 className="text-lg font-semibold text-gray-900">{machineLabel}・スキル設定</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4 flex-1 overflow-y-auto space-y-6">
                    {/* Master Skill Management */}
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <h4 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                            <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                            設備・スキルマスター管理
                        </h4>
                        <p className="text-xs text-slate-500 mb-3">
                            ここで登録した項目が、下の担当者ごとのチェックリストに表示されます。
                        </p>
                        <div className="flex gap-2 mb-3">
                            <input
                                type="text"
                                value={newMasterSkillInput}
                                onChange={(e) => setNewMasterSkillInput(e.target.value)}
                                placeholder="例: F, S3, TIG"
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                                onKeyDown={(e) => e.key === 'Enter' && handleAddMasterSkill()}
                            />
                            <button
                                onClick={handleAddMasterSkill}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 flex items-center gap-1"
                            >
                                <Plus size={16} /> 追加
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {masterSkills.map((skill, index) => (
                                <span key={skill} className={`inline-flex items-center gap-1 px-2 py-1 bg-white border ${skill === '試作' ? 'border-amber-400 bg-amber-50' : 'border-slate-300'} rounded text-sm text-slate-700`}>
                                    <span className="text-xs font-bold text-indigo-600 mr-1">{index + 1}</span>
                                    {skill}
                                    <div className="flex gap-0.5 ml-1">
                                        <button
                                            onClick={() => handleMoveSkill(index, 'up')}
                                            disabled={index === 0}
                                            className="p-0.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                            title="優先順位を上げる"
                                        >
                                            <ArrowUp size={12} />
                                        </button>
                                        <button
                                            onClick={() => handleMoveSkill(index, 'down')}
                                            disabled={index === masterSkills.length - 1}
                                            className="p-0.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                            title="優先順位を下げる"
                                        >
                                            <ArrowDown size={12} />
                                        </button>
                                    </div>
                                    {skill !== '試作' && (
                                        <button onClick={(e) => handleRemoveMasterSkill(skill, e)} className="text-slate-400 hover:text-red-500 ml-1">
                                            <X size={14} />
                                        </button>
                                    )}
                                </span>
                            ))}
                            {masterSkills.length === 0 && <span className="text-xs text-slate-400">マスタースキルが登録されていません</span>}
                        </div>
                    </div>

                    {/* Process Colors Section (Sheet Metal Only) */}
                    {showProcessColors && (
                        <div className="bg-cyan-50 p-4 rounded-lg border border-cyan-200">
                            <h4 className="text-sm font-bold text-cyan-900 mb-2 flex items-center gap-2">
                                <span className="w-2 h-2 bg-cyan-500 rounded-full"></span>
                                工程別カラー設定
                            </h4>
                            <p className="text-xs text-cyan-700 mb-3">
                                各工程（S1・S2・S7）のジョブバーの色を設定します。
                            </p>
                            <div className="flex flex-wrap gap-4">
                                {Object.keys(currentProcessColors).map(process => (
                                    <div key={process} className="flex items-center gap-2 bg-white px-3 py-2 rounded border border-cyan-100 shadow-sm">
                                        <span className="text-sm font-bold text-gray-700 w-8">{process}</span>
                                        <input
                                            type="color"
                                            value={processColors[process] || '#94a3b8'}
                                            onChange={(e) => setProcessColors(prev => ({ ...prev, [process]: e.target.value }))}
                                            className="w-10 h-8 rounded cursor-pointer border-0 bg-transparent"
                                            title={`${process}工程の表示色`}
                                        />
                                        <span className="text-xs text-gray-500">{processColors[process] || '#94a3b8'}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Equipment Colors Section (Welding Only) */}
                    {showEquipmentColors && (
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                            <h4 className="text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
                                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                担当可能設備カラー設定
                            </h4>
                            <p className="text-xs text-blue-700 mb-3">
                                各設備のジョブバーの色を設定します。「その他」はどの設備にも属さないジョブに使用されます。
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                                {/* Fixed 'その他' (Other) entry - cannot be deleted */}
                                <div className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded border border-gray-300 shadow-sm justify-between">
                                    <span className="text-sm font-bold text-gray-700">その他</span>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            value={equipmentColors['その他'] || '#6366f1'}
                                            onChange={(e) => setEquipmentColors(prev => ({ ...prev, 'その他': e.target.value }))}
                                            className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                                        />
                                        <span className="text-xs text-gray-400">固定</span>
                                    </div>
                                </div>
                                {/* Fixed '試作' (Prototype) entry - cannot be deleted */}
                                <div className="flex items-center gap-2 bg-amber-100 px-3 py-2 rounded border border-amber-300 shadow-sm justify-between">
                                    <span className="text-sm font-bold text-amber-700">試作</span>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            value={equipmentColors['試作'] || '#f59e0b'}
                                            onChange={(e) => setEquipmentColors(prev => ({ ...prev, '試作': e.target.value }))}
                                            className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                                        />
                                        <span className="text-xs text-amber-500">固定</span>
                                    </div>
                                </div>
                                {/* 設備・スキルマスター管理と同期 — masterSkills の順序で表示 */}
                                {masterSkills.filter(key => key !== 'その他' && key !== '試作').map(key => (
                                    <div key={key} className="flex items-center gap-2 bg-white px-3 py-2 rounded border border-blue-100 shadow-sm justify-between">
                                        <span className="text-sm font-bold text-gray-700 truncate" title={key}>{key}</span>
                                        <input
                                            type="color"
                                            value={equipmentColors[key] || '#94a3b8'}
                                            onChange={(e) => setEquipmentColors(prev => ({ ...prev, [key]: e.target.value }))}
                                            className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                                        />
                                    </div>
                                ))}
                            </div>
                            <p className="text-xs text-blue-600 mt-1">
                                設備の追加・削除は「設備・スキルマスター管理」から行ってください。
                            </p>

                            {/* Global Job Bar Text Color Setting */}
                            <div className="mt-4 pt-4 border-t border-blue-100 bg-blue-50/50 p-4 rounded-xl space-y-4">
                                <div className="flex flex-col gap-1">
                                    <span className="text-sm font-bold text-blue-900">ジョブバー文字色 (全設備共通)</span>
                                    <p className="text-[11px] text-blue-700">ガントチャートのジョブバー内に表示される文字の色を一括設定します。</p>
                                </div>

                                <div className="flex items-start gap-6">
                                    {/* カラーピッカー & プリセット */}
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-3 bg-white px-3 py-2 rounded-xl border border-blue-200 shadow-sm">
                                            <input
                                                type="color"
                                                value={jobBarTextColor || '#ffffff'}
                                                onChange={(e) => {
                                                    const newColor = e.target.value;
                                                    console.log('[LaneSettingsModal] Color changed to:', newColor);
                                                    setJobBarTextColor(newColor);
                                                }}
                                                className="w-12 h-12 rounded cursor-pointer border-2 border-slate-100 p-0.5"
                                                title="クリックして自由に色を選択"
                                            />
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-gray-400 font-bold uppercase">16進数コード</span>
                                                <input
                                                    type="text"
                                                    value={jobBarTextColor}
                                                    onChange={(e) => setJobBarTextColor(e.target.value)}
                                                    className="w-24 text-sm font-mono text-blue-600 font-bold border-b-2 border-blue-100 focus:border-blue-500 outline-none uppercase bg-transparent"
                                                    placeholder="#FFFFFF"
                                                />
                                            </div>
                                        </div>

                                        {/* プリセットボタン */}
                                        <div className="flex gap-2">
                                            {[
                                                { label: '白', value: '#ffffff', class: 'bg-white border-gray-200' },
                                                { label: '黒', value: '#000000', class: 'bg-black text-white' },
                                                { label: '青', value: '#1e3a8a', class: 'bg-blue-900 text-white' },
                                                { label: '赤', value: '#991b1b', class: 'bg-red-800 text-white' }
                                            ].map(preset => (
                                                <button
                                                    key={preset.value}
                                                    onClick={() => setJobBarTextColor(preset.value)}
                                                    className={`px-2 py-1 rounded text-[10px] font-bold border transition-all active:scale-95 shadow-sm ${preset.class}`}
                                                >
                                                    {preset.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* リアルタイム プレビュー */}
                                    <div className="flex-1">
                                        <div className="bg-white/60 p-3 rounded-xl border border-blue-100 shadow-inner">
                                            <p className="text-[10px] font-bold text-blue-400 mb-2 uppercase tracking-widest text-center">Preview (見え方の確認)</p>
                                            <div className="flex flex-col gap-2">
                                                {[
                                                    { bg: '#3b82f6', label: '溶接機A: 完成品123' },
                                                    { bg: '#10b981', label: 'ロボット: 試作A' }
                                                ].map(sample => (
                                                    <div
                                                        key={sample.bg}
                                                        className="h-8 rounded-md shadow-sm flex items-center px-3 text-[10px] font-bold transition-all duration-300"
                                                        style={{ backgroundColor: sample.bg, color: jobBarTextColor }}
                                                    >
                                                        {sample.label}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Setup Time Color Setting */}
                            <div className="mt-4 pt-4 border-t border-blue-100 bg-amber-50/50 p-4 rounded-xl space-y-4">
                                <div className="flex flex-col gap-1">
                                    <span className="text-sm font-bold text-amber-900">段取り時間カラー</span>
                                    <p className="text-[11px] text-amber-700">ジョブバーの左端に表示される段取り時間セグメントの色を設定します。</p>
                                </div>

                                <div className="flex items-start gap-6">
                                    {/* カラーピッカー & プリセット */}
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-3 bg-white px-3 py-2 rounded-xl border border-amber-200 shadow-sm">
                                            <input
                                                type="color"
                                                value={setupTimeColor || '#f59e0b'}
                                                onChange={(e) => setSetupTimeColor(e.target.value)}
                                                className="w-12 h-12 rounded cursor-pointer border-2 border-amber-100 p-0.5"
                                                title="クリックして色を選択"
                                            />
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-gray-400 font-bold uppercase">16進数コード</span>
                                                <input
                                                    type="text"
                                                    value={setupTimeColor}
                                                    onChange={(e) => setSetupTimeColor(e.target.value)}
                                                    className="w-24 text-sm font-mono text-amber-600 font-bold border-b-2 border-amber-100 focus:border-amber-500 outline-none uppercase bg-transparent"
                                                    placeholder="#F59E0B"
                                                />
                                            </div>
                                        </div>

                                        {/* プリセットボタン */}
                                        <div className="flex gap-2">
                                            {[
                                                { label: 'オレンジ', value: '#f59e0b', class: 'bg-amber-500 text-white' },
                                                { label: '赤', value: '#ef4444', class: 'bg-red-500 text-white' },
                                                { label: '青', value: '#3b82f6', class: 'bg-blue-500 text-white' },
                                                { label: '緑', value: '#10b981', class: 'bg-emerald-500 text-white' }
                                            ].map(preset => (
                                                <button
                                                    key={preset.value}
                                                    onClick={() => setSetupTimeColor(preset.value)}
                                                    className={`px-2 py-1 rounded text-[10px] font-bold border transition-all active:scale-95 shadow-sm ${preset.class}`}
                                                >
                                                    {preset.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* リアルタイム プレビュー */}
                                    <div className="flex-1">
                                        <div className="bg-white/60 p-3 rounded-xl border border-amber-100 shadow-inner">
                                            <p className="text-[10px] font-bold text-amber-400 mb-2 uppercase tracking-widest text-center">Preview (見え方の確認)</p>
                                            <div className="relative h-10 rounded-md overflow-hidden shadow-sm" style={{ backgroundColor: '#3b82f6' }}>
                                                <div
                                                    className="absolute left-0 top-0 bottom-0 w-[25%] opacity-90"
                                                    style={{ backgroundColor: setupTimeColor }}
                                                />
                                                <span className="absolute inset-0 flex items-center px-3 text-[10px] font-bold text-white">
                                                    段取り時間 → 生産時間
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Equipment Worker Priority Section */}
                            <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200 mt-4">
                                <h4 className="text-sm font-bold text-indigo-900 mb-2 flex items-center gap-2">
                                    <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                                    設備別担当者優先順位（インポート時のみ適用）
                                </h4>
                                <p className="text-xs text-indigo-700 mb-3">
                                    CSVインポート時、同じ設備を複数人が担当できる場合、優先度の高い人から17:20まで割り振り、残りを次の人に回します。
                                </p>
                                <div className="space-y-3">
                                    {Object.keys(equipmentColors).filter(key => key !== 'その他' && key !== '試作').map(equipment => {
                                        // Use flexible matching: check if any skill contains equipment or vice versa
                                        const workersWithSkill = lanes.filter(lane =>
                                            (skills[lane] || []).some(skill =>
                                                skill === equipment ||
                                                skill.includes(equipment) ||
                                                equipment.includes(skill)
                                            )
                                        );

                                        if (workersWithSkill.length < 2) return null;

                                        const currentOrder = equipmentWorkerPriority[equipment] || workersWithSkill;
                                        const orderedWorkers = [
                                            ...currentOrder.filter(w => workersWithSkill.includes(w)),
                                            ...workersWithSkill.filter(w => !currentOrder.includes(w))
                                        ];

                                        return (
                                            <div key={equipment} className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div
                                                        className="w-4 h-4 rounded"
                                                        style={{ backgroundColor: equipmentColors[equipment] }}
                                                    />
                                                    <span className="text-sm font-bold text-gray-700">{equipment}</span>
                                                    <span className="text-[10px] text-gray-400">({workersWithSkill.length}名)</span>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {orderedWorkers.map((worker, idx) => (
                                                        <div key={worker} className="flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-100">
                                                            <span className="text-[10px] font-bold text-indigo-500 w-4">{idx + 1}</span>
                                                            <span className="text-xs font-medium text-gray-700">{worker}</span>
                                                            <div className="flex gap-0.5 ml-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        if (idx === 0) return;
                                                                        const newOrder = [...orderedWorkers];
                                                                        [newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]];
                                                                        setEquipmentWorkerPriority(prev => ({
                                                                            ...prev,
                                                                            [equipment]: newOrder
                                                                        }));
                                                                    }}
                                                                    disabled={idx === 0}
                                                                    className="p-0.5 text-indigo-400 hover:text-indigo-600 hover:bg-white rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                                                    title="優先順位を上げる"
                                                                >
                                                                    <ArrowUp size={12} />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        if (idx === orderedWorkers.length - 1) return;
                                                                        const newOrder = [...orderedWorkers];
                                                                        [newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]];
                                                                        setEquipmentWorkerPriority(prev => ({
                                                                            ...prev,
                                                                            [equipment]: newOrder
                                                                        }));
                                                                    }}
                                                                    disabled={idx === orderedWorkers.length - 1}
                                                                    className="p-0.5 text-indigo-400 hover:text-indigo-600 hover:bg-white rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                                                    title="優先順位を下げる"
                                                                >
                                                                    <ArrowDown size={12} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {Object.keys(equipmentColors).filter(key => key !== 'その他' && key !== '試作').every(equipment => {
                                        const workersWithSkill = lanes.filter(lane => (skills[lane] || []).includes(equipment));
                                        return workersWithSkill.length < 2;
                                    }) && (
                                            <p className="text-xs text-indigo-400 italic">
                                                ※ 複数人が担当できる設備がないため、優先順位の設定は不要です。
                                            </p>
                                        )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Fixed Jobs Section (Sheet Metal Only) */}
                    {showFixedJobs && (
                        <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                            <h4 className="text-sm font-bold text-amber-900 mb-2 flex items-center gap-2">
                                <Clock size={16} className="text-amber-600" />
                                自動挿入ジョブ設定 (インポート時に自動追加)
                            </h4>
                            <p className="text-xs text-amber-700 mb-3">
                                CSVインポート時に各担当者の先頭に自動で挿入されるジョブを設定します。
                            </p>

                            <div className="space-y-2">
                                {fixedJobs.map((job, idx) => (
                                    <div key={job.id} className="flex gap-2 items-center bg-white p-2.5 rounded-lg border border-amber-100 shadow-sm hover:border-amber-300 transition-colors">
                                        {/* 上下移動 */}
                                        <div className="flex flex-col gap-0.5">
                                            <button
                                                onClick={() => handleMoveFixedJob(job.id, 'up')}
                                                disabled={idx === 0}
                                                className="p-0.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                                title="上へ移動"
                                            >
                                                <ArrowUp size={13} />
                                            </button>
                                            <button
                                                onClick={() => handleMoveFixedJob(job.id, 'down')}
                                                disabled={idx === fixedJobs.length - 1}
                                                className="p-0.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                                title="下へ移動"
                                            >
                                                <ArrowDown size={13} />
                                            </button>
                                        </div>
                                        {/* 名称 */}
                                        <div className="flex-1 min-w-0">
                                            <input
                                                type="text"
                                                value={job.name}
                                                onChange={(e) => handleUpdateFixedJob(job.id, { name: e.target.value })}
                                                placeholder="ジョブ名"
                                                className="w-full text-sm border-0 border-b border-gray-200 focus:border-amber-500 focus:ring-0 px-0 bg-transparent"
                                            />
                                        </div>
                                        {/* 分数 */}
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            <input
                                                type="number"
                                                value={job.duration}
                                                onChange={(e) => handleUpdateFixedJob(job.id, { duration: parseInt(e.target.value) || 0 })}
                                                className="w-16 text-sm border border-gray-200 rounded px-2 py-1 text-right"
                                                min={1}
                                            />
                                            <span className="text-xs text-gray-500 flex-shrink-0">分</span>
                                        </div>
                                        {/* アクションボタン群 */}
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            <button
                                                onClick={() => handleDuplicateFixedJob(job.id)}
                                                className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                title="複製 (コピー)"
                                            >
                                                <Copy size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleSplitFixedJob(job.id)}
                                                disabled={job.duration < 2}
                                                className="p-1.5 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                title="分割 (時間を2等分)"
                                            >
                                                <Scissors size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleRemoveFixedJob(job.id)}
                                                className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                title="削除"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                <button
                                    onClick={handleAddFixedJob}
                                    className="w-full py-2 border border-dashed border-amber-300 rounded text-amber-700 hover:bg-amber-100 transition-colors text-xs font-medium flex items-center justify-center gap-1"
                                >
                                    <Plus size={14} /> 自動挿入ジョブを追加
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Break Times Section (Sheet Metal Only) */}
                    {showFixedJobs && (
                        <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                            <h4 className="text-sm font-bold text-orange-900 mb-2 flex items-center gap-2">
                                <Clock size={16} className="text-orange-600" />
                                休憩時間一括設定 (全員共通)
                            </h4>
                            <p className="text-xs text-orange-700 mb-3">
                                全員のガントチャート上に適用される非稼働時間を設定します。
                            </p>

                            <div className="space-y-3 bg-gray-50 p-4 rounded-lg border border-gray-200">
                                {/* 代表として lanes[0] の休憩時間を表示（一括同期されている前提） */}
                                {(lanes.length > 0 ? (localBreakTimes[lanes[0]] || []) : []).map((bt, index) => (
                                    <div key={index} className="flex items-center gap-3">
                                        <input
                                            type="time"
                                            value={bt.start}
                                            onChange={(e) => updateBreakTime(index, 'start', e.target.value)}
                                            className="px-3 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                        />
                                        <span className="text-gray-400">〜</span>
                                        <input
                                            type="time"
                                            value={bt.end}
                                            onChange={(e) => updateBreakTime(index, 'end', e.target.value)}
                                            className="px-3 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                        />
                                        <button
                                            onClick={() => removeBreakTime(index)}
                                            className="p-1 px-2 text-red-500 hover:bg-red-50 rounded transition-colors"
                                        >
                                            削除
                                        </button>
                                    </div>
                                ))}
                                <button
                                    onClick={addBreakTime}
                                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-md border border-indigo-200 transition-colors w-full justify-center bg-white shadow-sm"
                                >
                                    <Plus size={16} />
                                    休憩時間を追加
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Lane & Skill Checkboxes */}
                    <div>
                        <h4 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                            <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                            担当者・担当設備設定
                        </h4>
                        <p className="text-xs text-slate-500 mb-3">
                            各担当者が対応可能な設備にチェックを入れてください。
                        </p>
                        <div className="space-y-3">
                            {/* Header */}
                            <div className={`grid gap-4 text-xs font-bold text-gray-500 px-2 pb-1 border-b ${showFixedJobs ? 'grid-cols-11' : 'grid-cols-12'}`}>
                                <div className="col-span-1 text-center">優先順位</div>
                                <div className="col-span-2">担当者名</div>
                                <div className="col-span-2 text-center">開始時間</div>
                                {!showFixedJobs && <div className="col-span-1 text-center">表示色</div>}
                                <div className={showFixedJobs ? 'col-span-5' : 'col-span-5'}>担当可能設備 (チェック)</div>
                                <div className="col-span-1"></div>
                            </div>

                            {lanes.map((lane, index) => (
                                <div key={index} className={`grid gap-4 items-start py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors rounded px-2 ${showFixedJobs ? 'grid-cols-11' : 'grid-cols-12'}`}>
                                    <div className="col-span-1 pt-1 flex flex-col items-center gap-0.5">
                                        <span className="text-sm font-bold text-indigo-600">{index + 1}</span>
                                        <div className="flex gap-0.5">
                                            <button
                                                onClick={() => handleMoveLane(index, 'up')}
                                                disabled={index === 0}
                                                className="p-0.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                                title="優先順位を上げる"
                                            >
                                                <ArrowUp size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleMoveLane(index, 'down')}
                                                disabled={index === lanes.length - 1}
                                                className="p-0.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                                title="優先順位を下げる"
                                            >
                                                <ArrowDown size={14} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="col-span-2 pt-1">
                                        <input
                                            type="text"
                                            value={lane}
                                            onChange={(e) => handleLaneChange(index, e.target.value)}
                                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm font-medium"
                                        />
                                    </div>
                                    <div className="col-span-2 pt-1 flex justify-center">
                                        <input
                                            type="time"
                                            value={startTimes[lane] || '08:30'}
                                            onChange={(e) => handleStartTimeChange(lane, e.target.value)}
                                            className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>
                                    {!showFixedJobs && (
                                        <div className="col-span-1 pt-1 flex justify-center">
                                            <input
                                                type="color"
                                                value={colors[lane] || '#4f46e5'}
                                                onChange={(e) => handleColorChange(lane, e.target.value)}
                                                className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                                                title="ガントチャートでの表示色"
                                            />
                                        </div>
                                    )}
                                    <div className="col-span-5 flex flex-wrap gap-2 pt-1.5">
                                        {masterSkills.map(skill => (
                                            <label key={skill} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-transparent hover:bg-white hover:border-indigo-100 cursor-pointer select-none transition-all">
                                                <input
                                                    type="checkbox"
                                                    checked={(skills[lane] || []).includes(skill)}
                                                    onChange={() => handleToggleSkill(lane, skill)}
                                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                                                />
                                                <span className={`text-sm ${(skills[lane] || []).includes(skill) ? 'text-indigo-700 font-medium' : 'text-gray-600'}`}>
                                                    {skill}
                                                </span>
                                            </label>
                                        ))}
                                        {masterSkills.length === 0 && <span className="text-xs text-gray-400">上のマスタースキルを追加してください</span>}
                                    </div>
                                    <div className="col-span-1 flex justify-end pt-1">
                                        <button
                                            onClick={() => handleRemoveLane(index)}
                                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                                            title="削除"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={handleAddLane}
                            className="w-full py-2 border-2 border-dashed border-gray-300 rounded-md text-gray-500 hover:border-indigo-500 hover:text-indigo-600 transition-colors flex items-center justify-center gap-1 text-sm font-medium mt-4"
                        >
                            <Plus size={16} />
                            ライン（担当者）を追加
                        </button>

                        {/* 工程外項目 */}
                        {onSaveNonProductionCategories && (
                            <div className="mt-6 pt-6 border-t border-gray-200">
                                <h3 className="text-sm font-bold text-gray-800 mb-2">工程外項目</h3>
                                <p className="text-xs text-gray-500 mb-3">
                                    生産計画外の対応・遅れを記録する際に選べる項目です。色は予定追加バーの背景色になります。
                                </p>
                                <div className="space-y-2">
                                    {nonProdCategories.map((cat, index) => (
                                        <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                                            {/* カテゴリ行 */}
                                            <div className="flex items-center gap-2 p-2 bg-gray-50">
                                                <div className="flex flex-col gap-0.5 flex-none">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleMoveNonProdCategory(index, 'up')}
                                                        disabled={index === 0}
                                                        className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-20 disabled:cursor-not-allowed"
                                                        title="上へ"
                                                    >
                                                        <ArrowUp size={13} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleMoveNonProdCategory(index, 'down')}
                                                        disabled={index === nonProdCategories.length - 1}
                                                        className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-20 disabled:cursor-not-allowed"
                                                        title="下へ"
                                                    >
                                                        <ArrowDown size={13} />
                                                    </button>
                                                </div>
                                                <input
                                                    type="color"
                                                    value={cat.color}
                                                    onChange={(e) => handleUpdateNonProdCategory(index, 'color', e.target.value)}
                                                    className="w-10 h-8 rounded border border-gray-200 cursor-pointer flex-none"
                                                />
                                                <input
                                                    type="text"
                                                    value={cat.name}
                                                    onChange={(e) => handleUpdateNonProdCategory(index, 'name', e.target.value)}
                                                    placeholder="大分類名"
                                                    className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-indigo-500 outline-none"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setExpandedCatIndex(expandedCatIndex === index ? null : index)}
                                                    className="px-2 py-1 text-xs font-medium rounded border border-gray-300 bg-white hover:bg-indigo-50 hover:border-indigo-400 text-gray-600 hover:text-indigo-600 transition-colors flex-none"
                                                    title="小項目を編集"
                                                >
                                                    小項目 {cat.children?.length ? `(${cat.children.length})` : ''}
                                                </button>
                                                <button
                                                    onClick={() => handleRemoveNonProdCategory(index)}
                                                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded flex-none"
                                                    title="削除"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                            {/* ツリーエディタ（展開時） */}
                                            {expandedCatIndex === index && (
                                                <div className="p-3 border-t border-gray-200 bg-white space-y-1">
                                                    {renderTreeNodes(cat.children || [], index, [], 0, cat.color)}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleTreeAddChild(index, [])}
                                                        className="w-full py-1 border border-dashed border-gray-300 rounded text-gray-500 hover:border-indigo-400 hover:text-indigo-600 text-xs flex items-center justify-center gap-1 transition-colors mt-1"
                                                    >
                                                        <Plus size={12} /> 項目を追加
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <button
                                    onClick={handleAddNonProdCategory}
                                    className="w-full mt-3 py-2 border-2 border-dashed border-gray-300 rounded-md text-gray-500 hover:border-indigo-500 hover:text-indigo-600 transition-colors flex items-center justify-center gap-1 text-sm font-medium"
                                >
                                    <Plus size={16} />
                                    工程外項目を追加
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t bg-gray-50 rounded-b-lg flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
                    >
                        キャンセル
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        {isSaving && <RefreshCw className="animate-spin w-4 h-4" />}
                        保存
                    </button>
                </div>
            </div>
        </div >
    );
}
