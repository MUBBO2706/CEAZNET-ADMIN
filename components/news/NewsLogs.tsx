import React, { useRef, useEffect, useState } from 'react';
import { PanelCard, timeAgo, CustomDropdown } from '../ui';
import type { NewsLog } from '../../types';
import { ChevronRight, Trash2, CheckSquare, Square, Terminal } from 'lucide-react';

const ExpandedSummary: React.FC<{ log: NewsLog, onShowDetails: (id: number) => void }> = ({ log, onShowDetails }) => {
    const articlesUpdated = log.summary?.find(s => s.includes('Total Articles Updated'))?.split(': ')[1] || '0';
    const errors = log.summary?.find(s => s.includes('Errors'))?.split(': ')[1] || '0';
    const duration = (log.duration_ms / 1000).toFixed(2);

    return (
        <div className="px-4 py-4 bg-[var(--subtle-bg)] border-t border-[var(--border-color)]">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                <div className="bg-[var(--card-bg)] p-3 rounded-lg border border-[var(--border-color)]">
                    <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold mb-1">Duration</div>
                    <div className="text-sm font-mono text-[var(--text-primary)]">{duration}s</div>
                </div>
                <div className="bg-[var(--card-bg)] p-3 rounded-lg border border-[var(--border-color)]">
                    <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold mb-1">Articles</div>
                    <div className="text-sm font-mono text-indigo-500">{articlesUpdated}</div>
                </div>
                <div className="bg-[var(--card-bg)] p-3 rounded-lg border border-[var(--border-color)]">
                    <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold mb-1">Errors</div>
                    <div className="text-sm font-mono text-red-500">{errors}</div>
                </div>
                <div className="bg-[var(--card-bg)] p-3 rounded-lg border border-[var(--border-color)]">
                    <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold mb-1">Status</div>
                    <div className={`text-sm font-mono ${log.status === 'SUCCESS' ? 'text-emerald-500' : 'text-red-500'}`}>{log.status}</div>
                </div>
            </div>
            <div className="flex justify-end">
                <button 
                    onClick={(e) => { e.stopPropagation(); onShowDetails(log.id); }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-md transition-colors shadow-sm"
                >
                    <Terminal size={14} />
                    View Full Logs
                </button>
            </div>
        </div>
    );
};

const NewsLogs: React.FC<{ 
    logs: NewsLog[], 
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
        <PanelCard className="!p-0 flex flex-col [clip-path:inset(0_round_0.5rem)]">
            <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between gap-4">
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
                    />
                </div>
            </div>
            <div className="flex flex-col">
                {/* Header Row */}
                <div 
                    ref={headerRef}
                    className={`sticky z-20 bg-[var(--card-bg)] flex items-center px-4 pr-24 border-b border-[var(--border-color)] overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] transition-all duration-300 top-[50px] py-3`}
                >
                    {isSelectionMode && (
                        <div className="shrink-0 flex justify-center mr-3 min-w-[24px]">
                            <input
                                ref={selectAllCheckboxRef}
                                type="checkbox"
                                className="h-4 w-4 rounded border-gray-400 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                checked={isAllSelected}
                                onChange={onSelectAll}
                                aria-label="Select all logs"
                            />
                        </div>
                    )}
                    <div className="flex-1 min-w-[120px] text-xs font-sans font-bold text-[var(--text-secondary)] whitespace-nowrap">Date</div>
                    <div className="flex-1 min-w-[150px] text-xs font-sans font-bold text-[var(--text-secondary)] whitespace-nowrap">Time</div>
                    <div className="flex-1 min-w-[150px] text-xs font-sans font-bold text-[var(--text-secondary)] whitespace-nowrap">Status</div>
                    <div className="flex-1 min-w-[120px] text-xs font-sans font-bold text-[var(--text-secondary)] whitespace-nowrap">Duration</div>
                    <div className="flex-1 min-w-[140px] text-xs font-sans font-bold text-[var(--text-secondary)] whitespace-nowrap text-center">Articles Updated</div>
                    <div className="flex-1 min-w-[80px] text-xs font-sans font-bold text-[var(--text-secondary)] whitespace-nowrap text-center">Delete</div>
                </div>
                
                {/* Data Rows */}
                <div className="flex flex-col">
                    {visibleLogs.length > 0 ? (
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
                                            className={`flex items-center py-4 px-4 pr-24 hover:bg-[var(--subtle-bg)] transition-colors cursor-pointer select-none overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] ${isExpanded ? 'bg-[var(--subtle-bg)]' : ''}`}
                                            onClick={() => handleRowClick(log.id)}
                                            onPointerDown={(e) => handlePointerDown(e, log.id)}
                                            onPointerMove={handlePointerMove}
                                            onPointerUp={handlePointerUp}
                                            onPointerLeave={handlePointerUp}
                                            onScroll={handleRowScroll}
                                        >
                                            {isSelectionMode && (
                                                <div className="shrink-0 flex justify-center mr-3 min-w-[24px]">
                                                    <button 
                                                        className="p-1"
                                                        aria-label={isSelected ? 'Deselect log' : 'Select log'}
                                                    >
                                                        {isSelected ? <CheckSquare size={18} className="text-indigo-600" /> : <Square size={18} className="text-slate-400" />}
                                                    </button>
                                                </div>
                                            )}
                                            
                                            <div className="flex-1 min-w-[120px] font-sans text-sm text-[var(--text-primary)] whitespace-nowrap">
                                                {dateStr}
                                            </div>
                                            
                                            <div className="flex-1 min-w-[150px] font-sans text-sm text-[var(--text-primary)] whitespace-nowrap">
                                                {timeAgo(log.created_at)}
                                            </div>
                                            
                                            <div className="flex-1 min-w-[150px] flex items-center whitespace-nowrap">
                                                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider ${
                                                    isSuccess ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 
                                                    isFailure ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : 
                                                    isWarn ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                                                    'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                                }`}>
                                                    <div className={`w-1.5 h-1.5 rounded-full ${
                                                        isSuccess ? 'bg-emerald-500' : 
                                                        isFailure ? 'bg-red-500' : 
                                                        isWarn ? 'bg-amber-500' :
                                                        'bg-blue-500'
                                                    }`}></div>
                                                    {log.status}
                                                </div>
                                            </div>
                                            
                                            <div className="flex-1 min-w-[120px] font-sans text-sm text-[var(--text-primary)] whitespace-nowrap">
                                                {(log.duration_ms / 1000).toFixed(2)} s
                                            </div>
                                            
                                            <div className="flex-1 min-w-[140px] font-sans text-sm text-[var(--text-primary)] whitespace-nowrap text-center">
                                                {log.summary?.find(s => s.includes('Total Articles Updated'))?.split(': ')[1] || '0'}
                                            </div>
                                            
                                            <div className="flex-1 min-w-[80px] flex items-center justify-center whitespace-nowrap">
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        onDelete(log.id);
                                                    }}
                                                    className="text-red-500 hover:text-red-700 transition-all p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30"
                                                    data-tooltip="Delete Log"
                                                    aria-label="Delete log"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                        
                                        <div className={`absolute right-0 top-0 bottom-0 flex justify-end items-center w-24 bg-gradient-to-l from-40% to-transparent transition-colors pr-4 pointer-events-none z-10 ${maskFromClass}`}>
                                            <ChevronRight size={16} className={`text-[var(--text-secondary)] opacity-70 transition-transform duration-300 ${isExpanded ? 'rotate-90' : 'group-hover:translate-x-1'}`} />
                                        </div>
                                    </div>
                                    
                                    {isExpanded && <ExpandedSummary log={log} onShowDetails={onShowDetails} />}
                                </div>
                            );
                        })
                    ) : (
                        <div className="text-center py-10 text-slate-500">
                            No logs found.
                        </div>
                    )}
                </div>
                
                {/* Footer / Load More */}
                <div className="p-3 px-4 border-t border-[var(--border-color)] flex items-center justify-between bg-[var(--card-bg)] rounded-b-lg">
                    <div>
                        {visibleCount < logs.length && (
                            <button 
                                onClick={() => setVisibleCount(prev => prev + 30)}
                                className="btn btn-secondary px-3 py-1.5 text-xs"
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
        </PanelCard>
    );
};

export default NewsLogs;