// Offline functionality exports

export * from './types';
export * from './indexeddb';
export * from './action-queue';
export * from './background-sync';
export * from './conflict-resolution';

// Re-export singleton instances for convenience
export { indexedDBManager } from './indexeddb';
export { offlineActionQueue } from './action-queue';
export { backgroundSyncHandler } from './background-sync';
export { conflictResolutionManager } from './conflict-resolution';
