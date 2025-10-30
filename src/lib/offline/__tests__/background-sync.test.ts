import { describe, test, expect, beforeEach } from '@jest/globals';
import { BackgroundSyncHandler } from '../background-sync';

describe('BackgroundSyncHandler', () => {
  let syncHandler: BackgroundSyncHandler;

  beforeEach(() => {
    syncHandler = new BackgroundSyncHandler();
  });

  describe('sync progress tracking', () => {
    test('should initialize with empty progress', () => {
      const progress = syncHandler.getSyncProgress();

      expect(progress.total).toBe(0);
      expect(progress.processed).toBe(0);
      expect(progress.failed).toBe(0);
      expect(progress.isRunning).toBe(false);
      expect(progress.current).toBeUndefined();
    });

    test('should track sync state correctly', () => {
      expect(syncHandler.isSyncInProgress()).toBe(false);
      expect(syncHandler.isBackgroundSyncRegistered()).toBe(false);
    });
  });

  describe('callback management', () => {
    test('should update callbacks', () => {
      const callbacks = {
        onStart: () => console.log('started'),
        onComplete: () => console.log('completed'),
      };

      syncHandler.updateCallbacks(callbacks);

      // Should not throw and should accept the callbacks
      expect(() => syncHandler.updateCallbacks(callbacks)).not.toThrow();
    });
  });

  describe('cleanup', () => {
    test('should cleanup resources', () => {
      syncHandler.cleanup();

      expect(syncHandler.isSyncInProgress()).toBe(false);
      expect(syncHandler.isBackgroundSyncRegistered()).toBe(false);
    });
  });

  describe('sync statistics', () => {
    test('should provide sync statistics structure', () => {
      // Test the structure without actually calling getSyncStats which requires IndexedDB
      expect(syncHandler.getSyncProgress()).toHaveProperty('total');
      expect(syncHandler.getSyncProgress()).toHaveProperty('processed');
      expect(syncHandler.getSyncProgress()).toHaveProperty('failed');
      expect(syncHandler.getSyncProgress()).toHaveProperty('isRunning');
    });
  });
});
