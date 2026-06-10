import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ConfirmationModal, BatchActionToolbar } from '../components/ui';
import { NewsAdminPageSkeleton } from '../components/skeletons';
import { fetchNewsAdminData, fetchNewsEngagementData, deleteNewsLog, deleteNewsLogsBatch, runNewsUpdateEdgeFunction, checkRecentNewsUpdateLog, fetchNewsUpdateStatus, setNewsUpdateStatus, upsertNewsSystemConfig, dbMain } from '../services/supabaseService';
import type { NewsLog, NewsConfig, ArticleEngagementData } from '../types';
import { Zap, Loader2 } from 'lucide-react';
import NewsAnalytics from '../components/news/NewsAnalytics';
import NewsLogs from '../components/news/NewsLogs';
import NewsSettings from '../components/news/NewsSettings';
import NewsEngagement from '../components/news/NewsEngagement';
import NewsLogDetail from '../components/news/NewsLogDetail';
import NewsContentManager from '../components/news/NewsContentManager';
import { useAutoRefresh } from '../components/AutoRefreshContext';

const BouncingDots = () => {
    return (
        <div className="flex gap-1.5 items-center justify-center h-5 drop-shadow-md mix-blend-normal">
            <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0 }} className="w-1.5 h-1.5 bg-white rounded-full" />
            <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.15 }} className="w-1.5 h-1.5 bg-white rounded-full" />
            <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.3 }} className="w-1.5 h-1.5 bg-white rounded-full" />
        </div>
    );
};

const NewsAdminPage: React.FC<{ isScrolled?: boolean }> = ({ isScrolled = false }) => {
    const location = useLocation();
    const [view, setView] = useState('engagement');
    const { refreshTrigger } = useAutoRefresh();

    const [logs, setLogs] = useState<NewsLog[]>([]);
    const [config, setConfig] = useState<NewsConfig>({ gnews_api_keys: [], gemini_api_keys: [] });
    const [engagementData, setEngagementData] = useState<ArticleEngagementData | null>(null);
    const [loading, setLoading] = useState(true);
    
    const [deleteConfirmation, setDeleteConfirmation] = useState<{ ids: number[]; isBatch: boolean } | null>(null);
    const [runConfirmationOpen, setRunConfirmationOpen] = useState(false);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedLogs, setSelectedLogs] = useState<Set<number>>(new Set());

    const { logId } = useParams();
    const navigate = useNavigate();
    const selectedLogId = logId ? parseInt(logId, 10) : null;
    const setSelectedLogId = (id: number | null) => {
        const currentHash = location.hash;
        if (id) {
            navigate(`/news/${id}${currentHash}`);
        } else {
            // Only navigate if we're currently on a logId path
            if (logId) {
                navigate(`/news${currentHash}`);
            }
        }
    };
    const [dateRange, setDateRange] = useState<{ startDate: Date | null, endDate: Date | null }>({ startDate: null, endDate: null });
    const [isUpdatingNews, setIsUpdatingNews] = useState(false);
    const [lastRunTrigger, setLastRunTrigger] = useState('cron');

    const isUnloading = useRef(false);
    const completionAudioRef = useRef<HTMLAudioElement | null>(null);
    const prevIsUpdatingRef = useRef<boolean>(false);

    useEffect(() => {
        completionAudioRef.current = new Audio('/universfield-system-notification-02-352442.mp3');
    }, []);

    useEffect(() => {
        if (prevIsUpdatingRef.current === true && isUpdatingNews === false) {
            const isEnabled = localStorage.getItem('admin_audio_completion_enabled') !== 'false';
            if (isEnabled && completionAudioRef.current) {
                const currentUrl = localStorage.getItem('admin_audio_completion_url') || '/universfield-system-notification-02-352442.mp3';
                if (!completionAudioRef.current.src.endsWith(currentUrl)) {
                    completionAudioRef.current.src = currentUrl;
                }
                completionAudioRef.current.currentTime = 0;
                completionAudioRef.current.volume = 0.5;
                completionAudioRef.current.play().catch(e => console.error("Failed to play completion sound:", e));
            }
        }
        prevIsUpdatingRef.current = isUpdatingNews;
    }, [isUpdatingNews]);
    
    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [{ logs, config }, engagementData] = await Promise.all([
                fetchNewsAdminData(),
                fetchNewsEngagementData()
            ]);
            setLogs(logs as NewsLog[]);
            setConfig(config);
            setEngagementData(engagementData);
        } catch (error) {
            console.error("Failed to fetch News admin data:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial status fetch and Realtime subscription
    useEffect(() => {
        const getInitialStatus = async () => {
            const { isUpdating, lastTrigger } = await fetchNewsUpdateStatus();
            setIsUpdatingNews(isUpdating);
            setLastRunTrigger(lastTrigger);
        };
        getInitialStatus();

        const channel = dbMain.channel('news-update-status')
            .on(
                'postgres_changes',
                { 
                    event: '*', 
                    schema: 'public', 
                    table: 'news_system_config'
                },
                (payload) => {
                    const newValue = payload.new as any;
                    if (newValue) {
                        if (newValue.config_key === 'is_news_updating') {
                            const val = newValue.config_value;
                            // Handle boolean, string 'true', or JSON string '"true"'
                            const isUpdating = val === true || val === 'true' || val === '"true"';
                            
                            setIsUpdatingNews(isUpdating);

                            if (!isUpdating) {
                                // If it just finished, reload data
                                loadData();
                            }
                        } else if (newValue.config_key === 'last_run_trigger') {
                            setLastRunTrigger(String(newValue.config_value).replace(/"/g, ''));
                        }
                    }
                }
            )
            .subscribe();

        return () => {
            dbMain.removeChannel(channel);
        };
    }, [loadData]);

    useEffect(() => {
        const handleBeforeUnload = () => {
            isUnloading.current = true;
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, []);
    
    useEffect(() => {
        loadData();
    }, [loadData, refreshTrigger]);

    useEffect(() => {
        const hash = location.hash.replace('#', '');
        if (['engagement', 'content', 'analytics', 'logs', 'settings'].includes(hash)) {
            setView(hash);
            if (hash !== 'logs') {
                setSelectedLogId(null);
            }
        } else {
            setView('engagement');
        }
    }, [location.hash]);
    
    const triggerHapticFeedback = () => {
        if (window.navigator && window.navigator.vibrate) {
            window.navigator.vibrate(20); // A shorter, subtle vibration
        }
    };
    
    const handleDeleteRequest = (id: number) => {
        setDeleteConfirmation({ ids: [id], isBatch: false });
    };

    const handleBatchDeleteRequest = () => {
        if (selectedLogs.size > 0) {
            setDeleteConfirmation({ ids: Array.from(selectedLogs), isBatch: true });
        }
    };

    const handleConfirmDelete = async () => {
        if (!deleteConfirmation) return;

        const { ids, isBatch } = deleteConfirmation;
        const { error } = isBatch
            ? await deleteNewsLogsBatch(ids)
            : await deleteNewsLog(ids[0]);
        
        setDeleteConfirmation(null); // Close modal

        if (error) {
            alert(`Failed to delete log(s): ${error.message}`);
        } else {
            if (isBatch) {
                handleCancelSelection(); // Exit selection mode
            }
            // Optimistic update instead of full reload
            setLogs(prevLogs => prevLogs.filter(log => !ids.includes(log.id)));
        }
    };
    
    const handleStartSelection = (logId: number) => {
        triggerHapticFeedback();
        setIsSelectionMode(true);
        setSelectedLogs(new Set([logId]));
    };

    const handleToggleSelection = (logId: number) => {
        triggerHapticFeedback();
        const newSelection = new Set(selectedLogs);
        if (newSelection.has(logId)) {
            newSelection.delete(logId);
        } else {
            newSelection.add(logId);
        }
        
        if (newSelection.size === 0) {
            setIsSelectionMode(false);
        }
        setSelectedLogs(newSelection);
    };

    const handleCancelSelection = () => {
        setIsSelectionMode(false);
        setSelectedLogs(new Set());
    };

    const handleSelectAll = () => {
        triggerHapticFeedback();
        const allLogIds = logs.map(l => l.id);
        if (selectedLogs.size === allLogIds.length) {
            // All selected, so deselect all
            setSelectedLogs(new Set());
            setIsSelectionMode(false);
        } else {
            // Some or none selected, so select all
            setSelectedLogs(new Set(allLogIds));
            setIsSelectionMode(true);
        }
    };

    const handleRunNewsUpdate = async () => {
        setRunConfirmationOpen(true);
    };

    const confirmRunNewsUpdate = async () => {
        setRunConfirmationOpen(false);
        if (isUpdatingNews) return;
        
        // Optimistically set UI and update DB
        setIsUpdatingNews(true);
        setLastRunTrigger('manual');
        await setNewsUpdateStatus(true);
        await upsertNewsSystemConfig('last_run_trigger', 'manual');
        
        try {
            const { error } = await runNewsUpdateEdgeFunction('manual');
            if (error) {
                if (!isUnloading.current) {
                    alert(`Failed to run news update: ${error.message}`);
                    setIsUpdatingNews(false);
                    await setNewsUpdateStatus(false);
                }
            }
        } catch (error: any) {
            if (!isUnloading.current) {
                alert(`Error running news update: ${error.message}`);
                setIsUpdatingNews(false);
                await setNewsUpdateStatus(false);
            }
        }
    };

    const filteredLogsByDate = useMemo(() => {
        if (!dateRange.startDate || !dateRange.endDate) {
            return logs;
        }
        return logs.filter(log => {
            const logDate = new Date(log.created_at);
            return logDate >= dateRange.startDate! && logDate <= dateRange.endDate!;
        });
    }, [logs, dateRange]);

    const analyticsData = useMemo(() => {
        const relevantLogs = filteredLogsByDate;
        const totalRuns = relevantLogs.length;
        const successfulRuns = relevantLogs.filter(l => l.status === 'SUCCESS').length;
        const successRate = totalRuns > 0 ? ((successfulRuns / totalRuns) * 100).toFixed(1) : '100.0';
        const avgDuration = totalRuns > 0 ? (relevantLogs.reduce((acc, l) => acc + l.duration_ms, 0) / totalRuns / 1000).toFixed(2) : '0';
        const articlesUpdated = relevantLogs.reduce((acc, l) => {
            const summaryLine = l.summary?.find(s => s.includes('Total Articles Updated'));
            return acc + (parseInt(summaryLine?.split(': ')[1] || '0', 10));
        }, 0);
        
        return { totalRuns, successRate, avgDuration, articlesUpdated };
    }, [filteredLogsByDate]);

    if (loading && logs.length === 0 && !config) {
        return <NewsAdminPageSkeleton view={view} />;
    }

    const selectedLog = logs.find(log => log.id === selectedLogId);

    const lastRunLog = logs[0];
    const lastRunSource = lastRunLog?.summary?.find(s => s.startsWith('Source: '))?.replace('Source: ', '') || 'Automatic';
    const lastRunTime = lastRunLog ? new Date(lastRunLog.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Never';

    const navRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (navRef.current) {
            const activeTab = navRef.current.querySelector('.active') as HTMLElement;
            if (activeTab) {
                const container = navRef.current;
                const scrollLeft = activeTab.offsetLeft - container.offsetWidth / 2 + activeTab.offsetWidth / 2;
                container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
            }
        }
    }, [view]);

    const renderViewContent = () => {
        if (view === 'logs' && selectedLog) {
            return <NewsLogDetail log={selectedLog} onBack={() => setSelectedLogId(null)} />;
        }

        switch (view) {
            case 'engagement':
                return <NewsEngagement engagementData={engagementData} onRefresh={loadData} />;
            case 'content':
                return <NewsContentManager />;
            case 'analytics':
                return <NewsAnalytics logs={filteredLogsByDate} analyticsData={analyticsData} onDateChange={setDateRange} />;
            case 'logs':
                return <NewsLogs 
                    logs={logs} 
                    onShowDetails={(id) => setSelectedLogId(id)} 
                    onDelete={handleDeleteRequest} 
                    isSelectionMode={isSelectionMode}
                    selectedLogs={selectedLogs}
                    onStartSelection={handleStartSelection}
                    onToggleSelection={handleToggleSelection}
                    onSelectAll={handleSelectAll}
                    isScrolled={isScrolled}
                />;
            case 'settings':
                return <NewsSettings currentConfig={config} onUpdate={loadData} />;
            default:
                // Safeguard to render the default view instead of null
                return <NewsEngagement engagementData={engagementData} onRefresh={loadData} />;
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="pill-nav-container !mb-0" ref={navRef}>
                    <div className="pill-nav">
                        {[
                            {id: 'engagement', label: 'Engagement'},
                            {id: 'content', label: 'Content'},
                            {id: 'analytics', label: 'Analytics'}, 
                            {id: 'logs', label: 'Logs'},
                            {id: 'settings', label: 'Settings'},
                        ].map(v => (
                            <Link 
                                key={v.id} 
                                to={`${location.pathname}#${v.id}`}
                                className={`pill-nav-item ${view === v.id ? 'active' : ''}`}
                            >
                                {v.label}
                            </Link>
                        ))}
                    </div>
                </div>
                <div className="flex flex-row items-center gap-2 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
                    {lastRunLog && (
                        <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 h-7 sm:h-8 bg-slate-100 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700/50 rounded-full shadow-sm text-[10px] sm:text-xs font-medium text-slate-600 dark:text-zinc-400 transition-colors">
                            <div className="relative flex h-2 w-2 shrink-0">
                                {isUpdatingNews && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>}
                                <span className={`relative inline-flex rounded-full h-2 w-2 ${isUpdatingNews ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                            </div>
                            <span className="whitespace-nowrap">
                                Last: <span className="text-slate-800 dark:text-zinc-200">{lastRunTime}</span>
                                <span className="text-slate-400 dark:text-zinc-500 ml-1">({lastRunTrigger === 'manual' ? 'Manual' : 'System'})</span>
                            </span>
                        </div>
                    )}
                    <motion.button 
                        layout
                        whileHover={!isUpdatingNews ? { scale: 1.02, filter: "brightness(1.1)" } : {}}
                        whileTap={!isUpdatingNews ? { scale: 0.96 } : {}}
                        onClick={handleRunNewsUpdate} 
                        disabled={isUpdatingNews}
                        className={`relative overflow-hidden flex flex-row items-center justify-center text-[10px] sm:text-xs font-semibold transition-all duration-300 shrink-0 px-4 sm:px-5 h-7 sm:h-8 rounded-full cursor-pointer border ${
                            isUpdatingNews 
                                ? 'bg-slate-900 border-transparent text-white cursor-wait shadow-[0_0_15px_rgba(56,189,248,0.3)] scale-[0.98]' 
                                : 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-indigo-500/25 shadow-md border-transparent hover:shadow-indigo-500/40'
                        }`}
                    >
                        <AnimatePresence mode="wait">
                            {isUpdatingNews ? (
                                <motion.div 
                                    key="updating"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.15 }}
                                    className="flex flex-row items-center justify-center z-10 min-w-[70px] sm:min-w-[85px]"
                                >
                                    <BouncingDots />
                                </motion.div>
                            ) : (
                                <motion.div 
                                    key="idle"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.15 }}
                                    className="flex flex-row items-center gap-1.5 sm:gap-2 z-10"
                                >
                                    <Zap size={14} className="fill-white/20 sm:w-[14px] sm:h-[14px]" />
                                    <span>Run Update</span>
                                </motion.div>
                            )}
                        </AnimatePresence>
                        
                        {/* Fluid AI-like Loading Background (ChatGPT Image Gen style) */}
                        {isUpdatingNews && (
                            <div className="absolute inset-0 z-0 bg-slate-950 overflow-hidden pointer-events-none rounded-full">
                                <motion.div
                                    className="absolute mix-blend-screen filter blur-[10px] sm:blur-[12px] opacity-90 rounded-full"
                                    style={{ width: '140%', height: '200%', background: '#38bdf8', left: '-25%', top: '-50%' }}
                                    animate={{ 
                                        x: ['0%', '15%', '-5%', '0%'], 
                                        y: ['0%', '25%', '-10%', '0%'],
                                        scale: [1, 1.25, 0.9, 1],
                                        rotate: [0, 90, 180, 360]
                                    }}
                                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                                />
                                <motion.div
                                    className="absolute mix-blend-screen filter blur-[12px] sm:blur-[14px] opacity-90 rounded-full"
                                    style={{ width: '120%', height: '180%', background: '#a855f7', right: '-10%', top: '-20%' }}
                                    animate={{ 
                                        x: ['0%', '-20%', '10%', '0%'], 
                                        y: ['0%', '-15%', '25%', '0%'],
                                        scale: [1, 0.85, 1.15, 1],
                                        rotate: [360, 180, 90, 0]
                                    }}
                                    transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                                />
                                <motion.div
                                    className="absolute mix-blend-screen filter blur-[8px] sm:blur-[10px] opacity-80 rounded-full"
                                    style={{ width: '100%', height: '150%', background: '#ec4899', left: '20%', top: '-30%' }}
                                    animate={{ 
                                        x: ['0%', '20%', '-10%', '0%'], 
                                        y: ['0%', '15%', '-20%', '0%'],
                                        scale: [0.9, 1.3, 0.85, 0.9],
                                        rotate: [0, -90, -180, -360]
                                    }}
                                    transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
                                />
                                <div className="absolute inset-0 bg-black/10 mix-blend-overlay"></div>
                                <div className="absolute inset-0 shadow-[inset_0_0_12px_rgba(0,0,0,0.6)] rounded-full border border-white/5"></div>
                            </div>
                        )}
                        {/* Glow effect for idle state */}
                        {!isUpdatingNews && (
                            <motion.div
                                className="absolute inset-0 z-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                                initial={{ x: '-100%' }}
                                whileHover={{ x: '100%' }}
                                transition={{ duration: 0.6, ease: "easeInOut" }}
                            />
                        )}
                    </motion.button>
                </div>
            </div>
            {renderViewContent()}
            {isSelectionMode && (
                <BatchActionToolbar
                    selectedCount={selectedLogs.size}
                    onCancel={handleCancelSelection}
                    onDelete={handleBatchDeleteRequest}
                />
            )}
            <ConfirmationModal
                isOpen={deleteConfirmation !== null}
                onClose={() => setDeleteConfirmation(null)}
                onConfirm={handleConfirmDelete}
                title="Confirm Log Deletion"
                message={
                    deleteConfirmation?.isBatch 
                        ? <>Are you sure you want to permanently delete <strong>{deleteConfirmation.ids.length} log records</strong>? This action cannot be undone.</>
                        : <>Are you sure you want to permanently delete this log record? This action cannot be undone.</>
                }
                confirmText={deleteConfirmation?.isBatch ? `Delete ${deleteConfirmation.ids.length} Logs` : "Delete Log"}
                confirmButtonClass="btn-danger"
            />
            <ConfirmationModal
                isOpen={runConfirmationOpen}
                onClose={() => setRunConfirmationOpen(false)}
                onConfirm={confirmRunNewsUpdate}
                title="Confirm News Update"
                message={<>Are you sure you want to run the news update manually right now? This may consume API requests and take a few moments.</>}
                confirmText="Run Update"
                confirmButtonClass="btn-primary"
            />
        </div>
    );
};

export default NewsAdminPage;