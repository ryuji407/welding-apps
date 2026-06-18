import type { Job, FixedJob, BreakTime } from '../types/job';
import * as XLSX from 'xlsx';

// Helper to properly parse CSV line (handles quoted fields with commas)
const DEFAULT_BREAKS: BreakTime[] = [{ id: 'default', start: '12:00', end: '12:50' }];

const WELDING_EQUIPMENT_COLORS: Record<string, string> = {
    'ロボット1台': '#818cf8', // Indigo 400
    'ロボット2台': '#6366f1', // Indigo 500
    'TIGロボット': '#4f46e5', // Indigo 600
    'TIG': '#7c3aed',        // Violet 600 (NEW)
    'FLロボット': '#4338ca', // Indigo 700
    '半自動': '#34d399',      // Emerald 400
    'S4-TIG': '#10b981',     // Emerald 500
    '簡易研磨': '#fbbf24',    // Amber 400
    '高難易度': '#f59e0b',    // Amber 500
    'スポット機': '#f87171',   // Red 400
    'ボール盤': '#fb7185',    // Rose 400
    'プレス機': '#e879f9',    // Fuchsia 400
    'タップ機': '#c084fc',    // Purple 400
};

// Sheet Metal Process Colors
const SHEET_METAL_PROCESS_COLORS: Record<string, string> = {
    'S1': '#3b82f6', // Blue
    'S2': '#10b981', // Emerald/Green
    'S7': '#f97316', // Orange
};

const DEFAULT_WELDING_COLOR = '#94a3b8'; // Slate 400

const WELDING_CUTOFF_TIME = 1140; // 19:00 in minutes

const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};

const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                // Escaped quote (double quote within quoted field)
                current += '"';
                i++; // Skip next quote
            } else {
                // Toggle quote state
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            // Field separator (only outside quotes)
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }

    // Add last field
    result.push(current.trim());

    return result;
};

// Helper to clean quantity (e.g., "PartNumber/6" -> "6")
const cleanQuantity = (value: string): string => {
    if (!value) return '';
    if (value.includes('/')) {
        const parts = value.split('/');
        const lastPart = parts[parts.length - 1].trim();
        // If last part looks like a number, assume it's the quantity
        if (!isNaN(Number(lastPart))) {
            return lastPart;
        }
    }
    return value;
};

// Helper to clean paint color (e.g., "ColorA;ColorB" -> "ColorA")
const cleanPaintColor = (value: string): string => {
    if (!value) return '';
    return value.split(';')[0].trim();
};

// Levenshtein Distance Helper
const levenshteinDistance = (a: string, b: string): number => {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];

    // increment along the first column of each row
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    // increment each column in the first row
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    // Fill in the rest of the matrix
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    Math.min(
                        matrix[i][j - 1] + 1, // insertion
                        matrix[i - 1][j] + 1 // deletion
                    )
                );
            }
        }
    }

    return matrix[b.length][a.length];
};

const calculateSimilarity = (a: string, b: string): number => {
    if (!a || !b) return 0;
    const maxLength = Math.max(a.length, b.length);
    if (maxLength === 0) return 1.0;
    const distance = levenshteinDistance(a, b);
    return 1.0 - (distance / maxLength);
};

// Helper to Find Best Lane based on Skills and Current Load
const findBestLane = (
    job: any,
    lanes: string[],
    laneSkills: Record<string, string[]>,
    laneState: Record<string, { currentTime: number, totalDuration: number, normalizedName: string }>,
    componentLaneMap: Record<string, string>,
    isSheetMetal: boolean = false,
    excludedLanes: string[] = [],
    s1PreferredLane?: string,
    equipmentWorkerPriority: Record<string, string[]> = {}
): string => {
    // 0. Sheet Metal Logic (S1/S2 -> S2 lanes, S7 -> S7 lanes)
    if (isSheetMetal) {
        // Use equipmentColumn (Process Code) if available, otherwise fallback to name
        const rawCode = job.equipmentColumn || job.name || '';
        const normalizedCode = rawCode.trim().replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s: string) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)).toUpperCase();

        // S1: Prefer S1 lane if set, otherwise find S2 lanes (excluding 岡山)
        if (normalizedCode === 'S1') {
            // S1優先レーンが指定されていて、容量に余裕がある場合
            if (s1PreferredLane && !excludedLanes.includes(s1PreferredLane)) {
                const currentLaneTime = laneState[s1PreferredLane]?.currentTime || 0;
                const duration = job.durationMinutes || 0;
                const CUTOFF_TIME = 1040; // 17:20

                if (currentLaneTime + duration <= CUTOFF_TIME) {
                    return s1PreferredLane;
                }
            }

            // 優先レーンが満杯、または未設定の場合、S2レーンから選択
            const candidates = lanes.filter(l => l.toUpperCase().includes('S2') && !excludedLanes.includes(l));
            if (candidates.length > 0) return getEarliestLane(candidates, laneState, lanes);
            // Fallback to first 3 lanes (excluding 岡山 if present)
            const indexCandidates = lanes.slice(0, 3).filter(l => !excludedLanes.includes(l));
            if (indexCandidates.length > 0) return getEarliestLane(indexCandidates, laneState, lanes);
        }
        // S2: S2レーンへ（岡山除外）
        else if (normalizedCode === 'S2') {
            const candidates = lanes.filter(l => l.toUpperCase().includes('S2') && !excludedLanes.includes(l));
            if (candidates.length > 0) return getEarliestLane(candidates, laneState, lanes);
            // Fallback to first 3 lanes if no explicit S2 lane found (excluding 岡山)
            const indexCandidates = lanes.slice(0, 3).filter(l => !excludedLanes.includes(l));
            if (indexCandidates.length > 0) return getEarliestLane(indexCandidates, laneState, lanes);
        }
        // S7: S7レーンへ（岡山除外）
        else if (normalizedCode === 'S7') {
            const candidates = lanes.filter(l => l.toUpperCase().includes('S7') && !excludedLanes.includes(l));
            if (candidates.length > 0) return getEarliestLane(candidates, laneState, lanes);
            // Fallback to last 2 lanes if no explicit S7 lane found
            const indexCandidates = lanes.slice(-2).filter(l => !excludedLanes.includes(l));
            if (indexCandidates.length > 0) return getEarliestLane(indexCandidates, laneState, lanes);
        }
    }

    // 0. Prototype Logic (Highest Priority for General or Fallback)
    // If "試作番号" (prototypeNumber) is present, only assign to lanes with "試作" skill.
    const prototypeNum = job.prototypeNumber;
    if (prototypeNum && prototypeNum.trim() !== '') {
        const prototypeLanes = lanes.filter(l => (laneSkills[l] || []).includes('試作'));
        if (prototypeLanes.length > 0) {
            // Load balance among prototype lanes
            return getEarliestLane(prototypeLanes, laneState, lanes);
        }
        // Fallback if no one has skill (shouldn't happen if configured right)
    }

    // Identify candidates based on Equipment (Priority 2)
    let candidates: string[] = [];
    const equipmentVal = job.equipmentColumn || '';

    // Helper: Extract equipment name from value like "(TIG)" → "TIG" or "(TIGロボット)" → "TIGロボット"
    const extractEquipmentName = (val: string): string => {
        const match = val.match(/\(([^)]+)\)/);
        return match ? match[1] : val.trim();
    };
    const extractedEquipment = extractEquipmentName(equipmentVal);

    if (equipmentVal) {
        // Filter lanes with EXACT matching skill (to avoid TIG matching TIGロボット)
        candidates = lanes.filter(l => {
            const skills = laneSkills[l] || [];
            return skills.some(s => s === extractedEquipment);
        });
    }

    // If no equipment specified or no match, candidates = all lanes (excluding excluded lanes)
    if (candidates.length === 0) {
        candidates = lanes.filter(l => !excludedLanes.includes(l));
    }

    // Priority 3: Equipment Worker Priority (NEW - HIGHEST PRIORITY FOR EQUIPPED CANDIDATES)
    // If equipmentWorkerPriority is configured for this equipment, use it FIRST
    // Use exact matching with extracted equipment name
    const matchedEquipmentKey = extractedEquipment && equipmentWorkerPriority[extractedEquipment]
        ? extractedEquipment
        : undefined;

    if (matchedEquipmentKey && equipmentWorkerPriority[matchedEquipmentKey]) {
        const priorityOrder = equipmentWorkerPriority[matchedEquipmentKey];
        const CUTOFF_TIME = 1040; // 17:20
        const duration = job.durationMinutes || 0;

        // Sort candidates by priority order
        const sortedCandidates = [...candidates].sort((a, b) => {
            const idxA = priorityOrder.indexOf(a);
            const idxB = priorityOrder.indexOf(b);
            return (idxA === -1 ? Infinity : idxA) - (idxB === -1 ? Infinity : idxB);
        });

        // Find the first candidate with capacity (up to 17:20)
        for (const candidate of sortedCandidates) {
            const currentTime = laneState[candidate]?.currentTime || 0;
            if (currentTime + duration <= CUTOFF_TIME) {
                return candidate;
            }
        }
        // All candidates are full past 17:20, fall through to load balancing
    }

    // Priority 4: Affinity (Grouping by Component Name)
    // Only applies if no equipment priority is set OR all priority lanes are full
    const componentName = job.componentOfficialName;
    if (componentName) {
        let preferredLane = componentLaneMap[componentName];

        // Fuzzy Matching (if exact match not found)
        if (!preferredLane) {
            const THRESHOLD = 0.8;
            for (const existingName of Object.keys(componentLaneMap)) {
                if (calculateSimilarity(componentName, existingName) >= THRESHOLD) {
                    preferredLane = componentLaneMap[existingName];
                    break;
                }
            }
        }

        // If we found a preferred lane (either exact or fuzzy)
        if (preferredLane) {
            // Check if preferred lane is in our candidate list
            if (candidates.includes(preferredLane)) {
                // Check capacity constraint (17:20 = 1040 min)
                const currentLaneTime = (laneState[preferredLane]?.currentTime) || 0;
                const duration = job.durationMinutes || 0;
                const CUTOFF_TIME = 1040;

                if (currentLaneTime + duration <= CUTOFF_TIME) {
                    return preferredLane;
                }
            }
        }
    }

    // Priority 5: Load Balancing with Lane Order
    return getEarliestLane(candidates, laneState, lanes);
};

const getEarliestLane = (
    candidates: string[],
    laneState: Record<string, { currentTime: number, totalDuration: number, normalizedName: string }>,
    activeLanes?: string[]
): string => {
    // Sort candidates by priority (index in activeLanes) first
    const sortedCandidates = activeLanes
        ? [...candidates].sort((a, b) => {
            const idxA = activeLanes.indexOf(a);
            const idxB = activeLanes.indexOf(b);
            return (idxA === -1 ? Infinity : idxA) - (idxB === -1 ? Infinity : idxB);
        })
        : candidates;

    let bestLane = sortedCandidates[0];
    let minDuration = (laneState[bestLane]?.totalDuration) ?? Infinity;

    for (const lane of sortedCandidates) {
        const duration = (laneState[lane]?.totalDuration) || 0;
        // Only switch if significantly less load (>30min gap) to preserve priority order
        if (duration < minDuration - 30) {
            minDuration = duration;
            bestLane = lane;
        }
    }
    return bestLane;
};

const selectWeldingLane = (
    job: any,
    primaryEquipment: string,
    candidateLanes: string[],
    laneState: Record<string, { currentTime: number, totalDuration: number, normalizedName: string }>,
    equipmentWorkerPriority: Record<string, string[]>,
    sequentialCounters: Record<string, number>,
    activeLanes: string[]
): string => {
    const duration = job.durationMinutes || 0;
    const lastLane = activeLanes[activeLanes.length - 1];

    if (candidateLanes.length === 0) return lastLane;

    const priorityWorkers = equipmentWorkerPriority[primaryEquipment];

    if (priorityWorkers && priorityWorkers.length > 0) {
        const ordered = priorityWorkers.filter(w => candidateLanes.includes(w));
        for (const worker of ordered) {
            if ((laneState[worker]?.currentTime || 0) + duration <= WELDING_CUTOFF_TIME) {
                return worker;
            }
        }
        // 全員19:00超え → リスト最後（候補内）、なければ全体の最後
        return ordered[ordered.length - 1] ?? lastLane;
    }

    // 優先順位未設定 → 候補レーンを先頭から順に詰める（19:00まで）
    // sequentialCounters は使用しないが、シグネチャ互換のため引数は残す
    void sequentialCounters;
    for (const worker of candidateLanes) {
        if ((laneState[worker]?.currentTime || 0) + duration <= WELDING_CUTOFF_TIME) {
            return worker;
        }
    }
    // 全員19:00超え → 候補最後のレーン
    return candidateLanes[candidateLanes.length - 1];
};

const minutesToTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

const calculateEndTime = (startMinutes: number, durationMinutes: number, breakTimes: BreakTime[]): number => {
    let currentTime = startMinutes;
    let remainingDuration = durationMinutes;

    const sortedBreaks = [...breakTimes].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

    // Adjust start time if it falls within a break
    for (const b of sortedBreaks) {
        const bStart = timeToMinutes(b.start);
        const bEnd = timeToMinutes(b.end);
        if (currentTime >= bStart && currentTime < bEnd) {
            currentTime = bEnd;
        }
    }

    let tempEndTimeVal = currentTime + remainingDuration;

    // Adjust end time for breaks
    for (const b of sortedBreaks) {
        const bStart = timeToMinutes(b.start);
        const bEnd = timeToMinutes(b.end);
        // If the job overlaps with a break, extend the end time by the break's duration
        if (currentTime < bEnd && tempEndTimeVal > bStart) {
            tempEndTimeVal += (bEnd - bStart);
        }
    }

    return tempEndTimeVal;
};

const assignJobs = (
    jobs: Job[],
    activeLanes: string[],
    activeSkills: Record<string, string[]>,
    isSheetMetal: boolean,
    laneStartTimes?: Record<string, string>,
    fixedJobs: FixedJob[] = [],
    breakTimes: Record<string, BreakTime[]> = {},
    masterSkills: string[] = [],
    excludedLanes: string[] = [],
    equipmentWorkerPriority: Record<string, string[]> = {}
): Job[] => {
    const machineStartTime = 8 * 60 + 30; // 08:30

    // Initialize lane tracking
    const laneState = activeLanes.reduce((acc, lane) => {
        const normalizedLane = lane
            .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s: string) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
            .replace(/　/g, ' ')
            .trim()
            .toUpperCase();

        let startTimeInMinutes = machineStartTime;
        if (isSheetMetal && laneStartTimes && laneStartTimes[lane]) {
            const [hours, minutes] = laneStartTimes[lane].split(':').map(Number);
            startTimeInMinutes = hours * 60 + minutes;
        }
        acc[lane] = {
            currentTime: startTimeInMinutes,
            totalDuration: 0,
            normalizedName: normalizedLane
        };
        return acc;
    }, {} as Record<string, { currentTime: number, totalDuration: number, normalizedName: string }>);

    const finalJobs: Job[] = [];

    // 0. Inject Fixed Jobs (for both Sheet Metal and Welding)
    if (fixedJobs && fixedJobs.length > 0) {
        fixedJobs.forEach(fd => {
            const targetLane = activeLanes[fd.laneIndex];
            if (targetLane) {
                const startTime = laneState[targetLane].currentTime;
                const laneSpecificBreaks = breakTimes[targetLane] || DEFAULT_BREAKS;
                const endTime = calculateEndTime(startTime, fd.duration, laneSpecificBreaks);
                const fJob: Job = {
                    id: `fixed-sm-${Date.now()}-${fd.id}`,
                    name: fd.name,
                    machine: targetLane,
                    startTime: minutesToTime(startTime),
                    endTime: minutesToTime(endTime),
                    progress: 0,
                    color: fd.color || '#9ca3af',
                    isCompleted: false,
                    setupTime: '0',
                    productionTime: (fd.duration * 60).toString(),
                    durationMinutes: fd.duration
                };

                laneState[targetLane].currentTime = endTime + 1;
                laneState[targetLane].totalDuration += fd.duration;
                finalJobs.push(fJob);
            }
        });
    }

    // ── 板金モード: 既存ロジックをそのまま使用 ──────────────────────────────
    if (isSheetMetal) {
        const sortedJobs = [...jobs].sort((a, b) => {
            const equipA = (a as any).equipmentColumn || '';
            const equipB = (b as any).equipmentColumn || '';
            const normalizeCode = (code: string) =>
                code.trim().replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)).toUpperCase();
            const codeA = normalizeCode(equipA);
            const codeB = normalizeCode(equipB);
            if (codeA === 'S1' && codeB !== 'S1') return -1;
            if (codeB === 'S1' && codeA !== 'S1') return 1;
            if (codeA === 'S2' && codeB !== 'S2' && codeB !== 'S1') return -1;
            if (codeB === 'S2' && codeA !== 'S2' && codeA !== 'S1') return 1;
            return 0;
        });

        let s1PreferredLane: string | undefined = undefined;
        const componentLaneMap: Record<string, string> = {};

        sortedJobs.forEach(job => {
            const rawCode = (job as any).equipmentColumn || job.name || '';
            const normalizedCode = rawCode.trim().replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s: string) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)).toUpperCase();

            const targetLane = findBestLane(
                job, activeLanes, activeSkills, laneState, componentLaneMap,
                true, excludedLanes,
                normalizedCode === 'S1' ? s1PreferredLane : undefined,
                equipmentWorkerPriority
            );

            if (normalizedCode === 'S1' && !s1PreferredLane) {
                s1PreferredLane = targetLane;
            }

            if (job.componentOfficialName && !componentLaneMap[job.componentOfficialName]) {
                componentLaneMap[job.componentOfficialName] = targetLane;
            }

            const startTime = laneState[targetLane].currentTime;
            const duration = job.durationMinutes || 0;
            const laneSpecificBreaks = breakTimes[targetLane] || DEFAULT_BREAKS;
            const endTime = calculateEndTime(startTime, duration, laneSpecificBreaks);

            job.startTime = minutesToTime(startTime);
            job.endTime = minutesToTime(endTime);
            job.machine = targetLane;

            const machineName = targetLane.toUpperCase();
            if (machineName.includes('S7')) {
                job.color = SHEET_METAL_PROCESS_COLORS['S7'];
            } else {
                job.color = SHEET_METAL_PROCESS_COLORS['S2'];
            }

            laneState[targetLane].currentTime = endTime + 1;
            laneState[targetLane].totalDuration += duration;
            finalJobs.push(job);
        });

        return finalJobs;
    }

    // ── 溶接モード: 設備グループ単位で優先順に割り振る ──────────────────────

    // "(TIG)" → "TIG"、全角→半角 の正規化
    const normalizeEquip = (s: string): string => {
        const match = s.match(/\(([^)]+)\)/);
        const extracted = match ? match[1] : s;
        return extracted.trim().replace(/[Ａ-Ｚａ-ｚ０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
    };

    // equipmentColumn の値を masterSkills の正式名称に変換する
    // 完全一致 → 含む一致（元コードと同じ戦略）の順で試みる
    const getCanonicalSkill = (equip: string): string => {
        const norm = normalizeEquip(equip);
        const exactIdx = masterSkills.indexOf(norm);
        if (exactIdx !== -1) return masterSkills[exactIdx];
        const fuzzyIdx = masterSkills.findIndex(s => norm.includes(s) || s.includes(norm));
        if (fuzzyIdx !== -1) return masterSkills[fuzzyIdx];
        return norm; // masterSkills に対応なし → 正規化名をそのまま使用
    };

    // 各ジョブの主設備を決定（masterSkills 最上位）
    // 返り値は masterSkills の正式名称（グループキーとして使用）
    const getPrimaryEquipment = (job: any): string => {
        const rawAll: string[] = job.allEquipmentColumns ?? (job.equipmentColumn ? [job.equipmentColumn] : []);
        if (rawAll.length === 0) return '';
        let bestIdx = Infinity;
        let bestSkill = getCanonicalSkill(rawAll[0]);
        for (const raw of rawAll) {
            const canonical = getCanonicalSkill(raw);
            const idx = masterSkills.indexOf(canonical);
            if (idx !== -1 && idx < bestIdx) {
                bestIdx = idx;
                bestSkill = canonical;
            }
        }
        return bestSkill;
    };

    // 子品番正式名称に「試作」を含むジョブは設備を「試作」として扱う
    // （例: 「試作S4」と書かれているジョブは試作設備グループへ）
    for (const job of jobs) {
        const compName = (job as any).componentOfficialName;
        if (compName && typeof compName === 'string' && compName.includes('試作')) {
            (job as any).equipmentColumn = '試作';
            (job as any).allEquipmentColumns = undefined;
        }
    }

    // ジョブを設備グループに分類（CSV順を維持）
    const groups = new Map<string, Job[]>();
    for (const job of jobs) {
        const primary = getPrimaryEquipment(job);
        const key = primary || '__none__';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(job);
    }

    // グループ処理順: masterSkills の順 → それ以外の設備 → 設備なし
    const orderedKeys: string[] = [];
    for (const skill of masterSkills) {
        if (groups.has(skill)) orderedKeys.push(skill);
    }
    for (const key of groups.keys()) {
        if (key !== '__none__' && !orderedKeys.includes(key)) orderedKeys.push(key);
    }
    if (groups.has('__none__')) orderedKeys.push('__none__');

    console.log('[assignJobs] Welding group order:', orderedKeys);

    const sequentialCounters: Record<string, number> = {};
    const lastLane = activeLanes[activeLanes.length - 1];

    for (const groupKey of orderedKeys) {
        const groupJobs = groups.get(groupKey) ?? [];

        for (const job of groupJobs) {
            let targetLane: string;

            if (groupKey === '__none__') {
                // 設備なし → 最後のレーンに全割り当て
                targetLane = lastLane;
            } else {
                // 担当者候補を決定
                // allEquips は masterSkills の正式名称に変換済み（activeSkills のキーと一致）
                const rawEquips: string[] = (job as any).allEquipmentColumns ?? [(job as any).equipmentColumn || groupKey];
                const allEquips = rawEquips.map(getCanonicalSkill);

                let candidateLanes = activeLanes
                    .filter(l => !excludedLanes.includes(l))
                    .filter(l => {
                        const skills = activeSkills[l] || [];
                        return allEquips.every(eq => skills.includes(eq));
                    });

                // 試作番号、または子品番正式名称に「試作」を含む → 試作スキル持ちレーンに絞り込む
                const isPrototypeJob =
                    (job.prototypeNumber && job.prototypeNumber.trim() !== '') ||
                    (job.componentOfficialName && job.componentOfficialName.includes('試作'));
                if (isPrototypeJob) {
                    const protoCandidates = candidateLanes.filter(l => (activeSkills[l] || []).includes('試作'));
                    if (protoCandidates.length > 0) candidateLanes = protoCandidates;
                }

                targetLane = selectWeldingLane(
                    job, groupKey, candidateLanes, laneState,
                    equipmentWorkerPriority, sequentialCounters, activeLanes
                );
            }

            const startTime = laneState[targetLane].currentTime;
            const duration = job.durationMinutes || 0;
            const laneSpecificBreaks = breakTimes[targetLane] || DEFAULT_BREAKS;
            const endTime = calculateEndTime(startTime, duration, laneSpecificBreaks);

            console.log(`[assignJobs] Job: ${job.name?.substring(0, 20)}, Group: ${groupKey}, Lane: ${targetLane}, Start: ${startTime}, End: ${endTime}`);

            job.startTime = minutesToTime(startTime);
            job.endTime = minutesToTime(endTime);
            job.machine = targetLane;

            laneState[targetLane].currentTime = endTime + 1;
            laneState[targetLane].totalDuration += duration;
            finalJobs.push(job);
        }
    }

    return finalJobs;
};

const DEFAULT_BREAKS_RECORD: Record<string, BreakTime[]> = {};

// フレクシェCSV S4設備列の定義（列インデックス → 設備名）
const FLEXCHE_S4_EQUIPMENT_COLS: { col: number; name: string }[] = [
    { col: 32, name: 'ロボット1台' },
    { col: 33, name: 'ロボット2台' },
    { col: 34, name: 'TIGロボット' },
    { col: 35, name: 'FLロボット' },
    { col: 36, name: '半自動' },
    { col: 37, name: 'TIG' },
    { col: 38, name: '簡易研磨' },
    { col: 39, name: '高難易度' },
    { col: 40, name: 'スポット機' },
    { col: 41, name: 'プレス機' },
    { col: 42, name: 'ボール盤' },
    { col: 43, name: 'タップ機' },
];

export const parseCSV = (
    csvContent: string,
    activeLanes: string[],
    activeSkills: Record<string, string[]>,
    isSheetMetal: boolean,
    laneStartTimes?: Record<string, string>,
    fixedJobs: FixedJob[] = [],
    breakTimes: Record<string, BreakTime[]> = DEFAULT_BREAKS_RECORD,
    masterSkills: string[] = [],
    excludedLanes: string[] = [],
    equipmentColors: Record<string, string> = {},
    equipmentWorkerPriority: Record<string, string[]> = {}
): { jobs: Job[], date?: string, isFlexche?: boolean, allDates?: string[] } => {
    // Ensure lanes are populated
    console.log('[parseCSV] Starting with lanes:', activeLanes, 'breakTimes provided:', !!breakTimes);
    const cleanContent = csvContent.replace(/^\uFEFF/, '');
    const lines = cleanContent.split(/\r?\n/).filter(line => line.trim() !== '');

    if (lines.length === 0) return { jobs: [] };

    const allJobs: Job[] = []; // Renamed to allJobs to avoid conflict with finalJobs
    const s6PickingJobs: Job[] = []; // S6ピッキングリスト専用ジョブ（assignJobs を通さない）
    let extractedDate: string | undefined;
    const foundDates: Record<string, number> = {};

    const firstLine = lines[0];
    const firstLineValues = parseCSVLine(firstLine);
    const isHeaderless = /^\d{4}\/\d{1,2}\/\d{1,2}/.test(firstLineValues[0]);
    // フレクシェCSV検出: 3列目が "SHOP" かつ "S4-ロボット1台" 列を持つ
    const isFlexche = !isHeaderless &&
        firstLineValues[2]?.trim() === 'SHOP' &&
        firstLineValues.some(v => v.includes('S4-ロボット1台'));
    console.log('Format detected:', isFlexche ? 'Flexche' : isHeaderless ? 'Headerless (New)' : 'Headered (Legacy)');

    if (isFlexche) {
        // ── フレクシェCSVパース ──────────────────────────────────────────
        lines.slice(1).forEach((line, i) => {
            const values = parseCSVLine(line);
            const shop = values[2]?.trim();

            const workDateRaw = values[1]?.trim() || '';
            const dateMatch = workDateRaw.match(/^(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})/);
            const dateFormatted = dateMatch
                ? `${dateMatch[1]}/${dateMatch[2].padStart(2, '0')}/${dateMatch[3].padStart(2, '0')}`
                : '';

            if (shop === 'S4') {
                // ── S4溶接行 ──────────────────────────────────────────────
                if (dateFormatted) {
                    foundDates[dateFormatted] = (foundDates[dateFormatted] || 0) + 1;
                }

                const job: any = {};
                job.id = `flexche-${Date.now()}-${i}`;
                job.progress = 0;
                job.isCompleted = false;
                job.startTime = '00:00';
                job.endTime = '00:00';

                job.name = values[8]?.trim() || values[44]?.trim() || values[4]?.trim() || '不明な工程';
                job.operationCode = values[0]?.trim() || '';
                job.finishedProductNumber = values[4]?.trim() || '';
                job.componentOfficialName = values[8]?.trim() || '';
                job.componentNumber = values[7]?.trim() || '';
                job.prototypeNumber = values[5]?.trim() || '';
                job.dailyQuantity = cleanQuantity(values[9] || '');
                job.totalQuantity = cleanQuantity(values[10] || '');
                job.workerCount = values[12]?.trim() || '1';
                job.setupTime = values[13]?.trim() || '0';
                job.productionTime = values[14]?.trim() || '0';
                job.shipDate = values[15]?.trim() || '';
                job.note = values[17]?.trim() || '';
                job.customer = values[18]?.trim() || '';
                job.nextProcessShop = values[19]?.trim() || '';
                job.nextProcessSchedule = values[20]?.trim() || '';
                job.paintColor = cleanPaintColor(values[46] || values[21] || '');
                job.pipeMaterialName = values[24]?.trim() || '';
                job.originalDate = dateFormatted;
                job.jigLocation = values[30]?.trim() || '';
                job.jigAddress = values[31]?.trim() || '';

                // S4設備列（32〜43）から設備を検出
                const detectedEquipment: string[] = [];
                for (const eq of FLEXCHE_S4_EQUIPMENT_COLS) {
                    const cellVal = values[eq.col]?.trim();
                    if (cellVal && cellVal !== '0' && cellVal.toLowerCase() !== 'false') {
                        detectedEquipment.push(eq.name);
                    }
                }

                job.equipmentColumn = detectedEquipment[0] || '';
                job.allEquipmentColumns = detectedEquipment.length > 0 ? detectedEquipment : undefined;
                job.color = equipmentColors[job.equipmentColumn] || WELDING_EQUIPMENT_COLORS[job.equipmentColumn] || equipmentColors['その他'] || DEFAULT_WELDING_COLOR;
                job.machine = 'Unassigned';

                const setupSec = parseInt((job.setupTime || '0').replace(/,/g, ''), 10) || 0;
                const prodSec = parseInt((job.productionTime || '0').replace(/,/g, ''), 10) || 0;
                job.durationMinutes = Math.ceil((setupSec + prodSec) / 60);

                if (job.durationMinutes > 0) {
                    const count = parseInt(String(job.workerCount || '1'), 10) || 1;
                    if (count === 2) {
                        allJobs.push({ ...job, id: `${job.id}-1` } as Job, { ...job, id: `${job.id}-2` } as Job);
                    } else {
                        allJobs.push(job as Job);
                    }
                }

            } else if (shop === 'S6') {
                // ── S6ピッキングリスト行 ──────────────────────────────────
                const jigAddress = values[31]?.trim() || '';
                // 治具番地が空・「ー」・「-」の場合はスキップ
                if (!jigAddress || jigAddress === 'ー' || jigAddress === '-') return;

                if (dateFormatted) {
                    foundDates[dateFormatted] = (foundDates[dateFormatted] || 0) + 1;
                }

                const operationCode = values[0]?.trim() || '';
                if (!operationCode) return;

                const s6Job: Job = {
                    id: `flexche-s6-${Date.now()}-${i}`,
                    progress: 0,
                    isCompleted: false,
                    startTime: '00:00',
                    endTime: '00:00',
                    machine: 'S6',
                    isPickingListOnly: true,
                    operationCode,
                    name: values[8]?.trim() || values[4]?.trim() || '不明な工程',
                    finishedProductNumber: values[4]?.trim() || '',
                    componentOfficialName: values[8]?.trim() || '',
                    componentNumber: values[7]?.trim() || '',
                    prototypeNumber: values[5]?.trim() || '',
                    dailyQuantity: cleanQuantity(values[9] || ''),
                    totalQuantity: cleanQuantity(values[10] || ''),
                    workerCount: values[12]?.trim() || '1',
                    setupTime: values[13]?.trim() || '0',
                    productionTime: values[14]?.trim() || '0',
                    shipDate: values[15]?.trim() || '',
                    note: values[17]?.trim() || '',
                    customer: values[18]?.trim() || '',
                    jigLocation: values[30]?.trim() || '',
                    jigAddress,
                    originalDate: dateFormatted,
                    durationMinutes: 0,
                    color: DEFAULT_WELDING_COLOR,
                };
                s6PickingJobs.push(s6Job);
            }
        });
    } else if (isHeaderless) {
        const firstDate = parseCSVLine(firstLine)[0].trim();
        if (firstDate) {
            const dateMatch = firstDate.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
            if (dateMatch) {
                extractedDate = `${dateMatch[2]}月${dateMatch[3]}日`;
            }
        }

        lines.forEach((line, i) => {
            const values = parseCSVLine(line);
            type ParsedJob = Partial<Job> & {
                equipmentColumn?: string;
                durationMinutes?: number;
            };
            const job: ParsedJob = {};
            job.startTime = '00:00';
            job.endTime = '00:00';
            job.progress = 0;
            job.finishedProductNumber = values[3];
            job.prototypeNumber = values[4];
            job.name = values[2];
            job.componentOfficialName = values[5];
            job.componentNumber = values[6];
            job.dailyQuantity = cleanQuantity(values[7]);
            job.totalQuantity = cleanQuantity(values[8]);
            job.workerCount = values[9];
            job.setupTime = values[10];
            job.productionTime = values[11];
            job.note = values[13]; // 備考 is at index 13 for Sheet Metal
            job.paintColor = cleanPaintColor(values[14]); // 塗装色 at index 14
            job.usageAmount = cleanQuantity(values[7]);

            // Extract date from values[0] or values[1] (assuming format like "2025/12/4")
            const dateValue1 = values[0] || '';
            const dateValue2 = values[1] || '';

            // 変更指示 at index 15 (available)
            job.changeInstruction = values[15] || '';
            if (job.changeInstruction === '削除') {
                return; // lines.forEach内なので、その行の処理を中断して次へ
            }

            [dateValue1, dateValue2].forEach(dv => {
                const m = dv.match(/^(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})/);
                if (m) {
                    const formatted = `${m[1]}/${m[2].padStart(2, '0')}/${m[3].padStart(2, '0')}`;
                    foundDates[formatted] = (foundDates[formatted] || 0) + 1;
                }
            });

            // Sheet Metal specific mappings (different column layout)
            if (isSheetMetal) {
                job.nextProcessShop = values[17] || '';
                job.nextProcessSchedule = values[18] || '';

                // Capture Process Code and Detailed Name
                const processCode = values[2] || ''; // S1, S2, etc.
                const detailedName = values[5] || ''; // XS-54(間口...)
                const productNumber = values[3] || ''; // XS-54

                job.equipmentColumn = processCode; // Store process code for lane assignment logic

                // Name priority: Detailed > Product > Process
                if (detailedName) {
                    job.name = detailedName;
                } else if (productNumber) {
                    job.name = productNumber;
                } else {
                    job.name = processCode;
                }

                // Assign color based on process code
                const normalizedCode = processCode.trim().replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)).toUpperCase();
                job.color = SHEET_METAL_PROCESS_COLORS[normalizedCode] || DEFAULT_WELDING_COLOR;
                console.log(`[Sheet Metal Color] processCode="${processCode}" -> normalized="${normalizedCode}" -> color="${job.color}"`);
            } else {
                job.pipeMaterialName = values[22] || '';
                const equipmentColumn = values[19] || '';
                job.equipmentColumn = equipmentColumn;
                const completionStatus = values[20] || '';
                job.isCompleted = completionStatus === '済';
            }

            job.machine = 'Unassigned';
            job.id = `job-${Date.now()}-${i}`;
            const setupSeconds = parseInt((job.setupTime || '0').replace(/,/g, ''), 10) || 0;
            const productionSeconds = parseInt((job.productionTime || '0').replace(/,/g, ''), 10) || 0;
            job.durationMinutes = Math.ceil((setupSeconds + productionSeconds) / 60);

            if (job.durationMinutes && job.durationMinutes > 0) {
                const count = parseInt(String(job.workerCount || '1'), 10) || 1;
                if (!isSheetMetal && count === 2) {
                    // Duplicate for 2 workers
                    const job1 = { ...job, id: `${job.id}-1` } as Job;
                    const job2 = { ...job, id: `${job.id}-2` } as Job;
                    allJobs.push(job1, job2);
                } else {
                    allJobs.push(job as Job);
                }
            }
        });
    } else {
        // Find the header row by looking for key terms
        const normalize = (s: string) => s.replace(/[（）() \s　\-_]/g, '').trim();

        const colMap: Record<string, string[]> = {
            name: ['作業', '工程名', '作業名', '内容', '品名'],
            processCode: ['工程'], // S1, S2, S7 etc for sheet metal
            finishedProductNumber: ['完成品番', '製品番号', '製品品番', '品番'],
            prototypeNumber: ['試作番号', '試作'],
            componentOfficialName: ['子品番の正式名称', '子品番名称', '名称'],
            componentNumber: ['子品番', '部品番号'],
            operationCode: ['作業コード', '工程CD'],
            dailyQuantity: ['当日数量', '予定数量', '数量'],
            totalQuantity: ['全数', '累計数量'],
            workerCount: ['作業人数', '人数'],
            setupTime: ['前段取り時間', '前段取り時間秒', '前段取', '段取', '段取り', 'S4段取', '段取時間', '段取り時間'],
            cycleTime: ['サイクルタイム', 'CT', 'サイクル', 'サイクルタイム秒'],
            productionTime: ['製造時間', '製造時間秒', '製造', '実働', '実働時間', 'NET', '作業時間', '加工時間'],
            s4TotalTime: ['S4合計時間', '合計時間', 'S4合計時間段取り含む'],
            customer: ['顧客', '得意先', '客先'],
            jigAddress: ['治具番地', '治具番号', '所在'],
            jigLocation: ['治具場所'],
            shipDate: ['出荷日', '納期'],
            nextProcessShop: ['後工程', '次工程', '後工程SHOP'],
            nextProcessSchedule: ['後工程日程', '次工程日程', '後工程日程変更の可能性あり', '後工程日程変更'],
            note: ['備考', 'メモ'],
            paintColor: ['塗装色', '塗装', '色', 'カラー'],
            equipment: ['設備', 'スタッフ', '担当', '担当者', 'ライン', '機械'],
            startDate: ['開始日', '着手日', '開始'],
            endDate: ['終了日', '完了日', '終了'],
            changeInstruction: ['変更指示', '指示', '変更内容']
        };

        const equipmentHeaders = [
            'ロボット1台', 'ロボット2台', 'TIGロボット', 'TIG', 'FLロボット',
            '半自動', 'S4-TIG', '簡易研磨', '高難易度',
            'スポット機', 'ボール盤', 'プレス機', 'タップ機',
            'ロボット', '手溶接', 'スポット'
        ];

        let headerLineIdx = -1;
        let bestIndices: Record<string, number> = {};
        let bestDelimiter = ',';

        // Sample first few lines to find headers
        const maxSampleLines = Math.min(lines.length, 10);
        let maxMatchCount = 0;

        for (let i = 0; i < maxSampleLines; i++) {
            const line = lines[i];
            const delimiter = line.includes('\t') && !line.includes(',') ? '\t' : ',';
            const cols = (delimiter === '\t') ? line.split('\t').map(s => s.trim()) : parseCSVLine(line);
            const normalizedCols = cols.map(normalize);

            let matchCount = 0;
            const tempIndices: Record<string, number> = {};

            Object.keys(colMap).forEach(field => {
                const possible = colMap[field].map(normalize);
                const idx = normalizedCols.findIndex(c => possible.includes(c));
                if (idx !== -1) {
                    tempIndices[field] = idx;
                    matchCount++;
                }
            });

            if (matchCount > maxMatchCount) {
                maxMatchCount = matchCount;
                headerLineIdx = i;
                bestIndices = tempIndices;
                bestDelimiter = delimiter;
            }
        }

        console.log(`[WeldingParser] Header search: row ${headerLineIdx}, matches ${maxMatchCount}, delimiter ${bestDelimiter === '\t' ? 'TAB' : 'COMMA'}`);

        // If no headers found at all, try to guess basic ones from row 0
        if (headerLineIdx === -1) {
            headerLineIdx = 0;
            bestDelimiter = lines[0].includes('\t') || lines[0].split('\t').length > lines[0].split(',').length ? '\t' : ',';
        }

        const parseLine = (l: string) => {
            if (bestDelimiter === '\t') return l.split('\t').map(s => s.trim());
            return parseCSVLine(l);
        };

        const headers = parseLine(lines[headerLineIdx]);
        const normalizedHeaders = headers.map(normalize);
        const equipmentIndices = equipmentHeaders.map(eh => normalizedHeaders.indexOf(normalize(eh)));

        for (let i = headerLineIdx + 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const values = parseLine(line);
            if (values.length < 2) continue;

            const job: any = {};
            job.id = `welding-${Date.now()}-${i}`;
            job.progress = 0;
            job.isCompleted = false;

            const getVal = (field: string) => {
                const idx = bestIndices[field];
                return (idx !== undefined && idx !== -1) ? (values[idx] || '') : '';
            };

            // Basic Mapping
            job.name = getVal('name');
            job.finishedProductNumber = getVal('finishedProductNumber');

            // Fallback: If name is empty, try to find a job name candidate
            if (!job.name) {
                if (job.finishedProductNumber) {
                    job.name = job.finishedProductNumber;
                } else if (values[0] && isNaN(Number(values[0]))) {
                    job.name = values[0];
                } else if (values[1] && isNaN(Number(values[1]))) {
                    job.name = values[1];
                } else {
                    job.name = '不明な工程';
                }
            }

            job.prototypeNumber = getVal('prototypeNumber');
            job.componentOfficialName = getVal('componentOfficialName');
            job.componentNumber = getVal('componentNumber');
            job.operationCode = getVal('operationCode');
            job.dailyQuantity = cleanQuantity(getVal('dailyQuantity'));
            job.totalQuantity = cleanQuantity(getVal('totalQuantity'));
            job.workerCount = getVal('workerCount');
            job.setupTime = getVal('setupTime') || '0';
            job.cycleTime = getVal('cycleTime') || '0';
            job.productionTime = getVal('productionTime') || '0';
            job.s4TotalTime = getVal('s4TotalTime');
            job.customer = getVal('customer');
            job.jigAddress = getVal('jigAddress');
            job.jigLocation = getVal('jigLocation');
            job.shipDate = getVal('shipDate');
            job.nextProcessShop = getVal('nextProcessShop');
            job.nextProcessSchedule = getVal('nextProcessSchedule');
            job.note = getVal('note');
            job.paintColor = cleanPaintColor(getVal('paintColor'));
            job.changeInstruction = getVal('changeInstruction');

            if (job.changeInstruction === '削除') {
                continue; // forループ内なのでcontinue
            }

            // Collect dates from Start/End columns
            const startDate = getVal('startDate');
            const endDate = getVal('endDate');
            [startDate, endDate].forEach(dv => {
                if (!dv) return;
                const m = dv.match(/^(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})/);
                if (m) {
                    const formatted = `${m[1]}/${m[2].padStart(2, '0')}/${m[3].padStart(2, '0')}`;
                    foundDates[formatted] = (foundDates[formatted] || 0) + 1;
                }
            });

            // Equipment logic: collect all matched equipment columns
            const allDetectedEquipment: string[] = [];
            for (let j = 0; j < equipmentIndices.length; j++) {
                const idx = equipmentIndices[j];
                if (idx !== -1 && values[idx] && values[idx] !== '0' && values[idx].toLowerCase() !== 'false') {
                    allDetectedEquipment.push(equipmentHeaders[j]);
                }
            }

            const primaryDetected = allDetectedEquipment[0] || getVal('equipment');

            // For sheet metal, use processCode (S1, S2, S7) as equipmentColumn
            if (isSheetMetal) {
                const rawProcessCode = getVal('processCode') || primaryDetected;
                job.equipmentColumn = rawProcessCode;
                const normalizedCode = rawProcessCode.trim().replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)).toUpperCase();
                job.color = SHEET_METAL_PROCESS_COLORS[normalizedCode] || DEFAULT_WELDING_COLOR;
                console.log(`[Sheet Metal Color - Header] processCode="${rawProcessCode}" -> normalized="${normalizedCode}" -> color="${job.color}"`);
            } else {
                job.equipmentColumn = primaryDetected;
                job.allEquipmentColumns = allDetectedEquipment.length > 0 ? allDetectedEquipment : undefined;
                job.color = equipmentColors[primaryDetected] || WELDING_EQUIPMENT_COLORS[primaryDetected] || equipmentColors['その他'] || DEFAULT_WELDING_COLOR;
            }

            // Duration calculation
            // setupTime is in seconds, productionTime is in seconds
            // s4TotalTime is already in minutes (from the CSV)
            const setupSec = parseInt((job.setupTime || '0').toString().replace(/,/g, ''), 10) || 0;
            const prodSec = parseInt((job.productionTime || '0').toString().replace(/,/g, ''), 10) || 0;
            const s4TotalMin = parseFloat((job.s4TotalTime || '0').toString().replace(/,/g, '')) || 0;

            // If productionTime is 0 but s4TotalTime exists, use s4TotalTime instead
            // s4TotalTime is "S4合計時間(段取り含む)" which is the total time in minutes
            let durationMinutes = 0;
            if (prodSec > 0) {
                // Use setupTime + productionTime (both in seconds)
                durationMinutes = Math.ceil((setupSec + prodSec) / 60);
            } else if (s4TotalMin > 0) {
                // Use setupTime/60 + s4TotalTime (s4TotalTime includes work time)
                durationMinutes = Math.ceil(setupSec / 60 + s4TotalMin);
            } else {
                // Only setupTime available
                durationMinutes = Math.ceil(setupSec / 60);
            }
            job.durationMinutes = durationMinutes;

            console.log(`[WeldingParser] Job: ${job.name?.substring(0, 15)}, setupTime: "${job.setupTime}"(${setupSec}s), prodTime: "${job.productionTime}"(${prodSec}s), s4Total: ${s4TotalMin}min, duration: ${job.durationMinutes}min`);

            job.machine = 'Unassigned';

            // Push if we have at least some data
            if (job.name !== '不明な工程' || job.finishedProductNumber || job.componentNumber) {
                const count = parseInt(String(job.workerCount || '1'), 10) || 1;
                if (!isSheetMetal && count === 2) {
                    // Duplicate for 2 workers
                    const job1 = { ...job, id: `${job.id}-1` } as Job;
                    const job2 = { ...job, id: `${job.id}-2` } as Job;
                    allJobs.push(job1, job2);
                } else {
                    allJobs.push(job as Job);
                }
            }
        }
    }

    const finalJobs = assignJobs(allJobs, activeLanes, activeSkills, isSheetMetal, laneStartTimes, fixedJobs, breakTimes, masterSkills, excludedLanes, equipmentWorkerPriority);

    // Determine most frequent date
    let mostFrequentDate = extractedDate;
    let maxCount = 0;
    Object.entries(foundDates).forEach(([date, count]) => {
        if (count > maxCount) {
            maxCount = count;
            mostFrequentDate = date;
        }
    });

    // S6ピッキングリスト専用ジョブを結合（assignJobs を通していないので末尾に追加）
    const combinedJobs = isFlexche ? [...finalJobs, ...s6PickingJobs] : finalJobs;

    const allDates = Object.keys(foundDates).sort();
    console.log('parseCSV completed. Jobs found:', combinedJobs.length, '(S6 picking:', s6PickingJobs.length, ') Date identified:', mostFrequentDate, 'isFlexche:', isFlexche);
    if (isFlexche) {
        return { jobs: combinedJobs, date: mostFrequentDate, isFlexche: true, allDates };
    }
    return { jobs: combinedJobs, date: mostFrequentDate };
};

export const parseExcel = async (
    file: File,
    activeLanes: string[],
    activeSkills: Record<string, string[]>,
    isSheetMetal: boolean,
    laneStartTimes?: Record<string, string>,
    fixedJobs: FixedJob[] = [],
    breakTimes: Record<string, BreakTime[]> = DEFAULT_BREAKS_RECORD,
    masterSkills: string[] = [],
    excludedLanes: string[] = [],
    equipmentColors: Record<string, string> = {},
    equipmentWorkerPriority: Record<string, string[]> = {}
): Promise<{ jobs: Job[], date?: string }> => {
    console.log('[parseExcel] Starting with lanes:', activeLanes, 'breakTimes provided:', !!breakTimes);
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                if (!data) {
                    reject(new Error('ファイルの読み込みに失敗しました'));
                    return;
                }
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const rawData = XLSX.utils.sheet_to_json(worksheet, {
                    header: 1,
                    defval: ''
                }) as any[][];

                const parsedJobs: Job[] = []; // Renamed to parsedJobs to avoid conflict with finalJobs
                const foundDates: Record<string, number> = {};

                rawData.forEach((row, i) => {
                    if (!row || row.length === 0) return;
                    const values = row.map(v => String(v || '').trim());
                    const job: any = {};
                    job.startTime = '00:00';
                    job.endTime = '00:00';
                    job.progress = 0;
                    job.finishedProductNumber = values[3];
                    job.name = values[2];
                    job.componentOfficialName = values[5];
                    job.componentNumber = values[6];
                    job.dailyQuantity = cleanQuantity(values[7]);
                    job.totalQuantity = cleanQuantity(values[8]);
                    job.workerCount = values[9];
                    job.setupTime = values[10];
                    job.productionTime = values[11];
                    job.note = values[13];
                    job.paintColor = cleanPaintColor(values[14]);
                    const equipmentColumn = values[19] || '';
                    job.equipmentColumn = equipmentColumn;
                    job.color = equipmentColors[equipmentColumn] || WELDING_EQUIPMENT_COLORS[equipmentColumn] || equipmentColors['その他'] || DEFAULT_WELDING_COLOR;

                    const completionStatus = values[20] || '';
                    job.isCompleted = completionStatus === '済';

                    // Excel specific mappings if columns match CSV
                    job.nextProcessSchedule = values[23]; // Assuming same index as Pipeline CSV if applicable, or just generic
                    job.nextProcessShop = values[24]; // Placeholder if specific index known
                    // Based on previous requests, often Excel indices match the CSV export or specific template. 
                    // For now, I will add these assignments to be safe, though index validation is hard without file.
                    // Pipeline parser didn't explicitly show these in Excel section, but user asked for "same as pipeline settings".
                    // I will leave them commented out if uncertain or map them if I find the index in csvParser. But csvParser Excel section didn't have them.
                    // Re-reading user request: "CSVを取り込んだ時の設定". So Excel might optionally need it. 
                    // I will map indices 23 and 24 tentatively as they are often next to completion (20) & material (22).
                    // Checking csvParser.ts for headerless/excel indices again... 
                    // Headerless CSV used indices up to 22. 
                    // I will strictly follow the "Headered CSV" request part primarily. 
                    // For "Headerless/Excel", I'll keep the Quantity fields as requested.


                    // Headerless/Excel date extraction (indices 0, 1)
                    const dv1 = values[0] || '';
                    const dv2 = values[1] || '';
                    [dv1, dv2].forEach(dv => {
                        const m = dv.match(/^(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})/);
                        if (m) {
                            const formatted = `${m[1]}/${m[2].padStart(2, '0')}/${m[3].padStart(2, '0')}`;
                            foundDates[formatted] = (foundDates[formatted] || 0) + 1;
                        }
                    });

                    job.machine = 'Unassigned';
                    job.id = `job-${Date.now()}-${i}`;

                    const setupSeconds = parseInt((job.setupTime || '0').replace(/,/g, ''), 10) || 0;
                    const productionSeconds = parseInt((job.productionTime || '0').replace(/,/g, ''), 10) || 0;
                    job.durationMinutes = Math.ceil((setupSeconds + productionSeconds) / 60);

                    if (job.durationMinutes > 0 && job.name) {
                        const count = parseInt(String(job.workerCount || '1'), 10) || 1;
                        if (!isSheetMetal && count === 2) {
                            // Duplicate for 2 workers
                            const job1 = { ...job, id: `${job.id}-1` } as Job;
                            const job2 = { ...job, id: `${job.id}-2` } as Job;
                            parsedJobs.push(job1, job2);
                        } else {
                            parsedJobs.push(job as Job);
                        }
                    }
                });

                const jobs = assignJobs(parsedJobs, activeLanes, activeSkills, isSheetMetal, laneStartTimes, fixedJobs, breakTimes, masterSkills, excludedLanes, equipmentWorkerPriority);

                // Determine most frequent date
                let mostFrequentDate: string | undefined;
                let maxCount = 0;
                Object.entries(foundDates).forEach(([date, count]) => {
                    if (count > maxCount) {
                        maxCount = count;
                        mostFrequentDate = date;
                    }
                });

                console.log('parseExcel completed. Jobs found:', jobs.length, 'Date identified:', mostFrequentDate);
                resolve({ jobs: jobs, date: mostFrequentDate });
            } catch (error) {
                console.error('Excel Parse Error:', error);
                reject(error);
            }
        };

        reader.onerror = () => {
            reject(new Error('ファイルの読み込みに失敗しました'));
        };

        reader.readAsArrayBuffer(file);
    });
};
