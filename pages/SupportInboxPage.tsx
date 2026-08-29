import React, { useState, useEffect, useRef, useCallback } from 'react';
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
    deleteConversation,
    SupportConversation,
    SupportMessage
} from '../services/supportInboxService';
import { uploadSupportAttachment, UploadedAttachment } from '../services/attachmentUploadService';
import { Mail, ArrowUp, MessageSquare, CheckCircle, Clock, Send, Archive, Loader, RotateCw, AlertCircle, X, Search, ChevronLeft, User, Check, CheckCheck, Paperclip, Bold, Italic, Underline, Strikethrough, Heading1, Heading2, List, ListOrdered, Quote, Code, Link2, RemoveFormatting, ImageIcon, FileText, Download, Reply, Forward, Braces, MoreHorizontal, MoreVertical, Sparkles, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { MessageAttachment, FullScreenAttachmentPreview } from '../components/MessageAttachment';
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

const CustomAiSparkleIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className || "w-5 h-5"} xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C12 7.52 16.48 12 22 12C16.48 12 12 16.48 12 22C12 16.48 7.52 12 2 12C7.52 12 12 7.52 12 2Z" fill="#3b82f6" />
    </svg>
);

// Clean plain-text preview helper for sidebar and preview lists
const stripHtmlAndMarkdown = (text: string): string => {
    if (!text) return '';
    return text
        .replace(/<br\s*[\/]?>/gi, ' ')
        .replace(/<\/(p|div|li|h[1-6])>/gi, ' ')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/[*_~`#]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
};

// Formatter for rich message bodies containing HTML and markdown
const formatMessageBody = (text: string): string => {
    if (!text) return '';
    
    let formatted = text;

    // 1. Decode standard HTML entities
    formatted = formatted
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'");

    // 2. Convert <div> tags to newlines, <p> tags to double newlines
    formatted = formatted
        .replace(/<div[^>]*>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<p[^>]*>/gi, '\n\n')
        .replace(/<\/p>/gi, '\n\n');

    // 3. Pre-process list items written with HTML breaks: e.g. <br>*   Could you confirm...<br>
    formatted = formatted.replace(/(?:<br\s*[\/]?>\s*)+([*+-]|\d+\.)\s+/gi, '\n$1 ');

    // 4. Convert multiple <br><br> to double newlines (paragraphs)
    formatted = formatted.replace(/(?:<br\s*[\/]?>\s*){2,}/gi, '\n\n');

    // 5. Convert single <br> to single newline
    formatted = formatted.replace(/<br\s*[\/]?>/gi, '\n');

    // 6. Clean up list item indentation so "*   text" becomes "* text"
    formatted = formatted.replace(/^([ \t]*[*+-]|\d+\.)[ \t]{2,}/gm, '$1 ');

    // 7. Ensure clean blank line before list blocks and headings for standard CommonMark parsing
    formatted = formatted.replace(/([^\n])\n([*+-]|\d+\.) /g, '$1\n\n$2 ');
    formatted = formatted.replace(/([^\n])\n(#{1,6}\s+)/g, '$1\n\n$2');

    // 8. Remove any trailing <br> or messy tags from list lines
    formatted = formatted.replace(/([*+-]|\d+\..*?)<br\s*[\/]?>/gi, '$1');

    // 9. Normalize excessive newlines
    formatted = formatted.replace(/\n{3,}/g, '\n\n');

    return formatted.trim();
};

interface PendingAttachmentData {
    id: string;
    file: File;
    previewUrl: string;
    isImage: boolean;
    name: string;
    size: number;
    uploading: boolean;
    uploadedData?: UploadedAttachment;
    error?: string;
}

const PendingAttachmentsList: React.FC<{
    attachments: PendingAttachmentData[];
    onRemove: (id: string) => void;
    formatSize: (bytes: number) => string;
    onPreview?: (attachment: PendingAttachmentData) => void;
}> = ({ attachments, onRemove, formatSize, onPreview }) => {
    if (!attachments || attachments.length === 0) return null;

    return (
        <div className="flex items-center gap-1.5 py-1 overflow-x-auto max-w-full pb-1.5 -mb-0.5 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <AnimatePresence>
                {attachments.map((attachment) => {
                    if (attachment.uploading) {
                        return (
                            <motion.div
                                key={attachment.id}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="inline-flex items-center gap-2 px-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700/60 rounded-xl shadow-xs shrink-0 whitespace-nowrap"
                            >
                                <Loader size={13} className="animate-spin text-indigo-500 shrink-0" />
                                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Uploading...</span>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onRemove(attachment.id);
                                    }}
                                    className="w-4 h-4 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors ml-0.5 shrink-0"
                                    title="Cancel upload"
                                >
                                    <X size={11} />
                                </button>
                            </motion.div>
                        );
                    }

                    if (attachment.error) {
                        return (
                            <motion.div
                                key={attachment.id}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="inline-flex items-center gap-2 px-2.5 py-1.5 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 rounded-xl shadow-xs shrink-0 text-xs whitespace-nowrap"
                            >
                                <AlertCircle size={13} className="shrink-0" />
                                <span className="font-medium truncate max-w-[120px]">{attachment.name} (Failed)</span>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onRemove(attachment.id);
                                    }}
                                    className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-red-200/50 transition-colors ml-0.5 shrink-0"
                                    title="Remove"
                                >
                                    <X size={11} />
                                </button>
                            </motion.div>
                        );
                    }

                    return (
                        <motion.div
                            key={attachment.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            onClick={() => onPreview && onPreview(attachment)}
                            className="inline-flex items-center gap-2 px-2.5 py-1.5 bg-zinc-100/90 hover:bg-zinc-200/80 dark:bg-zinc-800/90 dark:hover:bg-zinc-700/80 border border-zinc-200 dark:border-zinc-700/60 rounded-xl shadow-xs shrink-0 whitespace-nowrap max-w-[260px] sm:max-w-[300px] cursor-pointer transition-colors group"
                            title="Click to preview attachment"
                        >
                            {attachment.isImage ? (
                                <div className="w-7 h-7 rounded-lg overflow-hidden bg-zinc-200 dark:bg-zinc-900 shrink-0 border border-zinc-200 dark:border-zinc-700/60 flex items-center justify-center relative">
                                    <img src={attachment.previewUrl} alt={attachment.name} className="w-full h-full object-cover" />
                                </div>
                            ) : (
                                <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-500/20">
                                    <FileText className="w-4 h-4" />
                                </div>
                            )}
                            <div className="min-w-0 flex items-center gap-1.5">
                                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-[110px] sm:max-w-[150px] group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                    {attachment.name}
                                </span>
                                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium shrink-0">
                                    {formatSize(attachment.size)}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRemove(attachment.id);
                                }}
                                className="w-4 h-4 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors ml-0.5 shrink-0"
                                title="Remove attachment"
                            >
                                <X size={11} />
                            </button>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
};

function parseInlineMarkdown(text: string): string {
    if (!text) return '';
    return text
        .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
        .replace(/\*([^*]+)\*/g, '<i>$1</i>')
        .replace(/_([^_]+)_/g, '<i>$1</i>')
        .replace(/~~([^~]+)~~/g, '<s>$1</s>')
        .replace(/~([^~]+)~/g, '<s>$1</s>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

function markdownToHtml(md: string): string {
    if (!md) return '';

    let text = md.replace(/\r\n/g, '\n');

    // Protect code blocks first
    const codeBlocks: string[] = [];
    text = text.replace(/```([\s\S]*?)```/g, (_, code) => {
        const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
        codeBlocks.push(`<pre><code>${code.trim()}</code></pre>`);
        return placeholder;
    });

    // Protect inline code
    const inlineCodes: string[] = [];
    text = text.replace(/`([^`\n]+)`/g, (_, code) => {
        const placeholder = `__INLINE_CODE_${inlineCodes.length}__`;
        inlineCodes.push(`<code>${code}</code>`);
        return placeholder;
    });

    const lines = text.split('\n');
    const output: string[] = [];
    let inList: 'ul' | 'ol' | null = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Unordered list (* or - or +)
        const ulMatch = line.match(/^(\s*)[*+-]\s+(.*)$/);
        if (ulMatch) {
            if (inList !== 'ul') {
                if (inList === 'ol') output.push('</ol>');
                output.push('<ul>');
                inList = 'ul';
            }
            output.push(`<li>${parseInlineMarkdown(ulMatch[2])}</li>`);
            continue;
        }

        // Ordered list (1. item)
        const olMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);
        if (olMatch) {
            if (inList !== 'ol') {
                if (inList === 'ul') output.push('</ul>');
                output.push('<ol>');
                inList = 'ol';
            }
            output.push(`<li>${parseInlineMarkdown(olMatch[2])}</li>`);
            continue;
        }

        // Close list if line is not a list item
        if (inList) {
            output.push(inList === 'ul' ? '</ul>' : '</ol>');
            inList = null;
        }

        // Headings
        if (/^###\s+(.*)$/.test(line)) {
            output.push(`<h3>${parseInlineMarkdown(line.replace(/^###\s+/, ''))}</h3>`);
        } else if (/^##\s+(.*)$/.test(line)) {
            output.push(`<h2>${parseInlineMarkdown(line.replace(/^##\s+/, ''))}</h2>`);
        } else if (/^#\s+(.*)$/.test(line)) {
            output.push(`<h1>${parseInlineMarkdown(line.replace(/^#\s+/, ''))}</h1>`);
        } else if (/^>\s+(.*)$/.test(line)) {
            output.push(`<blockquote>${parseInlineMarkdown(line.replace(/^>\s+/, ''))}</blockquote>`);
        } else if (line.trim() === '') {
            output.push('<p><br/></p>');
        } else {
            output.push(`<p>${parseInlineMarkdown(line)}</p>`);
        }
    }

    if (inList) {
        output.push(inList === 'ul' ? '</ul>' : '</ol>');
    }

    let result = output.join('');

    // Restore inline codes
    inlineCodes.forEach((code, idx) => {
        result = result.replace(`__INLINE_CODE_${idx}__`, code);
    });

    // Restore code blocks
    codeBlocks.forEach((code, idx) => {
        result = result.replace(`__CODE_BLOCK_${idx}__`, code);
    });

    return result;
}

function htmlToMarkdown(html: string): string {
    if (!html) return '';
    if (!/<[a-z][\s\S]*>/i.test(html)) return html.trim();

    let text = html;
    text = text.replace(/<div><br><\/div>/gi, '\n');
    text = text.replace(/<div>/gi, '\n');
    text = text.replace(/<\/div>/gi, '');
    text = text.replace(/<p><br\s*[\/]?>\s*<\/p>/gi, '\n\n');
    text = text.replace(/<p><\/p>/gi, '\n\n');
    text = text.replace(/<p>/gi, '');
    text = text.replace(/<\/p>/gi, '\n\n');
    text = text.replace(/<b>(.*?)<\/b>/gi, '**$1**');
    text = text.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
    text = text.replace(/<i>(.*?)<\/i>/gi, '*$1*');
    text = text.replace(/<em>(.*?)<\/em>/gi, '*$1*');
    text = text.replace(/<u>(.*?)<\/u>/gi, '_$1_');
    text = text.replace(/<s>(.*?)<\/s>/gi, '~$1~');
    text = text.replace(/<strike>(.*?)<\/strike>/gi, '~$1~');
    text = text.replace(/<h1>(.*?)<\/h1>/gi, '# $1\n\n');
    text = text.replace(/<h2>(.*?)<\/h2>/gi, '## $1\n\n');
    text = text.replace(/<h3>(.*?)<\/h3>/gi, '### $1\n\n');
    text = text.replace(/<blockquote>(.*?)<\/blockquote>/gi, '> $1\n\n');
    text = text.replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/gi, '```\n$1\n```\n\n');
    text = text.replace(/<pre>([\s\S]*?)<\/pre>/gi, '```\n$1\n```\n\n');
    text = text.replace(/<code>(.*?)<\/code>/gi, '`$1`');
    text = text.replace(/<ul>([\s\S]*?)<\/ul>/gi, '$1\n');
    text = text.replace(/<ol>([\s\S]*?)<\/ol>/gi, '$1\n');
    text = text.replace(/<li>(.*?)<\/li>/gi, '* $1\n');
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<a [^>]*href="(.*?)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&amp;/g, '&');
    return text.replace(/\n{3,}/g, '\n\n').trim();
}

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

interface ParsedAttachment {
    url: string;
    name: string;
    type: string;
    isImage: boolean;
}

function parseSupportAttachments(rawUrl?: string | null, rawName?: string | null, rawType?: string | null): ParsedAttachment[] {
    if (!rawUrl || !rawUrl.trim()) return [];

    let urls: string[] = [];
    if (rawUrl.trim().startsWith('[') && rawUrl.trim().endsWith(']')) {
        try {
            urls = JSON.parse(rawUrl);
        } catch {
            urls = rawUrl.split(',').map(s => s.trim());
        }
    } else {
        urls = rawUrl.split(',').map(s => s.trim());
    }

    let names: string[] = [];
    if (rawName && rawName.trim()) {
        if (rawName.trim().startsWith('[') && rawName.trim().endsWith(']')) {
            try {
                names = JSON.parse(rawName);
            } catch {
                names = rawName.split(',').map(s => s.trim());
            }
        } else {
            names = rawName.split(',').map(s => s.trim());
        }
    }

    let types: string[] = [];
    if (rawType && rawType.trim()) {
        if (rawType.trim().startsWith('[') && rawType.trim().endsWith(']')) {
            try {
                types = JSON.parse(rawType);
            } catch {
                types = rawType.split(',').map(s => s.trim());
            }
        } else {
            types = rawType.split(',').map(s => s.trim());
        }
    }

    return urls.filter(Boolean).map((u, idx) => {
        const itemType = types[idx] || (types.length === 1 ? types[0] : '') || '';
        const itemName = names[idx] || (names.length === 1 && urls.length === 1 ? names[0] : '') || (u.startsWith('tg://') ? `attachment_${idx + 1}` : u.split('/').pop() || `file_${idx + 1}`);
        const isImg = itemType.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(itemName) || /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(u);
        return {
            url: u,
            name: itemName,
            type: itemType,
            isImage: isImg
        };
    });
}

const MessageItem = React.memo(({ 
    msg, 
    userProfiles, 
    activeConv, 
    settings 
}: { 
    msg: SupportMessage; 
    userProfiles: Record<string, UserProfile>; 
    activeConv: SupportConversation | undefined; 
    settings: any; 
}) => {
    const isAdmin = msg.sender_type === 'admin';
    const isMail = activeConv?.type === 'mail';
    const attachmentsList = parseSupportAttachments(msg.attachment_url, msg.attachment_name, msg.attachment_type);

    if (isMail) {
        return (
            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`w-full pb-4 mb-4 border-b border-zinc-100 dark:border-zinc-800/60 last:border-0 last:mb-0 last:pb-0 ${isAdmin ? 'pl-4 border-l-2 border-l-indigo-500' : 'pl-4 border-l-2 border-l-zinc-200 dark:border-l-zinc-700'}`}
            >
                <div className="flex items-start gap-3 p-0 mb-2">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden ${isAdmin ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400' : 'bg-zinc-200 text-zinc-600 dark:bg-black dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800'}`}>
                        {!isAdmin && userProfiles[msg.sender_id]?.avatar_url ? (
                            <img src={userProfiles[msg.sender_id].avatar_url} alt="User Avatar" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                        ) : isAdmin ? (
                            <img src={settings?.platform_logo_url} alt="Support Team" referrerPolicy="no-referrer" className="w-full h-full object-contain p-1" />
                        ) : (
                            <User className="w-5 h-5" />
                        )}
                    </div>
                    <div className="flex flex-col flex-1 justify-center">
                        <div className="flex justify-between items-start">
                            <div className="flex flex-col">
                                <div className="flex items-baseline gap-2 flex-wrap">
                                    <span className="text-[13px] font-bold text-zinc-900 dark:text-zinc-100">
                                        {isAdmin ? 'Ceaznet Support' : (userProfiles[msg.sender_id]?.full_name || 'User')}
                                    </span>
                                    <span className="text-[10px] font-medium text-zinc-400">
                                        - {new Date(msg.created_at).toLocaleDateString()} {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <span className="text-[11px] font-medium text-zinc-500 mt-0.5 flex items-center gap-1.5">
                                    <span className="text-[9px] uppercase tracking-wider text-zinc-400 font-bold">{isAdmin ? 'To:' : 'From:'}</span>
                                    <span>{"<"}{isAdmin ? (userProfiles[activeConv?.user_id || '']?.email || 'user@clientapp.com') : (userProfiles[msg.sender_id]?.email || 'user@clientapp.com')}{">"}</span>
                                </span>
                            </div>
                            <button className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-md transition-colors" title="More options (coming soon)">
                                <MoreVertical className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
                <div className="mt-3 text-[13px] sm:text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed markdown-body [&_p]:whitespace-pre-wrap [&_blockquote]:whitespace-pre-wrap [&_pre]:whitespace-pre-wrap [&_li_p]:inline [&_li_p]:m-0 [&_li]:leading-normal">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                        {formatMessageBody(msg.message)}
                    </ReactMarkdown>
                </div>
                {attachmentsList.length > 0 && (
                    <div className={`mt-3 ${attachmentsList.length > 1 ? 'grid grid-cols-2 gap-2 max-w-lg w-full' : 'flex flex-col gap-2 w-full max-w-xs'}`}>
                        {attachmentsList.map((att, idx) => (
                            <MessageAttachment 
                                key={idx}
                                url={att.url} 
                                name={att.name} 
                                isImage={att.isImage} 
                                imageClassName="max-w-xs max-h-64 object-contain"
                                linkClassName="inline-flex items-center gap-2 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-xs font-medium text-zinc-700 dark:text-zinc-300 transition-colors border border-zinc-200 dark:border-zinc-700"
                                isAdmin={false}
                            />
                        ))}
                    </div>
                )}
            </motion.div>
        );
    }
    
    return (
        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex gap-2 ${isAdmin ? 'justify-end' : 'justify-start'}`}
        >
            <div className={`flex flex-col max-w-[85%] sm:max-w-[75%] ${isAdmin ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-2 mb-1 px-1">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                        <span>{isAdmin ? 'To:' : 'From:'}</span>
                        <span className="text-zinc-500 dark:text-zinc-400">{userProfiles[activeConv?.user_id || '']?.full_name || 'User'}</span>
                    </span>
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
                    <div className="break-words markdown-body [&_p]:whitespace-pre-wrap [&_blockquote]:whitespace-pre-wrap [&_pre]:whitespace-pre-wrap [&_li_p]:inline [&_li_p]:m-0 [&_li]:leading-normal">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                            {formatMessageBody(msg.message)}
                        </ReactMarkdown>
                    </div>
                    {attachmentsList.length > 0 && (
                        <div className={`mt-2 pt-2 border-t border-white/20 dark:border-zinc-700 w-full ${attachmentsList.length > 1 ? 'grid grid-cols-2 gap-1.5 min-w-[240px] sm:min-w-[280px]' : 'flex flex-col gap-1.5 w-full max-w-[200px] sm:max-w-[250px]'}`}>
                            {attachmentsList.map((att, idx) => (
                                <MessageAttachment 
                                    key={idx}
                                    url={att.url} 
                                    name={att.name} 
                                    isImage={att.isImage} 
                                    imageClassName="max-w-[200px] sm:max-w-[250px] rounded-lg max-h-48 object-cover"
                                    linkClassName={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium ${isAdmin ? 'bg-white/10 hover:bg-white/20' : 'bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600'}`}
                                    isAdmin={isAdmin}
                                />
                            ))}
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
}, (prevProps, nextProps) => {
    return (
        prevProps.msg.id === nextProps.msg.id &&
        prevProps.msg.is_read === nextProps.msg.is_read &&
        prevProps.msg.read_at === nextProps.msg.read_at &&
        prevProps.msg.message === nextProps.msg.message &&
        prevProps.activeConv?.id === nextProps.activeConv?.id &&
        prevProps.settings?.platform_logo_url === nextProps.settings?.platform_logo_url &&
        JSON.stringify(prevProps.userProfiles[prevProps.msg.sender_id]) === JSON.stringify(nextProps.userProfiles[nextProps.msg.sender_id])
    );
});

const FastTextarea = React.memo(({ 
    value, 
    onChange, 
    onKeyDown, 
    placeholder, 
    className, 
    style, 
    textareaRef 
}: {
    value: string;
    onChange: (val: string) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
    placeholder: string;
    className: string;
    style?: React.CSSProperties;
    textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}) => {
    const [localVal, setLocalVal] = useState(value);
    
    useEffect(() => {
        setLocalVal(value);
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setLocalVal(val);
        onChange(val);
    };

    const linesCount = localVal.split('\n').length;
    const computedRows = Math.min(5, Math.max(1, linesCount));

    return (
        <textarea
            ref={textareaRef}
            value={localVal}
            onChange={handleChange}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className={className}
            rows={computedRows}
            style={style}
        />
    );
});

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
    const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const setReplyTextDebounced = useCallback((val: string) => {
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }
        debounceTimeoutRef.current = setTimeout(() => {
            setReplyText(val);
        }, 150);
    }, []);
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
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeletingConv, setIsDeletingConv] = useState(false);

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
    const mailTextareaRef = useRef<HTMLTextAreaElement>(null);
    const richEditorRef = useRef<HTMLDivElement>(null);
    const mailFileInputRef = useRef<HTMLInputElement>(null);
    const mailImageInputRef = useRef<HTMLInputElement>(null);

    const [pendingAttachments, setPendingAttachments] = useState<PendingAttachmentData[]>([]);
    const [previewAttachment, setPreviewAttachment] = useState<PendingAttachmentData | null>(null);
    const [isAttachmentExpanded, setIsAttachmentExpanded] = useState(false);
    const attachmentClickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleAttachmentClick = (type: 'file' | 'image') => {
        if (!isAttachmentExpanded) {
            setIsAttachmentExpanded(true);
            return;
        }

        if (attachmentClickTimeoutRef.current) {
            clearTimeout(attachmentClickTimeoutRef.current);
            attachmentClickTimeoutRef.current = null;
            setIsAttachmentExpanded(false);
        } else {
            attachmentClickTimeoutRef.current = setTimeout(() => {
                attachmentClickTimeoutRef.current = null;
                if (type === 'file') {
                    mailFileInputRef.current?.click();
                } else {
                    mailImageInputRef.current?.click();
                }
            }, 250);
        }
    };

    const handleAttachmentDoubleClick = () => {
        if (attachmentClickTimeoutRef.current) {
            clearTimeout(attachmentClickTimeoutRef.current);
            attachmentClickTimeoutRef.current = null;
        }
        setIsAttachmentExpanded(false);
    };

    const formatAttachmentSize = (bytes: number): string => {
        if (!bytes || bytes <= 0) return '0 B';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const handleMultipleAttachmentSelect = (files: File[]) => {
        if (!files || files.length === 0) return;

        const newItems: PendingAttachmentData[] = files.map(file => ({
            id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            file,
            previewUrl: URL.createObjectURL(file),
            isImage: file.type.startsWith('image/'),
            name: file.name,
            size: file.size,
            uploading: true
        }));

        setPendingAttachments(prev => [...prev, ...newItems]);

        // Brief visual uploading feedback (~450ms) on selection; real Telegram upload happens when message is sent
        setTimeout(() => {
            setPendingAttachments(prev => prev.map(p => {
                const isMatch = newItems.some(n => n.id === p.id);
                if (isMatch) {
                    return { ...p, uploading: false };
                }
                return p;
            }));
        }, 450);
    };

    const handleRemovePendingAttachment = (id?: string) => {
        if (!id) {
            pendingAttachments.forEach(att => {
                if (att.previewUrl && att.previewUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(att.previewUrl);
                }
            });
            setPendingAttachments([]);
        } else {
            const item = pendingAttachments.find(p => p.id === id);
            if (item?.previewUrl && item.previewUrl.startsWith('blob:')) {
                URL.revokeObjectURL(item.previewUrl);
            }
            setPendingAttachments(prev => prev.filter(p => p.id !== id));
        }
        if (mailFileInputRef.current) mailFileInputRef.current.value = '';
        if (mailImageInputRef.current) mailImageInputRef.current.value = '';
    };

    const [activeFormats, setActiveFormats] = useState<{
        bold?: boolean;
        italic?: boolean;
        underline?: boolean;
        strikethrough?: boolean;
        h3?: boolean;
        unorderedList?: boolean;
        orderedList?: boolean;
        quote?: boolean;
        code?: boolean;
    }>({});

    const checkActiveFormats = useCallback(() => {
        if (!richEditorRef.current) return;
        try {
            const isBold = document.queryCommandState('bold');
            const isItalic = document.queryCommandState('italic');
            const isUnderline = document.queryCommandState('underline');
            const isStrikethrough = document.queryCommandState('strikeThrough');
            const isUnorderedList = document.queryCommandState('insertUnorderedList');
            const isOrderedList = document.queryCommandState('insertOrderedList');

            const sel = window.getSelection();
            let isH3 = false;
            let isQuote = false;
            let isCode = false;

            if (sel && sel.rangeCount > 0) {
                let node: Node | null = sel.getRangeAt(0).startContainer;
                while (node && node !== richEditorRef.current) {
                    if (node.nodeName === 'H3') isH3 = true;
                    if (node.nodeName === 'BLOCKQUOTE') isQuote = true;
                    if (node.nodeName === 'PRE') isCode = true;
                    node = node.parentNode;
                }
            }

            setActiveFormats({
                bold: isBold,
                italic: isItalic,
                underline: isUnderline,
                strikethrough: isStrikethrough,
                unorderedList: isUnorderedList,
                orderedList: isOrderedList,
                h3: isH3,
                quote: isQuote,
                code: isCode,
            });
        } catch (e) {
            // ignore selection state errors
        }
    }, []);

    useEffect(() => {
        const handleSelectionChange = () => {
            if (document.activeElement === richEditorRef.current || richEditorRef.current?.contains(document.activeElement)) {
                checkActiveFormats();
            } else {
                setActiveFormats({});
            }
        };
        document.addEventListener('selectionchange', handleSelectionChange);
        return () => {
            document.removeEventListener('selectionchange', handleSelectionChange);
        };
    }, [checkActiveFormats]);

    const getFormatBtnClass = (isActive: boolean) =>
        `p-1.5 rounded transition-all select-none shrink-0 ${
            isActive
                ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                : 'text-zinc-400 hover:text-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-200'
        }`;

    const applyRichFormat = (type: 'bold' | 'italic' | 'underline' | 'strikethrough' | 'h3' | 'unorderedList' | 'orderedList' | 'quote' | 'code' | 'link' | 'clear' | 'template') => {
        if (richEditorRef.current) {
            richEditorRef.current.focus();
        }
        if (type === 'h3') {
            document.execCommand('formatBlock', false, '<h3>');
        } else if (type === 'quote') {
            document.execCommand('formatBlock', false, '<blockquote>');
        } else if (type === 'code') {
            document.execCommand('formatBlock', false, '<pre>');
        } else if (type === 'unorderedList') {
            document.execCommand('insertUnorderedList', false);
        } else if (type === 'orderedList') {
            document.execCommand('insertOrderedList', false);
        } else if (type === 'link') {
            const url = prompt('Enter website URL:', 'https://');
            if (url) {
                document.execCommand('createLink', false, url);
            }
        } else if (type === 'clear') {
            document.execCommand('removeFormat', false);
        } else if (type === 'bold') {
            document.execCommand('bold', false);
        } else if (type === 'italic') {
            document.execCommand('italic', false);
        } else if (type === 'underline') {
            document.execCommand('underline', false);
        } else if (type === 'strikethrough') {
            document.execCommand('strikeThrough', false);
        } else if (type === 'template') {
            const templateHtml = `<p>Hello,</p><p>Thank you for reaching out to <strong>Ceaznet Support</strong>. We are currently reviewing your request and will get back to you with an update shortly.</p><p>Best regards,<br/><strong>Ceaznet Support Team</strong></p>`;
            document.execCommand('insertHTML', false, templateHtml);
        }

        if (richEditorRef.current) {
            setReplyText(richEditorRef.current.innerText || richEditorRef.current.innerHTML);
        }
        setTimeout(checkActiveFormats, 10);
    };

    const applyFormatting = (type: 'template') => {
        if (type === 'template') {
            const templateText = "Hello,\n\nThank you for reaching out to Ceaznet Support. We are currently reviewing your request and will get back to you with an update shortly.\n\nBest regards,\nCeaznet Support Team";
            setReplyText(templateText);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isImageOnly = false) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
            const filePath = `attachments/${fileName}`;

            let publicUrl = '';
            try {
                const { data, error } = await dbMain.storage.from('support-attachments').upload(filePath, file);
                if (!error && data) {
                    const { data: urlData } = dbMain.storage.from('support-attachments').getPublicUrl(filePath);
                    publicUrl = urlData.publicUrl;
                }
            } catch (storageErr) {
                console.warn("Storage bucket error, falling back to data URL", storageErr);
            }

            if (!publicUrl) {
                publicUrl = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(file);
                });
            }

            if (richEditorRef.current) {
                richEditorRef.current.focus();
                if (isImageOnly || file.type.startsWith('image/')) {
                    const imgHtml = `<p><img src="${publicUrl}" alt="${file.name}" style="max-width:280px; max-height:200px; border-radius:8px; display:block; margin:8px 0;" /></p>`;
                    document.execCommand('insertHTML', false, imgHtml);
                } else {
                    const linkHtml = `<p>📎 <a href="${publicUrl}" target="_blank" rel="noopener noreferrer">${file.name}</a></p>`;
                    document.execCommand('insertHTML', false, linkHtml);
                }
                setReplyText(richEditorRef.current.innerText || richEditorRef.current.innerHTML);
            } else {
                const tag = isImageOnly || file.type.startsWith('image/')
                    ? `\n![${file.name}](${publicUrl})\n`
                    : `\n[📎 ${file.name}](${publicUrl})\n`;
                setReplyText(prev => prev + tag);
            }
        } catch (err) {
            console.error("File upload error", err);
            alert("Could not attach file.");
        } finally {
            e.target.value = '';
        }
    };

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
        let rawContent = replyText;
        if (richEditorRef.current && richEditorRef.current.innerHTML.trim()) {
            rawContent = richEditorRef.current.innerHTML;
        } else if (mailTextareaRef.current && mailTextareaRef.current.value.trim()) {
            rawContent = mailTextareaRef.current.value;
        }
        const contentToSend = htmlToMarkdown(rawContent);
        const isAnyUploading = pendingAttachments.some(p => p.uploading);

        if ((!contentToSend.trim() && pendingAttachments.length === 0) || !selectedConvId) return;
        if (isAnyUploading) return;
        
        setIsSending(true);
        try {
            const { data } = await dbMain.auth.getUser();
            const adminId = data?.user?.id || null; 

            let uploadedAttachmentPayload: {
                attachment_url?: string;
                attachment_name?: string;
                attachment_type?: string;
            } | undefined = undefined;

            if (pendingAttachments.length > 0) {
                // Upload all pending files to Telegram Bot API now
                const uploadPromises = pendingAttachments.map(att => uploadSupportAttachment(att.file));
                const uploadResults = await Promise.all(uploadPromises);

                const urls = uploadResults.map(r => r.attachment_url).filter(Boolean);
                const names = uploadResults.map(r => r.attachment_name).filter(Boolean);
                const types = uploadResults.map(r => r.attachment_type).filter(Boolean);

                if (urls.length > 0) {
                    uploadedAttachmentPayload = {
                        attachment_url: urls.join(','),
                        attachment_name: names.join(','),
                        attachment_type: types.join(',')
                    };
                }
            }

            // Determine message text fallback if only attachments were attached
            let msgText = contentToSend.trim();
            if (!msgText && pendingAttachments.length > 0) {
                if (pendingAttachments.length === 1) {
                    msgText = pendingAttachments[0].isImage ? 'Photo' : pendingAttachments[0].name;
                } else {
                    msgText = `${pendingAttachments.length} Attachments`;
                }
            }

            // Insert single message record into database
            const newMsg = await sendAdminMessage(
                selectedConvId, 
                adminId, 
                msgText,
                uploadedAttachmentPayload
            );

            setReplyText("");
            setLastGeneratedText("");
            if (richEditorRef.current) {
                richEditorRef.current.innerHTML = "";
            }
            if (mailTextareaRef.current) {
                mailTextareaRef.current.value = "";
            }
            handleRemovePendingAttachment();
            
            if (newMsg) {
                setMessages(prev => {
                    if (prev.find(m => m.id === newMsg.id)) return prev;
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
        if (!selectedConvId) return;
        const currentChatMessages = messages.filter(m => m.conversation_id === selectedConvId);
        if (currentChatMessages.length === 0) return;

        setIsGeneratingAi(true);
        try {
            const currentText = (richEditorRef.current?.innerText || mailTextareaRef.current?.value || replyText).trim();
            const activeConversation = conversations.find(c => c.id === selectedConvId);
            const subjectContext = activeConversation?.subject ? `[Ticket Subject: "${activeConversation.subject}"] ` : "";
            
            const prompt = currentText 
                ? `${subjectContext}Refine this draft reply to be highly professional, polite, and well-structured using clean Markdown formatting: ${currentText}`
                : `${subjectContext}Generate a polite, empathetic, and helpful response formatted nicely with Markdown to assist the user.`;
            
            const generated = await generateSupportReply(currentChatMessages, prompt, selectedAiModel);
            setReplyText(generated);
            setLastGeneratedText(generated);
            setSendMode('direct');
            if (richEditorRef.current) {
                richEditorRef.current.innerHTML = markdownToHtml(generated);
            }
            if (mailTextareaRef.current) {
                mailTextareaRef.current.value = generated;
            }
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

    const handleDeleteConversation = async () => {
        if (!selectedConvId) return;
        setIsDeletingConv(true);
        try {
            await deleteConversation(selectedConvId);
            setConversations(prev => prev.filter(c => c.id !== selectedConvId));
            setSelectedConvId(null);
            setShowDeleteConfirm(false);
            setToastMessage("Conversation and Telegram attachments deleted.");
            setTimeout(() => setToastMessage(null), 3000);
        } catch (error: any) {
            console.error("Error deleting conversation:", error);
            alert(`Failed to delete conversation: ${error.message || 'Unknown error'}`);
        } finally {
            setIsDeletingConv(false);
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
                                            <Loader className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
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
                                                        {stripHtmlAndMarkdown(latestMessage)}
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
                                <button 
                                    onClick={() => setShowDeleteConfirm(true)}
                                    className="w-8 h-8 sm:w-auto sm:px-3 sm:py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                                    title="Delete Conversation & Telegram Attachments"
                                >
                                    <Trash2 className="w-4 h-4" /> <span className="hidden sm:inline">Delete</span>
                                </button>
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-3 sm:space-y-4 bg-zinc-50/30 dark:bg-transparent">
                            {messages.length === 0 && (
                                <div className="text-center text-zinc-400 text-sm py-10">No messages yet.</div>
                            )}
                            {messages.map((msg) => (
                                <MessageItem 
                                    key={msg.id}
                                    msg={msg}
                                    userProfiles={userProfiles}
                                    activeConv={activeConv}
                                    settings={settings}
                                />
                            ))}
                            
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
                                            <div className="flex items-center justify-between w-full min-w-0 px-2.5 py-1.5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50">
                                                <div className="flex-1 flex items-center gap-0.5 sm:gap-1 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden py-0.5 min-w-0">
                                                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => applyRichFormat('bold')} className={getFormatBtnClass(!!activeFormats.bold)} title="Bold (Ctrl+B)">
                                                        <Bold className="w-4 h-4" />
                                                    </button>
                                                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => applyRichFormat('italic')} className={getFormatBtnClass(!!activeFormats.italic)} title="Italic (Ctrl+I)">
                                                        <Italic className="w-4 h-4" />
                                                    </button>
                                                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => applyRichFormat('underline')} className={getFormatBtnClass(!!activeFormats.underline)} title="Underline (Ctrl+U)">
                                                        <Underline className="w-4 h-4" />
                                                    </button>
                                                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => applyRichFormat('strikethrough')} className={getFormatBtnClass(!!activeFormats.strikethrough)} title="Strikethrough">
                                                        <Strikethrough className="w-4 h-4" />
                                                    </button>
 
                                                    <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-700 mx-0.5 shrink-0"></div>
 
                                                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => applyRichFormat('h3')} className={getFormatBtnClass(!!activeFormats.h3)} title="Heading">
                                                        <Heading1 className="w-4 h-4" />
                                                    </button>
                                                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => applyRichFormat('unorderedList')} className={getFormatBtnClass(!!activeFormats.unorderedList)} title="Bullet List">
                                                        <List className="w-4 h-4" />
                                                    </button>
                                                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => applyRichFormat('orderedList')} className={getFormatBtnClass(!!activeFormats.orderedList)} title="Numbered List">
                                                        <ListOrdered className="w-4 h-4" />
                                                    </button>
                                                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => applyRichFormat('quote')} className={getFormatBtnClass(!!activeFormats.quote)} title="Quote">
                                                        <Quote className="w-4 h-4" />
                                                    </button>
                                                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => applyRichFormat('code')} className={getFormatBtnClass(!!activeFormats.code)} title="Code Block">
                                                        <Code className="w-4 h-4" />
                                                    </button>
                                                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => applyRichFormat('link')} className={getFormatBtnClass(false)} title="Insert Link">
                                                        <Link2 className="w-4 h-4" />
                                                    </button>
                                                    <button onMouseDown={(e) => e.preventDefault()} onClick={() => applyRichFormat('clear')} className={getFormatBtnClass(false)} title="Clear Formatting">
                                                        <RemoveFormatting className="w-4 h-4" />
                                                    </button>
                                                </div>

                                                <div className="flex items-center gap-0.5 sm:gap-1 shrink-0 border-l border-zinc-200 dark:border-zinc-800 pl-1.5 sm:pl-2 ml-1">
                                                    <button 
                                                        onClick={() => handleAttachmentClick('file')}
                                                        onDoubleClick={handleAttachmentDoubleClick}
                                                        className={`p-1.5 text-zinc-400 hover:text-indigo-500 dark:text-zinc-500 dark:hover:text-indigo-400 rounded transition-all flex items-center gap-1 text-xs font-medium shrink-0 ${isAttachmentExpanded ? 'text-indigo-500 font-bold' : ''}`}
                                                        title={isAttachmentExpanded ? "Attach File (Double click to collapse)" : "Attach File"}
                                                    >
                                                        <Paperclip className="w-4 h-4" /> <span className="hidden md:inline">Attach</span>
                                                    </button>

                                                    <AnimatePresence>
                                                        {isAttachmentExpanded && (
                                                            <motion.button 
                                                                initial={{ opacity: 0, width: 0, scale: 0.8 }}
                                                                animate={{ opacity: 1, width: 'auto', scale: 1 }}
                                                                exit={{ opacity: 0, width: 0, scale: 0.8 }}
                                                                transition={{ type: "spring", stiffness: 350, damping: 25 }}
                                                                onClick={() => handleAttachmentClick('image')}
                                                                onDoubleClick={handleAttachmentDoubleClick}
                                                                className="p-1.5 text-zinc-400 hover:text-indigo-500 dark:text-zinc-500 dark:hover:text-indigo-400 rounded transition-all flex items-center gap-1 text-xs font-medium shrink-0 overflow-hidden" 
                                                                title="Insert Image (Double click to collapse)"
                                                            >
                                                                <ImageIcon className="w-4 h-4 text-emerald-500" /> <span className="hidden md:inline">Image</span>
                                                            </motion.button>
                                                        )}
                                                    </AnimatePresence>

                                                    <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-700 mx-0.5 sm:mx-1 shrink-0"></div>

                                                    <button 
                                                        onClick={() => {
                                                            setShowMailComposer(false);
                                                            setReplyText('');
                                                            if (richEditorRef.current) richEditorRef.current.innerHTML = '';
                                                        }}
                                                        className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded transition-colors shrink-0"
                                                        title="Close"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="p-3 relative min-h-[130px]">
                                                {isGeneratingAi && (
                                                    <div className="absolute inset-0 z-10 flex flex-col gap-2.5 p-3 bg-white dark:bg-zinc-900 pt-4 pointer-events-none rounded-t-lg">
                                                        <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse w-3/4"></div>
                                                        <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse w-full"></div>
                                                        <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse w-5/6"></div>
                                                        <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse w-2/3"></div>
                                                    </div>
                                                )}
                                                <div 
                                                    ref={richEditorRef}
                                                    contentEditable
                                                    onInput={(e) => {
                                                        if (richEditorRef.current) {
                                                            const html = richEditorRef.current.innerHTML;
                                                            if (html === '<br>' || html === '<div><br></div>' || html === '<p><br></p>') {
                                                                richEditorRef.current.innerHTML = '';
                                                            }
                                                            setReplyTextDebounced(richEditorRef.current.innerText || richEditorRef.current.innerHTML);
                                                        }
                                                        handleTyping();
                                                        checkActiveFormats();
                                                    }}
                                                    onKeyUp={checkActiveFormats}
                                                    onMouseUp={checkActiveFormats}
                                                    onClick={checkActiveFormats}
                                                    onFocus={checkActiveFormats}
                                                    onBlur={() => {
                                                        setTimeout(() => {
                                                            if (!richEditorRef.current?.contains(document.activeElement)) {
                                                                setActiveFormats({});
                                                            }
                                                        }, 150);
                                                    }}
                                                    className="w-full bg-transparent border-none focus:outline-none min-h-[110px] max-h-[350px] overflow-y-auto text-[15px] sm:text-sm text-zinc-900 dark:text-white leading-relaxed
                                                    [&_b]:font-bold [&_strong]:font-bold [&_i]:italic [&_em]:italic [&_u]:underline [&_s]:line-through [&_strike]:line-through 
                                                    [&_h1]:text-lg [&_h1]:font-bold [&_h1]:my-2
                                                    [&_h2]:text-base [&_h2]:font-bold [&_h2]:my-1.5
                                                    [&_h3]:text-[15px] [&_h3]:font-bold [&_h3]:my-1.5 [&_h3]:text-zinc-900 [&_h3]:dark:text-zinc-100
                                                    [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1.5 [&_li]:my-0.5
                                                    [&_blockquote]:border-l-2 [&_blockquote]:border-indigo-500 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-zinc-600 [&_blockquote]:dark:text-zinc-400 [&_blockquote]:my-1.5
                                                    [&_pre]:bg-zinc-100 [&_pre]:dark:bg-zinc-800 [&_pre]:p-2 [&_pre]:rounded [&_pre]:font-mono [&_pre]:text-xs [&_pre]:my-1.5
                                                    [&_code]:bg-zinc-100 [&_code]:dark:bg-zinc-800 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-xs
                                                    [&_a]:text-indigo-600 [&_a]:underline
                                                    empty:before:content-[attr(data-placeholder)] empty:before:text-zinc-400 empty:before:dark:text-zinc-500 empty:before:pointer-events-none"
                                                    data-placeholder="Write your response... Selected text will format live visually."
                                                />
                                            </div>

                                            {pendingAttachments.length > 0 && (
                                                <div className="px-3 pb-2">
                                                    <PendingAttachmentsList 
                                                        attachments={pendingAttachments} 
                                                        onRemove={handleRemovePendingAttachment} 
                                                        formatSize={formatAttachmentSize} 
                                                        onPreview={setPreviewAttachment}
                                                    />
                                                </div>
                                            )}

                                        <div className="flex flex-row justify-between items-center gap-2 px-3 py-2.5 bg-zinc-50 dark:bg-zinc-950/50 border-t border-zinc-100 dark:border-zinc-800">
                                            <div className="flex items-center gap-2 relative min-w-0 flex-1 max-w-[280px]">
                                                <div className="w-[120px] shrink-0">
                                                    <CustomDropdown
                                                        options={KNOWN_MODELS}
                                                        value={selectedAiModel}
                                                        onChange={setSelectedAiModel}
                                                        triggerClassName="!h-[24px] !p-1 !px-1.5 w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-md !text-[10px] font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-shadow shadow-sm truncate"
                                                    />
                                                </div>
                                                <button 
                                                    onClick={() => applyRichFormat('template')} 
                                                    className="text-zinc-500 hover:text-indigo-500 dark:text-zinc-400 dark:hover:text-indigo-400 text-xs font-semibold transition-colors flex items-center gap-1 whitespace-nowrap select-none"
                                                    title="Use Template"
                                                >
                                                    <Braces className="w-4 h-4" /> <span className="hidden sm:inline">Template</span>
                                                </button>
                                            </div>
                                            <div className="flex flex-row items-center gap-2 shrink-0">
                                                <motion.button 
                                                    layout
                                                    whileHover={!isGeneratingAi && replyText.trim() ? { scale: 1.02 } : {}}
                                                    whileTap={!isGeneratingAi && replyText.trim() ? { scale: 0.96 } : {}}
                                                    onClick={handleGenerateAiReply}
                                                    disabled={isGeneratingAi}
                                                    title="Generate response with AI"
                                                    className={`relative overflow-hidden flex items-center justify-center transition-all rounded-full font-medium text-[12px] h-[32px] w-[32px] p-0 shrink-0 border ${
                                                        isGeneratingAi 
                                                            ? 'bg-zinc-900 border-transparent text-white cursor-wait shadow-sm scale-[0.98]' 
                                                            : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 shadow-sm'
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
                                                                    <motion.div animate={{ y: [0, -2, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0 }} className="w-1 h-1 bg-zinc-700 dark:bg-white rounded-full" />
                                                                    <motion.div animate={{ y: [0, -2, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.2 }} className="w-1 h-1 bg-zinc-700 dark:bg-white rounded-full" />
                                                                    <motion.div animate={{ y: [0, -2, 0] }} transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.4 }} className="w-1 h-1 bg-zinc-700 dark:bg-white rounded-full" />
                                                                </div>
                                                            </motion.div>
                                                        ) : (
                                                            <motion.div 
                                                                key="idle"
                                                                initial={{ opacity: 0 }}
                                                                animate={{ opacity: 1 }}
                                                                exit={{ opacity: 0 }}
                                                                transition={{ duration: 0.15 }}
                                                                className="flex flex-row items-center justify-center z-10"
                                                            >
                                                                <CustomAiSparkleIcon className="w-5 h-5" />
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
                                                    disabled={(!replyText.trim() && pendingAttachments.length === 0) || isSending || pendingAttachments.some(p => p.uploading)}
                                                    className={`relative overflow-hidden flex items-center justify-center gap-1.5 px-3.5 sm:px-4 transition-all text-white rounded-full font-medium text-[12px] h-[32px] w-auto min-w-[70px] shrink-0 border shadow-sm ${
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
                                                                <span>Send</span>
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
                                            <div className="flex items-center gap-1.5">
                                                <button 
                                                    onClick={() => applyFormatting('template')} 
                                                    className="text-zinc-500 hover:text-indigo-500 dark:text-zinc-400 dark:hover:text-indigo-400 text-xs font-semibold transition-colors flex items-center gap-1 whitespace-nowrap select-none"
                                                    title="Use Template"
                                                >
                                                    <Braces className="w-4 h-4" /> <span className="hidden sm:inline">Template</span>
                                                </button>
                                            </div>
                                            <div className="relative z-20 flex items-center gap-2 min-w-0 flex-1 justify-end">
                                                <div className="shrink-0">
                                                    <CustomDropdown
                                                        options={['ai', 'direct']}
                                                        value={sendMode}
                                                        onChange={(val) => setSendMode(val as 'ai' | 'direct')}
                                                        displayLabels={{'ai': 'With AI', 'direct': 'Direct'}}
                                                        triggerClassName="!h-[24px] !p-1 !px-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg !text-[10px] font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-shadow shadow-sm min-w-[70px] flex items-center justify-between gap-1"
                                                    />
                                                </div>
                                                <div className="min-w-0 max-w-[130px]">
                                                    <CustomDropdown
                                                        options={KNOWN_MODELS}
                                                        value={selectedAiModel}
                                                        onChange={setSelectedAiModel}
                                                        triggerClassName="!h-[24px] !p-1 !px-1.5 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-400 rounded-lg !text-[9px] font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-shadow shadow-sm w-full flex items-center justify-between gap-1 truncate"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-end gap-1.5 sm:gap-2 w-full">
                                            <div className="flex items-center gap-0.5 shrink-0">
                                                <button 
                                                    onClick={() => handleAttachmentClick('file')} 
                                                    onDoubleClick={handleAttachmentDoubleClick}
                                                    className={`h-[40px] w-[40px] sm:h-[48px] sm:w-[48px] text-zinc-400 hover:text-indigo-500 dark:text-zinc-500 dark:hover:text-indigo-400 transition-all rounded-[16px] sm:rounded-2xl flex items-center justify-center shrink-0 ${isAttachmentExpanded ? 'text-indigo-500 font-bold' : ''}`} 
                                                    title={isAttachmentExpanded ? "Attach File (Double click to collapse)" : "Attach File"}
                                                >
                                                    <Paperclip className="w-[19px] h-[19px] sm:w-5 sm:h-5" />
                                                </button>
                                                <AnimatePresence>
                                                    {isAttachmentExpanded && (
                                                        <motion.button 
                                                            initial={{ opacity: 0, width: 0, scale: 0.8 }}
                                                            animate={{ opacity: 1, width: 'auto', scale: 1 }}
                                                            exit={{ opacity: 0, width: 0, scale: 0.8 }}
                                                            transition={{ type: "spring", stiffness: 350, damping: 25 }}
                                                            onClick={() => handleAttachmentClick('image')} 
                                                            onDoubleClick={handleAttachmentDoubleClick}
                                                            className="h-[40px] w-[40px] sm:h-[48px] sm:w-[48px] text-zinc-400 hover:text-indigo-500 dark:text-zinc-500 dark:hover:text-indigo-400 transition-all rounded-[16px] sm:rounded-2xl flex items-center justify-center shrink-0 overflow-hidden" 
                                                            title="Attach Image (Double click to collapse)"
                                                        >
                                                            <ImageIcon className="w-[19px] h-[19px] sm:w-5 sm:h-5 text-emerald-500" />
                                                        </motion.button>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                {pendingAttachments.length > 0 && (
                                                    <div className="mb-1.5">
                                                        <PendingAttachmentsList 
                                                            attachments={pendingAttachments} 
                                                            onRemove={handleRemovePendingAttachment} 
                                                            formatSize={formatAttachmentSize} 
                                                            onPreview={setPreviewAttachment}
                                                        />
                                                    </div>
                                                )}
                                                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus-within:border-indigo-500 dark:focus-within:border-indigo-500 rounded-[22px] sm:rounded-2xl overflow-hidden transition-all duration-200 shadow-sm focus-within:shadow-md relative">
                                                    {isGeneratingAi && (
                                                        <div className="absolute inset-0 z-10 flex flex-col gap-2 justify-center px-4 bg-white dark:bg-zinc-900 pointer-events-none rounded-[22px] sm:rounded-2xl">
                                                            <div className="h-3.5 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse w-full max-w-[80%]"></div>
                                                            <div className="h-3.5 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse w-full max-w-[60%]"></div>
                                                        </div>
                                                    )}
                                                    <FastTextarea 
                                                        value={replyText}
                                                        onChange={(val) => {
                                                            setReplyTextDebounced(val);
                                                            handleTyping();
                                                        }}
                                                        onKeyDown={handleKeyDown}
                                                        placeholder={pendingAttachments.length > 0 ? "Add a message (optional)..." : "Reply in chat..."}
                                                        className="w-full bg-transparent border-none focus:ring-0 resize-none px-4 py-[11px] sm:px-4 sm:py-[15px] text-[16px] sm:text-sm text-zinc-900 dark:text-white min-h-[44px] sm:min-h-[52px] scrollbar-hide outline-none block m-0"
                                                        style={{ lineHeight: '22px' }}
                                                        textareaRef={mailTextareaRef}
                                                    />
                                                </div>
                                            </div>
                                            <div className="relative shrink-0">
                                                <button 
                                                    onClick={() => {
                                                        const hasAttachment = pendingAttachments.length > 0;
                                                        if (sendMode === 'direct' || (lastGeneratedText && replyText === lastGeneratedText) || hasAttachment) {
                                                            handleSendReply();
                                                        } else {
                                                            handleGenerateAiReply();
                                                        }
                                                    }}
                                                    disabled={isGeneratingAi || isSending || (sendMode === 'direct' && !replyText.trim() && pendingAttachments.length === 0) || pendingAttachments.some(p => p.uploading)}
                                                    className={`h-[44px] w-[44px] sm:h-[52px] sm:w-[52px] rounded-full flex items-center justify-center shrink-0 transition-all shadow-sm relative overflow-hidden ${
                                                        isGeneratingAi || isSending
                                                            ? 'bg-slate-900 border-transparent text-white cursor-wait shadow-[0_0_15px_rgba(56,189,248,0.3)] scale-[0.98]' 
                                                            : sendMode === 'direct' || pendingAttachments.length > 0
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

            {/* Hidden file input for general attachments */}
            <input
                type="file"
                multiple
                ref={mailFileInputRef}
                className="hidden"
                onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length > 0) {
                        handleMultipleAttachmentSelect(files);
                        e.target.value = '';
                    }
                }}
            />

            {/* Hidden file input for images */}
            <input
                type="file"
                multiple
                ref={mailImageInputRef}
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length > 0) {
                        handleMultipleAttachmentSelect(files);
                        e.target.value = '';
                    }
                }}
            />

            {/* Full-screen Attachment Preview Overlay */}
            <FullScreenAttachmentPreview
                isOpen={!!previewAttachment}
                onClose={() => setPreviewAttachment(null)}
                url={previewAttachment?.previewUrl || null}
                name={previewAttachment?.name}
                isImage={previewAttachment?.isImage}
                sizeFormatted={previewAttachment ? formatAttachmentSize(previewAttachment.size) : undefined}
            />

            {/* Delete Conversation Confirmation Modal */}
            <AnimatePresence>
                {showDeleteConfirm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4"
                        >
                            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
                                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center shrink-0">
                                    <Trash2 className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">Delete Conversation?</h3>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">This action cannot be undone.</p>
                                </div>
                            </div>

                            <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                                Are you sure you want to delete this conversation? All messages and associated attachments stored on Telegram will be permanently deleted.
                            </p>

                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    disabled={isDeletingConv}
                                    onClick={() => setShowDeleteConfirm(false)}
                                    className="px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    disabled={isDeletingConv}
                                    onClick={handleDeleteConversation}
                                    className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-xl shadow-sm transition-colors flex items-center gap-2"
                                >
                                    {isDeletingConv && <Loader size={14} className="animate-spin" />}
                                    {isDeletingConv ? 'Deleting...' : 'Delete Permanently'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default SupportInboxPage;
