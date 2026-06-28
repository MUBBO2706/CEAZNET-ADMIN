import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAutoRefresh } from '../AutoRefreshContext';
import { PanelCard, StatCard, InfoPopover } from '../ui';
import { LoadingSpinner } from '../skeletons';
import { getAllApiKeyUsageAnalytics } from '../../services/supabaseService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, Rectangle, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { CustomTooltip } from '../charts';
import { AlertCircle, TrendingUp, AlertTriangle, KeyRound, Activity, CalendarDays, KeyIcon } from 'lucide-react';

const RoundedBar = (props: any) => {
    const { fill, x, y, width, height } = props;
    if (height < 0) return null;
    return <Rectangle {...props} radius={[4, 4, 0, 0]} fill={fill} />;
};

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#0ea5e9'];

export const ApiKeyAnalytics: React.FC = () => {
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { refreshTrigger } = useAutoRefresh();

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const { data, error } = await getAllApiKeyUsageAnalytics();
            if (error) throw error;
            setAuditLogs(data || []);
        } catch (error) {
            console.error("Failed to fetch API key audit logs:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [refreshTrigger, fetchData]);

    // Parse Error Helper
    const parseError = (reason: string | null | undefined): string => {
        if (!reason) return 'Unknown Error';
        try {
            const parsed = JSON.parse(reason);
            if (parsed.error && parsed.error.status) {
                return `${parsed.error.status} ${parsed.error.code ? `(${parsed.error.code})` : ''}`;
            }
            if (parsed.error && parsed.error.message) {
                const msg = String(parsed.error.message);
                if (msg.includes('high demand')) return 'High Demand (503)';
                if (msg.includes('quota')) return 'Quota Exceeded';
                return 'API Error';
            }
            return 'Parsed Error';
        } catch {
            const lower = String(reason).toLowerCase();
            if (lower.includes('rate limit')) return 'Rate Limited';
            if (lower.includes('quota')) return 'Quota Exceeded';
            if (lower.includes('network')) return 'Network Error';
            return 'Other Malfunction';
        }
    };

    // Derived Analytics Data
    const { timelineData, categoryData, errorData, stats } = useMemo(() => {
        if (!auditLogs || auditLogs.length === 0) {
            return { timelineData: [], categoryData: [], errorData: [], stats: { totalFailures: 0, uniqueCategories: 0, mostCommonError: 'N/A' } };
        }

        const dateMap = new Map<string, number>();
        const catMap = new Map<string, number>();
        const errMap = new Map<string, number>();

        auditLogs.forEach(log => {
            // 1. Timeline
            const dateStr = log.created_at;
            if (dateStr) {
                const dateObj = new Date(dateStr);
                const formattedDate = !isNaN(dateObj.getTime()) ? dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Unknown';
                dateMap.set(formattedDate, (dateMap.get(formattedDate) || 0) + 1);
            }

            // 2. Categories
            const cat = log.category || 'General/Unknown';
            catMap.set(cat, (catMap.get(cat) || 0) + 1);

            // 3. Error Reasons
            const errCategory = parseError(log.error_reason);
            errMap.set(errCategory, (errMap.get(errCategory) || 0) + 1);
        });

        // Format for Recharts
        const tData = Array.from(dateMap.entries()).map(([time, failures]) => ({ time, failures })).reverse(); // Oldest to newest if chronologically descending from DB
        
        const cData = Array.from(catMap.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 6); // Top 6

        const eData = Array.from(errMap.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        const mostCommonErrName = eData.length > 0 ? eData[0].name : 'N/A';

        return {
            timelineData: tData,
            categoryData: cData,
            errorData: eData,
            stats: {
                totalFailures: auditLogs.length,
                uniqueCategories: catMap.size,
                mostCommonError: mostCommonErrName
            }
        };
    }, [auditLogs]);

    if (loading && auditLogs.length === 0) {
        return (
            <div className="flex items-center justify-center h-full min-h-[300px] w-full">
                <LoadingSpinner message="Loading Analytics..." />
            </div>
        );
    }

    if (auditLogs.length === 0 && !loading) {
        return (
            <PanelCard className="w-full">
                <div className="flex flex-col items-center justify-center py-16 text-[var(--text-secondary)] gap-4 bg-[var(--subtle-bg)] rounded-xl border border-dashed border-[var(--border-color)]">
                    <div className="p-4 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-full">
                        <Activity size={32} />
                    </div>
                    <div className="text-center">
                        <p className="font-semibold text-[var(--text-primary)]">System is Healthy</p>
                        <p className="text-sm mt-1">No API key failure or fallback rotation logs found.</p>
                    </div>
                </div>
            </PanelCard>
        );
    }

    return (
        <div className="space-y-6">
            <div className="mb-4">
                <h2 className="text-xl font-bold text-[var(--text-primary)]">Key Rotation & Failure Logs</h2>
                <p className="text-sm text-[var(--text-secondary)] mt-1">Analytics derived from the api_key_audit_logs table documenting key exhaustion and failover.</p>
            </div>

            {/* Combined Row 1: Error Diagnoses & Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                {/* Left: Error Types Pie Chart */}
                <PanelCard className="h-full flex flex-col p-4 md:p-5 border border-slate-200 dark:border-zinc-800 shadow-sm bg-white dark:bg-zinc-900 rounded-xl overflow-hidden hover:shadow-md transition-shadow duration-300">
                    <div className="flex justify-between items-center mb-3 px-1 w-full">
                        <h3 className="font-bold text-slate-900 dark:text-zinc-100 text-xs tracking-tight">FAILURE DIAGNOSES</h3>
                        <InfoPopover info="Breakdown of API errors and failures by kind." />
                    </div>
                    <div className="relative p-1 flex-grow h-[200px] flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={errorData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius="60%"
                                    outerRadius="80%"
                                    paddingAngle={2}
                                    dataKey="value"
                                    nameKey="name"
                                    stroke="none"
                                    isAnimationActive={true}
                                    animationDuration={1500}
                                    animationEasing="ease-out"
                                >
                                    {errorData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <RechartsTooltip content={<CustomTooltip chartType="pie" />} position={{ x: 0, y: 0 }} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-xl font-extrabold text-slate-900 dark:text-zinc-100 tracking-tight leading-none">{stats.totalFailures}</span>
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mt-0.5">Total</span>
                        </div>
                    </div>
                    <div className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400 font-medium">
                        Based on {stats.totalFailures} failover events
                    </div>
                </PanelCard>

                {/* Right: Stats Grid */}
                <div className="flex flex-col h-full">
                    <div className="grid grid-cols-2 gap-3 sm:gap-4 flex-1 content-start">
                        <StatCard 
                            title="Total Failover Events" 
                            value={stats.totalFailures} 
                            description="Total key rotations" 
                            icon={<AlertTriangle size={20} className="text-red-500" />} 
                            borderColor="border-red-500" 
                            info="The total number of API key rotation events logged."
                        />
                        
                        <StatCard 
                            title="Impacted Categories" 
                            value={stats.uniqueCategories} 
                            description="Affected categories" 
                            icon={<CalendarDays size={20} className="text-indigo-500" />} 
                            borderColor="border-indigo-500" 
                            info="The number of different operational categories affected by key exhaustion."
                        />

                        <StatCard 
                            title="Most Common Error" 
                            value={stats.mostCommonError.length > 12 ? stats.mostCommonError.substring(0, 12) + '...' : stats.mostCommonError} 
                            description="Primary cause" 
                            icon={<AlertCircle size={20} className="text-amber-500" />} 
                            borderColor="border-amber-500"
                            info="The most frequently occurring error that caused a failover."
                            trend={{ value: stats.mostCommonError, label: "Detail", neutral: true }}
                        />

                        <StatCard 
                            title="Affected Days" 
                            value={timelineData.length} 
                            description="Days with failures" 
                            icon={<Activity size={20} className="text-sky-500" />} 
                            borderColor="border-sky-500" 
                            info="Total number of distinct days that recorded at least one failover event."
                        />
                    </div>
                </div>
            </div>

            {/* Combined Row 2: Categories Bar Chart & Timeline Area Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
                {/* Categories Bar Chart */}
                <PanelCard className="lg:col-span-1 h-full flex flex-col p-4 md:p-5 border border-slate-200 dark:border-zinc-800 shadow-sm bg-white dark:bg-zinc-900 rounded-xl overflow-hidden hover:shadow-md transition-shadow duration-300">
                    <div className="flex justify-between items-center mb-3 px-1 w-full">
                         <h3 className="font-bold text-slate-900 dark:text-zinc-100 text-xs tracking-tight">TOP IMPACTED CATEGORIES</h3>
                         <InfoPopover info="The operational categories that most often experienced failovers." />
                    </div>
                    <div className="p-1 flex-grow min-h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={categoryData} layout="vertical" margin={{ top: 5, right: 10, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#cbd5e1" opacity={0.15} />
                                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: '#94a3b8', fontWeight: 500 }} allowDecimals={false} />
                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748b', fontWeight: 500 }} width={80} />
                                <RechartsTooltip content={<CustomTooltip chartType="horizontal-bar" />} cursor={{ fill: '#e2e8f0', opacity: 0.2 }} />
                                <Bar dataKey="value" name="Failures" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={16} animationDuration={1500}>
                                    {categoryData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </PanelCard>

                {/* Timeline Chart */}
                <PanelCard className="lg:col-span-2 h-full flex flex-col p-4 md:p-5 border border-slate-200 dark:border-zinc-800 shadow-sm bg-white dark:bg-zinc-900 rounded-xl overflow-hidden hover:shadow-md transition-shadow duration-300">
                    <div className="flex justify-between items-center mb-3 px-1 w-full">
                        <h3 className="font-bold text-slate-900 dark:text-zinc-100 text-xs tracking-tight">FAILURES & ROTATIONS OVER TIME</h3>
                        <InfoPopover info="Timeline graph highlighting key rotations and failures over time." />
                    </div>
                    <div className="p-1 flex-grow min-h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={timelineData} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorRotations" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" opacity={0.15} />
                                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: '#94a3b8', fontWeight: 500 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: '#94a3b8', fontWeight: 500 }} allowDecimals={false} />
                                <RechartsTooltip content={<CustomTooltip chartType="area" />} position={{ x: 0, y: 0 }} />
                                <Area type="monotone" dataKey="failures" name="Rotation Events" stroke="#f43f5e" strokeWidth={0} fillOpacity={1} fill="url(#colorRotations)" animationDuration={1500} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </PanelCard>
            </div>
        </div>
    );
};

