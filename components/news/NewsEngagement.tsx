import React from 'react';
import { StatCard, PanelCard, InfoPopover } from '../ui';
import { CategoryEngagementChart } from '../charts';
import type { ArticleEngagementData } from '../../types';
import { Eye, Heart, Bookmark, RotateCw } from 'lucide-react';

const NewsEngagement: React.FC<{ 
    engagementData: ArticleEngagementData | null,
    onRefresh: () => void;
}> = ({ engagementData, onRefresh }) => {
    
    if (!engagementData) {
        return (
            <div className="flex items-center justify-center h-96 text-slate-500">
                <p>No engagement data available.</p>
            </div>
        );
    }

    const { totalViews, totalLikes, totalBookmarks, statsByCategory, topArticles } = engagementData;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <h3 className="text-xl font-bold text-slate-700">Content Engagement</h3>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <StatCard title="Total Views" value={totalViews} description="Total times articles have been viewed" icon={<Eye size={24} />} borderColor="border-blue-500" info="Total number of times articles have been viewed by users." trend={{ value: topArticles.length, label: "Top Articles", neutral: true }} />
                <StatCard title="Total Likes" value={totalLikes} description="Total likes across all articles" icon={<Heart size={24} />} borderColor="border-pink-500" info="Total number of likes across all articles." trend={{ value: `${((totalLikes / Math.max(1, totalViews)) * 100).toFixed(1)}%`, label: "Like Rate", positive: true }} />
                <StatCard title="Total Bookmarks" value={totalBookmarks} description="Total times articles were bookmarked" icon={<Bookmark size={24} />} borderColor="border-amber-500" info="Total number of times articles were saved or bookmarked to the user's reading list." trend={{ value: `${((totalBookmarks / Math.max(1, totalViews)) * 100).toFixed(1)}%`, label: "Save Rate", positive: true }} />
                <StatCard title="Top Category" value={statsByCategory.length > 0 ? statsByCategory.reduce((prev, current) => (prev.views > current.views) ? prev : current).category : "N/A"} description="Category with the highest views" icon={<RotateCw size={24} />} borderColor="border-violet-500" info="The article category that received the highest number of views." trend={{ value: statsByCategory.length > 0 ? statsByCategory.reduce((prev, current) => (prev.views > current.views) ? prev : current).views : 0, label: "Views", neutral: true }} valueClassName="truncate text-xl sm:text-2xl" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <PanelCard className="lg:col-span-3">
                    <div className="flex justify-between items-center mb-4 w-full">
                        <h3 className="font-semibold">Engagement by Category</h3>
                        <InfoPopover info="Engagement metrics broken down by article category." />
                    </div>
                    <CategoryEngagementChart categoryData={statsByCategory} />
                </PanelCard>
                <PanelCard className="lg:col-span-2">
                    <div className="flex justify-between items-center mb-4 w-full">
                        <h3 className="font-semibold text-[var(--text-primary)]">Top 10 Most Viewed Articles</h3>
                        <InfoPopover info="List of top 10 articles ranked by highest view count." />
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left font-semibold p-2">Title</th>
                                    <th className="text-right font-semibold p-2">Views</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topArticles.map((article, index) => (
                                    <tr key={index} className="border-b last:border-b-0">
                                        <td className="p-2">
                                            <a href={article.url} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 transition-colors truncate block max-w-xs" title={article.title}>
                                                {article.title}
                                            </a>
                                        </td>
                                        <td className="text-right p-2 font-semibold text-slate-700">{article.views}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </PanelCard>
            </div>
        </div>
    );
};

export default NewsEngagement;