import React, { useState, useMemo, useEffect } from 'react';
import { 
    PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, 
    LineChart, Line, XAxis, YAxis, CartesianGrid, AreaChart, Area,
    BarChart, Bar, Rectangle
} from 'recharts';
import type { ArticleStats, EdgeFunctionStats, TrendDataPoint, DistributionDataPoint, BarDataPoint } from '../types';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { InfoPopover } from './ui';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#f43f5e'];

export const CustomTooltip = ({ active, payload, label, coordinate, viewBox, chartType = 'area' }: any) => {
    if (active && payload && payload.length && coordinate) {
        let targetX = coordinate.x;
        let targetY = coordinate.y;

        if (chartType === 'bar') {
            const p = payload[payload.length - 1];
            if (p && p.x !== undefined && p.y !== undefined && p.width !== undefined) {
                targetX = p.x + p.width / 2;
                targetY = p.y;
            }
        } else if (chartType === 'horizontal-bar') {
            const p = payload[payload.length - 1];
            if (p && p.x !== undefined && p.y !== undefined && p.height !== undefined && p.width !== undefined) {
                targetX = p.x + p.width;
                targetY = p.y + p.height / 2;
            }
        }

        const isHorizontal = chartType === 'horizontal-bar';
        // Use window.innerWidth as a reliable fallback for mobile screens since viewBox is often undefined for Tooltips
        const chartWidth = viewBox?.width || (typeof window !== 'undefined' ? window.innerWidth - 40 : 500);
        
        let xOffset = isHorizontal ? '7px' : '-50%';
        let yOffset = isHorizontal ? '-50%' : 'calc(-100% - 7px)';
        
        let leftPos = targetX;
        let topPos = targetY;

        const tailStyle: React.CSSProperties = isHorizontal
            ? { left: '-5px', top: '50%', transform: 'translateY(-50%) rotate(45deg)' }
            : { bottom: '-5px', left: '50%', transform: 'translateX(-50%) rotate(45deg)' };

        let tailClasses = isHorizontal
            ? "absolute w-2.5 h-2.5 bg-white dark:bg-zinc-900 border-b border-l border-slate-200 dark:border-zinc-700"
            : "absolute w-2.5 h-2.5 bg-white dark:bg-zinc-900 border-b border-r border-slate-200 dark:border-zinc-700";

        const safeZone = 120; // Approx half of the max tooltip width

        if (!isHorizontal) {
            if (targetX < safeZone) {
                // Shift tooltip to the right, but keep tail pointing at targetX
                const tailOffset = Math.max(16, targetX);
                xOffset = `-${tailOffset}px`;
                tailStyle.left = `${tailOffset}px`;
                tailStyle.transform = 'translateX(-50%) rotate(45deg)';
            } else if (targetX > chartWidth - safeZone) {
                // Shift tooltip fully to the left of the cursor to prevent right edge overflow
                const tailOffset = Math.max(16, chartWidth - targetX);
                xOffset = `calc(-100% + ${tailOffset}px)`;
                tailStyle.left = `calc(100% - ${tailOffset}px)`;
                tailStyle.transform = 'translateX(-50%) rotate(45deg)';
            }
            
            if (targetY < 60) {
                yOffset = '7px';
                tailStyle.bottom = 'auto';
                tailStyle.top = '-5px';
                tailClasses = "absolute w-2.5 h-2.5 bg-white dark:bg-zinc-900 border-t border-l border-slate-200 dark:border-zinc-700";
            }
        } else {
            if (targetX > chartWidth - 140) {
                xOffset = 'calc(-100% - 7px)';
                tailStyle.left = 'auto';
                tailStyle.right = '-5px';
                tailClasses = "absolute w-2.5 h-2.5 bg-white dark:bg-zinc-900 border-t border-r border-slate-200 dark:border-zinc-700";
            }
        }

        const containerStyle: React.CSSProperties = {
            left: leftPos,
            top: topPos,
            transform: `translate(${xOffset}, ${yOffset})`,
            transition: 'left 0.1s ease-out, top 0.1s ease-out'
        };

        return (
            <div 
                className="absolute bg-white dark:bg-zinc-900 p-2.5 border border-slate-200 dark:border-zinc-700 shadow-xl rounded-xl text-[10px] pointer-events-none z-50 w-max max-w-[200px]"
                style={containerStyle}
            >
                <div className={tailClasses} style={tailStyle}></div>
                
                <div className="relative z-10">
                    {label && <p className="font-bold text-slate-900 dark:text-zinc-100 mb-1.5 border-b border-slate-100 dark:border-zinc-800 pb-1 truncate">{label}</p>}
                    <div className="space-y-1">
                        {payload.map((entry: any, index: number) => (
                            <div key={index} className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-1.5 overflow-hidden">
                                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: entry.color || entry.fill }} />
                                    <span className="text-slate-500 dark:text-zinc-400 font-medium truncate">{entry.name}:</span>
                                </div>
                                <span className="font-bold text-slate-900 dark:text-zinc-100 shrink-0">{(entry.value ?? 0).toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }
    return null;
};

// Custom Bar with rounded corners
export const RoundedBar = (props: any) => {
    const { fill, x, y, width, height } = props;
    return <Rectangle {...props} radius={[4, 4, 0, 0]} fill={fill} />;
};

export const RoundedBarHorizontal = (props: any) => {
    const { fill, x, y, width, height } = props;
    return <Rectangle {...props} radius={[0, 4, 4, 0]} fill={fill} />;
};

export const ArticlesByCategoryChart: React.FC<{ data: { category: string; count: number }[] }> = React.memo(({ data }) => {
    return useMemo(() => (
        <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius="50%"
                        outerRadius="75%"
                        paddingAngle={4}
                        dataKey="count"
                        nameKey="category"
                        stroke="none"
                        isAnimationActive={true}
                        animationDuration={800}
                        animationEasing="ease-out"
                    >
                        {data.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip chartType="pie" />} position={{ x: 0, y: 0 }} />
                    <Legend 
                        verticalAlign="bottom" 
                        align="center" 
                        iconType="circle" 
                        iconSize={8}
                        wrapperStyle={{ fontSize: '10px', paddingTop: '10px', fontWeight: 500 }} 
                    />
                </PieChart>
            </ResponsiveContainer>
        </div>
    ), [data]);
}, (prevProps, nextProps) => {
    return JSON.stringify(prevProps.data) === JSON.stringify(nextProps.data);
});

export const DatabaseEventsTimelineChart: React.FC<{ data: { time: string; count: number }[] }> = React.memo(({ data }) => {
    return useMemo(() => (
        <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.5} />
                    <XAxis 
                        dataKey="time" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} 
                        dy={10}
                    />
                    <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} 
                    />
                    <Tooltip content={<CustomTooltip chartType="area" />} cursor={{ stroke: 'var(--border-color)', strokeWidth: 1, strokeDasharray: '3 3' }} />
                    <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorCount)" />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    ), [data]);
}, (prevProps, nextProps) => {
    return JSON.stringify(prevProps.data) === JSON.stringify(nextProps.data);
});

export const ApiDistributionChart: React.FC<{ metrics?: EdgeFunctionStats[], fallbackTotal?: number }> = React.memo(({ metrics, fallbackTotal = 0 }) => {
    const data = useMemo(() => {
        let d = [];
        if (metrics && metrics.length > 0) {
            d = metrics.map(m => ({
                name: m.function_name || 'Unknown',
                value: Number(m.total_calls) || 0
            })).filter(item => item.value > 0);
        }
        if (d.length === 0) {
            d = [{ name: 'News Updater', value: fallbackTotal }];
        }
        return d;
    }, [JSON.stringify(metrics), fallbackTotal]);

    return useMemo(() => (
        <div className="h-36 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius="50%"
                        outerRadius="75%"
                        paddingAngle={8}
                        dataKey="value"
                        stroke="none"
                        isAnimationActive={true}
                        animationDuration={800}
                        animationEasing="ease-out"
                    >
                        {data.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip chartType="pie" />} position={{ x: 0, y: 0 }} />
                    <Legend 
                        verticalAlign="bottom" 
                        align="center" 
                        iconType="circle" 
                        iconSize={8}
                        wrapperStyle={{ fontSize: '10px', paddingTop: '10px', fontWeight: 600 }} 
                    />
                </PieChart>
            </ResponsiveContainer>
        </div>
    ), [data]);
}, (prevProps, nextProps) => {
    return JSON.stringify(prevProps.metrics) === JSON.stringify(nextProps.metrics) && prevProps.fallbackTotal === nextProps.fallbackTotal;
});

export const FinanceDistributionChart: React.FC<{ data: { name: string; value: number }[] }> = React.memo(({ data }) => {
    return useMemo(() => (
        <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data.length > 0 ? data : [{ name: 'No Data', value: 1 }]}
                        cx="50%"
                        cy="50%"
                        innerRadius="50%"
                        outerRadius="75%"
                        paddingAngle={8}
                        dataKey="value"
                        stroke="none"
                        isAnimationActive={true}
                        animationDuration={800}
                        animationEasing="ease-out"
                    >
                        {(data.length > 0 ? data : [{ name: 'No Data', value: 1 }]).map((_, index) => (
                            <Cell key={`cell-${index}`} fill={data.length > 0 ? COLORS[index % COLORS.length] : '#e2e8f0'} />
                        ))}
                    </Pie>
                    {data.length > 0 && <Tooltip content={<CustomTooltip chartType="pie" />} position={{ x: 0, y: 0 }} />}
                    <Legend 
                        verticalAlign="bottom" 
                        align="center" 
                        iconType="circle" 
                        iconSize={8}
                        wrapperStyle={{ fontSize: '10px', paddingTop: '10px', fontWeight: 600 }} 
                    />
                </PieChart>
            </ResponsiveContainer>
        </div>
    ), [data]);
}, (prevProps, nextProps) => {
    return JSON.stringify(prevProps.data) === JSON.stringify(nextProps.data);
});

export const ActivityByMethodChart: React.FC<{ data: { name: string; value: number }[] }> = React.memo(({ data }) => {
    return useMemo(() => (
        <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data.length > 0 ? data : [{ name: 'No Data', value: 1 }]}
                        cx="50%"
                        cy="50%"
                        innerRadius="50%"
                        outerRadius="75%"
                        paddingAngle={8}
                        dataKey="value"
                        stroke="none"
                        isAnimationActive={true}
                        animationDuration={800}
                        animationEasing="ease-out"
                    >
                        {(data.length > 0 ? data : [{ name: 'No Data', value: 1 }]).map((entry, index) => {
                            let color = COLORS[index % COLORS.length];
                            if (data.length > 0) {
                                if (entry.name === 'INSERT') color = '#10b981'; // green
                                else if (entry.name === 'UPDATE') color = '#f59e0b'; // amber
                                else if (entry.name === 'DELETE') color = '#ef4444'; // red
                                else if (entry.name === 'GET') color = '#3b82f6'; // blue
                            } else {
                                color = '#e2e8f0';
                            }
                            return <Cell key={`cell-${index}`} fill={color} />;
                        })}
                    </Pie>
                    {data.length > 0 && <Tooltip content={<CustomTooltip chartType="pie" />} position={{ x: 0, y: 0 }} />}
                    <Legend 
                        verticalAlign="bottom" 
                        align="center" 
                        iconType="circle" 
                        iconSize={8}
                        wrapperStyle={{ fontSize: '10px', paddingTop: '10px', fontWeight: 600 }} 
                    />
                </PieChart>
            </ResponsiveContainer>
        </div>
    ), [data]);
}, (prevProps, nextProps) => {
    return JSON.stringify(prevProps.data) === JSON.stringify(nextProps.data);
});

export const SuccessRateChart: React.FC<{ successRate: number }> = React.memo(({ successRate }) => {
    const data = useMemo(() => [
        { name: 'Success', value: successRate },
        { name: 'Failure', value: 100 - successRate },
    ], [successRate]);
    const COLORS_SUCCESS = ['#10b981', '#f43f5e'];

    return useMemo(() => (
        <div className="h-32 w-full relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        startAngle={210}
                        endAngle={-30}
                        innerRadius="65%"
                        outerRadius="85%"
                        paddingAngle={0}
                        dataKey="value"
                        stroke="none"
                        isAnimationActive={true}
                        animationDuration={800}
                        animationEasing="ease-out"
                    >
                        {data.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS_SUCCESS[index % COLORS_SUCCESS.length]} />
                        ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip chartType="pie" />} position={{ x: 0, y: 0 }} />
                </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-lg font-extrabold text-slate-900 dark:text-zinc-100 tracking-tight leading-none">{successRate.toFixed(1)}%</span>
                <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mt-0.5">Success Rate</span>
            </div>
        </div>
    ), [data, successRate]);
}, (prevProps, nextProps) => prevProps.successRate === nextProps.successRate);

export const NewsArticlesChart: React.FC<{ logs: any[]; title: string; }> = ({ logs, title }) => {
    const [dateOffset, setDateOffset] = useState(0);

    const sortedLogs = useMemo(() => 
        logs.slice().sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    , [logs]);

    const { paginatedLogs, startDate, endDate, isNextDisabled, isPrevDisabled } = useMemo(() => {
        if (!sortedLogs || sortedLogs.length === 0) {
            return { paginatedLogs: [], startDate: null, endDate: null, isNextDisabled: true, isPrevDisabled: true };
        }

        const maxLogDate = new Date(sortedLogs[sortedLogs.length - 1].created_at);
        maxLogDate.setHours(23, 59, 59, 999);

        const endDateChunk = new Date(maxLogDate);
        endDateChunk.setDate(endDateChunk.getDate() - (dateOffset * 7));

        const startDateChunk = new Date(endDateChunk);
        startDateChunk.setDate(startDateChunk.getDate() - 6);
        startDateChunk.setHours(0, 0, 0, 0);

        const currentPaginatedLogs = sortedLogs.filter(l => {
            const logDate = new Date(l.created_at);
            return logDate >= startDateChunk && logDate <= endDateChunk;
        });
        
        const nextIsDisabled = dateOffset === 0;
        const prevIsDisabled = !sortedLogs.some(l => new Date(l.created_at) < startDateChunk);

        return { 
            paginatedLogs: currentPaginatedLogs, 
            startDate: startDateChunk, 
            endDate: endDateChunk, 
            isNextDisabled: nextIsDisabled, 
            isPrevDisabled: prevIsDisabled 
        };
    }, [sortedLogs, dateOffset]);

    if (!logs || logs.length === 0) {
        return <div className="h-48 flex items-center justify-center text-slate-400 text-xs italic">No data for selected period.</div>;
    }
    
    const chartData = paginatedLogs.map(l => {
        const summaryLine = l.summary?.find((s: string) => s.includes('Total Articles Updated'));
        const count = parseInt(summaryLine?.split(': ')[1] || '0', 10);
        return {
            time: new Date(l.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
            count
        };
    });

    const formatDate = (date: Date | null) => {
        if (!date) return '';
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-between items-center mb-3 px-1">
                 <h3 className="font-bold text-slate-900 dark:text-zinc-100 text-xs tracking-tight">{title}</h3>
                 <div className="flex items-center gap-1.5">
                     <InfoPopover info="Number of articles processed over time." />
                     <button 
                        onClick={() => setDateOffset(prev => prev + 1)}
                        disabled={isPrevDisabled}
                        className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-30 transition-colors border border-slate-200 dark:border-zinc-700"
                        aria-label="View previous 7 days"
                    >
                        <ChevronLeft size={14} className="text-slate-600 dark:text-zinc-400" />
                    </button>
                    <button 
                        onClick={() => setDateOffset(prev => Math.max(0, prev - 1))}
                        disabled={isNextDisabled}
                        className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-30 transition-colors border border-slate-200 dark:border-zinc-700"
                        aria-label="View next 7 days"
                    >
                        <ChevronRight size={14} className="text-slate-600 dark:text-zinc-400" />
                    </button>
                </div>
            </div>
             <div className="flex-grow h-36">
                {paginatedLogs.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
                            <defs>
                                <linearGradient id={`colorCount-${title.replace(/\s+/g, '-')}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <XAxis 
                                dataKey="time" 
                                fontSize={8} 
                                tick={{ fill: '#94a3b8', fontWeight: 500 }} 
                                axisLine={false} 
                                tickLine={false} 
                                dy={10}
                            />
                            <YAxis 
                                fontSize={8} 
                                tick={{ fill: '#94a3b8', fontWeight: 500 }} 
                                axisLine={false} 
                                tickLine={false} 
                            />
                            <Tooltip content={<CustomTooltip chartType="area" />} position={{ x: 0, y: 0 }} />
                            <Area 
                                type="monotone" 
                                dataKey="count" 
                                name="Articles" 
                                stroke="none" 
                                fillOpacity={1} 
                                fill={`url(#colorCount-${title.replace(/\s+/g, '-')})`} 
                                animationDuration={1500}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                     <div className="h-full flex items-center justify-center text-slate-400 text-xs italic">No articles updated.</div>
                )}
            </div>
             <div className="text-center text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 mt-3">
                 {startDate && endDate ? `${formatDate(startDate)} - ${formatDate(endDate)}` : ''}
            </div>
        </div>
    );
};

export const AvgDurationChart: React.FC<{ logs: any[]; title: string; }> = ({ logs, title }) => {
    const [dateOffset, setDateOffset] = useState(0);

    const sortedLogs = useMemo(() =>
        logs.slice().sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    , [logs]);

    const { paginatedLogs, startDate, endDate, isNextDisabled, isPrevDisabled } = useMemo(() => {
        if (!sortedLogs || sortedLogs.length === 0) {
            return { paginatedLogs: [], startDate: null, endDate: null, isNextDisabled: true, isPrevDisabled: true };
        }

        const maxLogDate = new Date(sortedLogs[sortedLogs.length - 1].created_at);
        maxLogDate.setHours(23, 59, 59, 999);

        const endDateChunk = new Date(maxLogDate);
        endDateChunk.setDate(endDateChunk.getDate() - (dateOffset * 7));

        const startDateChunk = new Date(endDateChunk);
        startDateChunk.setDate(startDateChunk.getDate() - 6);
        startDateChunk.setHours(0, 0, 0, 0);

        const currentPaginatedLogs = sortedLogs.filter(l => {
            const logDate = new Date(l.created_at);
            return logDate >= startDateChunk && logDate <= endDateChunk;
        });
        
        const nextIsDisabled = dateOffset === 0;
        const prevIsDisabled = !sortedLogs.some(l => new Date(l.created_at) < startDateChunk);

        return { 
            paginatedLogs: currentPaginatedLogs, 
            startDate: startDateChunk, 
            endDate: endDateChunk, 
            isNextDisabled: nextIsDisabled, 
            isPrevDisabled: prevIsDisabled 
        };
    }, [sortedLogs, dateOffset]);
    
    if (!logs || logs.length === 0) {
        return <div className="h-48 flex items-center justify-center text-slate-400 text-xs italic">No data for selected period.</div>;
    }
    
    const chartData = paginatedLogs.map(l => ({
        time: new Date(l.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        duration: parseFloat((l.duration_ms / 1000).toFixed(2))
    }));

    const formatDate = (date: Date | null) => {
        if (!date) return '';
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-between items-center mb-3 px-1">
                 <h3 className="font-bold text-slate-900 dark:text-zinc-100 text-xs tracking-tight">{title}</h3>
                 <div className="flex items-center gap-1.5">
                     <InfoPopover info="Execution duration per run over time." />
                     <button 
                        onClick={() => setDateOffset(prev => prev + 1)}
                        disabled={isPrevDisabled}
                        className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-30 transition-colors border border-slate-200 dark:border-zinc-700"
                        aria-label="View previous 7 days"
                    >
                        <ChevronLeft size={14} className="text-slate-600 dark:text-zinc-400" />
                    </button>
                    <button 
                        onClick={() => setDateOffset(prev => Math.max(0, prev - 1))}
                        disabled={isNextDisabled}
                        className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-30 transition-colors border border-slate-200 dark:border-zinc-700"
                        aria-label="View next 7 days"
                    >
                        <ChevronRight size={14} className="text-slate-600 dark:text-zinc-400" />
                    </button>
                </div>
            </div>
             <div className="flex-grow h-36">
                {paginatedLogs.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
                            <XAxis 
                                dataKey="time" 
                                fontSize={8} 
                                tick={{ fill: '#94a3b8', fontWeight: 500 }} 
                                axisLine={false} 
                                tickLine={false} 
                                dy={10}
                            />
                            <YAxis 
                                fontSize={8} 
                                tick={{ fill: '#94a3b8', fontWeight: 500 }} 
                                axisLine={false} 
                                tickLine={false} 
                                unit="s" 
                            />
                            <Tooltip content={<CustomTooltip chartType="bar" />} position={{ x: 0, y: 0 }} />
                            <Bar 
                                dataKey="duration" 
                                name="Duration" 
                                fill="#f59e0b" 
                                shape={<RoundedBar />} 
                                animationDuration={1500}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                     <div className="h-full flex items-center justify-center text-slate-400 text-xs italic">No runs in this period.</div>
                )}
            </div>
             <div className="text-center text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 mt-3">
                 {startDate && endDate ? `${formatDate(startDate)} - ${formatDate(endDate)}` : ''}
            </div>
        </div>
    );
};

export const CategoryEngagementChart: React.FC<{ categoryData: ArticleStats[] }> = ({ categoryData }) => {
    if (!categoryData || categoryData.length === 0) {
        return <div className="h-64 flex items-center justify-center text-slate-400 text-xs italic">No engagement data available.</div>;
    }

    return (
        <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    layout="vertical"
                    data={categoryData}
                    margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                    barSize={12}
                >
                    <XAxis 
                        type="number" 
                        fontSize={9} 
                        tick={{ fill: '#94a3b8', fontWeight: 500 }} 
                        axisLine={false} 
                        tickLine={false} 
                        hide={false}
                    />
                    <YAxis 
                        dataKey="category" 
                        type="category" 
                        fontSize={9} 
                        tick={{ fill: '#64748b', fontWeight: 600 }} 
                        axisLine={false} 
                        tickLine={false} 
                        width={90}
                        interval={0}
                    />
                    <Tooltip 
                        content={<CustomTooltip chartType="horizontal-bar" />} 
                        cursor={{ fill: 'var(--primary-color)', opacity: 0.05 }}
                    />
                    <Legend 
                        iconType="circle" 
                        iconSize={8}
                        verticalAlign="top"
                        align="right"
                        wrapperStyle={{ fontSize: '10px', paddingBottom: '20px', fontWeight: 600 }} 
                    />
                    <Bar dataKey="views" name="Views" stackId="a" fill="#6366f1" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="likes" name="Likes" stackId="a" fill="#ec4899" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="bookmarks" name="Bookmarks" stackId="a" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

export const TrendChart: React.FC<{ trendData: TrendDataPoint[]; label: string; color: string }> = ({ trendData, label, color }) => {
    if (!trendData || trendData.length === 0) {
        return <div className="h-48 flex items-center justify-center text-slate-400 text-xs italic">No trend data available.</div>;
    }
    
    const chartData = trendData.map(d => ({
        time: new Date(d.time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        count: d.count
    }));

    return (
        <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
                    <defs>
                        <linearGradient id={`color-${label}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                            <stop offset="95%" stopColor={color} stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <XAxis 
                        dataKey="time" 
                        fontSize={8} 
                        tick={{ fill: '#94a3b8', fontWeight: 500 }} 
                        axisLine={false} 
                        tickLine={false} 
                        dy={10}
                    />
                    <YAxis 
                        fontSize={8} 
                        tick={{ fill: '#94a3b8', fontWeight: 500 }} 
                        axisLine={false} 
                        tickLine={false} 
                    />
                    <Tooltip content={<CustomTooltip chartType="area" />} position={{ x: 0, y: 0 }} />
                    <Area 
                        type="monotone" 
                        dataKey="count" 
                        name={label} 
                        stroke="none" 
                        fillOpacity={1} 
                        fill={`url(#color-${label})`} 
                        animationDuration={1500}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};

export const DistributionChart: React.FC<{ distData: DistributionDataPoint[]; type: 'pie' | 'doughnut'; className?: string }> = React.memo(({ distData, type, className = "h-40 w-full" }) => {
    const data = useMemo(() => distData, [JSON.stringify(distData)]);

    if (!distData || distData.length === 0) {
        return <div className={`${className} flex items-center justify-center text-slate-400 text-xs italic`}>No distribution data available.</div>;
    }
    
    return useMemo(() => (
        <div className={className}>
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={type === 'doughnut' ? "50%" : 0}
                        outerRadius="75%"
                        paddingAngle={4}
                        dataKey="count"
                        nameKey="name"
                        stroke="none"
                        isAnimationActive={true}
                        animationDuration={800}
                        animationEasing="ease-out"
                    >
                        {data.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip chartType="pie" />} position={{ x: 0, y: 0 }} />
                    <Legend 
                        verticalAlign="bottom" 
                        align="center" 
                        iconType="circle" 
                        iconSize={8}
                        wrapperStyle={{ fontSize: '10px', paddingTop: '10px', fontWeight: 600 }} 
                    />
                </PieChart>
            </ResponsiveContainer>
        </div>
    ), [data, type, className]);
}, (prevProps, nextProps) => {
    return JSON.stringify(prevProps.distData) === JSON.stringify(nextProps.distData) && prevProps.type === nextProps.type && prevProps.className === nextProps.className;
});

export const HorizontalBarChart: React.FC<{ barData: BarDataPoint[]; label: string; color: string }> = React.memo(({ barData, label, color }) => {
    const sortedData = useMemo(() => {
        if (!barData || barData.length === 0) return [];
        return [...barData].sort((a, b) => b.count - a.count);
    }, [JSON.stringify(barData)]);

    if (sortedData.length === 0) {
        return <div className="h-64 flex items-center justify-center text-slate-400 text-xs italic">No data available.</div>;
    }
    
    return useMemo(() => (
        <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    layout="vertical"
                    data={sortedData}
                    margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                    barSize={12}
                >
                    <XAxis 
                        type="number" 
                        fontSize={9} 
                        tick={{ fill: '#94a3b8', fontWeight: 500 }} 
                        axisLine={false} 
                        tickLine={false} 
                    />
                    <YAxis 
                        dataKey="name" 
                        type="category" 
                        fontSize={9} 
                        tick={{ fill: '#64748b', fontWeight: 600 }} 
                        axisLine={false} 
                        tickLine={false} 
                        width={90}
                        interval={0}
                    />
                    <Tooltip 
                        content={<CustomTooltip chartType="horizontal-bar" />} 
                        cursor={{ fill: 'var(--primary-color)', opacity: 0.05 }}
                    />
                    <Bar 
                        dataKey="count" 
                        name={label} 
                        fill={color} 
                        radius={[0, 4, 4, 0]} 
                        isAnimationActive={true}
                        animationDuration={800}
                        animationEasing="ease-out"
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
    ), [sortedData, label, color]);
}, (prevProps, nextProps) => {
    return JSON.stringify(prevProps.barData) === JSON.stringify(nextProps.barData) && prevProps.label === nextProps.label && prevProps.color === nextProps.color;
});


