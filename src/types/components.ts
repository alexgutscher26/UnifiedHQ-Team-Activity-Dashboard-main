/**
 * Comprehensive TypeScript types for components
 */

// Activity Feed Types
export interface ActivityMetadata {
  eventType?:
    | 'commit'
    | 'pull_request'
    | 'issue'
    | 'release'
    | 'push'
    | 'create'
    | 'delete'
    | 'message';
  url?: string;
  actor?: {
    login?: string;
    display_login?: string;
    name?: string;
    avatar_url: string;
    html_url?: string;
  };
  channel?: {
    id: string;
    name: string;
    type: string;
  };
  payload?: {
    action?: string;
    ref?: string;
    ref_type?: string;
    head?: string;
    base?: string;
    commits?: Array<{
      sha: string;
      message: string;
      author: {
        name: string;
        email: string;
      };
    }>;
    commit?: {
      sha: string;
      message: string;
      url?: string;
      author: {
        name: string;
        email: string;
      };
    };
    pull_request?: {
      number: number;
      title: string;
      state: string;
      url?: string;
      html_url: string;
    };
    issue?: {
      number: number;
      title: string;
      state: string;
      url?: string;
      html_url: string;
    };
    message?: {
      text: string;
      ts: string;
      thread_ts?: string;
      reply_count?: number;
      reactions?: Array<{
        name: string;
        count: number;
        users: string[];
      }>;
    };
  };
  author?: {
    name: string;
    avatar?: string;
    email?: string;
  };
  repository?: {
    name: string;
    owner: string;
    url?: string;
  };
  pullRequest?: {
    number: number;
    title: string;
    state: 'open' | 'closed' | 'merged';
    url?: string;
  };
  commit?: {
    sha: string;
    message: string;
    url?: string;
  };
  issue?: {
    number: number;
    title: string;
    state: 'open' | 'closed';
    url?: string;
  };
  tags?: string[];
  labels?: string[];
  assignees?: string[];
  reviewers?: string[];
}

export interface Activity {
  id: string;
  source: string;
  title: string;
  description?: string;
  timestamp: Date | string;
  externalId?: string;
  metadata?: ActivityMetadata;
}

// AI Summary Types
export interface AISummaryData {
  highlights: string[];
  actionItems: string[];
  generatedAt: string;
  confidence?: number;
  sources?: string[];
}

// Section Cards Stats Types
export interface IntegrationStats {
  github: {
    repositories: number;
    pullRequests: number;
    commits: number;
    issues: number;
    lastActivity: string;
  };
  slack: {
    channels: number;
    messages: number;
    mentions: number;
    lastActivity: string;
  };
}

export interface StatsData {
  integrations: IntegrationStats;
  summary: {
    totalActivities: number;
    activeRepositories: number;
    pendingReviews: number;
    urgentItems: number;
    summaryCount: number;
  };
  lastUpdated: string;
}

// Memory Monitor Types
export interface MemorySnapshot {
  timestamp: number;
  used: number;
  total: number;
  percentage: number;
  memory: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
  components: {
    [componentName: string]: {
      count: number;
      memory: number;
    };
  };
}

// Image Gallery Types
export interface GalleryImage {
  src: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
  thumbnail?: string;
}

// Repository Types
export interface Repository {
  id: number;
  name: string;
  owner: string;
  fullName: string;
  description?: string;
  url: string;
  private: boolean;
  language?: string;
  stars: number;
  forks: number;
  lastUpdated: string;
  defaultBranch: string;
}

// Integration Types
export interface Integration {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  status: 'connected' | 'disconnected' | 'error' | 'loading';
  description?: string;
  lastSync?: string;
  config?: Record<string, any>;
}

// Theme Types
export interface ThemeConfig {
  name: string;
  label: string;
  description: string;
  preview: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    foreground: string;
  };
}

// Error Boundary Types
export interface ErrorInfo {
  componentStack: string;
  errorBoundary?: string;
  errorBoundaryStack?: string;
}

// Optimized Image Types
export type ImageQuality = 'hero' | 'card' | 'thumbnail' | 'avatar' | number;

export interface OptimizedImageConfig {
  width?: number;
  height?: number;
  quality: ImageQuality;
  priority?: boolean;
  className?: string;
  sizes?: string;
}

// Loading States
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface LoadingConfig {
  state: LoadingState;
  message?: string;
  progress?: number;
}

// Connection States
export type ConnectionState =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

// Event Source Types
export interface EventSourceConfig {
  url: string;
  withCredentials?: boolean;
  headers?: Record<string, string>;
}

// Toast Types
export interface ToastConfig {
  id: string;
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive' | 'success' | 'warning';
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// Form Types
export interface FormFieldConfig {
  name: string;
  label: string;
  type:
    | 'text'
    | 'email'
    | 'password'
    | 'number'
    | 'select'
    | 'textarea'
    | 'checkbox'
    | 'radio';
  required?: boolean;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  validation?: {
    min?: number;
    max?: number;
    pattern?: RegExp;
    message?: string;
  };
}

// User Types
export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role?: 'admin' | 'user' | 'viewer';
  preferences?: UserPreferences;
}

export interface UserPreferences {
  theme: string;
  notifications: {
    email: boolean;
    push: boolean;
    slack: boolean;
  };
  dashboard: {
    layout: 'grid' | 'list';
    showSidebar: boolean;
    compactMode: boolean;
  };
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// GitHub Integration Types
export interface GitHubConfig {
  accessToken: string;
  userId: string;
  selectedRepositories: string[];
  webhookSecret?: string;
}

export interface GitHubActivity {
  id: string;
  type: 'commit' | 'pull_request' | 'issue' | 'release';
  repository: string;
  title: string;
  description?: string;
  author: string;
  timestamp: string;
  url: string;
  metadata: ActivityMetadata;
}

// Cache Types
export interface CacheConfig {
  ttl: number;
  maxSize: number;
  strategy: 'lru' | 'fifo' | 'ttl';
}

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number;
  hits: number;
}

// Performance Types
export interface PerformanceMetrics {
  renderTime: number;
  memoryUsage: number;
  componentCount: number;
  errorCount: number;
  lastUpdated: string;
}

// Branch Management Types
export interface BranchInfo {
  name: string;
  type: 'feature' | 'bugfix' | 'hotfix' | 'release' | 'main' | 'develop';
  status: 'active' | 'merged' | 'stale' | 'conflict';
  lastCommit: string;
  author: string;
  age: string;
  ahead: number;
  behind: number;
}

// Release Types
export interface ReleaseInfo {
  version: string;
  branch: string;
  status: 'draft' | 'ready' | 'deployed' | 'failed';
  changelog: string[];
  author: string;
  createdAt: string;
  deployedAt?: string;
}

// Hotfix Types
export interface HotfixInfo {
  branch: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  author: string;
  createdAt: string;
  status: 'active' | 'merged' | 'deployed' | 'rolled_back';
  age: string;
  affectedVersions: string[];
}
