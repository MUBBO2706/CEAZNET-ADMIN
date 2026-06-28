import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { dbMain, fetchUsersData } from '../services/supabaseService';
import { UserProfile, UserStats } from '../types';
import { 
    fetchConversations, 
    fetchMessages, 
    sendAdminMessage, 
    updateConversationStatus,
    markMessagesAsRead,
    searchConversations,
    SupportConversation,
    SupportMessage
} from '../services/supportInboxService';
import { Mail, ArrowUp, MessageSquare, CheckCircle, Clock, Send, Archive, RefreshCw, AlertCircle, X, Search, ChevronLeft, User, Check, CheckCheck, Paperclip, Bold, Italic, List, ImageIcon, FileText, Download, Reply, Forward, Braces, MoreHorizontal, MoreVertical, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MessageAttachment } from '../components/MessageAttachment';
import { generateSupportReply } from '../services/aiReplyService';
import { CustomDropdown } from '../components/ui';
import { LoadingSpinner } from '../components/skeletons';
import { usePlatformSettings } from '../components/PlatformSettingsContext';

const SparkleStarIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
            <linearGradient id="blueGlowGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#93c5fd" />
                <stop offset="40%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#1d4ed8" />
            </linearGradient>
        </defs>
        <path fill="url(#blueGlowGradient)" d="M12 0C12 8 16 12 24 12C16 12 12 16 12 24C12 16 8 12 0 12C8 12 12 8 12 0Z" />
    </svg>
);

const KNOWN_MODELS = [
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-3.1-flash-lite-preview',
    'gemini-3-flash-preview',
    'gemini-3-pro-preview',
    'gemini-3-flash',
    'gemini-3-pro'
];

const SupportInboxPage: React.FC = () => {
    const navigate = useNavigate();
    const { convId } = useParams();
    const selectedConvId = convId || null;
    
    const setSelectedConvId = (id: string | null) => {
        if (id) {
            navigate(`/support-inbox/${id}`);
        } else {
            navigate(`/support-inbox`);
        }
    };

    const { settings } = usePlatformSettings();
    const [conversations, setConversations] = useState<SupportConversation[]>([]);
    const [userProfiles, setUserProfiles] = useState<Record<string, UserProfile>>({});
    const [messages, setMessages] = useState<SupportMessage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [replyText, setReplyText] = useState("");
    const [filterType, setFilterType] = useState<'all' | 'chat' | 'mail'>('all');
    const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'closed' | 'pending'>('open');
    const [searchTerm, setSearchTerm] = useState("");
    const [showMailComposer, setShowMailComposer] = useState(false);
    const [isGeneratingAi, setIsGeneratingAi] = useState(false);
    const [lastGeneratedText, setLastGeneratedText] = useState("");
    const [isUserTyping, setIsUserTyping] = useState(false);
    const userTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const [selectedAiModel, setSelectedAiModel] = useState(() => {
        return localStorage.getItem('support-ai-model') || KNOWN_MODELS[0];
    });
    const [sendMode, setSendMode] = useState<'ai' | 'direct'>(() => {
        return (localStorage.getItem('support-send-mode') as 'ai' | 'direct') || 'ai';
    });
    const [conversationMeta, setConversationMeta] = useState<Record<string, { unreadCount: number, latestMessageSnippet: string }>>({});
    const [isSearchingDB, setIsSearchingDB] = useState(false);

    useEffect(() => {
        localStorage.setItem('support-ai-model', selectedAiModel);
    }, [selectedAiModel]);

    useEffect(() => {
        localStorage.setItem('support-send-mode', sendMode);
    }, [sendMode]);

    // Handle debounced DB search for tickets not loaded locally
    useEffect(() => {
        if (!searchTerm || searchTerm.trim() === '') return;
        const query = searchTerm.trim();
        if (query.length < 3 && !/^[0-9a-f-]{3,}$/i.test(query)) return; // Avoid very short non-UUID searches

        const timer = setTimeout(async () => {
            // First check if it's already found in local memory to avoid unnecessary DB calls (Wait, maybe it's not complete there. Let's just do it directly if user types a lot, or fallback)
            setIsSearchingDB(true);
            try {
                const results = await searchConversations(query);
                if (results.length > 0) {
                    setConversations(prev => {
                        const existingIds = new Set(prev.map(c => c.id));
                        const newConvs = results.filter(r => !existingIds.has(r.id));
                        if (newConvs.length === 0) return prev;
                        return [...prev, ...newConvs];
                    });
                }
            } catch (err) {
                console.error("DB Search failed", err);
            } finally {
                setIsSearchingDB(false);
            }
        }, 600); // 600ms debounce

        return () => clearTimeout(timer);
    }, [searchTerm]);

    const selectedConvIdRef = useRef<string | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const typingChannelRef = useRef<any>(null);
    const typingCooldownRef = useRef<boolean>(false);

    // Initial load
    useEffect(() => {
        loadConversationsAndUsers();
    }, []);

    const loadConversationsAndUsers = async () => {
        setIsLoading(true);
        try {
            const [conversationsData, usersData] = await Promise.all([
                fetchConversations(),
                fetchUsersData().catch(() => [] as UserStats[])
            ]);
            
            setConversations(conversationsData);
            
            const profileMap: Record<string, UserProfile> = {};
            usersData.forEach(stats => {
                if (stats.user) {
                    profileMap[stats.user.id] = stats.user;
                }
            });
            setUserProfiles(profileMap);

            // Egress Optimization: Fetch ONLY the `conversation_id` of unread messages.
            // This prevents downloading thousands of historical messages just to count unreads,
            // practically eliminating message egress on initial page load.
            const { data: unreadMessages } = await dbMain
                .from('support_messages')
                .select('conversation_id')
                .eq('is_read', false)
                .eq('sender_type', 'user');

            const meta: Record<string, { unreadCount: number, latestMessageSnippet: string }> = {};
            
            // Initialize metadata using the conversation's subject as a placeholder snippet
            conversationsData.forEach(c => {
                let defaultSnippet = c.type === 'mail' ? 'New Mail' : 'Chat Message';
                if (c.subject) {
                    defaultSnippet = c.subject.length > 30 ? `${c.subject.substring(0, 30)}...` : c.subject;
                }
                meta[c.id] = { unreadCount: 0, latestMessageSnippet: defaultSnippet };
            });

            // Safely count unread messages based purely on returned IDs
            if (unreadMessages) {
                for (const msg of unreadMessages) {
                    if (meta[msg.conversation_id]) {
                        meta[msg.conversation_id].unreadCount += 1;
                    }
                }
            }
            setConversationMeta(meta);
        } catch (error) {
            console.error("Failed to load data", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Load messages when conversation is selected
    useEffect(() => {
        selectedConvIdRef.current = selectedConvId;
        if (!selectedConvId) {
            setMessages([]);
            return;
        }
        
        setShowMailComposer(false);
        loadMessages(selectedConvId);
    }, [selectedConvId]);

    const loadMessages = async (convId: string) => {
        try {
            const data = await fetchMessages(convId);
            setMessages(data);
            setTimeout(() => scrollToBottom(), 100);
            await markMessagesAsRead(convId);
            
            // clear unread count for this conversation locally
            setConversationMeta(prev => ({
                ...prev,
                [convId]: {
                    ...prev[convId],
                    unreadCount: 0
                }
            }));
        } catch (error) {
            console.error("Failed to load messages", error);
        }
    };

    const scrollToBottom = () => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({
                top: scrollContainerRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    };

    // Real-time listeners
    useEffect(() => {
        // Listen to conversation insert/update/delete
        const convSubscription = dbMain.channel('admin-convs')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'support_conversations' },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setConversations(prev => [payload.new as SupportConversation, ...prev]);
                    } else if (payload.eventType === 'UPDATE') {
                        setConversations(prev => prev.map(c => c.id === payload.new.id ? payload.new as SupportConversation : c));
                    } else if (payload.eventType === 'DELETE') {
                        setConversations(prev => prev.filter(c => c.id !== payload.old.id));
                        if (selectedConvIdRef.current === payload.old.id) {
                            setSelectedConvId(null);
                        }
                        setToastMessage("Conversation deleted by user");
                        setTimeout(() => setToastMessage(null), 3000);
                    }
                }
            )
            .subscribe();

        // Listen to message changes (new messages or status updates like is_read)
        const msgSubscription = dbMain.channel('admin-msgs')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'support_messages' },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        const newMsg = payload.new as SupportMessage;
                        
                        setConversationMeta(prev => {
                            const current = prev[newMsg.conversation_id] || { unreadCount: 0, latestMessageSnippet: '' };
                            let snippet = newMsg.message || '';
                            if (!snippet && newMsg.attachment_url) snippet = '📎 Attachment';
                            
                            const isCurrentSelected = newMsg.conversation_id === selectedConvIdRef.current;
                            let newUnreadCount = current.unreadCount;
                            if (newMsg.sender_type === 'user' && !isCurrentSelected) {
                                newUnreadCount++;
                            }
                            
                            return {
                                ...prev,
                                [newMsg.conversation_id]: {
                                    unreadCount: newUnreadCount,
                                    latestMessageSnippet: snippet
                                }
                            };
                        });

                        if (newMsg.conversation_id === selectedConvIdRef.current) {
                            setMessages(prev => {
                                if(prev.find(m => m.id === newMsg.id)) return prev;
                                return [...prev, newMsg];
                            });
                            setTimeout(() => scrollToBottom(), 100);
                            
                            // Also mark the new incoming user message as read if it's the currently open chat
                            if (newMsg.sender_type === 'user') {
                                markMessagesAsRead(newMsg.conversation_id);
                            }
                        }
                        
                        // Update the conversation's "updated_at" practically
                        setConversations(prev => {
                            const idx = prev.findIndex(c => c.id === newMsg.conversation_id);
                            if (idx !== -1) {
                                const updated = { ...prev[idx], updated_at: newMsg.created_at };
                                const copy = [...prev];
                                copy.splice(idx, 1);
                                return [updated, ...copy]; // move to top
                            }
                            return prev;
                        });
                    } else if (payload.eventType === 'UPDATE') {
                        const updatedMsg = payload.new as SupportMessage;
                        
                        if (updatedMsg.is_read) {
                            setConversationMeta(prev => ({
                                ...prev,
                                [updatedMsg.conversation_id]: {
                                    ...prev[updatedMsg.conversation_id],
                                    unreadCount: 0
                                }
                            }));
                        }

                        if (updatedMsg.conversation_id === selectedConvIdRef.current) {
                            setMessages(prev => 
                                prev.map(m => m.id === updatedMsg.id ? updatedMsg : m)
                            );
                        }
                    } else if (payload.eventType === 'DELETE') {
                        const deletedMsgId = payload.old.id;
                        setMessages(prev => prev.filter(m => m.id !== deletedMsgId));
                    }
                }
            )
            .subscribe();

        return () => {
            dbMain.removeChannel(convSubscription);
            dbMain.removeChannel(msgSubscription);
            if (typingChannelRef.current) {
                dbMain.removeChannel(typingChannelRef.current);
            }
        };
    }, []);

    // Setup Typing Channel
    useEffect(() => {
        if (typingChannelRef.current) {
            dbMain.removeChannel(typingChannelRef.current);
            typingChannelRef.current = null;
        }

        if (selectedConvId) {
            const channel = dbMain.channel(`support_typing_${selectedConvId}`, {
                config: {
                    broadcast: { ack: true }
                }
            });
            
            channel.on('broadcast', { event: 'typing' }, (payload) => {
                console.log("Received typing broadcast:", payload);
                const userType = payload.payload?.user_type || payload.user_type;
                if (userType === 'user') {
                    setIsUserTyping(true);
                    if (userTypingTimeoutRef.current) clearTimeout(userTypingTimeoutRef.current);
                    userTypingTimeoutRef.current = setTimeout(() => {
                        setIsUserTyping(false);
                    }, 4000); // Hide typing indicator after 4 seconds of inactivity
                }
            });

            channel.subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    typingChannelRef.current = channel;
                }
            });
            return () => {
                dbMain.removeChannel(channel);
            };
        }
    }, [selectedConvId]);

    const handleTyping = () => {
        if (!typingChannelRef.current || typingCooldownRef.current) return;
        
        typingChannelRef.current.send({
            type: 'broadcast',
            event: 'typing',
            payload: { user_type: 'admin' }
        }).catch((err: any) => console.error("Typing broadcast error:", err));

        typingCooldownRef.current = true;
        setTimeout(() => {
           typingCooldownRef.current = false;
        }, 3000); // Send typing event at most once every 3 seconds
    };

    const handleSendReply = async () => {
        if (!replyText.trim() || !selectedConvId) return;
        
        setIsSending(true);
        try {
            const { data } = await dbMain.auth.getUser();
            const adminId = data?.user?.id || null; 
            const newMsg = await sendAdminMessage(selectedConvId, adminId, replyText);
            setReplyText("");
            setLastGeneratedText("");
            
            if (newMsg) {
                setMessages(prev => {
                    if(prev.find(m => m.id === newMsg.id)) return prev;
                    return [...prev, newMsg];
                });
                setTimeout(() => scrollToBottom(), 100);
            }
        } catch (error: any) {
            console.error("Error sending reply", error);
            alert(`Failed to send reply: ${error?.message || "Unknown error"}. Check if database tables exist.`);
        } finally {
            setIsSending(false);
        }
    };

    const handleGenerateAiReply = async () => {
        if (messages.length === 0) return;
        setIsGeneratingAi(true);
        try {
            const prompt = replyText.trim() 
                ? `Refine this message to make it more professional but keep the core meaning: ${replyText}`
                : "Provide a friendly but direct and professional response.";
            const generated = await generateSupportReply(messages, prompt, selectedAiModel);
            setReplyText(generated);
            setLastGeneratedText(generated);
            setSendMode('direct');
        } catch(err: any) {
             console.error("AI Generation Error", err);
             alert(`Failed to generate response: ${err.message}`);
        } finally {
            setIsGeneratingAi(false);
        }
    };

    const handleStatusChange = async (status: 'open' | 'closed' | 'pending') => {
        if (!selectedConvId) return;
        setConversations(prev => prev.map(c => c.id === selectedConvId ? { ...c, status } : c));
        try {
            await updateConversationStatus(selectedConvId, status);
        } catch (error) {
            console.error(error);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (sendMode === 'direct' || (lastGeneratedText && replyText === lastGeneratedText)) {
                if (replyText.trim()) handleSendReply();
            } else {
                handleGenerateAiReply();
            }
        }
    };

    const filteredConversations = conversations.filter(c => {
        if (filterType !== 'all' && c.type !== filterType) return false;
        if (filterStatus !== 'all' && c.status !== filterStatus) return false;
        if (searchTerm && !(
            c.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.subject?.toLowerCase().includes(searchTerm.toLowerCase()) || 
            c.user_id?.toLowerCase().includes(searchTerm.toLowerCase())
        )) return false;
        return true;
    });

    const activeConv = conversations.find(c => c.id === selectedConvId);

    const FilterPill = ({ label, value, count }: { label: string, value: any, count?: number }) => (
        <button 
            onClick={() => setFilterStatus(value)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 border ${filterStatus === value ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-transparent text-zinc-500 hover:text-zinc-900 border-zinc-200 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100'}`}
        >
            {label}
            {count !== undefined && count > 0 && <span className={`px-1.5 rounded-full text-[10px] ${filterStatus === value ? 'bg-indigo-500 text-white' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'}`}>{count}</span>}
        </button>
    );

    return (
        <div className="flex-1 flex flex-col md:flex-row w-full bg-white dark:bg-black overflow-hidden min-h-0 relative">
            <AnimatePresence>
                {toastMessage && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, x: '-50%', scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, x: '-50%', scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95, x: '-50%' }}
                        className="fixed bottom-6 left-1/2 z-[999] px-4 py-2.5 bg-zinc-900 dark:bg-zinc-800 border border-zinc-800 dark:border-zinc-700 text-white text-[13px] font-medium rounded-lg shadow-xl whitespace-nowrap flex items-center gap-2"
                    >
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                        {toastMessage}
                    </motion.div>
                )}
            </AnimatePresence>
            
            {/* Left Panel - Conversation List */}
            <div className={`w-full md:w-[300px] lg:w-[320px] border-r border-zinc-200 dark:border-zinc-800/50 flex flex-col h-full bg-zinc-50/50 dark:bg-black ${selectedConvId ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                            Inbox
                        </h2>
                        <div className="flex bg-zinc-200/50 dark:bg-zinc-800/50 rounded-lg p-1">
                            <button 
                                onClick={() => setFilterType('all')}
                                className={`text-xs font-medium px-3 py-1 rounded-md transition-all ${filterType === 'all' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-500'}`}
                            >All</button>
                            <button 
                                onClick={() => setFilterType('chat')}
                                className={`text-xs font-medium px-3 py-1 rounded-md transition-all flex items-center gap-1 ${filterType === 'chat' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-500'}`}
                            ><MessageSquare className="w-3 h-3" /> Chats</button>
                            <button 
                                onClick={() => setFilterType('mail')}
                                className={`text-xs font-medium px-3 py-1 rounded-md transition-all flex items-center gap-1 ${filterType === 'mail' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white' : 'text-zinc-500'}`}
                            ><Mail className="w-3 h-3" /> Mails</button>
                        </div>
                    </div>
                    
                    <div className="flex items-center min-h-[40px] relative transition-all">
                        <AnimatePresence initial={false} mode="wait">
                            {isSearchExpanded ? (
                                <motion.div 
                                    key="search"
                                    initial={{ opacity: 0, width: "0%" }}
                                    animate={{ opacity: 1, width: "100%" }}
                                    exit={{ opacity: 0, width: "0%" }}
                                    transition={{ duration: 0.2 }}
                                    className="flex items-center w-full overflow-hidden bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-500/30 rounded-full px-3 h-9 shadow-sm"
                                >
                                    <Search className="w-4 h-4 text-indigo-500 shrink-0" />
                                    <input 
                                        type="text" 
                                        placeholder="Search by ticket ID, subject or user..." 
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        autoFocus
                                        className="w-full bg-transparent border-none focus:outline-none focus:ring-0 text-[13px] text-zinc-900 dark:text-zinc-100 px-2 h-full"
                                    />
                                    {isSearchingDB && (
                                        <div className="mr-2">
                                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                                                <RefreshCw className="w-3.5 h-3.5 text-indigo-500" />
                                            </motion.div>
                                        </div>
                                    )}
                                    <button 
                                        onClick={() => {
                                            setSearchTerm("");
                                            setIsSearchExpanded(false);
                                        }} 
                                        className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 p-1 shrink-0 bg-zinc-100 dark:bg-zinc-800 rounded-full"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </motion.div>
                            ) : (
                                <motion.div 
                                    key="tabs"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="flex items-center gap-1 w-full justify-between"
                                >
                                    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide py-1">
                                        <FilterPill label="Open" value="open" count={conversations.filter(c => c.status === 'open').length} />
                                        <FilterPill label="Pending" value="pending" count={conversations.filter(c => c.status === 'pending').length} />
                                        <FilterPill label="Closed" value="closed" />
                                        <FilterPill label="All" value="all" />
                                    </div>
                                    <button 
                                        onClick={() => setIsSearchExpanded(true)}
                                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 shrink-0 transition-colors"
                                    >
                                        <Search className="w-4 h-4 text-zinc-500" />
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto w-full p-2 flex flex-col">
                    {isLoading ? (
                        <div className="flex-1 flex items-center justify-center min-h-[300px]">
                            <LoadingSpinner message="" />
                        </div>
                    ) : filteredConversations.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-zinc-500 px-4 text-center">
                            <Archive className="w-8 h-8 mb-2 opacity-20" />
                            <p className="text-sm">No conversations found.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            {filteredConversations.map(conv => {
                                const profile = userProfiles[conv.user_id];
                                const meta = conversationMeta[conv.id];
                                const unreadCount = meta?.unreadCount || 0;
                                const hasUnreads = unreadCount > 0;
                                const latestMessage = meta?.latestMessageSnippet || (conv.type === 'mail' ? conv.subject || "No Subject" : "Live Chat Session");

                                return (
                                <div 
                                    key={conv.id}
                                    onClick={() => setSelectedConvId(conv.id)}
                                    className={`p-3 cursor-pointer transition-all border-b border-zinc-200 dark:border-zinc-800 last:border-b-0 ${selectedConvId === conv.id ? 'bg-indigo-50/50 dark:bg-indigo-500/10' : 'bg-transparent hover:bg-zinc-50 dark:hover:bg-zinc-900/50'}`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3 w-full">
                                            <div className="relative">
                                                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden bg-zinc-200 dark:bg-zinc-800 border-2 border-white dark:border-black shadow-sm">
                                                    {profile?.avatar_url ? (
                                                        <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <User className="w-5 h-5 text-zinc-500" />
                                                    )}
                                                </div>
                                                <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-black flex items-center justify-center shrink-0 z-10 ${conv.type === 'mail' ? 'bg-indigo-500 text-white' : 'bg-emerald-500 text-white'}`}>
                                                    {conv.type === 'mail' ? <Mail className="w-2.5 h-2.5" /> : <MessageSquare className="w-2.5 h-2.5" />}
                                                </div>
                                            </div>
                                            <div className="flex flex-col flex-1 min-w-0">
                                                <div className="flex justify-between items-baseline mb-0.5">
                                                    <span className={`text-[13px] truncate pr-2 ${hasUnreads ? 'font-bold text-zinc-900 dark:text-zinc-100' : 'font-semibold text-zinc-800 dark:text-zinc-200'}`}>
                                                        {profile?.full_name || `User ${conv.user_id?.substring(0,4) || 'Unknown'}`}
                                                    </span>
                                                    <span className={`text-[10px] shrink-0 tabular-nums font-medium ${hasUnreads ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-400 dark:text-zinc-500'}`}>
                                                        {new Date(conv.updated_at).toLocaleDateString() === new Date().toLocaleDateString() ? new Date(conv.updated_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : new Date(conv.updated_at).toLocaleDateString([], {month: 'short', day: 'numeric'})}
                                                    </span>
                                                </div>
                                                
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className={`text-[12px] truncate ${hasUnreads ? 'font-medium text-zinc-800 dark:text-zinc-200' : 'text-zinc-500 dark:text-zinc-500'}`}>
                                                        {latestMessage}
                                                    </p>
                                                    {hasUnreads && (
                                                        <span className="shrink-0 bg-indigo-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center flex items-center justify-center -mr-1">
                                                            {unreadCount > 99 ? '99+' : unreadCount}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )})}
                        </div>
                    )}
                </div>
            </div>

            {/* Right Panel - Chat/Mail View */}
            <div className={`flex-1 flex flex-col h-full bg-white dark:bg-black overflow-hidden ${!selectedConvId ? 'hidden md:flex' : 'flex'}`}>
                {!selectedConvId ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-600">
                        <MessageSquare className="w-16 h-16 mb-4 opacity-20" />
                        <h3 className="text-xl font-semibold text-zinc-700 dark:text-zinc-300">Your Inbox</h3>
                        <p className="text-sm mt-1">Select a conversation from the sidebar to start helping.</p>
                    </div>
                ) : activeConv ? (
                    <>
                        {/* Header */}
                        <div className="px-3 py-2 sm:px-4 sm:py-3 border-b border-zinc-200 dark:border-zinc-800/50 bg-white/80 dark:bg-black/80 backdrop-blur-md flex justify-between items-center shrink-0 z-10">
                            <div className="flex items-center gap-2 sm:gap-3">
                                <button 
                                    className="md:hidden flex items-center justify-center text-zinc-600 dark:text-zinc-300 transition-colors"
                                    onClick={() => setSelectedConvId(null)}
                                >
                                    <ChevronLeft className="w-6 h-6" />
                                </button>
                                
                                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden shrink-0">
                                    {userProfiles[activeConv.user_id]?.avatar_url ? (
                                        <img src={userProfiles[activeConv.user_id].avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        <User className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-400" />
                                    )}
                                </div>
                                <div className="flex flex-col">
                                    <h3 className="font-semibold text-sm text-zinc-900 dark:text-white flex items-center gap-2">
                                        {userProfiles[activeConv.user_id || '']?.full_name || `User ${activeConv.user_id?.substring(0,8) || 'Unknown'}`}
                                        <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${
                                            activeConv.status === 'open' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' :
                                            activeConv.status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' :
                                            'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                                        }`}>{activeConv.status}</span>
                                    </h3>
                                    {activeConv.type === 'mail' && activeConv.subject && (
                                        <p className="text-xs text-zinc-500 truncate max-w-[200px] sm:max-w-[300px]">{activeConv.subject}</p>
                                    )}
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-1 sm:gap-2">
                                {activeConv.status !== 'closed' && (
                                    <button 
                                        onClick={() => handleStatusChange('closed')}
                                        className="w-8 h-8 sm:w-auto sm:px-3 sm:py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                                        title="Close Ticket"
                                    >
                                        <CheckCircle className="w-4 h-4" /> <span className="hidden sm:inline">Close</span>
                                    </button>
                                )}
                                {activeConv.status === 'open' && (
                                    <button 
                                        onClick={() => handleStatusChange('pending')}
                                        className="w-8 h-8 sm:w-auto sm:px-3 sm:py-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                                        title="Mark Pending"
                                    >
                                        <Clock className="w-4 h-4" /> <span className="hidden sm:inline">Pending</span>
                                    </button>
                                )}
                                {activeConv.status !== 'open' && (
                                    <button 
                                        onClick={() => handleStatusChange('open')}
                                        className="w-8 h-8 sm:w-auto sm:px-3 sm:py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                                        title="Re-open Ticket"
                                    >
                                        <AlertCircle className="w-4 h-4" /> <span className="hidden sm:inline">Re-open</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-3 sm:space-y-4 bg-zinc-50/30 dark:bg-transparent">
                            {messages.length === 0 && (
                                <div className="text-center text-zinc-400 text-sm py-10">No messages yet.</div>
                            )}
                            {messages.map((msg, index) => {
                                const isAdmin = msg.sender_type === 'admin';
                                const isMail = activeConv.type === 'mail';
                                const hasAttachment = !!msg.attachment_url;
                                const isImage = hasAttachment && msg.attachment_type?.startsWith('image/');
                                
                                if (isMail) {
                                    return (
                                        <motion.div 
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            key={msg.id} 
                                            className={`w-full pb-4 mb-4 border-b border-zinc-100 dark:border-zinc-800/60 last:border-0 last:mb-0 last:pb-0 ${isAdmin ? 'pl-4 border-l-2 border-l-indigo-500' : 'pl-4 border-l-2 border-l-zinc-200 dark:border-l-zinc-700'}`}
                                        >
                                            <div className="flex items-start gap-3 p-0 mb-2">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden ${isAdmin ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400' : 'bg-zinc-200 text-zinc-600 dark:bg-black dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800'}`}>
                                                    {!isAdmin && userProfiles[msg.sender_id]?.avatar_url ? (
                                                        <img src={userProfiles[msg.sender_id].avatar_url} alt="User Avatar" className="w-full h-full object-cover" />
                                                    ) : isAdmin ? (
                                                        <img src={settings.platform_logo_url} alt="Support Team" className="w-full h-full object-contain p-1" />
                                                    ) : (
                                                        <User className="w-5 h-5" />
                                                    )}
                                                </div>
                                                <div className="flex flex-col flex-1 justify-center">
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex flex-col">
                                                            <span className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-200">
                                                                {isAdmin ? 'Support Team' : (userProfiles[msg.sender_id]?.full_name || 'User')} 
                                                                <span className="text-xs font-normal text-zinc-500 ml-1">{"<"}{isAdmin ? settings.support_email : (userProfiles[msg.sender_id]?.email || 'user@clientapp.com')}{">"}</span>
                                                            </span>
                                                            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mt-0.5">
                                                                {new Date(msg.created_at).toLocaleDateString()} {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </div>
                                                        <button className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-md transition-colors" title="More options (coming soon)">
                                                            <MoreVertical className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="pl-[52px] text-[13px] sm:text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed markdown-body">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                    {msg.message}
                                                </ReactMarkdown>
                                            </div>
                                            {hasAttachment && msg.attachment_url && (
                                                <div className="pl-[52px] mt-3">
                                                    <MessageAttachment 
                                                        url={msg.attachment_url} 
                                                        name={msg.attachment_name} 
                                                        isImage={!!isImage} 
                                                        imageClassName="max-w-xs max-h-64 object-contain"
                                                        linkClassName="inline-flex items-center gap-2 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-xs font-medium text-zinc-700 dark:text-zinc-300 transition-colors border border-zinc-200 dark:border-zinc-700"
                                                        isAdmin={false}
                                                    />
                                                </div>
                                            )}
                                        </motion.div>
                                    );
                                }
                                
                                return (
                                    <motion.div 
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        key={msg.id} 
                                        className={`flex gap-2 ${isAdmin ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div className={`flex flex-col max-w-[85%] sm:max-w-[75%] ${isAdmin ? 'items-end' : 'items-start'}`}>
                                            <div className="flex items-center gap-2 mb-1 px-1">
                                                <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <div 
                                                className={`px-3 py-2 sm:px-4 sm:py-2.5 shadow-sm ${
                                                    isAdmin 
                                                        ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-sm' 
                                                        : 'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/50 text-zinc-900 dark:text-zinc-100 rounded-2xl rounded-tl-sm'
                                                } text-[13px] sm:text-sm`}
                                            >
                                                <div className="whitespace-pre-wrap break-words markdown-body">
                                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                        {msg.message}
                                                    </ReactMarkdown>
                                                </div>
                                                {hasAttachment && msg.attachment_url && (
                                                    <div className="mt-2 pt-2 border-t border-white/20 dark:border-zinc-700 w-full">
                                                        <MessageAttachment 
                                                            url={msg.attachment_url} 
                                                            name={msg.attachment_name} 
                                                            isImage={!!isImage} 
                                                            imageClassName="max-w-[200px] sm:max-w-[250px] rounded-lg max-h-48 object-cover"
                                                            linkClassName={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium w-full ${isAdmin ? 'bg-white/10 hover:bg-white/20' : 'bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600'}`}
                                                            isAdmin={isAdmin}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                            {isAdmin && (
                                               <div className="flex justify-end mt-1 px-1">
                                                  {msg.is_read ? (
                                                     <span className="text-[10px] text-indigo-500 dark:text-indigo-400 font-medium tracking-wide flex items-center gap-1">
                                                         <CheckCheck className="w-3.5 h-3.5" />
                                                         Seen {msg.read_at ? new Date(msg.read_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                                                     </span>
                                                  ) : (
                                                     <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium flex items-center gap-1">
                                                         <Check className="w-3.5 h-3.5" /> Sent
                                                     </span>
                                                  )}
                                               </div>
                                            )}
                                        </div>
                                    </motion.div>
                                );
                            })}
                            
                            {isUserTyping && (
                                <motion.div 
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    className="flex gap-2 justify-start mt-2"
                                >
                                    <div className="flex flex-col items-start max-w-[75%]">
                                        <div className="px-4 py-3 shadow-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/50 text-zinc-900 dark:text-zinc-100 rounded-2xl rounded-tl-sm text-sm flex gap-1.5 items-center">
                                            <motion.div animate={{ y: [0, -2, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0 }} className="w-1 h-1 bg-zinc-400 rounded-full" />
                                            <motion.div animate={{ y: [0, -2, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.2 }} className="w-1 h-1 bg-zinc-400 rounded-full" />
                                            <motion.div animate={{ y: [0, -2, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.4 }} className="w-1 h-1 bg-zinc-400 rounded-full" />
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </div>

                        {/* Input Area */}
                        <div className={`p-2 sm:p-3 bg-white dark:bg-black border-t border-zinc-200 dark:border-zinc-800/50 shrink-0 ${activeConv.type === 'mail' ? 'pb-4 sm:pb-5' : ''}`}>
                            {activeConv.status !== 'closed' ? (
                                activeConv.type === 'mail' ? (
                                    !showMailComposer ? (
                                        <div className="max-w-4xl mx-auto flex gap-3">
                                            <button 
                                                onClick={() => setShowMailComposer(true)}
                                                className="px-4 py-2 bg-zinc-900 dark:bg-black hover:bg-zinc-800 dark:hover:bg-zinc-900 text-white rounded-lg flex items-center justify-center transition-colors text-sm font-semibold flex-1 sm:flex-none sm:px-6 border border-zinc-700 dark:border-zinc-600 shadow-sm"
                                            >
                                                <Reply className="w-4 h-4 mr-2" />
                                                Reply
                                            </button>
                                            <button 
                                                onClick={() => setShowMailComposer(true)}
                                                className="px-4 py-2 bg-zinc-900 dark:bg-black hover:bg-zinc-800 dark:hover:bg-zinc-900 text-white rounded-lg flex items-center justify-center transition-colors text-sm font-semibold flex-1 sm:flex-none sm:px-6 border border-zinc-700 dark:border-zinc-600 shadow-sm"
                                            >
                                                <Forward className="w-4 h-4 mr-2" />
                                                Forward
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="max-w-4xl mx-auto border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden bg-white dark:bg-zinc-900 shadow-sm focus-within:ring-1 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all">
                                            <div className="flex flex-wrap items-center gap-1 px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50">
                                                <button className="p-1.5 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded transition-colors" title="Bold">
                                                    <Bold className="w-4 h-4" />
                                                </button>
                                            <button className="p-1.5 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded transition-colors" title="Italic">
                                                <Italic className="w-4 h-4" />
                                            </button>
                                            <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-700 mx-1"></div>
                                            <button className="p-1.5 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded transition-colors" title="List">
                                                <List className="w-4 h-4" />
                                            </button>
                                            <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-700 mx-1"></div>
                                            <button className="p-1.5 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded transition-colors flex items-center gap-1 text-xs font-medium" title="Attach file">
                                                <Paperclip className="w-4 h-4" /> <span className="hidden sm:inline">Attach</span>
                                            </button>
                                            <button className="p-1.5 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded transition-colors flex items-center gap-1 text-xs font-medium" title="Insert Image">
                                                <ImageIcon className="w-4 h-4" /> <span className="hidden sm:inline">Image</span>
                                            </button>
                                            <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-700 mx-1"></div>
                                            <button className="hidden sm:flex p-1.5 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded transition-colors" title="Use Template">
                                                <Braces className="w-4 h-4" />
                                            </button>
                                            <div className="flex-1"></div>
                                            <button 
                                                onClick={() => {
                                                    setShowMailComposer(false);
                                                    setReplyText('');
                                                }}
                                                className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded transition-colors"
                                                title="Close"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className="p-1">
                                            <textarea 
                                                value={replyText}
                                                onChange={(e) => {
                                                    setReplyText(e.target.value);
                                                    handleTyping();
                                                }}
                                                placeholder="Write your response... You can drag & drop files here too."
                                                className="w-full bg-transparent border-none focus:ring-0 resize-y px-3 py-3 text-[16px] sm:text-sm text-zinc-900 dark:text-white min-h-[120px] outline-none"
                                            />
                                        </div>
                                        <div className="flex flex-row justify-between items-center gap-2 px-3 py-2.5 bg-zinc-50 dark:bg-zinc-950/50 border-t border-zinc-100 dark:border-zinc-800">
                                            <div className="relative shrink-0 w-[110px] sm:w-[130px]">
                                                <CustomDropdown
                                                    options={KNOWN_MODELS}
                                                    value={selectedAiModel}
                                                    onChange={setSelectedAiModel}
                                                    triggerClassName="!h-[24px] !p-1 !px-1.5 w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-md !text-[10px] font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-shadow shadow-sm truncate"
                                                />
                                            </div>
                                            <div className="flex flex-row items-center gap-2 shrink-0">
                                                <motion.button 
                                                    layout
                                                    whileHover={!isGeneratingAi && replyText.trim() ? { scale: 1.02, filter: "brightness(1.1)" } : {}}
                                                    whileTap={!isGeneratingAi && replyText.trim() ? { scale: 0.96 } : {}}
                                                    onClick={handleGenerateAiReply}
                                                    disabled={isGeneratingAi}
                                                    className={`relative overflow-hidden flex items-center justify-center gap-1.5 px-3 transition-all text-white rounded-full font-medium text-[12px] h-[32px] w-[110px] sm:w-[120px] shrink-0 border shadow-sm ${
                                                        isGeneratingAi 
                                                            ? 'bg-slate-900 border-transparent text-white cursor-wait shadow-[0_0_15px_rgba(56,189,248,0.3)] scale-[0.98]' 
                                                            : 'bg-gradient-to-r from-violet-500 via-fuchsia-500 to-indigo-500 hover:shadow-md border-transparent disabled:opacity-70 disabled:shadow-none'
                                                    }`}
                                                >
                                                    <AnimatePresence mode="wait">
                                                        {isGeneratingAi ? (
                                                            <motion.div 
                                                                key="generating"
                                                                initial={{ opacity: 0 }}
                                                                animate={{ opacity: 1 }}
                                                                exit={{ opacity: 0 }}
                                                                transition={{ duration: 0.15 }}
                                                                className="flex flex-row items-center justify-center z-10 w-full"
                                                            >
                                                                <div className="flex gap-1 items-center justify-center h-3 drop-shadow-md mix-blend-normal">
                                                                    <motion.div animate={{ y: [0, -2, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0 }} className="w-1 h-1 bg-white rounded-full" />
                                                                    <motion.div animate={{ y: [0, -2, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.2 }} className="w-1 h-1 bg-white rounded-full" />
                                                                    <motion.div animate={{ y: [0, -2, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.4 }} className="w-1 h-1 bg-white rounded-full" />
                                                                </div>
                                                            </motion.div>
                                                        ) : (
                                                            <motion.div 
                                                                key="idle"
                                                                initial={{ opacity: 0 }}
                                                                animate={{ opacity: 1 }}
                                                                exit={{ opacity: 0 }}
                                                                transition={{ duration: 0.15 }}
                                                                className="flex flex-row items-center gap-1 z-10"
                                                            >
                                                                <Sparkles className="w-3.5 h-3.5" />
                                                                <span>With AI</span>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                    
                                                    {isGeneratingAi && (
                                                        <div className="absolute inset-0 z-0 bg-slate-950 overflow-hidden pointer-events-none rounded-full">
                                                            <motion.div
                                                                className="absolute mix-blend-screen filter blur-[8px] opacity-90 rounded-full"
                                                                style={{ width: '140%', height: '200%', background: '#38bdf8', left: '-25%', top: '-50%' }}
                                                                animate={{ 
                                                                    x: ['0%', '15%', '-5%', '0%'], 
                                                                    y: ['0%', '25%', '-10%', '0%'],
                                                                    scale: [1, 1.25, 0.9, 1],
                                                                    rotate: [0, 90, 180, 360]
                                                                }}
                                                                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                                            />
                                                            <motion.div
                                                                className="absolute mix-blend-screen filter blur-[10px] opacity-80 rounded-full"
                                                                style={{ width: '120%', height: '160%', background: '#818cf8', right: '-20%', bottom: '-40%' }}
                                                                animate={{ 
                                                                    x: ['0%', '-15%', '5%', '0%'], 
                                                                    y: ['0%', '-20%', '10%', '0%'],
                                                                    scale: [1, 1.15, 0.95, 1],
                                                                    rotate: [0, -90, -180, -360]
                                                                }}
                                                                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                                                            />
                                                        </div>
                                                    )}
                                                </motion.button>
                                                <button 
                                                    onClick={handleSendReply}
                                                    disabled={!replyText.trim() || isSending}
                                                    className={`relative overflow-hidden flex items-center justify-center gap-1.5 px-3 transition-all text-white rounded-full font-medium text-[12px] h-[32px] w-[110px] sm:w-[120px] shrink-0 border shadow-sm ${
                                                        isSending 
                                                            ? 'bg-slate-900 border-transparent text-white cursor-wait shadow-[0_0_15px_rgba(56,189,248,0.3)] scale-[0.98]' 
                                                            : 'bg-indigo-600 hover:bg-indigo-700 border-transparent disabled:opacity-50 disabled:cursor-not-allowed'
                                                    }`}
                                                >
                                                    <AnimatePresence mode="wait">
                                                        {isSending ? (
                                                            <motion.div 
                                                                key="generating"
                                                                initial={{ opacity: 0 }}
                                                                animate={{ opacity: 1 }}
                                                                exit={{ opacity: 0 }}
                                                                transition={{ duration: 0.15 }}
                                                                className="flex flex-row items-center justify-center z-10 w-full"
                                                            >
                                                                <div className="flex gap-1 items-center justify-center h-3 drop-shadow-md mix-blend-normal">
                                                                    <motion.div animate={{ y: [0, -2, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0 }} className="w-1 h-1 bg-white rounded-full" />
                                                                    <motion.div animate={{ y: [0, -2, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.2 }} className="w-1 h-1 bg-white rounded-full" />
                                                                    <motion.div animate={{ y: [0, -2, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.4 }} className="w-1 h-1 bg-white rounded-full" />
                                                                </div>
                                                            </motion.div>
                                                        ) : (
                                                            <motion.div 
                                                                key="idle"
                                                                initial={{ opacity: 0 }}
                                                                animate={{ opacity: 1 }}
                                                                exit={{ opacity: 0 }}
                                                                transition={{ duration: 0.15 }}
                                                                className="flex flex-row items-center gap-1.5 z-10"
                                                            >
                                                                <Send className="w-3.5 h-3.5" />
                                                                <span>Send Reply</span>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                    
                                                    {isSending && (
                                                        <div className="absolute inset-0 z-0 bg-slate-950 overflow-hidden pointer-events-none rounded-full">
                                                            <motion.div
                                                                className="absolute mix-blend-screen filter blur-[8px] opacity-90 rounded-full"
                                                                style={{ width: '140%', height: '200%', background: '#38bdf8', left: '-25%', top: '-50%' }}
                                                                animate={{ 
                                                                    x: ['0%', '15%', '-5%', '0%'], 
                                                                    y: ['0%', '25%', '-10%', '0%'],
                                                                    scale: [1, 1.25, 0.9, 1],
                                                                    rotate: [0, 90, 180, 360]
                                                                }}
                                                                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                                            />
                                                            <motion.div
                                                                className="absolute mix-blend-screen filter blur-[10px] opacity-80 rounded-full"
                                                                style={{ width: '120%', height: '160%', background: '#818cf8', right: '-20%', bottom: '-40%' }}
                                                                animate={{ 
                                                                    x: ['0%', '-15%', '5%', '0%'], 
                                                                    y: ['0%', '-20%', '10%', '0%'],
                                                                    scale: [1, 1.15, 0.95, 1],
                                                                    rotate: [0, -90, -180, -360]
                                                                }}
                                                                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                                                            />
                                                        </div>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    )
                                ) : (
                                    <div className="flex flex-col items-end gap-1.5 sm:gap-2 max-w-4xl mx-auto relative w-full">
                                        <div className="flex items-center justify-between w-full px-1 pb-1">
                                            <div className="text-[11px] font-medium text-zinc-500 hidden sm:block">Reply Settings</div>
                                            <div className="text-[11px] font-medium text-zinc-500 block sm:hidden">AI Model</div>
                                            <div className="relative z-20 flex items-center gap-2">
                                                <CustomDropdown
                                                    options={['ai', 'direct']}
                                                    value={sendMode}
                                                    onChange={(val) => setSendMode(val as 'ai' | 'direct')}
                                                    displayLabels={{'ai': 'With AI', 'direct': 'Direct'}}
                                                    triggerClassName="!h-[24px] !p-1 !px-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg !text-[10px] font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-shadow shadow-sm min-w-[70px] flex items-center justify-between gap-1"
                                                />
                                                <CustomDropdown
                                                    options={KNOWN_MODELS}
                                                    value={selectedAiModel}
                                                    onChange={setSelectedAiModel}
                                                    triggerClassName="!h-[24px] !p-1 !px-1.5 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-400 rounded-lg !text-[9px] font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-shadow shadow-sm max-w-[120px] flex items-center justify-between gap-1 truncate"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-end gap-1.5 sm:gap-2 w-full">
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button className="h-[44px] w-[44px] sm:h-[52px] sm:w-[52px] text-zinc-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors rounded-[16px] sm:rounded-2xl hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center shrink-0" title="Attach file">
                                                    <Paperclip className="w-[20px] h-[20px] sm:w-5 sm:h-5" />
                                                </button>
                                                <button className="hidden sm:flex h-[44px] w-[44px] sm:h-[52px] sm:w-[52px] text-zinc-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors rounded-[16px] sm:rounded-2xl hover:bg-zinc-100 dark:hover:bg-zinc-800 items-center justify-center shrink-0" title="Use Template">
                                                    <Braces className="w-[20px] h-[20px] sm:w-5 sm:h-5" />
                                                </button>
                                            </div>
                                            <div className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus-within:border-indigo-500 dark:focus-within:border-indigo-500 rounded-[22px] sm:rounded-2xl overflow-hidden transition-all duration-200 shadow-sm focus-within:shadow-md relative">
                                                <textarea 
                                                    value={replyText}
                                                    onChange={(e) => {
                                                        setReplyText(e.target.value);
                                                        handleTyping();
                                                    }}
                                                    onKeyDown={handleKeyDown}
                                                    placeholder="Reply in chat..."
                                                    className="w-full bg-transparent border-none focus:ring-0 resize-none px-4 py-[11px] sm:px-4 sm:py-[15px] text-[16px] sm:text-sm text-zinc-900 dark:text-white min-h-[44px] sm:min-h-[52px] scrollbar-hide outline-none block m-0"
                                                    rows={Math.min(5, Math.max(1, replyText.split('\n').length))}
                                                    style={{ lineHeight: '22px' }}
                                                />
                                            </div>
                                            <div className="relative shrink-0">
                                                <button 
                                                    onClick={() => {
                                                        if (sendMode === 'direct' || (lastGeneratedText && replyText === lastGeneratedText)) {
                                                            handleSendReply();
                                                        } else {
                                                            handleGenerateAiReply();
                                                        }
                                                    }}
                                                    disabled={isGeneratingAi || isSending || (sendMode === 'direct' && !replyText.trim())}
                                                    className={`h-[44px] w-[44px] sm:h-[52px] sm:w-[52px] rounded-full flex items-center justify-center shrink-0 transition-all shadow-sm relative overflow-hidden ${
                                                        isGeneratingAi || isSending
                                                            ? 'bg-slate-900 border-transparent text-white cursor-wait shadow-[0_0_15px_rgba(56,189,248,0.3)] scale-[0.98]' 
                                                            : sendMode === 'direct'
                                                                ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:scale-100 disabled:cursor-not-allowed border-transparent'
                                                                : 'bg-white dark:bg-zinc-900 border border-zinc-900 dark:border-white text-zinc-900 dark:text-white hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed'
                                                    }`}
                                                >
                                                    <AnimatePresence mode="wait">
                                                        {isSending ? (
                                                            <motion.div key="sending" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} transition={{ duration: 0.15 }} className="flex gap-[3px] items-center justify-center h-3 drop-shadow-md mix-blend-normal z-10">
                                                                <motion.div animate={{ y: [0, -2, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0 }} className="w-[3px] h-[3px] sm:w-[4px] sm:h-[4px] bg-white rounded-full" />
                                                                <motion.div animate={{ y: [0, -2, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.2 }} className="w-[3px] h-[3px] sm:w-[4px] sm:h-[4px] bg-white rounded-full" />
                                                                <motion.div animate={{ y: [0, -2, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.4 }} className="w-[3px] h-[3px] sm:w-[4px] sm:h-[4px] bg-white rounded-full" />
                                                            </motion.div>
                                                        ) : isGeneratingAi ? (
                                                            <motion.div 
                                                                key="generating"
                                                                initial={{ opacity: 0, scale: 0.8 }}
                                                                animate={{ opacity: 1, scale: 1 }}
                                                                exit={{ opacity: 0, scale: 0.8 }}
                                                                transition={{ duration: 0.15 }}
                                                                className="flex gap-[3px] items-center justify-center h-3 drop-shadow-md mix-blend-normal z-10"
                                                            >
                                                                <motion.div animate={{ y: [0, -1, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0 }} className="w-[3px] h-[3px] bg-white rounded-full" />
                                                                <motion.div animate={{ y: [0, -1, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.2 }} className="w-[3px] h-[3px] bg-white rounded-full" />
                                                                <motion.div animate={{ y: [0, -1, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.4 }} className="w-[3px] h-[3px] bg-white rounded-full" />
                                                            </motion.div>
                                                        ) : sendMode === 'direct' ? (
                                                            <motion.div key="direct" initial={{ scale: 0.5, opacity: 0, rotate: -45 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} exit={{ scale: 0.5, opacity: 0, rotate: 45 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="flex items-center justify-center z-10">
                                                                <ArrowUp className="w-5 h-5" />
                                                            </motion.div>
                                                        ) : (
                                                            <motion.div key="ai" initial={{ scale: 0.5, opacity: 0, rotate: 90 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} exit={{ scale: 0.5, opacity: 0, rotate: -90 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="flex items-center justify-center z-10">
                                                                <SparkleStarIcon className="w-7 h-7 sm:w-[30px] sm:h-[30px]" />
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>

                                                    {(isGeneratingAi || isSending) && (
                                                        <div className="absolute inset-0 z-0 bg-slate-950 overflow-hidden pointer-events-none rounded-lg">
                                                            <motion.div
                                                                className="absolute mix-blend-screen filter blur-[8px] opacity-90 rounded-full"
                                                                style={{ width: '140%', height: '200%', background: '#38bdf8', left: '-25%', top: '-50%' }}
                                                                animate={{ 
                                                                    x: ['0%', '15%', '-5%', '0%'], 
                                                                    y: ['0%', '25%', '-10%', '0%'],
                                                                    scale: [1, 1.25, 0.9, 1],
                                                                    rotate: [0, 90, 180, 360]
                                                                }}
                                                                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                                                            />
                                                            <motion.div
                                                                className="absolute mix-blend-screen filter blur-[10px] opacity-90 rounded-full"
                                                                style={{ width: '120%', height: '180%', background: '#a855f7', right: '-10%', top: '-20%' }}
                                                                animate={{ 
                                                                    x: ['0%', '-15%', '5%', '0%'], 
                                                                    y: ['0%', '-25%', '10%', '0%'],
                                                                    scale: [1, 1.1, 0.95, 1],
                                                                    rotate: [360, 180, 90, 0]
                                                                }}
                                                                transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
                                                            />
                                                            <motion.div
                                                                className="absolute mix-blend-screen filter blur-[12px] opacity-80 rounded-full"
                                                                style={{ width: '130%', height: '190%', background: '#f43f5e', left: '-15%', top: '-30%' }}
                                                                animate={{ 
                                                                    x: ['0%', '20%', '-10%', '0%'], 
                                                                    y: ['0%', '-15%', '20%', '0%'],
                                                                    scale: [1, 0.9, 1.2, 1],
                                                                    rotate: [0, -90, -180, -360]
                                                                }}
                                                                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                                                            />
                                                            <div className="absolute inset-0 bg-black/10 mix-blend-overlay"></div>
                                                        </div>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            ) : (
                                <div className="text-center py-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800">
                                    <p className="text-sm text-zinc-500 flex items-center justify-center gap-2">
                                        <Archive className="w-4 h-4" /> This conversation is closed.
                                    </p>
                                </div>
                            )}
                        </div>
                    </>
                ) : null}
            </div>
        </div>
    );
};

export default SupportInboxPage;
