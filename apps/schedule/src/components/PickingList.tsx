import { useMemo, useState } from 'react';
import { Printer, X, CheckSquare, Square, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import type { Job } from '../types/job';
import type { JigMapData } from '../types/jigMap';
import { JigMap } from './JigMap';
import { INITIAL_JIG_MAP_DATA } from '../data/initialJigMapData';
import { useAdminMode } from '../context/AdminModeContext';

interface PickingListProps {
    jobs: Job[];
    scheduleDate: string;
    isOpen: boolean;
    onClose: () => void;
    isWeldingLine?: boolean;
    fixedJobNames?: string[];
}

type SortKey = 'index' | 'machine' | 'finishedProductNumber' | 'jobName' | 'checked' | 'jigLocation' | 'jigAddress' | 'quantity';
type SortDirection = 'asc' | 'desc';

export function PickingList({ jobs, scheduleDate, isOpen, onClose, isWeldingLine = false, fixedJobNames = [] }: PickingListProps) {
    const { isAdmin } = useAdminMode();
    const editable = isWeldingLine ? isAdmin('welding') : isAdmin('sheetMetal');

    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
        key: 'jigAddress',
        direction: 'asc'
    });

    // State for Checklist
    const [checkedJobIds, setCheckedJobIds] = useState<Set<string>>(() => {
        const saved = localStorage.getItem('mfg_checkedJobIds');
        return saved ? new Set(JSON.parse(saved)) : new Set();
    });

    // State for Jig Map
    const [jigMapData, setJigMapData] = useState<JigMapData>(() => {
        const saved = localStorage.getItem('mfg_jigMapData');
        return saved ? JSON.parse(saved) : INITIAL_JIG_MAP_DATA;
    });
    const [hoveredAddress, setHoveredAddress] = useState<string | null>(null);

    // Sort jobs
    const sortedJobs = useMemo(() => {
        const sortableJobs = jobs.filter(job =>
            job.changeInstruction !== '追加' && !fixedJobNames.includes(job.name) && !job.isNonProduction && !!job.operationCode
        );
        const { key, direction } = sortConfig;

        return sortableJobs.sort((a, b) => {
            let valA: any;
            let valB: any;

            switch (key) {
                case 'machine':
                    valA = a.machine || '';
                    valB = b.machine || '';
                    break;
                case 'finishedProductNumber':
                    valA = a.finishedProductNumber || '';
                    valB = b.finishedProductNumber || '';
                    break;
                case 'jobName':
                    valA = a.componentOfficialName || '';
                    valB = b.componentOfficialName || '';
                    break;
                case 'checked':
                    valA = checkedJobIds.has(a.id) ? 1 : 0;
                    valB = checkedJobIds.has(b.id) ? 1 : 0;
                    break;
                case 'jigLocation':
                    valA = a.jigLocation || '\uffff';
                    valB = b.jigLocation || '\uffff';
                    break;
                case 'jigAddress': {
                    const addrA = a.jigAddress || '\uffff';
                    const addrB = b.jigAddress || '\uffff';
                    if (addrA !== addrB) return direction === 'asc' ? addrA.localeCompare(addrB) : addrB.localeCompare(addrA);
                    const fpA = a.finishedProductNumber || '\uffff';
                    const fpB = b.finishedProductNumber || '\uffff';
                    if (fpA !== fpB) return fpA.localeCompare(fpB);
                    return a.startTime.localeCompare(b.startTime);
                }
                case 'quantity':
                    valA = parseInt(a.dailyQuantity || '0', 10);
                    valB = parseInt(b.dailyQuantity || '0', 10);
                    break;
                default:
                    if (a.machine !== b.machine) {
                        return a.machine.localeCompare(b.machine);
                    }
                    return a.startTime.localeCompare(b.startTime);
            }

            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            
            if (a.machine !== b.machine) {
                return a.machine.localeCompare(b.machine);
            }
            return a.startTime.localeCompare(b.startTime);
        });
    }, [jobs, sortConfig, checkedJobIds]);

    const PRODUCT_COLORS = ['#ffffff', '#dbeafe'];

    const productColorMap = useMemo(() => {
        const map = new Map<string, string>(); // job.id → color
        let groupIndex = 0;
        let lastKey = '';
        for (const job of sortedJobs) {
            const key = job.finishedProductNumber || job.id;
            if (key !== lastKey) { groupIndex++; lastKey = key; }
            map.set(job.id, PRODUCT_COLORS[groupIndex % PRODUCT_COLORS.length]);
        }
        return map;
    }, [sortedJobs]);

    type MergeInfo = { rowspan: number; groupIds: string[] } | null;
    const mergeMap = useMemo(() => {
        const result: MergeInfo[] = new Array(sortedJobs.length).fill(undefined);
        for (let i = 0; i < sortedJobs.length; i++) {
            if (result[i] !== undefined) continue;
            const job = sortedJobs[i];
            const key = `${job.finishedProductNumber || ''}|${job.jigAddress || ''}|${job.jigLocation || ''}`;
            const hasValues = job.finishedProductNumber || job.jigAddress || job.jigLocation;
            if (!hasValues) { result[i] = { rowspan: 1, groupIds: [job.id] }; continue; }
            const groupIds = [job.id];
            let j = i + 1;
            while (j < sortedJobs.length) {
                const next = sortedJobs[j];
                const nextKey = `${next.finishedProductNumber || ''}|${next.jigAddress || ''}|${next.jigLocation || ''}`;
                if (nextKey === key) { groupIds.push(next.id); result[j] = null; j++; }
                else break;
            }
            result[i] = { rowspan: groupIds.length, groupIds };
        }
        return result;
    }, [sortedJobs]);

    const handleSort = (key: SortKey) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
        if (sortConfig.key !== columnKey) return <ArrowUpDown size={12} className="text-gray-500 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />;
        return sortConfig.direction === 'asc' 
            ? <ArrowUp size={12} className="text-indigo-400 ml-1" /> 
            : <ArrowDown size={12} className="text-indigo-400 ml-1" />;
    };

    const getFormattedDate = (dateStr: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        const y = date.getFullYear();
        const m = date.getMonth() + 1;
        const d = date.getDate();
        return `${y}年${m}月${d}日`;
    };

    const formattedDate = useMemo(() => getFormattedDate(scheduleDate), [scheduleDate]);

    const handleSaveMapData = (newData: JigMapData) => {
        setJigMapData(newData);
        localStorage.setItem('mfg_jigMapData', JSON.stringify(newData));
    };

    const activeAddresses = useMemo(() => {
        return Array.from(new Set(sortedJobs.map(j => j.jigAddress).filter(Boolean))) as string[];
    }, [sortedJobs]);

    const handlePrint = () => {
        const fullDateStr = getFormattedDate(scheduleDate);
        const totalCount = sortedJobs.length;

        const rowsHtml = sortedJobs.map((job, index) => {
            const merge = mergeMap[index];
            const allChecked = merge ? merge.groupIds.every(id => checkedJobIds.has(id)) : checkedJobIds.has(job.id);
            const hasJigAddr = activeAddresses.includes(job.jigAddress || '');
            const rowBg = productColorMap.get(job.id) ?? '#f9fafb';
            const tdStyle = `background:${rowBg};`;
            const mergedCells = merge !== null ? `
              <td rowspan="${merge.rowspan}" style="${tdStyle}text-align:center;">${allChecked ? '☑' : '☐'}</td>
              <td rowspan="${merge.rowspan}" style="${tdStyle}">${job.jigLocation || 'ー'}</td>
              <td rowspan="${merge.rowspan}" style="${tdStyle}font-family:monospace;font-weight:bold;color:${hasJigAddr ? '#2563eb' : '#888'};">${job.jigAddress || 'ー'}</td>` : '';
            return `
            <tr>
              <td style="${tdStyle}text-align:center;color:#666;">${index + 1}</td>
              <td style="${tdStyle}">${job.machine || ''}</td>
              <td style="${tdStyle}">${job.finishedProductNumber || 'ー'}</td>
              <td style="${tdStyle}">${job.componentOfficialName || 'ー'}</td>
              ${mergedCells}
              <td style="${tdStyle}text-align:center;">${job.dailyQuantity || '0'}/${job.totalQuantity || '0'}</td>
            </tr>`;
        }).join('');

        const MAP_W = 500;
        const MAP_H = 625;
        const NAVY = '#1e2a4a';
        const BEIGE = '#f5f0e0';
        const HIGHLIGHT = '#22c55e';
        const ACTIVE_OUTLINE = '#ef4444';

        const jigLocations = jigMapData.locations;
        const toX = (pct: number) => (pct / 100) * MAP_W;
        const toY = (pct: number) => (pct / 100) * MAP_H;

        const svgItems = jigLocations.map(loc => {
            const x = toX(loc.x);
            const y = toY(loc.y);
            const w = toX(loc.width);
            const h = toY(loc.height);
            const isAisle = loc.type === 'aisle' || loc.type === 'label';
            const isHighlighted = activeAddresses.includes(loc.address);
            const isActive = loc.address === hoveredAddress;

            if (isAisle) {
                const fontSize = loc.fontSize ? loc.fontSize * 0.85 : 11;
                return `<text x="${x + w/2}" y="${y + h/2}" text-anchor="middle" dominant-baseline="middle" font-size="${fontSize}" fill="#374151" font-weight="bold">${loc.address.replace(/\n/g, ' ')}</text>`;
            }

            const bgColor = isHighlighted ? HIGHLIGHT : (loc.backgroundColor || NAVY);
            const textColor = (bgColor === BEIGE || bgColor === '#e8e0cc') ? '#1f2937' : '#ffffff';
            const strokeColor = isActive ? ACTIVE_OUTLINE : 'none';
            const strokeWidth = isActive ? 2 : 0;
            const fontSize = Math.min(w / (loc.address.length * 0.7 + 0.5), h * 0.55, 13);
            const lines = loc.address.split('\n');
            const lineHeight = h / (lines.length + 0.5);

            const textLines = lines.map((line, i) => {
                const yPos = y + lineHeight * (i + 1) - lineHeight * 0.15;
                return `<text x="${x + w/2}" y="${yPos}" text-anchor="middle" dominant-baseline="middle" font-size="${Math.max(7, fontSize)}" fill="${textColor}" font-weight="bold">${line}</text>`;
            }).join('');

            return `
              <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${bgColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
              ${textLines}`;
        }).join('\n');

        const svgHtml = `
          <svg xmlns="http://www.w3.org/2000/svg" width="${MAP_W}" height="${MAP_H}" viewBox="0 0 ${MAP_W} ${MAP_H}" style="width:100%;height:auto;aspect-ratio:4/5;background:#f3f4f6;border-radius:6px;">
            ${svgItems}
          </svg>`;

        const legendHtml = `
          <div style="display:flex;gap:12px;margin-top:6px;font-size:10pt;flex-wrap:wrap;">
            <div style="display:flex;align-items:center;gap:4px;"><div style="width:16px;height:16px;background:#22c55e;border-radius:3px;"></div> 必要治具番地</div>
          </div>`;

        const htmlContent = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <style>
    @page { size: A3 landscape; margin: 5mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Hiragino Sans', 'Meiryo', 'Yu Gothic', sans-serif;
      font-size: 10pt; background: white; color: #111;
      width: 410mm; height: 287mm; overflow: hidden;
    }
    .page-wrapper { display: flex; flex-direction: column; width: 100%; height: 100%; padding: 2mm; }
    .page-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 0 0 2mm 0; border-bottom: 2px solid #111; margin-bottom: 3mm; height: 10mm;
    }
    .page-header h1 { font-size: 16pt; font-weight: bold; }
    .page-header .meta { font-size: 10pt; color: #444; }
    .content-row { display: flex; gap: 5mm; height: 250mm; align-items: flex-start; } /* 上寄せに設定 */
    .table-panel { flex: 0 0 72%; height: 250mm; overflow: hidden; break-inside: avoid; }
    .map-panel {
      flex: 0 0 25%;
      display: flex;
      flex-direction: column;
      break-inside: avoid;
    }
    .map-title {
      font-size: 11pt;
      font-weight: bold;
      margin-bottom: 1mm;
      color: #333;
    }
    .map-container {
      border: 1px solid #d1d5db;
      background: #f3f4f6;
      overflow: hidden;
      height: auto; /* 高さを内容に合わせる */
    }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    thead tr { background: #111; color: white; height: 5.5mm; }
    th { border: 1px solid #444; padding: 0 1.5mm; font-size: 8.5pt; font-weight: bold; text-align: left; }
    tr { height: 4.85mm; break-inside: avoid; }
    td {
      border: 1px solid #d1d5db; padding: 0 1.5mm; font-size: 11pt;
      vertical-align: middle; white-space: nowrap; overflow: hidden; line-height: 1;
    }
    .col-num  { width: 10mm; text-align: center; }
    .col-machine { width: 15mm; }
    .col-product { width: 90mm; text-align: left; overflow: hidden; text-overflow: clip; white-space: nowrap; }
    .col-jobname { width: 90mm; text-align: left; overflow: hidden; text-overflow: clip; white-space: nowrap; }
    .col-check { width: 10mm; text-align: center; }
    .col-location { width: 16mm; }
    .col-address { width: 16mm; font-family: monospace; font-weight: bold; }
    .col-qty { width: 22mm; text-align: center; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page-wrapper { break-inside: avoid; overflow: hidden; }
    }
  </style>
</head>
<body>
  <div class="page-wrapper">
    <div class="page-header">
      <h1>${fullDateStr} 生産予定</h1>
      <div class="meta">合計: <strong>${totalCount}</strong> 件　　印刷日時: ${new Date().toLocaleString('ja-JP')}</div>
    </div>
    <div class="content-row">
      <div class="table-panel">
        <table style="height: 100%;">
          <thead>
            <tr>
              <th class="col-num"></th>
              <th class="col-machine">担当者</th>
              <th class="col-product">完成品番</th>
              <th class="col-jobname">工程名</th>
              <th class="col-check"></th>
              <th class="col-location">治具場所</th>
              <th class="col-address">治具番地</th>
              <th class="col-qty">数量</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
      <div class="map-panel">
        <div class="map-title">🗺️ 治具マップ</div>
        <div class="map-container">
          ${svgHtml}
        </div>
        ${legendHtml}
      </div>
    </div>
  </div>
</body>
</html>`;

        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow?.document;
        if (doc) {
            doc.open();
            doc.write(htmlContent);
            doc.close();

            iframe.contentWindow?.focus();
            setTimeout(() => {
                iframe.contentWindow?.print();
                setTimeout(() => {
                    document.body.removeChild(iframe);
                }, 500);
            }, 500);
        }
    };

    const toggleJobCheck = (jobId: string) => {
        setCheckedJobIds(prev => {
            const next = new Set(prev);
            if (next.has(jobId)) {
                next.delete(jobId);
            } else {
                next.add(jobId);
            }
            localStorage.setItem('mfg_checkedJobIds', JSON.stringify(Array.from(next)));
            return next;
        });
    };

    const toggleGroupCheck = (groupIds: string[]) => {
        setCheckedJobIds(prev => {
            const next = new Set(prev);
            const allChecked = groupIds.every(id => next.has(id));
            if (allChecked) {
                groupIds.forEach(id => next.delete(id));
            } else {
                groupIds.forEach(id => next.add(id));
            }
            localStorage.setItem('mfg_checkedJobIds', JSON.stringify(Array.from(next)));
            return next;
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-[10000] flex items-center justify-center p-2 sm:p-4 picking-list-modal">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-[95vw] h-[90vh] flex flex-col picking-list-container overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b bg-indigo-600 flex-none no-print">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        {formattedDate} 生産予定
                    </h2>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-1.5 px-4 py-2 bg-white text-indigo-600 rounded-lg font-bold hover:bg-indigo-50 transition-colors shadow-sm"
                        >
                            <Printer size={16} />
                            印刷
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="flex flex-1 min-h-0">
                    <div className="flex-[2] overflow-auto p-2 border-r border-gray-200 picking-list-content flex flex-col min-w-[400px]">
                        <table className="w-full border-collapse picking-list-table sticky-header-table table-fixed">
                            <thead className="sticky top-0 z-10 shadow-sm">
                                <tr className="bg-gray-900">
                                    <th className="border border-gray-800 px-1 py-0.5 text-left text-[12px] font-bold text-white w-10 sticky top-0 bg-gray-900 cursor-pointer group hover:bg-gray-800 transition-colors" onClick={() => handleSort('index')}>
                                        <div className="flex items-center"><SortIcon columnKey="index" /></div>
                                    </th>
                                    <th className="border border-gray-800 px-1 py-0.5 text-left text-[12px] font-bold text-white w-16 sticky top-0 bg-gray-900 cursor-pointer group hover:bg-gray-800 transition-colors" onClick={() => handleSort('machine')}>
                                        <div className="flex items-center">担当者<SortIcon columnKey="machine" /></div>
                                    </th>
                                    <th className="border border-gray-800 px-1 py-0.5 text-left text-[12px] font-bold text-white w-[240px] sticky top-0 bg-gray-900 cursor-pointer group hover:bg-gray-800 transition-colors" onClick={() => handleSort('finishedProductNumber')}>
                                        <div className="flex items-center">完成品番<SortIcon columnKey="finishedProductNumber" /></div>
                                    </th>
                                    <th className="border border-gray-800 px-1 py-0.5 text-left text-[12px] font-bold text-white w-[240px] sticky top-0 bg-gray-900 cursor-pointer group hover:bg-gray-800 transition-colors" onClick={() => handleSort('jobName')}>
                                        <div className="flex items-center">工程名<SortIcon columnKey="jobName" /></div>
                                    </th>
                                    <th className="border border-gray-800 px-1 py-0.5 text-center text-[12px] font-bold text-white w-10 no-print sticky top-0 bg-gray-900 cursor-pointer group hover:bg-gray-800 transition-colors" onClick={() => handleSort('checked')}>
                                        <div className="flex items-center justify-center"><SortIcon columnKey="checked" /></div>
                                    </th>
                                    <th className="border border-gray-800 px-1 py-0.5 text-left text-[12px] font-bold text-white w-20 sticky top-0 bg-gray-900 cursor-pointer group hover:bg-gray-800 transition-colors" onClick={() => handleSort('jigLocation')}>
                                        <div className="flex items-center">治具場所<SortIcon columnKey="jigLocation" /></div>
                                    </th>
                                    <th className="border border-gray-800 px-1 py-0.5 text-left text-[12px] font-bold text-white w-20 sticky top-0 bg-gray-900 cursor-pointer group hover:bg-gray-800 transition-colors" onClick={() => handleSort('jigAddress')}>
                                        <div className="flex items-center">治具番地<SortIcon columnKey="jigAddress" /></div>
                                    </th>
                                    <th className="border border-gray-800 px-1 py-0.5 text-center text-[12px] font-bold text-white w-16 sticky top-0 bg-gray-900 cursor-pointer group hover:bg-gray-800 transition-colors" onClick={() => handleSort('quantity')}>
                                        <div className="flex items-center justify-center">数量<SortIcon columnKey="quantity" /></div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedJobs.map((job, index) => {
                                    const merge = mergeMap[index];
                                    return (
                                    <tr
                                        key={job.id}
                                        style={{ backgroundColor: hoveredAddress === job.jigAddress ? '#bae6fd' : (productColorMap.get(job.id) ?? '#f9fafb') }}
                                        className={`hover:!bg-sky-200 transition-colors cursor-pointer`}
                                        onMouseEnter={() => setHoveredAddress(job.jigAddress || null)}
                                        onMouseLeave={() => setHoveredAddress(null)}
                                    >
                                        <td className="border border-gray-300 px-1 py-0.5 text-[11px] text-gray-500 text-center">
                                            {index + 1}
                                        </td>
                                        <td className="border border-gray-300 px-1 py-0.5 text-[11px] font-medium text-gray-700">
                                            {job.machine}
                                        </td>
                                        <td className="border border-gray-300 px-1 py-0.5 text-[11px] text-gray-800 text-left overflow-hidden whitespace-nowrap">
                                            {job.finishedProductNumber || 'ー'}
                                        </td>
                                        <td className="border border-gray-300 px-1 py-0.5 text-[11px] text-gray-800 text-left overflow-hidden whitespace-nowrap">
                                            {job.componentOfficialName || 'ー'}
                                        </td>
                                        {merge !== null && (
                                            <td
                                                rowSpan={merge.rowspan}
                                                className="border border-gray-300 px-1 py-0.5 text-center no-print cursor-pointer hover:bg-gray-100 transition-colors"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    merge.rowspan > 1 ? toggleGroupCheck(merge.groupIds) : toggleJobCheck(job.id);
                                                }}
                                            >
                                                <div className="flex items-center justify-center">
                                                    {merge.groupIds.every(id => checkedJobIds.has(id)) ? (
                                                        <CheckSquare size={16} className="text-green-600" />
                                                    ) : (
                                                        <Square size={16} className="text-gray-300" />
                                                    )}
                                                </div>
                                            </td>
                                        )}
                                        {merge !== null && (
                                            <td rowSpan={merge.rowspan} className="border border-gray-300 px-1 py-0.5 text-[11px] text-gray-700">
                                                {job.jigLocation || 'ー'}
                                            </td>
                                        )}
                                        {merge !== null && (
                                            <td rowSpan={merge.rowspan} className={`border border-gray-300 px-1 py-0.5 text-[11px] font-mono font-bold ${activeAddresses.includes(job.jigAddress || '') ? 'text-blue-600' : 'text-gray-400'}`}>
                                                {job.jigAddress || 'ー'}
                                            </td>
                                        )}
                                        <td className="border border-gray-300 px-1 py-0.5 text-[11px] text-center font-medium">
                                            <span className="text-indigo-700">{job.dailyQuantity || '0'}</span>
                                            <span className="text-gray-400">/</span>
                                            <span className="text-gray-600">{job.totalQuantity || '0'}</span>
                                        </td>
                                    </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex-1 min-w-[300px] p-2 bg-gray-100 flex flex-col no-print">
                        <div className="flex-1 min-h-0 bg-white rounded-lg shadow-inner overflow-hidden">
                            <JigMap
                                data={jigMapData}
                                activeAddress={hoveredAddress}
                                highlightedAddresses={activeAddresses}
                                onSave={handleSaveMapData}
                                editable={editable}
                            />
                        </div>
                        {/* Legend in the UI Modal */}
                        <div className="p-3 bg-white border-t border-gray-200 mt-2 rounded-lg flex items-center gap-4">
                            <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
                                <span className="w-4 h-4 bg-[#22c55e] rounded-sm inline-block shadow-sm"></span> 必要治具番地
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-3 border-t bg-gray-50 flex-none no-print">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">
                            合計: {sortedJobs.length} 件
                        </span>
                        <div className="text-xs text-gray-400">
                            {editable ? '※ 地図の編集は右側の「編集」ボタンから行えます（画像クリックでピン追加）' : '※ 地図の編集は管理者モード時のみ行えます'}
                        </div>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                        >
                            閉じる
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
