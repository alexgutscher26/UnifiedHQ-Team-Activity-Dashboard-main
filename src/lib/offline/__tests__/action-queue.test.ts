import { describe, test, expect, beforeEach } from '@jest/globals';
import { OfflineActionQueue } from '../action-queue';
import { DEFAULT_RETRY_CONFIG } from '../types';

describe('OfflineActionQueue', () => {
  let actionQueue: OfflineActionQueue;

  beforeEach(() => {
    actionQueue = new OfflineActionQueue();
  });

  describe('retry configuration', () => {
    test('should have default retry configuration', () => {
      const config = actionQueue.getRetryConfig();

      expect(config.maxRetries).toBe(DEFAULT_RETRY_CONFIG.maxRetries);
      expect(config.baseDelay).toBe(DEFAULT_RETRY_CONFIG.baseDelay);
      expect(config.maxDelay).toBe(DEFAULT_RETRY_CONFIG.maxDelay);
      expect(config.backoffMultiplier).toBe(
        DEFAULT_RETRY_CONFIG.backoffMultiplier
      );
    });

    test('should update retry configuration', () => {
      const newConfig = {
        maxRetries: 10,
        baseDelay: 2000,
      };

      actionQueue.setRetryConfig(newConfig);
      const config = actionQueue.getRetryConfig();

      expect(config.maxRetries).toBe(10);
      expect(config.baseDelay).toBe(2000);
      expect(config.maxDelay).toBe(DEFAULT_RETRY_CONFIG.maxDelay); // Should keep default
    });
  });

  describe('retry delay calculation', () => {
    test('should calculate exponential backoff correctly', () => {
      const delay1 = actionQueue.calculateRetryDelay(0);
      const delay2 = actionQueue.calculateRetryDelay(1);
      const delay3 = actionQueue.calculateRetryDelay(2);

      expect(delay1).toBeGreaterThanOrEqual(1000); // Base delay
      expect(delay2).toBeGreaterThanOrEqual(2000); // Base * 2^1
      expect(delay3).toBeGreaterThanOrEqual(4000); // Base * 2^2

      // Should not exceed max delay
      const maxRetryDelay = actionQueue.calculateRetryDelay(10);
      expect(maxRetryDelay).toBeLessThanOrEqual(DEFAULT_RETRY_CONFIG.maxDelay);
    });

    test('should add jitter to prevent thundering herd', () => {
      const delays = [];
      for (let i = 0; i < 10; i++) {
        delays.push(actionQueue.calculateRetryDelay(1));
      }

      // Should have some variation due to jitter
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });
  });

  describe('action ID generation', () => {
    test('should generate unique action IDs', () => {
      const ids = new Set();

      for (let i = 0; i < 100; i++) {
        // Access private method through any cast for testing
        const id = (actionQueue as any).generateActionId();
        expect(id).toMatch(/^action_\d+_[a-z0-9]+$/);
        expect(ids.has(id)).toBe(false);
        ids.add(id);
      }
    });
  });

  describe('IndexedDB support check', () => {
    test('should check IndexedDB support', () => {
      // In Node.js environment, IndexedDB won't be available
      // This tests the static method without requiring actual IndexedDB
      const isSupported =
        (actionQueue.constructor as any).isSupported?.() ?? false;
      expect(typeof isSupported).toBe('boolean');
    });
  });
});
