import React, { useRef, useEffect, useState } from 'react';
import { PanelCard, timeAgo, CustomDropdown } from '../ui';
import type { NewsLog } from '../../types';
import { ChevronRight, Trash2, CheckSquare, Square, Terminal } from 'lucide-react';

const ExpandedSummary: React.FC<{ log: NewsLog, onShowDetails: (id: number) => void }> = ({ log, onShowDetails }) => {
    const articlesUpdated = log.summary?.find(s => s.includes('Total Articles Updated'))?.split(': ')[1] || '0';
    const errors = log.summary?.find(s => s.includes('Errors'))?.split(': ')[1] || '0';
    const duration = (log.duration_ms / 1000).toFixed(2);

    return (
        <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-[var(--subtle-bg)] border-t border-[var(--border-color)]">
            <div className="grid grid-cols-4 gap-2 mb-2.5 divide-x divide-[var(--border-color)]">
                <div className="flex flex-col items-center text-center">
                    <div className="text-[9px] text-[var(--text-secondary)] uppercase tracking-wider font-bold mb-0.5">Duration</div>
                    <div className="text-xs font-mono font-bold text-[var(--text-primary)]">{duration}s</div>
                </div>
                <div className="flex flex-col items-center text-center pl-2">
                    <div className="text-[9px] text-[var(--text-secondary)] uppercase tracking-wider font-bold mb-0.5">Articles</div>
                    <div className="text-xs font-mono font-bold text-indigo-500">{articlesUpdated}</div>
                </div>
                <div className="flex flex-col items-center text-center pl-2">
                    <div className="text-[9px] text-[var(--text-secondary)] uppercase tracking-wider font-bold mb-0.5">Errors</div>
                    <div className="text-xs font-mono font-bold text-red-500">{errors}</div>
                </div>
                <div className="flex flex-col items-center text-center pl-2">
                    <div className="text-[9px] text-[var(--text-secondary)] uppercase tracking-wider font-bold mb-0.5">Status</div>
                    <div className={`text-xs font-mono font-bold uppercase tracking-wider ${log.status === 'SUCCESS' ? 'text-emerald-500' : 'text-red-500'}`}>{log.status}</div>
                </div>
            </div>
            <div className="flex justify-end pt-1">
                <button 
                    onClick={(e) => { e.stopPropagation(); onShowDetails(log.id); }}
                    className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] sm:text-[11px] font-semibold rounded-[3px] transition-colors shadow-sm"
                >
                    <Terminal size={11} />
                    View Full Logs
                </button>
            </div>
        </div>
    );
};

const NewsLogs: React.FC<{ 
    logs: NewsLog[], 
    isLoading?: boolean,
    onShowDetails: (id: number) => void, 
    onDelete: (id: number) => void,
    isSelectionMode: boolean,
    selectedLogs: Set<number>,
    onStartSelection: (id: number) => void,
    onToggleSelection: (id: number) => void,
    onSelectAll: () => void,
    isScrolled?: boolean
}> = ({ 
    logs, 
    isLoading = false,
    onShowDetails, 
    onDelete, 
    isSelectionMode, 
    selectedLogs, 
    onStartSelection, 
    onToggleSelection,
    onSelectAll,
    isScrolled = false
}) => {
    const pressTimer = useRef<number | null>(null);
    const startY = useRef<number | null>(null);
    const selectAllCheckboxRef = useRef<HTMLInputElement>(null);
    const headerRef = useRef<HTMLDivElement>(null);
    const [visibleCount, setVisibleCount] = useState(30);
    const [expandedLog, setExpandedLog] = useState<number | null>(null);
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');

    const filteredAndSortedLogs = React.useMemo(() => {
        let result = [...logs];
        
        if (statusFilter !== 'ALL') {
            result = result.filter(log => log.status === statusFilter);
        }

        result.sort((a, b) => {
            const dateA = new Date(a.created_at).getTime();
            const dateB = new Date(b.created_at).getTime();
            return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
        });

        return result;
    }, [logs, sortOrder, statusFilter]);

    const handleRowScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (headerRef.current) {
            headerRef.current.scrollLeft = e.currentTarget.scrollLeft;
        }
    };

    const handlePointerDown = (e: React.PointerEvent, logId: number) => {
        if (isSelectionMode) return;
        startY.current = e.clientY;
        pressTimer.current = window.setTimeout(() => {
            onStartSelection(logId);
            pressTimer.current = null;
        }, 600);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (pressTimer.current && startY.current !== null) {
            if (Math.abs(e.clientY - startY.current) > 10) {
                clearTimeout(pressTimer.current);
                pressTimer.current = null;
            }
        }
    };

    const handlePointerUp = () => {
        if (pressTimer.current) {
            clearTimeout(pressTimer.current);
            pressTimer.current = null;
        }
        startY.current = null;
    };

    const handleRowClick = (logId: number) => {
        if (pressTimer.current) {
            clearTimeout(pressTimer.current);
            pressTimer.current = null;
        }
        if (isSelectionMode) {
            onToggleSelection(logId);
        } else {
            setExpandedLog(expandedLog === logId ? null : logId);
        }
    };

    useEffect(() => {
        if (selectAllCheckboxRef.current) {
            const isPartiallySelected = selectedLogs.size > 0 && selectedLogs.size < logs.length;
            selectAllCheckboxRef.current.indeterminate = isPartiallySelected;
        }
    }, [selectedLogs, logs.length]);

    const isAllSelected = logs.length > 0 && selectedLogs.size === logs.length;
    
    const visibleLogs = filteredAndSortedLogs.slice(0, visibleCount);

    return (
        <div className="flex flex-col overflow-hidden border-t border-[var(--border-color)] border-b-0 border-x-0 bg-[var(--card-bg)] text-[var(--text-primary)] font-sans mx-[-12px] sm:mx-[-16px] lg:mx-[-24px] rounded-none">
            <div className="py-2.5 sm:py-3 px-3 sm:px-4 border-b border-[var(--border-color)] flex items-center justify-between gap-4">
                <button 
                    onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                    className="text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1"
                >
                    Sort by Date: {sortOrder === 'desc' ? 'Newest' : 'Oldest'}
                </button>
                <div className="w-fit">
                    <CustomDropdown 
                        value={statusFilter}
                        onChange={setStatusFilter}
                        options={['ALL', 'SUCCESS', 'FAILURE', 'ERROR', 'WARNING']}
                        displayLabels={{
                            'ALL': 'All Statuses',
                            'SUCCESS': 'Success',
                            'FAILURE': 'Failure',
                            'ERROR': 'Error',
                            'WARNING': 'Warning'
                        }}
                        triggerClassName="!border-0 !bg-transparent !p-0 !outline-none !shadow-none focus:!ring-0 font-semibold text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors gap-1"
                    />
                </div>
            </div>
            <div className="flex flex-col">
                {/* Header Row */}
                <div 
                    ref={headerRef}
                    className={`bg-[var(--card-bg)] flex items-center py-2 sm:py-2.5 px-3 sm:px-4 pr-16 sm:pr-20 border-b border-[var(--border-color)] overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]`}
                >
                    {isSelectionMode && (
                        <div className="shrink-0 flex justify-center mr-2 min-w-[20px]">
                            <input
                                ref={selectAllCheckboxRef}
                                type="checkbox"
                                className="h-3.5 w-3.5 rounded border-gray-400 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                checked={isAllSelected}
                                onChange={onSelectAll}
                                aria-label="Select all logs"
                            />
                        </div>
                    )}
                    <div className="w-24 sm:w-28 shrink-0 pr-2 text-xs font-sans font-bold text-[var(--text-secondary)] whitespace-nowrap">Date</div>
                    <div className="w-20 sm:w-24 shrink-0 px-1 text-xs font-sans font-bold text-[var(--text-secondary)] whitespace-nowrap">Time</div>
                    <div className="w-20 shrink-0 px-1 text-xs font-sans font-bold text-[var(--text-secondary)] whitespace-nowrap text-center">Status</div>
                    <div className="w-16 sm:w-20 shrink-0 px-1 text-xs font-sans font-bold text-[var(--text-secondary)] whitespace-nowrap text-center">Duration</div>
                    <div className="w-24 sm:w-28 shrink-0 px-1 text-xs font-sans font-bold text-[var(--text-secondary)] whitespace-nowrap text-center">Articles Updated</div>
                    <div className="w-14 shrink-0 px-1 text-xs font-sans font-bold text-[var(--text-secondary)] whitespace-nowrap text-center">Delete</div>
                </div>
                
                {/* Data Rows */}
                <div className="flex flex-col">
                    {isLoading ? (
                        Array.from({ length: 5 }).map((_, idx) => (
                            <div key={idx} className="flex items-center py-2.5 px-3 sm:px-4 pr-16 sm:pr-20 border-b border-[var(--border-color)] animate-pulse">
                                {isSelectionMode && (
                                    <div className="shrink-0 flex justify-center mr-2 min-w-[20px]">
                                        <div className="h-3.5 w-3.5 bg-slate-200 dark:bg-zinc-800 rounded"></div>
                                    </div>
                                )}
                                <div className="w-24 sm:w-28 shrink-0 pr-2">
                                    <div className="h-3.5 bg-slate-200 dark:bg-zinc-800 rounded w-2/3"></div>
                                </div>
                                <div className="w-20 sm:w-24 shrink-0 px-1">
                                    <div className="h-3.5 bg-slate-200 dark:bg-zinc-800 rounded w-1/2"></div>
                                </div>
                                <div className="w-20 shrink-0 px-1 flex justify-center">
                                    <div className="h-4 bg-slate-200 dark:bg-zinc-800 rounded-full w-14"></div>
                                </div>
                                <div className="w-16 sm:w-20 shrink-0 px-1 flex justify-center">
                                    <div className="h-3.5 bg-slate-200 dark:bg-zinc-800 rounded w-1/2"></div>
                                </div>
                                <div className="w-24 sm:w-28 shrink-0 px-1 flex justify-center">
                                    <div className="h-3.5 bg-slate-200 dark:bg-zinc-800 rounded w-8"></div>
                                </div>
                                <div className="w-14 shrink-0 px-1 flex justify-center">
                                    <div className="h-5 bg-slate-200 dark:bg-zinc-800 rounded w-5"></div>
                                </div>
                            </div>
                        ))
                    ) : visibleLogs.length > 0 ? (
                        visibleLogs.map(log => {
                            const isSelected = selectedLogs.has(log.id);
                            const isExpanded = expandedLog === log.id;
                            const isSuccess = log.status === 'SUCCESS';
                            const isFailure = log.status === 'FAILURE' || log.status === 'ERROR';
                            const isWarn = log.status === 'WARNING' || log.status === 'WARN';
                            
                            const dateObj = new Date(log.created_at);
                            const dateStr = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                            
                            const maskFromClass = isExpanded 
                                ? 'from-[var(--subtle-bg)]' 
                                : isSelected 
                                    ? 'from-indigo-50 dark:from-indigo-900/40 group-hover:from-[var(--subtle-bg)]' 
                                    : 'from-[var(--card-bg)] group-hover:from-[var(--subtle-bg)]';
                            
                            return (
                                <div 
                                    key={log.id} 
                                    className={`flex flex-col border-b border-[var(--border-color)] last:border-b-0 group ${isSelected ? 'bg-indigo-50/50 dark:bg-indigo-900/20' : ''}`}
                                >
                                    <div className="relative">
                                        <div 
                                            className={`flex items-center py-2 sm:py-2.5 px-3 sm:px-4 pr-16 sm:pr-20 hover:bg-[var(--subtle-bg)] transition-colors cursor-pointer select-none overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] ${isExpanded ? 'bg-[var(--subtle-bg)]' : ''}`}
                                            onClick={() => handleRowClick(log.id)}
                                            onPointerDown={(e) => handlePointerDown(e, log.id)}
                                            onPointerMove={handlePointerMove}
                                            onPointerUp={handlePointerUp}
                                            onPointerLeave={handlePointerUp}
                                            onScroll={handleRowScroll}
                                        >
                                            {isSelectionMode && (
                                                <div className="shrink-0 flex justify-center mr-2 min-w-[20px]">
                                                    <button 
                                                        className="p-0.5"
                                                        aria-label={isSelected ? 'Deselect log' : 'Select log'}
                                                    >
                                                        {isSelected ? <CheckSquare size={15} className="text-indigo-600" /> : <Square size={15} className="text-slate-400" />}
                                                    </button>
                                                </div>
                                            )}
                                            
                                            <div className="w-24 sm:w-28 shrink-0 pr-2 font-sans text-xs text-[var(--text-primary)] truncate">
                                                {dateStr}
                                            </div>
                                            
                                            <div className="w-20 sm:w-24 shrink-0 px-1 font-sans text-xs text-[var(--text-secondary)] truncate">
                                                {timeAgo(log.created_at)}
                                            </div>
                                            
                                            <div className="w-20 shrink-0 px-1 flex justify-center items-center">
                                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold tracking-wide transition-colors ${
                                                    isSuccess ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300' : 
                                                    isFailure ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300' : 
                                                    isWarn ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300' :
                                                    'bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300'
                                                }`}>
                                                    <span className={`w-1 h-1 rounded-full ${
                                                        isSuccess ? 'bg-emerald-500' : 
                                                        isFailure ? 'bg-rose-500' : 
                                                        isWarn ? 'bg-amber-500' :
                                                        'bg-blue-500'
                                                    }`} />
                                                    {log.status}
                                                </span>
                                            </div>
                                            
                                            <div className="w-16 sm:w-20 shrink-0 px-1 font-sans text-xs text-[var(--text-secondary)] text-center truncate">
                                                {(log.duration_ms / 1000).toFixed(2)}s
                                            </div>
                                            
                                            <div className="w-24 sm:w-28 shrink-0 px-1 font-sans text-xs text-[var(--text-primary)] font-medium text-center truncate">
                                                {log.summary?.find(s => s.includes('Total Articles Updated'))?.split(': ')[1] || '0'}
                                            </div>
                                            
                                            <div className="w-14 shrink-0 px-1 flex items-center justify-center">
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        onDelete(log.id);
                                                    }}
                                                    className="text-red-500 hover:text-red-700 transition-all p-1 rounded-[3px] hover:bg-red-100 dark:hover:bg-red-900/30"
                                                    data-tooltip="Delete Log"
                                                    aria-label="Delete log"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </div>
                                        
                                        <div className={`absolute right-0 top-0 bottom-0 flex justify-end items-center w-16 bg-gradient-to-l from-40% to-transparent transition-colors pr-3 pointer-events-none z-10 ${maskFromClass}`}>
                                            <ChevronRight size={14} className={`text-[var(--text-secondary)] opacity-70 transition-transform duration-300 ${isExpanded ? 'rotate-90' : 'group-hover:translate-x-0.5'}`} />
                                        </div>
                                    </div>
                                    
                                    {isExpanded && <ExpandedSummary log={log} onShowDetails={onShowDetails} />}
                                </div>
                            );
                        })
                    ) : (
                        <div className="text-center py-12 text-slate-400 font-medium text-sm flex flex-col items-center justify-center gap-1">
                            <span>No logs found.</span>
                            <span className="text-xs text-slate-400 dark:text-zinc-500 font-normal">Try selecting another filter or run a manual update.</span>
                        </div>
                    )}
                </div>
                
                {/* Footer / Load More */}
                <div className="py-2.5 sm:py-3 px-3 sm:px-4 border-t border-[var(--border-color)] flex items-center justify-between bg-[var(--card-bg)] rounded-b-lg">
                    <div>
                        {visibleCount < logs.length && (
                            <button 
                                onClick={() => setVisibleCount(prev => prev + 30)}
                                className="btn btn-secondary px-2.5 py-1 text-xs"
                            >
                                Load Older
                            </button>
                        )}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)]">
                        Showing <span className="font-medium text-[var(--text-primary)]">{Math.min(visibleCount, filteredAndSortedLogs.length)}</span> of <span className="font-medium text-[var(--text-primary)]">{filteredAndSortedLogs.length}</span> results
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NewsLogs;