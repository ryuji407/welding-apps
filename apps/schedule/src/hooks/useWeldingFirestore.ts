import { useState, useEffect } from 'react';
import {
    collection,
    onSnapshot,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    orderBy,
    setDoc,
    getDocs
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Job, FixedJob, BreakTime, NonProductionCategory } from '../types/job';

const DEFAULT_NON_PRODUCTION_CATEGORIES: NonProductionCategory[] = [
    { name: '事務作業', color: '#3b82f6' },
    { name: 'トラブル対応', color: '#ef4444' },
    { name: '打合せ', color: '#f97316' },
    { name: '部材供給', color: '#10b981' },
    { name: '工程表作成・試作回答', color: '#8b5cf6' },
    { name: 'その他', color: '#64748b' },
];
import type { Schedule } from '../types/schedule';

export interface JobHistoryEntry {
    job: Job;
    scheduleDate: string;
    scheduleId: string;
    isArchived: boolean;
}

// Custom hook for managing Welding Schedules
export function useWeldingSchedules() {
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, 'welding_schedules'), orderBy('date', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Schedule[];
            setSchedules(data);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const addSchedule = async (name: string, date: string) => {
        const docRef = await addDoc(collection(db, 'welding_schedules'), {
            name,
            date,
            createdAt: new Date().toISOString()
        });
        return docRef.id;
    };

    const deleteSchedule = async (id: string) => {
        await deleteDoc(doc(db, 'welding_schedules', id));
    };

    const updateSchedule = async (id: string, data: Partial<{ name: string, date: string, isArchived: boolean }>) => {
        await updateDoc(doc(db, 'welding_schedules', id), data);
    };

    return { schedules, loading, addSchedule, deleteSchedule, updateSchedule };
}

// Custom hook for managing Jobs within a Welding Schedule
export function useWeldingJobs(scheduleId: string | null) {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!scheduleId) {
            setJobs([]);
            return;
        }

        setLoading(true);
        const q = query(collection(db, `welding_schedules/${scheduleId}/jobs`));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Job[];
            setJobs(data);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [scheduleId]);

    const addJob = async (jobData: Omit<Job, 'id'>) => {
        if (!scheduleId) return null;
        const docRef = await addDoc(collection(db, 'welding_schedules', scheduleId, 'jobs'), jobData);
        return docRef.id;
    };

    const updateJob = async (job: Job) => {
        if (!scheduleId) return;

        // Optimistic update
        setJobs(prev => prev.map(j => j.id === job.id ? job : j));

        try {
            const jobRef = doc(db, `welding_schedules/${scheduleId}/jobs`, job.id);
            const { id, ...data } = job;
            await updateDoc(jobRef, data);
        } catch (error) {
            console.error('Firestore update failed, rolling back:', error);
            // Rollback is usually handled by the next snapshot from Firestore
            // but we can also trigger a refresh or manual rollback if needed.
            // For now, Firestore's onSnapshot will eventually bring back the server state.
        }
    };

    const deleteJob = async (jobId: string) => {
        if (!scheduleId) return;
        await deleteDoc(doc(db, `welding_schedules/${scheduleId}/jobs`, jobId));
    };

    const batchUpdateJobs = async (jobsToUpdate: Job[]) => {
        if (!scheduleId || jobsToUpdate.length === 0) return;

        // Optimistic update
        setJobs(prev => {
            const newJobs = [...prev];
            jobsToUpdate.forEach(updatedJob => {
                const idx = newJobs.findIndex(j => j.id === updatedJob.id);
                if (idx !== -1) {
                    newJobs[idx] = updatedJob;
                }
            });
            return newJobs;
        });

        try {
            const { writeBatch } = await import('firebase/firestore');
            const CHUNK_SIZE = 400; // max 500 but safe limit
            
            for (let i = 0; i < jobsToUpdate.length; i += CHUNK_SIZE) {
                const chunk = jobsToUpdate.slice(i, i + CHUNK_SIZE);
                const batch = writeBatch(db);

                chunk.forEach(job => {
                    const jobRef = doc(db, `welding_schedules/${scheduleId}/jobs`, job.id);
                    const { id, ...data } = job;
                    batch.update(jobRef, data);
                });

                await batch.commit();
            }
        } catch (error) {
            console.error('Batch update failed:', error);
        }
    };

    return { jobs, setJobs, loading, addJob, updateJob, deleteJob, batchUpdateJobs };
}

// Custom hook for Material Master
export function useMaterials() {
    const [materials, setMaterials] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Materials might be a single large document or collection. 
        // For simplicity and performance with large lists, let's keep using a single doc for now 
        // OR a collection if individual updates are needed.
        // Giving the user's Excel import workflow, a single JSON blob in a doc might be easier to manage 
        // than thousands of writes, but Firestore has a 1MB limit per doc.
        // If materials are > 1MB, we need a collection.
        // Let's assume collection for scalability.

        // Actually, user wipes data on import. Deleting 1000 docs is expensive (billing/time).
        // Let's stick to a specific "master" document if size allows, or just use localStorage for Master data 
        // IF it doesn't need to be synced instantly.
        // Request said "Simultaneous edit", implies Master data should be synced too?
        // "Material Import" is Admin only. 
        // Let's try to sync it via a single document "global/materials" for now, easy to cache.

        const unsub = onSnapshot(doc(db, 'global', 'materials'), (doc) => {
            if (doc.exists()) {
                setMaterials(doc.data().data || []);
            } else {
                setMaterials([]);
            }
            setLoading(false);
        });

        return () => unsub();
    }, []);

    const saveMaterials = async (newMaterials: any[]) => {
        // WARNING: Firestore Document Size Limit is 1MB.
        // If 2000 rows * 500 bytes = 1MB. It might exceed.
        // If it fails, we fall back to localStorage or Batch Writes.
        try {
            await setDoc(doc(db, 'global', 'materials'), { data: newMaterials });
        } catch (e) {
            console.error("Material save failed (likely too big):", e);
            alert("データ量が多すぎるためクラウド保存に失敗しました。この機能は要調整です。");
        }
    };

    return { materials, loading, saveMaterials };
}

// Custom hook for Issuance (Work-in-Progress List)
export function useIssuanceList() {
    const [issuanceList, setIssuanceList] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'global', 'issuanceList'), (doc) => {
            if (doc.exists()) {
                setIssuanceList(doc.data().list || []);
            } else {
                setIssuanceList([]);
            }
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const updateIssuanceList = async (newList: any[]) => {
        await setDoc(doc(db, 'global', 'issuanceList'), { list: newList });
    };

    return { issuanceList, loading, updateIssuanceList };
}

// Custom hook for fetching all jobs across all schedules (one-time, for history view)
export function useAllJobsHistory() {
    const [entries, setEntries] = useState<JobHistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAll = async () => {
        setLoading(true);
        setError(null);
        try {
            const schedulesSnap = await getDocs(collection(db, 'welding_schedules'));
            const schedules = schedulesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Schedule[];

            const results = await Promise.all(
                schedules.map(async (schedule) => {
                    const jobsSnap = await getDocs(collection(db, `welding_schedules/${schedule.id}/jobs`));
                    return jobsSnap.docs.map(d => ({
                        job: { id: d.id, ...d.data() } as Job,
                        scheduleDate: schedule.date || '',
                        scheduleId: schedule.id,
                        isArchived: schedule.isArchived || false,
                    }));
                })
            );
            setEntries(results.flat());
        } catch (e) {
            setError('データの取得に失敗しました');
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAll();
    }, []);

    return { entries, loading, error, refetch: fetchAll };
}

// Custom hook for Welding Settings (Lanes & Skills)
export function useWeldingSettings() {
    const DEFAULT_LANES = ['マーク', '坂本', '山口', '成田', '外山', 'アキ', 'その他'];
    const DEFAULT_JOB_BAR_FIELDS = ['finishedProductNumber', 'prototypeNumber', 'componentOfficialName', 'dailyQuantity'];
    const [lanes, setLanes] = useState<string[]>(DEFAULT_LANES);
    const [laneSkills, setLaneSkills] = useState<Record<string, string[]>>({});
    const [laneStartTimes, setLaneStartTimes] = useState<Record<string, string>>({});
    const [laneColors, setLaneColors] = useState<Record<string, string>>({});
    const [lanePriorities, setLanePriorities] = useState<Record<string, number>>({});
    const [masterSkills, setMasterSkills] = useState<string[]>([]);
    const [fixedJobs, setFixedJobs] = useState<FixedJob[]>([]);
    const [laneBreakTimes, setLaneBreakTimes] = useState<Record<string, BreakTime[]>>({});
    const [equipmentColors, setEquipmentColors] = useState<Record<string, string>>({});
    const [jobBarDisplayMode, setJobBarDisplayMode] = useState<'standard' | 'simple' | 'detailed' | 'custom'>('standard');
    const [jobBarCustomFields, setJobBarCustomFields] = useState<string[]>(DEFAULT_JOB_BAR_FIELDS);
    const [jobBarTextColor, setJobBarTextColor] = useState<string>('#ffffff');
    const [setupTimeColor, setSetupTimeColor] = useState<string>('#f59e0b');
    const [equipmentWorkerPriority, setEquipmentWorkerPriority] = useState<Record<string, string[]>>({});
    const [nonProductionCategories, setNonProductionCategories] = useState<NonProductionCategory[]>(DEFAULT_NON_PRODUCTION_CATEGORIES);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'global', 'weldingSettings'), (docSnapshot) => {
            if (docSnapshot.exists()) {
                const data = docSnapshot.data();
                if (data.lanes) setLanes(data.lanes);
                if (data.laneSkills) setLaneSkills(data.laneSkills);
                if (data.laneStartTimes) setLaneStartTimes(data.laneStartTimes);
                if (data.laneColors) setLaneColors(data.laneColors);
                if (data.lanePriorities) setLanePriorities(data.lanePriorities);
                if (data.masterSkills) setMasterSkills(data.masterSkills);
                if (data.fixedJobs) setFixedJobs(data.fixedJobs);
                if (data.equipmentColors) {
                    setEquipmentColors(data.equipmentColors);
                }
                if (data.jobBarDisplayMode) setJobBarDisplayMode(data.jobBarDisplayMode);
                if (data.jobBarCustomFields) setJobBarCustomFields(data.jobBarCustomFields);
                if (data.jobBarTextColor) setJobBarTextColor(data.jobBarTextColor);
                if (data.setupTimeColor) setSetupTimeColor(data.setupTimeColor);
                if (data.equipmentWorkerPriority) setEquipmentWorkerPriority(data.equipmentWorkerPriority);
                if (Array.isArray(data.nonProductionCategories) && data.nonProductionCategories.length > 0) {
                    setNonProductionCategories(data.nonProductionCategories);
                } else {
                    setNonProductionCategories(DEFAULT_NON_PRODUCTION_CATEGORIES);
                }

                // Handle Break Times Migration/Initialization
                if (data.laneBreakTimes) {
                    setLaneBreakTimes(data.laneBreakTimes);
                } else if (data.breakTimes) {
                    // Migrate from old global structure if exists
                    const migrated: Record<string, BreakTime[]> = {};
                    const lanesList = data.lanes || DEFAULT_LANES;
                    lanesList.forEach((lane: string) => {
                        migrated[lane] = data.breakTimes;
                    });
                    setLaneBreakTimes(migrated);
                } else {
                    // Default for all lanes
                    const defaults: Record<string, BreakTime[]> = {};
                    const lanesList = data.lanes || DEFAULT_LANES;
                    lanesList.forEach((lane: string) => {
                        defaults[lane] = [{ id: 'default', start: '12:00', end: '12:50' }];
                    });
                    setLaneBreakTimes(defaults);
                }
            } else {
                setLanes(DEFAULT_LANES);
                setLaneSkills({});
                setLaneStartTimes({});
                setLaneColors({});
                setLanePriorities({});
                setMasterSkills([]);
                setEquipmentColors({});
                setNonProductionCategories(DEFAULT_NON_PRODUCTION_CATEGORIES);
                const defaults: Record<string, BreakTime[]> = {};
                DEFAULT_LANES.forEach(lane => {
                    defaults[lane] = [{ id: 'default', start: '12:00', end: '12:50' }];
                });
                setLaneBreakTimes(defaults);
            }
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const updateLanes = async (newLanes: string[]) => {
        await setDoc(doc(db, 'global', 'weldingSettings'), { lanes: newLanes }, { merge: true });
    };

    const updateLaneSkills = async (newSkills: Record<string, string[]>) => {
        await setDoc(doc(db, 'global', 'weldingSettings'), { laneSkills: newSkills }, { merge: true });
    };

    const updateMasterSkills = async (newMasterSkills: string[]) => {
        await setDoc(doc(db, 'global', 'weldingSettings'), { masterSkills: newMasterSkills }, { merge: true });
    };

    const updateJobBarDisplayMode = async (newMode: 'standard' | 'simple' | 'detailed' | 'custom') => {
        await setDoc(doc(db, 'global', 'weldingSettings'), { jobBarDisplayMode: newMode }, { merge: true });
    };

    const updateNonProductionCategories = async (newCategories: NonProductionCategory[]) => {
        await setDoc(doc(db, 'global', 'weldingSettings'), { nonProductionCategories: newCategories }, { merge: true });
    };

    const updateSettings = async (
        newLanes: string[],
        newSkills: Record<string, string[]>,
        newStartTimes: Record<string, string>,
        newColors: Record<string, string>,
        newMasterSkills: string[],
        newFixedJobs?: FixedJob[],
        newBreakTimes?: Record<string, BreakTime[]>,
        newPriorities?: Record<string, number>,
        newEquipmentColors?: Record<string, string>,
        newJobBarTextColor?: string,
        newEquipmentWorkerPriority?: Record<string, string[]>,
        newSetupTimeColor?: string,
        newJobBarCustomFields?: string[],
        newJobBarDisplayMode?: string
    ) => {
        await setDoc(doc(db, 'global', 'weldingSettings'), {
            lanes: newLanes,
            laneSkills: newSkills,
            laneStartTimes: newStartTimes,
            laneColors: newColors,
            masterSkills: newMasterSkills,
            fixedJobs: newFixedJobs || fixedJobs,
            laneBreakTimes: newBreakTimes || laneBreakTimes,
            lanePriorities: newPriorities || lanePriorities,
            equipmentColors: newEquipmentColors || equipmentColors,
            jobBarTextColor: newJobBarTextColor || jobBarTextColor,
            setupTimeColor: newSetupTimeColor || setupTimeColor,
            equipmentWorkerPriority: newEquipmentWorkerPriority || equipmentWorkerPriority,
            jobBarCustomFields: newJobBarCustomFields || jobBarCustomFields,
            jobBarDisplayMode: newJobBarDisplayMode || jobBarDisplayMode
        }, { merge: true });
    };

    return {
        lanes, laneSkills, laneStartTimes, laneColors, lanePriorities, masterSkills,
        fixedJobs, laneBreakTimes, equipmentColors, equipmentWorkerPriority,
        jobBarDisplayMode, jobBarCustomFields, jobBarTextColor, setupTimeColor,
        nonProductionCategories, loading,
        updateLanes, updateLaneSkills, updateMasterSkills, updateJobBarDisplayMode, updateSettings,
        updateNonProductionCategories,
        setJobBarDisplayMode, setJobBarCustomFields
    };
}

