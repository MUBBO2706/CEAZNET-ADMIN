import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Sparkles, RefreshCw, AlertCircle, CheckCircle2, Megaphone, Eye, Clock, RotateCcw, Cpu, Palette, LayoutDashboard, Code, Wand2, History, X, Check, Copy, MoreVertical, Trash2 } from 'lucide-react';
import { generateBroadcastHtml, publishBroadcast, BroadcastIteration, fetchBroadcastHistory, deleteBroadcast, upsertSystemBanner } from '../services/broadcastAiService';

import { ConfirmationModal, CustomDropdown } from './ui';

const draftState = {
    prompt: '',
    stylePrompt: '',
    isGenerating: false,
    isSending: false,
    currentThought: '',
    generatedHtml: null as string | null,
    history: [] as BroadcastIteration[],
    statusData: null as {type: 'success'|'error', msg: string} | null,
    expireDuration: 0,
    broadcastType: 'popup' as 'popup' | 'system_banner',
    bannerType: 'maintenance' as 'maintenance' | 'development' | 'testing' | 'alert',
    isActive: true,
};

const listeners = new Set<() => void>();
const notifyListeners = () => listeners.forEach(l => l());

const useBroadcastState = () => {
    const [, setTick] = useState(0);

    useEffect(() => {
        const update = () => setTick(t => t + 1);
        listeners.add(update);
        return () => { listeners.delete(update); };
    }, []);

    const setPrompt = (v: string) => { draftState.prompt = v; notifyListeners(); };
    const setStylePrompt = (v: string) => { draftState.stylePrompt = v; notifyListeners(); };
    const setIsGenerating = (v: boolean) => { draftState.isGenerating = v; notifyListeners(); };
    const setIsSending = (v: boolean) => { draftState.isSending = v; notifyListeners(); };
    const setCurrentThought = (v: string) => { draftState.currentThought = v; notifyListeners(); };
    const setGeneratedHtml = (v: string | null) => { draftState.generatedHtml = v; notifyListeners(); };
    const setHistory = (v: BroadcastIteration[] | ((prev: BroadcastIteration[]) => BroadcastIteration[])) => { 
        draftState.history = typeof v === 'function' ? v(draftState.history) : v; 
        notifyListeners(); 
    };
    const setStatusData = (v: {type: 'success'|'error', msg: string} | null) => { draftState.statusData = v; notifyListeners(); };
    const setExpireDuration = (v: number) => { draftState.expireDuration = v; notifyListeners(); };
    const setBroadcastType = (v: 'popup' | 'system_banner') => { draftState.broadcastType = v; notifyListeners(); };
    const setBannerType = (v: 'maintenance' | 'development' | 'testing' | 'alert') => { draftState.bannerType = v; notifyListeners(); };
    const setIsActive = (v: boolean) => { draftState.isActive = v; notifyListeners(); };

    return {
        ...draftState,
        setPrompt,
        setStylePrompt,
        setIsGenerating,
        setIsSending,
        setCurrentThought,
        setGeneratedHtml,
        setHistory,
        setStatusData,
        setExpireDuration,
        setBroadcastType,
        setBannerType,
        setIsActive
    };
};


export const BroadcastTab: React.FC = () => {
    const {
        prompt, setPrompt,
        stylePrompt, setStylePrompt,
        isGenerating, setIsGenerating,
        isSending, setIsSending,
        currentThought, setCurrentThought,
        generatedHtml, setGeneratedHtml,
        history, setHistory,
        statusData, setStatusData,
        expireDuration, setExpireDuration,
        broadcastType, setBroadcastType,
        bannerType, setBannerType,
        isActive, setIsActive
    } = useBroadcastState();

    const [showHistory, setShowHistory] = useState(false);
    const [broadcastList, setBroadcastList] = useState<any[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    useEffect(() => {
        if (showHistory) {
            setIsLoadingHistory(true);
            fetchBroadcastHistory().then(data => {
                setBroadcastList(data);
                setIsLoadingHistory(false);
            });
        }
    }, [showHistory]);

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        
        setIsGenerating(true);
        setStatusData(null);
        setCurrentThought("Analyzing your request...");
        
        const combinedPrompt = stylePrompt.trim() 
            ? `${prompt}\n\nStyling Instructions: ${stylePrompt}`
            : prompt;

        try {
            const html = await generateBroadcastHtml(combinedPrompt, history, (thought) => {
                setCurrentThought(thought);
            });
            
            // Update history
            setHistory(prev => [
                ...prev, 
                { role: 'user', content: prompt },
                { role: 'model', content: html }
            ]);
            
            setGeneratedHtml(html);
            setPrompt(''); // Clear prompt
        } catch (error: any) {
            setStatusData({ type: 'error', msg: error.message || 'Failed to generate content.' });
        } finally {
            setIsGenerating(false);
            setCurrentThought('');
        }
    };

    const AutoScaledPreview = ({ html }: { html: string }) => {
        const containerRef = useRef<HTMLDivElement>(null);
        const contentRef = useRef<HTMLDivElement>(null);
        const [scale, setScale] = useState(1);

        useEffect(() => {
            let animationFrameId: number;
            const updateScale = () => {
                if (containerRef.current && contentRef.current) {
                    const containerWidth = containerRef.current.clientWidth;
                    const containerHeight = containerRef.current.clientHeight;
                    
                    const contentWidth = contentRef.current.offsetWidth;
                    const contentHeight = contentRef.current.offsetHeight;

                    let newScale = 1;
                    if (contentWidth > 0 && contentHeight > 0) {
                        const paddingX = 40; // horizontal padding
                        const paddingY = 40; // vertical padding
                        const scaleX = (containerWidth - paddingX) / contentWidth;
                        const scaleY = (containerHeight - paddingY) / contentHeight;
                        newScale = Math.min(scaleX, scaleY, 1);
                    }
                    setScale(newScale);
                }
            };

            const resizeObserver = new ResizeObserver(() => {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = requestAnimationFrame(updateScale);
            });
            
            if (containerRef.current) resizeObserver.observe(containerRef.current);
            if (contentRef.current) resizeObserver.observe(contentRef.current);
            
            updateScale();

            return () => {
                resizeObserver.disconnect();
                cancelAnimationFrame(animationFrameId);
            };
        }, [html]);

        return (
            <div ref={containerRef} className="relative w-full h-full flex items-center justify-center overflow-hidden">
                <div 
                    style={{ 
                        transform: `scale(${scale})`,
                        transformOrigin: 'center center',
                        transition: 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                    className="flex justify-center items-center"
                >
                    <div 
                        ref={contentRef}
                        className="pointer-events-none isolate"
                        style={{ 
                            width: 'max-content',
                            maxWidth: '400px', 
                        }}
                        dangerouslySetInnerHTML={{ __html: html }}
                    />
                </div>
            </div>
        );
    };

    const handleSend = async () => {
        setIsSending(true);
        setStatusData(null);
        
        try {
            if (broadcastType === 'system_banner') {
                const success = await upsertSystemBanner(bannerType, isActive);
                if (success) {
                    setStatusData({ type: 'success', msg: 'System banner updated successfully!' });
                    setTimeout(() => setStatusData(null), 3000);
                } else {
                    setStatusData({ type: 'error', msg: 'Failed to update system banner.' });
                }
            } else {
                if (!generatedHtml) {
                    setIsSending(false);
                    return;
                }
                
                let expiresAtValid = null;
                if (expireDuration > 0) {
                    // expireDuration is in hours
                    expiresAtValid = new Date(Date.now() + expireDuration * 60 * 60 * 1000).toISOString();
                }

                const success = await publishBroadcast(generatedHtml, 'Broadcast Popup', history, expiresAtValid, broadcastType);
                
                if (success) {
                    setStatusData({ type: 'success', msg: 'Broadcast pushed successfully!' });
                    setTimeout(() => {
                        setPrompt('');
                        setStylePrompt('');
                        setGeneratedHtml(null);
                        setHistory([]);
                        setStatusData(null);
                        setExpireDuration(0);
                    }, 3000);
                } else {
                    setStatusData({ type: 'error', msg: 'Broadcast failed.' });
                }
            }
        } catch (error: any) {
             setStatusData({ type: 'error', msg: error.message || 'Error occurred while sending.' });
        } finally {
            setIsSending(false);
        }
    };

    const handleDeleteBroadcast = async (id: string) => {
        setDeleteConfirmId(id);
    };

    const confirmDeleteBroadcast = async () => {
        if (!deleteConfirmId) return;
        
        const success = await deleteBroadcast(deleteConfirmId);
        if (success) {
            setBroadcastList(prev => prev.filter(item => item.id !== deleteConfirmId));
            setDeleteConfirmId(null);
        } else {
            alert("Failed to delete broadcast.");
            setDeleteConfirmId(null);
        }
    };

    return (
        <div className="flex flex-col flex-1 h-full bg-white dark:bg-zinc-950 overflow-hidden relative">
            
            {/* Input Composer Section - Top Compact Spotlight */}
            <div className="p-3 shrink-0 bg-slate-50/50 dark:bg-zinc-900/30 border-b border-slate-100 dark:border-zinc-800">
                <div className="group flex flex-col relative rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm focus-within:ring-4 focus-within:ring-indigo-500/10 focus-within:border-indigo-500/30 transition-all duration-300 overflow-hidden">
                    
                    {broadcastType === 'popup' ? (
                        <>
                            <div className="relative">
                                <textarea
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder={history.length > 0 ? "Adjust the broadcast... (e.g. 'Make it shorter')" : "Design a broadcast popup... (e.g. 'Servers down in 15 mins')"}
                                    className="w-full bg-transparent text-[13px] px-4 py-3 min-h-[64px] max-h-[120px] resize-none focus:outline-none text-slate-800 dark:text-zinc-200 placeholder:text-slate-400 dark:placeholder:text-zinc-500 tracking-tight leading-relaxed placeholder:font-light transition-opacity disabled:opacity-50"
                                    disabled={isGenerating}
                                />
                            </div>

                            <div className="relative border-t border-slate-100 dark:border-zinc-800/80 bg-slate-50/30 dark:bg-zinc-950/30">
                                <div className="flex items-center px-4">
                                    <Palette size={13} className="text-slate-400 dark:text-zinc-500 shrink-0" />
                                    <input
                                        type="text"
                                        value={stylePrompt}
                                        onChange={(e) => setStylePrompt(e.target.value)}
                                        placeholder="Styling instructions (e.g. 'Dark mode, rounded corners, modern')"
                                        className="w-full bg-transparent text-[12px] px-3 py-2.5 focus:outline-none text-slate-700 dark:text-zinc-300 placeholder:text-slate-400 dark:placeholder:text-zinc-500 transition-opacity disabled:opacity-50"
                                        disabled={isGenerating}
                                    />
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-4 w-full sm:w-auto">
                                <div className="flex flex-col w-full sm:w-auto flex-1">
                                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Banner Variant</label>
                                    <CustomDropdown
                                        options={['maintenance', 'development', 'testing', 'alert']}
                                        value={bannerType}
                                        onChange={(v) => setBannerType(v as any)}
                                        triggerClassName="!text-[13px] !bg-slate-100 dark:!bg-zinc-800/50 !text-slate-800 dark:!text-zinc-200 !border-slate-200 dark:!border-zinc-700/50 !rounded-lg !px-3 !py-[7px] !outline-none focus:!ring-2 focus:!ring-indigo-500/20 w-full"
                                        displayLabels={{
                                            maintenance: 'Maintenance',
                                            development: 'Development',
                                            testing: 'Testing',
                                            alert: 'Alert'
                                        }}
                                    />
                                </div>
                                <div className="flex flex-col ml-2 sm:ml-4">
                                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Status</label>
                                    <div className="flex items-center gap-2 pt-0.5">
                                        <button 
                                            type="button" 
                                            onClick={() => setIsActive(!isActive)}
                                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer shadow-inner items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${isActive ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-zinc-600'}`}
                                        >
                                            <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${isActive ? 'translate-x-4' : 'translate-x-0'}`} />
                                        </button>
                                        <span onClick={() => setIsActive(!isActive)} className="text-[13px] font-medium text-slate-700 dark:text-zinc-300 select-none whitespace-nowrap cursor-pointer">
                                            {isActive ? 'Active (Live)' : 'Inactive (Hidden)'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    <div className="flex justify-between items-center px-2 py-2 bg-slate-50/50 dark:bg-zinc-950/50 border-t border-slate-100 dark:border-zinc-800/80">
                        {/* Compact Settings */}
                        {/* Adding full width and overflow handling so it actually scrolls gracefully */}
                        <div className="flex items-center gap-4 opacity-90 transition-opacity overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] w-full min-w-0 pr-2">
                            <button 
                                onClick={() => setShowHistory(true)}
                                className="flex items-center gap-1.5 px-2 py-1 hover:bg-slate-200/60 dark:hover:bg-zinc-800/80 rounded-md transition-colors text-slate-500 dark:text-zinc-400 group shrink-0"
                            >
                                <History size={12} className="group-hover:text-slate-700 dark:group-hover:text-zinc-200 transition-colors" />
                                <span className="text-[10px] font-semibold uppercase tracking-wider group-hover:text-slate-700 dark:group-hover:text-zinc-200 transition-colors whitespace-nowrap">History</span>
                            </button>
                            
                            <div className="flex items-center gap-1.5 shrink-0">
                                <LayoutDashboard size={12} className="text-slate-400 dark:text-zinc-500 shrink-0" />
                                <CustomDropdown
                                    options={['popup', 'system_banner']}
                                    value={broadcastType}
                                    onChange={(v) => setBroadcastType(v as 'popup' | 'system_banner')}
                                    triggerClassName="!bg-transparent !border-none !p-0 !text-[10px] !font-medium !text-slate-600 dark:!text-zinc-400 hover:!text-slate-800 dark:hover:!text-zinc-200 !shadow-none !gap-1"
                                    className="w-auto [&_.custom-dropdown-panel]:w-40"
                                    displayLabels={{
                                        popup: 'Fullscreen Popup',
                                        system_banner: 'System Banner'
                                    }}
                                />
                            </div>
                            
                            {/* Hide popup-specific settings if system banner is selected */}
                            {broadcastType === 'popup' && (
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <Clock size={12} className="text-slate-400 dark:text-zinc-500 shrink-0" />
                                    <CustomDropdown
                                        options={['0', '1', '6', '24', '72', '168']}
                                        value={expireDuration.toString()}
                                        onChange={(v) => setExpireDuration(Number(v))}
                                        triggerClassName="!bg-transparent !border-none !p-0 !text-[10px] !font-medium !text-slate-600 dark:!text-zinc-400 hover:!text-slate-800 dark:hover:!text-zinc-200 !shadow-none !gap-1"
                                        className="w-auto [&_.custom-dropdown-panel]:w-32"
                                        displayLabels={{
                                            '0': 'Permanent',
                                            '1': '1 HR Expire',
                                            '6': '6 HR Expire',
                                            '24': '24 HR Expire',
                                            '72': '3 Day Expire',
                                            '168': '1 Wk Expire'
                                        }}
                                    />
                                </div>
                            )}
                            
                        </div>
                        
                        {/* Actions visible only for popup generation */}
                        {broadcastType === 'popup' && (
                            <div className="flex items-center gap-2 pl-2 shrink-0 border-l border-slate-200 dark:border-zinc-800">
                                {history.length > 0 && (
                                    <button 
                                        onClick={() => { setHistory([]); setGeneratedHtml(null); setPrompt(''); setStylePrompt(''); setStatusData(null); }}
                                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-slate-200/50 dark:hover:bg-zinc-800 rounded-lg transition-colors tooltip-trigger"
                                        title="Reset"
                                        disabled={isGenerating || isSending}
                                    >
                                        <RotateCcw size={14} />
                                    </button>
                                )}
                                <motion.button 
                                    layout
                                    whileHover={!isGenerating && !isSending && prompt.trim() ? { scale: 1.02, filter: "brightness(1.1)" } : {}}
                                    whileTap={!isGenerating && !isSending && prompt.trim() ? { scale: 0.96 } : {}}
                                    onClick={handleGenerate}
                                    disabled={!prompt.trim() || isGenerating || isSending}
                                    className={`relative overflow-hidden flex items-center justify-center gap-1.5 px-4 py-1.5 transition-all text-white rounded-lg font-semibold text-[11px] h-[28px] shrink-0 border ${
                                        isGenerating 
                                            ? 'bg-slate-900 border-transparent text-white cursor-wait shadow-[0_0_15px_rgba(56,189,248,0.3)] scale-[0.98]' 
                                            : 'bg-indigo-600 hover:bg-indigo-700 shadow-[0_2px_10px_-2px_rgba(79,70,229,0.4)] border-transparent disabled:bg-indigo-600/50 disabled:text-white/50 disabled:shadow-none'
                                    }`}
                                >
                                    <AnimatePresence mode="wait">
                                        {isGenerating ? (
                                            <motion.div 
                                                key="generating"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.15 }}
                                                className="flex flex-row items-center justify-center z-10 min-w-[60px]"
                                            >
                                                <div className="flex gap-1 items-center justify-center h-3 drop-shadow-md mix-blend-normal">
                                                    <motion.div animate={{ y: [0, -2, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0 }} className="w-1 h-1 bg-white rounded-full" />
                                                    <motion.div animate={{ y: [0, -2, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.15 }} className="w-1 h-1 bg-white rounded-full" />
                                                    <motion.div animate={{ y: [0, -2, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.3 }} className="w-1 h-1 bg-white rounded-full" />
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
                                                <Sparkles size={12} />
                                                <span>{history.length > 0 ? 'Refine' : 'Generate'}</span>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                    
                                    {/* Fluid AI-like Loading Background (ChatGPT Image Gen style) */}
                                    {isGenerating && (
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
                                                    x: ['0%', '-20%', '10%', '0%'], 
                                                    y: ['0%', '-15%', '25%', '0%'],
                                                    scale: [1, 0.85, 1.15, 1],
                                                    rotate: [360, 180, 90, 0]
                                                }}
                                                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                                            />
                                            <motion.div
                                                className="absolute mix-blend-screen filter blur-[6px] opacity-80 rounded-full"
                                                style={{ width: '100%', height: '150%', background: '#ec4899', left: '20%', top: '-30%' }}
                                                animate={{ 
                                                    x: ['0%', '20%', '-10%', '0%'], 
                                                    y: ['0%', '15%', '-20%', '0%'],
                                                    scale: [0.9, 1.3, 0.85, 0.9],
                                                    rotate: [0, -90, -180, -360]
                                                }}
                                                transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
                                            />
                                            <div className="absolute inset-0 bg-black/10 mix-blend-overlay"></div>
                                            <div className="absolute inset-0 shadow-[inset_0_0_8px_rgba(0,0,0,0.6)] rounded-lg border border-white/5"></div>
                                        </div>
                                    )}
                                </motion.button>
                            </div>
                        )}
                        {/* Actions visible only for system banner */}
                        {broadcastType === 'system_banner' && (
                            <div className="flex items-center gap-2 pl-2 shrink-0 border-l border-slate-200 dark:border-zinc-800">
                                <motion.button 
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.96 }}
                                    onClick={handleSend}
                                    disabled={isSending}
                                    className="relative flex items-center justify-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-[11px] transition-colors disabled:opacity-50 h-[28px]"
                                >
                                    {isSending ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                                    Save Banner
                                </motion.button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Preview Section - Bottom Immersive Canvas */}
            <div className="flex-1 relative flex flex-col min-h-[300px] bg-slate-100/40 dark:bg-black/30 overflow-hidden pattern-diagonal-lines pattern-slate-200 dark:pattern-zinc-800/40 pattern-size-4 pattern-opacity-40">
                
                {/* Floating Status Header */}
                <div className="absolute top-3 inset-x-3 z-30 flex justify-between items-start pointer-events-none">
                    <div className="flex flex-col gap-2 pointer-events-auto">
                        <AnimatePresence>
                            {statusData && (
                                <motion.div 
                                    initial={{ opacity: 0, x: -10 }} 
                                    animate={{ opacity: 1, x: 0 }} 
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className={`px-3 py-2 rounded-xl flex items-start gap-2 shadow-lg backdrop-blur-md border max-w-[200px] ${statusData.type === 'success' ? 'bg-emerald-500/90 border-emerald-600/50 text-white' : 'bg-red-500/90 border-red-600/50 text-white'}`}
                                >
                                    {statusData.type === 'success' ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> : <AlertCircle size={14} className="mt-0.5 shrink-0" />}
                                    <p className="text-[11px] font-medium leading-snug">{statusData.msg}</p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Floating Push Live Button (Bottom Right) */}
                {generatedHtml && (
                    <div className="absolute bottom-4 right-4 z-30 pointer-events-auto origin-bottom-right">
                        <AnimatePresence mode="wait">
                            {!isSending ? (
                                <motion.button 
                                    key="send"
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleSend}
                                    className="flex items-center gap-1.5 pl-3 pr-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-2xl font-bold text-[12px] transition-all shadow-[0_8px_20px_-4px_rgba(16,185,129,0.5)] border border-emerald-400/30"
                                >
                                    <Send size={14} className="shrink-0 -mb-[1px]" />
                                    Push Live
                                </motion.button>
                            ) : (
                                <motion.div 
                                    key="loading"
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="flex items-center gap-2 pl-3 pr-4 py-2.5 bg-emerald-600/80 text-white rounded-2xl font-bold text-[12px] shadow-sm backdrop-blur-sm"
                                >
                                    <RefreshCw size={14} className="animate-spin" />
                                    Deploying...
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
                
                {/* Canvas Content */}
                <div className="flex-1 w-full h-full p-6 pt-16 pb-20 flex items-center justify-center relative">
                    {isGenerating ? (
                        <motion.div 
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 overflow-hidden bg-slate-900 z-10 flex items-center justify-center pointer-events-auto"
                        >
                            <motion.div
                                drag
                                dragConstraints={{ top: -100, left: -100, right: 100, bottom: 100 }}
                                dragElastic={0.5}
                                className="absolute mix-blend-screen filter blur-[50px] sm:blur-[80px] opacity-80 rounded-full cursor-grab active:cursor-grabbing"
                                style={{ width: '60vw', height: '60vw', maxWidth: '500px', maxHeight: '500px', background: '#38bdf8' }}
                                animate={{ 
                                    x: ['-20%', '20%', '-10%', '-20%'], 
                                    y: ['-20%', '10%', '20%', '-20%'],
                                    scale: [1, 1.2, 0.9, 1],
                                }}
                                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                            />
                            <motion.div
                                drag
                                dragConstraints={{ top: -100, left: -100, right: 100, bottom: 100 }}
                                dragElastic={0.5}
                                className="absolute mix-blend-screen filter blur-[60px] sm:blur-[90px] opacity-80 rounded-full cursor-grab active:cursor-grabbing"
                                style={{ width: '50vw', height: '50vw', maxWidth: '400px', maxHeight: '400px', background: '#a855f7' }}
                                animate={{ 
                                    x: ['20%', '-10%', '20%', '20%'], 
                                    y: ['20%', '-20%', '-10%', '20%'],
                                    scale: [1, 0.8, 1.1, 1],
                                }}
                                transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
                            />
                            <motion.div
                                drag
                                dragConstraints={{ top: -100, left: -100, right: 100, bottom: 100 }}
                                dragElastic={0.5}
                                className="absolute mix-blend-screen filter blur-[55px] sm:blur-[85px] opacity-70 rounded-full cursor-grab active:cursor-grabbing"
                                style={{ width: '70vw', height: '70vw', maxWidth: '600px', maxHeight: '600px', background: '#ec4899' }}
                                animate={{ 
                                    x: ['0%', '15%', '-15%', '0%'], 
                                    y: ['10%', '-15%', '10%', '10%'],
                                    scale: [0.9, 1.2, 0.9, 0.9],
                                }}
                                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                            />
                        </motion.div>
                    ) : broadcastType === 'system_banner' ? (
                        <div className="w-full flex flex-col items-center justify-start py-10 h-full relative cursor-default">
                                <div className="absolute top-0 inset-x-0 w-full h-8 bg-slate-200 dark:bg-zinc-800 flex items-center px-4 rounded-t-xl gap-1.5 opacity-50 scale-90 -translate-y-4">
                                    <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
                                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
                                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
                                </div>
                                
                                <div className="w-[90%] max-w-[600px] bg-white dark:bg-black rounded-lg shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden relative mt-10">
                                    {/* Preview Fake Header */}
                                    <div className="h-12 border-b border-slate-100 dark:border-zinc-800 flex items-center px-4 bg-slate-50 dark:bg-zinc-900/50">
                                        <div className="w-24 h-4 bg-slate-200 dark:bg-zinc-800 rounded"></div>
                                        <div className="ml-auto flex gap-3">
                                            <div className="w-10 h-4 bg-slate-200 dark:bg-zinc-800 rounded"></div>
                                            <div className="w-10 h-4 bg-slate-200 dark:bg-zinc-800 rounded"></div>
                                        </div>
                                    </div>
                                    
                                    {/* System Banner Mock */}
                                    <AnimatePresence>
                                        {isActive && (
                                            <motion.div 
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <div className={`
                                                    px-4 py-2 text-center text-xs font-medium flex items-center justify-center gap-2
                                                    ${bannerType === 'maintenance' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-b border-blue-100 dark:border-blue-900/50' : ''}
                                                    ${bannerType === 'development' ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-b border-purple-100 dark:border-purple-900/50' : ''}
                                                    ${bannerType === 'testing' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-b border-amber-100 dark:border-amber-900/50' : ''}
                                                    ${bannerType === 'alert' ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-b border-red-100 dark:border-red-900/50' : ''}
                                                `}>
                                                    {bannerType === 'maintenance' && <span className="flex items-center gap-1.5"><AlertCircle size={12}/> System Maintenance in Progress</span>}
                                                    {bannerType === 'development' && <span className="flex items-center gap-1.5"><AlertCircle size={12}/> Under Development - Some features may be unstable</span>}
                                                    {bannerType === 'testing' && <span className="flex items-center gap-1.5"><AlertCircle size={12}/> Testing Environment - Data may be reset</span>}
                                                    {bannerType === 'alert' && <span className="flex items-center gap-1.5"><AlertCircle size={12}/> Critical System Alert</span>}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <div className="p-6 space-y-4">
                                        <div className="w-2/3 h-6 bg-slate-100 dark:bg-zinc-800/50 rounded-md"></div>
                                        <div className="w-full h-20 bg-slate-100 dark:bg-zinc-800/50 rounded-md"></div>
                                        <div className="w-1/2 h-20 bg-slate-100 dark:bg-zinc-800/50 rounded-md"></div>
                                    </div>
                                </div>
                                <div className="mt-8 text-center px-4">
                                    <p className="text-[12px] font-bold text-slate-700 dark:text-zinc-300">System Banner Preview</p>
                                    <p className="text-[10px] font-medium text-slate-500 dark:text-zinc-500 mt-1 max-w-[280px] mx-auto">This is a mock representation. The actual banner rendering will be handled natively by the client application on all pages.</p>
                                </div>
                        </div>
                    ) : generatedHtml ? (
                        <AutoScaledPreview html={generatedHtml} />
                    ) : (
                        <div className="flex flex-col items-center justify-center gap-3 opacity-40 grayscale pointer-events-none hover:grayscale-0 hover:opacity-70 transition-all duration-500 cursor-default">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center ring-1 ring-indigo-500/10">
                                <Megaphone size={28} className="text-indigo-600 dark:text-indigo-400 drop-shadow-sm -rotate-[15deg]" />
                            </div>
                            <div className="text-center">
                                <p className="text-[12px] font-bold text-slate-700 dark:text-zinc-300">Blank Canvas</p>
                                <p className="text-[10px] font-medium text-slate-500 dark:text-zinc-500 mt-1 max-w-[200px]">Provide a prompt above to generate your custom broadcast popup.</p>
                            </div>
                        </div>
                    )}
                </div>

            </div>
            
            {/* History Panel Overlay */}
            <AnimatePresence>
                {showHistory && (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="absolute inset-0 z-50 bg-white dark:bg-black flex flex-col"
                    >
                        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-zinc-900 bg-white dark:bg-black">
                            <div className="flex items-center gap-2">
                                <History size={16} className="text-indigo-500" />
                                <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">Broadcast History</h3>
                            </div>
                            <button 
                                onClick={() => setShowHistory(false)}
                                className="p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-zinc-900 dark:hover:text-zinc-300 rounded-lg transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto sleek-scrollbar bg-slate-50 dark:bg-black flex flex-col">
                            {isLoadingHistory ? (
                                <div className="flex flex-col items-center justify-center h-full opacity-80 min-h-[300px]">
                                    <div className="relative flex items-center justify-center mb-4">
                                        <motion.div 
                                            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0, 0.3] }}
                                            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                                            className="absolute inset-0 bg-indigo-500/20 rounded-full" 
                                        />
                                        <div className="w-12 h-12 rounded-full border-2 border-transparent border-t-indigo-500 border-r-purple-500 opacity-80 animate-spin" />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <History className="w-4 h-4 text-indigo-500 animate-pulse" />
                                        </div>
                                    </div>
                                    <p className="text-[12px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-500 uppercase tracking-widest">Loading History</p>
                                    <p className="text-[10px] font-medium text-slate-500 mt-1">Retrieving previous broadcasts...</p>
                                </div>
                            ) : broadcastList.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full opacity-40 min-h-[300px]">
                                    <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-zinc-900 flex items-center justify-center mb-3">
                                        <History className="w-8 h-8 text-slate-500" />
                                    </div>
                                    <span className="text-sm font-bold text-slate-600 dark:text-zinc-400">No History Yet</span>
                                    <span className="text-[11px] font-medium text-slate-500 max-w-[200px] text-center mt-1">Your sent broadcasts will appear here for you to reuse.</span>
                                </div>
                            ) : (
                                broadcastList.map((item, index) => (
                                    <div key={item.id} className={`group flex flex-col bg-white dark:bg-black ${index !== broadcastList.length - 1 ? 'border-b-[4px] border-slate-100 dark:border-zinc-900' : ''}`}>
                                        
                                        <div className="relative w-full flex items-center justify-center bg-slate-50 dark:bg-black py-16 px-4 overflow-hidden pattern-diagonal-lines pattern-slate-200 dark:pattern-zinc-900 pattern-size-4 pattern-opacity-40 min-h-[250px]">
                                             <div 
                                                className="pointer-events-none isolate w-full flex items-center justify-center transform scale-75 sm:scale-100"
                                             >
                                                {item.type === 'system_banner' ? (
                                                    <div className="w-[90%] max-w-[600px] bg-white dark:bg-black rounded-lg shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden relative">
                                                        <div className="h-12 border-b border-slate-100 dark:border-zinc-800 flex items-center px-4 bg-slate-50 dark:bg-zinc-900/50 gap-4">
                                                            <div className="w-24 h-4 bg-slate-200 dark:bg-zinc-800 rounded"></div>
                                                            <div className="ml-auto flex gap-3">
                                                                <div className="w-10 h-4 bg-slate-200 dark:bg-zinc-800 rounded"></div>
                                                            </div>
                                                        </div>
                                                        {item.is_active && (
                                                            <div className={`
                                                                px-4 py-2 text-center text-xs font-medium flex items-center justify-center gap-2
                                                                ${item.banner_type === 'maintenance' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-b border-blue-100 dark:border-blue-900/50' : ''}
                                                                ${item.banner_type === 'development' ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-b border-purple-100 dark:border-purple-900/50' : ''}
                                                                ${item.banner_type === 'testing' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-b border-amber-100 dark:border-amber-900/50' : ''}
                                                                ${item.banner_type === 'alert' ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-b border-red-100 dark:border-red-900/50' : ''}
                                                            `}>
                                                                {item.banner_type === 'maintenance' && <span className="flex items-center gap-1.5"><AlertCircle size={12}/> System Maintenance in Progress</span>}
                                                                {item.banner_type === 'development' && <span className="flex items-center gap-1.5"><AlertCircle size={12}/> Under Development</span>}
                                                                {item.banner_type === 'testing' && <span className="flex items-center gap-1.5"><AlertCircle size={12}/> Testing Environment</span>}
                                                                {item.banner_type === 'alert' && <span className="flex items-center gap-1.5"><AlertCircle size={12}/> Critical System Alert</span>}
                                                            </div>
                                                        )}
                                                        {!item.is_active && (
                                                           <div className="px-4 py-2 text-center text-xs font-medium flex items-center justify-center gap-2 bg-slate-50 text-slate-500 border-b border-slate-100 dark:bg-zinc-900/30 dark:text-zinc-400 dark:border-zinc-800">
                                                              <span className="flex items-center gap-1.5"><Eye size={12}/> System Banner is Hidden (Inactive)</span>
                                                           </div>
                                                        )}
                                                        <div className="p-6 space-y-4">
                                                            <div className="w-2/3 h-6 bg-slate-100 dark:bg-zinc-800/50 rounded-md"></div>
                                                            <div className="w-full h-20 bg-slate-100 dark:bg-zinc-800/50 rounded-md"></div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div style={{ zoom: 0.6 }}>
                                                        <div dangerouslySetInnerHTML={{ __html: item.raw_html }} />
                                                    </div>
                                                )}
                                             </div>
                                        </div>
                                        
                                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-white dark:bg-black border-t border-slate-100 dark:border-zinc-900">
                                            <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto">
                                                <h4 className="text-[13px] font-bold text-slate-800 dark:text-zinc-100 truncate max-w-[200px] sm:max-w-xs">{item.title && !item.title.startsWith('Broadcast ') ? item.title : "Broadcast"}</h4>
                                                {item.type === 'system_banner' ? (
                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 shrink-0">Banner</span>
                                                ) : (
                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-400 shrink-0">Popup</span>
                                                )}
                                                <div className="flex items-center gap-1.5 ml-2">
                                                    <Clock size={11} className="text-slate-400 dark:text-zinc-500 shrink-0" />
                                                    <p className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 truncate">
                                                        {new Date(item.sent_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 self-end sm:self-auto w-full sm:w-auto">
                                                <button 
                                                    onClick={() => handleDeleteBroadcast(item.id)}
                                                    className="px-3 py-2 flex items-center justify-center flex-1 sm:flex-none sm:w-auto bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-500/10 dark:hover:bg-red-500/20 dark:text-red-400 rounded-lg transition-all shrink-0 border border-red-200 dark:border-red-500/30"
                                                    title="Delete Broadcast"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        setGeneratedHtml(item.raw_html);
                                                        setPrompt(item.title && !item.title.startsWith('Broadcast ') ? `Iterating on: ${item.title}` : 'Iterating on previous broadcast...');
                                                        setStylePrompt('');
                                                        setHistory([]);
                                                        setShowHistory(false);
                                                        if (item.type === 'system_banner') {
                                                            setBroadcastType('system_banner');
                                                            setBannerType(item.banner_type as any);
                                                            setIsActive(item.is_active);
                                                        } else {
                                                            setBroadcastType('popup');
                                                        }
                                                    }}
                                                    className="px-4 py-2 flex items-center justify-center gap-1.5 flex-[4] sm:flex-none sm:w-auto bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 dark:text-indigo-400 rounded-lg text-[12px] font-bold transition-all shrink-0 border border-indigo-200 dark:border-indigo-500/30"
                                                >
                                                    <RefreshCw size={14} />
                                                    Reuse Design
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <ConfirmationModal
                isOpen={deleteConfirmId !== null}
                onClose={() => setDeleteConfirmId(null)}
                onConfirm={confirmDeleteBroadcast}
                title="Delete Broadcast"
                message={<>Are you sure you want to delete this broadcast? This action cannot be undone.</>}
                confirmText="Delete Broadcast"
                confirmButtonClass="btn-danger"
            />
        </div>
    );
};

