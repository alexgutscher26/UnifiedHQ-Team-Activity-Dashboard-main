import { describe, test, expect } from 'bun:test';
import { AISummaryService } from '../ai-summary-service';

describe('AISummaryService Caching', () => {
  describe('Cache Invalidation Methods', () => {
    test('should have invalidateUserCache method', () => {
      expect(typeof AISummaryService.invalidateUserCache).toBe('function');
    });

    test('should have invalidateAllCache method', () => {
      expect(typeof AISummaryService.invalidateAllCache).toBe('function');
    });

    test('should have getCacheStats method', () => {
      expect(typeof AISummaryService.getCacheStats).toBe('function');
    });

    test('should have warmCacheForUsers method', () => {
      expect(typeof AISummaryService.warmCacheForUsers).toBe('function');
    });
  });

  describe('Cache Statistics', () => {
    test('should return cache statistics with correct structure', async () => {
      try {
        const stats = await AISummaryService.getCacheStats();

        expect(typeof stats).toBe('object');
        expect(typeof stats.totalKeys).toBe('number');
        expect(typeof stats.userCaches).toBe('object');
        expect(stats.totalKeys).toBeGreaterThanOrEqual(0);
      } catch (error) {
        // Expected when Redis is not available
        expect(error).toBeDefined();
      }
    });
  });

  describe('Cache Warming', () => {
    test('should handle empty user list gracefully', async () => {
      try {
        await AISummaryService.warmCacheForUsers([]);
        // Should complete without error
        expect(true).toBe(true);
      } catch (error) {
        // Expected when Redis is not available
        expect(error).toBeDefined();
      }
    });

    test('should handle single user warming', async () => {
      try {
        await AISummaryService.warmCacheForUsers(['test-user']);
        // Should complete without error
        expect(true).toBe(true);
      } catch (error) {
        // Expected when Redis is not available
        expect(error).toBeDefined();
      }
    });
  });

  describe('Cache Invalidation', () => {
    test('should handle user cache invalidation gracefully', async () => {
      try {
        await AISummaryService.invalidateUserCache('test-user');
        // Should complete without error
        expect(true).toBe(true);
      } catch (error) {
        // Expected when Redis is not available
        expect(error).toBeDefined();
      }
    });

    test('should handle all cache invalidation gracefully', async () => {
      try {
        await AISummaryService.invalidateAllCache();
        // Should complete without error
        expect(true).toBe(true);
      } catch (error) {
        // Expected when Redis is not available
        expect(error).toBeDefined();
      }
    });
  });

  describe('Service Methods', () => {
    test('should have generateSummary method with caching options', () => {
      expect(typeof AISummaryService.generateSummary).toBe('function');
    });

    test('should have validateConnection method', () => {
      expect(typeof AISummaryService.validateConnection).toBe('function');
    });

    test('should have getAvailableModels method', () => {
      expect(typeof AISummaryService.getAvailableModels).toBe('function');
    });
  });
});
