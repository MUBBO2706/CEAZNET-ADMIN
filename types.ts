
export interface NewsLog {
  id: number;
  created_at: string;
  status: 'SUCCESS' | 'FAILURE' | 'ERROR' | 'WARNING' | 'WARN';
  duration_ms: number;
  summary: string[];
  details: string;
}

export interface NewsConfig {
  gnews_api_keys: string[];
  gemini_api_keys: string[];
}

export interface NewsApiKey {
  id: string;
  provider: 'gnews' | 'gemini' | 'brevo';
  api_key: string;
  account_name?: string;
  status: 'active' | 'exhausted';
  calls_count: number;
  daily_call_count: number;
  failure_count: number;
  last_reset_at: string;
  created_at: string;
}

export interface ApiKeyDailyUsage {
    id: string;
    api_key_id: string;
    provider: string;
    usage_date: string;
    calls_count: number;
    failure_count: number;
    created_at: string;
}

export interface NewsSystemConfig {
  id: string;
  config_key: string;
  config_value: any;
  description: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  full_name: string;
  avatar_url: string;
  email: string;
  created_at: string;
  updated_at?: string;
  last_sign_in_at?: string;
  providers?: string[];
  is_suspended?: boolean;
}

export interface UserSettings {
    user_id: string;
    voice_proactive_mode: boolean;
    voice_mode_persona_instruction: string;
    voice_mode_tone_instruction?: string;
    voice_mode_custom_instruction?: string;
    voice_mode_voice: string;
    api_key?: string;
    updated_at?: string;
    translator_usage?: {
      input?: number;
      output?: number;
    };
    last_molecule?: string;
    last_molecule_settings?: {
      style?: string;
      autoRotate?: boolean;
      showLabels?: boolean;
      showElectrons?: boolean;
      showHydrogens?: boolean;
      showElectronCloud?: boolean;
    };
    voice_persona?: string;
    voice_recording_enabled?: boolean;
}

export interface UserStats {
  user: UserProfile;
  conversation_count: number;
  settings?: UserSettings;
  vehicles_count?: number;
  finance_tx_count?: number;
  dairy_entries_count?: number;
  gallery_items_count?: number;
  notes_count?: number;
}

export interface NewsArticle {
    id: number;
    created_at: string;
    category: string;
    article_data: {
        title: string;
        url: string;
        source?: { name: string };
        publishedAt?: string;
        image?: string;
    };
    views: number;
    likes: number;
}

export interface ArticleStats {
  category: string;
  views: number;
  likes: number;
  bookmarks: number;
}

export interface ArticleEngagementData {
  totalViews: number;
  totalLikes: number;
  totalBookmarks: number;
  statsByCategory: ArticleStats[];
  topArticles: { title: string; url: string; views: number }[];
}

export interface RecentActivityLog {
  id: number | string;
  type: string;
  table: string;
  method: 'GET' | 'POST' | 'INSERT' | 'UPDATE' | 'DELETE' | 'EXECUTE' | 'SYSTEM' | 'USER';
  timestamp: string;
  description: string;
  status: 'SUCCESS' | 'FAILURE' | 'PENDING' | 'ERROR';
  payload?: any;
  source?: string;
  duration_ms?: number;
}

export interface MainDashboardData {
  totalApiRequests: number;
  successApiRequests: number;
  failedApiRequests: number;
  totalUsers: number;
  totalArticles: number;
  recentActivity: RecentActivityLog[];
  databaseMetrics?: DatabaseAnalyticsStats[];
  edgeFunctionMetrics?: EdgeFunctionStats[];
  totalPublicContent?: number;
  totalActivityLogs?: number;
  articlesByCategory?: { category: string; count: number }[];
  totalFinanceTransactions?: number;
  totalDairyEntries?: number;
  totalGalleryItems?: number;
  totalNotes?: number;
  totalVehicles?: number;
  financeTransactionsByType?: { name: string; value: number }[];
  newsUpdaterStats?: { successful: number; failed: number; total: number };
}
// Types for Settings Page
export interface TableDetails {
    tableName: string;
    rowCount: number;
    columns: string[];
    recentRows: any[];
    lastUsed?: string | null;
}

// NEW: Type for Developer Profile, now with index signature for flexibility
export interface DeveloperProfile {
    [key: string]: string | number | '';
}
export interface ChatMessage {
    id?: number;
    session_id: string;
    role: 'user' | 'model';
    content: any; // Stored as JSONB
    created_at?: string;
}

export interface ChatSession {
    session_id: string;
    title: string | null;
    last_message_at: string;
}

export interface DatabaseAnalyticsStats {
    table_name: string;
    live_rows: number;
    total_inserts: number;
    total_updates: number;
    total_deletes: number;
    last_used?: string | null;
}

export interface EdgeFunctionStats {
    function_name: string;
    total_calls: number;
    success_count: number;
    error_count: number;
    last_run: string | null;
}

export interface PublicContentItem {
    key: string;
    content: any;
    created_at: string;
    updated_at: string;
}

export interface TrendDataPoint {
    time: string;
    count: number;
}

export interface DistributionDataPoint {
    name: string;
    count: number;
}

export interface BarDataPoint {
    name: string;
    count: number;
}
