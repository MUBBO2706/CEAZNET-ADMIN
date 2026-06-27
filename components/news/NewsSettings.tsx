import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { useAutoRefresh } from '../AutoRefreshContext';
import { PanelCard, ConfirmationModal, CustomDropdown } from '../ui';
import { dbMain, getNewsApiKeys, addNewsApiKey, deleteNewsApiKey, updateNewsApiKey, resetNewsApiKeysStatus, resetAllNewsApiKeysData, getNewsSystemConfigs, updateNewsSystemConfig, addNewsSystemConfig } from '../../services/supabaseService';
import type { NewsApiKey, NewsSystemConfig } from '../../types';
import { Newspaper, Sparkles, Eye, EyeOff, Trash2, PlusCircle, List, FileText, KeyRound, MoreVertical, Edit2, X, RefreshCw, RotateCcw, Cpu, Plus, Volume2, VolumeX, Music, Settings, Check, CheckCircle2, XCircle } from 'lucide-react';
import CodeEditor from '../ui/CodeEditor';
import { JsonNode, updateNestedValue, deleteNestedValue, getNestedValue } from '../data/JsonEditor';

const ApiKeyRow: React.FC<{ 
    apiKeyObj: NewsApiKey | any; 
    columns: string[];
    isLast?: boolean; 
    onDelete: () => void; 
    onUpdate: (newKey: Partial<NewsApiKey>) => Promise<void>;
    onResetStatus?: () => void;
    onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
    focusedColumn?: string | null;
}> = ({ apiKeyObj, columns, isLast, onDelete, onUpdate, onResetStatus, onScroll, focusedColumn }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Editing state
    const [rawMode, setRawMode] = useState(false);
    const [jsonContent, setJsonContent] = useState<any>(apiKeyObj);
    const [rawString, setRawString] = useState(JSON.stringify(apiKeyObj, null, 2));

    useEffect(() => {
        if (!isEditing) {
            setJsonContent(apiKeyObj);
            setRawString(JSON.stringify(apiKeyObj, null, 2));
        }
    }, [apiKeyObj, isEditing]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        if (isMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isMenuOpen]);

    const handleMenuAction = (action: () => void) => {
        action();
        setIsMenuOpen(false);
    };

    const handleSaveEdit = async () => {
        setIsSaving(true);
        try {
            let updates: Partial<NewsApiKey>;
            if (rawMode) {
                updates = JSON.parse(rawString);
            } else {
                updates = jsonContent;
            }
            
            // Remove id from updates if present to avoid updating primary key
            const { id, ...restUpdates } = updates as any;
            await onUpdate(restUpdates);
            setIsEditing(false);
        } catch (error) {
            console.error("Failed to update API key:", error);
            alert("Failed to update API key. Please check JSON format.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdate = (path: string[], newValue: any) => {
        setJsonContent((prev: any) => {
            const updated = updateNestedValue(prev, path, newValue);
            setRawString(JSON.stringify(updated, null, 2));
            return updated;
        });
    };

    const handleDeleteNode = (path: string[]) => {
        setJsonContent((prev: any) => {
            const updated = deleteNestedValue(prev, path);
            setRawString(JSON.stringify(updated, null, 2));
            return updated;
        });
    };

    const handleAddNode = (path: (string | number)[], value: any) => {
        setJsonContent((prev: any) => {
            const parent = getNestedValue(prev, path);
            if (Array.isArray(parent)) {
                const updated = updateNestedValue(prev, path, [...parent, value]);
                setRawString(JSON.stringify(updated, null, 2));
                return updated;
            }
            return prev;
        });
    };

    const optionBaseClass = "block w-full text-left px-4 py-2 text-sm text-[var(--text-primary)] flex items-center gap-2";
    const optionHoverClass = "hover:bg-[var(--sidebar-link-hover-bg)]";

    const apiKeyStr = apiKeyObj.api_key || '';
    const maskedKey = apiKeyStr.length > 8 ? `${apiKeyStr.slice(0, 4)}••••••••${apiKeyStr.slice(-4)}` : '••••••••';
    const isExhausted = apiKeyObj.status === 'exhausted';

    const [expandedCols, setExpandedCols] = useState<Record<string, boolean>>({});
    const toggleColExpand = (col: string) => {
        setExpandedCols(prev => ({ ...prev, [col]: !prev[col] }));
    };

    return (
        <div className={`flex flex-col border-b border-[var(--border-color)] last:border-b-0 bg-[var(--card-bg)] ${isMenuOpen ? 'relative z-50' : 'relative z-0'}`}>
            <div className="relative group">
                <div 
                    onClick={() => !isEditing && setIsExpanded(!isExpanded)}
                    onScroll={onScroll}
                    className={`api-key-row-scroll-container flex items-center py-3 px-4 hover:bg-[var(--subtle-bg)] dark:hover:bg-[#111] transition-colors text-sm overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] pr-[100px] ${!isEditing ? 'cursor-pointer' : ''}`}
                >
                    {columns.map(col => {
                        const val = apiKeyObj[col];
                        const isNullOrEmpty = val == null || val === '';
                        let displayVal = isNullOrEmpty ? '-' : String(val);
                        const isFocused = focusedColumn === col;

                        if (!isNullOrEmpty && (col.endsWith('_at') || col === 'cooldown_until')) {
                            try {
                                const d = new Date(val as string);
                                if (!isNaN(d.getTime())) {
                                    displayVal = d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
                                }
                            } catch (e) {}
                        }

                        if (col === 'api_key') {
                            return (
                                <div key={col} className={`w-40 sm:w-64 shrink-0 pr-4 font-mono flex items-center gap-2 truncate transition-colors ${isFocused ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-[var(--text-primary)]'}`}>
                                    <KeyRound size={16} className={`${isFocused ? 'text-indigo-500' : 'text-indigo-400 group-hover:text-indigo-500'} transition-colors shrink-0`} />
                                    <span className="truncate">{isVisible ? displayVal : maskedKey}</span>
                                </div>
                            );
                        }
                        if (col === 'status') {
                            return (
                                <div key={col} className="w-32 shrink-0 px-4 flex justify-center items-center">
                                    <span 
                                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide transition-colors ${
                                            isExhausted 
                                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300' 
                                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                                        }`}
                                    >
                                        {isExhausted ? <XCircle size={11} strokeWidth={2.5} /> : <CheckCircle2 size={11} strokeWidth={2.5} />}
                                        <span className="uppercase">{displayVal}</span>
                                    </span>
                                </div>
                            );
                        }
                        if (col === 'account_name') {
                            return (
                                <div key={col} className="w-40 shrink-0 px-4">
                                    <span 
                                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border max-w-full truncate ${isNullOrEmpty ? 'bg-[var(--subtle-bg)] text-[var(--text-muted)] border-[var(--border-color)]' : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/50'}`} 
                                        title={displayVal}
                                    >
                                        {isNullOrEmpty ? 'Unassigned' : displayVal}
                                    </span>
                                </div>
                            );
                        }
                        return (
                            <div key={col} className={`w-32 shrink-0 px-4 text-center truncate transition-colors ${isFocused ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-[var(--text-secondary)]'}`} title={String(val ?? '')}>
                                {displayVal}
                            </div>
                        );
                    })}
                </div>
                
                {/* Actions */}
                <div className="absolute right-0 top-0 bottom-0 flex justify-end items-center w-[120px] bg-gradient-to-l from-[var(--card-bg)] from-50% to-transparent group-hover:from-[var(--subtle-bg)] dark:group-hover:from-[#111] transition-colors pr-4 z-10 pointer-events-none">
                    <div className="flex items-center pointer-events-auto" onClick={e => e.stopPropagation()}>
                        <button 
                            onClick={() => setIsVisible(!isVisible)} 
                            className="p-1.5 rounded-md text-[var(--text-secondary)] hover:bg-[var(--sidebar-link-hover-bg)] hover:text-[var(--text-primary)] transition-colors"
                            title={isVisible ? "Hide" : "Show"}
                        >
                            {isVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        <div className="relative" ref={menuRef}>
                            <button 
                                onClick={() => setIsMenuOpen(prev => !prev)}
                                className="p-1.5 rounded-md text-[var(--text-secondary)] hover:bg-[var(--sidebar-link-hover-bg)] hover:text-[var(--text-primary)] transition-colors"
                                aria-label="More options"
                            >
                                <MoreVertical size={14} />
                            </button>
                            {isMenuOpen && (
                                <div className={`absolute ${isLast ? 'bottom-full mb-1' : 'top-full mt-1'} right-0 w-48 z-50 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md shadow-lg overflow-hidden`}>
                                <div className="flex flex-col py-1">
                                    <button onClick={() => handleMenuAction(() => { setIsExpanded(true); setIsEditing(true); })} className={`${optionBaseClass} ${optionHoverClass}`}>
                                        <Edit2 size={14} /> Edit Key
                                    </button>
                                    {isExhausted && onResetStatus && (
                                        <button onClick={() => handleMenuAction(onResetStatus)} className={`${optionBaseClass} ${optionHoverClass}`}>
                                            <RotateCcw size={14} /> Reset Status
                                        </button>
                                    )}
                                    <button onClick={() => handleMenuAction(onDelete)} className={`${optionBaseClass} text-red-600 dark:text-red-400 hover:!bg-red-50 dark:hover:!bg-red-900/50`}>
                                        <Trash2 size={14} /> Delete...
                                    </button>
                                </div>
                            </div>
                        )}
                        </div>
                    </div>
                </div>
            </div>
            
            {isExpanded && (
                <div className="px-4 py-3 bg-[var(--subtle-bg)] dark:bg-black text-xs border-t border-[var(--border-color)] shadow-inner flex flex-col gap-3">
                    <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-[var(--text-primary)]">Key Details</span>
                        {!isEditing && (
                            <button onClick={() => setIsEditing(true)} className="text-[var(--accent-color)] hover:underline flex items-center gap-1">
                                <Edit2 size={12} /> Edit
                            </button>
                        )}
                        {isEditing && (
                            <div className="flex items-center gap-2">
                                <button onClick={() => { setIsEditing(false); setJsonContent(apiKeyObj); setRawString(JSON.stringify(apiKeyObj, null, 2)); }} className="btn btn-secondary px-2 py-1 text-xs" disabled={isSaving}>
                                    Cancel
                                </button>
                                <button onClick={handleSaveEdit} className="btn btn-primary px-2 py-1 text-xs" disabled={isSaving}>
                                    {isSaving ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        )}
                    </div>
                    
                    {isEditing ? (
                        <div className="space-y-3">
                            <div className="flex bg-[var(--card-bg)] p-1 rounded-lg border border-[var(--border-color)] w-fit">
                                <button
                                    onClick={() => setRawMode(false)}
                                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all duration-200 ${!rawMode ? 'bg-[var(--subtle-bg)] text-[var(--accent-text)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                                >
                                    Structured
                                </button>
                                <button
                                    onClick={() => setRawMode(true)}
                                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all duration-200 ${rawMode ? 'bg-[var(--subtle-bg)] text-[var(--accent-text)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                                >
                                    Raw
                                </button>
                            </div>
                            
                            <div className="rounded-md overflow-hidden bg-transparent">
                                {rawMode ? (
                                    <div className="border border-[var(--border-color)] rounded-md overflow-hidden">
                                        <CodeEditor
                                            value={rawString}
                                            onChange={(val) => setRawString(val || '')}
                                            language="json"
                                            height="auto"
                                        />
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto p-0">
                                        <JsonNode
                                            nodeKey="root"
                                            value={jsonContent}
                                            path={[]}
                                            onUpdate={handleUpdate}
                                            onDelete={handleDeleteNode}
                                            onAdd={handleAddNode}
                                            isRoot={true}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                                {columns.filter(col => col !== 'api_key').map(col => {
                                    const val = apiKeyObj[col];
                                    const isNullOrEmpty = val == null || val === '';
                                    let displayVal = isNullOrEmpty ? 'N/A' : String(val);
                                    
                                    if (!isNullOrEmpty && (col.endsWith('_at') || col === 'cooldown_until')) {
                                        try {
                                            const d = new Date(val as string);
                                            if (!isNaN(d.getTime())) {
                                                displayVal = d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
                                            }
                                        } catch (e) {}
                                    }
                                    
                                     const isExpandedCol = expandedCols[col];
                                    
                                    if (col === 'status') {
                                        return (
                                            <div key={col} className="flex flex-col min-w-0">
                                                <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-[var(--text-secondary)] font-bold mb-0.5">STATUS</div>
                                                <div className="mt-0.5">
                                                    <span 
                                                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide transition-colors ${
                                                            isExhausted 
                                                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300' 
                                                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                                                        }`}
                                                    >
                                                        {isExhausted ? <XCircle size={11} strokeWidth={2.5} /> : <CheckCircle2 size={11} strokeWidth={2.5} />}
                                                        <span className="uppercase">{displayVal}</span>
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div key={col} className="flex flex-col min-w-0">
                                            <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-[var(--text-secondary)] font-bold mb-0.5">{col.replace(/_/g, ' ')}</div>
                                            <div 
                                                onClick={() => toggleColExpand(col)}
                                                className={`text-xs sm:text-sm cursor-pointer transition-all ${isExpandedCol ? 'break-all whitespace-normal' : 'truncate'} ${col === 'failure_count' ? 'font-mono text-red-500' : isNullOrEmpty ? 'text-[var(--text-secondary)] italic' : 'font-mono text-[var(--text-primary)]'}`} 
                                                title={!isExpandedCol ? displayVal : "Click to collapse"}
                                            >
                                                {displayVal}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="text-[10px] text-[var(--text-secondary)] flex items-center gap-2 mt-1">
                                <span>Full Key:</span>
                                <span className="font-mono bg-[var(--card-bg)] px-1.5 py-0.5 rounded border border-[var(--border-color)] select-all w-fit break-all">{apiKeyObj.api_key}</span>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

const ApiKeyManager: React.FC<{
    title: string;
    description: string;
    icon: React.ReactNode;
    provider: 'gnews' | 'gemini' | 'brevo';
    keys: NewsApiKey[];
    onRefresh: () => void;
    placeholder: string;
}> = ({ title, description, icon, provider, keys, onRefresh, placeholder }) => {
    const [isAdding, setIsAdding] = useState(false);
    const [newApiKey, setNewApiKey] = useState('');
    const [newAccountName, setNewAccountName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [keyToDelete, setKeyToDelete] = useState<NewsApiKey | null>(null);
    const [isResetting, setIsResetting] = useState(false);
    const [isResettingAll, setIsResettingAll] = useState(false);
    const [isResetAllModalOpen, setIsResetAllModalOpen] = useState(false);
    
    // Bulk Add / Raw Mode
    const [isBulkMode, setIsBulkMode] = useState(false);
    const [isStructuredBulkMode, setIsStructuredBulkMode] = useState(true);
    const [bulkInput, setBulkInput] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    const [focusedColumn, setFocusedColumn] = useState<string | null>(null);

    const dynamicColumns = useMemo(() => {
        if (keys.length > 0) {
            return Object.keys(keys[0]).filter(k => k !== 'id' && k !== 'provider');
        }
        return ['api_key', 'status', 'calls_count', 'failure_count', 'created_at'];
    }, [keys]);

    const headerRef = React.useRef<HTMLDivElement>(null);

    const handleRowScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (headerRef.current) {
            headerRef.current.scrollLeft = e.currentTarget.scrollLeft;
        }
    };

    const handleAddKey = async () => {
        if (!newApiKey.trim()) return;
        if (keys.some(k => k.api_key === newApiKey.trim())) {
            alert('This key already exists.');
            return;
        }
        setIsSaving(true);
        try {
            const { error } = await addNewsApiKey(provider, newApiKey.trim(), newAccountName.trim() || undefined);
            if (error) throw error;
            setNewApiKey('');
            // Do not clear setNewAccountName(''); so user can add multiple keys for the same account easily
            setIsAdding(false);
            onRefresh();
        } catch (error) {
            console.error("Failed to add key:", error);
            alert("Failed to add key.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteKey = async () => {
        if (!keyToDelete) return;
        try {
            const { error } = await deleteNewsApiKey(keyToDelete.id);
            if (error) throw error;
            setKeyToDelete(null);
            onRefresh();
        } catch (error) {
            console.error("Failed to delete key:", error);
            alert("Failed to delete key.");
        }
    };

    const handleUpdateKey = async (id: string, newKey: Partial<NewsApiKey>) => {
        if (newKey.api_key && keys.some(k => k.api_key === newKey.api_key && k.id !== id)) {
            alert('This key already exists.');
            throw new Error('Key already exists');
        }
        const { error } = await updateNewsApiKey(id, newKey);
        if (error) throw error;
        onRefresh();
    };

    const handleResetExhausted = async () => {
        setIsResetting(true);
        try {
            const { error } = await resetNewsApiKeysStatus(provider);
            if (error) throw error;
            onRefresh();
        } catch (error) {
            console.error("Failed to reset keys:", error);
            alert("Failed to reset keys.");
        } finally {
            setIsResetting(false);
        }
    };

    const handleResetAllKeys = async () => {
        setIsResettingAll(true);
        try {
            const { error } = await resetAllNewsApiKeysData(provider);
            if (error) throw error;
            onRefresh();
            setIsResetAllModalOpen(false);
        } catch (error) {
            console.error("Failed to reset all keys:", error);
            alert("Failed to reset all keys.");
        } finally {
            setIsResettingAll(false);
        }
    };

    const toggleBulkMode = () => {
        if (!isBulkMode) {
            setBulkInput(JSON.stringify(keys.map(k => k.api_key), null, 2));
            setIsStructuredBulkMode(true);
        }
        setIsBulkMode(!isBulkMode);
    };

    const getStructuredKeys = (): string[] => {
        try {
            const parsed = JSON.parse(bulkInput);
            if (Array.isArray(parsed)) return parsed.map(String);
            return [];
        } catch {
            return [];
        }
    };

    const updateStructuredKey = (index: number, newValue: string) => {
        const arr = getStructuredKeys();
        arr[index] = newValue;
        setBulkInput(JSON.stringify(arr, null, 2));
    };

    const removeStructuredKey = (index: number) => {
        const arr = getStructuredKeys();
        arr.splice(index, 1);
        setBulkInput(JSON.stringify(arr, null, 2));
    };

    const addStructuredKey = () => {
        const arr = getStructuredKeys();
        arr.push("");
        setBulkInput(JSON.stringify(arr, null, 2));
    };
    
    const handleBulkImport = async () => {
        if (!bulkInput.trim()) return;
        setIsImporting(true);
        try {
            let extractedKeys: string[] = [];
            const trimmed = bulkInput.trim();
            
            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) {
                    extractedKeys = parsed.map(k => String(k).trim()).filter(k => k.length > 0);
                } else if (typeof parsed === 'object' && parsed !== null) {
                    extractedKeys = Object.values(parsed).flat().map(k => String(k).trim()).filter(k => k.length > 0);
                }
            } catch (e) {
                extractedKeys = trimmed.split(/[\n,]+/).map(k => k.replace(/["'\[\]]/g, '').trim()).filter(k => k.length > 0);
            }

            extractedKeys = [...new Set(extractedKeys)]; // Unique keys

            // Find new keys to add
            const existingKeys = keys.map(k => k.api_key);
            const keysToAdd = extractedKeys.filter(k => !existingKeys.includes(k));
            
            // Find keys to delete
            const keysToDelete = keys.filter(k => !extractedKeys.includes(k.api_key));

            // Execute additions and deletions sequentially to avoid race conditions
            for (const key of keysToAdd) {
                await addNewsApiKey(provider, key);
            }
            for (const keyObj of keysToDelete) {
                await deleteNewsApiKey(keyObj.id);
            }

            setIsBulkMode(false);
            onRefresh();
            alert(`Successfully synced keys. Added ${keysToAdd.length}, Removed ${keysToDelete.length}.`);
        } catch (error) {
            console.error("Bulk import failed", error);
            alert(`Failed to import keys: ${(error as Error).message}`);
        } finally {
            setIsImporting(false);
        }
    };

    const activeKeys = keys.filter(k => k.status === 'active').length;
    const exhaustedKeys = keys.filter(k => k.status === 'exhausted').length;

    return (
        <div className="space-y-6">
            {!isBulkMode && (
                <div className="mb-3">
                    <h2 className="text-xl font-bold text-[var(--text-primary)]">{title}</h2>
                    <p className="text-xs text-[var(--text-secondary)]">{description}</p>
                </div>
            )}

            <PanelCard className="overflow-visible !p-0 w-full min-w-0">
                <div className="flex justify-between items-center gap-4 p-4 border-b border-[var(--border-color)]">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-md">
                            {icon}
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-[var(--text-primary)]">API Keys</h3>
                            <p className="text-[10px] text-[var(--text-secondary)]">
                                {keys.length} keys configured
                            </p>
                        </div>
                    </div>
                    
                    <button 
                        onClick={toggleBulkMode} 
                        className="btn btn-secondary text-xs flex items-center gap-2 shrink-0"
                    >
                        {isBulkMode ? <List size={14} /> : <FileText size={14} />}
                        <span>{isBulkMode ? 'List View' : 'Bulk Editor'}</span>
                    </button>
                </div>

                {isBulkMode ? (
                    <div className="animate-fade-in-up p-4">
                        <div className="mb-4">
                            <div className="text-xs text-[var(--text-secondary)] mb-3 w-full">
                                <p className="font-semibold mb-1">Bulk Editor:</p>
                                <p>Add multiple keys. Existing keys are shown for reference. Duplicate keys are automatically filtered out.</p>
                            </div>
                            <div className="flex justify-end">
                                <div className="flex bg-[var(--subtle-bg)] p-1 rounded-lg border border-[var(--border-color)] shrink-0">
                                    <button
                                        onClick={() => setIsStructuredBulkMode(true)}
                                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all duration-200 ${isStructuredBulkMode ? 'bg-[var(--card-bg)] text-[var(--accent-text)] shadow-sm ring-1 ring-black/5 dark:ring-white/10' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                                    >
                                        Structured
                                    </button>
                                    <button
                                        onClick={() => setIsStructuredBulkMode(false)}
                                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all duration-200 ${!isStructuredBulkMode ? 'bg-[var(--card-bg)] text-[var(--accent-text)] shadow-sm ring-1 ring-black/5 dark:ring-white/10' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                                    >
                                        Raw
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        {isStructuredBulkMode ? (
                            <div className="border border-[var(--border-color)] rounded-lg overflow-hidden bg-[var(--subtle-bg)]">
                                <div className="max-h-[300px] overflow-y-auto p-2 space-y-2">
                                    {getStructuredKeys().map((keyStr, index) => (
                                        <div key={index} className="flex items-center gap-2">
                                            <input 
                                                type="text" 
                                                value={keyStr} 
                                                onChange={(e) => updateStructuredKey(index, e.target.value)}
                                                className="form-input w-full text-xs font-mono"
                                                placeholder="sk-..."
                                            />
                                            <button onClick={() => removeStructuredKey(index)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors shrink-0">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                    {getStructuredKeys().length === 0 && (
                                        <div className="text-center py-4 text-xs text-[var(--text-secondary)]">No keys. Add one below.</div>
                                    )}
                                </div>
                                <div className="p-2 border-t border-[var(--border-color)] bg-[var(--card-bg)]">
                                    <button onClick={addStructuredKey} className="btn btn-secondary text-xs w-full justify-center">
                                        <PlusCircle size={14} /> Add Key
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <CodeEditor
                                value={bulkInput}
                                onChange={setBulkInput}
                                language="json"
                                placeholder={`[\n  "sk-key1",\n  "sk-key2"\n]`}
                                height="auto"
                                maxHeight="300px"
                            />
                        )}
                        <div className="flex justify-end items-center gap-3 pt-4">
                            <button onClick={() => setIsBulkMode(false)} className="btn btn-secondary">Cancel</button>
                            <button onClick={handleBulkImport} className="btn btn-primary" disabled={isImporting || !bulkInput.trim()}>
                                {isImporting ? 'Syncing...' : 'Sync Keys'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col api-key-manager-wrapper">
                        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--text-secondary)] bg-[var(--subtle-bg)] px-4 py-3 border-b border-[var(--border-color)]">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:gap-4">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                                    <span>Total: <strong>{keys.length}</strong></span>
                                </div>
                                <div className="hidden sm:block w-px h-3 bg-[var(--border-color)]"></div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                    <span>Active: <strong>{activeKeys}</strong></span>
                                </div>
                                {exhaustedKeys > 0 && (
                                    <>
                                        <div className="hidden sm:block w-px h-3 bg-[var(--border-color)]"></div>
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                            <span className="text-red-600 dark:text-red-400">Exhausted: <strong>{exhaustedKeys}</strong></span>
                                        </div>
                                    </>
                                )}
                            </div>
                            <button
                                onClick={() => setIsResetAllModalOpen(true)}
                                disabled={isResettingAll || keys.length === 0}
                                className="text-indigo-500 hover:text-indigo-600 font-medium transition-colors disabled:opacity-50 shrink-0 flex items-center gap-1.5"
                            >
                                <RotateCcw size={14} className={isResettingAll ? 'animate-spin' : ''} />
                                <span>{isResettingAll ? 'Resetting...' : 'Reset'}</span>
                            </button>
                        </div>

                        <div className="w-full overflow-hidden">
                            <div className="flex flex-col">
                                <div className="relative border-b border-[var(--border-color)]">
                                    <div 
                                        ref={headerRef}
                                        className="flex items-center py-3 px-4 bg-[var(--subtle-bg)] dark:bg-black text-[10px] sm:text-xs uppercase tracking-wider font-bold text-[var(--text-secondary)] overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] pr-[100px]"
                                    >
                                        {dynamicColumns.map((col) => {
                                            const isFocused = focusedColumn === col;
                                            return (
                                                <div 
                                                    key={col} 
                                                    className={`cursor-pointer transition-colors ${col === 'api_key' ? 'w-40 sm:w-64 shrink-0 px-4 truncate text-left' : 'w-32 shrink-0 px-4 text-center truncate'} ${isFocused ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'hover:text-[var(--text-primary)] hover:bg-[var(--sidebar-hover-bg)] rounded'}`} 
                                                    title={`Click to focus column: ${col.replace(/_/g, ' ')}`}
                                                    onClick={(e) => {
                                                        const target = e.currentTarget;
                                                        const container = headerRef.current;
                                                        if (!container) return;
                                                        
                                                        setFocusedColumn(col);
                                                        // Calculate scroll position to snap this column into view (minus container padding)
                                                        const scrollTarget = target.offsetLeft - 16; 
                                                        
                                                        // Smoothly scroll header
                                                        container.scrollTo({ left: scrollTarget, behavior: 'smooth' });
                                                        
                                                        // Smoothly scroll ALL rows matching THIS specific table block
                                                        const managerWrapper = container.closest('.api-key-manager-wrapper');
                                                        if (managerWrapper) {
                                                            const rows = managerWrapper.querySelectorAll('.api-key-row-scroll-container');
                                                            rows.forEach(row => {
                                                                row.scrollTo({ left: scrollTarget, behavior: 'smooth' });
                                                            });
                                                        }
                                                    }}
                                                >
                                                    {col.replace(/_/g, ' ')}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="absolute right-0 top-0 bottom-0 flex justify-end items-center w-[120px] bg-gradient-to-l from-[var(--subtle-bg)] dark:from-black from-50% to-transparent pr-4 z-10 pointer-events-none">
                                        <div className="text-right text-[10px] sm:text-xs uppercase tracking-wider font-bold text-[var(--text-secondary)]">Actions</div>
                                    </div>
                                </div>
                                
                                {keys.length > 0 ? (
                                    keys.map((keyObj, index) => (
                                        <ApiKeyRow 
                                            key={keyObj.id} 
                                            apiKeyObj={keyObj}
                                            columns={dynamicColumns}
                                            isLast={index === keys.length - 1}
                                            onDelete={() => setKeyToDelete(keyObj)}
                                            onUpdate={(newKey) => handleUpdateKey(keyObj.id, newKey)}
                                            onResetStatus={() => handleUpdateKey(keyObj.id, { status: 'active', failure_count: 0 })}
                                            onScroll={handleRowScroll}
                                            focusedColumn={focusedColumn}
                                        />
                                    ))
                                ) : (
                                    <div className="text-center py-8 bg-[var(--card-bg)]">
                                        <div className="w-10 h-10 bg-[var(--subtle-bg)] rounded-full flex items-center justify-center mx-auto mb-2 text-[var(--text-secondary)]">
                                            <KeyRound size={20} />
                                        </div>
                                        <p className="text-xs text-[var(--text-secondary)]">No API keys configured.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-4 border-t border-[var(--border-color)] flex flex-row justify-between gap-2 sm:gap-3 bg-[var(--card-bg)]">
                            <div className="flex gap-2">
                                <button 
                                    onClick={handleResetExhausted} 
                                    className="btn btn-secondary text-xs flex items-center gap-1.5"
                                    disabled={exhaustedKeys === 0 || isResetting}
                                >
                                    <RefreshCw size={14} className={isResetting ? "animate-spin" : ""} />
                                    <span className="hidden sm:inline">Reset Exhausted</span>
                                </button>
                            </div>
                            {!isAdding ? (
                                <button onClick={() => setIsAdding(true)} className="btn btn-primary text-xs justify-center flex-1 sm:flex-none">
                                    <PlusCircle size={14} /> Add New Key
                                </button>
                            ) : (
                                <div className="flex-grow sm:max-w-xl animate-fade-in-up flex flex-col sm:flex-row gap-2">
                                    <input 
                                        value={newApiKey} 
                                        onChange={e => setNewApiKey(e.target.value)} 
                                        type="password" 
                                        placeholder={placeholder} 
                                        className="form-input w-full text-sm"
                                        autoFocus
                                    />
                                    <input 
                                        value={newAccountName} 
                                        onChange={e => setNewAccountName(e.target.value)} 
                                        type="text" 
                                        placeholder="Account/Email (optional)" 
                                        className="form-input w-full text-sm"
                                    />
                                    <div className="flex gap-2">
                                        <button onClick={handleAddKey} className="btn btn-primary whitespace-nowrap text-xs flex-1 sm:flex-none justify-center" disabled={isSaving || !newApiKey.trim()}>
                                            {isSaving ? 'Saving...' : 'Save'}
                                        </button>
                                        <button onClick={() => { setIsAdding(false); setNewApiKey(''); setNewAccountName(''); }} className="btn btn-secondary text-xs shrink-0 p-2">
                                            <X size={14} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </PanelCard>
            
            <ConfirmationModal
                isOpen={keyToDelete !== null}
                onClose={() => setKeyToDelete(null)}
                onConfirm={handleDeleteKey}
                title="Confirm Key Deletion"
                message={<>Are you sure you want to remove this API key ending in <strong>...{keyToDelete?.api_key.slice(-4)}</strong>? This action cannot be undone.</>}
                confirmText="Remove Key"
                confirmButtonClass="btn-danger"
            />

            <ConfirmationModal
                isOpen={isResetAllModalOpen}
                onClose={() => setIsResetAllModalOpen(false)}
                onConfirm={handleResetAllKeys}
                title="Confirm Reset All Keys"
                message={<>Are you sure you want to reset all API keys? This will reset call counts, status, and failure counts. This action cannot be undone.</>}
                confirmText="Reset All Keys"
                confirmButtonClass="btn-danger"
            />
        </div>
    );
};

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

const AiModelConfigManager: React.FC<{
    configs: NewsSystemConfig[];
    onRefresh: () => void;
}> = ({ configs, onRefresh }) => {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);
    const [isCustomEditValue, setIsCustomEditValue] = useState(false);

    const handleEdit = (config: NewsSystemConfig) => {
        setEditingId(config.id);
        const val = typeof config.config_value === 'string' ? config.config_value : JSON.stringify(config.config_value);
        setEditValue(val);
        setIsCustomEditValue(!KNOWN_MODELS.includes(val));
    };

    const handleSave = async (id: string) => {
        setIsSaving(true);
        try {
            let valueToSave: any = editValue;
            try {
                valueToSave = JSON.parse(editValue);
            } catch(e) {
                // Keep as string if it's not valid JSON
            }
            await updateNewsSystemConfig(id, valueToSave);
            setEditingId(null);
            onRefresh();
        } catch (error) {
            console.error("Failed to update config:", error);
            alert("Failed to update configuration.");
        } finally {
            setIsSaving(false);
        }
    };

    const dropdownOptions = [...KNOWN_MODELS, 'custom'];
    const dropdownLabels = KNOWN_MODELS.reduce((acc, curr) => ({ ...acc, [curr]: curr }), { 'custom': 'Custom Model...' });

    return (
        <div className="h-full">
            {/* Header */}
            <div className="mb-3">
                <h2 className="text-xl font-bold text-[var(--text-primary)]">AI Models Configuration</h2>
                <p className="text-xs text-[var(--text-secondary)]">Manage system AI models</p>
            </div>

            {/* Grid */}
            <div>
                {configs.length === 0 ? (
                    <div className="py-8 text-center text-sm text-[var(--text-secondary)] flex flex-col items-center gap-2">
                        <Cpu size={24} className="opacity-20" />
                        <p>No configurations found.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                        {configs.filter(c => c.config_key !== 'is_news_updating' && c.config_key !== 'last_run_trigger').map(config => {
                            const isEditing = editingId === config.id;
                            const displayValue = typeof config.config_value === 'string' ? config.config_value : JSON.stringify(config.config_value);
                            
                            return (
                                <div key={config.id} className={`group relative bg-[var(--card-bg)] border rounded-xl p-3 sm:p-4 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between ${isEditing ? 'z-20 border-indigo-500 ring-1 ring-indigo-500' : 'z-0 border-[var(--border-color)] hover:border-indigo-500/30'}`}>
                                    <div className="mb-2">
                                        <div className="flex items-start justify-between gap-2 mb-1">
                                            <h4 className="text-[11px] sm:text-xs font-bold text-[var(--text-primary)] truncate">
                                                {config.config_key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                            </h4>
                                            {!isEditing && (
                                                <button 
                                                    onClick={() => handleEdit(config)} 
                                                    className="text-[var(--text-secondary)] hover:text-indigo-600 dark:hover:text-indigo-400 p-0.5 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 shrink-0"
                                                    aria-label="Edit configuration"
                                                >
                                                    <Edit2 size={12} />
                                                </button>
                                            )}
                                        </div>
                                        {config.description && (
                                            <p className="text-[10px] text-[var(--text-secondary)] line-clamp-2 leading-snug">{config.description}</p>
                                        )}
                                    </div>
                                    
                                    <div className="mt-auto">
                                        {isEditing ? (
                                            <div className="flex flex-col gap-1.5 w-full min-w-0 animate-in fade-in zoom-in-95 duration-200">
                                                <div className="flex items-center gap-1 w-full">
                                                    <div className="flex-1 min-w-0">
                                                        <CustomDropdown 
                                                            options={dropdownOptions}
                                                            value={isCustomEditValue ? 'custom' : editValue}
                                                            displayLabels={dropdownLabels}
                                                            onChange={(val) => {
                                                                if (val === 'custom') {
                                                                    setIsCustomEditValue(true);
                                                                    setEditValue('');
                                                                } else {
                                                                    setIsCustomEditValue(false);
                                                                    setEditValue(val);
                                                                }
                                                            }}
                                                            triggerClassName="bg-[var(--subtle-bg)] border-[var(--border-color)] !py-0.5 !px-1.5 !text-[10px] shadow-inner !min-h-[24px] h-[26px] flex items-center"
                                                        />
                                                    </div>
                                                    <button onClick={() => handleSave(config.id)} disabled={isSaving} className="shrink-0 h-[26px] w-[26px] flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors" title="Save">
                                                        {isSaving ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} strokeWidth={3} />}
                                                    </button>
                                                    <button onClick={() => setEditingId(null)} disabled={isSaving} className="shrink-0 h-[26px] w-[26px] flex items-center justify-center bg-[var(--subtle-bg)] text-[var(--text-secondary)] hover:text-red-500 rounded border border-[var(--border-color)] transition-colors" title="Cancel">
                                                        <X size={12} strokeWidth={3} />
                                                    </button>
                                                </div>
                                                {isCustomEditValue && (
                                                    <input 
                                                        type="text" 
                                                        value={editValue} 
                                                        onChange={(e) => setEditValue(e.target.value)}
                                                        placeholder="Enter custom model"
                                                        className="w-full text-[10px] border border-[var(--border-color)] rounded px-1.5 py-1 max-h-[26px] bg-[var(--subtle-bg)] text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 shadow-inner"
                                                        autoFocus
                                                    />
                                                )}
                                            </div>
                                        ) : (
                                            <div className="inline-flex items-center bg-[var(--subtle-bg)] px-2 py-1 rounded-[4px] border border-[var(--border-color)] w-fit max-w-full">
                                                <code className="text-[10px] text-[var(--text-primary)] font-mono truncate" title={displayValue}>
                                                    {displayValue}
                                                </code>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

const AUDIO_OPTIONS = [
    '/notification.mp3',
    '/universfield-system-notification-02-352442.mp3',
    'https://actions.google.com/sounds/v1/alarms/beep_short.ogg',
    'https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg',
    'https://actions.google.com/sounds/v1/alarms/mechanical_clock_ring.ogg',
    'https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg',
    'https://actions.google.com/sounds/v1/alarms/bugle_tune.ogg',
    'custom'
];

const AUDIO_LABELS: Record<string, string> = {
    '/notification.mp3': 'Default Bell',
    '/universfield-system-notification-02-352442.mp3': 'System Ping',
    'https://actions.google.com/sounds/v1/alarms/beep_short.ogg': 'Google: Short Beep',
    'https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg': 'Google: Digital Watch',
    'https://actions.google.com/sounds/v1/alarms/mechanical_clock_ring.ogg': 'Google: Mechanical Clock',
    'https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg': 'Google: Alarm Clock',
    'https://actions.google.com/sounds/v1/alarms/bugle_tune.ogg': 'Google: Bugle Tune',
    'custom': 'Custom/Other URL...'
};

const ExpandablePath: React.FC<{ path: string }> = ({ path }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    return (
        <p 
            className={`text-[9px] sm:text-[10px] text-[var(--text-secondary)] mt-0.5 cursor-pointer hover:text-[var(--text-primary)] transition-colors break-all ${isExpanded ? '' : 'line-clamp-1'}`} 
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? '' : 'Click to expand: ' + path}
        >
            {path === '' ? 'Empty' : path}
        </p>
    );
};

const AudioSettingsManager: React.FC = () => {
    const [notifEnabled, setNotifEnabled] = useState(() => {
        const saved = localStorage.getItem('admin_audio_notifications_enabled');
        return saved !== null ? saved === 'true' : true;
    });
    const [completionEnabled, setCompletionEnabled] = useState(() => {
        const saved = localStorage.getItem('admin_audio_completion_enabled');
        return saved !== null ? saved === 'true' : true;
    });
    const [notifSound, setNotifSound] = useState(() => localStorage.getItem('admin_audio_notifications_url') || '/notification.mp3');
    const [completionSound, setCompletionSound] = useState(() => localStorage.getItem('admin_audio_completion_url') || '/universfield-system-notification-02-352442.mp3');

    const [editingNotif, setEditingNotif] = useState(false);
    const [notifInputUrl, setNotifInputUrl] = useState('');
    const [notifDropdownVal, setNotifDropdownVal] = useState('');

    const [editingCompletion, setEditingCompletion] = useState(false);
    const [compInputUrl, setCompInputUrl] = useState('');
    const [compDropdownVal, setCompDropdownVal] = useState('');

    const toggleNotif = () => {
        const newVal = !notifEnabled;
        setNotifEnabled(newVal);
        localStorage.setItem('admin_audio_notifications_enabled', String(newVal));
    };

    const toggleCompletion = () => {
        const newVal = !completionEnabled;
        setCompletionEnabled(newVal);
        localStorage.setItem('admin_audio_completion_enabled', String(newVal));
    };

    const testNotifSound = () => {
        const audio = new Audio(notifSound);
        audio.volume = 0.5;
        audio.play().catch(e => console.error("Test failed:", e));
    };

    const testCompletionSound = () => {
        const audio = new Audio(completionSound);
        audio.volume = 0.5;
        audio.play().catch(e => console.error("Test failed:", e));
    };

    const startEditingNotif = () => {
        setNotifInputUrl(notifSound);
        setNotifDropdownVal(AUDIO_OPTIONS.includes(notifSound) ? notifSound : 'custom');
        setEditingNotif(true);
    };

    const saveNotifInput = () => {
        const finalUrl = notifDropdownVal === 'custom' ? notifInputUrl.trim() : notifDropdownVal;
        if (finalUrl !== '') {
            setNotifSound(finalUrl);
            localStorage.setItem('admin_audio_notifications_url', finalUrl);
            toast.success('Notification sound saved!');
        }
        setEditingNotif(false);
    };

    const startEditingCompletion = () => {
        setCompInputUrl(completionSound);
        setCompDropdownVal(AUDIO_OPTIONS.includes(completionSound) ? completionSound : 'custom');
        setEditingCompletion(true);
    };

    const saveCompletionInput = () => {
        const finalUrl = compDropdownVal === 'custom' ? compInputUrl.trim() : compDropdownVal;
        if (finalUrl !== '') {
            setCompletionSound(finalUrl);
            localStorage.setItem('admin_audio_completion_url', finalUrl);
            toast.success('Update completion sound saved!');
        }
        setEditingCompletion(false);
    };

    return (
        <div className="h-full">
            <div className="mb-3">
                <h2 className="text-xl font-bold text-[var(--text-primary)]">Audio Preferences</h2>
                <p className="text-xs text-[var(--text-secondary)]">Manage notification sounds</p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className={`group flex flex-col justify-between p-3 sm:p-4 bg-[var(--card-bg)] rounded-xl border shadow-sm hover:shadow-md transition-all duration-200 relative ${editingNotif ? 'z-20 border-indigo-500 ring-1 ring-indigo-500' : 'z-0 border-[var(--border-color)] hover:border-indigo-500/30'}`}>
                    <div className="flex items-start gap-2 sm:gap-3 flex-1">
                        <div className={`mt-[2px] p-1.5 sm:p-2 rounded-lg transition-colors shrink-0 ${notifEnabled ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-[var(--subtle-bg)] text-[var(--text-secondary)]'}`}>
                            {notifEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                        </div>
                        <div className="min-w-0 w-full mb-2">
                            <p className="text-[11px] sm:text-xs font-bold text-[var(--text-primary)] truncate">Notification Bell</p>
                            <ExpandablePath path={notifSound} />
                        </div>
                    </div>
                    <div className="mt-auto pt-2 border-t border-[var(--border-color)]">
                        {editingNotif ? (
                            <div className="flex flex-col gap-1.5 w-full min-w-0">
                                <div className="flex items-center gap-1 w-full">
                                    <div className="flex-1 min-w-0">
                                        <CustomDropdown
                                            options={AUDIO_OPTIONS}
                                            value={notifDropdownVal}
                                            displayLabels={AUDIO_LABELS}
                                            onChange={(val) => {
                                                setNotifDropdownVal(val);
                                                if (val !== 'custom') setNotifInputUrl(val);
                                            }}
                                            triggerClassName="bg-[var(--subtle-bg)] border-[var(--border-color)] !py-0.5 !px-1.5 !text-[10px] shadow-inner !min-h-[24px] h-[26px] flex items-center"
                                        />
                                    </div>
                                    <button onClick={saveNotifInput} className="shrink-0 h-[26px] w-[26px] flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors" title="Save">
                                        <Check size={12} strokeWidth={3} />
                                    </button>
                                    <button onClick={() => setEditingNotif(false)} className="shrink-0 h-[26px] w-[26px] flex items-center justify-center bg-[var(--subtle-bg)] text-[var(--text-secondary)] hover:text-red-500 rounded border border-[var(--border-color)] transition-colors" title="Cancel">
                                        <X size={12} strokeWidth={3} />
                                    </button>
                                </div>
                                {notifDropdownVal === 'custom' && (
                                    <input 
                                        value={notifInputUrl} 
                                        onChange={e => setNotifInputUrl(e.target.value)} 
                                        className="w-full text-[10px] border border-[var(--border-color)] rounded px-1.5 py-1 max-h-[26px] bg-[var(--subtle-bg)] text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 shadow-inner" 
                                        autoFocus 
                                        placeholder="Enter generic .mp3 or .wav URL"
                                    />
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center justify-between">
                                <button 
                                    onClick={startEditingNotif}
                                    className="p-1 px-1.5 bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-[4px] text-[10px] font-semibold transition-colors flex items-center gap-1 border border-transparent"
                                >
                                    <Settings size={12} /> Change
                                </button>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={testNotifSound}
                                        className="p-1 text-[var(--text-secondary)] hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition-colors"
                                        title="Test sound"
                                    >
                                        <Music size={12} />
                                    </button>
                                    <button 
                                        onClick={toggleNotif}
                                        className={`relative inline-flex h-4 w-7 sm:h-5 sm:w-9 items-center rounded-full transition-colors focus:outline-none shadow-inner ${notifEnabled ? 'bg-indigo-600' : 'bg-[var(--border-color)]'}`}
                                    >
                                        <span className={`inline-block h-2 w-2 sm:h-3 sm:w-3 transform rounded-full bg-white shadow-sm transition-transform ${notifEnabled ? 'translate-x-3.5 sm:translate-x-5' : 'translate-x-0.5 sm:translate-x-1'}`} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className={`group flex flex-col justify-between p-3 sm:p-4 bg-[var(--card-bg)] rounded-xl border shadow-sm hover:shadow-md transition-all duration-200 relative ${editingCompletion ? 'z-20 border-indigo-500 ring-1 ring-indigo-500' : 'z-0 border-[var(--border-color)] hover:border-indigo-500/30'}`}>
                    <div className="flex items-start gap-2 sm:gap-3 flex-1">
                        <div className={`mt-[2px] p-1.5 sm:p-2 rounded-lg transition-colors shrink-0 ${completionEnabled ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-[var(--subtle-bg)] text-[var(--text-secondary)]'}`}>
                            {completionEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                        </div>
                        <div className="min-w-0 w-full mb-2">
                            <p className="text-[11px] sm:text-xs font-bold text-[var(--text-primary)] truncate">Update Completion</p>
                            <ExpandablePath path={completionSound} />
                        </div>
                    </div>
                    <div className="mt-auto pt-2 border-t border-[var(--border-color)]">
                        {editingCompletion ? (
                            <div className="flex flex-col gap-1.5 w-full min-w-0">
                                <div className="flex items-center gap-1 w-full">
                                    <div className="flex-1 min-w-0">
                                        <CustomDropdown
                                            options={AUDIO_OPTIONS}
                                            value={compDropdownVal}
                                            displayLabels={AUDIO_LABELS}
                                            onChange={(val) => {
                                                setCompDropdownVal(val);
                                                if (val !== 'custom') setCompInputUrl(val);
                                            }}
                                            triggerClassName="bg-[var(--subtle-bg)] border-[var(--border-color)] !py-0.5 !px-1.5 !text-[10px] shadow-inner !min-h-[24px] h-[26px] flex items-center"
                                        />
                                    </div>
                                    <button onClick={saveCompletionInput} className="shrink-0 h-[26px] w-[26px] flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors" title="Save">
                                        <Check size={12} strokeWidth={3} />
                                    </button>
                                    <button onClick={() => setEditingCompletion(false)} className="shrink-0 h-[26px] w-[26px] flex items-center justify-center bg-[var(--subtle-bg)] text-[var(--text-secondary)] hover:text-red-500 rounded border border-[var(--border-color)] transition-colors" title="Cancel">
                                        <X size={12} strokeWidth={3} />
                                    </button>
                                </div>
                                {compDropdownVal === 'custom' && (
                                    <input 
                                        value={compInputUrl} 
                                        onChange={e => setCompInputUrl(e.target.value)} 
                                        className="w-full text-[10px] border border-[var(--border-color)] rounded px-1.5 py-1 max-h-[26px] bg-[var(--subtle-bg)] text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 shadow-inner" 
                                        autoFocus 
                                        placeholder="Enter generic .mp3 or .wav URL"
                                    />
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center justify-between">
                                <button 
                                    onClick={startEditingCompletion}
                                    className="p-1 px-1.5 bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-[4px] text-[10px] font-semibold transition-colors flex items-center gap-1 border border-transparent"
                                >
                                    <Settings size={12} /> Change
                                </button>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={testCompletionSound}
                                        className="p-1 text-[var(--text-secondary)] hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition-colors"
                                        title="Test sound"
                                    >
                                        <Music size={12} />
                                    </button>
                                    <button 
                                        onClick={toggleCompletion}
                                        className={`relative inline-flex h-4 w-7 sm:h-5 sm:w-9 items-center rounded-full transition-colors focus:outline-none shadow-inner ${completionEnabled ? 'bg-indigo-600' : 'bg-[var(--border-color)]'}`}
                                    >
                                        <span className={`inline-block h-2 w-2 sm:h-3 sm:w-3 transform rounded-full bg-white shadow-sm transition-transform ${completionEnabled ? 'translate-x-3.5 sm:translate-x-5' : 'translate-x-0.5 sm:translate-x-1'}`} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const SystemStatusManager: React.FC<{
    configs: NewsSystemConfig[];
}> = ({ configs }) => {
    const isUpdatingConfig = configs.find(c => c.config_key === 'is_news_updating');
    const lastTriggerConfig = configs.find(c => c.config_key === 'last_run_trigger');

    const isUpdating = isUpdatingConfig?.config_value === true || isUpdatingConfig?.config_value === 'true' || isUpdatingConfig?.config_value === '"true"';
    let lastTrigger = typeof lastTriggerConfig?.config_value === 'string' 
        ? lastTriggerConfig.config_value.replace(/"/g, '') 
        : (lastTriggerConfig?.config_value ? String(lastTriggerConfig?.config_value) : 'None');
    
    if (lastTrigger === 'undefined' || !lastTrigger) lastTrigger = 'Unknown';

    return (
        <div className="h-full">
            {/* Header */}
            <div className="mb-3">
                <h2 className="text-xl font-bold text-[var(--text-primary)]">System Status</h2>
                <p className="text-xs text-[var(--text-secondary)]">Current operational state</p>
            </div>

            <div className="flex flex-col gap-3 sm:gap-4">
                {/* News Update Status */}
                <div className="group relative bg-[var(--card-bg)] border border-[var(--border-color)] hover:border-indigo-500/30 rounded-xl p-3 sm:p-4 shadow-sm hover:shadow-md transition-all duration-200">
                    <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-[11px] sm:text-xs font-bold text-[var(--text-primary)]">News Update Status</h4>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                             {isUpdating ? (
                                <>
                                    <span className="relative flex h-2 w-2">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                    </span>
                                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider">Active</span>
                                </>
                             ) : (
                                <>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-wider">Idle</span>
                                </>
                             )}
                        </div>
                    </div>
                    <div>
                         <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                             Indicates if the AI content engine is actively fetching, summarizing, and publishing new articles.
                         </p>
                    </div>
                </div>

                {/* Last Run Trigger */}
                <div className="group relative bg-[var(--card-bg)] border border-[var(--border-color)] hover:border-indigo-500/30 rounded-xl p-3 sm:p-4 shadow-sm hover:shadow-md transition-all duration-200">
                    <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-[11px] sm:text-xs font-bold text-[var(--text-primary)]">Last Run Trigger</h4>
                        <div className="shrink-0 ml-2">
                             <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${
                                 lastTrigger.toLowerCase() === 'system' ? 'bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800/50' :
                                 lastTrigger.toLowerCase() === 'manual' ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800/50' :
                                 'bg-[var(--subtle-bg)] text-[var(--text-secondary)] border-[var(--border-color)]'
                             }`}>
                                {lastTrigger}
                             </span>
                        </div>
                    </div>
                    <div>
                         <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                             Shows whether the most recent update was initiated automatically by the system schedule or manually by an admin.
                         </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

import { ApiKeyAnalytics } from './ApiKeyAnalytics';

const NewsSettings: React.FC<{ currentConfig?: any; onUpdate?: () => Promise<void> }> = () => {
    const [keys, setKeys] = useState<NewsApiKey[]>([]);
    const [configs, setConfigs] = useState<NewsSystemConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'configuration' | 'analytics'>('configuration');
    const { refreshTrigger } = useAutoRefresh();

    const fetchData = useCallback(async () => {
        try {
            const [keysRes, configsRes] = await Promise.all([
                getNewsApiKeys(),
                getNewsSystemConfigs()
            ]);
            if (keysRes.error) throw keysRes.error;
            if (configsRes.error) throw configsRes.error;
            setKeys(keysRes.data || []);
            setConfigs(configsRes.data || []);
        } catch (error) {
            console.error("Failed to fetch settings data:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [refreshTrigger, fetchData]);

    useEffect(() => {
        const configChannel = dbMain.channel('news-system-configs-settings-rt')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'news_system_config' },
                () => {
                    fetchData();
                }
            )
            .subscribe();

        const keysChannel = dbMain.channel('news-api-keys-settings-rt')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'news_api_keys' },
                () => {
                    fetchData();
                }
            )
            .subscribe();

        return () => {
            dbMain.removeChannel(configChannel);
            dbMain.removeChannel(keysChannel);
        };
    }, [fetchData]);

    if (loading) {
        return <div className="p-8 text-center text-[var(--text-secondary)]">Loading Settings...</div>;
    }

    const gnewsKeys = keys.filter(k => k.provider === 'gnews');
    const geminiKeys = keys.filter(k => k.provider === 'gemini');
    const brevoKeys = keys.filter(k => k.provider === 'brevo');

    return (
        <div className="space-y-6">
            <div className="flex border-b border-[var(--border-color)]">
                <button
                    onClick={() => setActiveTab('configuration')}
                    className={`px-4 py-2.5 text-sm font-semibold transition-colors relative ${activeTab === 'configuration' ? 'text-indigo-600 dark:text-indigo-400' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                >
                    System & Keys Config
                    {activeTab === 'configuration' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-t-full" />
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('analytics')}
                    className={`px-4 py-2.5 text-sm font-semibold transition-colors relative ${activeTab === 'analytics' ? 'text-indigo-600 dark:text-indigo-400' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                >
                    API Key Analytics
                    {activeTab === 'analytics' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-t-full" />
                    )}
                </button>
            </div>

            {activeTab === 'configuration' && (
                <div className="space-y-8 animate-in fade-in duration-300">
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                        <div className="xl:col-span-2">
                            <AiModelConfigManager configs={configs} onRefresh={fetchData} />
                        </div>
                        <div className="flex flex-col gap-8">
                            <AudioSettingsManager />
                            <SystemStatusManager configs={configs} />
                        </div>
                    </div>
                    
                    <div className="max-w-[100rem] mx-auto grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8 md:items-start">
                        <ApiKeyManager
                            title="GNews API Keys"
                            description="Keys for fetching news articles from GNews. The system will cycle through them."
                            icon={<Newspaper size={16} />}
                            provider="gnews"
                            keys={gnewsKeys}
                            onRefresh={fetchData}
                            placeholder="Enter new GNews API Key..."
                        />
                         <ApiKeyManager
                            title="Gemini API Keys"
                            description="Keys for summarizing articles with Gemini. The system will cycle through them."
                            icon={<Sparkles size={16} />}
                            provider="gemini"
                            keys={geminiKeys}
                            onRefresh={fetchData}
                            placeholder="Enter new Gemini API Key..."
                        />
                        <ApiKeyManager
                            title="Brevo API Keys"
                            description="Keys for sending email newsletters via Brevo. The system will cycle through them."
                            icon={<KeyRound size={16} />}
                            provider="brevo"
                            keys={brevoKeys}
                            onRefresh={fetchData}
                            placeholder="Enter new Brevo API Key..."
                        />
                    </div>
                </div>
            )}

            {activeTab === 'analytics' && (
                <div className="animate-in fade-in duration-300">
                    <ApiKeyAnalytics />
                </div>
            )}
        </div>
    );
};

export default NewsSettings;
