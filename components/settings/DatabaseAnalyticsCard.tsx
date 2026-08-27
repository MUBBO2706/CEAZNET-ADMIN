



import React, { useState, useEffect, useCallback } from 'react';
import { PanelCard, timeAgo, InfoPopover } from '../ui';
import { fetchDatabaseAnalytics, fetchEdgeFunctionStats } from '../../services/supabaseService';
import type { DatabaseAnalyticsStats, EdgeFunctionStats } from '../../types';
import { Database, Activity, ArrowUp, ArrowDown, RotateCw, Loader, Server, Zap, CheckCircle, AlertTriangle, Clock, Layers } from 'lucide-react';
import { LoadingSpinner } from '../skeletons';
import { useAutoRefresh } from '../AutoRefreshContext';

const StatItem = ({ label, value, icon, colorClass, bgClass }: { label: string, value: number, icon: React.ReactNode, colorClass: string, bgClass: string }) => (
    <div className={`flex flex-col p-3 rounded-xl border border-[var(--border-color)] shadow-sm relative overflow-hidden group transition-all duration-300 hover:shadow-md ${bgClass}`}>
        <div className="absolute -right-3 -top-3 opacity-10 group-hover:scale-110 transition-transform duration-500">
            {React.cloneElement(icon as React.ReactElement<any>, { size: 52 })}
        </div>
        <div className={`flex items-center gap-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-1 ${colorClass}`}>
            {icon} {label}
        </div>
        <span className="text-lg sm:text-xl font-black font-mono text-[var(--text-primary)] tracking-tight relative z-10">
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
                className="flex items-center py-2 bg-[var(--subtle-bg)] border-b border-[var(--border-color)] overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] text-[10px] sm:text-xs uppercase tracking-wider font-bold text-[var(--text-secondary)]"
            >
                <div className="flex-1 min-w-[120px] sm:min-w-[160px] pr-2 pl-4 sm:pl-6 lg:pl-8">Table Name</div>
                <div className="w-16 sm:w-24 shrink-0 px-2 text-right">Rows</div>
                <div className="w-16 sm:w-24 shrink-0 px-2 text-right">Inserts</div>
                <div className="w-16 sm:w-24 shrink-0 px-2 text-right">Updates</div>
                <div className="w-16 sm:w-24 shrink-0 px-2 text-right">Deletes</div>
                <div className="w-24 sm:w-44 shrink-0 px-2 pr-4 sm:pr-6 lg:pr-8 text-right sm:text-center whitespace-nowrap">Activity Mix</div>
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
                            className="flex items-center py-2.5 hover:bg-[var(--subtle-bg)] transition-colors group overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] text-xs sm:text-sm cursor-pointer"
                        >
                            <div className="flex-1 min-w-[120px] sm:min-w-[160px] pr-2 pl-4 sm:pl-6 lg:pl-8 font-mono font-bold text-[var(--text-primary)] flex items-center gap-2 truncate">
                                <Layers size={14} className="text-indigo-400 group-hover:text-indigo-500 transition-colors shrink-0" />
                                <span className="truncate text-xs sm:text-sm">{table.table_name}</span>
                            </div>
                            <div className="w-16 sm:w-24 shrink-0 px-2 text-right font-mono text-xs sm:text-sm text-[var(--text-secondary)]">{(table.live_rows ?? 0).toLocaleString()}</div>
                            <div className="w-16 sm:w-24 shrink-0 px-2 text-right font-mono text-xs sm:text-sm text-emerald-600 dark:text-emerald-400">{(table.total_inserts ?? 0).toLocaleString()}</div>
                            <div className="w-16 sm:w-24 shrink-0 px-2 text-right font-mono text-xs sm:text-sm text-amber-600 dark:text-amber-400">{(table.total_updates ?? 0).toLocaleString()}</div>
                            <div className="w-16 sm:w-24 shrink-0 px-2 text-right font-mono text-xs sm:text-sm text-red-600 dark:text-red-400">{(table.total_deletes ?? 0).toLocaleString()}</div>
                            <div className="w-24 sm:w-44 shrink-0 px-2 pr-4 sm:pr-6 lg:pr-8">
                                <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden flex" title={`Inserts: ${insertPercent.toFixed(1)}%, Updates: ${updatePercent.toFixed(1)}%, Deletes: ${deletePercent.toFixed(1)}%`}>
                                    <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${insertPercent}%` }}></div>
                                    <div className="h-full bg-amber-500 transition-all duration-500" style={{ width: `${updatePercent}%` }}></div>
                                    <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${deletePercent}%` }}></div>
                                </div>
                            </div>
                        </div>
                        {isExpanded && (
                            <div className="p-4 sm:p-6 lg:p-8 bg-[var(--subtle-bg)] text-xs border-t border-[var(--border-color)] shadow-inner flex flex-col gap-3">
                                <div className="flex items-center gap-2">
                                    <Database size={14} className="text-indigo-500" />
                                    <span className="font-bold text-[var(--text-primary)] text-sm">{table.table_name} Details</span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    <div className="flex flex-col">
                                        <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] font-bold mb-0.5">Live Rows</div>
                                        <div className="font-mono text-sm text-[var(--text-primary)]">{(table.live_rows ?? 0).toLocaleString()}</div>
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] font-bold mb-0.5">Total Inserts</div>
                                        <div className="font-mono text-sm text-emerald-500">{(table.total_inserts ?? 0).toLocaleString()}</div>
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] font-bold mb-0.5">Total Updates</div>
                                        <div className="font-mono text-sm text-amber-500">{(table.total_updates ?? 0).toLocaleString()}</div>
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] font-bold mb-0.5">Total Deletes</div>
                                        <div className="font-mono text-sm text-red-500">{(table.total_deletes ?? 0).toLocaleString()}</div>
                                    </div>
                                    <div className="flex flex-col col-span-2">
                                        <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] font-bold mb-0.5">Last Used</div>
                                        <div className="font-mono text-xs text-indigo-500">
                                            {table.last_used ? new Date(table.last_used).toLocaleString() : 'Never / Unknown'}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-[11px] text-[var(--text-secondary)]">
                                    This table accounts for {((totalActivity) / (dbData.reduce((acc, curr) => acc + curr.total_inserts + curr.total_updates + curr.total_deletes, 0) || 1) * 100).toFixed(1)}% of total database activity.
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
        <div className="p-3 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl hover:bg-[var(--subtle-bg)] transition-all flex flex-col justify-between group relative overflow-hidden shadow-sm">
            <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1.5 rounded-md bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 shrink-0">
                        <Zap size={14} />
                    </div>
                    <div className="min-w-0">
                        <div className="font-bold text-xs sm:text-sm text-[var(--text-primary)] truncate">{func.function_name}</div>
                        <div className="text-[11px] text-[var(--text-secondary)] flex items-center gap-1 mt-0.5 whitespace-nowrap">
                            <Clock size={11} /> {func.last_run ? timeAgo(func.last_run) : 'Never'}
                        </div>
                    </div>
                </div>
                <div className="text-right shrink-0 pl-2">
                    <div className="text-sm font-black font-mono text-[var(--text-primary)]">{successPercent.toFixed(0)}%</div>
                    <div className="text-[9px] text-[var(--text-secondary)] uppercase tracking-wider font-bold">Success</div>
                </div>
            </div>

            <div className="space-y-1.5">
                <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden flex">
                    <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${successPercent}%` }}></div>
                    <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${100 - successPercent}%` }}></div>
                </div>
                <div className="flex justify-between text-[11px] font-medium">
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><CheckCircle size={11}/> {(func.success_count ?? 0).toLocaleString()}</span>
                    <span className="text-[var(--text-secondary)] font-mono text-[10px]">{(func.total_calls ?? 0).toLocaleString()} calls</span>
                    <span className="text-red-600 dark:text-red-400 flex items-center gap-1"><AlertTriangle size={11}/> {(func.error_count ?? 0).toLocaleString()}</span>
                </div>
            </div>
        </div>
    );
};

let cachedDbData: DatabaseAnalyticsStats[] | null = null;
let cachedFnData: EdgeFunctionStats[] | null = null;

const DatabaseAnalyticsCard: React.FC = () => {
    const [dbData, setDbData] = useState<DatabaseAnalyticsStats[]>(cachedDbData || []);
    const [fnData, setFnData] = useState<EdgeFunctionStats[]>(cachedFnData || []);
    const [isLoading, setIsLoading] = useState(!cachedDbData);
    const { refreshTrigger } = useAutoRefresh();

    const loadData = useCallback(async (isAutoRefresh = false) => {
        if (!isAutoRefresh && !cachedDbData) setIsLoading(true);
        try {
            const [dbStats, fnStats] = await Promise.all([
                fetchDatabaseAnalytics(),
                fetchEdgeFunctionStats()
            ]);
            cachedDbData = dbStats;
            cachedFnData = fnStats;
            setDbData(dbStats);
            setFnData(fnStats);
        } catch (error) {
            console.error("Failed to fetch DB analytics:", error);
        } finally {
            setIsLoading(false);
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
        <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
                {/* Left Column: Summary & Functions (Container-less design) */}
                <div className="space-y-5 lg:col-span-4">
                    {/* Container-less Database Overview Section */}
                    <div>
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-[var(--border-color)]">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400 rounded-lg flex items-center justify-center shrink-0">
                                    <Activity size={15} />
                                </div>
                                <h3 className="font-bold text-sm sm:text-base text-[var(--text-primary)]">Database Overview</h3>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <InfoPopover info="Aggregate metrics of database operation volume and health." />
                                <button onClick={() => loadData()} className="p-1.5 rounded-md hover:bg-[var(--subtle-bg)] text-[var(--text-secondary)] transition-colors" title="Refresh Data">
                                    {isLoading ? <Loader size={14} className="animate-spin text-indigo-500" /> : <RotateCw size={14} />}
                                </button>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                            <StatItem label="Total Rows" value={totalRows} icon={<Database size={15} />} colorClass="text-indigo-500" bgClass="bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-100 dark:border-indigo-900/30" />
                            <StatItem label="Total Inserts" value={totalInserts} icon={<ArrowUp size={15} />} colorClass="text-emerald-500" bgClass="bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30" />
                            <StatItem label="Total Updates" value={totalUpdates} icon={<RotateCw size={15} />} colorClass="text-amber-500" bgClass="bg-amber-50/50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/30" />
                            <StatItem label="Total Deletes" value={totalDeletes} icon={<ArrowDown size={15} />} colorClass="text-red-500" bgClass="bg-red-50/50 dark:bg-red-950/20 border-red-100 dark:border-red-900/30" />
                        </div>
                    </div>

                    {/* Container-less Edge Functions Section */}
                    {fnData.length > 0 && (
                        <div>
                            <div className="flex items-center justify-between mb-3 pb-2 border-b border-[var(--border-color)]">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 rounded-lg flex items-center justify-center shrink-0">
                                        <Zap size={15} />
                                    </div>
                                    <h3 className="font-bold text-sm sm:text-base text-[var(--text-primary)]">Edge Functions</h3>
                                </div>
                                <InfoPopover info="Performance and usage metrics of serverless edge functions." />
                            </div>
                            <div className="space-y-2.5">
                                {fnData.map((func, idx) => (
                                    <FunctionHealthCard key={idx} func={func} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Column: Table Activity (Edge to Edge Panel & Compact Table) */}
                <div className="lg:col-span-8">
                    <div className="mx-[-12px] sm:mx-[-16px] lg:mx-[-24px] bg-[var(--card-bg)] border-t border-b border-[var(--border-color)] border-x-0 rounded-none h-full flex flex-col overflow-hidden">
                        <div className="p-4 sm:p-5 lg:p-6 lg:px-8 border-b border-[var(--border-color)] bg-[var(--card-bg)] flex justify-between items-center">
                            <h3 className="font-bold text-sm sm:text-base text-[var(--text-primary)] flex items-center gap-2">
                                <Server size={16} className="text-blue-500" /> Table Activity
                            </h3>
                            <div className="flex items-center gap-2.5">
                                <InfoPopover info="Breakdown of read and write activities across different database tables." />
                                <div className="text-[10px] font-bold text-[var(--text-secondary)] flex items-center gap-1.5 uppercase tracking-wider bg-[var(--subtle-bg)] px-2 py-0.5 rounded-full border border-[var(--border-color)]">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Live
                                </div>
                            </div>
                        </div>
                        
                        {isLoading && dbData.length === 0 ? (
                            <div className="flex items-center justify-center h-full min-h-[200px] sm:min-h-[300px] bg-[var(--card-bg)]">
                                <LoadingSpinner />
                            </div>
                        ) : dbData.length > 0 ? (
                            <CompactTableActivity dbData={dbData} />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full min-h-[200px] sm:min-h-[300px] text-[var(--text-secondary)] border-2 border-dashed border-[var(--border-color)] rounded-xl bg-[var(--card-bg)] m-3 sm:m-4">
                                <Server size={40} className="mb-3 opacity-20" />
                                <p className="text-sm font-medium">No table data available.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DatabaseAnalyticsCard;


