

import React, { useState } from 'react';
import type { NewsLog } from '../../types';
import {
    List,
    Info,
    ArrowLeft,
    ChevronLeft,
    CalendarDays,
    Clock,
    Hash,
    Timer,
    Newspaper,
    CheckCircle2,
    XCircle,
    Terminal,
    AlertCircle,
    ChevronRight
} from 'lucide-react';
import { timeAgo } from '../ui';

// --- Helper to convert GMT to local IST time string without label ---
const convertGmtToIstTime = (gmtDateString: string): string => {
    try {
        const date = new Date(gmtDateString);
        if (isNaN(date.getTime())) return gmtDateString;

        const istOptions: Intl.DateTimeFormatOptions = {
            timeZone: 'Asia/Kolkata',
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
        };
        return date.toLocaleTimeString('en-IN', istOptions);
    } catch (error) {
        console.error("Error converting GMT to IST:", error);
        return gmtDateString; 
    }
};

// --- StructuredSummary Component ---
const StructuredSummary: React.FC<{ summary: string[] }> = ({ summary }) => {
    if (!summary || summary.length === 0) {
        return <p className="text-slate-500 dark:text-slate-400 text-sm italic">No summary available.</p>;
    }

    const generalInfo: { [key: string]: string } = {};
    const categoryStats: { category: string, fetched: string, duplicates: string, sentToAi: string, formatted: string, skipped: string }[] = [];
    let totalArticlesUpdated = '';

    summary.forEach(line => {
        if (line.startsWith('Start Time:') || line.startsWith('End Time:')) {
            const [key, ...valueParts] = line.split(': ');
            const gmtValue = valueParts.join(': ').trim();
            generalInfo[key.trim()] = convertGmtToIstTime(gmtValue);
        } else if (line.startsWith('Total Duration:')) {
            const [key, ...valueParts] = line.split(': ');
            generalInfo[key.trim()] = valueParts.join(': ').trim();
        } else if (line.startsWith('[')) {
            const match = line.match(/\[(.*?)\] Fetched: (\d+) \| Duplicates: (\d+) \| Sent to AI: (\d+) \| AI Formatted: (\d+) \| AI Skipped: (\d+)/);
            if (match) {
                categoryStats.push({
                    category: match[1],
                    fetched: match[2],
                    duplicates: match[3],
                    sentToAi: match[4],
                    formatted: match[5],
                    skipped: match[6],
                });
            } else {
                // Fallback for old format
                const oldMatch = line.match(/\[(.*?)\] Fetched: (\d+), Formatted: (\d+), Failed: (\d+)/);
                if (oldMatch) {
                    categoryStats.push({
                        category: oldMatch[1],
                        fetched: oldMatch[2],
                        duplicates: '0',
                        sentToAi: oldMatch[2],
                        formatted: oldMatch[3],
                        skipped: oldMatch[4],
                    });
                }
            }
        } else if (line.startsWith('Total Articles Updated:')) {
            totalArticlesUpdated = line.split(': ')[1];
        }
    });
    
    categoryStats.sort((a, b) => a.category.localeCompare(b.category));

    return (
        <div className="space-y-6">
            {/* General Stats - Containerless */}
            <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="flex flex-col gap-0.5">
                    <span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-[9px]">Total Updated</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300 text-sm">{totalArticlesUpdated || '0'}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                    <span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-[9px]">Duration</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300 text-sm">{generalInfo['Total Duration'] || 'N/A'}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                    <span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-[9px]">Start Time</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300 text-sm">{generalInfo['Start Time'] || 'N/A'}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                    <span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-[9px]">End Time</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300 text-sm">{generalInfo['End Time'] || 'N/A'}</span>
                </div>
            </div>

            {/* Category Breakdown - Containerless & Edge to Edge */}
            {categoryStats.length > 0 && (
                <div className="pt-2">
                    <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Category Breakdown</h4>
                    <div className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                        {categoryStats.map(stat => (
                            <div key={stat.category} className="py-3 flex flex-col gap-2 transition-colors first:pt-0 last:pb-0">
                                <div className="font-bold text-xs text-slate-800 dark:text-slate-200 capitalize flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_4px_rgba(59,130,246,0.5)]"></div>
                                    {stat.category}
                                </div>
                                <div className="grid grid-cols-5 gap-1 text-[9px] sm:text-[10px] py-1">
                                    <div className="flex flex-col items-center text-center">
                                        <span className="text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold">Fetch</span>
                                        <span className="font-bold text-slate-700 dark:text-slate-300 text-xs">{stat.fetched}</span>
                                    </div>
                                    <div className="flex flex-col items-center text-center border-l border-slate-200 dark:border-zinc-800">
                                        <span className="text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold" title="Duplicates">Dupe</span>
                                        <span className="font-bold text-slate-700 dark:text-slate-300 text-xs">{stat.duplicates}</span>
                                    </div>
                                    <div className="flex flex-col items-center text-center border-l border-slate-200 dark:border-zinc-800">
                                        <span className="text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold">To AI</span>
                                        <span className="font-bold text-slate-700 dark:text-slate-300 text-xs">{stat.sentToAi}</span>
                                    </div>
                                    <div className="flex flex-col items-center text-center border-l border-slate-200 dark:border-zinc-800">
                                        <span className="text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold">Fmt</span>
                                        <span className="font-bold text-green-600 dark:text-green-400 text-xs">{stat.formatted}</span>
                                    </div>
                                    <div className="flex flex-col items-center text-center border-l border-slate-200 dark:border-zinc-800">
                                        <span className="text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold">Skip</span>
                                        <span className={`font-bold text-xs ${parseInt(stat.skipped) > 0 ? 'text-amber-500' : 'text-slate-700 dark:text-slate-300'}`}>{stat.skipped}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// Helper to get category badge color styling
const getCategoryStyle = (category: string) => {
    const cat = category.toLowerCase().trim();
    if (cat.includes('health')) {
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/80';
    }
    if (cat.includes('support')) {
        return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/80 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800/80';
    }
    if (cat.includes('science')) {
        return 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border-purple-200 dark:border-purple-800/80';
    }
    if (cat.includes('system')) {
        return 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300 border-slate-200 dark:border-zinc-700';
    }
    if (cat.includes('tech') || cat.includes('technology')) {
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border-blue-200 dark:border-blue-800/80';
    }
    if (cat.includes('business') || cat.includes('finance')) {
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-200 dark:border-amber-800/80';
    }
    if (cat.includes('sports') || cat.includes('sport')) {
        return 'bg-orange-100 text-orange-800 dark:bg-orange-950/80 dark:text-orange-300 border-orange-200 dark:border-orange-800/80';
    }
    if (cat.includes('entertainment')) {
        return 'bg-pink-100 text-pink-800 dark:bg-pink-950/80 dark:text-pink-300 border-pink-200 dark:border-pink-800/80';
    }
    if (cat.includes('general') || cat.includes('world')) {
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/80';
    }

    const palette = [
        'bg-teal-100 text-teal-800 dark:bg-teal-950/80 dark:text-teal-300 border-teal-200 dark:border-teal-800/80',
        'bg-violet-100 text-violet-800 dark:bg-violet-950/80 dark:text-violet-300 border-violet-200 dark:border-violet-800/80',
        'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950/80 dark:text-fuchsia-300 border-fuchsia-200 dark:border-fuchsia-800/80',
        'bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300 border-sky-200 dark:border-sky-800/80',
        'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border-rose-200 dark:border-rose-800/80',
    ];
    let hash = 0;
    for (let i = 0; i < cat.length; i++) {
        hash = cat.charCodeAt(i) + ((hash << 5) - hash);
    }
    return palette[Math.abs(hash) % palette.length];
};

// --- StructuredDetails Component ---
const StructuredDetails: React.FC<{ details: string }> = ({ details }) => {
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

    if (!details) {
        return <p className="text-slate-500 italic text-sm p-4">No detailed logs available.</p>;
    }

    const parseLogLine = (line: string) => {
        // Match [Timestamp] optionally followed by emojis/spaces, then [LEVEL], then the rest
        const match = line.match(/^\[([^\]]+)\][^\[]*\[([^\]]+)\]\s*(.*)/);
        if (!match) {
            return { timestamp: null, level: 'INFO', message: line.replace(/^[^\x00-\x7F]+\s*/, ''), category: 'System', raw: line };
        }

        const [, timestampStr, level, rawMessage] = match;
        const date = new Date(timestampStr);
        const timestamp = isNaN(date.getTime()) ? timestampStr : date.toLocaleTimeString('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });

        let category = 'System';
        let message = rawMessage;
        const categoryMatch = rawMessage.match(/^\[([^\]]+)\]\s*(.*)/);
        if (categoryMatch) {
            category = categoryMatch[1];
            message = categoryMatch[2];
        }
        
        // Strip leading emojis or non-ASCII characters from the final message
        message = message.replace(/^[^\x00-\x7F]+\s*/, '');
        
        return { timestamp, level, message, category, raw: line };
    };

    const logLines = details.split('\n').filter(line => line.trim() !== '');

    return (
        <div className="flex flex-col w-full">
            {logLines.map((line, index) => {
                const { timestamp, level, message, category, raw } = parseLogLine(line);
                const isExpanded = expandedIndex === index;
                
                let levelBg = 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-[#2a2a2a] dark:text-[#8b8b8b] dark:border-[#3e3e3e]';
                let rowBg = 'bg-transparent hover:bg-slate-50 dark:hover:bg-[#1a1a1a]';
                let levelIcon = <Info size={12} />;
                if (level === 'INFO') {
                    levelBg = 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-[#1e3a8a]/40 dark:text-[#60a5fa] dark:border-[#1e3a8a]/60';
                    rowBg = 'bg-blue-50/40 dark:bg-[#1e3a8a]/20 hover:bg-blue-50/60 dark:hover:bg-[#1e3a8a]/30';
                    levelIcon = <Info size={12} />;
                }
                if (level === 'SUCCESS') {
                    levelBg = 'bg-green-50 text-green-600 border-green-100 dark:bg-[#1a2e23]/80 dark:text-[#4ade80] dark:border-[#10b981]/40';
                    rowBg = 'bg-green-50/40 dark:bg-[#1a2e23]/40 hover:bg-green-50/60 dark:hover:bg-[#1a2e23]/60';
                    levelIcon = <CheckCircle2 size={12} />;
                }
                if (level === 'FAILURE' || level === 'ERROR') {
                    levelBg = 'bg-red-50 text-red-600 border-red-100 dark:bg-[#451a1a]/80 dark:text-[#f87171] dark:border-[#f87171]/40';
                    rowBg = 'bg-red-50/40 dark:bg-[#451a1a]/40 hover:bg-red-50/60 dark:hover:bg-[#451a1a]/60';
                    levelIcon = <AlertCircle size={12} />;
                }
                if (level === 'WARN') {
                    levelBg = 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-[#422006]/80 dark:text-[#fbbf24] dark:border-[#fbbf24]/40';
                    rowBg = 'bg-amber-50/40 dark:bg-[#422006]/40 hover:bg-amber-50/60 dark:hover:bg-[#422006]/60';
                    levelIcon = <AlertCircle size={12} />;
                }

                return (
                    <div key={index} className={`flex flex-col border-b border-slate-100 dark:border-[#2e2e2e] transition-colors last:border-b-0 ${rowBg}`}>
                        <div 
                            className="flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-2.5 cursor-pointer overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                            onClick={() => setExpandedIndex(isExpanded ? null : index)}
                        >
                            <span className="text-slate-500 dark:text-[#8b8b8b] font-mono text-[10px] sm:text-xs whitespace-nowrap shrink-0">
                                {timestamp || '--:--:--'}
                            </span>
                            <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-mono shrink-0 w-fit border ${levelBg}`}>
                                {levelIcon}
                                {level}
                            </span>
                            <div className="flex items-center gap-2 text-slate-700 dark:text-[#ededed] font-mono text-[10px] sm:text-xs min-w-0 flex-1">
                                <span className={`px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-bold border uppercase tracking-wider shrink-0 select-none ${getCategoryStyle(category)}`}>
                                    {category}
                                </span>
                                <span className="truncate flex-1">
                                    {message}
                                </span>
                            </div>
                        </div>
                        {isExpanded && (
                            <div className="px-3 sm:px-4 py-5 bg-slate-50/50 dark:bg-zinc-900/30 border-t border-slate-100 dark:border-[#2e2e2e] text-slate-700 dark:text-[#ededed] font-mono text-[11px] sm:text-xs shadow-inner my-0">
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                                    {/* Meta Info Column */}
                                    <div className="md:col-span-3 flex flex-col gap-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="flex flex-col gap-1.5">
                                                <span className="text-slate-400 dark:text-[#8b8b8b] text-[9px] uppercase tracking-wider font-semibold">Timestamp</span>
                                                <span className="text-slate-800 dark:text-[#e6edf3] font-medium">{timestamp || 'N/A'}</span>
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <span className="text-slate-400 dark:text-[#8b8b8b] text-[9px] uppercase tracking-wider font-semibold">Level</span>
                                                <span className={`w-fit px-2 py-0.5 rounded text-[10px] border ${levelBg}`}>{level}</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <span className="text-slate-400 dark:text-[#8b8b8b] text-[9px] uppercase tracking-wider font-semibold">Category</span>
                                            <span className={`w-fit px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${getCategoryStyle(category)}`}>{category}</span>
                                        </div>
                                    </div>
                                    
                                    {/* Message & Raw Log Column */}
                                    <div className="md:col-span-9 flex flex-col gap-5">
                                        <div className="flex flex-col gap-1.5">
                                            <span className="text-slate-400 dark:text-[#8b8b8b] text-[9px] uppercase tracking-wider font-semibold">Message</span>
                                            <span className="whitespace-pre-wrap break-words text-slate-800 dark:text-[#a5d6ff] text-sm leading-relaxed">{message}</span>
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <details className="group">
                                                <summary className="text-slate-400 dark:text-[#8b8b8b] text-[9px] uppercase tracking-wider font-semibold cursor-pointer hover:text-slate-600 dark:hover:text-[#a5d6ff] transition-colors select-none list-none flex items-center gap-1.5">
                                                    <ChevronRight size={12} className="group-open:rotate-90 transition-transform" />
                                                    Raw Log
                                                </summary>
                                                <div className="mt-2 whitespace-pre-wrap break-words py-1 text-slate-500 dark:text-[#8b949e] text-[10px]">
                                                    {raw}
                                                </div>
                                            </details>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

// --- Main NewsLogDetail Component ---
const NewsLogDetail: React.FC<{ log: NewsLog; onBack: () => void; }> = ({ log, onBack }) => {
    const isSuccess = log.status.toLowerCase().includes('success');
    const logDate = new Date(log.created_at);
    const dateString = logDate.toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric'
    });
    const fullTimestamp = logDate.toLocaleTimeString();

    return (
         <div className="w-auto mx-[-12px] sm:mx-[-16px] lg:mx-[-24px] px-3 sm:px-4 lg:px-6 pb-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between gap-2 md:gap-4 items-start md:items-center">
                
                {/* Mobile Top Row Wrapper / Desktop Left Side Wrapper */}
                <div className="flex flex-wrap md:flex-nowrap items-center gap-x-2 gap-y-1 w-full md:w-auto">
                    
                    {/* Chevron & Heading */}
                    <div className="flex items-center gap-1 shrink-0">
                        <button onClick={onBack} className="transition-colors text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 shrink-0 mr-0.5 flex items-center justify-center">
                            <ChevronLeft size={24} />
                        </button>
                        <h2 className="text-lg md:text-xl font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                            Log Details
                        </h2>
                    </div>

                    {/* Badges - ONLY visible here on MOBILE */}
                    <div className="flex md:hidden items-center gap-1.5 ml-auto shrink-0 min-w-0">
                         <span className={`flex shrink-0 items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${isSuccess ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800/50' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800/50'}`}>
                            {isSuccess ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                            {log.status}
                        </span>
                        <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 truncate">- ID: {log.id}</span>
                    </div>

                    {/* Date & Time - Full width on mobile to force it to its own line, no left padding so it starts under back arrow */}
                    <div className="flex items-center gap-1.5 text-xs md:text-sm text-slate-500 dark:text-slate-400 w-full md:w-auto md:pl-2 mt-1 md:mt-0">
                        <CalendarDays size={14} className="shrink-0" />
                        <span className="whitespace-nowrap">{dateString} at {fullTimestamp}</span>
                        <span className="text-slate-300 dark:text-zinc-600 shrink-0">•</span>
                        <span data-tooltip={fullTimestamp} className="shrink-0 whitespace-nowrap">{timeAgo(logDate)}</span>
                    </div>
                </div>

                {/* Badges - ONLY visible here on DESKTOP */}
                <div className="hidden md:flex items-center gap-2 shrink-0">
                    <span className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold ${isSuccess ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800/50' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800/50'}`}>
                        {isSuccess ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                        {log.status}
                    </span>
                    <span className="text-slate-400 font-medium">-</span>
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Log ID: {log.id}</span>
                </div>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch pt-2 lg:h-[calc(100vh-220px)] lg:min-h-[500px]">
                {/* Left Column: Summary */}
                <div className="lg:col-span-4 xl:col-span-3 flex flex-col h-full min-h-0">
                    <div className="flex flex-col flex-grow h-full min-h-0">
                        <div className="pb-2 border-b border-slate-200 dark:border-zinc-800 flex items-center gap-2 shrink-0 mb-4">
                            <List size={14} className="text-slate-400" />
                            <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-600 dark:text-slate-300">Execution Summary</h3>
                        </div>
                        <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 min-h-0">
                            <StructuredSummary summary={log.summary} />
                        </div>
                    </div>
                </div>

                {/* Right Column: Terminal Details */}
                <div className="lg:col-span-8 xl:col-span-9 flex flex-col mx-[-12px] sm:mx-[-16px] lg:mx-0 h-full min-h-0">
                    <div className="flex flex-col flex-grow h-full min-h-[400px] lg:min-h-0">
                        <div className="pb-2 border-b border-slate-200 dark:border-zinc-800 flex items-center gap-2 shrink-0 mb-4 px-3 sm:px-4 lg:px-0">
                            <Terminal size={16} className="text-[#10b981]" />
                            <span className="font-semibold text-xs tracking-wider text-slate-700 dark:text-[#ededed] uppercase">Execution Details</span>
                        </div>
                        <div className="overflow-y-auto flex-1 custom-scrollbar min-h-0">
                            <StructuredDetails details={log.details} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NewsLogDetail;