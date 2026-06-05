import type { Job, BreakTime } from '../types/job';

const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};

// Validates time string HH:MM

export const optimizeJobsList = (
    jobs: Job[],
    machines: string[],
    laneStartTimes: Record<string, string>,
    breakTimes: Record<string, BreakTime[]> = {}
): Job[] => {
    const DEFAULT_BREAKS: BreakTime[] = [{ id: 'default', start: '12:00', end: '12:50' }];
    console.log('[optimizeJobsList] Input jobs:', jobs.length, 'Machines:', machines);

    // Debug: Show all unique machine values in jobs
    const uniqueMachines = [...new Set(jobs.map(j => j.machine))];
    console.log('[optimizeJobsList] Unique machine values in jobs:', uniqueMachines);

    const optimizedJobs: Job[] = [];

    // Helper for normalization
    const normalize = (val?: string): string => {
        if (!val) return '';
        let normalized = val
            .replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)) // Half-width alphanumeric
            .replace(/　/g, ' ') // Half-width space
            .trim()
            .toUpperCase();

        // Fuzzy mapping for common Sheet Metal machine names
        const mapping: Record<string, string> = {
            'NAGAO': '長尾',
            'SUZUKI': '鈴木',
            'OKAYAMA': '岡山',
            'KIMOTO': '木本',
            'FUJIMOTO': '藤本'
        };

        return mapping[normalized] || normalized;
    };

    const EXCLUDED_NAMES = ['事務作業', '工程表作成、試作回答', '機械トラブル対応', '作業者への部材供給、完成品供給'];


    const minutesToTime = (minutes: number): string => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    };

    const processedIds = new Set<string>();
    const targetMachines = machines && machines.length > 0 ? machines : ['工程A', '工程B', '工程C', '工程D', '工程E'];

    targetMachines.forEach(machine => {
        const normalizedMachine = normalize(machine);
        // 1. Filter jobs for this machine that haven't been processed yet
        const machineExcludedJobs = jobs.filter(j => normalize(j.machine) === normalizedMachine && EXCLUDED_NAMES.includes(j.name));
        const machineNormalJobs = jobs.filter(j =>
            normalize(j.machine) === normalizedMachine &&
            !EXCLUDED_NAMES.includes(j.name) &&
            !processedIds.has(j.id)
        );

        console.log(`[optimizeJobsList] Lane: "${machine}" (normalized: "${normalizedMachine}"), Excluded: ${machineExcludedJobs.length}, Normal: ${machineNormalJobs.length}`);

        if (machineNormalJobs.length === 0 && machineExcludedJobs.length === 0) {
            return;
        }

        // ...
        // Group and Sort Logic
        // ... (optimizeList remains same)
        const optimizeList = (targetJobs: Job[]): Job[] => {
            const productGroups = new Map<string, Job[]>();
            targetJobs.forEach(job => {
                const key = normalize(job.finishedProductNumber);
                if (!productGroups.has(key)) productGroups.set(key, []);
                productGroups.get(key)?.push(job);
            });
            const groupOrders = Array.from(productGroups.entries()).map(([key, groupJobs]) => {
                const sortedGroupJobs = groupJobs.sort((a, b) => {
                    const matA = normalize(a.pipeMaterialName);
                    const matB = normalize(b.pipeMaterialName);
                    if (matA !== matB) return matA.localeCompare(matB);
                    if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime);
                    return a.id.localeCompare(b.id);
                });
                const earliest = sortedGroupJobs.reduce((min, job) => (job.startTime < min ? job.startTime : min), '23:59');
                return { key, earliest, jobs: sortedGroupJobs };
            });
            groupOrders.sort((a, b) => {
                if (a.earliest !== b.earliest) return a.earliest.localeCompare(b.earliest);
                return a.key.localeCompare(b.key);
            });
            const result: Job[] = [];
            groupOrders.forEach(g => result.push(...g.jobs));
            return result;
        };

        const normalJobs = machineNormalJobs.filter(j => j.color !== '#ca8a04');
        const movedJobs = machineNormalJobs.filter(j => j.color === '#ca8a04');

        const optimizedNormal = optimizeList(normalJobs);
        const optimizedMoved = optimizeList(movedJobs);

        let sortedMachineJobs = [...optimizedNormal, ...optimizedMoved];

        // 3. Recalculate Timeline starting from after fixed jobs
        let laneStartMin = 8 * 60 + 30; // 08:30
        if (laneStartTimes && laneStartTimes[machine]) {
            const [hours, minutes] = laneStartTimes[machine].split(':').map(Number);
            laneStartMin = hours * 60 + minutes;
        }

        // Special case for LT7 (Welding)
        if (machine === 'LT7' && laneStartMin < 10 * 60) {
            laneStartMin = 10 * 60;
        }

        // Find max end time of excluded jobs in this lane
        // These jobs keep their original times, so normal jobs must start after them
        let currentTime = laneStartMin;
        machineExcludedJobs.forEach(j => {
            const [h, m] = j.endTime.split(':').map(Number);
            const endMin = (isNaN(h) || isNaN(m)) ? laneStartMin : (h * 60 + m);
            if (endMin > currentTime) currentTime = endMin;
            processedIds.add(j.id); // Mark excluded as processed
            // Add excluded jobs to optimizedJobs with their original times
            optimizedJobs.push(j);
        });

        // Apply breaks
        const machineBreaks = (breakTimes && breakTimes[machine]) || DEFAULT_BREAKS;
        const sortedBreaks = [...machineBreaks].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

        sortedMachineJobs.forEach(job => {
            // Apply breaks to move currentTime forward if it falls during/before a break
            for (const b of sortedBreaks) {
                const bStart = timeToMinutes(b.start);
                const bEnd = timeToMinutes(b.end);
                if (currentTime >= bStart && currentTime < bEnd) {
                    currentTime = bEnd;
                }
            }

            const startTimeVal = currentTime;
            let duration = 0;
            if (job.manualDurationMinutes) {
                duration = job.manualDurationMinutes;
            } else {
                const setupSeconds = parseInt((job.setupTime || '0').replace(/,/g, ''), 10) || 0;
                const productionSeconds = parseInt((job.productionTime || '0').replace(/,/g, ''), 10) || 0;
                const s4TotalMinutes = parseFloat((job.s4TotalTime || '0').replace(/,/g, '')) || 0;

                if (productionSeconds > 0) {
                    duration = Math.ceil((setupSeconds + productionSeconds) / 60);
                } else if (s4TotalMinutes > 0) {
                    duration = Math.ceil(setupSeconds / 60 + s4TotalMinutes);
                } else {
                    duration = Math.ceil(setupSeconds / 60);
                }
            }

            let tempEndTimeVal = startTimeVal + duration;
            for (const b of sortedBreaks) {
                const bStart = timeToMinutes(b.start);
                const bEnd = timeToMinutes(b.end);
                if (startTimeVal < bEnd && tempEndTimeVal > bStart) {
                    tempEndTimeVal += (bEnd - bStart);
                }
            }

            const newStart = minutesToTime(startTimeVal);
            const newEnd = minutesToTime(tempEndTimeVal);

            optimizedJobs.push({
                ...job,
                startTime: newStart,
                endTime: newEnd
            });
            processedIds.add(job.id);
            currentTime = tempEndTimeVal + 1;
        });
    });

    // We only gathered optimized jobs. We need to merge them back with un-touched jobs.
    const optimizedIds = new Set(optimizedJobs.map(j => j.id));
    const untouchedJobs = jobs.filter(j => !optimizedIds.has(j.id));

    console.log('[optimizeJobsList] Optimized:', optimizedJobs.length, 'Untouched:', untouchedJobs.length);
    if (untouchedJobs.length > 0) {
        console.log('[optimizeJobsList] UNTOUCHED JOBS (not optimized):', untouchedJobs.map(j => ({
            id: j.id.slice(0, 6),
            name: j.name?.slice(0, 15),
            machine: j.machine,
            start: j.startTime,
            end: j.endTime
        })));
    }

    return [...optimizedJobs, ...untouchedJobs];
}
