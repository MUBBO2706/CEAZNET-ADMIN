import React, { useState, useEffect, Component, ErrorInfo, ReactNode, Suspense, useRef } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { RotateCw, Zap, AlertTriangle, ChevronRight, ChevronDown, Loader, Sun, Moon } from 'lucide-react';

import MainDashboard from './pages/MainDashboard';
import NewsAdminPage from './pages/NewsAdminPage';
import UsersPage from './pages/UsersPage';
import SettingsPage from './pages/SettingsPage';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import { LoadingSpinner } from './components/skeletons';

import SupportInboxPage from './pages/SupportInboxPage';
import AdvancedAnalyticsPage from './pages/AdvancedAnalyticsPage';
import BroadcastPage from './pages/BroadcastPage';
import { AuthProvider, useAuth } from './components/AuthContext';


// --- Error Boundary Component ---
interface ErrorBoundaryProps {
    children: ReactNode;
}

interface AppError {
    id: string;
    timestamp: Date;
    message: string;
    stack?: string;
    componentStack?: string;
}

interface ErrorBoundaryState {
    hasError: boolean;
    errors: AppError[];
    expanded: Record<string, boolean>;
    isReloading?: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState = {
        hasError: false,
        errors: [],
        expanded: {},
        isReloading: false
    };

    private handleGlobalError = (event: ErrorEvent) => {
        const err = event.error || new Error(event.message);
        const errStr = (err?.message || err?.toString() || '').toLowerCase();
        if (
            errStr.includes('websocket') || 
            errStr.includes('closed without opened') || 
            errStr.includes('failed to fetch') ||
            errStr.includes('parameter 1 is not of type') ||
            errStr.includes("failed to execute 'contains' on 'node'") ||
            errStr.includes('not of type \'node\'')
        ) {
            event.preventDefault();
            console.warn("Ceaznet Admin - Suppressed benign global error in ErrorBoundary:", err);
            return;
        }
        this.addError(err);
    };

    private handleUnhandledRejection = (event: PromiseRejectionEvent) => {
        event.preventDefault?.();
        const reason = event.reason;
        const err = reason instanceof Error ? reason : new Error(String(reason || ''));
        const errStr = (err?.message || err?.toString() || '').toLowerCase();
        if (
            errStr.includes('websocket') || 
            errStr.includes('closed without opened') || 
            errStr.includes('failed to fetch') || 
            errStr.includes('network') || 
            errStr.includes('abort') || 
            errStr.includes('parameter 1 is not of type') ||
            errStr.includes("failed to execute 'contains' on 'node'") ||
            !reason
        ) {
            console.warn("Ceaznet Admin - Suppressed global unhandled network rejection:", err);
            return;
        }
        console.warn("Ceaznet Admin - Handled background rejection in ErrorBoundary:", err);
    };

    componentDidMount() {
        window.addEventListener('error', this.handleGlobalError);
        window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
    }

    componentWillUnmount() {
        window.removeEventListener('error', this.handleGlobalError);
        window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
    }

    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
        // We only show the fallback UI if it's NOT a benign error
        const errStr = error.toString().toLowerCase();
        if (
            errStr.includes('websocket') || 
            errStr.includes('closed without opened') ||
            errStr.includes('parameter 1 is not of type') ||
            errStr.includes("failed to execute 'contains' on 'node'") ||
            errStr.includes('not of type \'node\'')
        ) {
            return { hasError: false };
        }
        return { 
            hasError: true,
            errors: [{
                id: 'init-err-' + Math.random().toString(36).substr(2, 6),
                timestamp: new Date(),
                message: error.message || error.toString(),
                stack: error.stack
            }]
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        const errStr = error.toString().toLowerCase();
        if (
            errStr.includes('websocket') || 
            errStr.includes('closed without opened') ||
            errStr.includes('parameter 1 is not of type') ||
            errStr.includes("failed to execute 'contains' on 'node'") ||
            errStr.includes('not of type \'node\'')
        ) {
            console.warn("Ceaznet Admin - Suppressed benign error in componentDidCatch:", error);
            return;
        }
        console.error("Ceaznet Admin - Uncaught Application Error:", error, errorInfo);
        this.addError(error, errorInfo.componentStack);
    }

    addError(error: Error, componentStack?: string | null) {
        const errStr = (error?.message || error?.toString() || '').toLowerCase();
        if (
            errStr.includes('websocket') || 
            errStr.includes('closed without opened') || 
            errStr.includes('failed to fetch') || 
            errStr.includes('load failed') ||
            errStr.includes('parameter 1 is not of type') ||
            errStr.includes("failed to execute 'contains' on 'node'") ||
            errStr.includes('not of type \'node\'')
        ) {
            console.warn("Ceaznet Admin - Ignored benign error in addError:", error);
            return;
        }

        this.setState(prevState => {
            const msg = error.message || error.toString();
            const existingIndex = prevState.errors.findIndex(e => e.message === msg || e.message === error.toString());
            if (existingIndex !== -1) {
                if (componentStack && !prevState.errors[existingIndex].componentStack) {
                    const updated = [...prevState.errors];
                    updated[existingIndex] = { ...updated[existingIndex], componentStack };
                    return { ...prevState, errors: updated };
                }
                return prevState;
            }

            const newError: AppError = {
                id: Math.random().toString(36).substr(2, 9),
                timestamp: new Date(),
                message: msg,
                stack: error.stack,
                componentStack: componentStack || undefined
            };

            return {
                ...prevState,
                hasError: true,
                errors: [...prevState.errors, newError],
                expanded: { ...prevState.expanded, [newError.id]: false }
            };
        });
    }

    toggleExpand = (id: string) => {
        this.setState(prevState => ({
            expanded: { ...prevState.expanded, [id]: !prevState.expanded[id] }
        }));
    };

    handleReload = () => {
        this.setState({ isReloading: true });
        setTimeout(() => {
            window.location.reload();
        }, 150);
    };

    render(): ReactNode {
        if (this.state.hasError) {
            return (
                <div className="fixed inset-0 z-[999999] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
                    <div 
                        id="error-boundary-modal"
                        className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col border shadow-2xl transition-all" 
                        style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)', maxHeight: '85vh' }}
                    >
                        {/* Header: Icon and Heading on top row, Description starts from left edge beneath icon, No background/fill on icon */}
                        <div className="px-4 pt-3.5 pb-2.5 border-b flex flex-col shrink-0" style={{ borderColor: 'var(--border-color)' }}>
                            <div className="flex items-center gap-2 w-full">
                                <AlertTriangle className="h-5 w-5 shrink-0" style={{ color: 'var(--danger)' }} />
                                <h1 className="text-base font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                                    Application Error
                                </h1>
                            </div>
                            <p className="text-[11px] mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                                We encountered unexpected issues while rendering this page.
                            </p>
                        </div>
                        
                        {/* Errors List: Chevron is inline with content, content wraps all the way to the left edge with zero gap/space */}
                        <div 
                            className="flex-1 overflow-auto text-xs font-mono scrollbar-hide"
                            style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text-primary)' }}
                        >
                            <div className="px-4 py-2">
                                {this.state.errors.map((err) => {
                                    const isExpanded = this.state.expanded[err.id];
                                    return (
                                        <div key={err.id} className="border-b last:border-0 py-1.5" style={{ borderColor: 'var(--border-color)' }}>
                                            <div 
                                                className="py-1 cursor-pointer transition-colors rounded select-text leading-snug"
                                                onClick={() => this.toggleExpand(err.id)}
                                            >
                                                <span className="inline-flex items-center align-middle mr-1 text-zinc-500 select-none">
                                                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                                </span>
                                                <span className="text-zinc-400 dark:text-zinc-500 mr-1.5 select-none font-mono">
                                                    {err.timestamp.toLocaleTimeString()}
                                                </span>
                                                <span className="text-red-500 font-bold mr-1">
                                                    Uncaught Error:
                                                </span>
                                                <span className="text-red-500 dark:text-red-400 font-medium break-all">
                                                    {err.message}
                                                </span>
                                            </div>
                                            {isExpanded && (
                                                <div className="pb-2 pt-1.5 text-zinc-400 dark:text-zinc-400 text-[11px] leading-relaxed overflow-x-auto scrollbar-hide border-t mt-1" style={{ borderColor: 'var(--border-color)' }}>
                                                    {err.componentStack && (
                                                        <div className="mb-2">
                                                            <div className="text-zinc-300 dark:text-zinc-300 font-semibold mb-0.5">Component Stack:</div>
                                                            <div className="whitespace-pre-wrap opacity-80">{err.componentStack.trim()}</div>
                                                        </div>
                                                    )}
                                                    {err.stack && (
                                                        <div>
                                                            <div className="text-zinc-300 dark:text-zinc-300 font-semibold mb-0.5">Call Stack:</div>
                                                            <div className="whitespace-pre-wrap opacity-80">{err.stack.trim()}</div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Footer: Compact, dark black background matching header in dark mode, RotateCw icon & Reload text */}
                        <div className="px-4 py-2.5 border-t flex items-center justify-between gap-3 shrink-0" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
                            <p className="text-[11px] truncate" style={{ color: 'var(--text-secondary)' }}>
                                If this persists, please contact support.
                            </p>
                            <button
                                id="error-boundary-reload-btn"
                                disabled={this.state.isReloading}
                                onClick={this.handleReload}
                                className={`w-fit px-3 py-1.5 text-white text-xs font-semibold rounded-lg transition-all shadow-xs flex items-center justify-center gap-1.5 shrink-0 ${this.state.isReloading ? 'opacity-80 cursor-not-allowed' : 'cursor-pointer'}`}
                                style={{ backgroundColor: 'var(--accent-color)' }}
                                onMouseOver={(e) => {
                                    if (!this.state.isReloading) e.currentTarget.style.backgroundColor = 'var(--accent-color-dark)';
                                }}
                                onMouseOut={(e) => {
                                    if (!this.state.isReloading) e.currentTarget.style.backgroundColor = 'var(--accent-color)';
                                }}
                            >
                                {this.state.isReloading ? (
                                    <>
                                        <Loader className="w-3.5 h-3.5 animate-spin" />
                                        <span>Reload</span>
                                    </>
                                ) : (
                                    <>
                                        <RotateCw className="w-3.5 h-3.5" />
                                        <span>Reload</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        // FIX: In a class component, props (including children) are accessed via `this.props`.
        return (this as any).props.children;
    }
}


const PageLayout: React.FC<{ theme: string, toggleTheme: () => void }> = ({ theme, toggleTheme }) => {
    const { settings } = usePlatformSettings();
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
    const [pageTitle, setPageTitle] = useState('Overview');

    useEffect(() => {
        const path = location.pathname;
        if (path.startsWith('/news')) {
            setPageTitle('News Panel');
        } else if (path.startsWith('/users')) {
            setPageTitle('Users');
        } else if (path.startsWith('/settings')) {
            setPageTitle('Settings');
        } else if (path.startsWith('/support-inbox')) {
            setPageTitle('Support Inbox');
        } else if (path.startsWith('/advanced-analytics')) {
            setPageTitle('Insights');
        } else if (path.startsWith('/broadcast')) {
            setPageTitle('Broadcast');
        } else {
            setPageTitle('Overview');
        }
    }, [location.pathname]);

    const [isScrolled, setIsScrolled] = useState(false);
    const mainRef = useRef<HTMLElement>(null);

    useEffect(() => {
        const handleScroll = () => {
            if (mainRef.current) {
                const scrolled = mainRef.current.scrollTop > 10;
                setIsScrolled(prev => prev === scrolled ? prev : scrolled);
            }
        };
        const main = mainRef.current;
        if (main) {
            main.addEventListener('scroll', handleScroll, { passive: true });
        }
        return () => {
            if (main) {
                main.removeEventListener('scroll', handleScroll);
            }
        };
    }, []);

    return (
        <div className="flex h-full w-full overflow-hidden overscroll-none">
            {/* Mobile Overlay */}
            <div 
                className={`fixed inset-0 bg-gray-900/50 z-30 md:hidden ${isSidebarOpen ? 'block' : 'hidden'}`}
                onClick={() => setIsSidebarOpen(false)}
            ></div>
            
            {/* Sidebar */}
            <aside className={`sidebar w-fit flex-shrink-0 flex flex-col fixed inset-y-0 left-0 z-40 transform md:relative md:translate-x-0 transition-all duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${isSidebarCollapsed ? 'md:w-16 sidebar-collapsed' : 'md:w-40'}`}>
                <div className="flex items-center justify-between p-3 h-16 flex-shrink-0">
                    <h1 className={`sidebar-header-title flex items-center gap-3 ${isSidebarCollapsed ? 'md:justify-center md:w-full' : ''}`}>
                        {settings.platform_logo_url ? (
                            <img src={settings.platform_logo_url} alt="Logo" className="w-8 h-8 object-contain shrink-0 hidden md:block" />
                        ) : (
                            <Zap size={24} className="text-indigo-400 shrink-0 hidden md:block" />
                        )}
                        <span className={`text-xl font-cursive gradient-text ${isSidebarCollapsed ? 'md:hidden' : ''}`}>Admin</span>
                    </h1>
                </div>
                <Sidebar 
                    className="flex-1 min-h-0"
                    closeSidebar={() => setIsSidebarOpen(false)} 
                    isCollapsed={isSidebarCollapsed}
                    isSidebarOpen={isSidebarOpen}
                    onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                    theme={theme}
                    toggleTheme={toggleTheme}
                />
            </aside>

            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header for all screens */}
                <Header 
                    pageTitle={pageTitle}
                    onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    isCollapsed={isSidebarCollapsed}
                    isMobileMenuOpen={isSidebarOpen}
                    isScrolled={isScrolled}
                />
                
                {/* Main Content */}
                <main 
                    ref={mainRef}
                    className={`flex-1 flex flex-col overflow-y-auto ${location.pathname.startsWith('/support-inbox') || location.pathname.startsWith('/broadcast') ? '' : ((location.pathname === '/' || location.pathname.startsWith('/users') || location.pathname.startsWith('/news')) ? 'px-3 pb-0 sm:px-4 sm:pb-0 lg:px-6 lg:pb-0' : 'px-3 pb-3 sm:px-4 sm:pb-4 lg:px-6 lg:pb-6')}`}
                >
                    <div className={`h-[50px] shrink-0 w-full ${location.pathname.startsWith('/support-inbox') || location.pathname.startsWith('/broadcast') ? '' : 'mb-4 sm:mb-5 lg:mb-6'}`}></div>
                    <Routes>
                        <Route path="/" element={<MainDashboard />} />
                        <Route path="/news" element={<NewsAdminPage isScrolled={isScrolled} />} />
                        <Route path="/news/:logId" element={<NewsAdminPage isScrolled={isScrolled} />} />
                        <Route path="/users" element={<UsersPage />} />
                        <Route path="/users/:userId" element={<UsersPage />} />
                        <Route path="/settings" element={<SettingsPage />} />
                        <Route path="/settings/:tableName" element={<SettingsPage />} />
                        <Route path="/support-inbox" element={<SupportInboxPage />} />
                        <Route path="/support-inbox/:convId" element={<SupportInboxPage />} />
                        <Route path="/advanced-analytics" element={<AdvancedAnalyticsPage />} />
                        <Route path="/broadcast" element={<BroadcastPage />} />
                    </Routes>
                </main>
            </div>
        </div>
    );
};


import { Toaster } from 'react-hot-toast';
import { createPortal } from 'react-dom';
import { AutoRefreshProvider } from './components/AutoRefreshContext';
import { PlatformSettingsProvider, usePlatformSettings } from './components/PlatformSettingsContext';
import { BroadcastPopup } from './components/BroadcastPopup';
import { GlobalAlertProvider } from './components/ui';

const AdminAuthGuard: React.FC<{ children: ReactNode; theme: string; toggleTheme: () => void }> = ({ children, theme, toggleTheme }) => {
    const { isAuthenticated, isLoading: isAuthLoading, login } = useAuth();
    const [usernameInput, setUsernameInput] = useState('');
    const [passwordInput, setPasswordInput] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    if (isAuthLoading) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center transition-colors duration-300" style={{ backgroundColor: 'var(--body-bg)' }}>
                <LoadingSpinner message="Authenticating Session..." />
            </div>
        );
    }

    if (isAuthenticated) {
        return <>{children}</>;
    }

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!usernameInput.trim() || !passwordInput.trim()) {
            setError("Please enter both username and password.");
            return;
        }
        setIsSubmitting(true);
        setError('');

        try {
            const res = await login(usernameInput, passwordInput);
            if (!res.success) {
                setError(res.message || "Incorrect username or password. Access denied.");
            }
        } catch (err: any) {
            setError(`Authentication failed: ${err.message || 'Server error'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-zinc-50 dark:bg-black p-6 transition-colors duration-300 animate-in fade-in duration-200">
            {/* Theme Toggle Button */}
            <button
                type="button"
                onClick={toggleTheme}
                className="absolute top-6 right-6 p-2 rounded-lg bg-transparent border-0 shadow-none hover:bg-transparent focus:outline-none transition-colors active:scale-95 cursor-pointer"
                title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                id="login-theme-toggle"
            >
                {theme === 'dark' ? (
                    <Sun className="w-6 h-6 text-amber-500 hover:text-amber-400 transition-colors" />
                ) : (
                    <Moon className="w-6 h-6 text-indigo-600 hover:text-indigo-500 transition-colors" />
                )}
            </button>

            <div className="w-full max-w-sm flex flex-col items-center text-center">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-1 tracking-tight">Ceaznet Admin</h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">Secure Server-Side Authentication</p>
                
                <form onSubmit={handleLogin} className="w-full space-y-4 text-left">
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">Admin Username</label>
                        <input 
                            type="text" 
                            value={usernameInput}
                            onChange={(e) => {
                                setUsernameInput(e.target.value);
                                setError('');
                            }}
                            className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white text-zinc-900 placeholder-zinc-400 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all shadow-inner text-sm dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-white dark:placeholder-zinc-600 dark:focus:ring-indigo-500/30"
                            placeholder="Enter username..."
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">Admin Password</label>
                        <input 
                            type="password" 
                            value={passwordInput}
                            onChange={(e) => {
                                setPasswordInput(e.target.value);
                                setError('');
                            }}
                            className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white text-zinc-900 placeholder-zinc-400 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none transition-all shadow-inner text-sm dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-white dark:placeholder-zinc-600 dark:focus:ring-indigo-500/30"
                            placeholder="Enter secure password..."
                        />
                    </div>
                    {error && (
                        <div className="p-3.5 rounded-xl text-sm flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/60 dark:border-red-900/50 dark:text-red-300">
                            <AlertTriangle className="h-4 w-4 shrink-0 text-red-500 dark:text-red-400" />
                            <span>{error}</span>
                        </div>
                    )}
                    <button 
                        type="submit" 
                        disabled={isSubmitting}
                        className="w-full mt-2 px-5 py-3 text-white text-sm font-semibold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99]"
                    >
                        {isSubmitting && <Loader className="w-4 h-4 animate-spin" />}
                        {isSubmitting ? 'Verifying & Signing In...' : 'Access Admin Panel'}
                    </button>
                    <div className="pt-2 text-center text-xs text-zinc-400 dark:text-zinc-500">
                        Sessions remain securely active for 7 days
                    </div>
                </form>
            </div>
        </div>
    );
};

const App: React.FC = () => {
    const [theme, setTheme] = useState(() => {
        const savedTheme = localStorage.getItem('ceaznet-theme');
        if (savedTheme) return savedTheme;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    });

    const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 768);

    useEffect(() => {
        const handleResize = () => {
            setIsDesktop(window.innerWidth >= 768);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const toggleTheme = () => {
        setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
    };

    useEffect(() => {
        const root = document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        localStorage.setItem('ceaznet-theme', theme);

        // Update Chart.js global defaults for theme
        if ((window as any).Chart) {
            const isDark = theme === 'dark';
            (window as any).Chart.defaults.color = isDark ? '#9ca3af' : '#6b7280';
            (window as any).Chart.defaults.borderColor = isDark ? 'rgba(55, 65, 81, 0.8)' : '#e5e7eb';
        }
    }, [theme]);
    
    return (
        <BrowserRouter>
            <ErrorBoundary>
                <AuthProvider>
                    <AdminAuthGuard theme={theme} toggleTheme={toggleTheme}>
                        <AutoRefreshProvider>
                            <PlatformSettingsProvider>
                                <PageLayout theme={theme} toggleTheme={toggleTheme} />
                                <BroadcastPopup />
                                {createPortal(
                                    <Toaster 
                                        position="top-right" 
                                        containerClassName="custom-toast-container"
                                        containerStyle={{ 
                                            zIndex: 999999, 
                                            top: isDesktop ? 58 : 56, 
                                            right: isDesktop ? 8 : 6,
                                            left: isDesktop ? 8 : 6,
                                            bottom: isDesktop ? 8 : 6
                                        }} 
                                        toastOptions={{
                                            className: 'custom-toast-notification',
                                            style: {
                                                minWidth: '0px',
                                                width: 'auto',
                                                minHeight: isDesktop ? '40px' : '34px',
                                                maxWidth: isDesktop ? 'calc(100vw - 32px)' : 'calc(100vw - 12px)',
                                                whiteSpace: 'nowrap',
                                                padding: isDesktop ? '9px 15px' : '7px 12px',
                                                fontSize: isDesktop ? '13px' : '12px',
                                                borderRadius: '5px',
                                            },
                                            success: {
                                                style: {
                                                    minWidth: '0px',
                                                    width: 'auto',
                                                    minHeight: isDesktop ? '40px' : '34px',
                                                    maxWidth: isDesktop ? 'calc(100vw - 32px)' : 'calc(100vw - 12px)',
                                                    whiteSpace: 'nowrap',
                                                    padding: isDesktop ? '9px 15px' : '7px 12px',
                                                    fontSize: isDesktop ? '13px' : '12px',
                                                    borderRadius: '5px',
                                                }
                                            },
                                            error: {
                                                style: {
                                                    minWidth: '0px',
                                                    width: 'auto',
                                                    minHeight: isDesktop ? '40px' : '34px',
                                                    maxWidth: isDesktop ? 'calc(100vw - 32px)' : 'calc(100vw - 12px)',
                                                    whiteSpace: 'nowrap',
                                                    padding: isDesktop ? '9px 15px' : '7px 12px',
                                                    fontSize: isDesktop ? '13px' : '12px',
                                                    borderRadius: '5px',
                                                }
                                            }
                                        }} 
                                    />, 
                                    document.body
                                )}
                                <GlobalAlertProvider />
                            </PlatformSettingsProvider>
                        </AutoRefreshProvider>
                    </AdminAuthGuard>
                </AuthProvider>
            </ErrorBoundary>
        </BrowserRouter>
    );
};

export default App;
