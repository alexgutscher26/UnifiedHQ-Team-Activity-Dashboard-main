// Offline Action Queue with IndexedDB persistence
// Manages offline actions and provides CRUD operations

import { indexedDBManager, IndexedDBManager } from './indexeddb';
import {
  OfflineAction,
  QueueStats,
  DEFAULT_RETRY_CONFIG,
  RetryConfig,
} from './types';

export class OfflineActionQueue {
  private initialized = false;
  private retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG;

  /**
   * Initialize the action queue
   */
  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (!IndexedDBManager.isSupported()) {
      throw new Error('IndexedDB is not supported in this browser');
    }

    await indexedDBManager.init();
    this.initialized = true;
    console.log('[Action Queue] Initialized successfully');
  }

  /**
   * Add an action to the queue
   */
  async enqueue(
    type: OfflineAction['type'],
    resource: string,
    payload: any
  ): Promise<string> {
    await this.ensureInitialized();

    const action: OfflineAction = {
      id: this.generateActionId(),
      type,
      resource,
      payload,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'PENDING',
    };

    await indexedDBManager.add('actions', action);
    console.log(
      `[Action Queue] Enqueued ${type} action for ${resource}:`,
      action.id
    );

    return action.id;
  }

  /**
   * Get an action by ID
   */
  async getAction(actionId: string): Promise<OfflineAction | undefined> {
    await this.ensureInitialized();
    return indexedDBManager.get<OfflineAction>('actions', actionId);
  }

  /**
   * Update an action's status and metadata
   */
  async updateAction(
    actionId: string,
    updates: Partial<
      Pick<OfflineAction, 'status' | 'retryCount' | 'lastAttempt' | 'error'>
    >
  ): Promise<void> {
    await this.ensureInitialized();

    const action = await this.getAction(actionId);
    if (!action) {
      throw new Error(`Action not found: ${actionId}`);
    }

    const updatedAction: OfflineAction = {
      ...action,
      ...updates,
    };

    await indexedDBManager.put('actions', updatedAction);
    console.log(`[Action Queue] Updated action ${actionId}:`, updates);
  }

  /**
   * Remove an action from the queue
   */
  async dequeue(actionId: string): Promise<void> {
    await this.ensureInitialized();
    await indexedDBManager.delete('actions', actionId);
    console.log(`[Action Queue] Dequeued action: ${actionId}`);
  }

  /**
   * Get all pending actions
   */
  async getPendingActions(): Promise<OfflineAction[]> {
    await this.ensureInitialized();
    return indexedDBManager.getByIndex<OfflineAction>(
      'actions',
      'status',
      'PENDING'
    );
  }

  /**
   * Get all failed actions
   */
  async getFailedActions(): Promise<OfflineAction[]> {
    await this.ensureInitialized();
    return indexedDBManager.getByIndex<OfflineAction>(
      'actions',
      'status',
      'FAILED'
    );
  }

  /**
   * Get actions by resource type
   */
  async getActionsByResource(resource: string): Promise<OfflineAction[]> {
    await this.ensureInitialized();
    return indexedDBManager.getByIndex<OfflineAction>(
      'actions',
      'resource',
      resource
    );
  }

  /**
   * Get all actions (for debugging/admin purposes)
   */
  async getAllActions(): Promise<OfflineAction[]> {
    await this.ensureInitialized();
    return indexedDBManager.getAll<OfflineAction>('actions');
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<QueueStats> {
    await this.ensureInitialized();

    const allActions = await this.getAllActions();
    const pendingActions = allActions.filter(a => a.status === 'PENDING');
    const failedActions = allActions.filter(a => a.status === 'FAILED');
    const completedActions = allActions.filter(a => a.status === 'COMPLETED');

    const lastSync = Math.max(
      ...completedActions.map(a => a.lastAttempt || a.timestamp),
      0
    );

    return {
      totalActions: allActions.length,
      pendingActions: pendingActions.length,
      failedActions: failedActions.length,
      completedActions: completedActions.length,
      lastSync: lastSync > 0 ? lastSync : undefined,
    };
  }

  /**
   * Clear completed actions older than specified days
   */
  async cleanupCompletedActions(olderThanDays = 7): Promise<number> {
    await this.ensureInitialized();

    const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    const completedActions = await indexedDBManager.getByIndex<OfflineAction>(
      'actions',
      'status',
      'COMPLETED'
    );

    const actionsToDelete = completedActions.filter(
      action => action.timestamp < cutoffTime
    );

    for (const action of actionsToDelete) {
      await this.dequeue(action.id);
    }

    console.log(
      `[Action Queue] Cleaned up ${actionsToDelete.length} completed actions`
    );
    return actionsToDelete.length;
  }

  /**
   * Clear all actions (use with caution)
   */
  async clearAll(): Promise<void> {
    await this.ensureInitialized();
    await indexedDBManager.clear('actions');
    console.log('[Action Queue] Cleared all actions');
  }

  /**
   * Mark an action as failed and increment retry count
   */
  async markActionFailed(actionId: string, error: string): Promise<boolean> {
    await this.ensureInitialized();

    const action = await this.getAction(actionId);
    if (!action) {
      throw new Error(`Action not found: ${actionId}`);
    }

    const newRetryCount = action.retryCount + 1;
    const shouldRetry = newRetryCount < this.retryConfig.maxRetries;

    await this.updateAction(actionId, {
      status: shouldRetry ? 'PENDING' : 'FAILED',
      retryCount: newRetryCount,
      lastAttempt: Date.now(),
      error,
    });

    console.log(
      `[Action Queue] Action ${actionId} failed (attempt ${newRetryCount}/${this.retryConfig.maxRetries}):`,
      error
    );

    return shouldRetry;
  }

  /**
   * Mark an action as completed
   */
  async markActionCompleted(actionId: string): Promise<void> {
    await this.updateAction(actionId, {
      status: 'COMPLETED',
      lastAttempt: Date.now(),
      error: undefined,
    });
  }

  /**
   * Mark an action as syncing
   */
  async markActionSyncing(actionId: string): Promise<void> {
    await this.updateAction(actionId, {
      status: 'SYNCING',
      lastAttempt: Date.now(),
    });
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  calculateRetryDelay(retryCount: number): number {
    const baseDelay =
      this.retryConfig.baseDelay *
      Math.pow(this.retryConfig.backoffMultiplier, retryCount);
    const delay = Math.min(baseDelay, this.retryConfig.maxDelay);

    // Add jitter to prevent thundering herd, but ensure we don't exceed maxDelay
    const jitter = Math.random() * 0.1 * delay;
    const finalDelay = Math.floor(delay + jitter);

    return Math.min(finalDelay, this.retryConfig.maxDelay);
  }

  /**
   * Get actions ready for retry (considering backoff delays)
   */
  async getActionsReadyForRetry(): Promise<OfflineAction[]> {
    await this.ensureInitialized();

    const pendingActions = await this.getPendingActions();
    const now = Date.now();

    return pendingActions.filter(action => {
      if (action.retryCount === 0) {
        return true; // First attempt
      }

      if (!action.lastAttempt) {
        return true; // No previous attempt recorded
      }

      const retryDelay = this.calculateRetryDelay(action.retryCount - 1);
      const nextRetryTime = action.lastAttempt + retryDelay;

      return now >= nextRetryTime;
    });
  }

  /**
   * Update retry configuration
   */
  setRetryConfig(config: Partial<RetryConfig>): void {
    this.retryConfig = { ...this.retryConfig, ...config };
    console.log(
      '[Action Queue] Updated retry configuration:',
      this.retryConfig
    );
  }

  /**
   * Get current retry configuration
   */
  getRetryConfig(): RetryConfig {
    return { ...this.retryConfig };
  }

  /**
   * Check if queue persistence is working across browser sessions
   */
  async testPersistence(): Promise<boolean> {
    await this.ensureInitialized();

    const testActionId = 'test-persistence-' + Date.now();

    try {
      // Add a test action
      await indexedDBManager.add('actions', {
        id: testActionId,
        type: 'CREATE',
        resource: 'test',
        payload: { test: true },
        timestamp: Date.now(),
        retryCount: 0,
        status: 'PENDING',
      });

      // Try to retrieve it
      const retrieved = await this.getAction(testActionId);

      // Clean up
      await this.dequeue(testActionId);

      return Boolean(retrieved);
    } catch (error) {
      console.error('[Action Queue] Persistence test failed:', error);
      return false;
    }
  }

  /**
   * Generate a unique action ID
   */
  private generateActionId(): string {
    return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Ensure the queue is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }
  }
}

// Export singleton instance
export const offlineActionQueue = new OfflineActionQueue();
