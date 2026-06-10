import React, { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend } from 'recharts';
import { Database, Server, Activity, HardDrive, Cpu, Zap, ArrowRight, TrendingUp, CheckCircle, AlertTriangle, Clock, FileText } from 'lucide-react';
import { fetchDatabaseAnalytics, fetchLiveActivityLogs, fetchAndCalculateNewsAnalytics } from '../services/supabaseService';
import type { DatabaseAnalyticsStats, RecentActivityLog } from '../types';
import { StatCard, PanelCard, InfoPopover } from '../components/ui';
import { LoadingSpinner } from '../components/skeletons';
import { CustomTooltip, RoundedBar } from '../components/charts';
import { useAutoRefresh } from '../components/AutoRefreshContext';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#f43f5e'];

const AdvancedAnalyticsPage: React.FC = () => {
    const [dbStats, setDbStats] = useState<DatabaseAnalyticsStats[]>([]);
    const [activityLogs, setActivityLogs] = useState<RecentActivityLog[]>([]);
    const [newsStats, setNewsStats] = useState<any>({});
    const [loading, setLoading] = useState(true);
    const { refreshTrigger } = useAutoRefresh();

    useEffect(() => {
        const loadData = async () => {
            try {
                const [dbData, logsData, newsData] = await Promise.all([
                    fetchDatabaseAnalytics(),
                    fetchLiveActivityLogs(),
                    fetchAndCalculateNewsAnalytics()
                ]);
                setDbStats(dbData);
                setActivityLogs(logsData);
                setNewsStats(newsData);
            } catch (error) {
                console.error("Failed to load advanced analytics:", error);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [refreshTrigger]);

    const tableActivityCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        activityLogs.forEach(log => {
            if (log.table) {
                counts[log.table] = (counts[log.table] || 0) + 1;
            }
        });
        return counts;
    }, [activityLogs]);

    const mostActiveTable = useMemo(() => {
        const entries = Object.entries(tableActivityCounts);
        if (entries.length === 0) return 'N/A';
        return entries.sort((a, b) => (b[1] as number) - (a[1] as number))[0][0];
    }, [tableActivityCounts]);

    const successRate24h = useMemo(() => {
        if (activityLogs.length === 0) return 100;
        const successCount = activityLogs.filter(log => log.status === 'SUCCESS').length;
        return ((successCount / activityLogs.length) * 100).toFixed(1);
    }, [activityLogs]);

    const peakActivityHour = useMemo(() => {
        if (activityLogs.length === 0) return 'N/A';
        const hourCounts: Record<string, number> = {};
        activityLogs.forEach(log => {
            const hour = new Date(log.timestamp).getHours();
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const formattedHour = `${hour % 12 || 12} ${ampm}`;
            hourCounts[formattedHour] = (hourCounts[formattedHour] || 0) + 1;
        });
        const entries = Object.entries(hourCounts);
        if (entries.length === 0) return 'N/A';
        return entries.sort((a, b) => (b[1] as number) - (a[1] as number))[0][0];
    }, [activityLogs]);

    const avgDbDuration = useMemo(() => {
        if (activityLogs.length === 0) return 0;
        const logsWithDuration = activityLogs.filter(l => l.duration_ms !== undefined && l.duration_ms !== null);
        if (logsWithDuration.length === 0) return 0;
        const totalDuration = logsWithDuration.reduce((sum, log) => sum + (log.duration_ms || 0), 0);
        return (totalDuration / logsWithDuration.length).toFixed(1);
    }, [activityLogs]);

    const totalTablesTracked = useMemo(() => {
        return Object.keys(tableActivityCounts).length;
    }, [tableActivityCounts]);

    const mostCommonMethod = useMemo(() => {
        const counts: Record<string, number> = {};
        activityLogs.forEach(log => {
            const method = log.method || 'UNKNOWN';
            counts[method] = (counts[method] || 0) + 1;
        });
        const entries = Object.entries(counts);
        if (entries.length === 0) return 'N/A';
        return entries.sort((a, b) => (b[1] as number) - (a[1] as number))[0][0];
    }, [activityLogs]);

    const topTablesChartData = useMemo(() => {
        return Object.entries(tableActivityCounts)
            .map(([name, actions]) => ({ name, actions: actions as number }))
            .sort((a, b) => b.actions - a.actions)
            .slice(0, 5);
    }, [tableActivityCounts]);

    const sourceDistribution = useMemo(() => {
        const counts: Record<string, number> = {};
        activityLogs.forEach(log => {
            const source = log.source || 'Unknown';
            counts[source] = (counts[source] || 0) + 1;
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    }, [activityLogs]);

    const activityByMethod = useMemo(() => {
        const counts: Record<string, number> = {};
        activityLogs.forEach(log => {
            const method = log.method || 'UNKNOWN';
            counts[method] = (counts[method] || 0) + 1;
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    }, [activityLogs]);

    const activityTimeline = useMemo(() => {
        const days: Record<string, number> = {};
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            days[d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })] = 0;
        }
        
        activityLogs.forEach(log => {
            const d = new Date(log.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            if (days[d] !== undefined) {
                days[d]++;
            }
        });
        
        return Object.entries(days).map(([name, actions]) => ({ name, actions }));
    }, [activityLogs]);

    if (loading) {
        return <LoadingSpinner />;
    }

    return (
        <div className="space-y-6 pb-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Advanced Analytics</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Deep dive into database metrics and system activity.</p>
                </div>
            </div>

            <div>
                {/* Database Section */}
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mt-8 mb-4 flex items-center gap-2">
                    <Database className="text-indigo-500" size={20} />
                    Recent Database Activity (24h)
                </h3>

                {/* DB Row 1: Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                    <StatCard 
                        title="24h DB Events" 
                        value={activityLogs.length.toLocaleString()} 
                        description="Tracked DB events" 
                        icon={<Activity className="text-indigo-500" />} 
                        borderColor="border-indigo-500" 
                        info="Total database operations performed in the last 24 hours."
                        trend={{ value: "24h", label: "Period", neutral: true }}
                    />
                    <StatCard 
                        title="Most Active Table" 
                        value={mostActiveTable} 
                        valueClassName={mostActiveTable.length > 12 ? "!text-lg sm:!text-xl truncate" : "truncate"}
                        description="Highest event volume" 
                        icon={<HardDrive className="text-emerald-500" />} 
                        borderColor="border-emerald-500" 
                        info="The database table that had the highest volume of events in the last 24 hours."
                        trend={{ value: tableActivityCounts[mostActiveTable]?.toString() || '0', label: "Events", positive: true }}
                    />
                    <StatCard 
                        title="Avg Query Time" 
                        value={`${avgDbDuration}ms`} 
                        description="Average execution time" 
                        icon={<Clock className="text-amber-500" />} 
                        borderColor="border-amber-500" 
                        info="Average execution time of tracked queries."
                        trend={{ value: "Speed", label: "Metric", neutral: true }}
                    />
                    <StatCard 
                        title="Tables Tracked" 
                        value={totalTablesTracked} 
                        description="Active tables in 24h" 
                        icon={<Database className="text-cyan-500" />} 
                        borderColor="border-cyan-500" 
                        info="Number of distinct tables that had operations in the last 24 hours."
                        trend={{ value: "Volume", label: "Metric", neutral: true }}
                    />
                </div>

                {/* DB Row 2: Chart */}
                <PanelCard className="rounded-xl p-5 shadow-sm mb-6 animate-fade-in-up" borderColor="border-indigo-500" style={{ animationDelay: '0.2s' }}>
                    <div className="flex justify-between items-center mb-6 w-full">
                        <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                            <Database size={18} className="text-indigo-500" />
                            Top Tables by Activity
                        </h3>
                        <InfoPopover info="Bar chart showing the tables with the highest number of operations." />
                    </div>
                    <div className="h-48 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={topTablesChartData} margin={{ top: 10, right: 10, left: 0, bottom: 30 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-800/50" />
                                <XAxis 
                                    dataKey="name" 
                                    fontSize={10} 
                                    tick={{ fill: '#94a3b8', fontWeight: 500 }} 
                                    axisLine={false} 
                                    tickLine={false} 
                                    dy={10} 
                                    angle={-35}
                                    textAnchor="end"
                                    height={40}
                                    tickFormatter={(value) => value.length > 15 ? `${value.substring(0, 15)}..` : value}
                                />
                                <YAxis 
                                    fontSize={10} 
                                    tick={{ fill: '#94a3b8', fontWeight: 500 }} 
                                    axisLine={false} 
                                    tickLine={false} 
                                    width={35}
                                    tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}
                                />
                                <Tooltip content={<CustomTooltip chartType="bar" />} cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }} />
                                <Bar 
                                    dataKey="actions" 
                                    name="Operations" 
                                    fill="#6366f1" 
                                    radius={[4, 4, 0, 0]}
                                    animationDuration={1500}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </PanelCard>

                {/* DB Row 3: Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                    <StatCard 
                        title="DB Success Rate" 
                        value={`${successRate24h}%`} 
                        description="Successful operations" 
                        icon={<CheckCircle className="text-blue-500" />} 
                        borderColor="border-blue-500" 
                        info="Percentage of database operations that completed successfully."
                        trend={{ value: "Optimal", label: "Status", neutral: true }}
                    />
                    <StatCard 
                        title="Peak Activity Hour" 
                        value={peakActivityHour} 
                        description="Busiest time of day" 
                        icon={<Clock className="text-rose-500" />} 
                        borderColor="border-rose-500" 
                        info="The 1-hour window with the highest number of operations."
                        trend={{ value: "Local", label: "Timezone", neutral: true }}
                    />
                    <StatCard 
                        title="Most Common Method" 
                        value={mostCommonMethod} 
                        description="Frequent operation" 
                        icon={<Zap className="text-pink-500" />} 
                        borderColor="border-pink-500" 
                        info="The most frequently executed database method (e.g., INSERT, UPDATE)."
                        trend={{ value: "Method", label: "Type", neutral: true }}
                    />
                    <StatCard 
                        title="Error Rate" 
                        value={`${(100 - Number(successRate24h)).toFixed(1)}%`} 
                        description="Failed operations" 
                        icon={<AlertTriangle className="text-rose-500" />} 
                        borderColor="border-rose-500" 
                        info="Percentage of database operations that resulted in an error."
                        trend={{ value: "Issues", label: "Status", negative: (100 - Number(successRate24h)) > 0, neutral: (100 - Number(successRate24h)) === 0 }}
                    />
                </div>

                {/* Combined Row 1: Operations by Source & System API Activity */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 mt-8">
                    {/* Left: Operations by Source */}
                    <PanelCard className="rounded-xl p-5 shadow-sm h-full flex flex-col animate-fade-in-up" borderColor="border-emerald-500" style={{ animationDelay: '0.4s' }}>
                        <div className="flex justify-between items-center mb-6 w-full">
                            <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                                <Activity size={18} className="text-emerald-500" />
                                Operations by Source
                            </h3>
                            <InfoPopover info="Pie chart of database operations broken down by the source." />
                        </div>
                        <div className="flex-1 w-full min-h-[220px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={sourceDistribution}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius="60%"
                                        outerRadius="80%"
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                        isAnimationActive={true}
                                        animationDuration={1000}
                                    >
                                        {sourceDistribution.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip chartType="pie" />} />
                                    <Legend 
                                        verticalAlign="bottom" 
                                        align="center" 
                                        iconType="circle" 
                                        iconSize={8}
                                        wrapperStyle={{ fontSize: '11px', paddingTop: '10px', fontWeight: 500 }} 
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </PanelCard>

                    {/* Right: System API Cards */}
                    <div className="flex flex-col h-full animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                            <Server className="text-violet-500" size={20} />
                            System & API Activity
                        </h3>
                        <div className="grid grid-cols-2 gap-3 sm:gap-4 flex-1 content-start">
                            <StatCard 
                                title="Avg Task Duration" 
                                value={`${newsStats.avgDurationSeconds || 0}s`} 
                                description="News updater speed" 
                                icon={<Clock className="text-violet-500" />} 
                                borderColor="border-violet-500" 
                                info="Average duration of background tasks."
                                trend={{ value: "Speed", label: "Metric", neutral: true }}
                            />
                            <StatCard 
                                title="Updater Runs" 
                                value={newsStats.totalRuns || 0} 
                                description="Total tasks" 
                                icon={<Cpu className="text-emerald-500" />} 
                                borderColor="border-emerald-500" 
                                info="Number of times the automated background updater has run."
                                trend={{ value: `${newsStats.successRate || 0}%`, label: "Success", positive: true }}
                            />
                            <StatCard 
                                title="Articles Processed" 
                                value={newsStats.totalArticlesUpdated || 0} 
                                description="Content synced" 
                                icon={<FileText className="text-sky-500" />} 
                                borderColor="border-sky-500" 
                                info="Number of articles successfully scraped or processed."
                                trend={{ value: "Volume", label: "Metric", positive: true }}
                            />
                            <StatCard 
                                title="Task Errors" 
                                value={(newsStats.totalRuns || 0) - (newsStats.successfulRuns || 0)} 
                                description="Failed runs" 
                                icon={<AlertTriangle className="text-amber-500" />} 
                                borderColor="border-amber-500" 
                                info="Number of background tasks that encountered errors."
                                trend={{ value: "Issues", label: "Status", negative: ((newsStats.totalRuns || 0) - (newsStats.successfulRuns || 0)) > 0, neutral: ((newsStats.totalRuns || 0) - (newsStats.successfulRuns || 0)) === 0 }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div>
                {/* Combined Row 2: Activity by Operation Type & System Activity Timeline */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                    <PanelCard className="lg:col-span-1 rounded-xl p-5 shadow-sm h-full flex flex-col animate-fade-in-up" borderColor="border-violet-500" style={{ animationDelay: '0.6s' }}>
                        <div className="flex justify-between items-center mb-6 w-full">
                            <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                                <Cpu size={18} className="text-violet-500" />
                                Operation Chart
                            </h3>
                            <InfoPopover info="Pie chart of recent activities by operation method." />
                        </div>
                        <div className="flex-1 w-full min-h-[220px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={activityByMethod}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius="60%"
                                        outerRadius="80%"
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                        isAnimationActive={true}
                                        animationDuration={1000}
                                    >
                                        {activityByMethod.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip chartType="pie" />} />
                                    <Legend 
                                        verticalAlign="bottom" 
                                        align="center" 
                                        iconType="circle" 
                                        iconSize={8}
                                        wrapperStyle={{ fontSize: '11px', paddingTop: '10px', fontWeight: 500 }} 
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </PanelCard>

                    <PanelCard className="lg:col-span-2 rounded-xl p-5 shadow-sm h-full flex flex-col animate-fade-in-up" borderColor="border-sky-500" style={{ animationDelay: '0.8s' }}>
                        <div className="flex justify-between items-center mb-6 w-full">
                            <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                                <Activity size={18} className="text-sky-500" />
                                System Activity Timeline
                            </h3>
                            <InfoPopover info="Line chart of the overall system events over the past 7 days." />
                        </div>
                        <div className="flex-1 w-full min-h-[220px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={activityTimeline} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                                    <defs>
                                        <linearGradient id="colorActions" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-800/50" />
                                    <XAxis 
                                        dataKey="name" 
                                        fontSize={10} 
                                        tick={{ fill: '#94a3b8', fontWeight: 500 }} 
                                        axisLine={false} 
                                        tickLine={false} 
                                        dy={10} 
                                    />
                                    <YAxis 
                                        fontSize={10} 
                                        tick={{ fill: '#94a3b8', fontWeight: 500 }} 
                                        axisLine={false} 
                                        tickLine={false} 
                                        width={35}
                                        tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}
                                    />
                                    <Tooltip content={<CustomTooltip chartType="area" />} />
                                    <Area 
                                        type="monotone" 
                                        dataKey="actions" 
                                        name="Actions" 
                                        stroke="#0ea5e9" 
                                        strokeWidth={3}
                                        fillOpacity={1} 
                                        fill="url(#colorActions)" 
                                        animationDuration={1500}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </PanelCard>
                </div>
            </div>
        </div>
    );
};

export default AdvancedAnalyticsPage;
