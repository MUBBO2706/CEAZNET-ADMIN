import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAutoRefresh, useCountdown } from './AutoRefreshContext';
import { Sparkles, Bell, X, CheckCircle, Plus, Edit2, Trash2, Database, Clock, Eye, MessageSquare, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { dbMain, fetchLiveActivityLogs } from '../services/supabaseService';
import type { RecentActivityLog } from '../types';
import { ExpandedLogDetail } from '../pages/MainDashboard';
import { motion, AnimatePresence } from 'motion/react';
import { BroadcastTab } from './BroadcastTab';
import { Megaphone, LayoutList } from 'lucide-react';
import { usePlatformSettings } from './PlatformSettingsContext';

function formatRelativeTime(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
}

const getIcon = (method: string) => {
    switch(method) {
        case 'INSERT': return <Plus size={12} className="text-emerald-500 dark:text-emerald-400" />;
        case 'UPDATE': return <Edit2 size={12} className="text-blue-500 dark:text-blue-400" />;
        case 'DELETE': return <Trash2 size={12} className="text-red-500 dark:text-red-400" />;
        default: return <Database size={12} className="text-slate-500 dark:text-zinc-400" />;
    }
};

const NotificationBell: React.FC = () => {
    const [logs, setLogs] = useState<RecentActivityLog[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'activity' | 'broadcast'>('activity');
    const [expandedLog, setExpandedLog] = useState<string | number | null>(null);
    const [readLogIds, setReadLogIds] = useState<Set<string>>(() => {
        try {
            const saved = localStorage.getItem('ceaznet-read-logs');
            return saved ? new Set(JSON.parse(saved)) : new Set();
        } catch {
            return new Set();
        }
    });

    const displayLogs = logs.slice(0, 30);
    const unreadCount = displayLogs.filter(log => !readLogIds.has(String(log.id))).length;
    const hasUnread = unreadCount > 0;
    
    const [shakeBell, setShakeBell] = useState(false);
    const prevUnreadCountRef = useRef(unreadCount);

    useEffect(() => {
        if (unreadCount > prevUnreadCountRef.current) {
            setShakeBell(true);
            setTimeout(() => setShakeBell(false), 500);
        }
        prevUnreadCountRef.current = unreadCount;
    }, [unreadCount]);

    const dropdownRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const lastPlayedTimeRef = useRef<number>(0);

    useEffect(() => {
        audioRef.current = new Audio('/notification.mp3');
    }, []);

    const playNotificationSound = () => {
        const isEnabled = localStorage.getItem('admin_audio_notifications_enabled') !== 'false';
        if (!isEnabled) return;

        const currentUrl = localStorage.getItem('admin_audio_notifications_url') || '/notification.mp3';
        const now = Date.now();
        
        // Cooldown of 1 second (1000ms) to handle high frequency bursts
        if (now - lastPlayedTimeRef.current > 1000) {
            if (audioRef.current) {
                // Only update src if it changed to avoid reloading the same audio
                if (!audioRef.current.src.endsWith(currentUrl)) {
                    audioRef.current.src = currentUrl;
                }
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch(e => {
                    // Browsers often block audio until user interaction
                    console.log('Notification sound blocked or failed:', e.message);
                });
                lastPlayedTimeRef.current = now;
            }
        }
    };

    useEffect(() => {
        let isMounted = true;

        // Fetch initial logs
        const fetchInitial = async () => {
            try {
                const initialLogs = await fetchLiveActivityLogs();
                if (!isMounted) return;
                setLogs(initialLogs.slice(0, 1000)); // Increased limit to 1000 to show all unread logs
            } catch (error) {
                console.error("Failed to fetch initial activity logs for bell:", error);
            }
        };
        fetchInitial();

        // Subscribe to real-time changes
        const channel = dbMain.channel('header-activity-logs')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'activity_logs' },
                (payload) => {
                    const item = payload.new;
                    const newLog: RecentActivityLog = {
                        id: `realtime-${item.id}`,
                        type: 'realtime',
                        table: item.table_name,
                        method: (item.operation || item.action_type) as any,
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
                    
                    setLogs(prev => {
                        const updated = [newLog, ...prev].slice(0, 1000); // Increased limit to 1000
                        return updated;
                    });
                    playNotificationSound();
                }
            )
            .subscribe();

        return () => {
            isMounted = false;
            dbMain.removeChannel(channel);
        };
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Element;
            if (target.closest('.modal-bg') || target.closest('[role="dialog"]') || target.closest('.custom-dropdown-panel')) {
                return;
            }
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setExpandedLog(null);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handleOpen = () => {
        if (!isOpen) {
            setIsOpen(true);
        } else {
            setIsOpen(false);
            setExpandedLog(null);
        }
    };

    const handleNavigate = () => {
        setIsOpen(false);
        setExpandedLog(null);
        if (window.location.hash === '#activity-section') {
            const element = document.getElementById('activity-section');
            const mainContainer = element?.closest('main');
            if (element && mainContainer) {
                const headerOffset = 70;
                const elementPosition = element.getBoundingClientRect().top;
                const mainPosition = mainContainer.getBoundingClientRect().top;
                const offsetPosition = elementPosition - mainPosition + mainContainer.scrollTop - headerOffset;
                mainContainer.scrollTo({ top: offsetPosition, behavior: 'smooth' });
            }
        } else {
            navigate('/#activity-section'); 
        }
    };

    const markAllAsRead = (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const newReadIds = new Set(readLogIds);
        logs.forEach(log => newReadIds.add(String(log.id)));
        setReadLogIds(newReadIds);
        localStorage.setItem('ceaznet-read-logs', JSON.stringify(Array.from(newReadIds)));
    };

    const markAsRead = (logId: string | number) => {
        const strId = String(logId);
        if (!readLogIds.has(strId)) {
            const newReadIds = new Set(readLogIds);
            newReadIds.add(strId);
            setReadLogIds(newReadIds);
            localStorage.setItem('ceaznet-read-logs', JSON.stringify(Array.from(newReadIds)));
        }
    };

    const handleLogClick = (logId: string | number) => {
        const isCurrentlyExpanded = expandedLog === logId;
        setExpandedLog(isCurrentlyExpanded ? null : logId);
        markAsRead(logId);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={handleOpen}
                className="relative p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                aria-label="Notifications"
            >
                <motion.div animate={shakeBell ? { rotate: [0, -20, 20, -10, 10, 0] } : {}} transition={{ duration: 0.5 }}>
                    <Bell size={18} className={hasUnread ? "fill-blue-500/10 text-blue-500 dark:text-blue-400" : ""} />
                </motion.div>
                
                <AnimatePresence>
                    {hasUnread && (
                        <motion.span 
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            className="absolute top-1.5 right-1.5 w-[7px] h-[7px] rounded-full bg-red-500 ring-[1.5px] ring-white dark:ring-zinc-900"
                        />
                    )}
                </AnimatePresence>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.98 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className={`absolute right-0 mt-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] z-50 overflow-hidden flex flex-col origin-top-right ring-1 ring-black/5 dark:ring-white/10 transition-all duration-300 ${activeTab === 'broadcast' ? 'w-[360px] sm:w-[450px] max-h-[85vh] h-[600px] sm:h-[650px]' : 'w-[340px] sm:w-[400px] max-h-[65vh] sm:max-h-[70vh]'}`}
                    >
                        {/* Header Tabs */}
                        <div className="px-3 py-3 border-b border-slate-100 dark:border-zinc-800/80 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md sticky top-0 flex flex-col gap-3 z-10 shrink-0">
                            <div className="flex bg-slate-100 dark:bg-zinc-800/80 p-1 rounded-xl">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setActiveTab('activity'); }}
                                    className={`flex-1 rounded-lg text-[12px] font-semibold py-1.5 transition-all outline-none flex items-center justify-center gap-1.5 ${activeTab === 'activity' ? 'bg-white dark:bg-zinc-700 text-slate-800 dark:text-zinc-100 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300'}`}
                                >
                                    <LayoutList size={14} />
                                    Activity Logs 
                                    {hasUnread && <span className="ml-0.5 text-[9px] bg-red-500 text-white px-1.5 py-0.5 rounded-full">{unreadCount}</span>}
                                </button>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setActiveTab('broadcast'); }}
                                    className={`flex-1 rounded-lg text-[12px] font-semibold py-1.5 transition-all outline-none flex items-center justify-center gap-1.5 ${activeTab === 'broadcast' ? 'bg-indigo-600 text-white shadow-[0_2px_10px_-2px_rgba(79,70,229,0.4)]' : 'text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300'}`}
                                >
                                    <Sparkles size={14} className={activeTab === 'broadcast' ? 'text-indigo-200' : ''} />
                                    AI Broadcast
                                </button>
                            </div>
                            
                            {activeTab === 'activity' && (
                                <div className="flex items-center justify-between px-2 h-4">
                                    <span className="text-[10px] text-slate-400 font-medium tracking-wide uppercase">Recent system events</span>
                                    {hasUnread && (
                                        <button 
                                            onClick={markAllAsRead}
                                            className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 hover:text-blue-700 font-semibold transition-colors"
                                        >
                                            <CheckCircle size={10} />
                                            Mark all read
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                        
                        {/* Body Container */}
                        <div className="flex-1 overflow-y-auto relative flex flex-col min-h-[300px]">
                            {activeTab === 'activity' ? (
                                <div className="flex flex-col p-0 sleek-scrollbar bg-slate-50/30 dark:bg-zinc-900/20">
                                    {displayLogs.length === 0 ? (
                                        <div className="p-8 text-center flex flex-col items-center justify-center gap-3 text-slate-400 dark:text-zinc-500 h-40">
                                            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center mb-2">
                                                <Bell size={20} className="text-slate-300 dark:text-zinc-600" />
                                            </div>
                                            <span className="text-[13px] font-medium text-slate-600 dark:text-zinc-300">You're all caught up!</span>
                                            <span className="text-[11px] font-medium opacity-70">No activity to show right now.</span>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col">
                                            {displayLogs.map((log, idx) => {
                                                const isExpanded = expandedLog === (log.id || idx);
                                                const isRead = readLogIds.has(String(log.id || idx));
                                                
                                                return (
                                                    <motion.div 
                                                        layout="position"
                                                        key={log.id || idx} 
                                                        className={`group relative flex flex-col border-b border-slate-100 dark:border-zinc-800/50 last:border-0 transition-all duration-300 ${isRead ? 'bg-white hover:bg-slate-50/80 dark:bg-zinc-900 dark:hover:bg-zinc-800/40' : 'bg-blue-50/40 hover:bg-blue-50/80 dark:bg-blue-900/10 dark:hover:bg-blue-900/20'}`}
                                                    >
                                                        <div 
                                                            className="flex gap-3 px-4 py-3.5 cursor-pointer relative"
                                                            onClick={() => handleLogClick(log.id || idx)}
                                                        >
                                                            {/* Unread indicator dot */}
                                                            <div className={`absolute left-0 top-0 bottom-0 w-0.5 transition-opacity ${!isRead ? 'bg-blue-500 opacity-100' : 'opacity-0'}`} />
                                                            
                                                            {/* Icon */}
                                                            <div className={`mt-0.5 flex items-center justify-center w-7 h-7 rounded-full shrink-0 border shadow-sm ${
                                                                log.method === 'INSERT' ? 'bg-emerald-50 border-emerald-100/50 dark:bg-emerald-500/10 dark:border-emerald-500/20' :
                                                                log.method === 'UPDATE' ? 'bg-blue-50 border-blue-100/50 dark:bg-blue-500/10 dark:border-blue-500/20' :
                                                                log.method === 'DELETE' ? 'bg-red-50 border-red-100/50 dark:bg-red-500/10 dark:border-red-500/20' :
                                                                'bg-slate-50 border-slate-200/50 dark:bg-slate-500/10 dark:border-slate-500/20'
                                                            }`}>
                                                                {getIcon(log.method)}
                                                            </div>
                            
                                                            {/* Content */}
                                                            <div className="flex-1 min-w-0 pr-4">
                                                                <div className="flex justify-between items-start gap-2 mb-1">
                                                                    <span className={`text-[12px] font-semibold truncate ${!isRead ? 'text-slate-800 dark:text-zinc-100' : 'text-slate-600 dark:text-zinc-400'}`}>
                                                                        {log.table}
                                                                    </span>
                                                                    <span className="text-[10px] font-medium text-slate-400 dark:text-zinc-500 shrink-0 flex items-center gap-1.5 mt-0.5">
                                                                        <Clock size={10} className="opacity-70" />
                                                                        {formatRelativeTime(log.timestamp)}
                                                                    </span>
                                                                </div>
                                                                <p className={`text-[11px] leading-relaxed line-clamp-2 ${!isRead ? 'text-slate-600 font-medium dark:text-zinc-300' : 'text-slate-500 dark:text-zinc-500'}`}>
                                                                    {log.description}
                                                                </p>
                                                            </div>
                            
                                                            {/* Action icons (hover) */}
                                                            {!isRead && (
                                                                <button 
                                                                    onClick={(e) => { e.stopPropagation(); markAsRead(log.id || idx); }}
                                                                    className="opacity-0 group-hover:opacity-100 absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white dark:bg-zinc-800 rounded-full shadow-md text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-all scale-95 hover:scale-105 border border-slate-100 dark:border-zinc-700"
                                                                    title="Mark as read"
                                                                >
                                                                    <Eye size={13} strokeWidth={2.5} />
                                                                </button>
                                                            )}
                                                        </div>
                                                        <AnimatePresence>
                                                            {isExpanded && (
                                                                <motion.div
                                                                    initial={{ height: 0, opacity: 0 }}
                                                                    animate={{ height: 'auto', opacity: 1 }}
                                                                    exit={{ height: 0, opacity: 0 }}
                                                                    className="overflow-hidden border-t border-slate-100/50 dark:border-zinc-800/30 bg-slate-50/50 dark:bg-black/10"
                                                                >
                                                                    <div className="p-3">
                                                                        <ExpandedLogDetail log={log} />
                                                                    </div>
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>
                                                    </motion.div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <BroadcastTab />
                            )}
                        </div>
                        
                        {/* Footer - Only visible for Activity logs */}
                        {activeTab === 'activity' && (
                            <div className="px-3 py-2 border-t border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 border-b-0 rounded-b-2xl shrink-0 flex items-center gap-2">
                                <button 
                                    onClick={handleNavigate}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:text-blue-600 dark:text-zinc-300 dark:hover:text-blue-400 hover:bg-slate-50 dark:hover:bg-zinc-800/50 rounded-lg transition-all"
                                >
                                    View Complete Activity History
                                </button>
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setLogs(prev => prev.filter(log => !readLogIds.has(String(log.id))));
                                    }}
                                    className="flex-shrink-0 px-3 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:text-red-600 dark:text-zinc-300 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all border border-transparent hover:border-red-100 dark:hover:border-red-500/30"
                                    title="Hide all read logs"
                                >
                                    <Trash2 size={13} />
                                    Hide All Read
                                </button>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
            
            {/* The previous BroadcastModal line was here, now removed */}
        </div>
    );
};

const SupportInboxIcon: React.FC = () => {
    const [unreadCount, setUnreadCount] = useState(0);
    const navigate = useNavigate();

    useEffect(() => {
        let isMounted = true;

        const fetchCount = async () => {
             const { count, error } = await dbMain
                .from('support_messages')
                .select('*', { count: 'exact', head: true })
                .eq('is_read', false)
                .eq('sender_type', 'user');
                
            if (!error && isMounted) {
                 setUnreadCount(count || 0);
            }
        };

        fetchCount();

        const channel = dbMain.channel('header-support-messages')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'support_messages' },
                () => {
                    fetchCount();
                }
            )
            .subscribe();

        return () => {
            isMounted = false;
            dbMain.removeChannel(channel);
        };
    }, []);

    const handleClick = () => {
        navigate('/support-inbox');
    };

    return (
        <button
            onClick={handleClick}
            className="relative p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
            aria-label="Support Inbox"
            title="Support Inbox"
        >
            <MessageSquare size={18} />
            <AnimatePresence>
                {unreadCount > 0 && (
                    <motion.span 
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        className="absolute top-1.5 right-1.5 w-[7px] h-[7px] rounded-full bg-red-500 ring-[1.5px] ring-white dark:ring-zinc-900"
                    />
                )}
            </AnimatePresence>
        </button>
    );
};

const CustomRefreshIcon = ({ size = 18, className = '' }: { size?: number, className?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
        <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
        <path d="M16 21v-5h5" />
    </svg>
);

const GlobalRefreshButton: React.FC = () => {
    const { refreshRate, setRefreshRate, triggerRefresh, refreshTrigger } = useAutoRefresh();
    const countdown = useCountdown();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isSpinning, setIsSpinning] = useState(false);
    const pressTimer = useRef<NodeJS.Timeout | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const handlePressStart = () => {
        pressTimer.current = setTimeout(() => {
            setIsDropdownOpen(true);
            pressTimer.current = null;
        }, 500); // 500ms for long press
    };

    const handlePressEnd = () => {
        if (pressTimer.current) {
            clearTimeout(pressTimer.current);
            pressTimer.current = null;
            // It was a short click
            if (!isDropdownOpen) {
                handleManualRefresh();
            }
        }
    };

    const handleManualRefresh = () => {
        triggerRefresh();
    };

    useEffect(() => {
        if (refreshTrigger > 0) {
            setIsSpinning(true);
            const timer = setTimeout(() => setIsSpinning(false), 800);
            return () => clearTimeout(timer);
        }
    }, [refreshTrigger]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        if (isDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isDropdownOpen]);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onMouseDown={handlePressStart}
                onMouseUp={handlePressEnd}
                onMouseLeave={handlePressEnd}
                onTouchStart={handlePressStart}
                onTouchEnd={handlePressEnd}
                className="relative p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                title="Click to refresh, long press for auto-refresh settings"
            >
                <motion.div animate={isSpinning ? { rotate: 360 } : {}} transition={isSpinning ? { duration: 1, repeat: Infinity, ease: "linear" } : {}}>
                    <CustomRefreshIcon size={18} />
                </motion.div>
                {refreshRate > 0 && !isSpinning && (
                    <span className="absolute -bottom-1 -right-1 bg-[var(--subtle-bg)] text-[8px] font-bold px-1 rounded-sm border border-[var(--border-color)] text-[var(--text-secondary)]">
                        {countdown}s
                    </span>
                )}
            </button>

            {isDropdownOpen && (
                <div className="absolute right-0 mt-1 w-36 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md shadow-lg z-50 overflow-hidden">
                    <div className="px-3 py-2 border-b border-[var(--border-color)] bg-[var(--subtle-bg)]">
                        <span className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Auto Refresh</span>
                    </div>
                    {[
                        { label: 'Off (Manual)', value: 0 },
                        { label: '5 seconds', value: 5 },
                        { label: '10 seconds', value: 10 },
                        { label: '30 seconds', value: 30 },
                        { label: '1 minute', value: 60 }
                    ].map(option => (
                        <button
                            key={option.value}
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-[var(--subtle-bg)] transition-colors ${refreshRate === option.value ? 'text-[var(--success)] font-medium bg-[var(--subtle-bg)]' : 'text-[var(--text-primary)]'}`}
                            onClick={() => {
                                setRefreshRate(option.value);
                                setIsDropdownOpen(false);
                            }}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const Header: React.FC<{
    pageTitle: string;
    onMenuClick: () => void;
    isCollapsed: boolean;
    isMobileMenuOpen?: boolean;
    isScrolled?: boolean;
}> = ({ pageTitle, onMenuClick, isCollapsed, isMobileMenuOpen = false, isScrolled = false }) => {
    const { settings } = usePlatformSettings();
    return (
        <header className={`bg-white/80 backdrop-blur-lg px-2 sm:px-3 flex items-center gap-2 sm:gap-3 flex-shrink-0 border-b border-gray-200 fixed top-0 w-full z-50 transition-all duration-300 ease-in-out h-[50px] ${isCollapsed ? 'md:w-[calc(100%-4rem)] md:left-16' : 'md:w-[calc(100%-10rem)] md:left-40'}`}>
            <button 
                className={`md:hidden p-1.5 -ml-1 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--sidebar-link-hover-bg)] transition-colors relative z-50`} 
                onClick={onMenuClick} 
                aria-label={isMobileMenuOpen ? "Close sidebar" : "Open sidebar"}
            >
                {/* Custom Animated Menu Icon */}
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    {/* Top Line: Rotates 45deg and moves down to center */}
                    <line 
                        x1="4" y1="6" x2="20" y2="6" 
                        style={{ 
                            transformOrigin: 'center',
                            transform: isMobileMenuOpen ? 'translateY(6px) rotate(45deg)' : 'translateY(0) rotate(0)',
                            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                    />
                    {/* Middle Line: Fades out */}
                    <line 
                        x1="8" y1="12" x2="20" y2="12" 
                        style={{ 
                            opacity: isMobileMenuOpen ? 0 : 1,
                            transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                    />
                    {/* Bottom Line: Rotates -45deg and moves up to center */}
                    <line 
                        x1="4" y1="18" x2="20" y2="18" 
                        style={{ 
                            transformOrigin: 'center',
                            transform: isMobileMenuOpen ? 'translateY(-6px) rotate(-45deg)' : 'translateY(0) rotate(0)',
                            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                    />
                </svg>
            </button>

            <div className="flex items-center gap-1.5 sm:gap-2 truncate">
                <h1 className="font-cursive text-lg gradient-text">Ceaznet Admin</h1>
                <span className="text-slate-300 font-light text-sm hidden sm:inline-block">|</span>
                <span className="text-slate-700 font-medium text-sm truncate">{pageTitle}</span>
            </div>

            <div className="flex-grow" />

            <div className="flex items-center gap-1.5 sm:gap-2">
                <GlobalRefreshButton />
                <SupportInboxIcon />
                <NotificationBell />
            </div>
        </header>
    );
};

export default Header;