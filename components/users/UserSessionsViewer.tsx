import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { UserSession } from '../../types';
import { 
  fetchUserSessions, 
  terminateUserSession, 
  terminateAllUserSessions, 
  deleteUserSession, 
  deleteUserSessionsBatch,
  fetchUsersData,
  dbMain
} from '../../services/supabaseService';
import { ConfirmationModal, StatCard, BatchActionToolbar } from '../ui';
import { 
  Smartphone, 
  Laptop,
  Globe,
  Trash2, 
  Loader, 
  Search, 
  MapPin, 
  Battery, 
  EyeOff, 
  Clock, 
  User as UserIcon, 
  Power,
  Cpu,
  Radio,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ShieldAlert,
  ShieldCheck,
  Download,
  Check,
  Copy,
  X,
  Calendar,
  Filter,
  SlidersHorizontal,
  MoreVertical
} from 'lucide-react';

interface UserSessionsViewerProps {
  userId?: string;
  compact?: boolean;
  onRefreshParent?: () => void;
  onTotalSessionsCountChange?: (count: number) => void;
}

type StatusFilter = 'all' | 'active' | 'logged_out' | 'terminated' | 'expired';
type TimeRangeFilter = 'all' | '24h' | '7d' | '30d' | 'custom';
type SortOption = 'newest' | 'oldest' | 'browser_asc' | 'os_asc';

export const parseDeviceAndOS = (rawDeviceName?: string): { device: string; os: string } => {
  if (!rawDeviceName) return { device: 'Generic Device', os: 'Unknown OS' };
  
  const raw = rawDeviceName.trim();
  let os = '';
  let device = '';
  const upperRaw = raw.toUpperCase();
  
  if (upperRaw.includes('WINDOWS') || upperRaw.includes('WIN64') || upperRaw.includes('WIN32')) {
    os = 'Windows';
  } else if (upperRaw.includes('MAC OS') || upperRaw.includes('MACINTOSH') || upperRaw.includes('MACOS')) {
    os = 'macOS';
  } else if (upperRaw.includes('ANDROID')) {
    os = 'Android';
  } else if (upperRaw.includes('IPHONE') || upperRaw.includes('IOS') || upperRaw.includes('IPAD')) {
    os = 'iOS';
  } else if (upperRaw.includes('LINUX') || upperRaw.includes('UBUNTU')) {
    os = 'Linux';
  }

  if (!os || os === 'Unknown OS') {
    if (
      upperRaw.includes('POCO') ||
      upperRaw.includes('REDMI') ||
      upperRaw.includes('XIAOMI') ||
      upperRaw.includes('SAMSUNG') ||
      upperRaw.includes('GALAXY') ||
      upperRaw.includes('SM-') ||
      upperRaw.includes('OPPO') ||
      upperRaw.includes('VIVO') ||
      upperRaw.includes('ONEPLUS') ||
      upperRaw.includes('PIXEL') ||
      upperRaw.includes('REALME') ||
      upperRaw.includes('HUAWEI') ||
      upperRaw.includes('CPH')
    ) {
      os = 'Android';
    } else if (upperRaw.includes('IPHONE')) {
      os = 'iOS';
    } else if (upperRaw.includes('IPAD')) {
      os = 'iPadOS';
    } else if (upperRaw.includes('MAC') || upperRaw.includes('MACBOOK')) {
      os = 'macOS';
    } else if (upperRaw.includes('PC') || upperRaw.includes('WINDOWS') || upperRaw.includes('DESKTOP')) {
      os = 'Windows';
    } else {
      os = 'Unknown OS';
    }
  }

  device = raw.replace(/[\(\[\)\]]/g, '').trim() || 'Generic Device';
  return { device, os };
};

export const getSessionActions = (
  session: UserSession,
  userName?: string,
  userEmail?: string
): { actionBy: string; actionFrom: string } => {
  const key = session.session_key || session.session_token || session.id || '';
  let status = session.status?.toLowerCase() || 'active';
  
  if (key.startsWith('LOGGED_OUT_') || status === 'logged_out') {
    status = 'logged_out';
  } else if (key.startsWith('TERMINATED_') || status === 'terminated') {
    status = 'terminated';
  } else {
    const now = Date.now();
    const lastActive = new Date(session.last_active_at || session.created_at || Date.now()).getTime();
    if (now - lastActive > 35 * 60 * 1000 && !session.is_current) {
      status = 'expired';
    }
  }

  if (status === 'active') {
    return { actionBy: '-', actionFrom: '-' };
  }

  if (session.action_by) {
    return {
      actionBy: session.action_by,
      actionFrom: session.action_from || parseDeviceAndOS(session.device_name).device
    };
  }

  const displayName = userName || session.user_full_name || userEmail || session.user_email || 'User';

  if (status === 'expired') {
    return { actionBy: 'System', actionFrom: 'System' };
  }

  if (status === 'logged_out') {
    if (key.includes('SYSTEM') || key.includes('EXPIRED') || key.includes('TIMEOUT')) {
      return { actionBy: 'System', actionFrom: 'System' };
    }
    return {
      actionBy: displayName,
      actionFrom: parseDeviceAndOS(session.device_name).device
    };
  }

  if (status === 'terminated') {
    if (key.toUpperCase().includes('_BY_ADMIN') || session.action_by?.toLowerCase().includes('admin')) {
      return { actionBy: 'Administrator', actionFrom: 'System' };
    }
    if (key.toUpperCase().includes('_BY_SYSTEM')) {
      return { actionBy: 'System', actionFrom: 'System' };
    }
    return {
      actionBy: displayName,
      actionFrom: parseDeviceAndOS(session.device_name).device
    };
  }

  return {
    actionBy: displayName,
    actionFrom: parseDeviceAndOS(session.device_name).device
  };
};

export const getSessionStatus = (
  session: UserSession
): { status: 'active' | 'logged_out' | 'terminated' | 'expired'; label: string } => {
  const key = session.session_key || '';
  const statusStr = (session.status || '').toUpperCase();
  if (key.startsWith('LOGGED_OUT_') || statusStr === 'LOGGED_OUT') {
    return { status: 'logged_out', label: 'Logged Out' };
  }
  if (key.startsWith('TERMINATED_') || statusStr === 'TERMINATED') {
    return { status: 'terminated', label: 'Terminated' };
  }
  const now = Date.now();
  const lastActive = new Date(session.last_active_at || session.created_at || Date.now()).getTime();
  if (now - lastActive > 35 * 60 * 1000 && !session.is_current) {
    return { status: 'expired', label: 'Expired' };
  }
  return { status: 'active', label: 'Active' };
};

export const formatSingleLineDateTime = (dateStr?: string): string => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  try {
    const options: Intl.DateTimeFormatOptions = {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'Asia/Kolkata',
    };
    return new Intl.DateTimeFormat('en-GB', options).format(d).replace(',', '');
  } catch (e) {
    return d.toLocaleString('en-IN');
  }
};

export const getDuration = (startStr?: string, endStr?: string, isOngoing: boolean = false, format: 'human' | 'hms' = 'human'): string => {
  if (!startStr) return '-';
  const start = new Date(startStr).getTime();
  const end = isOngoing ? Date.now() : new Date(endStr || startStr).getTime();
  const diffMs = Math.max(0, end - start);
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (format === 'hms') {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
};

export const UserSessionsViewer: React.FC<UserSessionsViewerProps> = ({
  userId,
  compact = false,
  onRefreshParent,
  onTotalSessionsCountChange
}) => {
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Master users list for selector dropdown so users don't disappear when one is selected
  const [allUsersList, setAllUsersList] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [userSearchQuery, setUserSearchQuery] = useState<string>('');

  const onTotalSessionsCountChangeRef = useRef(onTotalSessionsCountChange);
  onTotalSessionsCountChangeRef.current = onTotalSessionsCountChange;
  const onRefreshParentRef = useRef(onRefreshParent);
  onRefreshParentRef.current = onRefreshParent;

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>(userId || 'ALL');
  const [timeRangeFilter, setTimeRangeFilter] = useState<TimeRangeFilter>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [durationFormat, setDurationFormat] = useState<'human' | 'hms'>('human');

  // Dropdowns state
  const [activeDropdown, setActiveDropdown] = useState<'user' | 'status' | 'sort' | 'time' | 'actions' | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; minWidth?: number }>({ top: 0, left: 0 });
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  const userBtnRef = useRef<HTMLButtonElement>(null);
  const statusBtnRef = useRef<HTMLButtonElement>(null);
  const sortBtnRef = useRef<HTMLButtonElement>(null);
  const timeBtnRef = useRef<HTMLButtonElement>(null);
  const actionsBtnRef = useRef<HTMLButtonElement>(null);

  const toggleCustomDropdown = (
    type: 'user' | 'status' | 'sort' | 'time' | 'actions',
    btnElement: HTMLElement | null
  ) => {
    if (activeDropdown === type) {
      setActiveDropdown(null);
      return;
    }
    if (btnElement) {
      const rect = btnElement.getBoundingClientRect();
      let left = rect.left;
      if (left > window.innerWidth - 220) {
        left = Math.max(8, window.innerWidth - 220);
      }
      setDropdownPos({
        top: rect.bottom + 6,
        left: Math.max(8, left)
      });
      setActiveDropdown(type);
    }
  };

  useEffect(() => {
    const targetId = userId ? `sessions-portal-target-${userId}` : 'sessions-portal-target';
    const checkTarget = () => {
      const element = document.getElementById(targetId);
      if (element) {
        setPortalTarget(prev => (prev === element ? prev : element));
      }
    };
    checkTarget();
    const frameId = requestAnimationFrame(checkTarget);
    const timeoutId = setTimeout(checkTarget, 300);
    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(timeoutId);
    };
  }, [userId]);

  // Load all registered users for the user selector dropdown
  const loadAllUsers = useCallback(async () => {
    try {
      const data = await fetchUsersData();
      if (data && data.length > 0) {
        setAllUsersList(prev => {
          const map = new Map<string, { id: string; name: string; email: string }>();
          prev.forEach(u => map.set(u.id, u));
          data.forEach(stat => {
            if (stat.user?.id) {
              map.set(stat.user.id, {
                id: stat.user.id,
                name: stat.user.full_name || 'Anonymous User',
                email: stat.user.email || ''
              });
            }
          });
          return Array.from(map.values());
        });
      }
    } catch (e) {
      console.warn("User options fetch notice:", e);
    }
  }, []);

  useEffect(() => {
    loadAllUsers();
  }, [loadAllUsers]);

  // Pagination states
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(100);
  
  // Selection & Telemetry Modal
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  const [selectedSessionForModal, setSelectedSessionForModal] = useState<UserSession | null>(null);
  const [isCopiedDetails, setIsCopiedDetails] = useState(false);
  const [terminateModal, setTerminateModal] = useState<{ id: string; deviceName?: string } | null>(null);
  const [terminateAllModal, setTerminateAllModal] = useState<boolean>(false);
  const [deleteModal, setDeleteModal] = useState<{ ids: string[]; isBatch: boolean } | null>(null);
  
  // Inline row action confirmation states (matching Ceaznet SessionDetailsView)
  const [confirmingTerminateId, setConfirmingTerminateId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [isRowActionRunning, setIsRowActionRunning] = useState<string | null>(null);

  const tableScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to actions when confirming, and back to start when cancelled/cleared (matching Ceaznet)
  useEffect(() => {
    if ((confirmingTerminateId || confirmingDeleteId) && tableScrollRef.current) {
      const timer = setTimeout(() => {
        if (tableScrollRef.current) {
          tableScrollRef.current.scrollTo({
            left: tableScrollRef.current.scrollWidth,
            behavior: 'smooth'
          });
        }
      }, 50);
      return () => clearTimeout(timer);
    } else if (!confirmingTerminateId && !confirmingDeleteId && tableScrollRef.current) {
      const timer = setTimeout(() => {
        if (tableScrollRef.current) {
          tableScrollRef.current.scrollTo({
            left: 0,
            behavior: 'smooth'
          });
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [confirmingTerminateId, confirmingDeleteId]);

  const loadSessionsRef = useRef<((silent?: boolean) => Promise<void>) | undefined>(undefined);

  const loadSessions = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await fetchUserSessions(selectedUserFilter !== 'ALL' ? selectedUserFilter : undefined);
      // Strictly deduplicate sessions by id to ensure rows never repeat
      const sessionMap = new Map<string, UserSession>();
      (data || []).forEach(s => {
        if (s && s.id) {
          sessionMap.set(s.id, s);
        }
      });
      const uniqueSessions = Array.from(sessionMap.values());
      setSessions(uniqueSessions);

      if (onTotalSessionsCountChangeRef.current && selectedUserFilter === 'ALL') {
        onTotalSessionsCountChangeRef.current(uniqueSessions.length);
      }
      // Merge session users into allUsersList so we never lose users
      if (uniqueSessions.length > 0) {
        setAllUsersList(prev => {
          const map = new Map<string, { id: string; name: string; email: string }>();
          prev.forEach(u => map.set(u.id, u));
          uniqueSessions.forEach(s => {
            if (s.user_id && !map.has(s.user_id)) {
              map.set(s.user_id, {
                id: s.user_id,
                name: s.user_full_name || 'Anonymous User',
                email: s.user_email || ''
              });
            }
          });
          return Array.from(map.values());
        });
      }
    } catch (err) {
      console.warn("Failed to load user sessions (handled):", err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [selectedUserFilter]);

  loadSessionsRef.current = loadSessions;

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    // Subscribe to real-time changes on the user_sessions table
    const channel = dbMain.channel('user-sessions-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_sessions' },
        () => {
          // Trigger a silent reload when anything changes in the database
          if (loadSessionsRef.current) {
            loadSessionsRef.current(true);
          }
        }
      )
      .subscribe();

    return () => {
      dbMain.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (userId) {
      setSelectedUserFilter(userId);
    }
  }, [userId]);

  // Filter and sort user options for dropdown (with selected user on top)
  const sortedAndFilteredUserOptions = useMemo(() => {
    let list = [...allUsersList];
    if (userSearchQuery.trim()) {
      const q = userSearchQuery.toLowerCase().trim();
      list = list.filter(u => 
        (u.name && u.name.toLowerCase().includes(q)) || 
        (u.email && u.email.toLowerCase().includes(q)) || 
        (u.id && u.id.toLowerCase().includes(q))
      );
    }
    // If selectedUserFilter is active (not ALL), put that selected user at the very top of the list
    if (selectedUserFilter !== 'ALL') {
      list.sort((a, b) => {
        if (a.id === selectedUserFilter) return -1;
        if (b.id === selectedUserFilter) return 1;
        return (a.name || '').localeCompare(b.name || '');
      });
    } else {
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }
    return list;
  }, [allUsersList, userSearchQuery, selectedUserFilter]);

  // Selected user display text for the filter button
  const selectedUserDisplay = useMemo(() => {
    if (selectedUserFilter === 'ALL') return '👥 All Users';
    const found = allUsersList.find(u => u.id === selectedUserFilter) || 
                  sessions.find(s => s.user_id === selectedUserFilter);
    const name = found ? ('name' in found ? found.name : found.user_full_name) : 'User';
    return `👤 ${name || 'User'}`;
  }, [selectedUserFilter, allUsersList, sessions]);

  // Filter & Sort Sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      // 1. User Filter
      if (selectedUserFilter !== 'ALL' && s.user_id !== selectedUserFilter) {
        return false;
      }

      // 2. Status Filter
      const statusInfo = getSessionStatus(s);
      if (statusFilter !== 'all' && statusInfo.status !== statusFilter) {
        return false;
      }

      // 3. Time Range Filter
      if (timeRangeFilter !== 'all') {
        const created = new Date(s.created_at || Date.now()).getTime();
        const now = Date.now();
        if (timeRangeFilter === '24h' && now - created > 24 * 60 * 60 * 1000) return false;
        if (timeRangeFilter === '7d' && now - created > 7 * 24 * 60 * 60 * 1000) return false;
        if (timeRangeFilter === '30d' && now - created > 30 * 24 * 60 * 60 * 1000) return false;
        if (timeRangeFilter === 'custom') {
          if (customStartDate && created < new Date(customStartDate).getTime()) return false;
          if (customEndDate && created > new Date(customEndDate).setHours(23, 59, 59, 999)) return false;
        }
      }

      // 4. Search Term
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const actions = getSessionActions(s);
        const matchIp = (s.ip_address || '').toLowerCase().includes(q);
        const matchDevice = (s.device_name || '').toLowerCase().includes(q);
        const matchLocation = (s.location || '').toLowerCase().includes(q);
        const matchBrowser = (s.browser_name || '').toLowerCase().includes(q);
        const matchUser = (s.user_full_name || '').toLowerCase().includes(q) || (s.user_email || '').toLowerCase().includes(q);
        const matchActionBy = (actions.actionBy || '').toLowerCase().includes(q);
        const matchActionFrom = (actions.actionFrom || '').toLowerCase().includes(q);
        
        if (!matchIp && !matchDevice && !matchLocation && !matchBrowser && !matchUser && !matchActionBy && !matchActionFrom) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (sortOption === 'newest') {
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      }
      if (sortOption === 'oldest') {
        return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
      }
      if (sortOption === 'browser_asc') {
        return (a.browser_name || '').localeCompare(b.browser_name || '');
      }
      if (sortOption === 'os_asc') {
        return parseDeviceAndOS(a.device_name).os.localeCompare(parseDeviceAndOS(b.device_name).os);
      }
      return 0;
    });
  }, [sessions, selectedUserFilter, statusFilter, timeRangeFilter, customStartDate, customEndDate, searchQuery, sortOption]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedSessionIds(new Set());
  }, [searchQuery, statusFilter, selectedUserFilter, timeRangeFilter, customStartDate, customEndDate, sortOption, itemsPerPage]);

  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / itemsPerPage));
  const paginatedSessions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredSessions.slice(start, start + itemsPerPage);
  }, [filteredSessions, currentPage, itemsPerPage]);

  const stats = useMemo(() => {
    const total = filteredSessions.length;
    const active = filteredSessions.filter(s => getSessionStatus(s).status === 'active').length;
    const loggedOut = filteredSessions.filter(s => getSessionStatus(s).status === 'logged_out').length;
    const terminated = filteredSessions.filter(s => getSessionStatus(s).status === 'terminated').length;
    const expired = filteredSessions.filter(s => getSessionStatus(s).status === 'expired').length;
    return { total, active, loggedOut, terminated, expired };
  }, [filteredSessions]);

  // Export handlers
  const handleExportCSV = () => {
    try {
      const headers = ['ID', 'User', 'Started At', 'Last Active / End Time', 'Duration', 'Device', 'OS', 'Browser', 'Mode', 'IP Address', 'Location', 'Battery', 'Action By', 'Action From', 'Status'];
      const rows = filteredSessions.map((s) => {
        const statusInfo = getSessionStatus(s);
        const actions = getSessionActions(s);
        const start = formatSingleLineDateTime(s.created_at);
        const end = statusInfo.status === 'active' ? 'Ongoing' : formatSingleLineDateTime(s.last_active_at);
        const duration = getDuration(s.created_at, s.last_active_at, statusInfo.status === 'active', durationFormat);
        const battery = s.battery_percentage !== undefined && s.battery_percentage !== null ? `${s.battery_percentage}%` : 'N/A';
        const parsed = parseDeviceAndOS(s.device_name);
        return [
          `"${s.id || ''}"`,
          `"${(s.user_full_name || s.user_email || 'User').replace(/"/g, '""')}"`,
          `"${start}"`,
          `"${end}"`,
          `"${duration}"`,
          `"${parsed.device.replace(/"/g, '""')}"`,
          `"${parsed.os}"`,
          `"${(s.browser_name || 'Chrome').replace(/"/g, '""')}"`,
          `"${s.is_incognito ? 'Private' : 'Normal'}"`,
          `"${s.ip_address || ''}"`,
          `"${(s.location || '').replace(/"/g, '""')}"`,
          `"${battery}"`,
          `"${(actions.actionBy || '').replace(/"/g, '""')}"`,
          `"${(actions.actionFrom || '').replace(/"/g, '""')}"`,
          `"${statusInfo.label}"`,
        ].join(',');
      });

      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `ceaznet_sessions_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setActiveDropdown(null);
    } catch (e) {
      alert('Failed to export CSV.');
    }
  };

  const handleExportJSON = () => {
    try {
      const exportObj = {
        app: 'Ceaznet',
        exported_at: new Date().toISOString(),
        total_records: filteredSessions.length,
        sessions: filteredSessions.map(s => {
          const actions = getSessionActions(s);
          return {
            ...s,
            action_by: actions.actionBy,
            action_from: actions.actionFrom,
            computed_status: getSessionStatus(s).label,
            parsed_device: parseDeviceAndOS(s.device_name)
          };
        })
      };
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportObj, null, 2));
      const link = document.createElement('a');
      link.setAttribute('href', dataStr);
      link.setAttribute('download', `ceaznet_sessions_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setActiveDropdown(null);
    } catch (e) {
      alert('Failed to export JSON.');
    }
  };

  const renderThreeDotsActionsMenu = useCallback(() => {
    return (
      <div className="relative inline-flex items-center shrink-0">
        <button
          ref={actionsBtnRef}
          onClick={(e) => {
            e.stopPropagation();
            toggleCustomDropdown('actions', actionsBtnRef.current);
          }}
          className={`p-1 cursor-pointer flex items-center justify-center transition-colors bg-transparent border-0 outline-none focus:outline-none ${
            activeDropdown === 'actions'
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
          title="Session Actions Menu"
          aria-label="Session Actions Menu"
        >
          <MoreVertical size={18} />
        </button>
      </div>
    );
  }, [activeDropdown]);

  const handleTerminateSingle = async () => {
    if (!terminateModal) return;
    try {
      await terminateUserSession(terminateModal.id, 'Administrator', 'System');
      setTerminateModal(null);
      await loadSessions();
      if (onRefreshParent) onRefreshParent();
    } catch (err) {
      alert("Failed to terminate session: " + (err as Error).message);
    }
  };

  const handleTerminateAll = async () => {
    const targetUserId = selectedUserFilter !== 'ALL' ? selectedUserFilter : userId;
    if (!targetUserId) return;
    try {
      const res = await terminateAllUserSessions(targetUserId, 'Administrator', 'System');
      setTerminateAllModal(false);
      await loadSessions();
      if (onRefreshParent) onRefreshParent();
      alert(`Successfully terminated ${res.count} active session(s).`);
    } catch (err) {
      alert("Failed to terminate all sessions: " + (err as Error).message);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModal) return;
    try {
      if (deleteModal.isBatch) {
        await deleteUserSessionsBatch(deleteModal.ids);
        setSelectedSessionIds(new Set());
      } else {
        await deleteUserSession(deleteModal.ids[0]);
      }
      setDeleteModal(null);
      await loadSessions();
      if (onRefreshParent) onRefreshParent();
    } catch (err) {
      alert("Failed to delete session record: " + (err as Error).message);
    }
  };

  const isAllSelected = paginatedSessions.length > 0 && paginatedSessions.every(s => selectedSessionIds.has(s.id));

  const handleSelectAll = () => {
    const currentPageIds = paginatedSessions.map(s => s.id);
    const next = new Set(selectedSessionIds);
    if (isAllSelected) {
      currentPageIds.forEach(id => next.delete(id));
    } else {
      currentPageIds.forEach(id => next.add(id));
    }
    setSelectedSessionIds(next);
  };

  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedSessionIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedSessionIds(next);
  };

  const handleCopyModalDetails = () => {
    if (!selectedSessionForModal) return;
    const s = selectedSessionForModal;
    const statusInfo = getSessionStatus(s);
    const actions = getSessionActions(s);
    const text = [
      `--- Ceaznet Session Record ---`,
      `User: ${s.user_full_name || s.user_email || 'User'}`,
      `Device: ${s.device_name || 'Unknown Device'}`,
      `IP Address: ${s.ip_address || 'N/A'}`,
      `Location: ${s.location || 'N/A'}`,
      `Started: ${formatSingleLineDateTime(s.created_at)}`,
      `Last Active: ${formatSingleLineDateTime(s.last_active_at)}`,
      `Action By: ${actions.actionBy}`,
      `Action From: ${actions.actionFrom}`,
      `Status: ${statusInfo.label}`,
      `Session ID: ${s.id || s.session_key}`,
    ].join('\n');
    navigator.clipboard.writeText(text);
    setIsCopiedDetails(true);
    setTimeout(() => setIsCopiedDetails(false), 2000);
  };

  const statusLabels: Record<StatusFilter, string> = {
    all: 'All Statuses',
    active: 'Active Only',
    logged_out: 'Logged Out',
    terminated: 'Terminated',
    expired: 'Expired',
  };

  const timeLabels: Record<TimeRangeFilter, string> = {
    all: 'All Time',
    '24h': 'Past 24 Hours',
    '7d': 'Past 7 Days',
    '30d': 'Past 30 Days',
    custom: 'Custom Range',
  };

  const sortLabels: Record<SortOption, string> = {
    newest: 'Newest First',
    oldest: 'Oldest First',
    browser_asc: 'Device Name (A-Z)',
    os_asc: 'OS (A-Z)'
  };

  return (
    <div className={`${compact ? 'space-y-2' : 'space-y-4'} font-sans text-[var(--text-primary)]`}>
      {/* Top Stats Cards (if not compact) */}
      {!compact && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            title="Total Sessions"
            value={stats.total}
            description="Matching current filter"
            icon={<Radio size={20} />}
            borderColor="border-indigo-500"
            trend={{ value: `${stats.active} Active`, label: "Currently live", positive: stats.active > 0 }}
          />
          <StatCard
            title="Active Sessions"
            value={stats.active}
            description="Users logged in right now"
            icon={<Power size={20} />}
            borderColor="border-emerald-500"
            trend={{ value: `${stats.terminated} Revoked`, label: "Terminated", neutral: true }}
          />
          <StatCard
            title="Logged Out"
            value={stats.loggedOut}
            description="User initiated sign-outs"
            icon={<Globe size={20} />}
            borderColor="border-blue-500"
            trend={{ value: `${stats.expired} Expired`, label: "Timeouts", neutral: true }}
          />
          <StatCard
            title="Terminated"
            value={stats.terminated}
            description="Remotely revoked sessions"
            icon={<ShieldAlert size={20} />}
            borderColor="border-red-500"
            trend={{ value: `${sessions.length}`, label: "Total history", neutral: true }}
          />
        </div>
      )}

      {/* Containerless Toolbar & Filters */}
      <div className={`space-y-2.5 ${compact ? 'px-3 pt-1' : ''}`}>
        {/* Unified Search and Filters Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 w-full">
          {/* Search Bar */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by IP, device, browser, OS, city, user..."
              className="w-full pl-8 pr-7 py-1.5 rounded-md text-xs bg-[var(--card-bg)] text-[var(--text-primary)] border border-[var(--border-color)] focus:outline-none focus:border-indigo-500 transition-colors h-9"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filters List: Shows in single row with horizontal scroll on mobile, and inline on desktop */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 shrink-0">
            {/* User Selector Dropdown */}
            {!userId && (allUsersList.length > 0 || sessions.length > 0) && (
              <button
                ref={userBtnRef}
                onClick={(e) => {
                  e.stopPropagation();
                  setUserSearchQuery('');
                  toggleCustomDropdown('user', userBtnRef.current);
                }}
                className={`px-2.5 py-1.5 rounded-md text-xs border transition-colors flex items-center gap-1.5 cursor-pointer font-medium h-9 shrink-0 whitespace-nowrap ${
                  activeDropdown === 'user' || selectedUserFilter !== 'ALL'
                    ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500/50 text-indigo-600 dark:text-indigo-400'
                    : 'bg-[var(--card-bg)] text-[var(--text-primary)] border-[var(--border-color)] hover:bg-[var(--subtle-bg)]'
                }`}
              >
                <span className="truncate max-w-[140px]">
                  {selectedUserDisplay}
                </span>
                <ChevronDown className="w-3.5 h-3.5 opacity-60 shrink-0" />
              </button>
            )}

            {/* Status Filter */}
            <button
              ref={statusBtnRef}
              onClick={(e) => {
                e.stopPropagation();
                toggleCustomDropdown('status', statusBtnRef.current);
              }}
              className={`px-2.5 py-1.5 rounded-md text-xs border transition-colors flex items-center gap-1.5 cursor-pointer font-medium h-9 shrink-0 whitespace-nowrap ${
                activeDropdown === 'status' || statusFilter !== 'all'
                  ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500/50 text-indigo-600 dark:text-indigo-400'
                  : 'bg-[var(--card-bg)] text-[var(--text-primary)] border-[var(--border-color)] hover:bg-[var(--subtle-bg)]'
              }`}
            >
              <span className="truncate">Status: {statusLabels[statusFilter]}</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-60 shrink-0" />
            </button>

            {/* Sort Filter */}
            <button
              ref={sortBtnRef}
              onClick={(e) => {
                e.stopPropagation();
                toggleCustomDropdown('sort', sortBtnRef.current);
              }}
              className={`px-2.5 py-1.5 rounded-md text-xs border transition-colors flex items-center gap-1.5 cursor-pointer font-medium h-9 shrink-0 whitespace-nowrap ${
                activeDropdown === 'sort' || sortOption !== 'newest'
                  ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500/50 text-indigo-600 dark:text-indigo-400'
                  : 'bg-[var(--card-bg)] text-[var(--text-primary)] border-[var(--border-color)] hover:bg-[var(--subtle-bg)]'
              }`}
            >
              <span className="truncate">Sort: {sortLabels[sortOption]}</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-60 shrink-0" />
            </button>

            {/* Time Range Filter */}
            <button
              ref={timeBtnRef}
              onClick={(e) => {
                e.stopPropagation();
                toggleCustomDropdown('time', timeBtnRef.current);
              }}
              className={`px-2.5 py-1.5 rounded-md text-xs border transition-colors flex items-center gap-1.5 cursor-pointer font-medium h-9 shrink-0 whitespace-nowrap ${
                activeDropdown === 'time' || timeRangeFilter !== 'all'
                  ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500/50 text-indigo-600 dark:text-indigo-400'
                  : 'bg-[var(--card-bg)] text-[var(--text-primary)] border-[var(--border-color)] hover:bg-[var(--subtle-bg)]'
              }`}
            >
              <span className="truncate">Time: {timeLabels[timeRangeFilter]}</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-60 shrink-0" />
            </button>

            {/* Fallback More Actions Button in Toolbar if Portal Target is not attached */}
            {!portalTarget && !compact && renderThreeDotsActionsMenu()}
          </div>
        </div>

        {/* Portaled Header Actions Menu for Main Page Title */}
        {!compact && portalTarget && createPortal(renderThreeDotsActionsMenu(), portalTarget)}

        {/* Portaled Custom Dropdowns */}
        {activeDropdown === 'user' && createPortal(
          <>
            <div className="fixed inset-0 z-[9998]" onClick={() => setActiveDropdown(null)} />
            <div
              style={{ top: `${dropdownPos.top}px`, left: `${dropdownPos.left}px` }}
              className="fixed z-[9999] w-72 max-w-[calc(100vw-24px)] bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md shadow-xl py-0 max-h-72 flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-1 text-xs"
            >
              {/* Search Header - Edge to Edge without nested border box */}
              <div className="relative border-b border-[var(--border-color)] bg-[var(--card-bg)] sticky top-0 z-10">
                <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Search users..."
                  className="w-full pl-10 pr-8 py-2.5 text-xs bg-transparent border-0 outline-none focus:outline-none ring-0 focus:ring-0 text-[var(--text-primary)] placeholder-slate-400"
                  autoFocus
                />
                {userSearchQuery && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setUserSearchQuery('');
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Users List */}
              <div className="overflow-y-auto custom-scrollbar flex-1 py-1">
                {(!userSearchQuery || 'all users'.includes(userSearchQuery.toLowerCase())) && (
                  <button
                    onClick={() => {
                      setSelectedUserFilter('ALL');
                      setActiveDropdown(null);
                    }}
                    className={`w-full px-3 py-1.5 text-left hover:bg-[var(--subtle-bg)] flex items-center justify-between gap-3 transition-colors whitespace-nowrap ${selectedUserFilter === 'ALL' ? 'text-indigo-600 font-semibold bg-indigo-50/50 dark:bg-indigo-950/30' : 'text-[var(--text-primary)]'}`}
                  >
                    <span className="truncate whitespace-nowrap">👥 All Users</span>
                    {selectedUserFilter === 'ALL' && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0 ml-2" />}
                  </button>
                )}

                {sortedAndFilteredUserOptions.length === 0 ? (
                  <div className="px-3 py-4 text-center text-slate-400 text-xs">
                    No users found
                  </div>
                ) : (
                  sortedAndFilteredUserOptions.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => {
                        setSelectedUserFilter(u.id);
                        setActiveDropdown(null);
                      }}
                      className={`w-full px-3 py-1.5 text-left hover:bg-[var(--subtle-bg)] flex items-center justify-between gap-3 transition-colors whitespace-nowrap ${selectedUserFilter === u.id ? 'text-indigo-600 font-semibold bg-indigo-50/50 dark:bg-indigo-950/30' : 'text-[var(--text-primary)]'}`}
                    >
                      <span className="truncate whitespace-nowrap">👤 {u.name} {u.email ? `(${u.email})` : `(ID: ${u.id.slice(0, 6)})`}</span>
                      {selectedUserFilter === u.id && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0 ml-2" />}
                    </button>
                  ))
                )}
              </div>
            </div>
          </>,
          document.body
        )}

        {activeDropdown === 'status' && createPortal(
          <>
            <div className="fixed inset-0 z-[9998]" onClick={() => setActiveDropdown(null)} />
            <div
              style={{ top: `${dropdownPos.top}px`, left: `${dropdownPos.left}px` }}
              className="fixed z-[9999] w-max max-w-[calc(100vw-24px)] bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md shadow-xl py-1 overflow-hidden animate-in fade-in slide-in-from-top-1 text-xs"
            >
              {(['all', 'active', 'logged_out', 'terminated', 'expired'] as StatusFilter[]).map((opt) => (
                <button
                  key={opt}
                  onClick={() => {
                    setStatusFilter(opt);
                    setActiveDropdown(null);
                  }}
                  className={`w-full px-3 py-1.5 text-left hover:bg-[var(--subtle-bg)] flex items-center justify-between gap-3 transition-colors whitespace-nowrap ${statusFilter === opt ? 'text-indigo-600 font-semibold bg-indigo-50/50 dark:bg-indigo-950/30' : 'text-[var(--text-primary)]'}`}
                >
                  <span className="truncate whitespace-nowrap">{statusLabels[opt]}</span>
                  {statusFilter === opt && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0 ml-2" />}
                </button>
              ))}
            </div>
          </>,
          document.body
        )}

        {activeDropdown === 'sort' && createPortal(
          <>
            <div className="fixed inset-0 z-[9998]" onClick={() => setActiveDropdown(null)} />
            <div
              style={{ top: `${dropdownPos.top}px`, left: `${dropdownPos.left}px` }}
              className="fixed z-[9999] w-max max-w-[calc(100vw-24px)] bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md shadow-xl py-1 overflow-hidden animate-in fade-in slide-in-from-top-1 text-xs"
            >
              {(['newest', 'oldest', 'browser_asc', 'os_asc'] as SortOption[]).map((opt) => (
                <button
                  key={opt}
                  onClick={() => {
                    setSortOption(opt);
                    setActiveDropdown(null);
                  }}
                  className={`w-full px-3 py-1.5 text-left hover:bg-[var(--subtle-bg)] flex items-center justify-between gap-3 transition-colors whitespace-nowrap ${sortOption === opt ? 'text-indigo-600 font-semibold bg-indigo-50/50 dark:bg-indigo-950/30' : 'text-[var(--text-primary)]'}`}
                >
                  <span className="truncate whitespace-nowrap">{sortLabels[opt]}</span>
                  {sortOption === opt && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0 ml-2" />}
                </button>
              ))}
            </div>
          </>,
          document.body
        )}

        {activeDropdown === 'time' && createPortal(
          <>
            <div className="fixed inset-0 z-[9998]" onClick={() => setActiveDropdown(null)} />
            <div
              style={{ top: `${dropdownPos.top}px`, left: `${dropdownPos.left}px` }}
              className="fixed z-[9999] w-max max-w-[calc(100vw-24px)] bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md shadow-xl py-1 overflow-hidden animate-in fade-in slide-in-from-top-1 text-xs"
            >
              {(['all', '24h', '7d', '30d', 'custom'] as TimeRangeFilter[]).map((opt) => (
                <button
                  key={opt}
                  onClick={() => {
                    setTimeRangeFilter(opt);
                    setActiveDropdown(null);
                  }}
                  className={`w-full px-3 py-1.5 text-left hover:bg-[var(--subtle-bg)] flex items-center justify-between gap-3 transition-colors whitespace-nowrap ${timeRangeFilter === opt ? 'text-indigo-600 font-semibold bg-indigo-50/50 dark:bg-indigo-950/30' : 'text-[var(--text-primary)]'}`}
                >
                  <span className="truncate whitespace-nowrap">{timeLabels[opt]}</span>
                  {timeRangeFilter === opt && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0 ml-2" />}
                </button>
              ))}
            </div>
          </>,
          document.body
        )}

        {/* Actions Dropdown Menu */}
        {activeDropdown === 'actions' && createPortal(
          <>
            <div className="fixed inset-0 z-[9998]" onClick={() => setActiveDropdown(null)} />
            <div
              style={{ top: `${dropdownPos.top}px`, left: `${dropdownPos.left}px` }}
              className="fixed z-[9999] w-max max-w-[calc(100vw-24px)] bg-[var(--card-bg)] border border-[var(--border-color)] rounded-md shadow-xl py-1 overflow-hidden animate-in fade-in slide-in-from-top-1 text-xs"
            >
              {selectedSessionIds.size > 0 && (
                <>
                  <div className="px-3.5 py-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider whitespace-nowrap">
                    Selected Items ({selectedSessionIds.size})
                  </div>
                  <button
                    onClick={() => {
                      setActiveDropdown(null);
                      setDeleteModal({ ids: Array.from(selectedSessionIds), isBatch: true });
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2.5 transition-colors cursor-pointer font-medium whitespace-nowrap"
                  >
                    <Trash2 size={14} className="shrink-0" />
                    <span>Delete Selected ({selectedSessionIds.size})</span>
                  </button>
                  <div className="my-1 border-t border-[var(--border-color)]" />
                </>
              )}

              <div className="px-3.5 py-1 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                Global Actions
              </div>
              <button
                onClick={() => {
                  setActiveDropdown(null);
                  setTerminateAllModal(true);
                }}
                disabled={stats.active === 0}
                className="w-full px-3.5 py-2 text-left text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 flex items-center gap-2.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed font-medium whitespace-nowrap"
              >
                <Power size={14} className="shrink-0" />
                <span>Terminate All Active ({stats.active})</span>
              </button>
              <button
                onClick={() => {
                  setActiveDropdown(null);
                  const inactiveIds = sessions.filter(s => getSessionStatus(s).status !== 'active').map(s => s.id);
                  if (inactiveIds.length > 0) {
                    setDeleteModal({ ids: inactiveIds, isBatch: true });
                  }
                }}
                disabled={stats.loggedOut + stats.terminated + stats.expired === 0}
                className="w-full px-3.5 py-2 text-left text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed font-medium whitespace-nowrap"
              >
                <Trash2 size={14} className="shrink-0" />
                <span>Clear All Inactive Records</span>
              </button>

              <div className="my-1 border-t border-[var(--border-color)]" />
              <div className="px-3.5 py-1 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                Export Options
              </div>
              <button
                onClick={() => {
                  setActiveDropdown(null);
                  handleExportCSV();
                }}
                className="w-full px-3.5 py-2 text-left text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 flex items-center gap-2.5 transition-colors cursor-pointer font-medium whitespace-nowrap"
              >
                <Download size={14} className="shrink-0 text-indigo-500" />
                <span>Export as CSV</span>
              </button>
              <button
                onClick={() => {
                  setActiveDropdown(null);
                  handleExportJSON();
                }}
                className="w-full px-3.5 py-2 text-left text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 flex items-center gap-2.5 transition-colors cursor-pointer font-medium whitespace-nowrap"
              >
                <Download size={14} className="shrink-0 text-emerald-500" />
                <span>Export as JSON</span>
              </button>
            </div>
          </>,
          document.body
        )}

        {/* Custom Date Range Selector if active */}
        {timeRangeFilter === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 p-2 bg-[var(--subtle-bg)] border border-[var(--border-color)] rounded-xl text-xs">
            <div className="flex items-center gap-1 text-[var(--text-secondary)]">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              <span>Range:</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--text-secondary)] text-[11px]">From:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-2 py-1 rounded-lg bg-[var(--card-bg)] text-[var(--text-primary)] border border-[var(--border-color)] text-[11px] font-mono"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--text-secondary)] text-[11px]">To:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-2 py-1 rounded-lg bg-[var(--card-bg)] text-[var(--text-primary)] border border-[var(--border-color)] text-[11px] font-mono"
              />
            </div>
            {(customStartDate || customEndDate) && (
              <button
                onClick={() => {
                  setCustomStartDate('');
                  setCustomEndDate('');
                }}
                className="text-[11px] text-indigo-600 hover:underline ml-auto font-medium cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        )}
      </div>

      {/* Containerless Full-Bleed Table Layout (matching SessionDetailsView.tsx) */}
      <div className="flex flex-col">
        <div 
          ref={tableScrollRef} 
          className={`overflow-x-auto no-scrollbar ${
            compact 
              ? 'w-full border-t border-b' 
              : 'mx-[-12px] sm:mx-[-16px] lg:mx-[-24px] w-[calc(100%+24px)] sm:w-[calc(100%+32px)] lg:w-[calc(100%+48px)] border-t border-b'
          } border-[var(--border-color)] bg-[var(--card-bg)] text-left`}
        >
          {loading ? (
            <div className="w-full py-16 flex flex-col items-center justify-center gap-2.5 text-[var(--text-secondary)]">
              <Loader size={24} className="animate-spin text-indigo-500" />
              <p className="font-medium text-xs">Loading sessions registry...</p>
            </div>
          ) : paginatedSessions.length === 0 ? (
            <div className="w-full py-16 flex flex-col items-center justify-center gap-2 text-[var(--text-secondary)]">
              <ShieldCheck className="w-8 h-8 text-slate-400 opacity-50" />
              <p className="font-medium text-xs">No matching sessions found</p>
              <p className="text-[11px]">Try adjusting your search query or status filters</p>
            </div>
          ) : (
            <table className="w-full text-left font-mono text-[10px] leading-normal border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-[var(--subtle-bg)] text-[var(--text-secondary)] uppercase tracking-wider border-b border-[var(--border-color)] text-[8px]">
                  <th className="py-2.5 px-3 font-semibold text-left whitespace-nowrap w-8">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-gray-400 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      checked={isAllSelected}
                      onChange={handleSelectAll}
                    />
                  </th>
                  {!userId && (
                    <th className="py-2.5 px-3 font-semibold text-left whitespace-nowrap">User</th>
                  )}
                  <th className="py-2.5 px-3 font-semibold text-left whitespace-nowrap">Session Start</th>
                  <th className="py-2.5 px-3 font-semibold text-left whitespace-nowrap">Session End</th>
                  <th 
                    onClick={() => setDurationFormat(prev => prev === 'human' ? 'hms' : 'human')}
                    className="py-2.5 px-3 font-semibold text-left whitespace-nowrap cursor-pointer hover:text-indigo-600 transition-colors select-none"
                    title="Click to toggle format (Words vs HH:MM:SS)"
                  >
                    Duration
                  </th>
                  <th className="py-2.5 px-3 font-semibold text-left whitespace-nowrap">Device</th>
                  <th className="py-2.5 px-3 font-semibold text-left whitespace-nowrap">Browser</th>
                  <th className="py-2.5 px-3 font-semibold text-left whitespace-nowrap">Mode</th>
                  <th className="py-2.5 px-3 font-semibold text-left whitespace-nowrap">OS</th>
                  <th className="py-2.5 px-3 font-semibold text-left whitespace-nowrap">IP Address</th>
                  <th className="py-2.5 px-3 font-semibold text-left whitespace-nowrap">Location</th>
                  <th className="py-2.5 px-3 font-semibold text-left whitespace-nowrap">Battery</th>
                  <th className="py-2.5 px-3 font-semibold text-left whitespace-nowrap text-amber-600 dark:text-amber-400">Action By</th>
                  <th className="py-2.5 px-3 font-semibold text-left whitespace-nowrap text-blue-600 dark:text-blue-400">Action From</th>
                  <th className="py-2.5 px-3 font-semibold text-left whitespace-nowrap">Status</th>
                  <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)] text-[var(--text-primary)]">
                {paginatedSessions.map((session) => {
                  const statusInfo = getSessionStatus(session);
                  const isCurrent = session.is_current;
                  const durationStr = getDuration(session.created_at, session.last_active_at, statusInfo.status === 'active', durationFormat);
                  const isSelected = selectedSessionIds.has(session.id);
                  const parsedDevice = parseDeviceAndOS(session.device_name);
                  const actions = getSessionActions(session);

                  return (
                    <tr 
                      key={session.id} 
                      className={`hover:bg-[var(--subtle-bg)] transition-colors ${isSelected ? 'bg-indigo-500/10' : ''}`}
                    >
                      {/* Checkbox */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-left">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 rounded border-gray-400 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(session.id)}
                        />
                      </td>

                      {/* User (if not scoped to single user) */}
                      {!userId && (
                        <td className="py-2.5 px-3 text-left whitespace-nowrap">
                          <span className="font-bold text-[11px] text-[var(--text-primary)] block truncate max-w-[120px]">
                            {session.user_full_name || session.user_email || 'User'}
                          </span>
                        </td>
                      )}

                      {/* Started At */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-left">
                        <span className="text-[var(--text-primary)] font-medium">
                          {formatSingleLineDateTime(session.created_at)}
                        </span>
                      </td>

                      {/* End Time */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-left">
                        {statusInfo.status === 'active' ? (
                          <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400 font-medium">
                            Ongoing
                          </span>
                        ) : (
                          <span className="text-[var(--text-secondary)] font-medium">
                            {formatSingleLineDateTime(session.last_active_at)}
                          </span>
                        )}
                      </td>

                      {/* Duration */}
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[var(--text-secondary)] text-left">
                        {durationStr}
                      </td>

                      {/* Device */}
                      <td className="py-2.5 px-3 text-left">
                        <span className="font-semibold truncate text-[10px] block max-w-[150px]" title={session.device_name}>
                          {parsedDevice.device}
                        </span>
                      </td>

                      {/* Browser */}
                      <td className="py-2.5 px-3 text-left whitespace-nowrap">
                        <span className="text-[var(--text-primary)] font-medium truncate max-w-[100px] block" title={session.browser_name || 'Chrome'}>
                          {session.browser_name || 'Chrome'}
                        </span>
                      </td>

                      {/* Mode */}
                      <td className="py-2.5 px-3 text-left whitespace-nowrap">
                        {session.is_incognito ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 uppercase tracking-wide">
                            Private
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/20 uppercase tracking-wide">
                            Normal
                          </span>
                        )}
                      </td>

                      {/* OS */}
                      <td className="py-2.5 px-3 text-left">
                        <span className="text-[var(--text-secondary)] font-medium">
                          {parsedDevice.os}
                        </span>
                      </td>

                      {/* IP Address */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-left">
                        <button
                          onClick={() => setSelectedSessionForModal(session)}
                          className="font-mono text-[10px] text-[var(--text-primary)] hover:text-purple-600 dark:hover:text-purple-400 font-bold hover:underline cursor-pointer max-w-[110px] truncate block bg-transparent border-0 p-0 text-left"
                          title={session.ip_address || '-'}
                        >
                          {session.ip_address || '-'}
                        </button>
                      </td>

                      {/* Location */}
                      <td className="py-2.5 px-3 text-left">
                        <button
                          onClick={() => setSelectedSessionForModal(session)}
                          className="text-[10px] text-[var(--text-primary)] hover:text-purple-600 dark:hover:text-purple-400 font-medium hover:underline cursor-pointer max-w-[130px] sm:max-w-[150px] truncate block bg-transparent border-0 p-0 text-left"
                          title={session.location || 'Unknown Location'}
                        >
                          <span className="truncate">{session.location || 'Unknown Location'}</span>
                        </button>
                      </td>

                      {/* Battery Percentage */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-left font-mono text-[10px]">
                        <span className="font-semibold text-[var(--text-primary)]">
                          {session.battery_percentage !== undefined && session.battery_percentage !== null ? `${session.battery_percentage}%` : 'N/A'}
                        </span>
                      </td>

                      {/* Action By */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-left font-mono text-[10px]">
                        <span className="font-semibold text-amber-600 dark:text-amber-400">
                          {actions.actionBy}
                        </span>
                      </td>

                      {/* Action From */}
                      <td className="py-2.5 px-3 text-left font-mono text-[10px]">
                        <span className="font-semibold text-blue-600 dark:text-blue-400 truncate block max-w-[150px]" title={actions.actionFrom}>
                          {actions.actionFrom}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-left">
                        {statusInfo.status === 'active' && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase tracking-wide">
                            Active
                          </span>
                        )}
                        {statusInfo.status === 'logged_out' && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 uppercase tracking-wide">
                            Logged Out
                          </span>
                        )}
                        {statusInfo.status === 'terminated' && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 uppercase tracking-wide">
                            Terminated
                          </span>
                        )}
                        {statusInfo.status === 'expired' && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/20 uppercase tracking-wide">
                            Expired
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        {isCurrent ? (
                          <span className="text-[9px] text-purple-600 dark:text-purple-400 font-bold uppercase tracking-wider shrink-0 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                            Current
                          </span>
                        ) : isRowActionRunning === session.id ? (
                          <div className="flex items-center justify-end gap-1 text-[9px] font-mono text-gray-400">
                            <span className="w-2.5 h-2.5 border border-gray-400/40 border-t-purple-500 rounded-full animate-spin inline-block"></span>
                            <span>{confirmingDeleteId === session.id ? 'Deleting...' : 'Terminating...'}</span>
                          </div>
                        ) : confirmingTerminateId === session.id ? (
                          <div className="flex items-center justify-end gap-1.5 text-[9px] font-mono">
                            <button
                              type="button"
                              onClick={() => setConfirmingTerminateId(null)}
                              className="text-gray-400 hover:text-gray-700 dark:hover:text-white cursor-pointer uppercase font-semibold tracking-wider bg-transparent border-0 p-0"
                            >
                              Cancel
                            </button>
                            <span className="text-gray-400 dark:text-neutral-600">|</span>
                            <button
                              type="button"
                              onClick={async () => {
                                setIsRowActionRunning(session.id);
                                try {
                                  await terminateUserSession(session.id, 'Administrator', 'System');
                                  await loadSessions();
                                  if (onRefreshParent) onRefreshParent();
                                } catch (e) {
                                  console.error(e);
                                  alert("Failed to terminate session: " + (e as Error).message);
                                } finally {
                                  setIsRowActionRunning(null);
                                  setConfirmingTerminateId(null);
                                }
                              }}
                              className="text-red-500 hover:text-red-600 dark:hover:text-red-400 font-bold hover:underline cursor-pointer uppercase tracking-wider bg-transparent border-0 p-0"
                            >
                              Terminate
                            </button>
                          </div>
                        ) : confirmingDeleteId === session.id ? (
                          <div className="flex items-center justify-end gap-1.5 text-[9px] font-mono">
                            <button
                              type="button"
                              onClick={() => setConfirmingDeleteId(null)}
                              className="text-gray-400 hover:text-gray-700 dark:hover:text-white cursor-pointer uppercase font-semibold tracking-wider bg-transparent border-0 p-0"
                            >
                              Cancel
                            </button>
                            <span className="text-gray-400 dark:text-neutral-600">|</span>
                            <button
                              type="button"
                              onClick={async () => {
                                setIsRowActionRunning(session.id);
                                try {
                                  await deleteUserSession(session.id);
                                  await loadSessions();
                                  if (onRefreshParent) onRefreshParent();
                                } catch (e) {
                                  console.error(e);
                                  alert("Failed to delete session record: " + (e as Error).message);
                                } finally {
                                  setIsRowActionRunning(null);
                                  setConfirmingDeleteId(null);
                                }
                              }}
                              className="text-amber-500 dark:text-amber-400 hover:text-amber-600 font-bold hover:underline cursor-pointer uppercase tracking-wider bg-transparent border-0 p-0"
                            >
                              Delete
                            </button>
                          </div>
                        ) : statusInfo.status === 'active' ? (
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmingTerminateId(session.id);
                              setConfirmingDeleteId(null);
                            }}
                            className="text-red-500 hover:text-red-600 dark:hover:text-red-400 font-bold hover:underline cursor-pointer text-[9px] uppercase tracking-wider bg-transparent border-0 p-0"
                            title="Remotely terminate this active session"
                          >
                            Terminate
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmingDeleteId(session.id);
                              setConfirmingTerminateId(null);
                            }}
                            className="text-amber-500 dark:text-amber-400 hover:text-amber-600 font-bold hover:underline cursor-pointer text-[9px] uppercase tracking-wider bg-transparent border-0 p-0"
                            title="Delete session record"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Table Footer with Pagination Controls */}
        <div className={`px-3 ${compact ? 'py-2.5 border-b-0' : 'py-3 border-b'} border-[var(--border-color)] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--text-secondary)]`}>
          <div className="flex items-center gap-3">
            <span>
              Showing <strong className="text-[var(--text-primary)]">{filteredSessions.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</strong> to <strong className="text-[var(--text-primary)]">{Math.min(currentPage * itemsPerPage, filteredSessions.length)}</strong> of <strong className="text-[var(--text-primary)]">{filteredSessions.length}</strong> sessions
            </span>

            <div className="flex items-center gap-1.5">
              <span>Per page:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg px-2 py-1 text-xs text-[var(--text-primary)] focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-2.5 py-1 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] hover:bg-[var(--subtle-bg)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1 text-xs cursor-pointer font-medium text-[var(--text-primary)]"
            >
              <ChevronLeft size={14} />
              Prev
            </button>

            <span className="px-2 font-medium text-[var(--text-primary)]">
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-2.5 py-1 rounded-lg border border-[var(--border-color)] bg-[var(--card-bg)] hover:bg-[var(--subtle-bg)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1 text-xs cursor-pointer font-medium text-[var(--text-primary)]"
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Batch Action Toolbar */}
      {selectedSessionIds.size > 0 && (
        <BatchActionToolbar
          selectedCount={selectedSessionIds.size}
          totalCount={filteredSessions.length}
          isAllSelected={isAllSelected}
          onSelectAll={handleSelectAll}
          onCancel={() => setSelectedSessionIds(new Set())}
          onDelete={() => setDeleteModal({ ids: Array.from(selectedSessionIds), isBatch: true })}
        />
      )}

      {/* Telemetry Detail Modal (Matching SessionDetailsView.tsx) */}
      {selectedSessionForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--subtle-bg)]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  Session Node Telemetry Details
                </h3>
              </div>
              <button
                onClick={() => setSelectedSessionForModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-[var(--text-primary)] hover:bg-[var(--border-color)] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 flex flex-col divide-y divide-[var(--border-color)] text-xs">
              {/* User Account */}
              <div className="py-2 flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-wider">Target User</span>
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  {selectedSessionForModal.user_full_name || selectedSessionForModal.user_email || 'Anonymous User'}
                </span>
              </div>

              {/* Device & Client */}
              <div className="py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-wider">Device & Client</span>
                <div className="flex flex-col sm:items-end gap-0.5">
                  <span className="text-xs font-semibold text-[var(--text-primary)]">
                    {selectedSessionForModal.device_name || 'Generic Web Device'}
                  </span>
                  {selectedSessionForModal.is_current && (
                    <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 w-fit sm:self-end">
                      Current Active Device
                    </span>
                  )}
                </div>
              </div>

              {/* Status */}
              <div className="py-2 flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-wider">Status</span>
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  {getSessionStatus(selectedSessionForModal).label}
                </span>
              </div>

              {/* Public IP Address */}
              <div className="py-2 flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-wider">Public IP Address</span>
                <span className="font-mono text-xs font-semibold text-[var(--text-primary)] select-all">
                  {selectedSessionForModal.ip_address || '127.0.0.1'}
                </span>
              </div>

              {/* Geo-Location Metadata */}
              <div className="py-2 flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-wider">Geo-Location Metadata</span>
                <span className="text-xs font-medium text-[var(--text-primary)] flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                  <span>{selectedSessionForModal.location || 'Unknown Location Coordinates'}</span>
                </span>
              </div>

              {/* Battery Status */}
              <div className="py-2 flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-wider">Battery Status</span>
                <span className="font-mono text-xs font-semibold text-[var(--text-primary)]">
                  {selectedSessionForModal.battery_percentage !== undefined && selectedSessionForModal.battery_percentage !== null ? `${selectedSessionForModal.battery_percentage}%` : 'N/A'}
                </span>
              </div>

              {/* Session Started */}
              <div className="py-2 flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-wider">Session Started</span>
                <span className="text-xs font-medium text-[var(--text-primary)]">
                  {formatSingleLineDateTime(selectedSessionForModal.created_at)}
                </span>
              </div>

              {/* Last Heartbeat */}
              <div className="py-2 flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-wider">Last Heartbeat</span>
                <span className="text-xs font-medium text-[var(--text-primary)]">
                  {formatSingleLineDateTime(selectedSessionForModal.last_active_at)}
                </span>
              </div>

              {/* Action By */}
              <div className="py-2 flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 tracking-wider">Action By</span>
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  {getSessionActions(selectedSessionForModal).actionBy}
                </span>
              </div>

              {/* Action From */}
              <div className="py-2 flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 tracking-wider">Action From</span>
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  {getSessionActions(selectedSessionForModal).actionFrom}
                </span>
              </div>

              {/* Unique Session Identifier */}
              <div className="py-2 flex flex-col gap-1">
                <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-wider">Unique Session Identifier</span>
                <span className="font-mono text-[10px] text-[var(--text-secondary)] break-all select-all">
                  {selectedSessionForModal.id || selectedSessionForModal.session_key}
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 px-4 border-t border-[var(--border-color)] bg-[var(--subtle-bg)] flex items-center justify-between">
              <button
                onClick={handleCopyModalDetails}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--card-bg)] hover:bg-[var(--border-color)] text-[var(--text-primary)] border border-[var(--border-color)] text-xs font-medium transition-colors cursor-pointer"
              >
                {isCopiedDetails ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Full Audit</span>
                  </>
                )}
              </button>
              <button
                onClick={() => setSelectedSessionForModal(null)}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modals */}
      <ConfirmationModal
        isOpen={terminateModal !== null}
        onClose={() => setTerminateModal(null)}
        onConfirm={handleTerminateSingle}
        title="Terminate User Session"
        message={`Are you sure you want to terminate the active session for "${terminateModal?.deviceName || 'this device'}"? The user will be immediately signed out from this device.`}
        confirmText="Yes, Terminate Session"
        confirmButtonClass="btn-danger"
      />

      <ConfirmationModal
        isOpen={terminateAllModal}
        onClose={() => setTerminateAllModal(false)}
        onConfirm={handleTerminateAll}
        title="Terminate All User Sessions"
        message={`Are you sure you want to terminate ALL active sessions for this target user? This will log out all currently connected devices (${stats.active} live).`}
        confirmText={`Yes, Terminate ${stats.active} Sessions`}
        confirmButtonClass="btn-danger"
      />

      <ConfirmationModal
        isOpen={deleteModal !== null}
        onClose={() => setDeleteModal(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Session Record"
        message={
          deleteModal?.isBatch 
            ? `Are you sure you want to permanently delete ${deleteModal.ids.length} session log record(s)?`
            : "Are you sure you want to permanently delete this session log record?"
        }
        confirmText="Delete Record"
        confirmButtonClass="btn-danger"
      />
    </div>
  );
};

export default UserSessionsViewer;

