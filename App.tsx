import React, { useState, useEffect, Component, ErrorInfo, ReactNode, Suspense, useRef } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Zap, X, AlertTriangle, ChevronRight, ChevronDown } from 'lucide-react';

import MainDashboard from './pages/MainDashboard';
import NewsAdminPage from './pages/NewsAdminPage';
import UsersPage from './pages/UsersPage';
import SettingsPage from './pages/SettingsPage';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import { LoadingSpinner } from './components/skeletons';

import SupportInboxPage from './pages/SupportInboxPage';

// Lazy load new pages
const AdvancedAnalyticsPage = React.lazy(() => import('./pages/AdvancedAnalyticsPage'));


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
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState = {
        hasError: false,
        errors: [],
        expanded: {}
    };

    private handleGlobalError = (event: ErrorEvent) => {
        this.addError(event.error || new Error(event.message));
    };

    private handleUnhandledRejection = (event: PromiseRejectionEvent) => {
        this.addError(event.reason instanceof Error ? event.reason : new Error(String(event.reason)));
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
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Ceaznet Admin - Uncaught Application Error:", error, errorInfo);
        this.addError(error, errorInfo.componentStack);
    }

    addError(error: Error, componentStack?: string | null) {
        const newError: AppError = {
            id: Math.random().toString(36).substr(2, 9),
            timestamp: new Date(),
            message: error.toString(),
            stack: error.stack,
            componentStack: componentStack || undefined
        };
        
        this.setState(prevState => ({
            hasError: true,
            errors: [...prevState.errors, newError],
            expanded: { ...prevState.expanded, [newError.id]: false }
        }));
    }

    toggleExpand = (id: string) => {
        this.setState(prevState => ({
            expanded: { ...prevState.expanded, [id]: !prevState.expanded[id] }
        }));
    };

    render(): ReactNode {
        if (this.state.hasError) {
            // Render a fallback UI when an error is caught
            return (
                <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 md:p-8" style={{ backgroundColor: 'var(--body-bg)' }}>
                    <div className="max-w-4xl w-full shadow-2xl rounded-2xl overflow-hidden flex flex-col border" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)', maxHeight: '90vh' }}>
                        <div className="p-6 border-b flex items-center gap-4 shrink-0" style={{ borderColor: 'var(--border-color)' }}>
                            <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--status-danger-subtle-bg)' }}>
                                <AlertTriangle className="h-6 w-6" style={{ color: 'var(--danger)' }} />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Application Error</h1>
                                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>We encountered unexpected issues while rendering this page.</p>
                            </div>
                        </div>
                        
                        <div className="flex-1 overflow-auto bg-[#0d1117] text-sm font-mono scrollbar-hide" style={{ color: '#e6edf3' }}>
                            <div className="p-4">
                                {this.state.errors.map((err) => {
                                    const isExpanded = this.state.expanded[err.id];
                                    return (
                                        <div key={err.id} className="border-b border-[#30363d]/50 last:border-0">
                                            <div 
                                                className="flex items-start gap-2 py-2 px-2 hover:bg-white/5 cursor-pointer transition-colors"
                                                onClick={() => this.toggleExpand(err.id)}
                                            >
                                                <div className="mt-0.5 text-gray-500 shrink-0">
                                                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                </div>
                                                <div className="text-gray-500 shrink-0 select-none">
                                                    [{err.timestamp.toLocaleTimeString()}]
                                                </div>
                                                <div className="text-red-400 font-semibold break-all">
                                                    <span className="text-red-500 mr-2">Uncaught Error:</span>
                                                    {err.message}
                                                </div>
                                            </div>
                                            {isExpanded && (
                                                <div className="pl-8 pr-4 pb-3 pt-1 text-gray-400 text-xs leading-relaxed overflow-x-auto scrollbar-hide">
                                                    {err.componentStack && (
                                                        <div className="mb-2">
                                                            <div className="text-gray-300 font-semibold mb-1">Component Stack:</div>
                                                            <div className="whitespace-pre-wrap opacity-80">{err.componentStack}</div>
                                                        </div>
                                                    )}
                                                    {err.stack && (
                                                        <div>
                                                            <div className="text-gray-300 font-semibold mb-1">Call Stack:</div>
                                                            <div className="whitespace-pre-wrap opacity-80">{err.stack}</div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="p-6 border-t flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0" style={{ backgroundColor: 'var(--subtle-bg)', borderColor: 'var(--border-color)' }}>
                            <p className="text-xs text-center sm:text-left" style={{ color: 'var(--text-secondary)' }}>
                                If this problem persists, please contact support.
                            </p>
                            <button
                                onClick={() => window.location.reload()}
                                className="w-full sm:w-auto px-5 py-2.5 text-white text-sm font-semibold rounded-lg transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2"
                                style={{ backgroundColor: 'var(--accent-color)' }}
                                onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-color-dark)'}
                                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-color)'}
                            >
                                <Zap className="w-4 h-4" />
                                Reload Application
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
        } else {
            setPageTitle('Overview');
        }
    }, [location.pathname]);

    const [isScrolled, setIsScrolled] = useState(false);
    const mainRef = useRef<HTMLElement>(null);

    useEffect(() => {
        const handleScroll = () => {
            if (mainRef.current) {
                setIsScrolled(mainRef.current.scrollTop > 10);
            }
        };
        const main = mainRef.current;
        if (main) {
            main.addEventListener('scroll', handleScroll);
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
                    className={`flex-1 flex flex-col overflow-y-auto ${location.pathname.startsWith('/support-inbox') ? '' : 'px-3 pb-3 sm:px-4 sm:pb-4 lg:px-6 lg:pb-6'}`}
                >
                    <div className={`h-[50px] shrink-0 w-full ${location.pathname.startsWith('/support-inbox') ? '' : 'mb-4 sm:mb-5 lg:mb-6'}`}></div>
                    <Suspense fallback={<LoadingSpinner />}>
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
                        </Routes>
                    </Suspense>
                </main>
            </div>
        </div>
    );
};


import { Toaster } from 'react-hot-toast';
import { AutoRefreshProvider } from './components/AutoRefreshContext';
import { PlatformSettingsProvider, usePlatformSettings } from './components/PlatformSettingsContext';
import { BroadcastPopup } from './components/BroadcastPopup';

const AdminAuthGuard: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(() => {
        if (import.meta.env.DEV) return true; // Skip password in development
        return sessionStorage.getItem('ceaznet-admin-auth') === 'true';
    });
    const [usernameInput, setUsernameInput] = useState('');
    const [passwordInput, setPasswordInput] = useState('');
    const [error, setError] = useState('');

    if (isAuthenticated) {
        return <>{children}</>;
    }

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        const expectedUsername = import.meta.env.VITE_ADMIN_USERNAME || (import.meta.env.DEV ? 'admin' : '');
        const expectedPassword = import.meta.env.VITE_ADMIN_PASSWORD || import.meta.env.VITE_ADMIN_ACTION_PASSWORD;
        if (!expectedPassword) {
            setError("Admin credentials not configured in environment variables.");
            return;
        }
        if (usernameInput === expectedUsername && passwordInput === expectedPassword) {
            setIsAuthenticated(true);
            sessionStorage.setItem('ceaznet-admin-auth', 'true');
        } else {
            setError("Incorrect username or password.");
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--body-bg)' }}>
            <div className="w-full max-w-md shadow-2xl rounded-2xl overflow-hidden flex flex-col border" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
                <div className="p-6 border-b flex items-center gap-4" style={{ borderColor: 'var(--border-color)' }}>
                    <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--accent-glow)' }}>
                        <Zap className="h-6 w-6" style={{ color: 'var(--accent-color)' }} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Ceaznet Admin</h1>
                        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Authentication Required</p>
                    </div>
                </div>
                
                <form onSubmit={handleLogin} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Admin Username</label>
                        <input 
                            type="text" 
                            value={usernameInput}
                            onChange={(e) => {
                                setUsernameInput(e.target.value);
                                setError('');
                            }}
                            className="w-full px-4 py-2.5 rounded-lg border focus:ring-2 outline-none transition-all shadow-sm"
                            style={{ 
                                backgroundColor: 'var(--subtle-bg)', 
                                borderColor: 'var(--border-color)',
                                color: 'var(--text-primary)'
                            }}
                            placeholder="Enter username..."
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Admin Password</label>
                        <input 
                            type="password" 
                            value={passwordInput}
                            onChange={(e) => {
                                setPasswordInput(e.target.value);
                                setError('');
                            }}
                            className="w-full px-4 py-2.5 rounded-lg border focus:ring-2 outline-none transition-all shadow-sm"
                            style={{ 
                                backgroundColor: 'var(--subtle-bg)', 
                                borderColor: 'var(--border-color)',
                                color: 'var(--text-primary)'
                            }}
                            placeholder="Enter secure password..."
                        />
                    </div>
                    {error && (
                        <div className="p-3 rounded-lg text-sm flex items-center gap-2" style={{ backgroundColor: 'var(--status-danger-subtle-bg)', color: 'var(--danger)' }}>
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}
                    <button 
                        type="submit" 
                        className="w-full px-5 py-2.5 text-white text-sm font-semibold rounded-lg transition-all shadow-sm flex items-center justify-center gap-2"
                        style={{ backgroundColor: 'var(--accent-color)' }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-color-dark)'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-color)'}
                    >
                        Access Admin Panel
                    </button>
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
                <AdminAuthGuard>
                    <AutoRefreshProvider>
                        <PlatformSettingsProvider>
                            <PageLayout theme={theme} toggleTheme={toggleTheme} />
                            <BroadcastPopup />
                            <Toaster position="top-right" />
                        </PlatformSettingsProvider>
                    </AutoRefreshProvider>
                </AdminAuthGuard>
            </ErrorBoundary>
        </BrowserRouter>
    );
};

export default App;