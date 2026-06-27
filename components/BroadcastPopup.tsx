import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { dbMain } from '../services/supabaseService';

export const BroadcastPopup: React.FC = () => {
    const [queue, setQueue] = useState<any[]>([]);
    const dismissBroadcastRef = React.useRef<() => void>(() => {});

    useEffect(() => {
        dismissBroadcastRef.current = () => {
            if (queue.length > 0) {
                const currentBroadcast = queue[0];
                try {
                    const readIds = JSON.parse(localStorage.getItem('read_broadcasts') || '[]');
                    if (!readIds.includes(currentBroadcast.id)) {
                        readIds.push(currentBroadcast.id);
                        localStorage.setItem('read_broadcasts', JSON.stringify(readIds));
                    }
                } catch (e) {
                    console.error('Failed to save read broadcast ID to localStorage', e);
                }
                
                setQueue(prev => prev.slice(1));
            }
        };
    }, [queue]);

    useEffect(() => {
        const globalClose = () => {
             dismissBroadcastRef.current();
        };
        
        (window as any).closeBroadcastPopup = globalClose;
        
        const handleGlobalClick = (e: MouseEvent) => {
             const target = e.target as HTMLElement;
             if (target.closest('[data-close-broadcast="true"]')) {
                 globalClose();
             }
        };
        
        document.addEventListener('click', handleGlobalClick);

        return () => {
             // delete (window as any).closeBroadcastPopup;
             document.removeEventListener('click', handleGlobalClick);
        };
    }, []);

    useEffect(() => {
        const fetchBroadcasts = async () => {
            const { data, error } = await dbMain
                .from('broadcasts')
                .select('*')
                .eq('status', 'sent')
                .order('sent_at', { ascending: true }); 

            if (!error && data) {
                const readIds = JSON.parse(localStorage.getItem('read_broadcasts') || '[]');
                const unread = data.filter((b: any) => {
                    if (b.type === 'system_banner') return false;
                    if (readIds.includes(b.id)) return false;
                    if (b.expires_at && new Date(b.expires_at) < new Date()) return false;
                    return true;
                });
                setQueue(unread);
            }
        };

        fetchBroadcasts();

        const channel = dbMain.channel('broadcasts_changes')
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen to both INSERT and UPDATE
                    schema: 'public',
                    table: 'broadcasts'
                },
                (payload) => {
                    const newRow = payload.new as any;
                    // Only process active sent broadcasts and ignore system banners
                    if (newRow && newRow.status === 'sent' && newRow.type !== 'system_banner') {
                        if (newRow.expires_at && new Date(newRow.expires_at) < new Date()) {
                            return; // Do not show expired broadcasts
                        }
                        const readIds = JSON.parse(localStorage.getItem('read_broadcasts') || '[]');
                        if (!readIds.includes(newRow.id)) {
                            setQueue(prev => {
                                // Prevent duplicates
                                if (!prev.find(b => b.id === newRow.id)) {
                                    return [...prev, newRow];
                                }
                                return prev;
                            });
                        }
                    }
                }
            )
            .subscribe();

        return () => {
            dbMain.removeChannel(channel);
        };
    }, []);

    if (queue.length === 0) return null;

    const currentBroadcast = queue[0];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm transition-opacity">
            <div 
                className="relative z-[105] pointer-events-auto max-w-[95vw] max-h-[90vh] overflow-y-auto scrollbar-hide"
                dangerouslySetInnerHTML={{ __html: currentBroadcast.raw_html || '' }} 
            />
        </div>
    );
};
