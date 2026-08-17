import React, { useState, useEffect } from 'react';
import { FileText, Download, Maximize2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

export interface FullScreenPreviewProps {
    isOpen: boolean;
    onClose: () => void;
    url: string | null;
    name?: string;
    isImage?: boolean;
    sizeFormatted?: string;
}

export const FullScreenAttachmentPreview: React.FC<FullScreenPreviewProps> = ({
    isOpen,
    onClose,
    url,
    name,
    isImage = true,
    sizeFormatted
}) => {
    // Handle Escape key to close
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen || !url) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={onClose}
                className="fixed inset-0 z-[9999] bg-black/90 sm:bg-black/95 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 select-none overflow-hidden"
            >
                {/* Top Left Title info pill with shadow */}
                {name && (
                    <div 
                        onClick={(e) => e.stopPropagation()}
                        className="absolute top-4 left-4 sm:top-6 sm:left-6 z-50 max-w-[55vw] sm:max-w-[40vw] flex items-center gap-2 px-3.5 py-2 bg-zinc-900/90 rounded-full border border-white/15 shadow-[0_8px_30px_rgb(0,0,0,0.5)] backdrop-blur-md text-white text-xs sm:text-sm font-medium truncate pointer-events-none"
                    >
                        <span className="truncate">{name}</span>
                        {sizeFormatted && (
                            <span className="text-[11px] text-zinc-400 font-normal shrink-0">({sizeFormatted})</span>
                        )}
                    </div>
                )}

                {/* Top Right Floating Action Controls with Shadow */}
                <div 
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-4 right-4 sm:top-6 sm:right-6 z-50 flex items-center gap-2.5"
                >
                    <a
                        href={url}
                        download={name || 'attachment'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3.5 py-2 bg-zinc-900/90 hover:bg-zinc-800 text-white rounded-full border border-white/15 shadow-[0_8px_30px_rgb(0,0,0,0.5)] backdrop-blur-md transition-all hover:scale-105 active:scale-95 text-xs font-medium cursor-pointer"
                        title="Download file"
                    >
                        <Download className="w-4 h-4" />
                        <span className="hidden sm:inline">Download</span>
                    </a>
                    <button
                        onClick={onClose}
                        className="p-2 sm:p-2.5 bg-zinc-900/90 hover:bg-zinc-800 text-white rounded-full border border-white/15 shadow-[0_8px_30px_rgb(0,0,0,0.5)] backdrop-blur-md transition-all hover:scale-105 active:scale-95 cursor-pointer"
                        title="Close preview (Esc)"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Center Content */}
                {isImage ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.92 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        onClick={(e) => e.stopPropagation()}
                        className="max-w-[95vw] max-h-[85vh] sm:max-w-[90vw] sm:max-h-[90vh] flex items-center justify-center p-2"
                    >
                        <img
                            src={url}
                            alt={name || 'Attachment Preview'}
                            className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] border border-white/10"
                        />
                    </motion.div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.92 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        onClick={(e) => e.stopPropagation()}
                        className="p-6 sm:p-8 bg-zinc-900/95 border border-zinc-800 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col items-center gap-4 text-center max-w-sm w-full backdrop-blur-md"
                    >
                        <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shadow-inner">
                            <FileText className="w-8 h-8" />
                        </div>
                        <div className="space-y-1 w-full">
                            <h4 className="text-sm font-semibold text-white truncate px-2">{name || 'Document'}</h4>
                            {sizeFormatted && <p className="text-xs text-zinc-400">{sizeFormatted}</p>}
                        </div>
                        <a
                            href={url}
                            download={name || 'attachment'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-xs shadow-lg transition-all flex items-center justify-center gap-2"
                        >
                            <Download className="w-4 h-4" />
                            <span>Download Document</span>
                        </a>
                    </motion.div>
                )}
            </motion.div>
        </AnimatePresence>
    );
};

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

    if (isImage) {
        const containerClasses = isAdmin 
            ? "inline-flex items-center gap-2 p-1.5 pr-2.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg cursor-pointer transition-all w-full overflow-hidden group shadow-sm hover:shadow" 
            : "inline-flex items-center gap-2 p-1.5 pr-2.5 bg-zinc-100/80 dark:bg-zinc-800/80 hover:bg-zinc-200/80 dark:hover:bg-zinc-700/80 border border-zinc-200 dark:border-zinc-700/80 rounded-lg cursor-pointer transition-all w-full overflow-hidden group shadow-sm hover:shadow";

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
                <FullScreenAttachmentPreview
                    isOpen={isPreviewOpen}
                    onClose={() => setIsPreviewOpen(false)}
                    url={realUrl}
                    name={name || 'Image'}
                    isImage={true}
                />
            </>
        );
    }

    return (
        <a 
            href={realUrl} 
            target="_blank" 
            rel="noopener noreferrer" 
            className={(linkClassName || "inline-flex items-center") + " !px-2.5 !py-1.5 !gap-1.5 !text-[11px] !rounded-md w-full justify-between"}
        >
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{name || 'Download'}</span>
            </div>
            <Download className="w-3 h-3 opacity-70 shrink-0 ml-1" />
        </a>
    );
};
