import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { CDNCacheManager, CacheUtils } from '../cache-manager';
import { EdgeConfig } from '../edge-config';

// Mock fetch globally
const mockFetch = mock(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ success: true }),
    text: () => Promise.resolve('OK'),
    headers: new Map([['X-Cache', 'HIT']]),
  })
);

global.fetch = mockFetch as any;

describe('CDN Integration Tests', () => {
  let cacheManager: CDNCacheManager;

  beforeEach(() => {
    // Set up test environment
    process.env.VERCEL_API_TOKEN = 'test-token';
    process.env.VERCEL_TEAM_ID = 'test-team';

    // Reset mock
    mockFetch.mockClear();

    // Create cache manager
    cacheManager = new CDNCacheManager();
  });

  describe('Cache Header Configuration', () => {
    it('should generate correct cache headers for static assets', () => {
      const rule = EdgeConfig.getCacheRule('/static/images/logo.png');

      expect(rule).toBeTruthy();
      expect(rule?.maxAge).toBe(31536000); // 1 year
      expect(rule?.immutable).toBe(true);
      expect(rule?.public).toBe(true);
      expect(rule?.tags).toContain('static');
    });

    it('should generate correct cache headers for API routes', () => {
      const rule = EdgeConfig.getCacheRule('/api/github/repos');

      expect(rule).toBeTruthy();
      expect(rule?.maxAge).toBe(300); // 5 minutes
      expect(rule?.staleWhileRevalidate).toBe(900); // 15 minutes
      expect(rule?.public).toBe(true);
      expect(rule?.tags).toContain('github');
    });

    it('should generate correct Cache-Control header strings', () => {
      const staticRule = {
        pattern: '/static/**',
        maxAge: 31536000,
        immutable: true,
        public: true,
        tags: ['static'],
      };

      const cacheControl = EdgeConfig.generateCacheControl(staticRule);

      expect(cacheControl).toContain('public');
      expect(cacheControl).toContain('max-age=31536000');
      expect(cacheControl).toContain('immutable');
    });

    it('should generate CDN-specific cache control headers', () => {
      const apiRule = {
        pattern: '/api/**',
        maxAge: 300,
        sMaxAge: 60,
        public: true,
        tags: ['api'],
      };

      const cdnCacheControl = EdgeConfig.generateCDNCacheControl(apiRule);

      expect(cdnCacheControl).toContain('public');
      expect(cdnCacheControl).toContain('max-age=60'); // Should use sMaxAge
    });
  });

  describe('Cache Purging Functionality', () => {
    it('should successfully purge cache by tags', async () => {
      const result = await cacheManager.purgeByTags(['github', 'api']);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const call = mockFetch.mock.calls[0];
      expect(call[0]).toBe('https://api.vercel.com/v1/purge');
      expect(call[1].method).toBe('POST');
      expect(call[1].headers.Authorization).toBe('Bearer test-token');
    });

    it('should successfully purge cache by paths', async () => {
      const paths = ['/static/css/main.css', '/static/js/app.js'];
      const result = await cacheManager.purgeByPaths(paths);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.files).toEqual(paths);
    });

    it('should handle GitHub cache purging', async () => {
      const result = await cacheManager.purgeGitHubCache('repo-123');

      expect(result).toBe(true);

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.tags).toContain('github');
      expect(requestBody.tags).toContain('github:repo-123');
    });

    it('should handle Slack cache purging', async () => {
      const result = await cacheManager.purgeSlackCache('channel-456');

      expect(result).toBe(true);

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.tags).toContain('slack');
      expect(requestBody.tags).toContain('slack:channel-456');
    });

    it('should handle AI summary cache purging', async () => {
      const result = await cacheManager.purgeAISummaryCache('summary-789');

      expect(result).toBe(true);

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.tags).toContain('ai-summary');
      expect(requestBody.tags).toContain('ai-summary:summary-789');
    });
  });

  describe('Cache Health Monitoring', () => {
    it('should perform health checks and return status', async () => {
      const health = await cacheManager.checkHealth();

      expect(health).toBeTruthy();
      expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);
      expect(typeof health.hitRate).toBe('number');
      expect(typeof health.avgResponseTime).toBe('number');
      expect(typeof health.errorRate).toBe('number');
      expect(health.lastChecked).toBeInstanceOf(Date);
      expect(Array.isArray(health.regions)).toBe(true);
    });

    it('should calculate cache statistics', async () => {
      const stats = await cacheManager.getCacheStats();

      expect(stats).toBeTruthy();
      expect(typeof stats.totalRequests).toBe('number');
      expect(typeof stats.cacheHits).toBe('number');
      expect(typeof stats.cacheMisses).toBe('number');
      expect(typeof stats.hitRate).toBe('number');
      expect(typeof stats.bandwidth).toBe('object');
      expect(Array.isArray(stats.topPaths)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 401,
          text: () => Promise.resolve('Unauthorized'),
        })
      );

      const result = await cacheManager.purgeByTags(['test']);

      expect(result).toBe(false);
    });

    it('should handle network errors gracefully', async () => {
      mockFetch.mockImplementationOnce(() =>
        Promise.reject(new Error('Network error'))
      );

      const result = await cacheManager.purgeByTags(['test']);

      expect(result).toBe(false);
    });

    it('should skip purge when API token is missing', async () => {
      delete process.env.VERCEL_API_TOKEN;
      const noCacheManager = new CDNCacheManager();

      const result = await noCacheManager.purgeByTags(['test']);

      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Utility Functions', () => {
    it('should handle asset update notifications', async () => {
      await CacheUtils.onAssetUpdate(['/static/logo.png']);

      expect(mockFetch).toHaveBeenCalledTimes(1);

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.files).toContain('/static/logo.png');
    });

    it('should handle GitHub update notifications', async () => {
      await CacheUtils.onGitHubUpdate('repo-123');

      expect(mockFetch).toHaveBeenCalledTimes(1);

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.tags).toContain('github:repo-123');
    });

    it('should check CDN health status', async () => {
      const isHealthy = await CacheUtils.isHealthy();

      expect(typeof isHealthy).toBe('boolean');
    });

    it('should get performance metrics', async () => {
      const metrics = await CacheUtils.getPerformanceMetrics();

      expect(typeof metrics.hitRate).toBe('number');
      expect(typeof metrics.avgResponseTime).toBe('number');
      expect(typeof metrics.status).toBe('string');
    });
  });

  describe('Pattern Matching', () => {
    it('should match static asset patterns correctly', () => {
      const testCases = [
        { path: '/static/css/main.css', shouldMatch: true },
        { path: '/static/images/logo.png', shouldMatch: true },
        { path: '/api/github/repos', shouldMatch: false },
        { path: '/dashboard', shouldMatch: false },
      ];

      testCases.forEach(({ path, shouldMatch }) => {
        const rule = EdgeConfig.getCacheRule(path);
        const hasStaticRule = rule?.tags?.includes('static') || false;

        if (shouldMatch) {
          expect(hasStaticRule).toBe(true);
        } else {
          expect(hasStaticRule).toBe(false);
        }
      });
    });

    it('should match API route patterns correctly', () => {
      const testCases = [
        { path: '/api/github/repos', shouldMatch: true },
        { path: '/api/slack/channels', shouldMatch: true },
        { path: '/static/css/main.css', shouldMatch: false },
        { path: '/dashboard', shouldMatch: false },
      ];

      testCases.forEach(({ path, shouldMatch }) => {
        const rule = EdgeConfig.getCacheRule(path);
        const hasApiRule = rule?.tags?.includes('api') || false;

        if (shouldMatch) {
          expect(hasApiRule).toBe(true);
        } else {
          expect(hasApiRule).toBe(false);
        }
      });
    });
  });

  describe('Cache Tag Generation', () => {
    it('should generate appropriate cache tags', () => {
      const rule = {
        pattern: '/api/github/**',
        maxAge: 300,
        tags: ['api', 'github'],
      };

      const tags = EdgeConfig.generateCacheTags(rule, '/api/github/repos');

      expect(tags).toContain('api');
      expect(tags).toContain('github');
      expect(tags).toContain('path:api');
    });

    it('should remove duplicate tags', () => {
      const rule = {
        pattern: '/api/**',
        maxAge: 300,
        tags: ['api'],
      };

      const tags = EdgeConfig.generateCacheTags(rule, '/api/github/repos');
      const apiTags = tags.filter(tag => tag === 'api');

      expect(apiTags).toHaveLength(1);
    });
  });

  describe('Caching Eligibility', () => {
    it('should cache GET requests appropriately', () => {
      expect(EdgeConfig.shouldCache('/api/data', 'GET')).toBe(true);
      expect(EdgeConfig.shouldCache('/static/css/main.css', 'GET')).toBe(true);
    });

    it('should not cache non-GET requests', () => {
      expect(EdgeConfig.shouldCache('/api/data', 'POST')).toBe(false);
      expect(EdgeConfig.shouldCache('/api/data', 'PUT')).toBe(false);
      expect(EdgeConfig.shouldCache('/api/data', 'DELETE')).toBe(false);
    });

    it('should not cache sensitive endpoints', () => {
      expect(EdgeConfig.shouldCache('/api/auth/signin', 'GET')).toBe(false);
      expect(EdgeConfig.shouldCache('/api/health', 'GET')).toBe(false);
      expect(EdgeConfig.shouldCache('/api/activities/live', 'GET')).toBe(false);
    });
  });
});
