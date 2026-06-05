import { useState, useRef, useEffect } from 'react';
import type { JigLocation, JigMapData } from '../types/jigMap';
import { MapPin, Save, Trash2, Type, CheckSquare, Plus, Undo2, Redo2 } from 'lucide-react';

interface JigMapProps {
    data: JigMapData;
    activeAddress?: string | null;
    highlightedAddresses: string[];
    onSave: (newData: JigMapData) => void;
    editable?: boolean;
}

interface DragState {
    type: 'MOVE' | 'RESIZE';
    index: number;
    startX: number;
    startY: number;
    initialLoc: JigLocation;
    handle?: 'nw' | 'ne' | 'sw' | 'se';
}

export function JigMap({ data, activeAddress, highlightedAddresses, onSave, editable = false }: JigMapProps) {
    // State
    const [localData, setLocalData] = useState<JigMapData>(data);
    const [history, setHistory] = useState<JigMapData[]>([data]);
    const [historyIndex, setHistoryIndex] = useState(0);

    const [selectedPinIndex, setSelectedPinIndex] = useState<number | null>(null);
    const [newAddressInput, setNewAddressInput] = useState('');
    const [dragState, setDragState] = useState<DragState | null>(null);
    const [dragStartData, setDragStartData] = useState<JigMapData | null>(null);

    const imageRef = useRef<HTMLImageElement>(null);

    // Redefining simpler history function to avoid stale closures
    const pushHistory = (newData: JigMapData) => {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(newData);
        if (newHistory.length > 11) newHistory.shift(); // Keep 10 steps max (+current)

        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
        setLocalData(newData);
    };

    const undo = () => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            setLocalData(history[newIndex]);
            setSelectedPinIndex(null); // Deselect on undo to avoid index mismatch
        }
    };

    const redo = () => {
        if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            setLocalData(history[newIndex]);
            setSelectedPinIndex(null);
        }
    };


    // Sync props to local state
    // We trust parent data updates. If editing locally, localData is ahead until save.
    // If parent updates data (e.g. from save), we sync.
    useEffect(() => {
        // Migration/Normalization: Ensure all locations have width/height
        const normalizedLocations = data.locations.map(loc => {
            if (loc.width !== undefined && loc.height !== undefined) return loc;
            return {
                ...loc,
                x: loc.x - 3,
                y: loc.y - 5,
                width: 6,
                height: 10
            };
        });
        const newData = { ...data, locations: normalizedLocations };
        setLocalData(newData);
        setHistory([newData]);
        setHistoryIndex(0);
    }, [data]);

    // Global Mouse Handling for Drag/Resize
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!dragState || !imageRef.current) return;
            e.preventDefault();

            const rect = imageRef.current.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return;

            // Calculate delta in percentages
            const deltaX = ((e.clientX - dragState.startX) / rect.width) * 100;
            const deltaY = ((e.clientY - dragState.startY) / rect.height) * 100;

            const newLocations = [...localData.locations];
            const loc = { ...dragState.initialLoc };

            if (dragState.type === 'MOVE') {
                loc.x = Math.max(0, Math.min(100 - loc.width, loc.x + deltaX));
                loc.y = Math.max(0, Math.min(100 - loc.height, loc.y + deltaY));
            } else if (dragState.type === 'RESIZE' && dragState.handle) {
                // Resize logic based on handle
                // Min size constraint
                const minSize = 2;

                if (dragState.handle.includes('e')) {
                    loc.width = Math.max(minSize, loc.width + deltaX);
                }
                if (dragState.handle.includes('s')) {
                    loc.height = Math.max(minSize, loc.height + deltaY);
                }
                if (dragState.handle.includes('w')) {
                    const newW = Math.max(minSize, loc.width - deltaX);
                    // Only update x if width actually changed (and didn't hit min)
                    if (newW !== loc.width) {
                        loc.x = loc.x + deltaX;
                        loc.width = newW;
                    }
                }
                if (dragState.handle.includes('n')) {
                    const newH = Math.max(minSize, loc.height - deltaY);
                    if (newH !== loc.height) {
                        loc.y = loc.y + deltaY;
                        loc.height = newH;
                    }
                }
            }

            newLocations[dragState.index] = loc;
            setLocalData(prev => ({ ...prev, locations: newLocations }));
        };

        const handleMouseUp = () => {
            if (dragState && dragStartData) {
                // Compare localData with dragStartData
                const hasChanged = JSON.stringify(localData) !== JSON.stringify(dragStartData);
                if (hasChanged) {
                    pushHistory(localData);
                }
            }
            setDragState(null);
            setDragStartData(null);
        };

        if (dragState) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragState, localData, dragStartData, history, historyIndex]);

    // Keyboard Handling for Fine Movement
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!editable || selectedPinIndex === null) return;

            // Only capture arrow keys
            if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;

            e.preventDefault();
            const MOVE_STEP = 0.2; // 0.2% increment for fine control

            // We can't easily dedup key presses for history without more complex logic (e.g. debouncing).
            // For now, let's just modify localData and NOT push history on every keyframe,
            // but maybe push on 'KeyUp'? 
            // To simplify: we'll update localData, but we won't push to history here to avoid spamming.
            // Users can use drag for undoable moves. 
            // OR: we can push to history.
            // Let's push to history for correctness, even if it fills up.

            const newLocs = [...localData.locations];
            const loc = { ...newLocs[selectedPinIndex] };

            if (e.key === 'ArrowLeft') loc.x -= MOVE_STEP;
            if (e.key === 'ArrowRight') loc.x += MOVE_STEP;
            if (e.key === 'ArrowUp') loc.y -= MOVE_STEP;
            if (e.key === 'ArrowDown') loc.y += MOVE_STEP;

            newLocs[selectedPinIndex] = loc;
            const newData = { ...localData, locations: newLocs };

            pushHistory(newData);
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [editable, selectedPinIndex, localData, history, historyIndex]);

    const handleAddBox = () => {
        // Create new Box centered in the map
        const w = 8;
        const h = 5;
        // Default center
        const x = 50 - (w / 2);
        const y = 50 - (h / 2);

        const newBox: JigLocation = {
            address: `新規`,
            x,
            y,
            width: w,
            height: h,
            type: 'rack', // Default
            backgroundColor: '#1e3a8a' // Default Navy
        };

        const newLocations = [...localData.locations, newBox];
        const newData = { ...localData, locations: newLocations };

        pushHistory(newData);
        setSelectedPinIndex(newLocations.length - 1);
        setNewAddressInput(newBox.address);
    };

    const startDrag = (e: React.MouseEvent, index: number, type: 'MOVE' | 'RESIZE', handle?: 'nw' | 'ne' | 'sw' | 'se') => {
        if (!editable) return;
        e.stopPropagation();
        e.preventDefault(); // Prevent text selection/image drag

        setSelectedPinIndex(index);
        setNewAddressInput(localData.locations[index].address);
        setDragStartData(localData); // Snapshot for history

        setDragState({
            type,
            index,
            startX: e.clientX,
            startY: e.clientY,
            initialLoc: { ...localData.locations[index] },
            handle
        });
    };

    const handleSave = () => {
        onSave(localData);
        setSelectedPinIndex(null);
    };

    const handleUpdateAddress = (index: number, newAddr: string) => {
        const newLocations = [...localData.locations];
        newLocations[index].address = newAddr;
        const newData = { ...localData, locations: newLocations };
        // Input `onChange` fires rapidly. We update localData for UI responsiveness.
        // We do NOT push history here. We rely on onBlur or Enter (future).
        // For compliance with "Undo", we should trap blur.
        setLocalData(newData);
    };

    const handleAddressBlur = () => {
        // When input loses focus, commit to history if changed from last history tip
        const lastHistory = history[historyIndex];
        if (JSON.stringify(localData) !== JSON.stringify(lastHistory)) {
            pushHistory(localData);
        }
    };

    const handleDeletePin = (index: number) => {
        const newLocations = localData.locations.filter((_, i) => i !== index);
        const newData = { ...localData, locations: newLocations };
        pushHistory(newData);
        setSelectedPinIndex(null);
    };

    // Calculate Box Style
    const getBoxStyle = (loc: JigLocation, index: number) => {
        const isSelected = editable && selectedPinIndex === index;
        const isAisle = loc.type === 'aisle' || loc.type === 'label';

        // Target Logic
        const isTarget = activeAddress === loc.address;
        const isHighlighted = highlightedAddresses.includes(loc.address);

        // Base Colors
        let borderColor = 'transparent';
        let bgColor = loc.backgroundColor || '#e5e7eb'; // Default gray for unknown
        // Determine if background is light (for text color)
        const isLightBg = bgColor === '#f5f0e0' || bgColor === '#e8e0cc' || bgColor === '#e5e7eb';
        let textColor = isLightBg ? '#1f2937' : '#ffffff';
        let fontSize = loc.fontSize ? `${loc.fontSize}px` : (isAisle ? '14px' : '13px');
        let fontWeight = 'bold';
        let zIndex = 10;
        let borderWidth = '0px';
        let opacity = 1;

        // Special handling for Aisles/Labels
        if (isAisle) {
            bgColor = 'transparent';
            textColor = '#1f2937'; // gray-800
            fontSize = loc.fontSize ? `${loc.fontSize}px` : '14px';
            zIndex = 5; // Below racks

            if (isSelected) {
                borderColor = '#ef4444'; // Red-500 selection border
                borderWidth = '1px';
                zIndex = 50;
            }
        } else {
            // Rack Styling
            if (isSelected) {
                borderColor = '#ef4444'; // Red-500 selection border
                borderWidth = '2px';
                zIndex = 50;
            } else if (isTarget) {
                borderColor = '#facc15'; // Yellow-400 (Active Hover)
                borderWidth = '4px';
                zIndex = 40;
                // Make it pop
                opacity = 1;
            } else if (isHighlighted) {
                // Highlighted Style for Imported Items
                borderColor = '#16a34a'; // Green-600
                borderWidth = '4px';
                // Keep original background color
                zIndex = 30;
                // Ensure opacity is high to stand out
                opacity = 1;
            }
        }


        return {
            left: `${loc.x}%`,
            top: `${loc.y}%`,
            width: `${loc.width}%`,
            height: `${loc.height}%`,
            borderColor,
            backgroundColor: bgColor,
            color: textColor,
            zIndex,
            borderWidth,
            fontSize,
            fontWeight,
            opacity
        };
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="flex items-center p-2 border-b border-slate-700 bg-slate-800 no-print text-white gap-2 h-[50px]">
                {/* Title - Hide when editing a pin to save space */}
                {(!editable || selectedPinIndex === null) && (
                    <h3 className="text-sm font-bold flex items-center gap-2 mr-auto whitespace-nowrap">
                        <MapPin size={16} className="text-slate-300" /> 治具マップ
                    </h3>
                )}

                {/* Editor Controls - Inline */}
                {editable && selectedPinIndex !== null && (
                    <div className="flex items-center gap-2 flex-1 overflow-x-auto no-scrollbar mask-gradient-right">
                        <div className="flex items-center gap-2 min-w-max">
                            <span className="text-xs font-bold text-slate-400">編集:</span>
                            <input
                                type="text"
                                value={newAddressInput}
                                onChange={(e) => {
                                    setNewAddressInput(e.target.value);
                                    handleUpdateAddress(selectedPinIndex, e.target.value);
                                }}
                                onBlur={handleAddressBlur}
                                className="w-20 text-xs bg-slate-600 border border-slate-500 text-white rounded px-2 py-1 focus:outline-none focus:border-indigo-400"
                                placeholder="名称"
                            />

                            {/* Type */}
                            <button
                                onClick={() => {
                                    const newState = [...localData.locations];
                                    const current = newState[selectedPinIndex];
                                    const nextType = current.type === 'label' ? 'aisle' : (current.type === 'aisle' ? 'rack' : 'label');
                                    current.type = nextType;
                                    // Defaults
                                    if (nextType === 'rack') {
                                        current.backgroundColor = '#1e3a8a';
                                        current.fontSize = undefined;
                                    } else if (nextType === 'aisle') {
                                        current.backgroundColor = undefined;
                                        current.fontSize = undefined;
                                    } else {
                                        current.backgroundColor = undefined;
                                        current.fontSize = 14;
                                    }
                                    const newData = { ...localData, locations: newState };
                                    pushHistory(newData);
                                }}
                                className="p-1 px-2 text-xs bg-slate-600 border border-slate-500 text-slate-200 rounded hover:bg-slate-500 flex items-center gap-1"
                                title="種類切替"
                            >
                                {localData.locations[selectedPinIndex].type === 'label' ? <Type size={18} /> :
                                    localData.locations[selectedPinIndex].type === 'aisle' ? <MapPin size={18} className="opacity-50" /> :
                                        <CheckSquare size={18} />}
                            </button>

                            {/* Size (Label/Aisle) */}
                            {(localData.locations[selectedPinIndex].type === 'label' || localData.locations[selectedPinIndex].type === 'aisle') && (
                                <div className="flex items-center gap-0.5">
                                    <button
                                        onClick={() => {
                                            const newLocs = [...localData.locations];
                                            const current = { ...newLocs[selectedPinIndex] };
                                            const size = current.fontSize || 14;
                                            current.fontSize = Math.max(8, size - 2);
                                            newLocs[selectedPinIndex] = current;
                                            const newData = { ...localData, locations: newLocs };
                                            pushHistory(newData);
                                        }}
                                        className="w-7 h-7 bg-slate-600 border border-slate-500 text-slate-200 rounded-l flex items-center justify-center text-lg hover:bg-slate-500"
                                    >-</button>
                                    <button
                                        onClick={() => {
                                            const newLocs = [...localData.locations];
                                            const current = { ...newLocs[selectedPinIndex] };
                                            const size = current.fontSize || 14;
                                            current.fontSize = Math.min(48, size + 2);
                                            newLocs[selectedPinIndex] = current;
                                            const newData = { ...localData, locations: newLocs };
                                            pushHistory(newData);
                                        }}
                                        className="w-7 h-7 bg-slate-600 border-y border-r border-slate-500 text-slate-200 rounded-r flex items-center justify-center text-lg hover:bg-slate-500"
                                    >+</button>
                                </div>
                            )}

                            {/* Color (Rack) */}
                            {localData.locations[selectedPinIndex].type === 'rack' && (
                                <div className="flex gap-2 mx-1">
                                    {['#ea580c', '#1e3a8a'].map(c => (
                                        <button
                                            key={c}
                                            onClick={() => {
                                                const newState = [...localData.locations];
                                                newState[selectedPinIndex].backgroundColor = c;
                                                const newData = { ...localData, locations: newState };
                                                pushHistory(newData);
                                            }}
                                            className={`w-5 h-5 rounded-full border border-slate-400 ${localData.locations[selectedPinIndex].backgroundColor === c ? 'ring-2 ring-offset-1 ring-offset-slate-700 ring-yellow-500' : ''}`}
                                            style={{ backgroundColor: c }}
                                        />
                                    ))}
                                </div>
                            )}

                            <div className="w-px h-6 bg-slate-600 mx-1" />

                            <button
                                onClick={() => handleDeletePin(selectedPinIndex)}
                                className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                                title="削除"
                            >
                                <Trash2 size={20} />
                            </button>
                        </div>
                    </div>
                )}

                {/* Right Actions */}
                {editable && (
                    <div className="flex gap-2 ml-auto items-center">
                        <div className="flex items-center gap-1 mr-2 border-r border-slate-600 pr-2">
                            <button
                                onClick={undo}
                                disabled={historyIndex <= 0}
                                className={`p-1.5 rounded-lg transition-colors ${historyIndex <= 0 ? 'text-slate-500 cursor-not-allowed' : 'text-slate-300 hover:bg-slate-700'}`}
                                title="元に戻す"
                            >
                                <Undo2 size={20} />
                            </button>
                            <button
                                onClick={redo}
                                disabled={historyIndex >= history.length - 1}
                                className={`p-1.5 rounded-lg transition-colors ${historyIndex >= history.length - 1 ? 'text-slate-500 cursor-not-allowed' : 'text-slate-300 hover:bg-slate-700'}`}
                                title="やり直す"
                            >
                                <Redo2 size={20} />
                            </button>
                        </div>

                        <button
                            onClick={handleAddBox}
                            className="p-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm transition-colors"
                            title="枠を追加"
                        >
                            <Plus size={20} />
                        </button>
                        <button
                            onClick={handleSave}
                            className="p-1.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 shadow-sm transition-colors"
                            title="保存"
                        >
                            <Save size={20} />
                        </button>
                    </div>
                )}
            </div>

            {/* Map Area - Beige Background for "Floor" */}
            <div className="flex-1 relative bg-[#fff7ed] overflow-hidden min-h-[300px] flex items-center justify-center select-none p-4">
                <div ref={imageRef} className="relative h-full max-w-full aspect-[4/5] mx-auto shadow-sm bg-white border-2 border-gray-300">
                    {/* Aspect ratio constraint to keeping map shape roughly correct without image */}

                    {/* Background Layer (Visual only now) */}
                    <div
                        className="absolute inset-0 z-0"
                        onMouseDown={() => setSelectedPinIndex(null)}
                    />

                    {/* Boxes Overlay */}
                    {localData.locations.map((loc, index) => {
                        const style = getBoxStyle(loc, index);
                        const isSelected = editable && selectedPinIndex === index;
                        const isAisle = loc.type === 'aisle' || loc.type === 'label';

                        return (
                            <div
                                key={`${loc.address}-${index}`}
                                className={`absolute flex items-center justify-center text-center
                                    ${editable ? 'cursor-move' : 'cursor-default'} 
                                    ${isAisle ? '' : 'shadow-sm rounded-sm border-solid'}
                                `}
                                style={{ ...style, pointerEvents: 'auto' }}
                                onMouseDown={(e) => startDrag(e, index, 'MOVE')}
                                title={loc.address}
                            >
                                {/* Text Label inside the box */}
                                <span className={`pointer-events-none leading-tight overflow-hidden px-0.5 ${loc.type !== 'rack' ? 'select-none' : ''}`}>
                                    {loc.address}
                                </span>

                                {/* Resize Handles (Always visible when editing and selected, regardless of type) */}
                                {isSelected && (
                                    <>
                                        {/* Corners */}
                                        <div
                                            className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border border-indigo-600 cursor-nw-resize z-50 rounded-sm"
                                            onMouseDown={(e) => startDrag(e, index, 'RESIZE', 'nw')}
                                        />
                                        <div
                                            className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border border-indigo-600 cursor-ne-resize z-50 rounded-sm"
                                            onMouseDown={(e) => startDrag(e, index, 'RESIZE', 'ne')}
                                        />
                                        <div
                                            className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border border-indigo-600 cursor-sw-resize z-50 rounded-sm"
                                            onMouseDown={(e) => startDrag(e, index, 'RESIZE', 'sw')}
                                        />
                                        <div
                                            className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-indigo-600 cursor-se-resize z-50 rounded-sm"
                                            onMouseDown={(e) => startDrag(e, index, 'RESIZE', 'se')}
                                        />
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>

                {(!localData.locations || localData.locations.length === 0) && (
                    <div className="text-center text-gray-400 p-8 absolute">
                        <MapPin size={48} className="mx-auto mb-2 opacity-50" />
                        <p className="text-sm">マップデータがありません</p>
                    </div>
                )}
            </div>

            {/* Editor Controls */}


            {/* Empty State Help */}

        </div>
    );
}
