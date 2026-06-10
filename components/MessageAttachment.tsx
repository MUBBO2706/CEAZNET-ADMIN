import React, { useState, useEffect } from 'react';
import { RefreshCw, FileText, Download, Maximize2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

interface MessageAttachmentProps {
    url: string;
    name?: string;
    isImage: boolean;
    imageClassName?: string;
    linkClassName?: string;
    isAdmin?: boolean;
}

export const MessageAttachment: React.FC<MessageAttachmentProps> = ({ 
    url, 
    name, 
    isImage, 
    imageClassName, 
    linkClassName,
    isAdmin
}) => {
    const [realUrl, setRealUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    useEffect(() => {
        let isMounted = true;
        
        async function resolveImage() {
            if (!url) return;
            if (!url.startsWith('tg://')) {
                setRealUrl(url);
                return;
            }

            const fileId = url.replace('tg://', '').split('?')[0];
            const botToken = import.meta.env.VITE_TELEGRAM_BOT_TOKEN || (import.meta.env.DEV ? "8651559829:AAE8dajbB7yB9Nc8WYxV-b4lBp8z0CBTLC8" : "");
            
            if (!botToken) {
                console.error("VITE_TELEGRAM_BOT_TOKEN is missing in environment variables");
                if (isMounted) setError(true);
                return;
            }

            setIsLoading(true);
            try {
                const res = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
                if (!res.ok) throw new Error("Failed to fetch");
                
                const data = await res.json();
                
                if (data.ok && isMounted) {
                    setRealUrl(`https://api.telegram.org/file/bot${botToken}/${data.result.file_path}`);
                } else if (isMounted) {
                    setError(true);
                }
            } catch (err) {
                console.error("Error resolving telegram attachment", err);
                if (isMounted) setError(true);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        }
        
        resolveImage();
        
        return () => { isMounted = false; };
    }, [url]);

    if (isLoading) {
        if (!isImage) {
            return (
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md animate-pulse ${isAdmin ? 'bg-white/10' : 'bg-zinc-100 dark:bg-zinc-700/80'}`}>
                    <div className="w-3.5 h-3.5 bg-zinc-200 dark:bg-zinc-600 rounded shrink-0"></div>
                    <div className="h-2.5 w-[60px] bg-zinc-200 dark:bg-zinc-600 rounded"></div>
                    <div className="w-3 h-3 bg-zinc-200 dark:bg-zinc-600 rounded shrink-0 ml-0.5"></div>
                </div>
            );
        }

        return (
            <div className={`inline-flex items-center gap-2 p-1.5 pr-3 bg-zinc-100/50 dark:bg-zinc-800/50 rounded-lg animate-pulse ${isAdmin ? 'bg-white/10 border border-white/10' : 'border border-zinc-200 dark:border-zinc-700/80'}`}>
                <div className="w-8 h-8 bg-zinc-200 dark:bg-zinc-700/50 rounded shrink-0"></div>
                <div className="flex flex-col gap-1 w-[100px] py-0.5">
                    <div className="h-2.5 bg-zinc-200 dark:bg-zinc-700/50 rounded w-full"></div>
                    <div className="h-2 bg-zinc-200 dark:bg-zinc-700/50 rounded w-2/3"></div>
                </div>
            </div>
        );
    }

    if (error || !realUrl) {
        return (
            <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-500/10 text-red-500 rounded-lg text-xs font-medium">
                <span>Failed to load attachment.</span>
            </div>
        );
    }

    const renderPreviewModal = () => (
        <AnimatePresence>
            {isPreviewOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/90 backdrop-blur-sm"
                     onClick={() => setIsPreviewOpen(false)}>
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        className="relative max-w-5xl w-full max-h-[90vh] bg-zinc-950 rounded-2xl overflow-hidden flex flex-col border border-zinc-800/60"
                    >
                        <div className="p-3 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/80 backdrop-blur-md absolute top-0 left-0 right-0 z-10 w-full">
                            <h3 className="text-zinc-200 font-medium text-sm truncate pr-4">{name || 'Image Preview'}</h3>
                            <div className="flex items-center gap-1.5">
                                <a 
                                    href={realUrl!} 
                                    download={name || 'attachment'} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-md transition-colors flex items-center gap-1.5 text-xs font-medium"
                                >
                                    <Download className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Download</span>
                                </a>
                                <button 
                                    onClick={() => setIsPreviewOpen(false)}
                                    className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto flex items-center justify-center p-4 pt-16 pb-4">
                            <img src={realUrl!} alt={name || 'Attachment'} className="max-w-full max-h-[80vh] object-contain rounded drop-shadow-md" />
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );

    if (isImage) {
        const containerClasses = isAdmin 
            ? "inline-flex items-center gap-2 p-1.5 pr-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg cursor-pointer transition-all max-w-[200px] sm:max-w-[240px] overflow-hidden group shadow-sm hover:shadow" 
            : "inline-flex items-center gap-2 p-1.5 pr-3 bg-zinc-100/80 dark:bg-zinc-800/80 hover:bg-zinc-200/80 dark:hover:bg-zinc-700/80 border border-zinc-200 dark:border-zinc-700/80 rounded-lg cursor-pointer transition-all max-w-[200px] sm:max-w-[240px] overflow-hidden group shadow-sm hover:shadow";

        const textMainClasses = isAdmin 
            ? "text-[11px] sm:text-xs font-semibold text-white truncate" 
            : "text-[11px] sm:text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate";

        const textSubClasses = isAdmin 
            ? "text-[9px] text-white/70 mt-0.5 leading-none" 
            : "text-[9px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-none";

        return (
            <>
                <div 
                    onClick={() => setIsPreviewOpen(true)}
                    className={containerClasses}
                >
                    <div className="w-8 h-8 rounded bg-zinc-200 dark:bg-zinc-900 shrink-0 relative flex items-center justify-center overflow-hidden">
                        <img src={realUrl} alt={name || 'Attachment'} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                            <Maximize2 className="w-3.5 h-3.5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" />
                        </div>
                    </div>
                    <div className="flex flex-col overflow-hidden min-w-0 py-0.5">
                        <span className={textMainClasses}>{name || 'Image'}</span>
                        <span className={textSubClasses}>CLICK TO VIEW</span>
                    </div>
                </div>
                {renderPreviewModal()}
            </>
        );
    }

    return (
        <a 
            href={realUrl} 
            target="_blank" 
            rel="noopener noreferrer" 
            className={(linkClassName || "inline-flex items-center") + " !px-2.5 !py-1.5 !gap-1.5 !text-[11px] !rounded-md"}
        >
            <FileText className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate max-w-[140px]">{name || 'Download'}</span>
            <Download className="w-3 h-3 opacity-70 shrink-0 ml-0.5" />
        </a>
    );
};
