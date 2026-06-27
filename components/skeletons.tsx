import React from 'react';

export const LoadingSpinner: React.FC<{ message?: string }> = ({ message = "Loading data..." }) => (
    <div className="flex flex-col items-center justify-center w-full flex-1 gap-4">
        <span className="loader"></span>
        <p className="text-sm font-medium text-slate-500 animate-pulse">{message}</p>
    </div>
);

// FIX: Replaced conversation-style loader with one that matches the chat session list items.
export const ChatSessionItemSkeletonLoader: React.FC<{ numberOfItems?: number }> = ({ numberOfItems = 5 }) => (
    <div className="p-2 space-y-1">
        {Array.from({ length: numberOfItems }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 px-4 py-2.5 w-full animate-pulse">
                {/* Icon Placeholder */}
                <div className="w-4 h-4 rounded bg-slate-200 dark:bg-zinc-700 shrink-0"></div>
                {/* Text Lines Placeholder */}
                <div className="flex-grow min-w-0 space-y-2">
                    {/* Title line */}
                    <div className="h-3 rounded bg-slate-200 dark:bg-zinc-700 w-3/4"></div>
                    {/* Timestamp line */}
                    <div className="h-2.5 rounded bg-slate-200 dark:bg-zinc-700 w-1/2"></div>
                </div>
            </div>
        ))}
    </div>
);

// --- Full Page Skeletons ---

export const MainDashboardSkeleton: React.FC = () => <LoadingSpinner />;
export const AgentAdminPageSkeleton: React.FC<{ view: string }> = () => <LoadingSpinner />;
export const NewsAdminPageSkeleton: React.FC<{ view: string }> = () => <LoadingSpinner />;
export const UsersPageSkeleton: React.FC = () => <LoadingSpinner />;
export const AdvancedAnalyticsSkeleton: React.FC = () => <LoadingSpinner />;