
import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
    LayoutDashboard, 
    Settings, 
    UsersRound, 
    Server, 
    MessageSquare,
    BarChart3, 
    MousePointerClick, 
    AreaChart, 
    Newspaper, 
    ScrollText, 
    SlidersHorizontal, 
    ChevronsLeft 
} from 'lucide-react';
import ThemeToggle from './ThemeToggle';

interface SidebarProps {
    closeSidebar: () => void;
    isCollapsed: boolean;
    className?: string;
    isSidebarOpen?: boolean;
    onToggleCollapse: () => void;
    theme: string;
    toggleTheme: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ closeSidebar, isCollapsed, className, isSidebarOpen, onToggleCollapse, theme, toggleTheme }) => {
    const location = useLocation();
    const currentPath = location.pathname;
    
    const isNewsPath = currentPath === '/news';
    const defaultHash = isNewsPath ? '#engagement' : '#analytics';
    const currentHash = location.hash || defaultHash; 
    
    const getNavLinkClass = (path: string) => {
        const isActive = path === '/' ? currentPath === '/' : currentPath.startsWith(path);
        return `sidebar-link ${isCollapsed ? 'md:justify-center' : ''} ${isActive ? 'active' : ''}`;
    };

    const getNestedNavLinkClass = (path: string, hash: string) => {
        const isActive = (path === '/' ? currentPath === '/' : currentPath.startsWith(path)) && currentHash === hash;
        return `sidebar-link sidebar-nested-link ${isCollapsed ? 'md:justify-center' : ''} ${isActive ? 'active' : ''}`;
    };

    const getFooterNavLinkClass = ({ isActive }: { isActive: boolean }) => {
        const baseClasses = "p-2 rounded-full text-[var(--sidebar-text-secondary)] hover:bg-[var(--sidebar-link-hover-bg)] hover:text-[var(--sidebar-text-primary)] transition-colors";
        return isActive ? `${baseClasses} bg-[var(--sidebar-link-hover-bg)] text-[var(--sidebar-text-primary)]` : baseClasses;
    };

    return (
        <>
            <style>{`
                /* --- Sidebar --- */
                .sidebar { background-color: var(--sidebar-bg); border-right: 1px solid var(--sidebar-border); }
                .sidebar-header-title { color: var(--sidebar-text-primary); font-weight: 700; font-size: 1.125rem; }
                .sidebar-link { position: relative; display: flex; align-items: center; gap: 0.625rem; padding: 0.5rem 0.75rem; border-radius: 0.375rem; font-weight: 500; color: var(--sidebar-text-secondary); transition: background-color 0.2s ease-in-out, color 0.2s ease-in-out; font-size: 0.8125rem; }
                .sidebar-link:hover { background-color: transparent; color: var(--sidebar-text-primary); }
                .sidebar-link.active { background-image: linear-gradient(90deg, var(--sidebar-link-hover-bg), transparent); color: var(--sidebar-text-primary); font-weight: 600; }
                .sidebar-link.active::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background-color: var(--accent-color); border-radius: 0 4px 4px 0; }
                .sidebar-nested-link { padding-left: 0.75rem; font-size: 0.75rem; }
                .sidebar-section summary { display: flex; justify-content: space-between; align-items: center; list-style: none; cursor: pointer; padding: 0.5rem 0.375rem; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--sidebar-text-muted); transition: color 0.2s ease-in-out; }
                .sidebar-section summary:hover { color: var(--sidebar-text-primary); }
                .sidebar-section summary::-webkit-details-marker { display: none; }
                .sidebar-section .chevron-icon { transition: transform 0.2s ease; }
                .sidebar-section[open] > summary .chevron-icon { transform: rotate(180deg); }
                
                /* --- Collapsed Sidebar Adjustments --- */
                /* On mobile, a "collapsed" sidebar should still look expanded. These rules apply only on desktop. */
                @media (min-width: 768px) {
                    .sidebar.sidebar-collapsed .sidebar-link {
                        padding-left: 0.75rem;
                        padding-right: 0.75rem;
                        justify-content: center;
                    }
                    .sidebar.sidebar-collapsed .sidebar-section summary {
                        padding-left: 0.75rem;
                        padding-right: 0.75rem;
                        justify-content: center;
                    }
                }
                
                /* --- Custom Tooltip (Sidebar Specific) --- */
                .sidebar-tooltip-wrapper[data-tooltip]::after { /* Tooltip Content */
                    left: calc(100% + 8px);
                    top: 50%;
                    bottom: auto;
                    transform: translateY(-50%);
                }
                .sidebar-tooltip-wrapper[data-tooltip]::before { /* Tooltip Arrow */
                    left: calc(100% + 3px);
                    top: 50%;
                    bottom: auto;
                    transform: translateY(-50%);
                    border-color: transparent var(--sidebar-bg) transparent transparent;
                }
                /* FIX: Invert sidebar footer tooltip colors for better contrast */
                .sidebar-tooltip-wrapper[data-tooltip]::after {
                    background-color: #1f2937; /* Dark background for light theme */
                    color: #f9fafb; /* Light text for light theme */
                }
                .sidebar-tooltip-wrapper[data-tooltip]::before {
                    border-right-color: #1f2937;
                }
                html.dark .sidebar-tooltip-wrapper[data-tooltip]::after {
                    background-color: #f9fafb; /* Light background for dark theme */
                    color: #1f2937; /* Dark text for dark theme */
                }
                html.dark .sidebar-tooltip-wrapper[data-tooltip]::before {
                    border-right-color: #f9fafb;
                }

                /* --- Sidebar Specific Scrollbar --- */
                .sidebar nav::-webkit-scrollbar {
                    width: 1px;
                }
                .sidebar nav::-webkit-scrollbar-track {
                    background-color: transparent;
                }
                .sidebar nav::-webkit-scrollbar-thumb {
                    background-color: var(--sidebar-border);
                    border-radius: 1px;
                }
            `}</style>
            <div className={`flex flex-col flex-1 relative ${className || ''}`}>
                {/* Mobile-only Close Button */}
                <button
                    onClick={closeSidebar}
                    aria-label="Close sidebar"
                    className={`md:hidden absolute top-4 right-[-16px] z-50 w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-200 transition-all duration-300 ease-in-out shadow-md border border-gray-200 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                >
                    <ChevronsLeft size={20} />
                </button>
                {/* Desktop-only Collapse Button */}
                <button
                    onClick={onToggleCollapse}
                    aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    className={`hidden md:flex absolute top-4 right-[-16px] z-50 w-8 h-8 items-center justify-center bg-gray-100 rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-200 transition-all duration-300 ease-in-out shadow-md border border-gray-200`}
                >
                    <ChevronsLeft size={20} className={`transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} />
                </button>
                
                <nav className="flex-1 overflow-y-auto px-1 py-3 space-y-0.5">
                    
                    {/* --- DASHBOARD --- */}
                    <div className="pb-1.5">
                        {!isCollapsed && (
                            <div className="px-2 pb-1 text-[10px] font-bold uppercase text-zinc-500 tracking-wider">
                                Dashboard
                            </div>
                        )}
                        <NavLink to="/" className={() => getNavLinkClass('/')} onClick={closeSidebar}>
                            <LayoutDashboard size={18} className="shrink-0 w-5 text-center" />
                            <span className="truncate">Overview</span>
                        </NavLink>
                    </div>

                    {/* --- MANAGEMENT --- */}
                    <div className="pt-1.5">
                        {isCollapsed ? <hr className="my-1.5 border-[var(--sidebar-border)]" /> : (
                            <div className="px-2 pb-1 text-[10px] font-bold uppercase text-zinc-500 tracking-wider">
                                Management
                            </div>
                        )}
                        <NavLink to="/users" className={() => getNavLinkClass('/users')} onClick={closeSidebar}>
                            <UsersRound size={18} className="shrink-0 w-5 text-center" />
                            <span className="truncate">Users</span>
                        </NavLink>
                        <NavLink to="/support-inbox" className={() => getNavLinkClass('/support-inbox')} onClick={closeSidebar}>
                            <MessageSquare size={18} className="shrink-0 w-5 text-center" />
                            <span className="truncate">Support Inbox</span>
                        </NavLink>
                    </div>


                    <div className="pt-1.5">
                        {isCollapsed ? <hr className="my-1.5 border-[var(--sidebar-border)]" /> : (
                            <div className="px-2 pb-1 text-[10px] font-bold uppercase text-zinc-500 tracking-wider">
                                System
                            </div>
                        )}
                        <NavLink to="/advanced-analytics" className={() => getNavLinkClass('/advanced-analytics')} onClick={closeSidebar}>
                            <BarChart3 size={18} className="shrink-0 w-5 text-center" />
                            <span className="truncate">Insights</span>
                        </NavLink>
                    </div>
                    
                    {/* --- NEWS PANEL --- */}
                    <div className="pt-1.5">
                        {isCollapsed ? <hr className="my-1.5 border-[var(--sidebar-border)]" /> : (
                            <div className="px-2 pb-1 text-[10px] font-bold uppercase text-zinc-500 tracking-wider">
                                News Panel
                            </div>
                        )}
                        <div className="space-y-1">
                            <NavLink to="/news#engagement" className={() => getNestedNavLinkClass('/news', '#engagement')} onClick={closeSidebar}>
                                <MousePointerClick size={18} className="shrink-0 w-5" /> <span className={isCollapsed ? 'md:hidden' : ''}>Engagement</span>
                            </NavLink>
                            <NavLink to="/news#analytics" className={() => getNestedNavLinkClass('/news', '#analytics')} onClick={closeSidebar}>
                                <AreaChart size={18} className="shrink-0 w-5" /> <span className={isCollapsed ? 'md:hidden' : ''}>Analytics</span>
                            </NavLink>
                            <NavLink to="/news#content" className={() => getNestedNavLinkClass('/news', '#content')} onClick={closeSidebar}>
                                <Newspaper size={18} className="shrink-0 w-5" /> <span className={isCollapsed ? 'md:hidden' : ''}>Articles</span>
                            </NavLink>
                            <NavLink to="/news#logs" className={() => getNestedNavLinkClass('/news', '#logs')} onClick={closeSidebar}>
                                <ScrollText size={18} className="shrink-0 w-5" /> <span className={isCollapsed ? 'md:hidden' : ''}>Logs</span>
                            </NavLink>
                            <NavLink to="/news#settings" className={() => getNestedNavLinkClass('/news', '#settings')} onClick={closeSidebar}>
                                <SlidersHorizontal size={18} className="shrink-0 w-5" /> <span className={isCollapsed ? 'md:hidden' : ''}>Settings</span>
                            </NavLink>
                        </div>
                    </div>
                </nav>

                <div className={`px-1 py-3 border-t border-[var(--sidebar-border)]`}>
                    <div className={`grid grid-cols-2 gap-2 items-center justify-items-center ${isCollapsed ? 'md:grid-cols-1' : ''}`}>
                        <div
                            className="sidebar-tooltip-wrapper w-full flex justify-center"
                            data-tooltip={theme === 'light' ? 'Dark Mode' : 'Light Mode'}
                        >
                            <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
                        </div>
                        <div
                            className="sidebar-tooltip-wrapper w-full flex justify-center"
                            data-tooltip="Settings"
                        >
                            <NavLink
                                to="/settings"
                                className={getFooterNavLinkClass}
                                aria-label="Settings"
                                onClick={closeSidebar}
                            >
                                <Settings size={20} />
                            </NavLink>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Sidebar;
