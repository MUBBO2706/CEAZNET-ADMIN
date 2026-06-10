import React, { useState } from 'react';
import { PanelCard, CopyButton } from '../ui';
import { ArrowLeft, CheckCircle, Copy, FileCode, Database, Diff } from 'lucide-react';

const JsonToggleCard: React.FC<{
    title: string;
    data: any;
    structuredRenderer: (data: any) => React.ReactNode;
}> = ({ title, data, structuredRenderer }) => {
    const [viewMode, setViewMode] = useState<'structured' | 'raw'>('structured');
    const rawJsonString = JSON.stringify(data, null, 2);

    return (
        <div className="pt-1">
            <div className="flex justify-between items-center mb-3">
                <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider font-bold flex items-center gap-2 opacity-70">
                    <Diff size={12} /> {title}
                </div>
                <div className="flex bg-[var(--subtle-bg)] rounded-sm p-0.5 border border-[var(--border-color)]/60 shrink-0">
                    <button 
                        onClick={(e) => { e.stopPropagation(); setViewMode('structured'); }}
                        className={`px-3 py-1 text-[10px] sm:text-[11px] rounded-[3px] transition-all duration-200 ${viewMode === 'structured' ? 'bg-[var(--success)] text-white shadow-sm font-bold' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                        Structured
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); setViewMode('raw'); }}
                        className={`px-3 py-1 text-[10px] sm:text-[11px] rounded-[3px] transition-all duration-200 ${viewMode === 'raw' ? 'bg-[var(--success)] text-white shadow-sm font-bold' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                        Raw
                    </button>
                </div>
            </div>

            <div className="relative group">
                 {viewMode === 'raw' && <CopyButton textToCopy={rawJsonString} />}
                <div className="">
                    {viewMode === 'structured' ? (
                        structuredRenderer(data)
                    ) : (
                        <pre className="p-3 bg-[var(--subtle-bg)]/30 border border-[var(--subtle-border)] rounded-lg font-mono text-[10px] sm:text-[11px] text-emerald-600 dark:text-emerald-400 overflow-x-auto whitespace-pre-wrap word-break">
                            {rawJsonString}
                        </pre>
                    )}
                </div>
            </div>
        </div>
    );
};

const ExpandableValue: React.FC<{ valueStr: string, className?: string, prefix?: string }> = ({ valueStr, className = "", prefix = "" }) => {
    const [expanded, setExpanded] = useState(false);
    const isLong = valueStr.length > 150;

    return (
        <div className="flex flex-col items-start gap-1 w-full relative">
             <div className={`${!expanded ? 'line-clamp-3 break-all' : 'whitespace-pre-wrap break-all'} overflow-hidden transition-all duration-200 max-w-full ${className}`}>
                {prefix}{valueStr}
             </div>
             {isLong && (
                 <button 
                     onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                     className="text-[10px] text-indigo-500 hover:text-indigo-600 font-semibold select-none flex items-center gap-1"
                 >
                     {expanded ? 'Show less' : 'Click to expand'}
                 </button>
             )}
        </div>
    );
};

const renderDiffData = (oldData: any, newData: any) => {
    if (!oldData && !newData) return <span className="text-[var(--text-secondary)] italic text-xs">No data available</span>;
    
    // If it's just an insert (no old data) or delete (no new data), render normally
    if (!oldData || !newData) {
        const dataToRender = newData || oldData;
        const isDelete = !newData;
        
        return (
            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2 w-full`}>
                {Object.entries(dataToRender).map(([key, value]) => {
                    const valueStr = typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value);
                    const textColor = isDelete ? 'text-red-500 dark:text-red-400' : 'text-green-500 dark:text-green-400';
                    return (
                        <div key={key} className={`flex flex-col border-l-2 pl-3 py-1 ${isDelete ? 'border-red-500/30' : 'border-green-500/30'}`}>
                            <span className="text-[var(--text-secondary)] text-[9px] uppercase tracking-wider mb-1 font-bold opacity-60">{key}</span>
                            <div className="text-[11px] font-mono">
                                <ExpandableValue valueStr={valueStr} className={textColor} />
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    // It's an update, compare keys
    const allKeys = Array.from(new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]));
    
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
            {allKeys.map(key => {
                const oldVal = oldData?.[key];
                const newVal = newData?.[key];
                const isAdded = oldVal === undefined && newVal !== undefined;
                const isRemoved = oldVal !== undefined && newVal === undefined;
                
                const oldValStr = typeof oldVal === 'object' ? JSON.stringify(oldVal) : String(oldVal);
                const newValStr = typeof newVal === 'object' ? JSON.stringify(newVal) : String(newVal);
                
                const isModified = oldVal !== undefined && newVal !== undefined && oldValStr !== newValStr;
                const isUnchanged = oldVal !== undefined && newVal !== undefined && oldValStr === newValStr;

                let borderClass = 'border-[var(--subtle-border)]';
                if (isAdded) borderClass = 'border-green-500/40';
                if (isRemoved) borderClass = 'border-red-500/40';
                if (isModified) borderClass = 'border-yellow-500/40';

                return (
                    <div key={key} className={`flex flex-col border-l-2 pl-3 py-1 ${borderClass}`}>
                        <span className="text-[var(--text-secondary)] text-[9px] uppercase tracking-wider mb-1 font-bold opacity-60">{key}</span>
                        <div className="text-[11px] font-mono flex flex-col gap-1 w-full min-w-0">
                            {isUnchanged && <ExpandableValue valueStr={newValStr} className="text-[var(--text-primary)]" />}
                            {isAdded && <ExpandableValue valueStr={newValStr} className="text-green-500 dark:text-green-400 bg-green-500/10 px-1 rounded w-fit" prefix="+" />}
                            {isRemoved && <ExpandableValue valueStr={oldValStr} className="text-red-500 dark:text-red-400 line-through bg-red-500/10 px-1 rounded w-fit" prefix="-" />}
                            {isModified && (
                                <>
                                    <ExpandableValue valueStr={oldValStr} className="text-red-500 dark:text-red-400 line-through bg-red-500/10 px-1 rounded w-fit" prefix="-" />
                                    <ExpandableValue valueStr={newValStr} className="text-green-500 dark:text-green-400 bg-green-500/10 px-1 rounded w-fit mt-1" prefix="+" />
                                </>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const ActivityLogViewer: React.FC<{ row: any; onBack: () => void }> = ({ row, onBack }) => {
    const action = row.operation || row.action_type || 'UNKNOWN';
    const eventDetails = {
        ...(row.old_data ? { old_data: row.old_data } : {}),
        ...(row.new_data ? { new_data: row.new_data?.payload || row.new_data } : {}),
        ...(action === 'DELETE' && !row.old_data && !row.new_data ? { data: 'All data deleted (Truncate)' } : {})
    };

    return (
        <div className="animate-fade-in-up space-y-4">
            <div className="flex items-center gap-3">
                <button onClick={onBack} className="btn btn-secondary px-2 py-1 flex items-center gap-1 text-xs">
                    <ArrowLeft size={14} />
                    <span>Back</span>
                </button>
                <h3 className="text-base font-bold text-[var(--text-primary)] truncate">
                    Log Details: <span className="font-mono text-xs">activity_logs</span>
                </h3>
            </div>

            <div className="grid grid-cols-1 gap-6 items-start pt-2">
                <div>
                    <h3 className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider font-bold mb-3 flex items-center gap-2 opacity-70">
                        <Database size={12} /> Metadata
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="col-span-2 sm:col-span-1">
                            <p className="text-[10px] text-[var(--text-secondary)] uppercase mb-0.5">ID</p>
                            <p className="text-[11px] sm:text-xs font-mono truncate text-[var(--text-primary)]" title={row.id}>{row.id}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-[var(--text-secondary)] uppercase mb-0.5">Table</p>
                            <p className="text-[11px] sm:text-xs font-mono text-emerald-500 truncate">{row.table_name}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-[var(--text-secondary)] uppercase mb-0.5">Action</p>
                            <p className="text-[11px] sm:text-xs font-mono text-blue-500">{action}</p>
                        </div>
                        <div className="hidden sm:block">
                            <p className="text-[10px] text-[var(--text-secondary)] uppercase mb-0.5">Source</p>
                            <p className="text-[11px] sm:text-xs font-mono text-purple-500 truncate">{row.source || row.new_data?.source || 'Database Trigger'}</p>
                        </div>
                        <div className="col-span-2 sm:col-span-4 mt-1">
                            <p className="text-[10px] text-[var(--text-secondary)] uppercase mb-0.5">Description</p>
                            <p className="text-[11px] sm:text-xs text-[var(--text-primary)]">{row.description || row.new_data?.description || `${action} operation on ${row.table_name}`}</p>
                        </div>
                    </div>
                </div>

                <div className="border-t border-[var(--border-color)] pt-3">
                    <JsonToggleCard
                        title="Event Details (Diff)"
                        data={eventDetails}
                        structuredRenderer={(data) => renderDiffData(data.old_data, data.new_data)}
                    />
                </div>
            </div>
        </div>
    );
};

export default ActivityLogViewer;
