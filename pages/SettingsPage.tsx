
/// <reference types="vite/client" />
import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useParams, useNavigate } from 'react-router-dom';
import { PanelCard, ConfirmationModal, ActionPopover } from '../components/ui';
import { resetTableSequence, resetTableData, fetchTableDetails, fetchAllTables, updateTableRow, dropTable } from '../services/dataManagementService';
import { fetchDatabaseAnalytics } from '../services/supabaseService';
import type { TableDetails, DatabaseAnalyticsStats } from '../types';
import TableDetailsView from '../components/settings/TableDetailsView';
import { Database, AlertTriangle, RefreshCw, Trash2, Table, MoreVertical, Info } from 'lucide-react';
import ReactDOM from 'react-dom';
import DatabaseAnalyticsCard from '../components/settings/DatabaseAnalyticsCard';
import PlatformSettingsView from '../components/settings/PlatformSettingsView';
import { useAutoRefresh } from '../components/AutoRefreshContext';

interface TableInfo {
    name: string;
    description: string;
    disableSequenceReset?: boolean;
    has_sequence?: boolean;
}

interface DatabaseGroup {
    dbName: 'Main App';
    tables: TableInfo[];
}

const databases: DatabaseGroup[] = [
    {
        dbName: 'Main App',
        tables: [
            { name: 'article_conversations', description: "Links conversations to specific news articles that were discussed.", disableSequenceReset: true },
            { name: 'conversations', description: "Primary storage for all user conversations with the AI.", disableSequenceReset: true },
            { name: 'profiles', description: "Core user profile information, linked to authentication.", disableSequenceReset: true },
            { name: 'public_article_cache', description: "Stores cached article content to speed up retrieval.", disableSequenceReset: true },
            { name: 'public_content', description: "General-purpose public content for the application." },
            { name: 'public_news_articles', description: "The main table for all published and user-visible news articles." },
            { name: 'update_news_config', description: "Configuration for the news update function.", disableSequenceReset: true },
            { name: 'update_news_logs', description: "Logs for the periodic 'update_news' function runs." },
            { name: 'user_article_interactions', description: "Tracks user likes, views, and bookmarks on news articles.", disableSequenceReset: true },
            { name: 'user_settings', description: "Contains individual user preferences and configurations.", disableSequenceReset: true },
        ]
    }
];

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

const SettingsPage: React.FC = () => {
    const location = useLocation();
    const { tableName } = useParams();
    const navigate = useNavigate();
    const selectedTable = tableName || 'profiles';
    
    const setSelectedTable = (t: string) => {
        const currentHash = location.hash;
        navigate(`/settings/${t}${currentHash}`);
    };
    
    const [view, setView] = useState('db');
    const [modal, setModal] = useState<{ type: 'sequence' | 'data' | 'drop' | null; tableName: string | null }>({ type: null, tableName: null });
    const [isLoading, setIsLoading] = useState(false);
    const [confirmationInput, setConfirmationInput] = useState('');
    const [passwordInput, setPasswordInput] = useState('');
    const [dropTableStep, setDropTableStep] = useState<1 | 2>(1);
    const [activePopover, setActivePopover] = useState<{ tableName: string; anchorEl: HTMLElement } | null>(null);
    const [tableDetails, setTableDetails] = useState<TableDetails | null>(null);
    const [isFetchingDetails, setIsFetchingDetails] = useState(false);
    
    const [dynamicTables, setDynamicTables] = useState<TableInfo[]>(databases[0].tables);
    const [dbAnalytics, setDbAnalytics] = useState<DatabaseAnalyticsStats[]>([]);
    const [isLoadingTables, setIsLoadingTables] = useState(true);
    const [tableFetchError, setTableFetchError] = useState<string | null>(null);
    const { refreshTrigger } = useAutoRefresh();
    const prevRefreshTriggerTablesRef = useRef(refreshTrigger);
    const prevRefreshTriggerDetailsRef = useRef(refreshTrigger);

    useEffect(() => {
        localStorage.setItem('ceaznet-settings-selected-table', selectedTable);
    }, [selectedTable]);
    
    // Refs for the connecting line
    const selectedTableRef = useRef<HTMLDivElement>(null);
    const tableListContainerRef = useRef<HTMLDivElement>(null);
    const detailsContainerRef = useRef<HTMLDivElement>(null);
    // Ref for the SVG path elements to update them imperatively, avoiding React re-renders on scroll.
    const headerLinePathRef = useRef<SVGPathElement>(null);
    const rowLinesGroupRef = useRef<SVGGElement>(null);

    const allTables = dynamicTables.map(t => ({ ...t, dbName: 'Main App' }));
    const selectedTableInfo = allTables.find(t => t.name === selectedTable);

    useEffect(() => {
        async function loadTables(isAutoRefresh = false) {
            if (dynamicTables.length === 0 && !isAutoRefresh) {
                setIsLoadingTables(true);
            }
            const [{ data, error }, analyticsData] = await Promise.all([
                fetchAllTables(),
                fetchDatabaseAnalytics()
            ]);
            
            setDbAnalytics(analyticsData);

            if (error) {
                setTableFetchError(error.message || 'Failed to fetch tables');
                setDynamicTables(databases[0].tables);
            } else if (data) {
                const predefinedMap = new Map(databases[0].tables.map(t => [t.name, t]));
                const mergedTables = data.map(tableObj => {
                    const predefined = predefinedMap.get(tableObj.name);
                    if (predefined) {
                        return { ...predefined, has_sequence: tableObj.has_sequence };
                    }
                    return { name: tableObj.name, description: 'Dynamically fetched table.', has_sequence: tableObj.has_sequence };
                });
                
                mergedTables.sort((a, b) => a.name.localeCompare(b.name));
                setDynamicTables(mergedTables);
                setTableFetchError(null);
            }
            if (!isAutoRefresh) setIsLoadingTables(false);
        }
        const isAutoRefresh = prevRefreshTriggerTablesRef.current !== refreshTrigger;
        loadTables(isAutoRefresh);
        prevRefreshTriggerTablesRef.current = refreshTrigger;
    }, [refreshTrigger]);

    // Handle hash routing
    useEffect(() => {
        const hash = location.hash.replace('#', '');
        if (['db', 'db_analytics', 'platform'].includes(hash)) {
            setView(hash);
            localStorage.setItem('ceaznet-settings-last-view', hash);
        } else {
            const lastView = localStorage.getItem('ceaznet-settings-last-view') || 'db';
            setView(lastView);
            // Optionally update the URL to reflect the restored view
            if (lastView !== 'db') {
                window.history.replaceState(null, '', `#${lastView}`);
            }
        }
    }, [location.hash]);
    
    // Effect to calculate and draw the connecting line
    useEffect(() => {
        // No-op to avoid SVGs rendering
    }, [selectedTable, tableDetails, isFetchingDetails, view]);


    const getDetails = async (isAutoRefresh = false) => {
        if (!selectedTableInfo) return;
        if (!isAutoRefresh) {
            setIsFetchingDetails(true);
            setTableDetails(null); 
        }
        const { data, error } = await fetchTableDetails(selectedTableInfo.name);
        if (error) {
            console.error(`Failed to fetch details for ${selectedTableInfo.name}`, error);
            if (!isAutoRefresh) alert(`Could not load details for table: ${selectedTableInfo.name}`);
        } else {
            const analytics = dbAnalytics.find(a => a.table_name === selectedTableInfo.name);
            setTableDetails(data ? { ...data, lastUsed: analytics?.last_used || null } : null);
        }
        if (!isAutoRefresh) {
            setIsFetchingDetails(false);
        }
    };

    useEffect(() => {
        if (view !== 'db' || !selectedTableInfo) {
            setTableDetails(null);
            return;
        }
        const isAutoRefresh = prevRefreshTriggerDetailsRef.current !== refreshTrigger;
        getDetails(isAutoRefresh);
        prevRefreshTriggerDetailsRef.current = refreshTrigger;
    }, [selectedTable, view, refreshTrigger, selectedTableInfo?.name]);
    
    const handleLoadMore = async () => {
        if (!selectedTableInfo || !tableDetails) return;
        const currentOffset = tableDetails.recentRows.length;
        const { data, error } = await fetchTableDetails(selectedTableInfo.name, 30, currentOffset);
        if (data) {
            setTableDetails(prev => prev ? {
                ...prev,
                recentRows: [...prev.recentRows, ...data.recentRows]
            } : data);
        } else if (error) {
            console.error("Failed to load more rows:", error);
            alert("Failed to load more rows: " + error.message);
        }
    };

    const handleUpdateRow = async (id: any, updatedData: any, idColumn: string = 'id') => {
        if (!selectedTableInfo) return;
        const { error } = await updateTableRow(selectedTableInfo.name, id, updatedData, idColumn);
        if (error) {
            console.error("Failed to update row:", error);
            throw error;
        }
        // Update local state
        setTableDetails(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                recentRows: prev.recentRows.map(row => {
                    const rowId = row[idColumn];
                    return rowId === id ? { ...row, ...updatedData } : row;
                })
            };
        });
    };
    
    const handleResetSequenceClick = (tableName: string) => {
        setModal({ type: 'sequence', tableName });
    };

    const handleResetDataClick = (tableName: string) => {
        setModal({ type: 'data', tableName });
        setConfirmationInput('');
    };

    const handleDropTableClick = (tableName: string) => {
        setModal({ type: 'drop', tableName });
        setConfirmationInput('');
        setPasswordInput('');
        setDropTableStep(1);
    };
    
    const closeModal = () => {
        setModal({ type: null, tableName: null });
        setConfirmationInput('');
        setPasswordInput('');
        setDropTableStep(1);
    };

    const handleConfirmReset = async () => {
        if (!modal.tableName || !selectedTableInfo) return;
        
        if (modal.type === 'drop' && dropTableStep === 1) {
            setDropTableStep(2);
            return;
        }

        if (modal.type === 'drop' && dropTableStep === 2) {
            const expectedPassword = import.meta.env.VITE_ADMIN_ACTION_PASSWORD;
            // Only enforce password check in production
            if (!import.meta.env.DEV && expectedPassword && passwordInput !== expectedPassword) {
                alert("Incorrect password.");
                return;
            }
        }
        
        setIsLoading(true);
        try {
            let error;

            if (modal.type === 'sequence') {
                ({ error } = await resetTableSequence(modal.tableName));
            } else if (modal.type === 'data') {
                ({ error } = await resetTableData(modal.tableName));
            } else if (modal.type === 'drop') {
                ({ error } = await dropTable(modal.tableName));
            }

            if (error) throw error;
            
            if (modal.type === 'sequence') {
                alert(`Success! The ID sequence for '${modal.tableName}' has been reset. The next entry will start from 1.`);
            } else if (modal.type === 'data') {
                alert(`Success! ALL data from '${modal.tableName}' has been permanently deleted.`);
            } else if (modal.type === 'drop') {
                alert(`Success! Table '${modal.tableName}' has been dropped.`);
                if (selectedTable === modal.tableName) {
                    setSelectedTable('profiles');
                }
                // Refresh tables list
                const { data } = await fetchAllTables();
                if (data) {
                    setDynamicTables(prev => prev.filter(t => data.some(d => d.name === t.name)));
                }
            }

            if (selectedTable === modal.tableName && modal.type !== 'drop') {
                getDetails();
            }
        } catch (error: any) {
            console.error(`Failed to perform ${modal.type} reset for ${modal.tableName}:`, error);
            // FIX: Provide a more detailed and helpful error message in the alert.
            let errorMessage = `Failed to perform ${modal.type} action for '${modal.tableName}'.`;
            if (error.message) {
                errorMessage += `\n\nError: ${error.message}`;
            }
            if (error.details) {
                errorMessage += `\nDetails: ${error.details}`;
            }
            if (error.code === '42501' || (error.message && error.message.includes('permission denied'))) {
                const functionName = modal.type === 'data' ? `admin_truncate_table` : modal.type === 'drop' ? 'admin_drop_table' : `admin_reset_sequence`;
                errorMessage += `\n\nHint: This is a permission error (403 Forbidden). The database is blocking the request.\n\nTo fix this, please run the GRANT command for the '${functionName}' function in your Supabase SQL Editor.`;
            } else if (error.code === 'PGRST202') {
                const functionName = modal.type === 'data' ? `admin_truncate_table` : modal.type === 'drop' ? 'admin_drop_table' : `admin_reset_sequence`;
                errorMessage += `\n\nHint: The required database function '${functionName}' is missing. Please run the provided SQL script in your Supabase SQL Editor to create it.`;
                if (modal.type === 'drop') {
                    errorMessage += `\n\nSQL to create admin_drop_table:\nCREATE OR REPLACE FUNCTION admin_drop_table(target_table_name text)\nRETURNS void\nLANGUAGE plpgsql SECURITY DEFINER AS $$\nBEGIN\n  EXECUTE format('DROP TABLE IF EXISTS %I CASCADE', target_table_name);\nEND; $$;`;
                }
            } else {
                errorMessage += `\n\nHint: Please check the browser console for the full error object. This could be a network issue or a problem with the Supabase function itself.`;
            }
            alert(errorMessage);
        } finally {
            setIsLoading(false);
            closeModal();
        }
    };
    
    const renderDbManagementView = () => (
        <>
            <div className="flex flex-col md:flex-row gap-4">
                {/* --- Left Sidebar: Database Navigator --- */}
                <aside className="w-full md:w-1/3 lg:w-1/4 xl:w-1/5 shrink-0">
                    <div ref={tableListContainerRef} className="p-3 rounded-lg bg-[var(--card-bg)] border border-[var(--border-color)] sticky top-20">
                        {isLoadingTables ? (
                            <div className="flex flex-col items-center justify-center py-10">
                                <span className="loader"></span>
                                <p className="mt-4 text-xs text-slate-500 font-medium">Loading tables...</p>
                            </div>
                        ) : (
                            <>
                                {tableFetchError && (
                                    <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md text-xs text-amber-800 dark:text-amber-300">
                                        <div className="flex items-start gap-2">
                                            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                                            <div className="overflow-hidden">
                                                <p className="font-semibold mb-1">Dynamic Fetch Failed</p>
                                                <p className="mb-2">Showing predefined tables. To enable dynamic fetching, run this SQL in Supabase:</p>
                                                <pre className="p-2 bg-black/10 dark:bg-black/30 rounded overflow-x-auto text-[10px] font-mono whitespace-pre-wrap break-all">
{`CREATE OR REPLACE FUNCTION get_all_tables()
RETURNS TABLE(table_name text)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY SELECT t.table_name::text
  FROM information_schema.tables t
  WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE';
END; $$;`}
                                                </pre>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {[{ dbName: 'Main App', tables: dynamicTables }].map(dbGroup => (
                                    <div key={dbGroup.dbName} className="mb-4 last:mb-0">
                                        <h3 className="flex items-center gap-2 font-bold text-base text-slate-800 mb-2 px-1">
                                            <Database size={14} />
                                            {dbGroup.dbName}
                                        </h3>
                                        <div className="space-y-0.5">
                                            {dbGroup.tables.map(table => {
                                                const analytics = dbAnalytics.find(a => a.table_name === table.name);
                                                const isNeverUsed = analytics && analytics.live_rows === 0 && analytics.total_inserts === 0 && analytics.total_updates === 0 && analytics.total_deletes === 0;
                                                const lastUsedDate = analytics?.last_used ? new Date(analytics.last_used).toLocaleString() : 'Never / Unknown';
                                                const timeAgo = formatTimeAgo(analytics?.last_used);
                                                
                                                return (
                                                <div 
                                                    key={table.name}
                                                    ref={selectedTable === table.name ? selectedTableRef : null}
                                                    className={`group w-full flex items-center justify-between p-1.5 rounded-md transition-colors cursor-pointer ${
                                                        selectedTable === table.name
                                                            ? 'bg-indigo-100 dark:bg-indigo-900/20'
                                                            : 'hover:bg-[var(--sidebar-link-hover-bg)]'
                                                    }`}
                                                    onClick={() => setSelectedTable(table.name)}
                                                >
                                                    <div
                                                        className={`flex-grow text-left flex items-center gap-2 text-xs font-medium ${
                                                            selectedTable === table.name 
                                                                ? 'text-indigo-600 dark:text-indigo-400' 
                                                                : 'text-[var(--sidebar-text-secondary)] group-hover:text-[var(--sidebar-text-primary)]'
                                                        }`}
                                                        title={`Last Used: ${lastUsedDate}`}
                                                    >
                                                        <Table size={12} className="shrink-0" />
                                                        <span className="truncate font-mono">{table.name}</span>
                                                        {isNeverUsed ? (
                                                            <span className="ml-1 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-sm border border-amber-200 dark:border-amber-800/50">
                                                                Never Used
                                                            </span>
                                                        ) : (
                                                            <span className="ml-1 text-[9px] opacity-60 font-mono">
                                                                {timeAgo}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setActivePopover({ tableName: table.name, anchorEl: e.currentTarget }); }}
                                                        className={`p-0.5 rounded-md shrink-0 ${
                                                            selectedTable === table.name
                                                                ? 'text-indigo-600 dark:text-indigo-400'
                                                                : 'text-[var(--sidebar-text-secondary)] opacity-0 group-hover:opacity-100'
                                                        }`}
                                                        aria-label={`More options for ${table.name}`}
                                                    >
                                                        <MoreVertical size={14} />
                                                    </button>
                                                </div>
                                            )})}
                                        </div>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                </aside>

                {/* --- Right Panel: Management Area --- */}
                <main className="flex-1 min-w-0">
                    {isFetchingDetails ? (
                        <PanelCard ref={detailsContainerRef}>
                            <div className="flex flex-col items-center justify-center h-96">
                                <span className="loader"></span>
                                <p className="mt-4 text-slate-500 font-medium">Fetching details for <span className="font-mono">{selectedTable}</span>...</p>
                            </div>
                        </PanelCard>
                    ) : tableDetails ? (
                        <TableDetailsView 
                            ref={detailsContainerRef} 
                            details={tableDetails} 
                            description={selectedTableInfo?.description || ''} 
                            onLoadMore={handleLoadMore}
                            onUpdateRow={handleUpdateRow}
                        />
                    ) : selectedTableInfo ? (
                        <PanelCard ref={detailsContainerRef}>
                            <div className="text-center py-10">
                                <AlertTriangle className="mx-auto h-12 w-12 text-red-400" />
                                <h3 className="mt-2 text-lg font-medium text-slate-800">Failed to Load Details</h3>
                                <p className="mt-1 text-sm text-slate-500">
                                Could not fetch details for the table <strong className="font-mono">{selectedTableInfo.name}</strong>. Please check the console for errors.
                                </p>
                            </div>
                        </PanelCard>
                    ) : (
                        <PanelCard ref={detailsContainerRef}>
                            <p className="text-slate-500 text-center py-10">Select a table from the left to manage it.</p>
                        </PanelCard>
                    )}
                </main>
            </div>
        </>
    );

    return (
        <div className="space-y-4">
            <div className="pill-nav-container hide-scrollbar">
                <div className="pill-nav">
                    <Link to={`${location.pathname}#db`} className={`pill-nav-item ${view === 'db' ? 'active' : ''}`}>Database Management</Link>
                    <Link to={`${location.pathname}#db_analytics`} className={`pill-nav-item ${view === 'db_analytics' ? 'active' : ''}`}>Analytics</Link>
                    <Link to={`${location.pathname}#platform`} className={`pill-nav-item ${view === 'platform' ? 'active' : ''}`}>Platform Settings</Link>
                </div>
            </div>

            {view === 'db' && renderDbManagementView()}
            {view === 'db_analytics' && <DatabaseAnalyticsCard />}
            {view === 'platform' && <PlatformSettingsView />}

            <ActionPopover
                isOpen={activePopover !== null}
                anchorEl={activePopover?.anchorEl || null}
                onClose={() => setActivePopover(null)}
            >
                {activePopover && (
                    <div className="space-y-1">
                        {(() => {
                            const table = allTables.find(t => t.name === activePopover.tableName);
                            const showResetSequence = table?.has_sequence !== undefined 
                                ? table.has_sequence 
                                : !table?.disableSequenceReset;

                            return showResetSequence && (
                                <button 
                                    onClick={() => { handleResetSequenceClick(activePopover.tableName); setActivePopover(null); }}
                                    className="popover-item warning"
                                >
                                    <RefreshCw size={14} /> Reset ID Sequence
                                </button>
                            );
                        })()}
                        <button 
                            onClick={() => { handleResetDataClick(activePopover.tableName); setActivePopover(null); }}
                            className="popover-item danger"
                        >
                            <Trash2 size={14} /> Delete All Data...
                        </button>
                        <button 
                            onClick={() => { handleDropTableClick(activePopover.tableName); setActivePopover(null); }}
                            className="popover-item danger"
                        >
                            <AlertTriangle size={14} /> Drop Table...
                        </button>
                    </div>
                )}
            </ActionPopover>

            {/* Modal for Reset IDs */}
            <ConfirmationModal
                isOpen={modal.type === 'sequence'}
                onClose={closeModal}
                onConfirm={handleConfirmReset}
                title="Reset ID Sequence"
                message={
                    <div className="space-y-3">
                        <div className="flex items-start gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800/50 rounded-md">
                            <AlertTriangle className="w-8 h-8 text-yellow-500 shrink-0" />
                            <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                Are you sure you want to reset the IDs for the <strong>{modal.tableName}</strong> table? The next new row will get ID 1.
                            </p>
                        </div>
                    </div>
                }
                confirmText={isLoading ? "Resetting..." : "Confirm Reset"}
                confirmButtonClass="btn-danger-secondary"
                isConfirmDisabled={isLoading}
            />
            
            {/* Modal for Reset Data */}
             <ConfirmationModal
                isOpen={modal.type === 'data'}
                onClose={closeModal}
                onConfirm={handleConfirmReset}
                title="Permanently Delete Table Data"
                message={
                    <div className="space-y-4">
                        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-lg">
                            <AlertTriangle className="w-12 h-12 text-red-500 shrink-0 mt-1" />
                            <div>
                                <h4 className="font-bold text-red-900 dark:text-red-200">Irreversible Action</h4>
                                <p className="text-sm text-red-800 dark:text-red-200">
                                    This will permanently delete <strong>ALL</strong> data from the <strong className="font-mono">{modal.tableName}</strong> table.
                                </p>
                            </div>
                        </div>
                        <p>To proceed, please type the name of the table (<strong 
                            className="font-mono cursor-pointer hover:bg-slate-200 dark:hover:bg-zinc-700 px-1 py-0.5 rounded transition-colors text-indigo-600 dark:text-indigo-400"
                            title="Click to copy"
                            onClick={() => {
                                if (modal.tableName) {
                                    navigator.clipboard.writeText(modal.tableName);
                                    import('react-hot-toast').then(m => m.toast.success('Table name copied!'));
                                }
                            }}
                        >{modal.tableName}</strong>) in the box below.</p>
                        <input
                            type="text"
                            value={confirmationInput}
                            onChange={(e) => setConfirmationInput(e.target.value)}
                            className="form-input w-full mt-1 font-mono"
                            autoFocus
                        />
                    </div>
                }
                confirmText={isLoading ? "Deleting..." : "Permanently Delete"}
                confirmButtonClass="btn-danger"
                isConfirmDisabled={isLoading || confirmationInput !== modal.tableName}
            />

            {/* Modal for Drop Table */}
             <ConfirmationModal
                isOpen={modal.type === 'drop'}
                onClose={closeModal}
                onConfirm={handleConfirmReset}
                title={dropTableStep === 1 ? "Drop Table - Step 1 of 2" : "Drop Table - Step 2 of 2"}
                message={
                    <div className="space-y-4">
                        {dropTableStep === 1 ? (
                            <>
                                <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-lg">
                                    <AlertTriangle className="w-12 h-12 text-red-500 shrink-0 mt-1" />
                                    <div>
                                        <h4 className="font-bold text-red-900 dark:text-red-200">Irreversible Action</h4>
                                        <p className="text-sm text-red-800 dark:text-red-200">
                                            This will permanently <strong>DROP</strong> the <strong className="font-mono">{modal.tableName}</strong> table and all its data.
                                        </p>
                                    </div>
                                </div>
                                <p>To proceed, please type the name of the table (<strong 
                                    className="font-mono cursor-pointer hover:bg-slate-200 dark:hover:bg-zinc-700 px-1 py-0.5 rounded transition-colors text-indigo-600 dark:text-indigo-400"
                                    title="Click to copy"
                                    onClick={() => {
                                        if (modal.tableName) {
                                            navigator.clipboard.writeText(modal.tableName);
                                            import('react-hot-toast').then(m => m.toast.success('Table name copied!'));
                                        }
                                    }}
                                >{modal.tableName}</strong>) in the box below.</p>
                                <input
                                    type="text"
                                    value={confirmationInput}
                                    onChange={(e) => setConfirmationInput(e.target.value)}
                                    className="form-input w-full mt-1 font-mono"
                                    autoFocus
                                />
                            </>
                        ) : (
                            <>
                                <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-lg">
                                    <AlertTriangle className="w-12 h-12 text-red-500 shrink-0 mt-1" />
                                    <div>
                                        <h4 className="font-bold text-red-900 dark:text-red-200">Final Verification</h4>
                                        <p className="text-sm text-red-800 dark:text-red-200">
                                            Please enter the admin action password to confirm dropping the <strong className="font-mono">{modal.tableName}</strong> table.
                                        </p>
                                    </div>
                                </div>
                                <input
                                    type="password"
                                    value={passwordInput}
                                    onChange={(e) => setPasswordInput(e.target.value)}
                                    placeholder="Admin Password"
                                    className="form-input w-full mt-1"
                                    autoFocus
                                />
                            </>
                        )}
                    </div>
                }
                confirmText={dropTableStep === 1 ? "Next Step" : (isLoading ? "Dropping..." : "Drop Table")}
                confirmButtonClass="btn-danger"
                isConfirmDisabled={dropTableStep === 1 ? (confirmationInput !== modal.tableName) : (isLoading || (!import.meta.env.DEV && !passwordInput))}
            />
        </div>
    );
};

export default SettingsPage;
