// Types for offline functionality and background sync

export interface OfflineAction {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  resource: string;
  payload: any;
  timestamp: number;
  retryCount: number;
  status: 'PENDING' | 'SYNCING' | 'COMPLETED' | 'FAILED';
  lastAttempt?: number;
  error?: string;
}

export interface QueueStats {
  totalActions: number;
  pendingActions: number;
  failedActions: number;
  completedActions: number;
  lastSync?: number;
}

export interface SyncResult {
  success: boolean;
  processedActions: number;
  failedActions: number;
  errors: Array<{ actionId: string; error: string }>;
}

export interface ConflictResolution {
  strategy: 'client-wins' | 'server-wins' | 'merge' | 'manual';
  resolvedData?: any;
  requiresUserInput?: boolean;
}

export interface DataConflict {
  actionId: string;
  clientData: any;
  serverData: any;
  conflictType:
    | 'concurrent-modification'
    | 'deleted-on-server'
    | 'version-mismatch';
  timestamp: number;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffMultiplier: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2,
};
