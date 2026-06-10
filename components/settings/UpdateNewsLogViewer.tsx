import React, { useState } from 'react';
import { PanelCard, CopyButton } from '../ui';
import { ArrowLeft, List, Info, CheckCircle2, AlertCircle } from 'lucide-react';

// --- Type Guard ---
export const isUpdateNewsLog = (row: any): boolean => {
    return (
        row &&
        typeof row === 'object' &&
        'duration_ms' in row &&
        'summary' in row &&
        Array.isArray(row.summary) &&
        'details' in row &&
        typeof row.details === 'string'
    );
};

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
        return <p style={{ color: 'var(--text-secondary)' }}>No summary available.</p>;
    }

    const generalInfo: { [key: string]: string } = {};
    const categoryStats: { category: string, fetched: string, formatted: string, failed: string }[] = [];
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
            const match = line.match(/\[(.*?)\] Fetched: (\d+), Formatted: (\d+), Failed: (\d+)/);
            if (match) {
                categoryStats.push({
                    category: match[1],
                    fetched: match[2],
                    formatted: match[3],
                    failed: match[4],
                });
            }
        } else if (line.startsWith('Total Articles Updated:')) {
            totalArticlesUpdated = line.split(': ')[1];
        }
    });
    
    categoryStats.sort((a, b) => a.category.localeCompare(b.category));

    return (
        <div className="space-y-3 text-sm font-sans">
            <div className="space-y-1">
                {Object.entries(generalInfo).map(([key, value]) => (
                    <div key={key} className="flex justify-between items-center text-xs">
                        <span style={{ color: 'var(--text-secondary)' }}>{key}</span>
                        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{value}</span>
                    </div>
                ))}
            </div>

            {(categoryStats.length > 0 || totalArticlesUpdated) && <hr style={{ borderColor: 'var(--border-color)', margin: '8px 0' }} />}

            {categoryStats.length > 0 && (
                <div>
                    <h5 className="font-semibold text-sm mb-2" style={{ color: 'var(--text-primary)' }}>Category Breakdown</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {categoryStats.map(stat => (
                            <div key={stat.category} className="p-2 border rounded-md" style={{ backgroundColor: 'var(--subtle-bg)', borderColor: 'var(--border-color)' }}>
                                <p className="font-bold text-xs capitalize text-[var(--accent-color)]">{stat.category}</p>
                                <div className="grid grid-cols-3 gap-1 mt-1 text-center">
                                    <div>
                                        <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Fetched</p>
                                        <p className="font-bold text-sm text-[var(--text-primary)]">{stat.fetched}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Format</p>
                                        <p className="font-bold text-sm text-[var(--text-primary)]">{stat.formatted}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Failed</p>
                                        <p className={`font-bold text-sm ${parseInt(stat.failed) > 0 ? 'text-red-500' : 'text-[var(--text-primary)]'}`}>
                                            {stat.failed}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            {totalArticlesUpdated && (
                <div className="flex justify-between items-center text-sm font-bold p-3 rounded-lg border mt-2" style={{ backgroundColor: 'var(--sidebar-link-hover-bg)', borderColor: 'var(--border-color)' }}>
                    <span style={{ color: 'var(--text-primary)' }}>Total Articles Updated</span>
                    <span className="text-xl" style={{ color: 'var(--accent-color)' }}>{totalArticlesUpdated}</span>
                </div>
            )}
        </div>
    );
};


// --- StructuredDetails Component ---
const StructuredDetails: React.FC<{ details: string }> = ({ details }) => {
    if (!details) {
        return <p style={{ color: 'var(--text-secondary)' }}>No detailed logs available.</p>;
    }

    const parseLogLine = (line: string) => {
        const match = line.match(/^\[([^\]]+)\][^\[]*\[([^\]]+)\]\s*(.*)/);
        if (!match) {
            return { timestamp: null, level: null, message: line.replace(/^[^\x00-\x7F]+\s*/, ''), category: null };
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

        let category = null;
        let message = rawMessage;
        const categoryMatch = rawMessage.match(/^\[([^\]]+)\]\s*(.*)/);
        if (categoryMatch) {
            category = categoryMatch[1];
            message = categoryMatch[2];
        }
        
        message = message.replace(/^[^\x00-\x7F]+\s*/, '');
        
        return { timestamp, level, message, category };
    };

    const logLines = details.split('\n').filter(line => line.trim() !== '');

    const levelColors: { [key: string]: string } = {
        'INFO': 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800',
        'SUCCESS': 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 border border-green-200 dark:border-green-800',
        'FAILURE': 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 border border-red-200 dark:border-red-800',
        'ERROR': 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 border border-red-200 dark:border-red-800',
        'WARN': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800',
    };

    const getLevelIcon = (level: string | null) => {
        if (level === 'INFO') return <Info size={12} className="shrink-0" />;
        if (level === 'SUCCESS') return <CheckCircle2 size={12} className="shrink-0" />;
        if (level === 'FAILURE' || level === 'ERROR') return <AlertCircle size={12} className="shrink-0" />;
        if (level === 'WARN') return <AlertCircle size={12} className="shrink-0" />;
        return null;
    };

    return (
        <div className="font-mono text-xs text-[var(--text-primary)]">
             <div className="flex flex-col gap-y-0.5">
                {logLines.map((line, index) => {
                    const { timestamp, level, message, category } = parseLogLine(line);
                    
                    let rowBg = 'bg-transparent hover:bg-slate-50 dark:hover:bg-[#1a1a1a]';
                    let levelColor = 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700';
                    
                    if (level === 'INFO') {
                        rowBg = 'bg-blue-50/40 dark:bg-[#1e3a8a]/10 hover:bg-blue-50/60 dark:hover:bg-[#1e3a8a]/20';
                        levelColor = 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800';
                    } else if (level === 'SUCCESS') {
                        rowBg = 'bg-green-50/40 dark:bg-[#1a2e23]/20 hover:bg-green-50/60 dark:hover:bg-[#1a2e23]/40';
                        levelColor = 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 border border-green-200 dark:border-green-800';
                    } else if (level === 'FAILURE' || level === 'ERROR') {
                        rowBg = 'bg-red-50/40 dark:bg-[#451a1a]/20 hover:bg-red-50/60 dark:hover:bg-[#451a1a]/40';
                        levelColor = 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 border border-red-200 dark:border-red-800';
                    } else if (level === 'WARN') {
                        rowBg = 'bg-amber-50/40 dark:bg-[#422006]/20 hover:bg-amber-50/60 dark:hover:bg-[#422006]/40';
                        levelColor = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800';
                    }

                    return (
                        <div key={index} className={`grid grid-cols-[auto_auto_1fr] gap-x-3 px-2 py-1.5 rounded transition-colors ${rowBg}`}>
                            <div className="text-right text-[var(--text-secondary)] select-none flex items-center">{timestamp}</div>
                            <div className="flex items-center">
                                {level && (
                                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold w-fit ${levelColor}`}>
                                        {getLevelIcon(level)}
                                        {level}
                                    </span>
                                )}
                            </div>
                            <div className="whitespace-pre-wrap break-words min-w-0 flex items-center">
                                <div>
                                    {category && <span className="font-bold text-[var(--accent-color)] capitalize mr-1">[{category}]</span>}
                                    {message}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// --- Main Viewer Component ---
const JsonToggleCard: React.FC<{
    title: string;
    data: any;
    structuredRenderer: (data: any) => React.ReactNode;
}> = ({ title, data, structuredRenderer }) => {
    const [isStructured, setIsStructured] = useState(true);
    const rawJsonString = JSON.stringify(data, null, 2);

    return (
        <div className="pt-1">
            <div className="flex justify-between items-center mb-3">
                <h3 className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider font-bold opacity-70 mb-0">{title}</h3>
                <div className="flex bg-[var(--subtle-bg)] rounded-sm p-0.5 border border-[var(--border-color)]/60 shrink-0">
                    <button 
                        onClick={(e) => { e.stopPropagation(); setIsStructured(true); }}
                        className={`px-3 py-1 text-[10px] sm:text-[11px] rounded-[3px] transition-all duration-200 ${isStructured ? 'bg-[var(--success)] text-white shadow-sm font-bold' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                        Structured
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); setIsStructured(false); }}
                        className={`px-3 py-1 text-[10px] sm:text-[11px] rounded-[3px] transition-all duration-200 ${!isStructured ? 'bg-[var(--success)] text-white shadow-sm font-bold' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                        Raw
                    </button>
                </div>
            </div>

            <div className="relative group">
                 {!isStructured && <CopyButton textToCopy={rawJsonString} />}
                <div className="">
                    {isStructured ? (
                        structuredRenderer(data)
                    ) : (
                        <pre className="p-3 bg-[var(--subtle-bg)]/30 border border-[var(--subtle-border)] rounded-lg font-mono text-[10px] sm:text-[11px] text-emerald-600 dark:text-emerald-400 overflow-x-auto custom-scrollbar [&::-webkit-scrollbar:horizontal]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                            <code>{rawJsonString}</code>
                        </pre>
                    )}
                </div>
            </div>
        </div>
    );
};


// --- Main Viewer Component ---
const UpdateNewsLogViewer: React.FC<{ row: any; onBack: () => void }> = ({ row, onBack }) => {
    return (
        <div className="animate-fade-in-up space-y-4">
            <div className="flex items-center gap-3">
                <button onClick={onBack} className="btn btn-secondary px-2 py-1 flex items-center gap-1 text-xs">
                    <ArrowLeft size={14} />
                    <span>Back</span>
                </button>
                <h3 className="text-base font-bold text-[var(--text-primary)]">Log Details: <span className="font-mono text-xs">update_news_logs</span></h3>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                 <JsonToggleCard
                    title="Summary"
                    data={row.summary}
                    structuredRenderer={(data) => <StructuredSummary summary={data} />}
                />
                <JsonToggleCard
                    title="Details"
                    data={row.details}
                    structuredRenderer={(data) => <StructuredDetails details={data} />}
                />
            </div>
        </div>
    );
};

export default UpdateNewsLogViewer;