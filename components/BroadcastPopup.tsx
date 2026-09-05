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
                // Check if the current broadcast is dismissible
                if (currentBroadcast && currentBroadcast.is_dismissible === false) {
                    // Not dismissible, prevent closing
                    return;
                }
                
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
             document.removeEventListener('click', handleGlobalClick);
        };
    }, []);

    useEffect(() => {
        const fetchBroadcasts = async () => {
            const { data: { session } } = await dbMain.auth.getSession();
            const currentUserId = session?.user?.id ? String(session.user.id) : null;

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
                    
                    // Filter by target audience
                    if (b.target_type === 'specific') {
                        if (!currentUserId) return false;
                        const targets = Array.isArray(b.target_users) ? b.target_users : [];
                        if (!targets.map(String).includes(currentUserId)) return false;
                    }
                    
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
                async (payload) => {
                    const newRow = payload.new as any;
                    // Only process active sent broadcasts and ignore system banners
                    if (newRow && newRow.status === 'sent' && newRow.type !== 'system_banner') {
                        if (newRow.expires_at && new Date(newRow.expires_at) < new Date()) {
                            return; // Do not show expired broadcasts
                        }
                        const readIds = JSON.parse(localStorage.getItem('read_broadcasts') || '[]');
                        if (!readIds.includes(newRow.id)) {
                            // Filter by target audience for real-time insert
                            if (newRow.target_type === 'specific') {
                                const { data: { session } } = await dbMain.auth.getSession();
                                const currentUserId = session?.user?.id ? String(session.user.id) : null;
                                if (!currentUserId) return;
                                const targets = Array.isArray(newRow.target_users) ? newRow.target_users : [];
                                if (!targets.map(String).includes(currentUserId)) return;
                            }
                            
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

    // If it's not dismissible, block click-away close by capturing pointer events
    return (
        <div 
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-sm transition-opacity"
            onClick={(e) => {
                // If dismissible is false, prevent click-away close
                if (currentBroadcast.is_dismissible !== false) {
                    dismissBroadcastRef.current();
                }
            }}
        >
            <div 
                className="relative z-[105] pointer-events-auto w-full max-w-[460px] max-h-[85vh] flex items-center justify-center overflow-y-auto scrollbar-hide"
                onClick={(e) => e.stopPropagation()}
                dangerouslySetInnerHTML={{ __html: currentBroadcast.raw_html || '' }} 
            />
        </div>
    );
};
