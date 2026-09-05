import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAutoRefresh, useCountdown } from './AutoRefreshContext';
import { Sparkles, Bell, X, CheckCircle, CheckCircle2, Plus, Edit2, Trash2, Database, Clock, Eye, EyeOff, MessageSquare, RotateCw, Loader, Check, User, LogOut, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { dbMain, fetchLiveActivityLogs } from '../services/supabaseService';
import type { RecentActivityLog } from '../types';
import { ExpandedLogDetail } from '../pages/MainDashboard';
import { motion, AnimatePresence } from 'motion/react';
import { usePlatformSettings } from './PlatformSettingsContext';
import { playAudio, normalizeAudioUrl } from './audioUtils';
import { useAuth } from './AuthContext';

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

const NotificationBell: React.FC<{activeHeaderIcon: string | null, setActiveHeaderIcon: (id: string | null) => void}> = ({ activeHeaderIcon, setActiveHeaderIcon }) => {
    const [logs, setLogs] = useState<RecentActivityLog[]>([]);
    const [isOpen, setIsOpen] = useState(false);
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
        // audioRef no longer needed, using playAudio directly
    }, []);

    const playNotificationSound = () => {
        const isEnabled = localStorage.getItem('admin_audio_notifications_enabled') !== 'false';
        if (!isEnabled) return;

        const currentUrl = normalizeAudioUrl(localStorage.getItem('admin_audio_notifications_url') || '/Sound effects/notification.mp3');
        const now = Date.now();
        
        // Cooldown of 1 second (1000ms) to handle high frequency bursts
        if (now - lastPlayedTimeRef.current > 1000) {
            playAudio(currentUrl, 0.5);
            lastPlayedTimeRef.current = now;
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
        const handleClickOutside = (event: MouseEvent | TouchEvent) => {
            const target = event.target as Element;
            if (target?.closest?.('.modal-bg') || target?.closest?.('[role="dialog"]') || target?.closest?.('.custom-dropdown-panel')) {
                return;
            }
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setExpandedLog(null);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside, { passive: true });
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [isOpen]);

    const handleOpen = () => {
        setActiveHeaderIcon('notification');
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
                className={`relative p-2 ${activeHeaderIcon === 'notification' ? 'text-indigo-600' : 'text-[var(--text-secondary)]'} hover:text-[var(--text-primary)] rounded-full transition-colors`}
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
                            className="absolute top-1 right-1 w-[7px] h-[7px] rounded-full bg-red-500 ring-[1.5px] ring-white dark:ring-zinc-900"
                        />
                    )}
                </AnimatePresence>
            </button>

            {isOpen && (
                <div 
                    className="fixed left-[6px] right-[6px] top-[56px] h-[calc(100vh-62px)] max-h-[calc(100vh-62px)] md:left-auto md:right-2 md:top-[58px] md:w-[420px] md:h-[calc(100vh-66px)] md:max-h-[calc(100vh-66px)] bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] z-50 overflow-hidden flex flex-col origin-top-right ring-1 ring-black/5 dark:ring-white/10"
                >
                        {/* Header Title & Actions */}
                        <div className="px-3.5 py-2.5 border-b border-slate-100 dark:border-zinc-800/80 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md sticky top-0 flex items-center justify-between z-10 shrink-0">
                            <div className="flex items-center gap-2">
                                <span className="text-[10.5px] text-slate-500 dark:text-zinc-400 font-bold tracking-wider uppercase">System Events</span>
                                {unreadCount > 0 && (
                                    <span className="px-1.5 py-0.5 text-[9px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full">
                                        {unreadCount} new
                                    </span>
                                )}
                            </div>
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
                        
                        {/* Body Container */}
                        <div className="flex-1 overflow-y-auto relative flex flex-col min-h-0 sleek-scrollbar bg-slate-50/30 dark:bg-zinc-900/20">
                            {displayLogs.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 dark:text-zinc-500 min-h-[300px] my-auto">
                                    <div className="w-14 h-14 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800/60 flex items-center justify-center mb-3 shadow-inner">
                                        <CheckCircle2 size={26} className="text-indigo-600 dark:text-indigo-400" />
                                    </div>
                                    <span className="text-sm font-bold text-slate-700 dark:text-zinc-200">You're all caught up!</span>
                                    <span className="text-xs font-medium text-slate-400 dark:text-zinc-400 mt-1">No activity to show right now.</span>
                                </div>
                            ) : (
                                    <div className="flex flex-col divide-y divide-slate-100/70 dark:divide-zinc-800/60">
                                        {displayLogs.map((log, idx) => {
                                            const isExpanded = expandedLog === (log.id || idx);
                                            const isRead = readLogIds.has(String(log.id || idx));
                                            
                                            return (
                                                <motion.div 
                                                    layout="position"
                                                    key={log.id || idx} 
                                                    className={`relative flex flex-col transition-colors duration-150 ${isRead ? 'bg-white hover:bg-slate-50/80 dark:bg-zinc-900 dark:hover:bg-zinc-800/40' : 'bg-blue-50/25 hover:bg-blue-50/50 dark:bg-blue-950/20 dark:hover:bg-blue-900/30'}`}
                                                >
                                                    <div 
                                                        className="flex items-start gap-2.5 px-3.5 py-2 cursor-pointer relative select-none"
                                                        onClick={() => handleLogClick(log.id || idx)}
                                                    >
                                                        {/* Permanent Unread indicator bar */}
                                                        {!isRead && (
                                                            <div className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r bg-blue-500" />
                                                        )}
                                                        
                                                        {/* Icon */}
                                                        <div className={`mt-0.5 flex items-center justify-center w-5 h-5 rounded-md shrink-0 border ${
                                                            log.method === 'INSERT' ? 'bg-emerald-50 border-emerald-200/60 dark:bg-emerald-500/10 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400' :
                                                            log.method === 'UPDATE' ? 'bg-blue-50 border-blue-200/60 dark:bg-blue-500/10 dark:border-blue-500/30 text-blue-600 dark:text-blue-400' :
                                                            log.method === 'DELETE' ? 'bg-red-50 border-red-200/60 dark:bg-red-500/10 dark:border-red-500/30 text-red-600 dark:text-red-400' :
                                                            'bg-slate-100 border-slate-200 dark:bg-zinc-800 dark:border-zinc-700 text-slate-500 dark:text-zinc-400'
                                                        }`}>
                                                            {getIcon(log.method)}
                                                        </div>
                        
                                                        {/* Content */}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex justify-between items-center gap-1.5 mb-0.5">
                                                                <div className="flex items-center gap-1.5 min-w-0">
                                                                    <span className={`text-[11px] font-semibold truncate ${!isRead ? 'text-slate-900 dark:text-zinc-100' : 'text-slate-700 dark:text-zinc-300'}`}>
                                                                        {log.table}
                                                                    </span>
                                                                    {!isRead && (
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                                                                    )}
                                                                </div>
                                                                <span className="text-[9.5px] font-medium text-slate-400 dark:text-zinc-500 shrink-0 flex items-center gap-1">
                                                                    <Clock size={9} className="opacity-60" />
                                                                    {formatRelativeTime(log.timestamp)}
                                                                </span>
                                                            </div>
                                                            <p className={`text-[10.5px] leading-tight line-clamp-1 ${!isRead ? 'text-slate-600 font-medium dark:text-zinc-300' : 'text-slate-400 dark:text-zinc-500'}`}>
                                                                {log.description}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <AnimatePresence>
                                                        {isExpanded && (
                                                            <motion.div
                                                                initial={{ height: 0, opacity: 0 }}
                                                                animate={{ height: 'auto', opacity: 1 }}
                                                                exit={{ height: 0, opacity: 0 }}
                                                                className="overflow-hidden border-t border-slate-100/50 dark:border-zinc-800/30 bg-slate-50/50 dark:bg-black/15"
                                                            >
                                                                <ExpandedLogDetail log={log} isEmbedded={true} />
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                )}
                        </div>
                        
                        {/* Footer */}
                        <div className="px-3.5 py-2.5 border-t border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 border-b-0 rounded-b-2xl shrink-0 flex items-center justify-between gap-2">
                            <button 
                                onClick={handleNavigate}
                                className="w-fit flex items-center justify-center gap-1.5 py-1 px-1.5 text-[11px] font-semibold text-slate-700 hover:text-blue-600 dark:text-zinc-300 dark:hover:text-blue-400 transition-colors"
                            >
                                View Complete Activity History
                            </button>
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setLogs(prev => prev.filter(log => !readLogIds.has(String(log.id))));
                                }}
                                className="w-fit flex-shrink-0 px-1.5 flex items-center justify-center gap-1.5 py-1 text-[11px] font-semibold text-slate-700 hover:text-blue-600 dark:text-zinc-300 dark:hover:text-blue-400 transition-colors"
                                title="Hide all read logs"
                            >
                                <EyeOff size={13} />
                                Hide All Read
                            </button>
                        </div>
                </div>
            )}
            
            {/* The previous BroadcastModal line was here, now removed */}
        </div>
    );
};

const SupportInboxIcon: React.FC<{activeHeaderIcon: string | null, setActiveHeaderIcon: (id: string | null) => void}> = ({ activeHeaderIcon, setActiveHeaderIcon }) => {
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
        setActiveHeaderIcon('support');
        navigate('/support-inbox');
    };

    return (
        <button
            onClick={handleClick}
            className={`relative p-2 ${activeHeaderIcon === 'support' ? 'text-indigo-600' : 'text-[var(--text-secondary)]'} hover:text-[var(--text-primary)] rounded-full transition-colors`}
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

const GlobalRefreshButton: React.FC<{activeHeaderIcon: string | null, setActiveHeaderIcon: (id: string | null) => void}> = ({ activeHeaderIcon, setActiveHeaderIcon }) => {
    const { refreshRate, setRefreshRate, triggerRefresh, refreshTrigger } = useAutoRefresh();
    const countdown = useCountdown();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isSpinning, setIsSpinning] = useState(false);
    const [showSuccessCheck, setShowSuccessCheck] = useState(false);
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
        setActiveHeaderIcon('refresh');
        triggerRefresh();
    };

    useEffect(() => {
        if (refreshTrigger > 0) {
            setIsSpinning(true);
            setShowSuccessCheck(false);
            const timer = setTimeout(() => {
                setIsSpinning(false);
                setShowSuccessCheck(true);
                const checkTimer = setTimeout(() => {
                    setShowSuccessCheck(false);
                }, 1500);
                return () => clearTimeout(checkTimer);
            }, 800);
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
                className={`relative p-2 ${activeHeaderIcon === 'refresh' ? 'text-indigo-600' : 'text-[var(--text-secondary)]'} hover:text-[var(--text-primary)] rounded-full transition-colors`}
                title="Click to refresh, long press for auto-refresh settings"
            >
                <div className="relative w-[18px] h-[18px] flex items-center justify-center">
                    <AnimatePresence mode="wait">
                        {isSpinning ? (
                            <motion.div
                                key="loader"
                                initial={{ rotate: 0, scale: 0.8 }}
                                animate={{ rotate: 360, scale: 1 }}
                                exit={{ scale: 0.8, opacity: 0 }}
                                transition={{
                                    rotate: { duration: 1, repeat: Infinity, ease: "linear" },
                                    scale: { duration: 0.15 }
                                }}
                                className="flex items-center justify-center text-indigo-600 dark:text-indigo-400"
                            >
                                <Loader size={18} />
                            </motion.div>
                        ) : showSuccessCheck ? (
                            <motion.div
                                key="success"
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0, opacity: 0 }}
                                transition={{ 
                                    type: "spring",
                                    bounce: 0.45,
                                    duration: 0.4
                                }}
                                className="flex items-center justify-center text-emerald-500 font-bold"
                            >
                                <Check size={18} strokeWidth={3} />
                            </motion.div>
                        ) : (
                            <motion.div
                                key="refresh"
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.8, opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                className="flex items-center justify-center"
                            >
                                <RotateCw size={18} />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
                {refreshRate > 0 && !isSpinning && (
                    <span className="absolute -bottom-1 -right-1 bg-[var(--subtle-bg)] text-[8px] font-bold px-1 rounded-sm border border-[var(--border-color)] text-[var(--text-secondary)]">
                        {countdown}s
                    </span>
                )}
            </button>

            {isDropdownOpen && (
                <div className="absolute right-0 mt-1 w-36 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md shadow-none dark:shadow-lg z-50 overflow-hidden">
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

const ProfileDropdown: React.FC = () => {
    const { user, daysRemaining, lastLogin, logout } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handleConfirmLogout = async () => {
        setIsLoggingOut(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 600));
            await logout();
        } finally {
            setIsLoggingOut(false);
            setShowLogoutModal(false);
        }
    };

    // Format compact last login string (e.g. "Today, 10:06 AM" or "Sep 5, 10:06 AM")
    const formatLastLoginTime = (dateStr: string | null) => {
        if (!dateStr) return 'Active now';
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return 'Active now';
            
            const now = new Date();
            const isToday = 
                date.getDate() === now.getDate() &&
                date.getMonth() === now.getMonth() &&
                date.getFullYear() === now.getFullYear();

            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
            if (isToday) {
                return `Today, ${timeStr}`;
            }
            const dateFormatted = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
            return `${dateFormatted}, ${timeStr}`;
        } catch {
            return 'Active now';
        }
    };

    return (
        <div className="relative flex items-center" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-0.5 rounded-full transition-colors flex items-center justify-center outline-none group"
                aria-label="Admin Profile Menu"
            >
                <div className="w-8 h-8 sm:w-8.5 sm:h-8.5 flex items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-950/50 border-2 border-indigo-500 dark:border-indigo-400 overflow-hidden shrink-0 transition-all duration-200 group-hover:scale-105 active:scale-95 shadow-sm">
                    <img 
                        src="/admin-avatar.jpg" 
                        alt="Admin Profile" 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                            // Fallback to User icon if image fails
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement?.classList.add('flex', 'items-center', 'justify-center');
                        }}
                    />
                </div>
            </button>

            {isOpen && (
                <div 
                    className="fixed right-[6px] md:right-2 top-[56px] md:top-[58px] w-max max-w-[calc(100vw-16px)] bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-none z-50 overflow-hidden flex flex-col ring-1 ring-black/5 dark:ring-white/10"
                >
                    {/* Header Title & Profile Details */}
                    <div className="pl-3.5 pr-[27px] py-2.5 border-b border-slate-100 dark:border-zinc-800/80 bg-slate-50/50 dark:bg-zinc-800/40 flex items-center gap-2.5 shrink-0 whitespace-nowrap">
                        {/* Profile icon size consistent with main header (w-8 h-8 sm:w-8.5 sm:h-8.5) */}
                        <div className="w-8 h-8 sm:w-8.5 sm:h-8.5 flex items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-950/50 border-2 border-indigo-500 dark:border-indigo-400 overflow-hidden shrink-0 shadow-sm">
                            <img 
                                src="/admin-avatar.jpg" 
                                alt="Admin Profile" 
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                }}
                            />
                        </div>
                        <div className="flex flex-col whitespace-nowrap">
                            <span className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                                {user?.username || 'admin'}
                            </span>
                            <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium leading-tight mt-0.5" title={lastLogin ? new Date(lastLogin).toLocaleString() : 'Active now'}>
                                Login: {formatLastLoginTime(lastLogin)}
                            </span>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-1 bg-white dark:bg-zinc-900 shrink-0">
                        <button
                            type="button"
                            onClick={() => {
                                setIsOpen(false);
                                setShowLogoutModal(true);
                            }}
                            className="w-full flex items-center justify-between gap-3 pl-3 pr-[19px] py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer border-0 whitespace-nowrap"
                        >
                            <span>Logout</span>
                            <LogOut size={14} className="shrink-0 text-red-500" />
                        </button>
                    </div>
                </div>
            )}

            {/* Logout Confirmation Modal */}
            {createPortal(
                <AnimatePresence>
                    {showLogoutModal && (
                        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4">
                            {/* Backdrop */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => {
                                    if (!isLoggingOut) setShowLogoutModal(false);
                                }}
                                className="fixed inset-0 bg-black/40 backdrop-blur-xs"
                            />

                            {/* Compact Container-less Dialog Box */}
                            <motion.div
                                initial={{ opacity: 0, scale: 0.96 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.96 }}
                                transition={{ duration: 0.12 }}
                                className="relative w-full max-w-[280px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-xl z-10 flex flex-col text-left overflow-hidden"
                            >
                                <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-1">
                                    Confirm Logout
                                </h3>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4 leading-relaxed">
                                    Are you sure you want to log out?
                                </p>

                                <div className="flex items-center justify-end gap-2 w-full pt-1 border-t border-zinc-100 dark:border-zinc-800/60">
                                    <button
                                        type="button"
                                        disabled={isLoggingOut}
                                        onClick={() => setShowLogoutModal(false)}
                                        className="px-3 py-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all disabled:opacity-50 cursor-pointer border-0"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        disabled={isLoggingOut}
                                        onClick={handleConfirmLogout}
                                        className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer border-0"
                                    >
                                        {isLoggingOut ? (
                                            <>
                                                <Loader size={12} className="animate-spin" />
                                                <span>Logging out...</span>
                                            </>
                                        ) : (
                                            <span>Logout</span>
                                        )}
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>,
                document.body
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
    const [activeHeaderIcon, setActiveHeaderIcon] = useState<string | null>(null);
    return (
        <header className={`bg-[var(--status-success-bg)]/80 dark:bg-[#064e3b]/40 backdrop-blur-lg px-2 sm:px-3 flex items-center gap-2 sm:gap-3 flex-shrink-0 border-b border-[var(--status-success-text)]/20 dark:border-emerald-500/20 fixed top-0 w-full z-50 transition-all duration-300 ease-in-out h-[50px] ${isCollapsed ? 'md:w-[calc(100%-4rem)] md:left-16' : 'md:w-[calc(100%-10rem)] md:left-40'}`}>
            <button 
                className={`md:hidden p-1.5 -ml-1 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors relative z-50`} 
                onClick={onMenuClick} 
                aria-label={isMobileMenuOpen ? "Close sidebar" : "Open sidebar"}
            >
                {/* Custom Animated Menu Icon */}
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line 
                        x1="4" y1="6" x2="20" y2="6" 
                        style={{ 
                            transformOrigin: 'center',
                            transform: isMobileMenuOpen ? 'translateY(6px) rotate(45deg)' : 'translateY(0) rotate(0)',
                            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                    />
                    <line 
                        x1="8" y1="12" x2="20" y2="12" 
                        style={{ 
                            opacity: isMobileMenuOpen ? 0 : 1,
                            transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                    />
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
                <span className="font-bold text-lg sm:text-xl tracking-tight truncate bg-gradient-to-r from-indigo-600 to-violet-500 bg-clip-text text-transparent dark:from-indigo-400 dark:to-purple-400">
                    {pageTitle}
                </span>
            </div>

            <div className="flex-grow" />

            <div className="flex items-center gap-1.5 sm:gap-2">
                <GlobalRefreshButton activeHeaderIcon={activeHeaderIcon} setActiveHeaderIcon={setActiveHeaderIcon} />
                <SupportInboxIcon activeHeaderIcon={activeHeaderIcon} setActiveHeaderIcon={setActiveHeaderIcon} />
                <NotificationBell activeHeaderIcon={activeHeaderIcon} setActiveHeaderIcon={setActiveHeaderIcon} />
                <ProfileDropdown />
            </div>
        </header>
    );
};

export default Header;