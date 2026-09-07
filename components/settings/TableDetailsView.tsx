import React, { useState } from 'react';
import { PanelCard, CopyButton } from '../ui';
import type { TableDetails } from '../../types';
import { 
    Database, Hash, ListChecks, ChevronRight, ChevronLeft, ChevronDown, MoreVertical, Trash2
} from 'lucide-react';
// New: Import the ArticleLogViewer and its type guard
import ArticleLogViewer, { isArticleData } from './ArticleLogViewer';
// New: Import the UpdateNewsLogViewer and its type guard
import UpdateNewsLogViewer, { isUpdateNewsLog } from './UpdateNewsLogViewer';
// New: Import the ActivityLogViewer
import ActivityLogViewer from './ActivityLogViewer';


// --- Row Details View (Updated Component) ---
import { JsonNode, updateNestedValue, deleteNestedValue, getNestedValue } from '../data/JsonEditor';
import CodeEditor from '../ui/CodeEditor';
import { Save, Edit2, Loader, RotateCcw } from 'lucide-react';

const ExpandableText: React.FC<{ text: string }> = ({ text }) => {
    const [expanded, setExpanded] = useState(false);
    const TRUNCATE_LENGTH = 150;
    
    if (text.length <= TRUNCATE_LENGTH) {
        return <span className="break-words whitespace-pre-wrap">{text}</span>;
    }

    return (
        <div className="space-y-1">
            <div className={`break-words whitespace-pre-wrap ${expanded ? '' : 'line-clamp-3 overflow-hidden text-ellipsis'}`}>
                {text}
            </div>
            <button 
                onClick={(e) => {
                    e.preventDefault();
                    setExpanded(!expanded);
                }} 
                className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline mt-1 focus:outline-none transition-colors"
            >
                <span>{expanded ? 'Show less' : 'Click to see in details'}</span>
                <ChevronDown size={14} className={`transform transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
        </div>
    );
};

const ExpandableJSON: React.FC<{ jsonString: string }> = ({ jsonString }) => {
    const [expanded, setExpanded] = useState(false);
    const TRUNCATE_LINES = 10;
    
    const lines = jsonString.split('\n');
    const isLong = lines.length > TRUNCATE_LINES;

    if (!isLong) {
        return (
            <div className="relative group">
                <CopyButton textToCopy={jsonString} />
                <pre className="text-xs bg-[var(--subtle-bg)] p-3 rounded-md overflow-x-auto custom-scrollbar [&::-webkit-scrollbar:horizontal]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    <code>{jsonString}</code>
                </pre>
            </div>
        );
    }

    return (
        <div className="space-y-1">
            <div className="relative group">
                <CopyButton textToCopy={jsonString} />
                <pre className={`text-xs bg-[var(--subtle-bg)] p-3 rounded-md overflow-x-auto custom-scrollbar [&::-webkit-scrollbar:horizontal]:hidden [-ms-overflow-style:none] [scrollbar-width:none] ${expanded ? '' : 'max-h-[160px] overflow-y-hidden'}`}>
                    <code>{jsonString}</code>
                </pre>
                {!expanded && (
                    <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[var(--subtle-bg)] to-transparent pointer-events-none rounded-b-md border-b border-[var(--border-color)]/20"></div>
                )}
            </div>
            <button 
                onClick={(e) => {
                    e.preventDefault();
                    setExpanded(!expanded);
                }} 
                className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline mt-1 focus:outline-none transition-colors"
            >
                <span>{expanded ? 'Show less' : 'Click to see in details'}</span>
                <ChevronDown size={14} className={`transform transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
        </div>
    );
};

const RowDetailView: React.FC<{ 
    row: any; 
    tableName: string; 
    onBack: () => void; 
    onUpdateRow?: (id: any, data: any, idColumn?: string) => Promise<void>;
    onDeleteRow?: (id: any, idColumn?: string) => Promise<void>;
}> = ({ row, tableName, onBack, onUpdateRow, onDeleteRow }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [rawMode, setRawMode] = useState(false);
    const [jsonContent, setJsonContent] = useState<any>(row);
    const [rawString, setRawString] = useState(JSON.stringify(row, null, 2));
    const [isSaving, setIsSaving] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeletingRow, setIsDeletingRow] = useState(false);

    // Reset state when row changes
    React.useEffect(() => {
        setJsonContent(row);
        setRawString(JSON.stringify(row, null, 2));
        setIsEditing(false);
        setShowDeleteConfirm(false);
    }, [row]);

    // Validation: Check if edits differ from existing state
    const hasChanges = React.useMemo(() => {
        if (rawMode) {
            try {
                const parsed = JSON.parse(rawString);
                return JSON.stringify(parsed) !== JSON.stringify(row);
            } catch {
                return true; // If JSON string is invalid, keep allowed so parser error can show on save
            }
        }
        return JSON.stringify(jsonContent) !== JSON.stringify(row);
    }, [rawMode, rawString, jsonContent, row]);

    const handleUpdate = (path: (string | number)[], value: any) => {
        setJsonContent((prev: any) => updateNestedValue(prev, path, value));
    };

    const handleDeleteNode = (path: (string | number)[]) => {
        setJsonContent((prev: any) => deleteNestedValue(prev, path));
    };

    const handleAddNode = (path: (string | number)[], value: any) => {
        const currentLevel = getNestedValue(jsonContent, path);
        if (Array.isArray(currentLevel)) {
            const newIndex = currentLevel.length;
            const newPath = [...path, newIndex];
            setJsonContent((prev: any) => updateNestedValue(prev, newPath, value));
        } else {
            console.warn("Cannot add item to non-array via this handler.");
        }
    };

    const handleSave = async () => {
        if (!onUpdateRow || !hasChanges) return;
        setIsSaving(true);
        try {
            const contentToSave = rawMode ? JSON.parse(rawString) : jsonContent;
            
            // We need to identify the row. Usually by 'id'.
            let idColumn = 'id';
            let id = row.id;
            if (!id) {
                if (row.uuid) { idColumn = 'uuid'; id = row.uuid; }
                else if (row.key) { idColumn = 'key'; id = row.key; }
            }

            if (!id) {
                alert("Cannot update row: No 'id', 'uuid', or 'key' column found.");
                setIsSaving(false);
                return;
            }

            await onUpdateRow(id, contentToSave, idColumn);
            
            if (rawMode) setJsonContent(contentToSave);
            else setRawString(JSON.stringify(contentToSave, null, 2));
            
            setIsEditing(false);
        } catch (e) {
            alert('Failed to save. Check JSON format or permissions.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleConfirmDeleteRow = async () => {
        if (!onDeleteRow) return;
        setIsDeletingRow(true);
        try {
            let idColumn = 'id';
            let id = row.id;
            if (!id) {
                if (row.uuid) { idColumn = 'uuid'; id = row.uuid; }
                else if (row.key) { idColumn = 'key'; id = row.key; }
            }

            if (!id) {
                alert("Cannot delete row: No 'id', 'uuid', or 'key' column found.");
                setIsDeletingRow(false);
                setShowDeleteConfirm(false);
                return;
            }

            await onDeleteRow(id, idColumn);
            onBack();
        } catch (e) {
            alert('Failed to delete row.');
        } finally {
            setIsDeletingRow(false);
            setShowDeleteConfirm(false);
        }
    };

    const handleCancel = () => {
        setJsonContent(row);
        setRawString(JSON.stringify(row, null, 2));
        setIsEditing(false);
    };

    if (!isEditing) {
        // New: If the table is 'update_news_logs', render the specialized viewer.
        if (tableName === 'update_news_logs' && isUpdateNewsLog(row)) {
            return (
                <div className="relative">
                    <div className="absolute top-0 right-0 z-10 flex items-center gap-1.5">
                        {showDeleteConfirm ? (
                            <div className="flex items-center gap-1.5 text-xs animate-fade-in-up">
                                {!isDeletingRow && (
                                    <>
                                        <span className="text-red-600 dark:text-red-400 font-semibold text-[11px]">Delete row?</span>
                                        <button 
                                            onClick={() => setShowDeleteConfirm(false)} 
                                            className="px-2 py-0.5 bg-slate-200 dark:bg-zinc-700 hover:bg-slate-300 text-slate-700 dark:text-zinc-200 rounded text-[11px] font-medium transition-colors cursor-pointer"
                                        >
                                            Cancel
                                        </button>
                                    </>
                                )}
                                <button 
                                    onClick={handleConfirmDeleteRow} 
                                    disabled={isDeletingRow} 
                                    className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded font-semibold text-[11px] transition-colors cursor-pointer inline-flex items-center gap-1"
                                >
                                    {isDeletingRow ? (
                                        <>
                                            <Loader size={12} className="animate-spin" />
                                            <span>Deleting...</span>
                                        </>
                                    ) : (
                                        'Confirm'
                                    )}
                                </button>
                            </div>
                        ) : (
                            <>
                                {onDeleteRow && (
                                    <button onClick={() => setShowDeleteConfirm(true)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md transition-colors cursor-pointer" title="Delete Row"><Trash2 size={18} /></button>
                                )}
                                {onUpdateRow && (
                                    <button onClick={() => setIsEditing(true)} className="p-2 text-[var(--accent-color)] hover:bg-[var(--subtle-bg)] rounded-md transition-colors cursor-pointer" title="Edit Row"><Edit2 size={18} /></button>
                                )}
                            </>
                        )}
                    </div>
                    <UpdateNewsLogViewer row={row} onBack={onBack} />
                </div>
            );
        }
        
        // New: If the table is 'public_news_articles', render the specialized viewer.
        if (tableName === 'public_news_articles' && isArticleData(row)) {
            return (
                <div className="relative">
                    <div className="absolute top-0 right-0 z-10 flex items-center gap-1.5">
                        {showDeleteConfirm ? (
                            <div className="flex items-center gap-1.5 text-xs animate-fade-in-up">
                                {!isDeletingRow && (
                                    <>
                                        <span className="text-red-600 dark:text-red-400 font-semibold text-[11px]">Delete row?</span>
                                        <button 
                                            onClick={() => setShowDeleteConfirm(false)} 
                                            className="px-2 py-0.5 bg-slate-200 dark:bg-zinc-700 hover:bg-slate-300 text-slate-700 dark:text-zinc-200 rounded text-[11px] font-medium transition-colors cursor-pointer"
                                        >
                                            Cancel
                                        </button>
                                    </>
                                )}
                                <button 
                                    onClick={handleConfirmDeleteRow} 
                                    disabled={isDeletingRow} 
                                    className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded font-semibold text-[11px] transition-colors cursor-pointer inline-flex items-center gap-1"
                                >
                                    {isDeletingRow ? (
                                        <>
                                            <Loader size={12} className="animate-spin" />
                                            <span>Deleting...</span>
                                        </>
                                    ) : (
                                        'Confirm'
                                    )}
                                </button>
                            </div>
                        ) : (
                            <>
                                {onDeleteRow && (
                                    <button onClick={() => setShowDeleteConfirm(true)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md transition-colors cursor-pointer" title="Delete Row"><Trash2 size={18} /></button>
                                )}
                                {onUpdateRow && (
                                    <button onClick={() => setIsEditing(true)} className="p-2 text-[var(--accent-color)] hover:bg-[var(--subtle-bg)] rounded-md transition-colors cursor-pointer" title="Edit Row"><Edit2 size={18} /></button>
                                )}
                            </>
                        )}
                    </div>
                    <ArticleLogViewer row={row} onBack={onBack} />
                </div>
            );
        }
        
        // New: If the table is 'activity_logs', render the specialized viewer.
        if (tableName === 'activity_logs') {
            return (
                <div>
                    <div className="mb-3 sm:mb-4 flex items-center justify-between gap-2 w-full">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <button 
                                onClick={onBack} 
                                className="p-1 -ml-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors shrink-0 cursor-pointer bg-transparent border-0 outline-none shadow-none focus:outline-none"
                                title="Back"
                                aria-label="Back"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <h3 id="row-detail-header" className="text-sm sm:text-base font-semibold font-mono text-[var(--text-primary)] truncate min-w-0">
                                {tableName}
                            </h3>
                        </div>
                        <div className="shrink-0 flex items-center gap-1.5">
                            {!isEditing && (
                                <div className="flex items-center gap-1.5">
                                    {showDeleteConfirm ? (
                                        <div className="flex items-center gap-1.5 text-xs animate-fade-in-up">
                                            {!isDeletingRow && (
                                                <>
                                                    <span className="text-red-600 dark:text-red-400 font-semibold text-[11px] sm:text-xs">Delete row?</span>
                                                    <button 
                                                        onClick={() => setShowDeleteConfirm(false)} 
                                                        className="px-2.5 py-0.5 bg-slate-200 dark:bg-zinc-700 hover:bg-slate-300 text-slate-700 dark:text-zinc-200 rounded text-[11px] font-medium transition-colors cursor-pointer"
                                                    >
                                                        Cancel
                                                    </button>
                                                </>
                                            )}
                                            <button 
                                                onClick={handleConfirmDeleteRow} 
                                                disabled={isDeletingRow} 
                                                className="px-2.5 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded font-semibold text-[11px] transition-colors cursor-pointer inline-flex items-center gap-1"
                                            >
                                                {isDeletingRow ? (
                                                    <>
                                                        <Loader size={12} className="animate-spin" />
                                                        <span>Deleting...</span>
                                                    </>
                                                ) : (
                                                    'Confirm'
                                                )}
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            {onDeleteRow && (
                                                <button 
                                                    onClick={() => setShowDeleteConfirm(true)} 
                                                    className="p-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md transition-colors cursor-pointer" 
                                                    title="Delete Row"
                                                    aria-label="Delete Row"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                            {onUpdateRow && (
                                                <button 
                                                    onClick={() => setIsEditing(true)} 
                                                    className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--accent-color)] hover:bg-[var(--subtle-bg)] rounded-md transition-colors cursor-pointer" 
                                                    title="Edit Row"
                                                    aria-label="Edit Row"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    <ActivityLogViewer row={row} onBack={onBack} hideHeader={true} />
                </div>
            );
        }
    }

    // Fallback to the generic viewer for all other tables.
    const renderValue = (value: any) => {
        if (value === null || value === undefined) {
            return <span className="text-[var(--text-secondary)] opacity-70">NULL</span>;
        }
        if (typeof value === 'object') {
            const jsonString = JSON.stringify(value, null, 2);
            return <ExpandableJSON jsonString={jsonString} />;
        }
        if (typeof value === 'boolean') {
            return <span className={`font-semibold ${value ? 'text-green-600' : 'text-red-600'}`}>{String(value)}</span>;
        }
        if (typeof value === 'string') {
            return <ExpandableText text={value} />;
        }
        return String(value);
    };

    return (
        <div>
            <div className="mb-3 sm:mb-4 flex items-center justify-between gap-2 w-full">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <button 
                        onClick={onBack} 
                        className="p-1 -ml-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors shrink-0 cursor-pointer bg-transparent border-0 outline-none shadow-none focus:outline-none"
                        title="Back"
                        aria-label="Back"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <h3 id="row-detail-header" className="text-sm sm:text-base font-semibold font-mono text-[var(--text-primary)] truncate min-w-0">
                        {tableName}
                    </h3>
                </div>
                <div className="shrink-0 flex items-center gap-1.5">
                    {!isEditing && (
                        <div className="flex items-center gap-1.5">
                            {showDeleteConfirm ? (
                                <div className="flex items-center gap-1.5 text-xs animate-fade-in-up">
                                    {!isDeletingRow && (
                                        <>
                                            <span className="text-red-600 dark:text-red-400 font-semibold text-[11px] sm:text-xs">Delete row?</span>
                                            <button 
                                                onClick={() => setShowDeleteConfirm(false)} 
                                                className="px-2.5 py-0.5 bg-slate-200 dark:bg-zinc-700 hover:bg-slate-300 text-slate-700 dark:text-zinc-200 rounded text-[11px] font-medium transition-colors cursor-pointer"
                                            >
                                                Cancel
                                            </button>
                                        </>
                                    )}
                                    <button 
                                        onClick={handleConfirmDeleteRow} 
                                        disabled={isDeletingRow} 
                                        className={`px-2.5 py-0.5 rounded font-semibold text-[11px] transition-colors inline-flex items-center gap-1 ${
                                            isDeletingRow 
                                                ? 'bg-red-400 dark:bg-red-800/60 text-white/80 cursor-not-allowed' 
                                                : 'bg-red-600 hover:bg-red-700 text-white cursor-pointer'
                                        }`}
                                    >
                                        {isDeletingRow ? (
                                            <>
                                                <Loader size={12} className="animate-spin" />
                                                <span>Deleting...</span>
                                            </>
                                        ) : (
                                            'Confirm'
                                        )}
                                    </button>
                                </div>
                            ) : (
                                <>
                                    {onDeleteRow && (
                                        <button 
                                            onClick={() => setShowDeleteConfirm(true)} 
                                            className="p-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md transition-colors cursor-pointer" 
                                            title="Delete Row"
                                            aria-label="Delete Row"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                    {onUpdateRow && (
                                        <button 
                                            onClick={() => setIsEditing(true)} 
                                            className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--accent-color)] hover:bg-[var(--subtle-bg)] rounded-md transition-colors cursor-pointer" 
                                            title="Edit Row"
                                            aria-label="Edit Row"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                    {isEditing && (
                        <div className="flex items-center gap-1.5">
                            <button onClick={handleCancel} className="btn btn-secondary px-2 py-1 text-xs" disabled={isSaving}>
                                <RotateCcw size={14} />
                                <span className="hidden sm:inline">Cancel</span>
                            </button>
                            <button 
                                onClick={handleSave} 
                                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all duration-200 inline-flex items-center gap-1.5 ${
                                    hasChanges && !isSaving
                                        ? 'bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-md shadow-emerald-500/20 cursor-pointer font-bold'
                                        : 'bg-slate-200 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 border border-slate-300 dark:border-zinc-700/80 opacity-60 cursor-not-allowed'
                                }`} 
                                disabled={!hasChanges || isSaving}
                                title={!hasChanges ? "No changes to save" : "Save changes"}
                            >
                                {isSaving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
                                <span>{isSaving ? 'Saving...' : 'Save'}</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {isEditing ? (
                <div className="space-y-4">
                    {/* Raw vs Visual Toggle */}
                    <div className="flex items-center justify-between mb-4 pb-4 border-b border-[var(--border-color)]">
                        <h4 className="text-sm font-semibold text-[var(--text-primary)]">Edit Row Data</h4>
                        <div className="flex bg-[var(--subtle-bg)] rounded-sm p-0.5 border border-[var(--border-color)]/60 shrink-0">
                            <button
                                onClick={() => setRawMode(false)}
                                className={`px-3 py-1 text-[10px] sm:text-[11px] rounded-[3px] transition-all duration-200 ${!rawMode ? 'bg-[var(--success)] text-white shadow-sm font-bold' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                            >
                                Visual
                            </button>
                            <button
                                onClick={() => setRawMode(true)}
                                className={`px-3 py-1 text-[10px] sm:text-[11px] rounded-[3px] transition-all duration-200 ${rawMode ? 'bg-[var(--success)] text-white shadow-sm font-bold' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                            >
                                Raw
                            </button>
                        </div>
                    </div>

                    {/* Editor Surface */}
                    <div className="overflow-hidden">
                        {rawMode ? (
                            <div className="overflow-hidden">
                                <CodeEditor
                                    value={rawString}
                                    onChange={(val) => setRawString(val || '')}
                                    language="json"
                                    height="auto"
                                />
                            </div>
                        ) : (
                            <div className="overflow-x-auto pb-4">
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
                <div className="space-y-1 sm:space-y-1.5">
                    {Object.entries(row).map(([key, value]) => {
                        return (
                            <div key={key} className="flex flex-col md:grid md:grid-cols-3 gap-1 md:gap-2 py-1.5 sm:py-2 border-b border-[var(--border-color)] last:border-b-0">
                                <div className="font-mono text-xs font-semibold text-[var(--text-secondary)] break-all">{key}</div>
                                <div className="md:col-span-2 text-xs sm:text-sm text-[var(--text-primary)] break-words">
                                   {renderValue(value)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};


const formatTimeAgo = (dateString: string | null | undefined): string => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    const years = Math.floor(months / 12);
    return `${years}y ago`;
};

const TableDetailsView = React.forwardRef<HTMLDivElement, { 
    details: TableDetails; 
    description: string; 
    onLoadMore?: () => void; 
    onUpdateRow?: (id: any, data: any, idColumn?: string) => Promise<void>;
    onDeleteRow?: (id: any, idColumn?: string) => Promise<void>;
    onOpenOptions?: (tableName: string, anchorEl: HTMLElement) => void;
}>(
    ({ details, description, onLoadMore, onUpdateRow, onDeleteRow, onOpenOptions }, ref) => {
        const [selectedRow, setSelectedRow] = useState<any | null>(null);
        const [lastClickedRowIndex, setLastClickedRowIndex] = useState<number | null>(null);
        const [focusedColumn, setFocusedColumn] = useState<string | null>(null);
        const headerRef = React.useRef<HTMLDivElement>(null);
        const scrollPosRef = React.useRef<number>(0);

        // Derive live updated row from details.recentRows to ensure real-time UI updates
        const activeRow = React.useMemo(() => {
            if (!selectedRow) return null;
            let idCol = 'id';
            if (!selectedRow.id) {
                if (selectedRow.uuid) idCol = 'uuid';
                else if (selectedRow.key) idCol = 'key';
            }
            const currentInDetails = details.recentRows.find(r => r[idCol] === selectedRow[idCol]);
            return currentInDetails || selectedRow;
        }, [selectedRow, details.recentRows]);

        const handleRowClick = (row: any, index: number) => {
            const mainEl = document.querySelector('main');
            if (mainEl) {
                scrollPosRef.current = mainEl.scrollTop;
            }
            setLastClickedRowIndex(index);
            setSelectedRow(row);
        };

        const handleBack = () => {
            setSelectedRow(null);
            setTimeout(() => {
                const mainEl = document.querySelector('main');
                if (mainEl) {
                    mainEl.scrollTop = scrollPosRef.current;
                }
            }, 0);
        };

        const handleRowScroll = (e: React.UIEvent<HTMLDivElement>) => {
            if (headerRef.current) {
                headerRef.current.scrollLeft = e.currentTarget.scrollLeft;
            }
        };

        const renderCellContent = (content: any, columnName: string) => {
            if (content === null || content === undefined) {
                return <span className="text-[var(--text-secondary)] opacity-70">NULL</span>;
            }
            // New: Better preview for article data columns
            if (columnName === 'article_data' && typeof content === 'object' && content?.title) {
                 return <span className="text-blue-600 dark:text-blue-400 font-mono text-xs truncate">[Article: {content.title}]</span>
            }
            if (columnName === 'formatted_content_md' && typeof content === 'object' && content?.markdown) {
                return <span className="text-purple-600 dark:text-purple-400 font-mono text-xs">[Formatted MD]</span>
            }
            // New: Preview for update_news_logs
            if (columnName === 'summary' && Array.isArray(content) && content.length > 0 && typeof content[0] === 'string' && content[0].startsWith('Start Time:')) {
                return <span className="text-purple-600 dark:text-purple-400 font-mono text-xs">[Log Summary]</span>
            }
            if (columnName === 'details' && typeof content === 'string' && content.includes('[INFO]')) {
                return <span className="text-purple-600 dark:text-purple-400 font-mono text-xs">[Log Details]</span>
            }
            if ((columnName === 'old_data' || columnName === 'new_data') && typeof content === 'object' && content !== null) {
                return <span className="text-emerald-600 dark:text-emerald-400 font-mono text-xs">[Event Data]</span>
            }
            if (typeof content === 'object') {
                return <span className="accent-text font-mono text-xs">[Object]</span>;
            }
            if (typeof content === 'boolean') {
                return String(content);
            }
            return String(content);
        };

        return (
            <div ref={ref}>
                {activeRow && (
                    <PanelCard className="mx-[-12px] sm:mx-[-16px] md:mx-0 rounded-none md:rounded-lg border-x-0 md:border-x">
                        <RowDetailView 
                            row={activeRow} 
                            tableName={details.tableName} 
                            onBack={handleBack} 
                            onUpdateRow={onUpdateRow}
                            onDeleteRow={onDeleteRow}
                        />
                    </PanelCard>
                )}

                {/* Default view with table stats and preview */}
                <PanelCard className={`overflow-clip mx-[-12px] sm:mx-[-16px] md:mx-0 rounded-none md:rounded-lg border-x-0 md:border-x ${activeRow ? 'hidden' : ''}`}>
                    <div className="flex items-center justify-between mb-3">
                        <div className="min-w-0 flex-1">
                            <h2 id="table-details-header" className="text-sm sm:text-base font-bold text-[var(--text-primary)] font-mono flex items-center gap-2 truncate">
                                <Database size={16} className="text-[var(--accent-color)] shrink-0" />
                                <span className="truncate">{details.tableName}</span>
                            </h2>
                            {description && <p className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">{description}</p>}
                        </div>
                        {onOpenOptions && (
                            <button
                                onClick={(e) => onOpenOptions(details.tableName, e.currentTarget)}
                                className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--subtle-bg)] rounded-md transition-colors cursor-pointer shrink-0 ml-2"
                                title={`Options for ${details.tableName}`}
                                aria-label={`Options for ${details.tableName}`}
                            >
                                <MoreVertical size={16} />
                            </button>
                        )}
                    </div>

                    {/* Containerless stats equally distributed across full row */}
                    <div className="grid grid-cols-3 w-full py-2.5 mb-3 border-y border-[var(--border-color)]">
                        <div className="flex flex-col items-center justify-center text-center px-2">
                            <span className="text-[10px] sm:text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Rows</span>
                            <span className="text-sm sm:text-base font-bold text-[var(--stat-icon-1-fg)] font-mono mt-0.5">{(details.rowCount ?? 0).toLocaleString()}</span>
                        </div>
                        <div className="flex flex-col items-center justify-center text-center px-2 border-x border-[var(--border-color)]">
                            <span className="text-[10px] sm:text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Cols</span>
                            <span className="text-sm sm:text-base font-bold text-[var(--stat-icon-2-fg)] font-mono mt-0.5">{details.columns.length}</span>
                        </div>
                        <div className="flex flex-col items-center justify-center text-center px-2 cursor-help" title={details.lastUsed ? new Date(details.lastUsed).toLocaleString() : 'Never'}>
                            <span className="text-[10px] sm:text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Last Used</span>
                            <span className="text-xs sm:text-sm font-semibold text-indigo-500 font-mono mt-0.5">{formatTimeAgo(details.lastUsed)}</span>
                        </div>
                    </div>

                    <div className="mb-3">
                        <h3 className="font-semibold text-xs sm:text-sm text-[var(--text-primary)] mb-1.5">Columns ({details.columns.length})</h3>
                        {details.columns.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                                {details.columns.map(col => (
                                    <span key={col} className="font-mono text-[11px] bg-[var(--subtle-bg)] text-[var(--text-primary)] px-2 py-0.5 rounded border border-[var(--border-color)]">
                                        {col}
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-[var(--text-secondary)]">No columns found. The table might be empty.</p>
                        )}
                    </div>

                    <div className="-mx-3 -mb-3">
                        <h3 className="font-semibold text-xs sm:text-sm text-[var(--text-primary)] mb-2 px-3">Recent Rows Preview</h3>
                             {details.recentRows.length > 0 ? (
                                <div className="flex flex-col overflow-clip table-details-manager-wrapper">
                                    {/* Header Row */}
                                    <div 
                                        ref={headerRef}
                                        className="flex items-center py-2 px-3 bg-[var(--card-bg)] border-y border-[var(--border-color)] overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                                    >
                                        {details.columns.map((col) => {
                                            const isFocused = focusedColumn === col;
                                            return (
                                                <div 
                                                    key={col} 
                                                    className={`cursor-pointer transition-colors font-mono text-xs w-48 shrink-0 pr-4 truncate ${isFocused ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-[var(--text-secondary)] font-semibold hover:text-[var(--text-primary)] hover:bg-[var(--sidebar-hover-bg)] rounded'}`}
                                                    title={`Click to focus column: ${col}`}
                                                    onClick={(e) => {
                                                        const target = e.currentTarget;
                                                        const container = headerRef.current;
                                                        if (!container) return;
                                                        
                                                        setFocusedColumn(col);
                                                        const scrollTarget = target.offsetLeft - 12; // 12px for padding
                                                        
                                                        container.scrollTo({ left: scrollTarget, behavior: 'smooth' });
                                                        
                                                        const managerWrapper = container.closest('.table-details-manager-wrapper');
                                                        if (managerWrapper) {
                                                            const rows = managerWrapper.querySelectorAll('.table-details-row-scroll-container');
                                                            rows.forEach(row => {
                                                                row.scrollTo({ left: scrollTarget, behavior: 'smooth' });
                                                            });
                                                        }
                                                    }}
                                                >
                                                    {col}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    
                                    {/* Data Rows */}
                                    <div className="flex flex-col">
                                        {details.recentRows.map((row, rowIndex) => (
                                            <div 
                                                key={rowIndex} 
                                                id={`details-row-${rowIndex}`}
                                                className={`relative border-b border-[var(--border-color)] last:border-b-0 transition-colors cursor-pointer group ${
                                                    lastClickedRowIndex === rowIndex 
                                                        ? 'bg-indigo-50 dark:bg-indigo-900/30 ring-1 ring-indigo-500/50 z-10' 
                                                        : 'hover:bg-[var(--subtle-bg)]'
                                                }`}
                                                onClick={() => handleRowClick(row, rowIndex)}
                                            >
                                                <div 
                                                    className="table-details-row-scroll-container flex items-center py-2 px-3 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] pr-12"
                                                    onScroll={handleRowScroll}
                                                >
                                                    {details.columns.map(col => {
                                                        const cellValue = row[col];
                                                        const isFocused = focusedColumn === col;
                                                        return (
                                                            <div key={`${rowIndex}-${col}`} className={`font-mono text-xs text-left w-48 shrink-0 pr-4 ${isFocused ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-[var(--text-primary)]'}`}>
                                                                <div className="truncate">
                                                                    {renderCellContent(cellValue, col)}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                <div className="absolute right-0 top-0 bottom-0 flex justify-end items-center w-24 bg-gradient-to-l from-[var(--card-bg)] from-40% to-transparent group-hover:from-[var(--subtle-bg)] transition-colors pr-3 pointer-events-none z-10">
                                                    <ChevronRight size={16} className="text-[var(--text-secondary)] opacity-70 transition-transform group-hover:translate-x-1" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    
                                    {/* Footer / Load More */}
                                    <div className="p-2.5 px-3 border-t border-[var(--border-color)] flex items-center justify-between">
                                        <div>
                                            {onLoadMore && details.recentRows.length < details.rowCount && (
                                                <button 
                                                    onClick={onLoadMore}
                                                    className="btn btn-secondary px-2.5 py-1 text-xs"
                                                >
                                                    Load Older
                                                </button>
                                            )}
                                        </div>
                                        <div className="text-xs text-[var(--text-secondary)]">
                                            Showing <span className="font-medium text-[var(--text-primary)]">{details.recentRows.length}</span> of <span className="font-medium text-[var(--text-primary)]">{(details.rowCount ?? 0).toLocaleString()}</span> rows
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8 mx-3 mb-3 border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-lg">
                                    <p className="font-medium text-[var(--text-secondary)]">This table is currently empty.</p>
                                </div>
                            )}
                    </div>

                </PanelCard>
            </div>
        );
    }
);
TableDetailsView.displayName = 'TableDetailsView';

export default TableDetailsView;