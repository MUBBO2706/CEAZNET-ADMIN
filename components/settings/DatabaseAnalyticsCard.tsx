



import React, { useState, useEffect, useCallback } from 'react';
import { PanelCard, timeAgo, InfoPopover } from '../ui';
import { fetchDatabaseAnalytics, fetchEdgeFunctionStats } from '../../services/supabaseService';
import type { DatabaseAnalyticsStats, EdgeFunctionStats } from '../../types';
import { Database, Activity, ArrowUp, ArrowDown, RefreshCw, Server, Zap, CheckCircle, AlertTriangle, Clock, Layers } from 'lucide-react';
import { LoadingSpinner } from '../skeletons';
import { useAutoRefresh } from '../AutoRefreshContext';

const StatItem = ({ label, value, icon, colorClass, bgClass }: { label: string, value: number, icon: React.ReactNode, colorClass: string, bgClass: string }) => (
    <div className={`flex flex-col p-3 sm:p-4 rounded-xl border border-[var(--border-color)] shadow-sm relative overflow-hidden group transition-all duration-300 hover:shadow-md ${bgClass}`}>
        <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
            {React.cloneElement(icon as React.ReactElement<any>, { size: 64 })}
        </div>
        <div className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider mb-1 ${colorClass}`}>
            {icon} {label}
        </div>
        <span className="text-xl sm:text-2xl font-black font-mono text-[var(--text-primary)] tracking-tight relative z-10">
            {value.toLocaleString()}
        </span>
    </div>
);

const CompactTableActivity: React.FC<{ dbData: DatabaseAnalyticsStats[] }> = ({ dbData }) => {
    const [expandedRow, setExpandedRow] = useState<string | null>(null);
    const headerRef = React.useRef<HTMLDivElement>(null);

    const handleRowScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (headerRef.current) {
            headerRef.current.scrollLeft = e.currentTarget.scrollLeft;
        }
    };

    return (
        <div className="flex flex-col w-full">
            {/* Header Row */}
            <div 
                ref={headerRef}
                className="flex items-center py-3 bg-[var(--subtle-bg)] dark:bg-black border-b border-[var(--border-color)] overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] text-[10px] sm:text-xs uppercase tracking-wider font-bold text-[var(--text-secondary)]"
            >
                <div className="w-32 sm:w-48 shrink-0 pr-3 pl-3 sm:pl-4">Table Name</div>
                <div className="w-20 shrink-0 px-2 text-right">Rows</div>
                <div className="w-20 shrink-0 px-2 text-right">Inserts</div>
                <div className="w-20 shrink-0 px-2 text-right">Updates</div>
                <div className="w-20 shrink-0 px-2 text-right">Deletes</div>
                <div className="w-28 sm:w-36 shrink-0 px-2 text-center whitespace-nowrap">Activity Mix</div>
            </div>
            
            {/* Data Rows */}
            {dbData.map((table) => {
                const totalActivity = table.total_inserts + table.total_updates + table.total_deletes;
                const insertPercent = totalActivity > 0 ? (table.total_inserts / totalActivity) * 100 : 0;
                const updatePercent = totalActivity > 0 ? (table.total_updates / totalActivity) * 100 : 0;
                const deletePercent = totalActivity > 0 ? (table.total_deletes / totalActivity) * 100 : 0;
                const isExpanded = expandedRow === table.table_name;

                return (
                    <div key={table.table_name} className="flex flex-col border-b border-[var(--border-color)] last:border-b-0">
                        <div 
                            onClick={() => setExpandedRow(isExpanded ? null : table.table_name)}
                            onScroll={handleRowScroll}
                            className="flex items-center py-5 hover:bg-[var(--subtle-bg)] dark:hover:bg-[#111] transition-colors group overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] text-sm cursor-pointer"
                        >
                            <div className="w-32 sm:w-48 shrink-0 pr-3 pl-3 sm:pl-4 font-mono font-bold text-[var(--text-primary)] flex items-center gap-2 truncate">
                                <Layers size={16} className="text-indigo-400 group-hover:text-indigo-500 transition-colors shrink-0" />
                                <span className="truncate">{table.table_name}</span>
                            </div>
                            <div className="w-20 shrink-0 px-2 text-right font-mono text-[var(--text-secondary)]">{(table.live_rows ?? 0).toLocaleString()}</div>
                            <div className="w-20 shrink-0 px-2 text-right font-mono text-emerald-600 dark:text-emerald-400">{(table.total_inserts ?? 0).toLocaleString()}</div>
                            <div className="w-20 shrink-0 px-2 text-right font-mono text-amber-600 dark:text-amber-400">{(table.total_updates ?? 0).toLocaleString()}</div>
                            <div className="w-20 shrink-0 px-2 text-right font-mono text-red-600 dark:text-red-400">{(table.total_deletes ?? 0).toLocaleString()}</div>
                            <div className="w-28 sm:w-36 shrink-0 px-2">
                                <div className="h-2.5 w-full bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden flex" title={`Inserts: ${insertPercent.toFixed(1)}%, Updates: ${updatePercent.toFixed(1)}%, Deletes: ${deletePercent.toFixed(1)}%`}>
                                    <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${insertPercent}%` }}></div>
                                    <div className="h-full bg-amber-500 transition-all duration-500" style={{ width: `${updatePercent}%` }}></div>
                                    <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${deletePercent}%` }}></div>
                                </div>
                            </div>
                        </div>
                        {isExpanded && (
                            <div className="p-4 sm:p-6 bg-[var(--subtle-bg)] dark:bg-black text-sm border-t border-[var(--border-color)] shadow-inner flex flex-col gap-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Database size={16} className="text-indigo-500" />
                                    <span className="font-bold text-[var(--text-primary)] text-base">{table.table_name} Details</span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                                    <div className="flex flex-col">
                                        <div className="text-xs uppercase tracking-wider text-[var(--text-secondary)] font-bold mb-1">Live Rows</div>
                                        <div className="font-mono text-lg text-[var(--text-primary)]">{(table.live_rows ?? 0).toLocaleString()}</div>
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="text-xs uppercase tracking-wider text-[var(--text-secondary)] font-bold mb-1">Total Inserts</div>
                                        <div className="font-mono text-lg text-emerald-500">{(table.total_inserts ?? 0).toLocaleString()}</div>
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="text-xs uppercase tracking-wider text-[var(--text-secondary)] font-bold mb-1">Total Updates</div>
                                        <div className="font-mono text-lg text-amber-500">{(table.total_updates ?? 0).toLocaleString()}</div>
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="text-xs uppercase tracking-wider text-[var(--text-secondary)] font-bold mb-1">Total Deletes</div>
                                        <div className="font-mono text-lg text-red-500">{(table.total_deletes ?? 0).toLocaleString()}</div>
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="text-xs uppercase tracking-wider text-[var(--text-secondary)] font-bold mb-1">Last Used</div>
                                        <div className="font-mono text-lg text-indigo-500">
                                            {table.last_used ? new Date(table.last_used).toLocaleString() : 'Never / Unknown'}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-xs text-[var(--text-secondary)] mt-2">
                                    More information: This table accounts for {((totalActivity) / (dbData.reduce((acc, curr) => acc + curr.total_inserts + curr.total_updates + curr.total_deletes, 0) || 1) * 100).toFixed(1)}% of total database activity.
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

const FunctionHealthCard: React.FC<{ func: EdgeFunctionStats }> = ({ func }) => {
    const successPercent = func.total_calls > 0 ? (func.success_count / func.total_calls) * 100 : 0;
    
    return (
        <div className="p-4 bg-[var(--card-bg)] dark:bg-black border-b border-[var(--border-color)] last:border-b-0 hover:bg-[var(--subtle-bg)] dark:hover:bg-[#111] transition-all flex flex-col justify-between group relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-purple-500 to-indigo-500 opacity-50 group-hover:opacity-100 transition-opacity"></div>
            <div className="flex justify-between items-start mb-3 pl-2">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 group-hover:scale-110 transition-transform">
                        <Zap size={16} />
                    </div>
                    <div>
                        <div className="font-bold text-sm text-[var(--text-primary)] truncate max-w-[150px] sm:max-w-[200px]">{func.function_name}</div>
                        <div className="text-xs text-[var(--text-secondary)] flex items-center gap-1.5 mt-1">
                            <Clock size={12} /> {func.last_run ? timeAgo(func.last_run) : 'Never'}
                        </div>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-lg sm:text-xl font-black font-mono text-[var(--text-primary)]">{successPercent.toFixed(0)}%</div>
                    <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider font-bold">Success</div>
                </div>
            </div>

            <div className="space-y-2 pl-2">
                <div className="h-2 w-full bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden flex">
                    <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${successPercent}%` }}></div>
                    <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${100 - successPercent}%` }}></div>
                </div>
                <div className="flex justify-between text-xs font-medium">
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5"><CheckCircle size={12}/> {(func.success_count ?? 0).toLocaleString()}</span>
                    <span className="text-[var(--text-secondary)] font-mono">{(func.total_calls ?? 0).toLocaleString()}</span>
                    <span className="text-red-600 dark:text-red-400 flex items-center gap-1.5"><AlertTriangle size={12}/> {(func.error_count ?? 0).toLocaleString()}</span>
                </div>
            </div>
        </div>
    );
};

const DatabaseAnalyticsCard: React.FC = () => {
    const [dbData, setDbData] = useState<DatabaseAnalyticsStats[]>([]);
    const [fnData, setFnData] = useState<EdgeFunctionStats[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const { refreshTrigger } = useAutoRefresh();

    const loadData = useCallback(async (isAutoRefresh = false) => {
        if (!isAutoRefresh) setIsLoading(true);
        try {
            const [dbStats, fnStats] = await Promise.all([
                fetchDatabaseAnalytics(),
                fetchEdgeFunctionStats()
            ]);
            setDbData(dbStats);
            setFnData(fnStats);
        } catch (error) {
            console.error("Failed to fetch DB analytics:", error);
        } finally {
            if (!isAutoRefresh) setIsLoading(false);
        }
    }, []);

    const prevRefreshTriggerRef = React.useRef(refreshTrigger);

    useEffect(() => {
        const isAutoRefresh = prevRefreshTriggerRef.current !== refreshTrigger;
        loadData(isAutoRefresh);
        prevRefreshTriggerRef.current = refreshTrigger;
    }, [loadData, refreshTrigger]);

    const totalInserts = dbData.reduce((acc, curr) => acc + curr.total_inserts, 0);
    const totalUpdates = dbData.reduce((acc, curr) => acc + curr.total_updates, 0);
    const totalDeletes = dbData.reduce((acc, curr) => acc + curr.total_deletes, 0);
    const totalRows = dbData.reduce((acc, curr) => acc + curr.live_rows, 0);

    return (
        <div className="max-w-7xl mx-auto animate-fade-in-up">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
                {/* Left Column: Summary & Functions (1/3 width on large screens) */}
                <div className="space-y-4 sm:space-y-6 lg:col-span-4">
                    <PanelCard className="!p-0 overflow-hidden shadow-sm border border-[var(--border-color)] dark:bg-black">
                        <div className="p-3 sm:p-4 border-b border-[var(--border-color)] bg-[var(--card-bg)] dark:bg-black flex justify-between items-center">
                            <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400 rounded-lg flex items-center justify-center shrink-0 border border-teal-200 dark:border-teal-800">
                                        <Activity size={16} />
                                    </div>
                                    <h3 className="font-bold text-base text-[var(--text-primary)]">Database Overview</h3>
                                </div>
                                <div className="flex items-center gap-2">
                                    <InfoPopover info="Aggregate metrics of database operation volume and health." />
                                    <button onClick={() => loadData()} className="p-2 rounded-md hover:bg-[var(--subtle-bg)] dark:hover:bg-[#111] text-[var(--text-secondary)] transition-colors" title="Refresh Data">
                                        <RefreshCw size={16} className={isLoading ? "animate-spin text-indigo-500" : ""} />
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="p-3 sm:p-4 bg-[var(--subtle-bg)] dark:bg-black grid grid-cols-2 gap-3 sm:gap-4">
                            <StatItem label="Total Rows" value={totalRows} icon={<Database size={16} />} colorClass="text-indigo-500" bgClass="bg-indigo-50/50 dark:bg-[#111] border-indigo-100 dark:border-indigo-900/30" />
                            <StatItem label="Total Inserts" value={totalInserts} icon={<ArrowUp size={16} />} colorClass="text-emerald-500" bgClass="bg-emerald-50/50 dark:bg-[#111] border-emerald-100 dark:border-emerald-900/30" />
                            <StatItem label="Total Updates" value={totalUpdates} icon={<RefreshCw size={16} />} colorClass="text-amber-500" bgClass="bg-amber-50/50 dark:bg-[#111] border-amber-100 dark:border-amber-900/30" />
                            <StatItem label="Total Deletes" value={totalDeletes} icon={<ArrowDown size={16} />} colorClass="text-red-500" bgClass="bg-red-50/50 dark:bg-[#111] border-red-100 dark:border-red-900/30" />
                        </div>
                    </PanelCard>

                    {fnData.length > 0 && (
                        <PanelCard className="!p-0 overflow-hidden shadow-sm border border-[var(--border-color)] dark:bg-black flex flex-col">
                            <div className="p-3 sm:p-4 border-b border-[var(--border-color)] bg-[var(--card-bg)] dark:bg-black flex justify-between items-center">
                                <h3 className="font-bold text-base text-[var(--text-primary)] flex items-center gap-2.5">
                                    <Zap size={16} className="text-purple-500" /> Edge Functions
                                </h3>
                                <InfoPopover info="Performance and usage metrics of serverless edge functions." />
                            </div>
                            <div className="flex flex-col">
                                {fnData.map((func, idx) => (
                                    <FunctionHealthCard key={idx} func={func} />
                                ))}
                            </div>
                        </PanelCard>
                    )}
                </div>

                {/* Right Column: Table Activity (2/3 width on large screens) */}
                <div className="lg:col-span-8">
                    <PanelCard className="!p-0 h-full flex flex-col overflow-hidden shadow-sm border border-[var(--border-color)] dark:bg-black">
                        <div className="p-3 sm:p-4 border-b border-[var(--border-color)] bg-[var(--card-bg)] dark:bg-black flex justify-between items-center">
                            <h3 className="font-bold text-base text-[var(--text-primary)] flex items-center gap-2.5">
                                <Server size={16} className="text-blue-500" /> Table Activity
                            </h3>
                            <div className="flex items-center gap-3">
                                <InfoPopover info="Breakdown of read and write activities across different database tables." />
                                <div className="text-[10px] font-bold text-[var(--text-secondary)] flex items-center gap-2 uppercase tracking-wider bg-[var(--subtle-bg)] dark:bg-[#111] px-2.5 py-1 rounded-full border border-[var(--border-color)]">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div> Live
                                </div>
                            </div>
                        </div>
                        
                        {isLoading && dbData.length === 0 ? (
                            <div className="flex items-center justify-center h-full min-h-[200px] sm:min-h-[300px] bg-[var(--card-bg)] dark:bg-black">
                                <LoadingSpinner />
                            </div>
                        ) : dbData.length > 0 ? (
                            <CompactTableActivity dbData={dbData} />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full min-h-[200px] sm:min-h-[300px] text-[var(--text-secondary)] border-2 border-dashed border-[var(--border-color)] rounded-xl bg-[var(--card-bg)] dark:bg-black m-3 sm:m-4">
                                <Server size={48} className="mb-4 opacity-20" />
                                <p className="text-base font-medium">No table data available.</p>
                            </div>
                        )}
                    </PanelCard>
                </div>
            </div>
        </div>
    );
};

export default DatabaseAnalyticsCard;


