import React, { useState } from 'react';
import { BroadcastTab } from '../components/BroadcastTab';

const BroadcastPage: React.FC = () => {
    const [showHistory, setShowHistory] = useState(false);

    return (
        <div className="flex-1 flex flex-col h-[calc(100vh-50px)] overflow-hidden">
            <BroadcastTab showHistory={showHistory} setShowHistory={setShowHistory} />
        </div>
    );
};

export default BroadcastPage;
