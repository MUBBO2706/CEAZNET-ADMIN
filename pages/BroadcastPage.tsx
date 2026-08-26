import React from 'react';
import { BroadcastTab } from '../components/BroadcastTab';
import { Radio } from 'lucide-react';

const BroadcastPage: React.FC = () => {
    return (
        <div className="flex-1 flex flex-col h-[calc(100vh-50px)] overflow-hidden p-3 pb-3 sm:p-4 sm:pb-4 lg:p-6 lg:pb-6">
            {/* Page Header */}
            <div className="flex items-center justify-between mb-4 sm:mb-5 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 flex items-center justify-center shrink-0 shadow-sm">
                        <Radio className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50" id="broadcast-title">
                            Broadcast Control
                        </h1>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                            Create and manage live popups and system-wide banners.
                        </p>
                    </div>
                </div>
            </div>

            {/* Broadcast App Interface Card */}
            <div className="flex-1 min-h-0 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                <BroadcastTab />
            </div>
        </div>
    );
};

export default BroadcastPage;
