// Background Sync Handler with retry logic and progress tracking

import { offlineActionQueue } from './action-queue';
import { conflictResolutionManager } from './conflict-resolution';
import {
  OfflineAction,
  SyncResult,
  RetryConfig,
  DataConflict,
  ConflictResolution,
} from './types';

export interface SyncProgress {
  total: number;
  processed: number;
  failed: number;
  current?: string; // Current action being processed
  isRunning: boolean;
  startTime?: number;
  endTime?: number;
}

export interface SyncEventCallbacks {
  onStart?: (progress: SyncProgress) => void;
  onProgress?: (progress: SyncProgress) => void;
  onComplete?: (result: SyncResult) => void;
  onError?: (error: Error) => void;
  onActionStart?: (action: OfflineAction) => void;
  onActionComplete?: (action: OfflineAction) => void;
  onActionFailed?: (action: OfflineAction, error: string) => void;
}

export class BackgroundSyncHandler {
  private isRegistered = false;
  private isSyncing = false;
  private callbacks: SyncEventCallbacks = {};
  private syncProgress: SyncProgress = {
    total: 0,
    processed: 0,
    failed: 0,
    isRunning: false,
  };

  /**
   * Register background sync and set up event handlers
   */
  async register(callbacks: SyncEventCallbacks = {}): Promise<void> {
    this.callbacks = callbacks;

    if (!('serviceWorker' in navigator)) {
      throw new Error('Service Worker not supported');
    }

    if (!('sync' in window.ServiceWorkerRegistration.prototype)) {
      console.warn(
        '[Background Sync] Background Sync not supported, using fallback'
      );
      this.setupFallbackSync();
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;

      // Register background sync
      await registration.sync.register('offline-actions-sync');

      this.isRegistered = true;
      console.log('[Background Sync] Registered successfully');

      // Set up message listener for sync events from service worker
      this.setupMessageListener();
    } catch (error) {
      console.error('[Background Sync] Registration failed:', error);
      this.callbacks.onError?.(error as Error);
      throw error;
    }
  } /**

   * Manually trigger sync process
   */
  async triggerSync(): Promise<SyncResult> {
    if (this.isSyncing) {
      throw new Error('Sync already in progress');
    }

    console.log('[Background Sync] Manually triggering sync');
    return this.performSync();
  }

  /**
   * Perform the actual sync operation
   */
  private async performSync(): Promise<SyncResult> {
    this.isSyncing = true;

    const startTime = Date.now();
    this.syncProgress = {
      total: 0,
      processed: 0,
      failed: 0,
      isRunning: true,
      startTime,
    };

    try {
      await offlineActionQueue.init();

      // Get actions ready for retry (considering backoff delays)
      const actionsToSync = await offlineActionQueue.getActionsReadyForRetry();

      this.syncProgress.total = actionsToSync.length;
      this.callbacks.onStart?.(this.syncProgress);

      if (actionsToSync.length === 0) {
        console.log('[Background Sync] No actions to sync');
        return this.completeSyncWithResult([], []);
      }

      console.log(`[Background Sync] Syncing ${actionsToSync.length} actions`);

      const processedActions: OfflineAction[] = [];
      const errors: Array<{ actionId: string; error: string }> = [];

      // Process actions sequentially to avoid overwhelming the server
      for (const action of actionsToSync) {
        this.syncProgress.current = action.id;
        this.callbacks.onProgress?.(this.syncProgress);
        this.callbacks.onActionStart?.(action);

        try {
          await offlineActionQueue.markActionSyncing(action.id);

          const success = await this.syncAction(action);

          if (success) {
            await offlineActionQueue.markActionCompleted(action.id);
            processedActions.push(action);
            this.callbacks.onActionComplete?.(action);
          } else {
            throw new Error('Sync operation returned false');
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';

          const shouldRetry = await offlineActionQueue.markActionFailed(
            action.id,
            errorMessage
          );

          if (!shouldRetry) {
            errors.push({ actionId: action.id, error: errorMessage });
            this.syncProgress.failed++;
          }

          this.callbacks.onActionFailed?.(action, errorMessage);
          console.error(
            `[Background Sync] Failed to sync action ${action.id}:`,
            error
          );
        }

        this.syncProgress.processed++;
        this.callbacks.onProgress?.(this.syncProgress);

        // Small delay between actions to prevent overwhelming the server
        await this.delay(100);
      }

      return this.completeSyncWithResult(processedActions, errors);
    } catch (error) {
      console.error('[Background Sync] Sync process failed:', error);
      this.callbacks.onError?.(error as Error);
      throw error;
    } finally {
      this.isSyncing = false;
      this.syncProgress.isRunning = false;
      this.syncProgress.endTime = Date.now();
    }
  }

  /**
   * Sync a single action with the server
   */
  private async syncAction(action: OfflineAction): Promise<boolean> {
    const { type, resource, payload } = action;

    try {
      // First, get current server data for conflict detection
      let serverData: any = null;
      if (type === 'UPDATE' || type === 'DELETE') {
        try {
          const getResponse = await fetch(`/api/${resource}/${payload.id}`);
          if (getResponse.ok) {
            serverData = await getResponse.json();
          }
        } catch (error) {
          console.warn(
            "[Background Sync] Could not fetch server data for conflict detection:",
            error
          );
        }
      }

      // Check for conflicts
      if (serverData) {
        const conflict = await conflictResolutionManager.detectConflict(
          action,
          serverData
        );
        if (conflict) {
          console.log(
            `[Background Sync] Conflict detected for action ${action.id}`
          );

          // Try to resolve automatically
          const resolution = await conflictResolutionManager.resolveConflict(
            conflict,
            action
          );

          if (resolution.requiresUserInput) {
            // Store conflict for manual resolution
            await conflictResolutionManager.storeConflict(conflict);
            throw new Error('Manual conflict resolution required');
          }

          // Use resolved data for the sync
          action.payload = resolution.resolvedData;
        }
      }

      let response: Response;

      switch (type) {
        case 'CREATE':
          response = await fetch(`/api/${resource}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          break;

        case 'UPDATE':
          response = await fetch(`/api/${resource}/${payload.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          break;

        case 'DELETE':
          response = await fetch(`/api/${resource}/${payload.id}`, {
            method: 'DELETE',
          });
          break;

        default:
          throw new Error(`Unsupported action type: ${type}`);
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      console.log(
        `[Background Sync] Successfully synced ${type} action for ${resource}`
      );
      return true;
    } catch (error) {
      console.error("[Background Sync] Failed to sync action:", error);
      throw error;
    }
  }

  /**
   * Complete sync and return result
   */
  private completeSyncWithResult(
    processedActions: OfflineAction[],
    errors: Array<{ actionId: string; error: string }>
  ): SyncResult {
    const result: SyncResult = {
      success: errors.length === 0,
      processedActions: processedActions.length,
      failedActions: errors.length,
      errors,
    };

    this.callbacks.onComplete?.(result);

    console.log('[Background Sync] Sync completed:', result);
    return result;
  } /**
   
* Set up message listener for service worker communication
   */
  private setupMessageListener(): void {
    navigator.serviceWorker.addEventListener('message', event => {
      const { type, payload } = event.data;

      switch (type) {
        case 'BACKGROUND_SYNC_START':
          console.log('[Background Sync] Service worker started sync');
          this.performSync().catch(error => {
            console.error(
              '[Background Sync] Service worker sync failed:',
              error
            );
          });
          break;

        case 'SYNC_PROGRESS':
          this.callbacks.onProgress?.(payload);
          break;

        default:
          // Ignore unknown message types
          break;
      }
    });
  }

  /**
   * Set up fallback sync for browsers without background sync support
   */
  private setupFallbackSync(): void {
    // Check for pending actions periodically when online
    const checkInterval = 30000; // 30 seconds

    const checkAndSync = async () => {
      if (navigator.onLine && !this.isSyncing) {
        try {
          const stats = await offlineActionQueue.getStats();
          if (stats.pendingActions > 0) {
            console.log('[Background Sync] Fallback sync triggered');
            await this.performSync();
          }
        } catch (error) {
          console.error('[Background Sync] Fallback sync failed:', error);
        }
      }
    };

    // Initial check
    setTimeout(checkAndSync, 1000);

    // Periodic checks
    setInterval(checkAndSync, checkInterval);

    // Sync when coming back online
    window.addEventListener('online', () => {
      console.log(
        '[Background Sync] Network restored, triggering fallback sync'
      );
      setTimeout(checkAndSync, 1000);
    });

    console.log('[Background Sync] Fallback sync mechanism set up');
  }

  /**
   * Get current sync progress
   */
  getSyncProgress(): SyncProgress {
    return { ...this.syncProgress };
  }

  /**
   * Check if sync is currently running
   */
  isSyncInProgress(): boolean {
    return this.isSyncing;
  }

  /**
   * Check if background sync is registered
   */
  isBackgroundSyncRegistered(): boolean {
    return this.isRegistered;
  }

  /**
   * Update sync callbacks
   */
  updateCallbacks(callbacks: Partial<SyncEventCallbacks>): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Get sync statistics
   */
  async getSyncStats(): Promise<{
    queueStats: any;
    lastSyncTime?: number;
    isOnline: boolean;
    canSync: boolean;
  }> {
    const queueStats = await offlineActionQueue.getStats();

    return {
      queueStats,
      lastSyncTime: this.syncProgress.endTime,
      isOnline: navigator.onLine,
      canSync: navigator.onLine && !this.isSyncing,
    };
  }

  /**
   * Utility function for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.callbacks = {};
    this.isSyncing = false;
    this.isRegistered = false;
  }
}

// Export singleton instance
export const backgroundSyncHandler = new BackgroundSyncHandler();
