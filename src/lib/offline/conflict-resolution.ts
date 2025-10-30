// Conflict Resolution System for offline data synchronization

import { indexedDBManager } from './indexeddb';
import { OfflineAction, DataConflict, ConflictResolution } from './types';

export interface ConflictResolver {
  canResolve(conflict: DataConflict): boolean;
  resolve(conflict: DataConflict): Promise<ConflictResolution>;
}

export interface ConflictResolutionCallbacks {
  onConflictDetected?: (conflict: DataConflict) => void;
  onConflictResolved?: (
    conflict: DataConflict,
    resolution: ConflictResolution
  ) => void;
  onManualResolutionRequired?: (
    conflict: DataConflict
  ) => Promise<ConflictResolution>;
}

export class ConflictResolutionManager {
  private resolvers: Map<string, ConflictResolver> = new Map();
  private callbacks: ConflictResolutionCallbacks = {};
  private initialized = false;

  /**
   * Initialize the conflict resolution manager
   */
  async init(callbacks: ConflictResolutionCallbacks = {}): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.callbacks = callbacks;
    await indexedDBManager.init();

    // Register default resolvers
    this.registerDefaultResolvers();

    this.initialized = true;
    console.log('[Conflict Resolution] Initialized successfully');
  }

  /**
   * Register a conflict resolver for a specific resource type
   */
  registerResolver(resourceType: string, resolver: ConflictResolver): void {
    this.resolvers.set(resourceType, resolver);
    console.log(
      `[Conflict Resolution] Registered resolver for ${resourceType}`
    );
  }

  /**
   * Detect conflicts when syncing an action
   */
  async detectConflict(
    action: OfflineAction,
    serverData: any
  ): Promise<DataConflict | null> {
    const { payload } = action;

    // CREATE actions don't have conflicts with server data
    if (action.type === 'CREATE') {
      return null;
    }

    // Check if resource was deleted on server (only for UPDATE/DELETE)
    if (action.type !== 'DELETE' && this.isDeletedOnServer(serverData)) {
      return {
        actionId: action.id,
        clientData: payload,
        serverData,
        conflictType: 'deleted-on-server',
        timestamp: Date.now(),
      };
    }

    // Check for version mismatches first (more specific)
    if (this.hasVersionMismatch(payload, serverData)) {
      return {
        actionId: action.id,
        clientData: payload,
        serverData,
        conflictType: 'version-mismatch',
        timestamp: Date.now(),
      };
    }

    // Check for concurrent modifications (more general)
    if (this.hasConcurrentModification(payload, serverData)) {
      return {
        actionId: action.id,
        clientData: payload,
        serverData,
        conflictType: 'concurrent-modification',
        timestamp: Date.now(),
      };
    }

    return null;
  } /*
   *
   * Resolve a conflict using appropriate strategy
   */
  async resolveConflict(
    conflict: DataConflict,
    action: OfflineAction
  ): Promise<ConflictResolution> {
    this.callbacks.onConflictDetected?.(conflict);

    const resolver = this.resolvers.get(action.resource);

    if (resolver?.canResolve(conflict)) {
      const resolution = await resolver.resolve(conflict);
      this.callbacks.onConflictResolved?.(conflict, resolution);
      return resolution;
    }

    // Fallback to manual resolution
    if (this.callbacks.onManualResolutionRequired) {
      const resolution =
        await this.callbacks.onManualResolutionRequired(conflict);
      this.callbacks.onConflictResolved?.(conflict, resolution);
      return resolution;
    }

    // Default to server wins if no manual resolution available
    console.warn(
      `[Conflict Resolution] No resolver found for ${action.resource}, defaulting to server-wins`
    );
    return {
      strategy: 'server-wins',
      resolvedData: conflict.serverData,
    };
  }

  /**
   * Store conflict for later manual resolution
   */
  async storeConflict(conflict: DataConflict): Promise<void> {
    await indexedDBManager.put('conflicts', {
      ...conflict,
      resolved: false,
    });
    console.log(
      `[Conflict Resolution] Stored conflict for action ${conflict.actionId}`
    );
  }

  /**
   * Get all unresolved conflicts
   */
  async getUnresolvedConflicts(): Promise<DataConflict[]> {
    return indexedDBManager.getByIndex<DataConflict>(
      'conflicts',
      'resolved',
      false
    );
  }

  /**
   * Mark conflict as resolved
   */
  async markConflictResolved(
    actionId: string,
    resolution: ConflictResolution
  ): Promise<void> {
    const conflict = await indexedDBManager.get<DataConflict>(
      'conflicts',
      actionId
    );
    if (conflict) {
      await indexedDBManager.put('conflicts', {
        ...conflict,
        resolved: true,
        resolution,
      });
      console.log(
        `[Conflict Resolution] Marked conflict ${actionId} as resolved`
      );
    }
  }

  /**
   * Register default conflict resolvers
   */
  private registerDefaultResolvers(): void {
    // GitHub repository resolver
    this.registerResolver(
      'github/repositories',
      new GitHubRepositoryResolver()
    );

    // Slack message resolver
    this.registerResolver('slack/messages', new SlackMessageResolver());

    // User preferences resolver
    this.registerResolver('user/preferences', new UserPreferencesResolver());

    // Generic timestamp-based resolver
    this.registerResolver('*', new TimestampBasedResolver());
  }

  /**
   * Check for concurrent modifications
   */
  private hasConcurrentModification(clientData: any, serverData: any): boolean {
    // Check if both client and server have modifications after the last sync
    if (clientData.updatedAt && serverData.updatedAt) {
      return (
        new Date(clientData.updatedAt).getTime() !==
        new Date(serverData.updatedAt).getTime()
      );
    }

    // Check for version conflicts
    if (clientData.version && serverData.version) {
      return clientData.version !== serverData.version;
    }

    // Basic field comparison for simple objects
    if (
      typeof clientData === 'object' &&
      typeof serverData === 'object' &&
      clientData !== null &&
      serverData !== null
    ) {
      const clientKeys = Object.keys(clientData);
      const serverKeys = Object.keys(serverData);

      // Check if different fields were modified
      const allKeys = new Set([...clientKeys, ...serverKeys]);
      for (const key of allKeys) {
        if (key === 'id' || key === 'createdAt') continue;

        if (clientData[key] !== serverData[key]) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if resource was deleted on server
   */
  private isDeletedOnServer(serverData: any): boolean {
    return (
      serverData === null ||
      serverData === undefined ||
      serverData.deleted === true
    );
  }

  /**
   * Check for version mismatches
   */
  private hasVersionMismatch(clientData: any, serverData: any): boolean {
    if (clientData.version && serverData.version) {
      return clientData.version < serverData.version;
    }
    return false;
  }
}

// Default conflict resolvers

/**
 * GitHub Repository Resolver
 */
class GitHubRepositoryResolver implements ConflictResolver {
  canResolve(conflict: DataConflict): boolean {
    return conflict.conflictType === 'concurrent-modification';
  }

  async resolve(conflict: DataConflict): Promise<ConflictResolution> {
    const { clientData, serverData } = conflict;

    // For GitHub repositories, merge non-conflicting fields
    const mergedData = {
      ...serverData,
      // Keep client changes for description and settings
      description: clientData.description || serverData.description,
      private:
        clientData.private !== undefined
          ? clientData.private
          : serverData.private,
      // Server wins for metadata
      stargazers_count: serverData.stargazers_count,
      forks_count: serverData.forks_count,
      updated_at: serverData.updated_at,
    };

    return {
      strategy: 'merge',
      resolvedData: mergedData,
    };
  }
}

/**
 * Slack Message Resolver
 */
class SlackMessageResolver implements ConflictResolver {
  canResolve(conflict: DataConflict): boolean {
    return conflict.conflictType === 'concurrent-modification';
  }

  async resolve(conflict: DataConflict): Promise<ConflictResolution> {
    // For Slack messages, server always wins (messages are immutable after posting)
    return {
      strategy: 'server-wins',
      resolvedData: conflict.serverData,
    };
  }
}

/**
 * User Preferences Resolver
 */
class UserPreferencesResolver implements ConflictResolver {
  canResolve(conflict: DataConflict): boolean {
    return true; // Can resolve all conflict types for user preferences
  }

  async resolve(conflict: DataConflict): Promise<ConflictResolution> {
    const { clientData, serverData, conflictType } = conflict;

    if (conflictType === 'deleted-on-server') {
      // Recreate preferences if deleted on server
      return {
        strategy: 'client-wins',
        resolvedData: clientData,
      };
    }

    // Merge preferences, client wins for UI settings
    const mergedData = {
      ...serverData,
      theme: clientData.theme || serverData.theme,
      notifications: {
        ...serverData.notifications,
        ...clientData.notifications,
      },
      dashboard: { ...serverData.dashboard, ...clientData.dashboard },
    };

    return {
      strategy: 'merge',
      resolvedData: mergedData,
    };
  }
}

/**
 * Generic Timestamp-based Resolver
 */
class TimestampBasedResolver implements ConflictResolver {
  canResolve(conflict: DataConflict): boolean {
    return conflict.conflictType === 'concurrent-modification';
  }

  async resolve(conflict: DataConflict): Promise<ConflictResolution> {
    const { clientData, serverData } = conflict;

    // Use most recent timestamp
    const clientTime = new Date(
      clientData.updatedAt || clientData.timestamp || 0
    );
    const serverTime = new Date(
      serverData.updatedAt || serverData.timestamp || 0
    );

    if (clientTime > serverTime) {
      return {
        strategy: 'client-wins',
        resolvedData: clientData,
      };
    } else {
      return {
        strategy: 'server-wins',
        resolvedData: serverData,
      };
    }
  }
}

// Export singleton instance
export const conflictResolutionManager = new ConflictResolutionManager();
