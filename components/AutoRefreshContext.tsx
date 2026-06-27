import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AutoRefreshContextType {
    refreshRate: number;
    setRefreshRate: (rate: number) => void;
    refreshTrigger: number;
    triggerRefresh: () => void;
}

const AutoRefreshContext = createContext<AutoRefreshContextType | undefined>(undefined);
const CountdownContext = createContext<number>(0);

export const AutoRefreshProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [refreshRate, setRefreshRateState] = useState<number>(() => {
        const saved = localStorage.getItem('ceaznet-global-refresh-rate');
        if (saved !== null) {
            const parsed = parseInt(saved, 10);
            if (!isNaN(parsed)) return parsed;
        }
        return 0; // Changed default from 10 to 0 (Never) to save database calls
    });
    const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
    const [countdown, setCountdown] = useState<number>(refreshRate);

    const setRefreshRate = (rate: number) => {
        setRefreshRateState(rate);
        localStorage.setItem('ceaznet-global-refresh-rate', rate.toString());
        setCountdown(rate);
    };

    const triggerRefresh = () => {
        setRefreshTrigger(prev => prev + 1);
        setCountdown(refreshRate);
    };

    useEffect(() => {
        if (refreshRate === 0) {
            setCountdown(0);
            return;
        }
        
        const interval = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    setRefreshTrigger(t => t + 1);
                    return refreshRate;
                }
                return prev - 1;
            });
        }, 1000);
        
        return () => clearInterval(interval);
    }, [refreshRate]);

    const contextValue = React.useMemo(() => ({
        refreshRate,
        setRefreshRate,
        refreshTrigger,
        triggerRefresh
    }), [refreshRate, refreshTrigger]);

    return (
        <AutoRefreshContext.Provider value={contextValue}>
            <CountdownContext.Provider value={countdown}>
                {children}
            </CountdownContext.Provider>
        </AutoRefreshContext.Provider>
    );
};

export const useAutoRefresh = () => {
    const context = useContext(AutoRefreshContext);
    if (context === undefined) {
        throw new Error('useAutoRefresh must be used within an AutoRefreshProvider');
    }
    return context;
};

export const useCountdown = () => useContext(CountdownContext);
