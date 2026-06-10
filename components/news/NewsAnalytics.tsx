import React from 'react';
import { StatCard, PanelCard, DateRangeFilter } from '../ui';
import { NewsArticlesChart, AvgDurationChart } from '../charts';
import type { NewsLog } from '../../types';
import { PlayCircle, Percent, Timer, Newspaper } from 'lucide-react';

const NewsAnalytics: React.FC<{ 
    logs: NewsLog[], 
    analyticsData: any,
    onDateChange: (dates: { startDate: Date | null, endDate: Date | null }) => void
}> = ({ logs, analyticsData, onDateChange }) => (
    <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <h3 className="text-xl font-bold text-slate-700">Analytics Dashboard</h3>
            <DateRangeFilter onChange={onDateChange} />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard title="Total Runs" value={analyticsData.totalRuns} description="Total news update operations" icon={<PlayCircle size={24} />} borderColor="border-indigo-500" info="Total number of times the news update process has run." trend={{ value: `${analyticsData.successRate}%`, label: "Success", positive: analyticsData.successRate >= 90 }} />
            <StatCard title="Success Rate" value={`${analyticsData.successRate}%`} description="Rate of successful update runs" icon={<Percent size={24} />} borderColor="border-green-500" info="Percentage of news update operations that completed successfully." trend={{ value: Math.round(analyticsData.totalRuns * (analyticsData.successRate / 100)), label: "Successful", neutral: true }} />
            <StatCard title="Avg. Duration" value={`${analyticsData.avgDuration} s`} description="Average time per operation" icon={<Timer size={24} />} borderColor="border-yellow-500" info="The average duration of each news update run in seconds." trend={{ value: analyticsData.totalRuns, label: "Runs", neutral: true }} />
            <StatCard title="Articles Updated" value={analyticsData.articlesUpdated} description="Total articles processed" icon={<Newspaper size={24} />} borderColor="border-sky-500" info="Total number of news articles processed or updated across all runs." trend={{ value: (analyticsData.articlesUpdated / Math.max(1, analyticsData.totalRuns)).toFixed(1), label: "Avg/Run", neutral: true }} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PanelCard>
                <NewsArticlesChart logs={logs} title="Articles Processed per Run" />
            </PanelCard>
            <PanelCard>
                <AvgDurationChart logs={logs} title="Run Duration" />
            </PanelCard>
        </div>
    </div>
);

export default NewsAnalytics;