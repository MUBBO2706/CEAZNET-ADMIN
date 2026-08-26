import React, { useState } from 'react';
import { BroadcastTab } from '../components/BroadcastTab';
import { History, X } from 'lucide-react';

const BroadcastPage: React.FC = () => {
    const [showHistory, setShowHistory] = useState(false);

    return (
        <div className="flex-1 flex flex-col h-[calc(100vh-50px)] overflow-hidden">
            {/* Page Header */}
            <div className="px-4 pt-4 pb-2 sm:px-6 sm:pt-6 shrink-0">
                <div className="flex items-center justify-between">
                    <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50" id="broadcast-title">
                        {showHistory ? 'Broadcast History' : 'Broadcast Control'}
                    </h1>
                    <button
                        onClick={() => setShowHistory(prev => !prev)}
                        className="text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200 transition-colors p-1"
                        title={showHistory ? 'Close History' : 'Broadcast History'}
                        aria-label={showHistory ? 'Close History' : 'Broadcast History'}
                    >
                        {showHistory ? <X size={18} /> : <History size={18} />}
                    </button>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 w-full">
                    {showHistory
                        ? 'View, manage, and restore previously generated broadcasts.'
                        : 'Create and manage live popups and system-wide banners.'}
                </p>
            </div>

            {/* Broadcast App Interface - Containerless */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                <BroadcastTab showHistory={showHistory} setShowHistory={setShowHistory} />
            </div>
        </div>
    );
};

export default BroadcastPage;
