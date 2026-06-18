import { useState, useEffect, useCallback, useRef } from 'react';
import type { Job } from '../types/job';
import { FileUploader } from '../components/FileUploader';
import { parseCSV, parseExcel } from '../utils/weldingCsvParser';
import { optimizeJobsList } from '../utils/jobOptimizer';
import { EditJobModal } from '../components/EditJobModal';
import { JobList } from '../components/JobList';
import { WeldingGanttChart } from '../components/WeldingGanttChart';
import { WeldingLaneSettingsModal } from '../components/WeldingLaneSettingsModal';
import { PickingList } from '../components/PickingList';
import { X, Plus, Minus, FileOutput, Archive, History, RefreshCw, Settings, ClipboardList, Sparkles } from 'lucide-react';
import { StandardIcon, GanttIcon, ListIcon } from '../components/ViewIcons';
import { useWeldingSchedules, useWeldingJobs, useWeldingSettings } from '../hooks/useWeldingFirestore';
import { useUndo } from '../hooks/useUndo';
import { collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAdminMode } from '../context/AdminModeContext';
import { useSidebar } from '../context/SidebarContext';

interface SchedulePageProps {
    onFileNameChange?: (fileName: string) => void;
    viewMode?: 'default' | 'gantt' | 'list';
    onNavigateToHistory?: () => void;
}

export function WeldingSchedulePage({ onFileNameChange, viewMode: initialViewMode = 'gantt', onNavigateToHistory }: SchedulePageProps) {
    // Internal View Mode state
    const [viewMode, setViewMode] = useState<'default' | 'gantt' | 'list'>(initialViewMode || 'gantt');

    // Firestore Hooks
    const { schedules, loading: schedulesLoading, addSchedule, deleteSchedule, updateSchedule } = useWeldingSchedules();
    const {
        lanes, laneSkills, laneStartTimes, laneColors, masterSkills,
        fixedJobs, laneBreakTimes, equipmentColors, equipmentWorkerPriority,
        jobBarDisplayMode, jobBarCustomFields, jobBarTextColor, setupTimeColor,
        nonProductionCategories, updateNonProductionCategories,
        updateSettings, setJobBarDisplayMode, updateJobBarDisplayMode
    } = useWeldingSettings();
    const [activeScheduleId, setActiveScheduleId] = useState<string | null>(() => {
        return localStorage.getItem('mfg_activeScheduleId_welding');
    });
    const { jobs, loading: jobsLoading, addJob, updateJob, deleteJob, batchUpdateJobs } = useWeldingJobs(activeScheduleId);

    // Undo Hook
    const { addToHistory } = useUndo();
    const { isAdmin } = useAdminMode();
    const { isCollapsed } = useSidebar();
    const isWeldingAdmin = isAdmin('welding');
    console.log('[WeldingPage] isWeldingAdmin:', isWeldingAdmin);

    // State for Modals
    const [editingJob, setEditingJob] = useState<Job | null>(null);
    // isOptimizeMenuOpen removed
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isArchivesOpen, setIsArchivesOpen] = useState(false);

    // フレクシェCSV: 日付選択モーダル用
    const [flexcheImportData, setFlexcheImportData] = useState<{
        jobs: Job[];
        allDates: string[];
        fileName: string;
    } | null>(null);
    const [flexcheSelectedDates, setFlexcheSelectedDates] = useState<Set<string>>(new Set());

    // State for Global Machine Filter
    const [selectedMachine, setSelectedMachine] = useState<string | 'all'>('all');

    // Zoom Level State (Pixels per 10 minutes)
    const [zoomLevel, setZoomLevel] = useState(20);
    const ganttContainerRef = useRef<HTMLDivElement>(null);

    // ピンチ・ホイールによる横方向ズーム（PC trackpad + タブレット）
    useEffect(() => {
        const el = ganttContainerRef.current;
        if (!el) return;

        // PC: trackpad pinch = wheel + ctrlKey
        const handleWheel = (e: WheelEvent) => {
            if (!e.ctrlKey) return;
            e.preventDefault();
            const delta = e.deltaY < 0 ? 5 : -5;
            setZoomLevel(prev => Math.min(200, Math.max(20, prev + delta)));
        };

        // タブレット: 2本指ピンチ
        let lastDist = 0;
        const handleTouchStart = (e: TouchEvent) => {
            if (e.touches.length === 2) {
                lastDist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
            }
        };
        const handleTouchMove = (e: TouchEvent) => {
            if (e.touches.length !== 2) return;
            e.preventDefault();
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            const delta = Math.round((dist - lastDist) * 0.4);
            if (delta !== 0) {
                setZoomLevel(prev => Math.min(200, Math.max(20, prev + delta)));
                lastDist = dist;
            }
        };

        el.addEventListener('wheel', handleWheel, { passive: false });
        el.addEventListener('touchstart', handleTouchStart, { passive: true });
        el.addEventListener('touchmove', handleTouchMove, { passive: false });
        return () => {
            el.removeEventListener('wheel', handleWheel);
            el.removeEventListener('touchstart', handleTouchStart);
            el.removeEventListener('touchmove', handleTouchMove);
        };
    }, []);

    // Lane Height State (Vertical Zoom)
    const [laneHeight, setLaneHeight] = useState(80);

    // 2行表示モード State
    const [twoRowLayout, setTwoRowLayout] = useState(false);

    // ピッキングリスト表示 State
    const [isPickingListOpen, setIsPickingListOpen] = useState(false);

    // Helper to determine visible machines for Gantt
    const getVisibleMachines = () => {
        if (selectedMachine === 'all') return lanes;
        return [selectedMachine];
    };

    const [archiveConfirm, setArchiveConfirm] = useState<{
        show: boolean;
        scheduleId: string | null;
        date: string;
    }>({ show: false, scheduleId: null, date: '' });

    const [deleteConfirm, setDeleteConfirm] = useState<{
        show: boolean;
        jobIds: string[];
        type: 'job' | 'schedule' | null;
        scheduleId?: string | null;
    }>({ show: false, jobIds: [], type: null, scheduleId: null });

    const [moveConfirm, setMoveConfirm] = useState<{
        show: boolean;
        jobIds: string[];
        targetScheduleId: string | null;
        jobName: string;
    }>({ show: false, jobIds: [], targetScheduleId: null, jobName: '' });

    // 起動時に表示設定が「カスタム」だった場合、確実に「標準」にリセットする
    useEffect(() => {
        if (!jobsLoading && !schedulesLoading && jobBarDisplayMode === 'custom') {
            console.log('[WeldingPage] Resetting jobBarDisplayMode from custom to standard');
            updateJobBarDisplayMode('standard');
            setJobBarDisplayMode('standard');
        }
    }, [jobsLoading, schedulesLoading, jobBarDisplayMode, updateJobBarDisplayMode, setJobBarDisplayMode]);

    // Save activeScheduleId when it changes
    useEffect(() => {
        if (activeScheduleId) {
            localStorage.setItem('mfg_activeScheduleId_welding', activeScheduleId);
        }
    }, [activeScheduleId]);

    // Set active schedule on load or when schedules change
    useEffect(() => {
        const visibleSchedules = schedules.filter(s => !s.isArchived);
        
        // 起動時や削除・アーカイブ時にデフォルトで選択するスケジュールを決定（今日に最も近いもの）
        const getDefaultScheduleId = (schedulesList: any[]) => {
            if (schedulesList.length === 0) return null;
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            
            let closestId = schedulesList[0].id;
            let minDiff = Infinity;

            for (const s of schedulesList) {
                let scheduleTime = 0;
                const matchFull = s.date.match(/(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})/);
                const matchShort = s.date.match(/^(\d{2})(\d{2})/);
                if (matchFull) {
                    scheduleTime = new Date(+matchFull[1], +matchFull[2] - 1, +matchFull[3]).getTime();
                } else if (matchShort) {
                    scheduleTime = new Date(now.getFullYear(), +matchShort[1] - 1, +matchShort[2]).getTime();
                }
                if (scheduleTime > 0) {
                    const diff = Math.abs(scheduleTime - today);
                    if (diff < minDiff) {
                        minDiff = diff;
                        closestId = s.id;
                    }
                }
            }
            return closestId;
        };

        if (!activeScheduleId && visibleSchedules.length > 0) {
            const storedId = localStorage.getItem('mfg_activeScheduleId_welding');
            const exists = visibleSchedules.find(s => s.id === storedId);
            if (exists) {
                setActiveScheduleId(storedId);
            } else {
                setActiveScheduleId(getDefaultScheduleId(visibleSchedules));
            }
        } else if (activeScheduleId && !visibleSchedules.find(s => s.id === activeScheduleId) && visibleSchedules.length > 0) {
            setActiveScheduleId(getDefaultScheduleId(visibleSchedules));
        } else if (visibleSchedules.length === 0) {
            setActiveScheduleId(null);
        }
    }, [schedules, activeScheduleId]);

    const executeMoveJob = useCallback(async () => {
        const { jobIds, targetScheduleId } = moveConfirm;
        if (jobIds.length === 0 || !targetScheduleId || !activeScheduleId) return;
        const jobsToMove = jobIds.map(id => jobs.find(j => j.id === id)).filter(Boolean) as import('../types/job').Job[];
        if (jobsToMove.length === 0) return;
        try {
            const { writeBatch, collection: fbCollection, doc: fbDoc } = await import('firebase/firestore');
            const batch = writeBatch(db);
            // Add jobs to target schedule in selection order (anchor first)
            jobsToMove.forEach(job => {
                const { id, ...rawJobData } = job;
                const jobData = JSON.parse(JSON.stringify(rawJobData));
                const newRef = fbDoc(fbCollection(db, 'welding_schedules', targetScheduleId, 'jobs'));
                batch.set(newRef, { ...jobData, color: '#ca8a04', updatedAt: new Date().toISOString() });
            });
            // Delete from current schedule
            jobsToMove.forEach(job => {
                batch.delete(fbDoc(db, 'welding_schedules', activeScheduleId, 'jobs', job.id));
            });
            await batch.commit();
            setMoveConfirm({ show: false, jobIds: [], targetScheduleId: null, jobName: '' });
        } catch (error) {
            console.error('Failed to move job(s):', error);
            alert('移動に失敗しました。');
        }
    }, [moveConfirm, activeScheduleId, jobs, db]);

    // Update parent component with active schedule date
    useEffect(() => {
        if (activeScheduleId && schedules.length > 0) {
            const active = schedules.find(s => s.id === activeScheduleId);
            if (active && onFileNameChange) {
                onFileNameChange(active.date);
            }
        } else if (onFileNameChange) {
            onFileNameChange('');
        }
    }, [activeScheduleId, schedules, onFileNameChange]);

    // Handle Keyboard shortcuts for Move Confirmation modal
    useEffect(() => {
        if (!moveConfirm.show) return;
        const handleModalKey = (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                executeMoveJob();
            } else if (e.key === 'Escape') {
                setMoveConfirm({ show: false, jobIds: [], targetScheduleId: null, jobName: '' });
            }
        };
        window.addEventListener('keydown', handleModalKey);
        return () => window.removeEventListener('keydown', handleModalKey);
    }, [moveConfirm.show, executeMoveJob]);

    // Print range: clip and scale gantt to fill A3 page dynamically
    useEffect(() => {
        const handleBeforePrint = () => {
            if (jobs.length === 0) return;

            // 1. Calculate the active time range based on all jobs
            // Filter out default jobs if they are not relevant to range (e.g. they fill the day)
            // But usually we just take everything.
            const allStarts = jobs.map(j => {
                const [h, m] = j.startTime.split(':').map(Number);
                return h * 60 + m;
            });
            const allEnds = jobs.map(j => {
                const [h, m] = j.endTime.split(':').map(Number);
                return h * 60 + m;
            });

            // Standard start time for the chart is 08:30 (510 min)
            const minChartStart = 8 * 60 + 30;
            const earliestJob = Math.min(...allStarts);
            const latestJob = Math.max(...allEnds);

            // Print range with 30-min buffers
            const printStartMin = Math.max(minChartStart, Math.floor((earliestJob - 30) / 30) * 30);
            const printEndMin = Math.min(21 * 60, Math.ceil((latestJob + 30) / 30) * 30);
            const totalMinutes = printEndMin - printStartMin;

            // 2. Coordinate calculation
            const pxPerMin = zoomLevel / 10;
            const labelWidth = 100; // Left personnel name column width

            // Offset (in minutes) from the data's absolute start to our print start
            const offsetMin = printStartMin - minChartStart;
            const offsetPx = offsetMin * pxPerMin;

            // Target window width in pixels
            const contentPx = (totalMinutes * pxPerMin) + labelWidth;

            const container = document.querySelector('.gantt-scroll-container') as HTMLElement | null;
            if (container) {
                // A3 landscape width is approx 390mm usable (with 15mm margins)
                // 390mm * 3.78px/mm ≈ 1474px
                const availableWidthPx = 1474;
                const scale = availableWidthPx / contentPx;

                container.style.width = `${contentPx}px`;
                container.style.maxWidth = `${contentPx}px`;
                container.style.overflow = 'hidden';
                container.style.transform = `scale(${scale})`;
                container.style.transformOrigin = 'top center';
                container.style.marginTop = '15mm';

                // Shift only the grid area (classes added to WeldingGanttChart)
                document.body.style.setProperty('--print-gantt-offset', `-${offsetPx}px`);
                
                // Also ensure the header and rows stay aligned
                container.querySelectorAll('.gantt-grid-container').forEach(el => {
                    (el as HTMLElement).style.transform = `translateX(-${offsetPx}px)`;
                });
            }
        };

        const handleAfterPrint = () => {
            const container = document.querySelector('.gantt-scroll-container') as HTMLElement | null;
            if (container) {
                container.style.width = '';
                container.style.maxWidth = '';
                container.style.overflow = '';
                container.style.transform = '';
                container.style.transformOrigin = '';
                container.style.marginTop = '';

                document.body.style.removeProperty('--print-gantt-offset');
                
                container.querySelectorAll('.gantt-grid-container').forEach(el => {
                    (el as HTMLElement).style.transform = '';
                });
            }
        };

        window.addEventListener('beforeprint', handleBeforePrint);
        window.addEventListener('afterprint', handleAfterPrint);
        return () => {
            window.removeEventListener('beforeprint', handleBeforePrint);
            window.removeEventListener('afterprint', handleAfterPrint);
        };
    }, [jobs, zoomLevel]);

    const handleArchive = async (scheduleId: string) => {
        const targetSchedule = schedules.find(s => s.id === scheduleId);
        if (!targetSchedule) return;
        setArchiveConfirm({ show: true, scheduleId, date: targetSchedule.date });
    };

    const executeArchive = async () => {
        const { scheduleId } = archiveConfirm;
        if (!scheduleId) return;
        try {
            await updateSchedule(scheduleId, { isArchived: true });
        } catch (error) {
            console.error('Archive failed:', error);
            alert('アーカイブに失敗しました');
        } finally {
            setArchiveConfirm({ show: false, scheduleId: null, date: '' });
        }
    };

    const handleRestore = async (scheduleId: string) => {
        await updateSchedule(scheduleId, { isArchived: false });
    };

    const handleJobUpdate = async (updatedJob: Job) => {
        try {
            await updateJob(updatedJob);
        } catch (error) {
            console.error('Job update failed:', error);
            alert('更新に失敗しました。');
        }
    };
    const handleJobClick = (job: Job) => { setEditingJob(job); };

    const handleJobSave = async (updatedJob: Job) => {
        const exists = jobs.some(j => j.id === updatedJob.id);
        if (exists) {
            const previousJob = jobs.find(j => j.id === updatedJob.id);
            if (activeScheduleId && previousJob) {
                const { id, ...prevData } = previousJob;
                addToHistory({
                    type: 'UPDATE',
                    path: `welding_schedules/${activeScheduleId}/jobs`,
                    docId: updatedJob.id,
                    prevData: prevData
                });
            }
            await updateJob(updatedJob);
        } else {
            const { id, ...jobData } = updatedJob;
            const activeSchedule = schedules.find(s => s.id === activeScheduleId);
            if (!jobData.originalDate && activeSchedule) {
                jobData.originalDate = activeSchedule.date;
            }
            const newJobId = await addJob(jobData);
            if (activeScheduleId) {
                addToHistory({
                    type: 'ADD',
                    path: `welding_schedules/${activeScheduleId}/jobs`,
                    docId: newJobId || ''
                });
            }
        }
        setEditingJob(null);
    };

    const handleJobDelete = (jobIdOrIds: string | string[]) => {
        const ids = Array.isArray(jobIdOrIds) ? jobIdOrIds : [jobIdOrIds];
        setDeleteConfirm({ show: true, jobIds: ids, type: 'job' });
    };

    const confirmDelete = async () => {
        if (deleteConfirm.type === 'job' && deleteConfirm.jobIds.length > 0) {
            const jobsToDelete = deleteConfirm.jobIds.map(id => jobs.find(j => j.id === id)).filter(Boolean) as import('../types/job').Job[];
            if (activeScheduleId && jobsToDelete.length > 0) {
                for (const jobToDelete of jobsToDelete) {
                    const { id, ...prevData } = jobToDelete;
                    addToHistory({
                        type: 'DELETE',
                        path: `welding_schedules/${activeScheduleId}/jobs`,
                        docId: jobToDelete.id,
                        prevData: prevData
                    });
                    await deleteJob(jobToDelete.id);
                }
            }
        } else if (deleteConfirm.type === 'schedule' && deleteConfirm.scheduleId) {
            await deleteSchedule(deleteConfirm.scheduleId);
        }
        setDeleteConfirm({ show: false, jobIds: [], type: null, scheduleId: null });
    };

    const cancelDelete = () => { setDeleteConfirm({ show: false, jobIds: [], type: null, scheduleId: null }); };

    const handleSplitJob = useCallback(async (jobId: string) => {
        if (!isWeldingAdmin || !activeScheduleId) return;
        const originalJob = jobs.find(j => j.id === jobId);
        if (!originalJob) return;

        const parseNum = (s: string | undefined | number) => {
            if (typeof s === 'number') return s;
            return parseInt((s || '0').toString().replace(/,/g, ''), 10) || 0;
        };
        
        const origSetup = parseNum(originalJob.setupTime);
        const origDaily = parseNum(originalJob.dailyQuantity);
        const origProdTime = parseNum(originalJob.productionTime);

        // 分割計算 (1つ目を切り捨て、2つ目を残りにすることで合計を維持)
        const setup1 = Math.floor(origSetup / 2);
        const setup2 = origSetup - setup1;
        
        const daily1 = Math.floor(origDaily / 2);
        const daily2 = origDaily - daily1;
        
        const prodTime1 = Math.floor(origProdTime / 2);
        const prodTime2 = origProdTime - prodTime1;

        try {
            const { writeBatch, collection: fbCollection, doc: fbDoc } = await import('firebase/firestore');
            const batch = writeBatch(db);
            
            const job1Ref = fbDoc(fbCollection(db, 'welding_schedules', activeScheduleId, 'jobs'));
            const job2Ref = fbDoc(fbCollection(db, 'welding_schedules', activeScheduleId, 'jobs'));
            const originalRef = fbDoc(db, 'welding_schedules', activeScheduleId, 'jobs', jobId);

            const { id: _id, ...baseData } = originalJob;

            // 1つ目のジョブ
            const job1Data = {
                ...baseData,
                setupTime: setup1.toString(),
                dailyQuantity: daily1.toString(),
                productionTime: prodTime1.toString(),
                textColor: '#10b981', // 緑色
                // startTimeは一旦同じに設定（後の再計算で調整される想定）
                createdAt: new Date().toISOString()
            };

            // 2つ目のジョブ
            const job2Data = {
                ...baseData,
                setupTime: setup2.toString(),
                dailyQuantity: daily2.toString(),
                productionTime: prodTime2.toString(),
                textColor: '#10b981', // 緑色
                createdAt: new Date().toISOString()
            };

            batch.delete(originalRef);
            batch.set(job1Ref, job1Data);
            batch.set(job2Ref, job2Data);

            await batch.commit();

            // 再計算をトリガーして時間を整える
            const newJobsList = jobs.filter(j => j.id !== jobId).concat([
                { ...job1Data, id: job1Ref.id },
                { ...job2Data, id: job2Ref.id }
            ]);
            await recalculateAndSaveAll(newJobsList, { preserveOrder: true });

            console.log('[WeldingPage] Job split and recalculated:', jobId);
        } catch (error) {
            console.error('[WeldingPage] Failed to split job:', error);
            alert('ジョブの分割に失敗しました。');
        }
    }, [jobs, activeScheduleId, isWeldingAdmin, db]);

    const recalculateAndSaveAll = async (targetJobs: Job[], options?: { preserveOrder?: boolean }) => {
        const EXCLUDED_NAMES = (fixedJobs || []).map(fj => fj.name);
        const machines = lanes;
        const DEFAULT_START_TIME = 8 * 60 + 30;
        let batchUpdates: Job[] = [];
        const processedIds = new Set<string>();

        machines.forEach(machine => {
            const machineExcludedJobs = targetJobs.filter(j => j.machine === machine && EXCLUDED_NAMES.includes(j.name));
            const machineNormalJobs = targetJobs.filter(j => j.machine === machine && !EXCLUDED_NAMES.includes(j.name) && !processedIds.has(j.id));

            let laneStartMin = DEFAULT_START_TIME;
            if (laneStartTimes[machine]) {
                const [hours, minutes] = laneStartTimes[machine].split(':').map(Number);
                laneStartMin = hours * 60 + minutes;
            }

            const currentBreaks = laneBreakTimes[machine] || [{ id: 'default', start: '12:00', end: '12:50' }];
            let currentTime = laneStartMin;
            machineExcludedJobs.forEach(j => {
                const [h, m] = j.endTime.split(':').map(Number);
                const endMin = (isNaN(h) || isNaN(m)) ? laneStartMin : (h * 60 + m);
                if (endMin > currentTime) currentTime = endMin;
                processedIds.add(j.id);
            });

            const jobsToProcess = options?.preserveOrder
                ? machineNormalJobs
                : [...machineNormalJobs].sort((a, b) => {
                    const timeComp = a.startTime.localeCompare(b.startTime);
                    if (timeComp !== 0) return timeComp;
                    return a.id.localeCompare(b.id);
                });

            jobsToProcess.forEach((job) => {
                let duration = 0;
                if (job.manualDurationMinutes) {
                    duration = job.manualDurationMinutes;
                } else {
                    const setupSeconds = parseInt((job.setupTime || '0').replace(/,/g, ''), 10) || 0;
                    const productionSeconds = parseInt((job.productionTime || '0').replace(/,/g, ''), 10) || 0;
                    duration = Math.ceil((setupSeconds + productionSeconds) / 60);
                }

                currentBreaks.forEach(breakTime => {
                    const [bStartH, bStartM] = breakTime.start.split(':').map(Number);
                    const [bEndH, bEndM] = breakTime.end.split(':').map(Number);
                    const bStart = bStartH * 60 + bStartM;
                    const bEnd = bEndH * 60 + bEndM;
                    if (currentTime >= bStart && currentTime < bEnd) currentTime = bEnd;
                });

                const newStart = `${Math.floor(currentTime / 60).toString().padStart(2, '0')}:${(currentTime % 60).toString().padStart(2, '0')}`;
                let tempEndTimeVal = currentTime + duration;
                currentBreaks.forEach(breakTime => {
                    const [bStartH, bStartM] = breakTime.start.split(':').map(Number);
                    const [bEndH, bEndM] = breakTime.end.split(':').map(Number);
                    const bStartVal = bStartH * 60 + bStartM;
                    const bEndVal = bEndH * 60 + bEndM;
                    if (currentTime < bStartVal && tempEndTimeVal > bStartVal) tempEndTimeVal += (bEndVal - bStartVal);
                });

                const newEnd = `${Math.floor(tempEndTimeVal / 60).toString().padStart(2, '0')}:${(tempEndTimeVal % 60).toString().padStart(2, '0')}`;
                const originalJob = jobs.find(j => j.id === job.id);
                if (!originalJob || originalJob.startTime !== newStart || originalJob.endTime !== newEnd || originalJob.machine !== job.machine) {
                    batchUpdates.push({ ...job, startTime: newStart, endTime: newEnd });
                }
                processedIds.add(job.id);
                currentTime = tempEndTimeVal + 1;
            });
        });
        if (batchUpdates.length > 0) {
            await batchUpdateJobs(batchUpdates);
        }
    };

    const handleMoveJobUp = async (jobId: string) => {
        if (!isWeldingAdmin) return;
        const sorted = [...jobs].sort((a, b) => a.startTime.localeCompare(b.startTime));
        const index = sorted.findIndex(j => j.id === jobId);
        if (index === -1) return;
        const currentJob = sorted[index];
        let targetIndex = -1;
        for (let i = index - 1; i >= 0; i--) {
            if (sorted[i].machine === currentJob.machine) {
                targetIndex = i;
                break;
            }
        }
        if (targetIndex !== -1) {
            // Actually swap the jobs in the array before recalculating
            const [movedJob] = sorted.splice(index, 1);
            sorted.splice(targetIndex, 0, movedJob);
            await recalculateAndSaveAll(sorted, { preserveOrder: true });
        }
    };

    const handleMoveJobDown = async (jobId: string) => {
        if (!isWeldingAdmin) return;
        const sorted = [...jobs].sort((a, b) => a.startTime.localeCompare(b.startTime));
        const index = sorted.findIndex(j => j.id === jobId);
        if (index === -1) return;
        const currentJob = sorted[index];
        let targetIndex = -1;
        for (let i = index + 1; i < sorted.length; i++) {
            if (sorted[i].machine === currentJob.machine) {
                targetIndex = i;
                break;
            }
        }
        if (targetIndex !== -1) {
            // Actually swap the jobs in the array before recalculating
            const [movedJob] = sorted.splice(index, 1);
            sorted.splice(targetIndex, 0, movedJob);
            await recalculateAndSaveAll(sorted, { preserveOrder: true });
        }
    };

    const handleMoveJobsToLane = async (jobIds: string[], newLane: string) => {
        console.log('[WeldingPage] handleMoveJobsToLane:', jobIds, 'newLane:', newLane, 'isWeldingAdmin:', isWeldingAdmin);
        if (!isWeldingAdmin || jobIds.length === 0) return;

        // 1st selected job is the anchor
        const anchorJob = jobs.find(j => j.id === jobIds[0]);
        if (!anchorJob) return;

        // Current order in the whole schedule
        const currentSorted = [...jobs].sort((a, b) => a.startTime.localeCompare(b.startTime));

        // Filter out selected jobs from their current positions
        const otherJobs = currentSorted.filter(j => !jobIds.includes(j.id));

        // Find all selected job objects (preserving original selection order)
        const selectedJobs = jobIds.map(id => jobs.find(j => j.id === id)).filter(Boolean) as Job[];

        // All selected jobs move to the new lane
        const updatedSelectedJobs = selectedJobs.map(j => ({ ...j, machine: newLane }));

        // Decide where to insert the "block" of selected jobs in the new lane
        // Case 1: Moving to a DIFFERENT lane -> Put them at the end of the new lane
        // Case 2: Moving within the SAME lane -> The anchor's position is already handled by logic (but here we just re-align)

        let newSorted: Job[];
        if (anchorJob.machine !== newLane) {
            // New lane - insert jobs preserving their chronological order
            newSorted = [...otherJobs, ...updatedSelectedJobs].sort(
                (a, b) => a.startTime.localeCompare(b.startTime)
            );
        } else {
            // Same lane - find where the anchor was and keep it there, with others following
            newSorted = [...currentSorted];
            // Remove those that are not anchor but are selected
            const selectedSet = new Set(jobIds);
            newSorted = newSorted.filter(j => j.id === anchorJob.id || !selectedSet.has(j.id));
            const finalAnchorIndex = newSorted.findIndex(j => j.id === anchorJob.id);
            // Insert the rest after anchor
            newSorted.splice(finalAnchorIndex + 1, 0, ...updatedSelectedJobs.slice(1));
        }

        await recalculateAndSaveAll(newSorted, { preserveOrder: true });
    };

    const handleSwapJobsOrder = async (jobIds: string[], direction: 'left' | 'right') => {
        console.log('[WeldingPage] handleSwapJobsOrder:', jobIds, 'direction:', direction, 'isWeldingAdmin:', isWeldingAdmin);
        if (!isWeldingAdmin || jobIds.length === 0) return;

        const anchorId = jobIds[0];
        const sorted = [...jobs].sort((a, b) => a.startTime.localeCompare(b.startTime));

        // Get selected job objects in selection order (anchor first)
        const selectedJobs = jobIds.map(id => jobs.find(j => j.id === id)).filter(Boolean) as Job[];
        if (selectedJobs.length === 0) return;
        const anchorJob = selectedJobs[0];

        // All selected jobs must be in the same lane as anchor
        // (if cross-lane, ignore for left/right movement)
        const anchorLane = anchorJob.machine;

        // Jobs not in selection for anchor's lane
        const anchorIndex = sorted.findIndex(j => j.id === anchorId);
        if (anchorIndex === -1) return;

        // Find the target neighbor: first non-selected job in the same lane on the left or right
        let targetIndex = -1;
        if (direction === 'left') {
            for (let i = anchorIndex - 1; i >= 0; i--) {
                if (sorted[i].machine === anchorLane && !jobIds.includes(sorted[i].id)) {
                    targetIndex = i;
                    break;
                }
            }
        } else {
            for (let i = anchorIndex + 1; i < sorted.length; i++) {
                if (sorted[i].machine === anchorLane && !jobIds.includes(sorted[i].id)) {
                    targetIndex = i;
                    break;
                }
            }
        }

        if (targetIndex !== -1) {
            // Remove all selected jobs from the sorted list
            const otherJobs = sorted.filter(j => !jobIds.includes(j.id));

            // Re-find target in the stripped list
            const targetInOthers = otherJobs.findIndex(j => j.id === sorted[targetIndex].id);

            // Insert the whole selection block: anchor first, then rest in selection order
            if (direction === 'left') {
                // Insert before target
                otherJobs.splice(targetInOthers, 0, ...selectedJobs);
            } else {
                // Insert after target — anchor first, others follow in selection order
                otherJobs.splice(targetInOthers + 1, 0, ...selectedJobs);
            }

            await recalculateAndSaveAll(otherJobs, { preserveOrder: true });
        }
    };

    const handleMoveJobToSchedule = (jobId: string, targetScheduleId: string) => {
        const jobToMove = jobs.find(j => j.id === jobId);
        if (!jobToMove) return;
        setMoveConfirm({
            show: true,
            jobIds: [jobId],
            targetScheduleId,
            jobName: jobToMove.finishedProductNumber || jobToMove.name
        });
    };

    // Called from Gantt context menu – supports multi-job move
    const handleMoveJobsToSchedule = (jobIds: string[], targetScheduleId: string) => {
        if (jobIds.length === 0) return;
        const anchorJob = jobs.find(j => j.id === jobIds[0]);
        if (!anchorJob) return;
        setMoveConfirm({
            show: true,
            jobIds,
            targetScheduleId,
            jobName: anchorJob.finishedProductNumber || anchorJob.name
        });
    };



    const handleOptimize = async (targetMachine: 'all' | string = 'all') => {
        if (!jobs.length) return;
        const machines = targetMachine === 'all' ? lanes : [targetMachine];
        const optimized = optimizeJobsList(jobs, machines, laneStartTimes, laneBreakTimes);
        const updates: Job[] = [];
        optimized.forEach(optJob => {
            const original = jobs.find(j => j.id === optJob.id);
            if (original && (original.startTime !== optJob.startTime || original.endTime !== optJob.endTime)) {
                updates.push(optJob);
            }
        });
        if (updates.length > 0) {
            await batchUpdateJobs(updates);
            // Alert removed
        }
    };

    const handleCopyJobs = useCallback((jobIds: string[]) => {
        if (!isWeldingAdmin || jobIds.length === 0) return;
        const selectedJobs = jobIds.map(id => jobs.find(j => j.id === id)).filter(Boolean) as import('../types/job').Job[];
        if (selectedJobs.length > 0) {
            localStorage.setItem('weldingCopiedJobs', JSON.stringify(selectedJobs));
            console.log('[WeldingPage] Copied jobs:', selectedJobs.length);
        }
    }, [isWeldingAdmin, jobs]);

    const handlePasteJobs = useCallback(async () => {
        if (!isWeldingAdmin || !activeScheduleId) return;
        const copiedData = localStorage.getItem('weldingCopiedJobs');
        if (!copiedData) return;

        try {
            const copiedJobs = JSON.parse(copiedData) as import('../types/job').Job[];
            if (copiedJobs.length === 0) return;

            // Target machine is the machine of the first copied job
            const targetMachine = lanes.includes(copiedJobs[0].machine) ? copiedJobs[0].machine : lanes[0];
            if (!targetMachine) return;

            const machineJobs = jobs.filter(j => j.machine === targetMachine);
            let appendStartTime = '08:30';
            
            const timeToMinutes = (t: string) => { const [h,m]=t.split(':').map(Number); return (isNaN(h)||isNaN(m)) ? 0 : h*60+m; };
            const minutesToTime = (m: number) => `${Math.floor(m / 60).toString().padStart(2, '0')}:${(m % 60).toString().padStart(2, '0')}`;

            if (machineJobs.length > 0) {
                const sortedEnds = machineJobs.map(j => timeToMinutes(j.endTime)).sort((a, b) => b - a);
                appendStartTime = minutesToTime(sortedEnds[0]);
            } else if (laneStartTimes[targetMachine]) {
                const parts = laneStartTimes[targetMachine].split(':');
                if (parts.length === 2 && !isNaN(Number(parts[0])) && !isNaN(Number(parts[1]))) {
                    appendStartTime = laneStartTimes[targetMachine];
                }
            }

            let currentVisualMinutes = timeToMinutes(appendStartTime);
            const mBreaks = laneBreakTimes[targetMachine] || [{ id: 'default', start: '12:00', end: '12:50' }];
            const sortedBreaks = [...mBreaks].sort((a,b)=>timeToMinutes(a.start)-timeToMinutes(b.start));

            const { writeBatch, collection: fbCollection, doc: fbDoc } = await import('firebase/firestore');
            const batch = writeBatch(db);

            copiedJobs.forEach((job) => {
                const setupMinutes = parseInt((job.setupTime || '0').replace(/,/g, ''), 10) / 60 || 0;
                const productionMinutes = parseInt((job.productionTime || '0').replace(/,/g, ''), 10) / 60 || 0;
                let duration = Math.ceil(setupMinutes + productionMinutes);
                if (duration <= 0) duration = 30; // Min duration fallback

                // Fast-forward if current time falls in a break
                sortedBreaks.forEach(b => {
                    const bS = timeToMinutes(b.start);
                    const bE = timeToMinutes(b.end);
                    if (currentVisualMinutes >= bS && currentVisualMinutes < bE) currentVisualMinutes = bE;
                });

                const newStart = minutesToTime(currentVisualMinutes);
                
                let endVal = currentVisualMinutes + duration;
                sortedBreaks.forEach(b => {
                    const bS = timeToMinutes(b.start);
                    const bE = timeToMinutes(b.end);
                    if (currentVisualMinutes < bS && endVal > bS) endVal += (bE - bS);
                });
                
                const newEnd = minutesToTime(endVal);

                const newRef = fbDoc(fbCollection(db, 'welding_schedules', activeScheduleId, 'jobs'));
                const { id, ...rawJobData } = job;
                
                batch.set(newRef, { 
                    ...rawJobData, 
                    machine: targetMachine,
                    startTime: newStart,
                    endTime: newEnd,
                    progress: 0,
                    isCompleted: false,
                    updatedAt: new Date().toISOString()
                });

                currentVisualMinutes = endVal;
            });

            await batch.commit();

        } catch (e) {
            console.error('[WeldingPage] Failed to paste jobs:', e);
            alert('ペースト処理でエラーが発生しました。');
        }
    }, [isWeldingAdmin, activeScheduleId, jobs, lanes, laneStartTimes, laneBreakTimes, db]);

    // Shortcut for Optimization (R key) & View Mode (S, G, L keys)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')) return;

            const key = e.key.toLowerCase();

            if (key === 'r' && isWeldingAdmin) {
                e.preventDefault();
                handleOptimize('all');
            }

            if (key === 's') {
                e.preventDefault();
                setViewMode('default');
            }

            if (key === 'g') {
                e.preventDefault();
                setViewMode('gantt');
            }

            if (key === 'l') {
                e.preventDefault();
                setViewMode('list');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isWeldingAdmin, handleOptimize]);

    const handleCreateNewJob = () => {
        const newJob: Job = {
            id: `temp-${Date.now()}`,
            name: '新規ジョブ',
            startTime: '08:30',
            endTime: '08:30',
            progress: 0,
            machine: lanes[0] || '未割り当て',
            color: '#93c5fd',
            setupTime: '0',
            productionTime: '3600',
            isCompleted: false
        };
        setEditingJob(newJob);
    };

    // ジョブをFirestoreへ書き込む共通処理
    const doImport = useCallback(async (newJobs: Job[], displayDate: string) => {
        if (newJobs.length === 0) {
            alert('読み込み対象のジョブがありませんでした。');
            return;
        }
        const optimizedJobs = optimizeJobsList(newJobs, lanes, laneStartTimes);
        const newScheduleId = await addSchedule(displayDate, displayDate);
        if (newScheduleId) {
            const { writeBatch, doc: firestoreDoc } = await import('firebase/firestore');
            const CHUNK_SIZE = 400;
            for (let i = 0; i < optimizedJobs.length; i += CHUNK_SIZE) {
                const chunk = optimizedJobs.slice(i, i + CHUNK_SIZE);
                const batch = writeBatch(db);
                chunk.forEach(job => {
                    const { id, ...jobData } = job;
                    const sanitizedData = Object.fromEntries(
                        Object.entries(jobData).filter(([_, v]) => v !== undefined)
                    );
                    const newJobRef = firestoreDoc(collection(db, 'welding_schedules', newScheduleId, 'jobs'));
                    batch.set(newJobRef, {
                        ...sanitizedData,
                        originalDate: displayDate,
                        createdAt: new Date().toISOString()
                    });
                });
                await batch.commit();
            }
            setActiveScheduleId(newScheduleId);
        }
    }, [lanes, laneStartTimes, addSchedule]);

    const handleFileUpload = async (content: string | File, fileType: 'csv' | 'excel', uploadedFileName: string) => {
        try {
            let newJobs: Job[] = [];
            let date = '';
            if (fileType === 'csv') {
                const result = parseCSV(content as string, lanes, laneSkills, false, laneStartTimes, fixedJobs, laneBreakTimes, masterSkills, [], equipmentColors, equipmentWorkerPriority);
                newJobs = result.jobs;
                date = result.date || '';

                // フレクシェCSVの場合: 日付選択モーダルを表示
                if (result.isFlexche && result.allDates && result.allDates.length > 0) {
                    setFlexcheImportData({ jobs: newJobs, allDates: result.allDates, fileName: uploadedFileName });
                    setFlexcheSelectedDates(new Set(result.allDates.slice(0, 1)));
                    return;
                }
            } else {
                const result = await parseExcel(content as File, lanes, laneSkills, false, laneStartTimes, fixedJobs, laneBreakTimes, masterSkills, [], equipmentColors, equipmentWorkerPriority);
                newJobs = result.jobs;
                date = result.date || '';
            }
            if (newJobs.length === 0) {
                alert('ファイルからジョブデータを読み込めませんでした。ファイル形式やデータ内容（完了済み・作業時間など）を確認してください。');
                return;
            }
            const displayDate = date || uploadedFileName.replace(/\.(csv|xlsx|xls)$/i, '') || '新規スケジュール';
            await doImport(newJobs, displayDate);
        } catch (error: any) {
            console.error('File Parse Error:', error);
            alert(`ファイルの解析中にエラーが発生しました: ${error.message || '不明なエラー'}`);
        }
    };

    // フレクシェCSV: 日付確定後のインポート（日付ごとに別スケジュールとして登録）
    const handleFlexcheConfirm = async () => {
        if (!flexcheImportData) return;
        if (flexcheSelectedDates.size === 0) {
            alert('読み込む日付を1つ以上選択してください。');
            return;
        }
        const sortedSelected = [...flexcheSelectedDates].sort();
        setFlexcheImportData(null);
        try {
            for (const date of sortedSelected) {
                const jobsForDate = flexcheImportData.jobs.filter(job => job.originalDate === date);
                if (jobsForDate.length > 0) {
                    await doImport(jobsForDate, date);
                }
            }
        } catch (error: any) {
            console.error('Flexche Import Error:', error);
            alert(`インポート中にエラーが発生しました: ${error.message || '不明なエラー'}`);
        }
    };

    const handleCloseTab = (e: React.MouseEvent, scheduleId: string) => {
        e.stopPropagation();
        if (schedules.length <= 1) return;
        setDeleteConfirm({ show: true, jobIds: [], type: 'schedule', scheduleId });
    };

    const handleExportSchedule = () => {
        if (!activeScheduleId) return;
        const csvHeader = ['Job Name', 'Finished Product No', 'Component No', 'Machine', 'Start Time', 'End Time', 'Status'];
        const csvRows = jobs.filter(job => !job.isNonProduction).map(job => [job.name, job.finishedProductNumber || '', job.componentNumber || '', job.machine, job.startTime, job.endTime, job.isCompleted ? 'Completed' : 'Pending']);
        const csvContent = [csvHeader.join(','), ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const activeSchedule = schedules.find(s => s.id === activeScheduleId);
        link.setAttribute('download', `${activeSchedule?.date || 'schedule'}_export.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };



    const formatTabTitle = (title: string) => {
        if (!title) return '概要';
        // Handle YYYY/MM/DD or YYYY-MM-DD
        const fullDateMatch = title.match(/^(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})/);
        if (fullDateMatch) {
            const year = parseInt(fullDateMatch[1], 10);
            const month = parseInt(fullDateMatch[2], 10);
            const day = parseInt(fullDateMatch[3], 10);
            const date = new Date(year, month - 1, day);
            const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
            return `${month}月${day}日(${dayOfWeek})`;
        }
        // Legacy MMDD format (assume current year if no year provided)
        const match = title.match(/^(\d{2})(\d{2})/);
        if (match) {
            const month = parseInt(match[1], 10);
            const day = parseInt(match[2], 10);
            const year = new Date().getFullYear();
            const date = new Date(year, month - 1, day);
            const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
            return `${month}月${day}日(${dayOfWeek})`;
        }
        return title;
    };

    const sortedJobs = [...jobs].sort((a, b) => a.startTime.localeCompare(b.startTime));
    const visibleSchedules = [...schedules].filter(s => !s.isArchived).sort((a, b) => a.date.localeCompare(b.date));

    return (
        <div className="flex flex-col h-full bg-gray-100 overflow-hidden relative">
            {/* Header Area */}
            <div className={`flex-none px-2 pl-1 py-1 bg-white border-b border-gray-200 flex items-center justify-between shadow-sm z-10 h-10 no-print print:hidden`}>
                <div className="flex overflow-x-auto max-w-[50vw] ml-0">
                    {visibleSchedules.map(schedule => (
                        <div
                            key={schedule.id}
                            onClick={() => setActiveScheduleId(schedule.id)}
                            className={`relative group flex items-center flex-shrink-0 rounded-md mx-1 border shadow-sm overflow-hidden cursor-pointer transition-all p-1 gap-1 h-6 ${activeScheduleId === schedule.id
                                ? 'bg-indigo-600 border-indigo-600'
                                : 'bg-white border-gray-200 hover:bg-gray-50'
                                }`}
                        >
                            <span className={`text-xs font-medium transition-colors ${activeScheduleId === schedule.id
                                ? 'text-white'
                                : 'text-gray-600 group-hover:text-gray-900'
                                }`}>
                                {formatTabTitle(schedule.date)}
                            </span>
                            {isWeldingAdmin && (
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleArchive(schedule.id); }}
                                        className={`p-[1px] rounded-full transition-colors ${activeScheduleId === schedule.id
                                            ? 'text-indigo-100 hover:text-white hover:bg-white/20'
                                            : 'text-amber-400 hover:text-amber-600 hover:bg-amber-100'
                                            }`}
                                        title="アーカイブ"
                                    >
                                        <Archive size={14} />
                                    </button>
                                    <button
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleCloseTab(e, schedule.id); }}
                                        className={`p-[1px] rounded-full transition-colors ${activeScheduleId === schedule.id
                                            ? 'text-red-200 hover:text-white hover:bg-white/20'
                                            : 'text-red-500 hover:text-red-700 hover:bg-red-100'
                                            }`}
                                        title="削除"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                <div className="flex items-center space-x-2">
                    <button
                        onClick={() => setIsArchivesOpen(true)}
                        className="p-1 px-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1"
                        title="アーカイブ一覧を表示"
                    >
                        <History size={20} />
                    </button>
                    {(schedulesLoading || jobsLoading) && <span className="text-xs text-gray-400 animate-pulse">Syncing...</span>}
                </div>
            </div>

            {/* Archive List Modal */}
            {isArchivesOpen && (
                <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h3 className="text-lg font-semibold text-gray-900">アーカイブ済み</h3>
                            <button onClick={() => setIsArchivesOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                        </div>
                        <div className="p-4 overflow-y-auto flex-1">
                            {schedules.filter(s => s.isArchived).length === 0 ? <p className="text-center text-gray-500 py-8">アーカイブなし</p> : (
                                <ul className="space-y-2">
                                    {schedules.filter(s => s.isArchived).map(schedule => (
                                        <li key={schedule.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                                            <span className="font-medium text-gray-900">{schedule.date}</span>
                                            <button onClick={() => handleRestore(schedule.id)} className="flex items-center px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-md"><RefreshCw size={12} className="mr-1" />復元</button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <div className="p-4 border-t bg-gray-50 rounded-b-lg">
                            <button onClick={() => setIsArchivesOpen(false)} className="w-full px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium">閉じる</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Second Row: Machine Filter & Tools */}
            <div className={`flex-none pl-2 ${isCollapsed ? 'md:pl-[106px]' : 'pl-2'} pr-2 py-1 bg-white border-b border-gray-200 flex items-center justify-between shadow-sm z-20 no-print h-[46px] relative overflow-hidden`}>

                {/* LEFT SIDE GROUP */}
                <div className="flex items-center gap-2 flex-nowrap overflow-x-auto no-scrollbar">
                    {/* 1. View Mode Group */}
                    <div className="flex bg-gray-100 rounded-lg p-0.5">
                        <button onClick={() => setViewMode('default')} className={`p-1 rounded-md ${viewMode === 'default' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`} title="標準モード"><StandardIcon size={22} /></button>
                        <button onClick={() => setViewMode('gantt')} className={`p-1 rounded-md ${viewMode === 'gantt' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`} title="ガントモード"><GanttIcon size={22} /></button>
                        <button onClick={() => setViewMode('list')} className={`p-1 rounded-md ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`} title="リストモード"><ListIcon size={22} /></button>
                    </div>

                    {/* 2. Layout Group (1-row / 2-row) */}
                    {(viewMode === 'default' || viewMode === 'gantt') && (
                        <div className="flex items-center bg-gray-100 p-0.5 rounded-lg h-8">
                            <button
                                onClick={() => setTwoRowLayout(false)}
                                className={`px-2 h-7 flex items-center justify-center rounded-md transition-all text-sm font-bold ${!twoRowLayout ? 'bg-white shadow-sm text-indigo-600 active:scale-95' : 'text-gray-500 hover:text-gray-700 hover:bg-white/40'}`}
                                title="1行で表示する"
                            >
                                1行
                            </button>
                            <button
                                onClick={() => setTwoRowLayout(true)}
                                className={`px-2 h-7 flex items-center justify-center rounded-md transition-all text-sm font-bold ${twoRowLayout ? 'bg-white shadow-sm text-indigo-600 active:scale-95' : 'text-gray-500 hover:text-gray-700 hover:bg-white/40'}`}
                                title="2行で表示する（印刷向け）"
                            >
                                2行
                            </button>
                        </div>
                    )}



                    {/* 3. Zoom Group */}
                    {(viewMode === 'default' || viewMode === 'gantt') && (
                        <div className="flex items-center gap-2">
                            <div className="flex items-center border border-gray-200 p-1 rounded-lg h-8">
                                <span className="text-sm font-bold text-gray-700 px-1">横</span>
                                <button onClick={() => setZoomLevel(Math.max(20, zoomLevel - 5))} className="w-6 h-6 flex items-center justify-center bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md transition-all active:scale-90" title="横に縮小"><Minus size={16} strokeWidth={4} /></button>
                                <input type="range" min="20" max="200" step="5" value={zoomLevel} onChange={(e) => setZoomLevel(Number(e.target.value))} className="w-12 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" title="横方向のスケール調整" />
                                <button onClick={() => setZoomLevel(Math.min(200, zoomLevel + 5))} className="w-6 h-6 flex items-center justify-center bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md transition-all active:scale-90" title="横に拡大"><Plus size={16} strokeWidth={4} /></button>
                            </div>

                            <div className="flex items-center border border-gray-200 p-1 rounded-lg h-8">
                                <span className="text-sm font-bold text-gray-700 px-1">縦</span>
                                <button onClick={() => setLaneHeight(Math.max(30, laneHeight - 5))} className="w-6 h-6 flex items-center justify-center bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md transition-all active:scale-90" title="縦に縮小"><Minus size={16} strokeWidth={4} /></button>
                                <input type="range" min="30" max="120" step="5" value={laneHeight} onChange={(e) => setLaneHeight(Number(e.target.value))} className="w-12 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-600" title="縦方向 feathered のスケール調整" />
                                <button onClick={() => setLaneHeight(Math.min(120, laneHeight + 5))} className="w-6 h-6 flex items-center justify-center bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md transition-all active:scale-90" title="縦に拡大"><Plus size={16} strokeWidth={4} /></button>
                            </div>
                        </div>
                    )}

                    {/* 5. History Button */}
                    {onNavigateToHistory && (
                        <button
                            onClick={onNavigateToHistory}
                            className="p-1 px-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1 border border-transparent"
                            title="全ジョブ一覧"
                        >
                            <History size={22} />
                            <span className="text-xs font-medium">一覧</span>
                        </button>
                    )}

                    {/* 6. Admin Tools (Optimize, Upload, Undo, Add) */}

                    {isWeldingAdmin && (
                        <button onClick={() => handleOptimize('all')} className="p-1 px-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1 border border-transparent" title="AIによる工程順序の最適化">
                            <Sparkles size={22} />
                            <span className="text-xs font-medium">最適化</span>
                        </button>
                    )}
                    {isWeldingAdmin && (
                        <button onClick={handleCreateNewJob} className="p-1 px-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1 border border-transparent" title="新規ジョブ追加">
                            <Plus size={22} />
                            <span className="text-xs font-medium">追加</span>
                        </button>
                    )}



                    {isWeldingAdmin && <FileUploader onFileUpload={handleFileUpload} />}
                </div>

                {/* RIGHT SIDE GROUP (Export, Picking, Print) */}
                <div className="flex items-center gap-2">
                    {isWeldingAdmin && (
                        <button onClick={handleExportSchedule} className="p-1 px-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1 border border-transparent" title="CSVエクスポート">
                            <FileOutput size={22} />
                        </button>
                    )}
                    <button onClick={() => setIsPickingListOpen(true)} className="p-1 px-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors flex items-center gap-1 border border-transparent" title="ピッキングリストを表示">
                        <ClipboardList size={22} />
                    </button>

                    {isWeldingAdmin && (
                        <button onClick={() => setIsSettingsOpen(true)} className="p-1 px-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1 border border-transparent" title="レイアウト設定">
                            <Settings size={22} />
                        </button>
                    )}
                </div>

            </div>

            {/* Print Only Styles */}
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    @page {
                        size: A3 landscape;
                        margin: 10mm 15mm;
                    }
                    body {
                        -webkit-print-color-adjust: exact !important;
                        background: white !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        width: 100% !important;
                    }
                    /* Hide scrollbars in print */
                    * {
                        scrollbar-width: none !important;
                        -ms-overflow-style: none !important;
                    }
                    ::-webkit-scrollbar {
                        display: none !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                    /* Container for the scaled chart */
                    .gantt-scroll-container {
                        overflow: hidden !important;
                        height: auto !important;
                        margin-left: auto !important;
                        margin-right: auto !important;
                        transform-origin: top center !important;
                    }
                    .gantt-grid-container {
                        /* This is updated via JS during beforeprint */
                        /* transform: translateX(var(--print-gantt-offset, 0px)) !important; */
                    }
                    .welding-page-container {
                        display: block !important;
                        height: auto !important;
                        overflow: visible !important;
                        padding-left: 0 !important;
                        padding-right: 0 !important;
                    }
                    /* Ink saving: White background for specific areas */
                    .print-bg-white {
                        background-color: white !important;
                        background-image: none !important;
                    }
                }
            ` }} />

            {/* Print Only Header - Simple text on blank background */}
            <div className="hidden print:block mb-4">
                <h1 className="text-3xl font-bold border-none bg-none p-0">溶接ライン製造スケジュール - {activeScheduleId ? formatTabTitle(schedules.find(s => s.id === activeScheduleId)?.date || '') : ''}</h1>
            </div>

            {/* Content Area */}
            {
                (viewMode === 'default' || viewMode === 'gantt') && (
                    <div className={`pl-2 ${isCollapsed ? 'md:pl-2' : 'pl-2'} pr-2 flex-1 flex flex-col welding-page-container ${viewMode === 'gantt' ? 'h-full' : 'max-h-[50vh] border-b border-gray-200 print:max-h-none print:h-auto print:border-none'}`}>
                        <div ref={ganttContainerRef} className="flex-1 min-h-0 gantt-scroll-container">
                            <WeldingGanttChart
                                jobs={jobs.filter(j => !j.isPickingListOnly)}
                                visibleMachines={getVisibleMachines()}
                                onJobUpdate={handleJobUpdate}
                                onJobClick={handleJobClick}
                                onJobDelete={handleJobDelete}
                                pixelsPerTenMinutes={zoomLevel}
                                laneStartTimes={laneStartTimes}
                                laneColors={laneColors}
                                laneBreakTimes={laneBreakTimes}
                                isAdmin={isWeldingAdmin}
                                showMaterialList={false}
                                isWeldingLine={true}
                                jobBarDisplayMode={jobBarDisplayMode}
                                jobBarCustomFields={jobBarCustomFields}
                                twoRowLayout={twoRowLayout}
                                masterSkills={masterSkills}
                                laneSkills={laneSkills}
                                equipmentColors={equipmentColors}
                                jobBarTextColor={jobBarTextColor}
                                setupTimeColor={setupTimeColor}
                                laneHeight={laneHeight}
                                onMoveJobsToLane={handleMoveJobsToLane}
                                onSwapJobsOrder={handleSwapJobsOrder}
                                schedules={visibleSchedules.map(s => ({ id: s.id, date: s.date }))}
                                currentScheduleId={activeScheduleId}
                                currentScheduleDate={visibleSchedules.find(s => s.id === activeScheduleId)?.date}
                                onMoveJobsToSchedule={handleMoveJobsToSchedule}
                                onCopyJobs={handleCopyJobs}
                                onPasteJobs={handlePasteJobs}
                                onSplitJob={handleSplitJob}
                                fixedJobNames={fixedJobs.map(fj => fj.name)}
                                nonProductionCategories={nonProductionCategories}
                                onAddJob={addJob}
                            />
                        </div>

                        {/* 設備カラー凡例 - スクロールバーの下に常に表示 */}
                        {Object.keys(equipmentColors).length > 0 && (
                            <div className="flex-none mt-2 p-3 bg-white rounded-lg shadow-sm border border-gray-200 no-print print:hidden">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-bold text-gray-600 mr-2">カラー凡例:</span>
                                    {Object.entries(equipmentColors).map(([key, color]) => (
                                        <div key={key} className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-gray-50 border border-gray-200">
                                            <div
                                                className="w-4 h-4 rounded-full shadow-sm border border-white"
                                                style={{ backgroundColor: color }}
                                            />
                                            <span className="text-xs font-medium text-gray-700">{key}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )
            }

            {
                (viewMode === 'default' || viewMode === 'list') && (
                    <div className={`pl-2 ${isCollapsed ? 'md:pl-2' : 'pl-2'} pr-2 py-2 bg-gray-100 border-t border-gray-200 flex-1 min-h-0 overflow-hidden no-print print:hidden`}>
                        {activeScheduleId && (
                            <JobList
                                jobs={sortedJobs}
                                date=""
                                onJobUpdate={handleJobUpdate}
                                onJobClick={handleJobClick}
                                onJobDelete={handleJobDelete}
                                onMoveJobUp={handleMoveJobUp}
                                onMoveJobDown={handleMoveJobDown}
                                schedules={schedules.map(s => ({ id: s.id, date: s.date }))}
                                activeScheduleId={activeScheduleId}
                                onMoveJobToSchedule={handleMoveJobToSchedule}
                                isFullHeight={true}
                                selectedMachine={selectedMachine}
                                visibleMachines={lanes}
                                onSelectMachine={setSelectedMachine}
                                isAdmin={isWeldingAdmin}
                            />
                        )}
                    </div>
                )
            }

            {
                editingJob && (
                    <EditJobModal
                        job={editingJob}
                        isOpen={!!editingJob}
                        onClose={() => setEditingJob(null)}
                        onSave={handleJobSave}
                        isAdmin={isWeldingAdmin}
                        isFixedJob={fixedJobs.some(fj => fj.name === editingJob.name)}
                    />
                )
            }

            <WeldingLaneSettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                currentLanes={lanes}
                currentSkills={laneSkills}
                currentStartTimes={laneStartTimes}
                currentLaneColors={laneColors}
                currentMasterSkills={masterSkills}
                currentFixedJobs={fixedJobs}
                currentBreakTimes={laneBreakTimes}
                currentJobBarCustomFields={jobBarCustomFields}
                currentEquipmentColors={equipmentColors}
                currentJobBarTextColor={jobBarTextColor}
                currentEquipmentWorkerPriority={equipmentWorkerPriority}
                currentSetupTimeColor={setupTimeColor}
                currentNonProductionCategories={nonProductionCategories}
                onSaveNonProductionCategories={updateNonProductionCategories}
                onSave={async (newLanes, newSkills, newStartTimes, newColors, newMasterSkills, oldLanes, newFixedJobs, newBreakTimes, newJobBarCustomFields, _newProcessColors, newEquipmentColors, newJobBarTextColor, newEquipmentWorkerPriority, newSetupTimeColor) => {
                    await updateSettings(newLanes, newSkills, newStartTimes, newColors, newMasterSkills, newFixedJobs, newBreakTimes, undefined, newEquipmentColors, newJobBarTextColor, newEquipmentWorkerPriority, newSetupTimeColor, newJobBarCustomFields, jobBarDisplayMode);

                    // 担当者名が変更された場合、既存ジョブの machine フィールドを一括更新
                    const renames: Record<string, string> = {};
                    oldLanes.forEach((oldName, index) => {
                        if (index < newLanes.length && oldName !== newLanes[index]) {
                            renames[oldName] = newLanes[index];
                        }
                    });

                    if (Object.keys(renames).length > 0) {
                        try {
                            const { writeBatch, collection: fbCollection, getDocs, doc: fbDoc } = await import('firebase/firestore');

                            for (const schedule of schedules) {
                                const jobsSnapshot = await getDocs(fbCollection(db, 'welding_schedules', schedule.id, 'jobs'));
                                const jobsToRename = jobsSnapshot.docs.filter(d => renames[d.data().machine]);

                                if (jobsToRename.length > 0) {
                                    const CHUNK_SIZE = 400;
                                    for (let i = 0; i < jobsToRename.length; i += CHUNK_SIZE) {
                                        const chunk = jobsToRename.slice(i, i + CHUNK_SIZE);
                                        const batch = writeBatch(db);
                                        chunk.forEach(jobDoc => {
                                            const oldMachine = jobDoc.data().machine;
                                            batch.update(fbDoc(db, 'welding_schedules', schedule.id, 'jobs', jobDoc.id), {
                                                machine: renames[oldMachine]
                                            });
                                        });
                                        await batch.commit();
                                    }
                                }
                            }
                            console.log('[WeldingPage] Lane renames applied:', renames);
                        } catch (error) {
                            console.error('[WeldingPage] Failed to rename jobs:', error);
                            alert('担当者名の変更をジョブに反映できませんでした。');
                        }
                    }

                    setIsSettingsOpen(false);
                }}
                machineLabel="溶接ライン設定"
                showFixedJobs={true}
                showProcessColors={false}
                showEquipmentColors={true}
            />

            {/* フレクシェCSV: 日付選択モーダル */}
            {flexcheImportData && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[10000]">
                    <div className="bg-white rounded-xl p-6 w-80 shadow-2xl">
                        <h3 className="text-base font-bold text-gray-800 mb-3">読み込む日付を選択</h3>
                        <div className="space-y-2 mb-5 max-h-64 overflow-y-auto">
                            {flexcheImportData.allDates.map(date => (
                                <label key={date} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50">
                                    <input
                                        type="checkbox"
                                        checked={flexcheSelectedDates.has(date)}
                                        onChange={e => {
                                            setFlexcheSelectedDates(prev => {
                                                const next = new Set(prev);
                                                if (e.target.checked) next.add(date);
                                                else next.delete(date);
                                                return next;
                                            });
                                        }}
                                        className="w-4 h-4 accent-indigo-600"
                                    />
                                    <span className="text-sm text-gray-700">{date}</span>
                                </label>
                            ))}
                        </div>
                        <div className="flex gap-2 justify-end">
                            <button
                                onClick={() => setFlexcheImportData(null)}
                                className="px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={handleFlexcheConfirm}
                                disabled={flexcheSelectedDates.size === 0}
                                className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                読み込む ({flexcheSelectedDates.size}日)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {
                archiveConfirm.show && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[10000] p-4">
                        <div className="bg-white p-8 rounded-lg max-w-md w-full shadow-2xl">
                            <h3 className="text-xl font-bold mb-4">アーカイブへの移動</h3>
                            <p className="mb-6">「{archiveConfirm.date}」をアーカイブに移動しますか？</p>
                            <div className="flex justify-end gap-3">
                                <button onClick={() => setArchiveConfirm({ show: false, scheduleId: null, date: '' })} className="px-5 py-2.5 bg-gray-100 rounded-lg font-medium">キャンセル</button>
                                <button onClick={executeArchive} className="px-5 py-2.5 bg-amber-500 text-white rounded-lg font-medium">アーカイブする</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {
                deleteConfirm.show && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[10000] p-4">
                        <div className="bg-gray-300 p-8 border-2 border-gray-400 rounded-lg max-w-md w-full shadow-2xl">
                            <h3 className="text-xl font-bold mb-4">削除の確認</h3>
                            <p className="mb-6">{deleteConfirm.type === 'job' ? (deleteConfirm.jobIds.length > 1 ? `${deleteConfirm.jobIds.length}件のジョブを削除してもよろしいですか？` : 'このジョブを削除してもよろしいですか？') : 'このタブを削除してもよろしいですか？'}</p>
                            <div className="flex justify-end gap-3">
                                <button onClick={cancelDelete} className="px-5 py-2.5 bg-white border border-gray-400 rounded-lg font-medium">キャンセル</button>
                                <button onClick={confirmDelete} className="px-5 py-2.5 bg-red-600 text-white rounded-lg font-medium">削除</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {
                moveConfirm.show && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[10000] p-4">
                        <div className="bg-white p-8 rounded-lg max-w-md w-full shadow-2xl">
                            <h3 className="text-xl font-bold mb-4">移動の確認</h3>
                            <div className="mb-6">
                                <p className="text-gray-700 mb-2">
                                    「{moveConfirm.jobName}」
                                    {moveConfirm.jobIds.length > 1 && `など${moveConfirm.jobIds.length}件`}
                                </p>
                                <p className="text-lg font-bold text-indigo-600">
                                    【{schedules.find(s => s.id === moveConfirm.targetScheduleId) ? formatTabTitle(schedules.find(s => s.id === moveConfirm.targetScheduleId)!.date) : '別の日'}】
                                </p>
                                <p className="text-gray-700 mt-2">へ移動してもよろしいですか？</p>
                            </div>
                            <div className="flex justify-end gap-3">
                                <button onClick={() => setMoveConfirm({ show: false, jobIds: [], targetScheduleId: null, jobName: '' })} className="px-5 py-2.5 bg-gray-100 rounded-lg font-medium">キャンセル</button>
                                <button onClick={executeMoveJob} className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-medium">移動する</button>
                            </div>
                        </div>
                    </div>
                )
            }




            {/* Picking List Modal */}
            <PickingList
                jobs={jobs}
                scheduleDate={activeScheduleId ? schedules.find(s => s.id === activeScheduleId)?.date || '' : ''}
                isOpen={isPickingListOpen}
                onClose={() => setIsPickingListOpen(false)}
                isWeldingLine={true}
                fixedJobNames={fixedJobs.map(fj => fj.name)}
            />
        </div >
    );
}
