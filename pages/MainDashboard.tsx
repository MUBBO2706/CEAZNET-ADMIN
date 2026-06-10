
import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { StatCard, PanelCard, timeAgo, InfoPopover } from '../components/ui';
import { ApiDistributionChart, SuccessRateChart, ArticlesByCategoryChart, DatabaseEventsTimelineChart, FinanceDistributionChart, ActivityByMethodChart } from '../components/charts';
import { MainDashboardSkeleton } from '../components/skeletons';
import { fetchMainDashboardData, fetchLiveActivityLogs, dbMain } from '../services/supabaseService';
import type { MainDashboardData, RecentActivityLog } from '../types';
import { useAutoRefresh } from '../components/AutoRefreshContext';
import { 
    Zap, Newspaper, Users, LineChart, HeartCrack, X, 
    Activity, CheckCircle, AlertTriangle, ArrowRight, 
    MessageSquare, MessageCircle, Settings, Clock, ExternalLink,
    Route, Lightbulb, Link as LinkIcon, MapPin, FlaskConical, Search,
    Server, Database, ChevronDown, ChevronUp, Eye, Filter,
    Copy, FileCode, List, Wallet, Droplets, Image as ImageIcon, FileText, CarFront
} from 'lucide-react';

const SystemHealthBanner: React.FC<{ successRate: number }> = ({ successRate }) => {
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    // Determine status based on metrics
    if (successRate < 85) status = 'warning';
    if (successRate < 60) status = 'critical';

    const styles = {
        healthy: {
            bg: 'bg-emerald-500/10 border-emerald-500/20',
            text: 'text-emerald-500 dark:text-emerald-400',
            icon: <CheckCircle className="w-4 h-4" />,
            title: 'All Systems Operational',
            desc: 'Services are running smoothly.',
            pulse: 'bg-emerald-500'
        },
        warning: {
            bg: 'bg-amber-500/10 border-amber-500/20',
            text: 'text-amber-500 dark:text-amber-400',
            icon: <Activity className="w-4 h-4" />,
            title: 'System Warning',
            desc: 'Elevated error rates detected.',
            pulse: 'bg-amber-500'
        },
        critical: {
            bg: 'bg-red-500/10 border-red-500/20',
            text: 'text-red-500 dark:text-red-400',
            icon: <AlertTriangle className="w-4 h-4" />,
            title: 'Critical Attention Needed',
            desc: 'High failure rates require investigation.',
            pulse: 'bg-red-500'
        }
    };

    const currentStyle = styles[status];

    return (
        <div className={`p-3 mb-6 rounded-lg border ${currentStyle.bg} animate-fade-in-up`}>
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative flex h-2.5 w-2.5 shrink-0">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${currentStyle.pulse} opacity-75`}></span>
                        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${currentStyle.pulse}`}></span>
                    </div>
                    <h2 className={`text-sm font-bold truncate leading-none ${currentStyle.text}`}>{currentStyle.title}</h2>
                    <span className="hidden sm:inline text-[var(--text-secondary)] text-xs opacity-50 mx-1">•</span>
                    <p className="hidden sm:inline text-[var(--text-secondary)] text-xs truncate leading-none">{currentStyle.desc}</p>
                </div>
                
                <div className="flex items-center gap-2 shrink-0">
                    <div className="hidden md:flex items-center gap-3 mr-2 text-xs font-mono text-[var(--text-secondary)]">
                        <span className="flex items-center gap-1">
                            <Activity size={12} className={currentStyle.text} />
                            {successRate.toFixed(1)}%
                        </span>
                        <span className="flex items-center gap-1">
                            <Server size={12} className="text-sky-500" />
                            99.9%
                        </span>
                    </div>
                    <Link to="/settings" className="p-1.5 rounded-md hover:bg-[var(--card-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors" title="Settings">
                        <Settings size={14} />
                    </Link>
                    <Link to="/advanced-analytics" className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors border border-transparent hover:border-current ${currentStyle.text}`}>
                        Insights <ArrowRight size={12} />
                    </Link>
                </div>
            </div>
            <p className="sm:hidden text-[var(--text-secondary)] text-xs mt-2 pl-5">{currentStyle.desc}</p>
        </div>
    );
};

const QuickActions: React.FC = () => (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <Link to="/news#settings" className="group relative overflow-hidden p-3 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl hover:border-amber-500/50 active:scale-[0.97] transition-transform shadow-sm hover:shadow-md flex flex-col sm:flex-row items-center sm:items-start gap-3">
            <div className="p-2.5 bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400 rounded-lg group-hover:bg-amber-500 group-hover:text-white transition-all duration-200 shrink-0">
                <Settings size={18} />
            </div>
            <div className="text-center sm:text-left overflow-hidden">
                <h3 className="font-semibold text-xs sm:text-sm text-[var(--text-primary)] group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors truncate">Configure News</h3>
                <p className="hidden sm:block text-[10px] text-[var(--text-secondary)] mt-0.5 line-clamp-1">Manage sources</p>
            </div>
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block">
                <ArrowRight size={12} className="text-amber-500" />
            </div>
        </Link>

        <Link to="/users" className="group relative overflow-hidden p-3 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl hover:border-sky-500/50 active:scale-[0.97] transition-transform shadow-sm hover:shadow-md flex flex-col sm:flex-row items-center sm:items-start gap-3">
            <div className="p-2.5 bg-sky-50 text-sky-600 dark:bg-sky-900/20 dark:text-sky-400 rounded-lg group-hover:bg-sky-500 group-hover:text-white transition-all duration-200 shrink-0">
                <Users size={18} />
            </div>
            <div className="text-center sm:text-left overflow-hidden">
                <h3 className="font-semibold text-xs sm:text-sm text-[var(--text-primary)] group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors truncate">Manage Users</h3>
                <p className="hidden sm:block text-[10px] text-[var(--text-secondary)] mt-0.5 line-clamp-1">View & edit users</p>
            </div>
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block">
                <ArrowRight size={12} className="text-sky-500" />
            </div>
        </Link>

        <Link to="/settings" className="group relative overflow-hidden p-3 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl hover:border-emerald-500/50 active:scale-[0.97] transition-transform shadow-sm hover:shadow-md flex flex-col sm:flex-row items-center sm:items-start gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 rounded-lg group-hover:bg-emerald-500 group-hover:text-white transition-all duration-200 shrink-0">
                <Activity size={18} />
            </div>
            <div className="text-center sm:text-left overflow-hidden">
                <h3 className="font-semibold text-xs sm:text-sm text-[var(--text-primary)] group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">System Health</h3>
                <p className="hidden sm:block text-[10px] text-[var(--text-secondary)] mt-0.5 line-clamp-1">Monitor performance</p>
            </div>
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block">
                <ArrowRight size={12} className="text-emerald-500" />
            </div>
        </Link>
    </div>
);

const formatLogDate = (isoString: string) => {
    const d = new Date(isoString);
    const day = d.getDate().toString().padStart(2, '0');
    const month = d.toLocaleString('en-US', { month: 'short' });
    const year = d.getFullYear().toString().slice(-2);
    const time = d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return `${day} ${month} ${year} ${time}`;
};

const getHttpMethod = (method: string) => {
    switch(method) {
        case 'INSERT': return 'POST';
        case 'UPDATE': return 'PATCH';
        case 'DELETE': return 'DELETE';
        case 'GET': return 'GET';
        case 'EXECUTE': return 'POST';
        case 'SYSTEM': return 'SYS';
        case 'USER': return 'USR';
        default: return 'LOG';
    }
};

const getHttpStatusCode = (method: string, status: string) => {
    if (status !== 'SUCCESS') return 500;
    if (method === 'INSERT') return 201;
    return 200;
};

export const ExpandedLogDetail: React.FC<{ log: RecentActivityLog }> = ({ log }) => {
    const [viewMode, setViewMode] = useState<'structured' | 'raw'>('structured');
    const [copied, setCopied] = useState(false);

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const renderStructuredData = (data: any, depth = 0) => {
        if (!data) return <span className="text-[var(--text-secondary)] italic text-xs">No data available</span>;
        if (typeof data !== 'object') return <span className="text-[var(--text-primary)] text-xs break-all">{String(data)}</span>;
        
        return (
            <div className={`grid grid-cols-1 ${depth === 0 ? 'sm:grid-cols-2' : ''} gap-2 sm:gap-3 w-full`}>
                {Object.entries(data).map(([key, value]) => (
                    <div key={key} className={`flex flex-col border-l-2 border-[var(--subtle-border)] pl-3 py-1 ${depth > 0 ? 'mt-2' : ''}`}>
                        <span className="text-[var(--text-secondary)] text-[9px] sm:text-[10px] uppercase tracking-wider mb-1 font-bold opacity-60">{key}</span>
                        <div className="text-[var(--text-primary)] text-[11px] sm:text-xs font-mono break-all">
                            {typeof value === 'object' && value !== null ? (
                                renderStructuredData(value, depth + 1)
                            ) : (
                                <span className={typeof value === 'boolean' ? (value ? 'text-[var(--success)]' : 'text-[var(--danger)]') : typeof value === 'number' ? 'text-blue-500 dark:text-blue-400' : 'text-[var(--text-primary)]'}>
                                    {String(value)}
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const renderDiffData = (oldData: any, newData: any) => {
        if (!oldData && !newData) return <span className="text-[var(--text-secondary)] italic text-xs">No data available</span>;
        
        if (!oldData || !newData) {
            const dataToRender = newData || oldData;
            const isDelete = !newData;
            
            return (
                <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2 w-full`}>
                    {Object.entries(dataToRender).map(([key, value]) => (
                        <div key={key} className={`flex flex-col border-l-2 pl-3 py-1 ${isDelete ? 'border-red-500/30' : 'border-green-500/30'}`}>
                            <span className="text-[var(--text-secondary)] text-[9px] uppercase tracking-wider mb-1 font-bold opacity-60">{key}</span>
                            <div className="text-[11px] font-mono break-all">
                                {typeof value === 'object' && value !== null ? (
                                    <span className={isDelete ? 'text-red-500 dark:text-red-400' : 'text-green-500 dark:text-green-400'}>{JSON.stringify(value)}</span>
                                ) : (
                                    <span className={isDelete ? 'text-red-500 dark:text-red-400' : 'text-green-500 dark:text-green-400'}>{String(value)}</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            );
        }

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
                            <div className="text-[11px] font-mono break-all flex flex-col gap-1">
                                {isUnchanged && <span className="text-[var(--text-primary)]">{newValStr}</span>}
                                {isAdded && <span className="text-green-500 dark:text-green-400">+{newValStr}</span>}
                                {isRemoved && <span className="text-red-500 dark:text-red-400 line-through">-{oldValStr}</span>}
                                {isModified && (
                                    <>
                                        <span className="text-red-500 dark:text-red-400 line-through bg-red-500/10 px-1 rounded w-fit">-{oldValStr}</span>
                                        <span className="text-green-500 dark:text-green-400 bg-green-500/10 px-1 rounded w-fit">+{newValStr}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    const eventData = log.payload?.response || log.payload;
    const rawJsonString = JSON.stringify(eventData, null, 2);

    return (
        <div className="px-3 py-3 sm:px-6 sm:py-4 bg-[var(--body-bg)] text-[var(--text-primary)] font-sans border-t border-[var(--border-color)]">
            <div className="flex items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-2 min-w-0">
                    <Database size={14} className="text-[var(--text-secondary)] opacity-50 shrink-0" />
                    <span className="text-[11px] sm:text-xs font-bold text-[var(--success)] font-mono truncate">{log.table}</span>
                </div>
                <div className="flex bg-[var(--subtle-bg)] rounded-full p-0.5 border border-[var(--border-color)] shrink-0">
                    <button 
                        onClick={(e) => { e.stopPropagation(); setViewMode('structured'); }}
                        className={`px-3 py-1 text-[10px] sm:text-[11px] rounded-full transition-all duration-200 ${viewMode === 'structured' ? 'bg-[var(--success)] text-white shadow-sm font-bold' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                        Structured
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); setViewMode('raw'); }}
                        className={`px-3 py-1 text-[10px] sm:text-[11px] rounded-full transition-all duration-200 ${viewMode === 'raw' ? 'bg-[var(--success)] text-white shadow-sm font-bold' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                        Raw
                    </button>
                </div>
            </div>

            {log.payload && (
                <div className="flex flex-col gap-5 sm:gap-6">
                    <div>
                        <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider font-bold flex items-center gap-2 mb-2 opacity-70">
                            <Database size={12} /> Action Details
                        </div>
                        <div className="font-mono text-[11px] sm:text-xs text-indigo-500 dark:text-indigo-400 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                            {log.payload.query || (
                                log.method === 'INSERT' ? `System Event: INSERT INTO ${log.table}` :
                                log.method === 'UPDATE' ? `System Event: UPDATE ${log.table}` :
                                log.method === 'DELETE' ? `System Event: DELETE FROM ${log.table}` :
                                `System Event: SELECT FROM ${log.table}`
                            )}
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider font-bold flex items-center gap-2 opacity-70">
                                <FileCode size={12} /> Event Details (Response)
                            </div>
                            {viewMode === 'raw' && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleCopy(rawJsonString); }}
                                    className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1 text-[10px] bg-[var(--subtle-bg)] hover:bg-[var(--subtle-border)] px-2 py-1 rounded border border-[var(--border-color)]"
                                >
                                    {copied ? <CheckCircle size={10} className="text-[var(--success)]" /> : <Copy size={10} />}
                                    {copied ? 'Copied' : 'Copy'}
                                </button>
                            )}
                        </div>
                        <div>
                            {viewMode === 'raw' ? (
                                <pre className="font-mono text-[10px] sm:text-[11px] text-emerald-600 dark:text-emerald-400 overflow-x-auto max-h-[40vh] overflow-y-auto custom-scrollbar [&::-webkit-scrollbar:horizontal]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                                    {rawJsonString}
                                </pre>
                            ) : (
                                (eventData?.old_data || eventData?.new_data) 
                                    ? renderDiffData(eventData.old_data, eventData.new_data)
                                    : renderStructuredData(eventData)
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const LiveDatabaseLogs: React.FC<{ initialActivity: RecentActivityLog[] }> = ({ initialActivity }) => {
    const [activity, setActivity] = useState<RecentActivityLog[]>(initialActivity);
    const [visibleCount, setVisibleCount] = useState<number>(30);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [expandedLog, setExpandedLog] = useState<string | number | null>(null);
    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    
    const [timeRange, setTimeRange] = useState<string>('1h');
    const [customRange, setCustomRange] = useState<{start: string, end: string}>({ start: '', end: '' });
    const [isTimeDropdownOpen, setIsTimeDropdownOpen] = useState(false);

    const fetchLogs = async (overrideRange?: string, overrideCustom?: {start: string, end: string}) => {
        setIsRefreshing(true);
        try {
            const rangeToUse = overrideRange || timeRange;
            const customToUse = overrideCustom || customRange;
            
            let startTime: string | undefined;
            let endTime: string | undefined;
            const now = new Date();
            
            if (rangeToUse === '1h') {
                startTime = new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString();
            } else if (rangeToUse === '12h') {
                startTime = new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString();
            } else if (rangeToUse === '24h') {
                startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
            } else if (rangeToUse === '3d') {
                startTime = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
            } else if (rangeToUse === '7d') {
                startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
            } else if (rangeToUse === '1m') {
                startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
            } else if (rangeToUse === 'custom' && customToUse.start) {
                startTime = new Date(customToUse.start).toISOString();
                if (customToUse.end) {
                    endTime = new Date(customToUse.end).toISOString();
                }
            }

            const logs = await fetchLiveActivityLogs(startTime, endTime);
            setActivity(logs);
        } catch (error) {
            console.error("Failed to fetch live logs:", error);
        } finally {
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        // Subscribe to real-time changes across all tables in the public schema
        const channel = dbMain.channel('custom-all-channel')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'activity_logs' },
                (payload) => {
                    const item = payload.new;
                    const newLog: RecentActivityLog = {
                        id: `realtime-${item.id}`,
                        type: 'realtime',
                        table: item.table_name,
                        method: item.operation || item.action_type,
                        timestamp: item.created_at,
                        description: item.description || item.new_data?.description || `${item.operation || item.action_type} on ${item.table_name}`,
                        status: 'SUCCESS',
                        source: item.source || item.new_data?.source || 'Database Trigger',
                        payload: {
                            query: `${item.operation || item.action_type} operation on ${item.table_name}`,
                            response: {
                                ...(item.old_data ? { old_data: item.old_data } : {}),
                                ...(item.new_data ? { new_data: item.new_data?.payload || item.new_data } : {}),
                                ...((item.operation === 'DELETE' || item.action_type === 'DELETE') && !item.old_data && !item.new_data ? { data: 'All data deleted (Truncate)' } : {})
                            }
                        }
                    };
                    setActivity(prev => [newLog, ...prev].slice(0, 1000)); // Keep last 1000
                }
            )
            .subscribe();

        return () => {
            dbMain.removeChannel(channel);
        };
    }, []);

    // Generate real histogram data based on selected time range
    const BUCKET_COUNT = 40;
    const histogramData = Array(BUCKET_COUNT).fill(0);
    const errorData = Array(BUCKET_COUNT).fill(0);
    
    let newestTime = Date.now();
    let oldestTime = newestTime - 60 * 60 * 1000; // default 1h
    
    if (timeRange === '1h') {
        oldestTime = newestTime - 1 * 60 * 60 * 1000;
    } else if (timeRange === '12h') {
        oldestTime = newestTime - 12 * 60 * 60 * 1000;
    } else if (timeRange === '24h') {
        oldestTime = newestTime - 24 * 60 * 60 * 1000;
    } else if (timeRange === '3d') {
        oldestTime = newestTime - 3 * 24 * 60 * 60 * 1000;
    } else if (timeRange === '7d') {
        oldestTime = newestTime - 7 * 24 * 60 * 60 * 1000;
    } else if (timeRange === '1m') {
        oldestTime = newestTime - 30 * 24 * 60 * 60 * 1000;
    } else if (timeRange === 'custom' && customRange.start) {
        oldestTime = new Date(customRange.start).getTime();
        if (customRange.end) {
            newestTime = new Date(customRange.end).getTime();
        }
    }

    const totalDuration = Math.max(newestTime - oldestTime, 60 * 1000);
    const bucketDuration = totalDuration / BUCKET_COUNT;

    const filteredActivity = activity.filter(log => {
        const logTime = new Date(log.timestamp).getTime();
        return logTime >= oldestTime && logTime <= newestTime;
    });

    filteredActivity.forEach(log => {
        const logTime = new Date(log.timestamp).getTime();
        const diff = newestTime - logTime;
        let bucketIndex = BUCKET_COUNT - 1 - Math.floor(diff / bucketDuration);
        bucketIndex = Math.max(0, Math.min(BUCKET_COUNT - 1, bucketIndex));
        
        histogramData[bucketIndex]++;
        if (log.status === 'ERROR') {
            errorData[bucketIndex]++;
        }
    });
    
    const maxCount = Math.max(...histogramData, 1);

    const histogramBars = histogramData.map((count, i) => {
        const errorCount = errorData[i];
        const successCount = count - errorCount;
        
        const totalHeight = count > 0 ? Math.max((count / maxCount) * 100, 10) : 2; 
        const errorHeight = count > 0 ? (errorCount / count) * 100 : 0;
        const successHeight = count > 0 ? (successCount / count) * 100 : 0;
        
        const bucketStartTime = new Date(oldestTime + i * bucketDuration);
        const bucketEndTime = new Date(oldestTime + (i + 1) * bucketDuration);
        
        const isActive = activeIndex === i;
        const isDimmed = activeIndex !== null && activeIndex !== i;
        
        const tooltipPositionClass = i < 6 ? 'left-0' : i > BUCKET_COUNT - 7 ? 'right-0' : 'left-1/2 -translate-x-1/2';
        const tailPositionClass = i < 6 ? 'left-4' : i > BUCKET_COUNT - 7 ? 'right-4' : 'left-1/2 -translate-x-1/2';
        
        return (
            <div 
                key={i} 
                className={`flex flex-col justify-end h-full flex-1 gap-[1px] group relative cursor-pointer transition-opacity duration-300 ${isDimmed ? 'opacity-30' : 'opacity-100'}`}
                onClick={(e) => {
                    e.stopPropagation();
                    setActiveIndex(isActive ? null : i);
                }}
            >
                <div className={`absolute bottom-full mb-3 ${tooltipPositionClass} bg-[var(--card-bg)] text-[var(--text-primary)] text-[10px] p-2 rounded ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} pointer-events-none whitespace-nowrap z-20 shadow-xl border border-[var(--border-color)] flex flex-col gap-1 min-w-[140px] transition-opacity duration-200`}>
                    <span className="font-bold text-[var(--success)] border-b border-[var(--border-color)] pb-1 mb-1 text-center">
                        {bucketStartTime.toLocaleDateString()} <br/>
                        <span className="text-[var(--text-secondary)] font-normal">
                            {bucketStartTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})} - {bucketEndTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                        </span>
                    </span>
                    <span className="flex justify-between"><span>Total Events:</span> <span>{count}</span></span>
                    {successCount > 0 && <span className="flex justify-between text-[var(--success)]"><span>Success:</span> <span>{successCount}</span></span>}
                    {errorCount > 0 && <span className="flex justify-between text-[var(--danger)]"><span>Error:</span> <span>{errorCount}</span></span>}
                    
                    {/* Tooltip Tail */}
                    <div className={`absolute top-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-[var(--border-color)] ${tailPositionClass}`}>
                        <div className="absolute -top-[7px] -left-[6px] w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-[var(--card-bg)]"></div>
                    </div>
                </div>
                {errorHeight > 0 && (
                    <div 
                        className={`w-full bg-[var(--danger)] rounded-t-[1px] transition-all duration-300 ${isActive ? 'brightness-75' : ''}`} 
                        style={{ height: `${(errorHeight / 100) * totalHeight}%` }}
                    />
                )}
                {successHeight > 0 && (
                    <div 
                        className={`w-full bg-[var(--success)] ${errorHeight === 0 ? 'rounded-t-[1px]' : ''} transition-all duration-300 ${isActive ? 'brightness-75' : ''}`} 
                        style={{ height: `${(successHeight / 100) * totalHeight}%` }}
                    />
                )}
                {count === 0 && (
                    <div className="w-full bg-[var(--subtle-bg)] rounded-t-[1px] h-[2%]" />
                )}
            </div>
        );
    });

    return (
        <div 
            className="flex flex-col rounded-md shadow-sm overflow-hidden h-[600px] border border-[var(--border-color)] bg-[var(--card-bg)] text-[var(--text-primary)] font-sans"
            onClick={() => setActiveIndex(null)}
        >
            <div className="p-4 border-b border-[var(--border-color)] bg-transparent">
                <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <Activity size={18} className="text-[var(--success)]" />
                    Recent Activities
                </h2>
                <p className="text-xs text-[var(--text-secondary)] mt-1">Stream of recent system events, background tasks, and user interactions.</p>
            </div>
            
            {/* Toolbar */}
            <div className="flex flex-row flex-nowrap items-center justify-between p-3 border-b border-[var(--border-color)] gap-2 sm:gap-3 bg-[var(--card-bg)] overflow-visible">
                <div className="flex items-center gap-2 sm:gap-3 text-xs shrink min-w-0">
                    <div className="hidden sm:flex items-center gap-1.5 bg-transparent px-2.5 py-1 rounded-md border border-[var(--border-color)] shrink-0">
                        <span className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse shrink-0"></span>
                        <span className="text-[var(--text-secondary)] whitespace-nowrap">Live Sync Active</span>
                    </div>
                    
                    <div className="relative">
                        <button 
                            onClick={() => setIsTimeDropdownOpen(!isTimeDropdownOpen)}
                            className="flex items-center justify-center gap-1.5 bg-transparent border border-[var(--border-color)] hover:border-[var(--text-secondary)] text-[var(--text-primary)] text-xs px-3 py-1.5 rounded-md transition-colors shrink-0 whitespace-nowrap select-none font-medium"
                        >
                            <Clock size={12} />
                            {timeRange === '1h' ? 'Last 1 Hour' : 
                             timeRange === '12h' ? 'Last 12 Hours' : 
                             timeRange === '24h' ? 'Last 24 Hours' : 
                             timeRange === '3d' ? 'Last 3 Days' : 
                             timeRange === '7d' ? 'Last 7 Days' : 
                             timeRange === '1m' ? 'Last 1 Month' : 'Custom Range'}
                            <ChevronDown size={12} />
                        </button>
                        
                        {isTimeDropdownOpen && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setIsTimeDropdownOpen(false)} />
                                <div className="absolute left-0 mt-1 w-48 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md shadow-lg z-20 overflow-hidden">
                                    {[
                                        { label: 'Last 1 Hour', value: '1h' },
                                        { label: 'Last 12 Hours', value: '12h' },
                                        { label: 'Last 24 Hours', value: '24h' },
                                        { label: 'Last 3 Days', value: '3d' },
                                        { label: 'Last 7 Days', value: '7d' },
                                        { label: 'Last 1 Month', value: '1m' },
                                        { label: 'Custom Range', value: 'custom' },
                                    ].map(option => (
                                        <button
                                            key={option.value}
                                            className={`w-full text-left px-3 py-2 text-xs hover:bg-[var(--subtle-bg)] transition-colors ${timeRange === option.value ? 'text-[var(--success)] font-medium' : 'text-[var(--text-primary)]'}`}
                                            onClick={() => {
                                                setTimeRange(option.value);
                                                if (option.value !== 'custom') {
                                                    setIsTimeDropdownOpen(false);
                                                    fetchLogs(option.value);
                                                }
                                            }}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                    {timeRange === 'custom' && (
                                        <div className="p-3 border-t border-[var(--border-color)] flex flex-col gap-2">
                                            <div>
                                                <label className="text-[10px] text-[var(--text-secondary)] mb-1 block">Start Time</label>
                                                <input 
                                                    type="datetime-local" 
                                                    className="w-full text-xs p-1.5 border border-[var(--border-color)] rounded bg-transparent text-[var(--text-primary)]"
                                                    value={customRange.start}
                                                    onChange={(e) => setCustomRange(prev => ({ ...prev, start: e.target.value }))}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-[var(--text-secondary)] mb-1 block">End Time</label>
                                                <input 
                                                    type="datetime-local" 
                                                    className="w-full text-xs p-1.5 border border-[var(--border-color)] rounded bg-transparent text-[var(--text-primary)]"
                                                    value={customRange.end}
                                                    onChange={(e) => setCustomRange(prev => ({ ...prev, end: e.target.value }))}
                                                />
                                            </div>
                                            <button 
                                                className="w-full mt-1 bg-[var(--accent-color)] text-white text-xs py-1.5 rounded hover:bg-[var(--accent-color-dark)] transition-colors"
                                                onClick={() => {
                                                    setIsTimeDropdownOpen(false);
                                                    fetchLogs('custom', customRange);
                                                }}
                                            >
                                                Apply
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
                
                <div className="flex items-center gap-2 ml-auto shrink-0">
                    <div className="relative">
                        <button 
                            onClick={() => fetchLogs()}
                            disabled={isRefreshing}
                            className="flex items-center justify-center bg-transparent border border-[var(--border-color)] hover:border-[var(--text-secondary)] text-[var(--text-primary)] text-xs px-3 py-1.5 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0 whitespace-nowrap select-none font-medium"
                            title="Click to refresh"
                        >
                            {isRefreshing ? 'refreshing...' : 'refresh'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Histogram */}
            <div className="flex flex-col border-b border-[var(--border-color)] bg-[var(--card-bg)]">
                <div className="h-20 w-full flex items-end gap-[2px] px-4 pt-4">
                    {histogramBars}
                </div>
                <div className="flex justify-between px-4 py-2 text-[10px] text-[var(--text-secondary)] font-mono">
                    <span>{formatLogDate(new Date(oldestTime).toISOString())}</span>
                    <span>{formatLogDate(new Date(newestTime).toISOString())}</span>
                </div>
            </div>

            {/* Logs List */}
            <div className="flex-grow overflow-y-auto bg-[var(--card-bg)] custom-scrollbar">
                {filteredActivity.length > 0 ? filteredActivity.slice(0, visibleCount).map((log) => {
                    const httpMethod = getHttpMethod(log.method);
                    const statusCode = getHttpStatusCode(log.method, log.status);
                    const isSuccess = statusCode >= 200 && statusCode < 300;
                    const isExpanded = expandedLog === log.id;

                    return (
                        <div key={log.id} className="flex flex-col border-b border-[var(--border-color)] hover:bg-[var(--subtle-bg)] transition-colors">
                            <div 
                                className="flex items-center gap-3 sm:gap-4 px-4 py-2.5 cursor-pointer overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                                onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                            >
                                <input type="checkbox" className="rounded border-[var(--border-color)] bg-transparent w-3.5 h-3.5 accent-[var(--success)] hidden sm:block shrink-0" onClick={e => e.stopPropagation()} />
                                <span className="text-[var(--text-secondary)] font-mono text-[10px] sm:text-xs whitespace-nowrap shrink-0">
                                    {formatLogDate(log.timestamp)}
                                </span>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-mono shrink-0 ${isSuccess ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                    {statusCode}
                                </span>
                                <span className="text-[var(--text-secondary)] font-mono text-[10px] sm:text-xs w-10 sm:w-12 shrink-0">
                                    {httpMethod}
                                </span>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-mono shrink-0 ${log.source === 'Admin' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-900/30' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border border-purple-200 dark:border-purple-900/30'}`}>
                                    {log.source || 'Client'}
                                </span>
                                <span className="text-[var(--text-primary)] font-mono text-[10px] sm:text-xs whitespace-nowrap sm:truncate flex-1">
                                    {log.description}
                                </span>
                            </div>
                            {isExpanded && <ExpandedLogDetail log={log} />}
                        </div>
                    );
                }) : (
                    <div className="flex flex-col items-center justify-center py-16 text-[var(--text-secondary)]">
                        <Database size={32} className="opacity-50 mb-3" />
                        <p className="font-medium">Awaiting database events...</p>
                    </div>
                )}
            </div>
            
            {/* Footer */}
            <div className="p-3 border-t border-[var(--border-color)] bg-transparent flex justify-between items-center">
                {visibleCount < filteredActivity.length ? (
                    <button 
                        onClick={() => setVisibleCount(prev => prev + 30)}
                        className="text-xs text-[var(--success)] hover:text-emerald-400 transition-colors font-medium px-3 py-1.5 rounded bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 border border-emerald-500/20"
                    >
                        Load Older
                    </button>
                ) : (
                    <span className="text-xs text-[var(--text-secondary)] px-2 py-1">No more older events</span>
                )}
                <span className="text-xs text-[var(--text-secondary)]">
                    Showing {Math.min(visibleCount, filteredActivity.length)} of {filteredActivity.length} results
                </span>
            </div>
        </div>
    );
};

const MainDashboard: React.FC = () => {
    const [data, setData] = useState<MainDashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const { refreshTrigger } = useAutoRefresh();
    const location = useLocation();

    useEffect(() => {
        const loadData = async () => {
            if (!data) {
                setLoading(true);
            }
            try {
                const fetchedData = await fetchMainDashboardData();
                setData(fetchedData);
            } catch (error) {
                console.error("Failed to fetch main dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [refreshTrigger]);

    useEffect(() => {
        if (!loading && location.hash === '#activity-section') {
            const element = document.getElementById('activity-section');
            if (element) {
                setTimeout(() => {
                    const mainContainer = element.closest('main');
                    if (mainContainer) {
                        const headerOffset = 70;
                        const elementPosition = element.getBoundingClientRect().top;
                        const mainPosition = mainContainer.getBoundingClientRect().top;
                        const offsetPosition = elementPosition - mainPosition + mainContainer.scrollTop - headerOffset;
                        
                        mainContainer.scrollTo({
                            top: offsetPosition,
                            behavior: 'smooth'
                        });
                    } else {
                        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }, 100);
            }
        }
    }, [loading, location.hash]);

    if (loading && !data) {
        return <MainDashboardSkeleton />;
    }

    const totalApiRequests = data.totalApiRequests;
    const totalApiSuccess = data.successApiRequests;
    const successRate = totalApiRequests > 0 ? (totalApiSuccess / totalApiRequests) * 100 : 100;

    const currentDate = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const formatTableName = (name: string) => {
        if (!name || name === 'N/A') return 'N/A';
        return name.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ').replace('Public ', '');
    };

    const mostActiveTable = data.recentActivity && data.recentActivity.length > 0 
        ? Object.entries(data.recentActivity.reduce((acc, log) => { acc[log.table] = (acc[log.table] || 0) + 1; return acc; }, {} as Record<string, number>)).sort((a, b) => (b[1] as number) - (a[1] as number))[0]?.[0] || 'N/A'
        : 'N/A';

    return (
        <div className="space-y-6 pb-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 animate-fade-in-up">
                <div>
                    <h1 className="text-3xl font-bold text-[var(--text-primary)] tracking-tight">Welcome back, Admin 👋</h1>
                    <p className="text-[var(--text-secondary)] mt-1 font-medium">{currentDate}</p>
                </div>
            </div>
            
            <div>
                <h2 className="text-lg font-bold text-[var(--text-primary)] mb-3">Overview</h2>
                
                {/* 4 Stats Group 1 */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                    <StatCard
                        title="Total Users"
                        value={data.totalUsers}
                        description="Registered users"
                        icon={<Users size={20} />}
                        borderColor="border-sky-500"
                        info="Total registered user accounts."
                        trend={{ value: "Realtime", label: "Sync", neutral: true }}
                    />
                    <StatCard
                        title="News Articles"
                        value={data.totalArticles}
                        description="Published articles"
                        icon={<Newspaper size={20} />}
                        borderColor="border-amber-500"
                        info="Number of published news articles."
                        trend={{ value: data.recentActivity.filter(a => a.table === 'public_news_articles').length, label: "Recent", neutral: true }}
                    />
                    <StatCard
                        title="Finance Txs"
                        value={data.totalFinanceTransactions || 0}
                        description="Total transactions"
                        icon={<Wallet size={20} />}
                        borderColor="border-indigo-500"
                        info="Number of financial transactions recorded."
                        trend={{ value: "Active", label: "Status", positive: true }}
                    />
                    <StatCard
                        title="Dairy Entries"
                        value={data.totalDairyEntries || 0}
                        description="Milk records logged"
                        icon={<Droplets size={20} />}
                        borderColor="border-purple-500"
                        info="Number of dairy or milk entries logged."
                        trend={{ value: "Daily", label: "Updates", neutral: true }}
                    />
                </div>

                {/* 2 Charts Group 1 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4 animate-fade-in-up" style={{ animationDelay: '0.25s' }}>
                    <PanelCard className="rounded-xl p-5 shadow-sm h-full" borderColor="border-amber-500">
                        <div className="flex justify-between items-center mb-4 w-full">
                            <h3 className="font-bold text-base text-[var(--text-primary)]">Articles by Category</h3>
                            <InfoPopover info="Distribution of news articles grouped by category." />
                        </div>
                        {data.articlesByCategory && data.articlesByCategory.length > 0 ? (
                            <ArticlesByCategoryChart data={data.articlesByCategory} />
                        ) : (
                            <div className="h-64 flex items-center justify-center text-[var(--text-secondary)]">No category data available</div>
                        )}
                    </PanelCard>
                    <PanelCard className="rounded-xl p-5 shadow-sm h-full" borderColor="border-indigo-500">
                        <div className="flex justify-between items-center mb-4 w-full">
                            <h3 className="font-bold text-base text-[var(--text-primary)]">Finance Transactions by Type</h3>
                            <InfoPopover info="Breakdown of financial transactions by their type." />
                        </div>
                        {data.financeTransactionsByType && data.financeTransactionsByType.length > 0 ? (
                            <FinanceDistributionChart data={data.financeTransactionsByType} />
                        ) : (
                            <div className="h-64 flex items-center justify-center text-[var(--text-secondary)]">No transaction data available</div>
                        )}
                    </PanelCard>
                </div>

                {/* 4 Stats Group 2 */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                    <StatCard
                        title="Gallery Items"
                        value={data.totalGalleryItems || 0}
                        description="Uploaded images"
                        icon={<ImageIcon size={20} />}
                        borderColor="border-emerald-500"
                        info="Images or media items in the gallery."
                        trend={{ value: "Media", label: "Type", neutral: true }}
                    />
                    <StatCard
                        title="User Notes"
                        value={data.totalNotes || 0}
                        description="Saved notes"
                        icon={<FileText size={20} />}
                        borderColor="border-red-500"
                        info="Private notes written by users."
                        trend={{ value: "Private", label: "Access", neutral: true }}
                    />
                    <StatCard
                        title="Vehicles"
                        value={data.totalVehicles || 0}
                        description="Registered vehicles"
                        icon={<CarFront size={20} />}
                        borderColor="border-rose-500"
                        info="Number of registered vehicles."
                        trend={{ value: "Fleet", label: "Data", neutral: true }}
                    />
                    <StatCard
                        title="Activity Logs"
                        value={data.totalActivityLogs || 0}
                        description="All-time system logs"
                        icon={<Activity size={20} />}
                        borderColor="border-orange-500"
                        info="Total background events and actions logged."
                        trend={{ value: "All Time", label: "Range", neutral: true }}
                    />
                </div>

                {/* 2 Charts Group 2 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4 animate-fade-in-up" style={{ animationDelay: '0.35s' }}>
                    <PanelCard className="rounded-xl p-5 shadow-sm h-full" borderColor="border-emerald-500">
                        <div className="flex justify-between items-center mb-4 w-full">
                            <h3 className="font-bold text-base text-[var(--text-primary)]">Activity by Method</h3>
                            <InfoPopover info="Operations performed categorized by HTTP or database method." />
                        </div>
                        {data.recentActivity && data.recentActivity.length > 0 ? (
                            <ActivityByMethodChart data={
                                Object.entries(
                                    data.recentActivity.reduce((acc, log) => {
                                        const method = log.method || 'UNKNOWN';
                                        acc[method] = (acc[method] || 0) + 1;
                                        return acc;
                                    }, {} as Record<string, number>)
                                ).map(([name, value]) => ({ name, value: value as number }))
                            } />
                        ) : (
                            <div className="h-64 flex items-center justify-center text-[var(--text-secondary)]">No activity logs available</div>
                        )}
                    </PanelCard>
                    <PanelCard className="rounded-xl p-5 shadow-sm h-full" borderColor="border-sky-500">
                        <div className="flex justify-between items-center mb-4 w-full">
                            <h3 className="font-bold text-base text-[var(--text-primary)]">Database Events Timeline (Last 24h)</h3>
                            <InfoPopover info="Volume of database events over the last 24 hours." />
                        </div>
                        {data.recentActivity && data.recentActivity.length > 0 ? (
                            <DatabaseEventsTimelineChart data={
                                (() => {
                                    const counts: Record<string, number> = {};
                                    const now = new Date();
                                    // Initialize last 24 hours with 0
                                    for (let i = 23; i >= 0; i--) {
                                        const d = new Date(now.getTime() - i * 60 * 60 * 1000);
                                        const hour = d.getHours();
                                        const ampm = hour >= 12 ? 'PM' : 'AM';
                                        const formattedHour = `${hour % 12 || 12} ${ampm}`;
                                        counts[formattedHour] = 0;
                                    }
                                    
                                    data.recentActivity.forEach(log => {
                                        const d = new Date(log.timestamp);
                                        // Only count if within last 24 hours
                                        if (now.getTime() - d.getTime() <= 24 * 60 * 60 * 1000) {
                                            const hour = d.getHours();
                                            const ampm = hour >= 12 ? 'PM' : 'AM';
                                            const formattedHour = `${hour % 12 || 12} ${ampm}`;
                                            if (counts[formattedHour] !== undefined) {
                                                counts[formattedHour]++;
                                            }
                                        }
                                    });
                                    
                                    return Object.entries(counts).map(([time, count]) => ({ time, count }));
                                })()
                            } />
                        ) : (
                            <div className="h-64 flex items-center justify-center text-[var(--text-secondary)]">No activity data available</div>
                        )}
                    </PanelCard>
                </div>
            </div>
            
            <div id="activity-section" className="animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
                <LiveDatabaseLogs initialActivity={data.recentActivity} />
            </div>
        </div>
    );
};

export default MainDashboard;