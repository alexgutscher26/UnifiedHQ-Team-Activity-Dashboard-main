import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import { CDNCacheManager, CacheUtils } from '../cache-manager';

// Mock fetch for integration tests
const mockFetch = mock.fn();
global.fetch = mockFetch as any;

// Mock environment variables
const originalEnv = process.env;

describe('CDN Cache Purging Integration Tests', () => {
  let cacheManager: CDNCacheManager;

  beforeEach(() => {
    // Set up test environment
    process.env = {
      ...originalEnv,
      VERCEL_API_TOKEN: 'test-integration-token',
      VERCEL_TEAM_ID: 'test-team-id',
    };

    // Reset fetch mock
    mockFetch.mock.resetCalls();

    // Create cache manager instance
    cacheManager = new CDNCacheManager();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('cache purging workflows', () => {
    it('should handle GitHub webhook cache invalidation workflow', async () => {
      // Mock successful API responses
      mockFetch.mock.mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              purged: ['github', 'api', 'github:repo-123'],
            }),
        })
      );

      // Simulate GitHub webhook triggering cache invalidation
      const repoId = 'repo-123';
      const result = await cacheManager.purgeGitHubCache(repoId);

      assert.strictEqual(result, true);
      assert.strictEqual(mockFetch.mock.callCount(), 1);

      // Verify API call details
      const [url, options] = mockFetch.mock.calls[0].arguments;
      assert.strictEqual(url, 'https://api.vercel.com/v1/purge');
      assert.strictEqual(options.method, 'POST');
      assert.strictEqual(
        options.headers.Authorization,
        'Bearer test-integration-token'
      );
      assert.strictEqual(options.headers['X-Vercel-Team-Id'], 'test-team-id');

      const body = JSON.parse(options.body);
      assert.deepStrictEqual(body.tags, ['github', 'api', 'github:repo-123']);
    });

    it('should handle Slack webhook cache invalidation workflow', async () => {
      mockFetch.mock.mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              purged: ['slack', 'api', 'slack:channel-456'],
            }),
        })
      );

      const channelId = 'channel-456';
      const result = await cacheManager.purgeSlackCache(channelId);

      assert.strictEqual(result, true);

      const body = JSON.parse(mockFetch.mock.calls[0].arguments[1].body);
      assert.deepStrictEqual(body.tags, ['slack', 'api', 'slack:channel-456']);
    });

    it('should handle asset deployment cache invalidation workflow', async () => {
      mockFetch.mock.mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              purged: ['/static/css/main.css', '/static/js/app.js'],
            }),
        })
      );

      const assetPaths = ['/static/css/main.css', '/static/js/app.js'];
      const result = await cacheManager.purgeByPaths(
        assetPaths,
        'Asset deployment'
      );

      assert.strictEqual(result, true);

      const body = JSON.parse(mockFetch.mock.calls[0].arguments[1].body);
      assert.deepStrictEqual(body.files, assetPaths);
    });

    it('should handle AI summary regeneration cache invalidation workflow', async () => {
      mockFetch.mock.mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              purged: ['ai-summary', 'api', 'ai-summary:summary-789'],
            }),
        })
      );

      const summaryId = 'summary-789';
      const result = await cacheManager.purgeAISummaryCache(summaryId);

      assert.strictEqual(result, true);

      const body = JSON.parse(mockFetch.mock.calls[0].arguments[1].body);
      assert.deepStrictEqual(body.tags, [
        'ai-summary',
        'api',
        'ai-summary:summary-789',
      ]);
    });
  });

  describe('batch cache operations', () => {
    it('should handle multiple cache purge operations in sequence', async () => {
      mockFetch.mock.mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })
      );

      // Simulate multiple cache invalidations
      const results = await Promise.all([
        cacheManager.purgeGitHubCache('repo-1'),
        cacheManager.purgeSlackCache('channel-1'),
        cacheManager.purgeAISummaryCache('summary-1'),
      ]);

      assert.ok(results.every(result => result === true));
      assert.strictEqual(mockFetch.mock.callCount(), 3);

      // Verify each call had correct tags
      const calls = mockFetch.mock.calls;
      const githubBody = JSON.parse(calls[0].arguments[1].body);
      const slackBody = JSON.parse(calls[1].arguments[1].body);
      const aiBody = JSON.parse(calls[2].arguments[1].body);

      assert.ok(githubBody.tags.includes('github'));
      assert.ok(slackBody.tags.includes('slack'));
      assert.ok(aiBody.tags.includes('ai-summary'));
    });

    it('should handle partial failures in batch operations gracefully', async () => {
      let callCount = 0;
      mockFetch.mock.mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          // Fail the second call
          return Promise.resolve({
            ok: false,
            status: 500,
            text: () => Promise.resolve('Internal Server Error'),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      });

      const results = await Promise.all([
        cacheManager.purgeGitHubCache('repo-1'),
        cacheManager.purgeSlackCache('channel-1'),
        cacheManager.purgeAISummaryCache('summary-1'),
      ]);

      assert.strictEqual(results[0], true); // GitHub purge succeeded
      assert.strictEqual(results[1], false); // Slack purge failed
      assert.strictEqual(results[2], true); // AI summary purge succeeded
    });
  });

  describe('cache invalidation triggers', () => {
    it('should set up invalidation triggers correctly', () => {
      // This test verifies the setup method doesn't throw
      assert.doesNotThrow(() => {
        cacheManager.setupInvalidationTriggers();
      });
    });

    it('should handle cache invalidation through utility functions', async () => {
      mockFetch.mock.mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })
      );

      // Test utility functions
      await CacheUtils.onAssetUpdate(['/static/logo.png']);
      await CacheUtils.onGitHubUpdate('repo-123');
      await CacheUtils.onSlackUpdate('channel-456');
      await CacheUtils.onAISummaryUpdate('summary-789');

      assert.strictEqual(mockFetch.mock.callCount(), 4);

      // Verify each utility function made the correct API call
      const calls = mockFetch.mock.calls;

      // Asset update call
      const assetBody = JSON.parse(calls[0].arguments[1].body);
      assert.deepStrictEqual(assetBody.files, ['/static/logo.png']);

      // GitHub update call
      const githubBody = JSON.parse(calls[1].arguments[1].body);
      assert.ok(githubBody.tags.includes('github:repo-123'));

      // Slack update call
      const slackBody = JSON.parse(calls[2].arguments[1].body);
      assert.ok(slackBody.tags.includes('slack:channel-456'));

      // AI summary update call
      const aiBody = JSON.parse(calls[3].arguments[1].body);
      assert.ok(aiBody.tags.includes('ai-summary:summary-789'));
    });
  });

  describe('error handling and resilience', () => {
    it('should handle network timeouts gracefully', async () => {
      mockFetch.mock.mockImplementation(
        () =>
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Network timeout')), 100);
          })
      );

      const result = await cacheManager.purgeByTags(['test']);

      assert.strictEqual(result, false);
    });

    it('should handle API rate limiting', async () => {
      mockFetch.mock.mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 429,
          text: () => Promise.resolve('Rate limit exceeded'),
        })
      );

      const result = await cacheManager.purgeByTags(['test']);

      assert.strictEqual(result, false);
    });

    it('should handle invalid API responses', async () => {
      mockFetch.mock.mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.reject(new Error('Invalid JSON')),
        })
      );

      const result = await cacheManager.purgeByTags(['test']);

      assert.strictEqual(result, false);
    });

    it('should handle missing API credentials gracefully', async () => {
      delete process.env.VERCEL_API_TOKEN;
      const noCacheManager = new CDNCacheManager();

      const result = await noCacheManager.purgeByTags(['test']);

      assert.strictEqual(result, false);
      assert.strictEqual(mockFetch.mock.callCount(), 0);
    });
  });

  describe('cache health monitoring integration', () => {
    it('should perform comprehensive health checks across regions', async () => {
      // Mock health endpoint responses for different regions
      mockFetch.mock.mockImplementation(url => {
        if (url === '/api/health') {
          return Promise.resolve({
            ok: true,
            headers: new Map([['X-Cache', 'HIT']]),
          });
        }
        return Promise.resolve({ ok: true });
      });

      const health = await cacheManager.checkHealth();

      assert.ok(['healthy', 'degraded', 'unhealthy'].includes(health.status));
      assert.ok(typeof health.hitRate === 'number');
      assert.ok(typeof health.avgResponseTime === 'number');
      assert.ok(typeof health.errorRate === 'number');
      assert.ok(health.lastChecked instanceof Date);
      assert.ok(Array.isArray(health.regions));
      assert.ok(health.regions.length > 0);

      // Verify each region has required properties
      health.regions.forEach(region => {
        assert.ok(typeof region.region === 'string');
        assert.ok(['healthy', 'degraded', 'unhealthy'].includes(region.status));
        assert.ok(typeof region.responseTime === 'number');
        assert.ok(typeof region.errorCount === 'number');
      });
    });

    it('should detect regional failures and adjust overall health status', async () => {
      let callCount = 0;
      mockFetch.mock.mockImplementation(url => {
        if (url === '/api/health') {
          callCount++;
          // Simulate failures in some regions
          if (callCount <= 2) {
            return Promise.resolve({ ok: false, status: 500 });
          }
          return Promise.resolve({ ok: true });
        }
        return Promise.resolve({ ok: true });
      });

      const health = await cacheManager.checkHealth();

      // Should detect partial failures
      assert.ok(['degraded', 'unhealthy'].includes(health.status));
      assert.ok(health.errorRate > 0);
    });

    it('should calculate cache hit rates from response headers', async () => {
      const cacheStatuses = ['HIT', 'MISS', 'HIT', 'STALE'];
      let callIndex = 0;

      mockFetch.mock.mockImplementation(url => {
        if (url.startsWith('/api/') || url === '/') {
          const status = cacheStatuses[callIndex % cacheStatuses.length];
          callIndex++;
          return Promise.resolve({
            ok: true,
            headers: new Map([['X-Cache', status]]),
          });
        }
        return Promise.resolve({ ok: true });
      });

      const health = await cacheManager.checkHealth();

      // Should calculate hit rate based on cache headers
      assert.ok(health.hitRate >= 0 && health.hitRate <= 1);
    });
  });

  describe('performance optimization integration', () => {
    it('should provide cache statistics for performance monitoring', async () => {
      mockFetch.mock.mockImplementation(() =>
        Promise.resolve({
          ok: true,
          headers: new Map([['X-Cache', 'HIT']]),
        })
      );

      const stats = await cacheManager.getCacheStats();

      assert.ok(typeof stats.totalRequests === 'number');
      assert.ok(typeof stats.cacheHits === 'number');
      assert.ok(typeof stats.cacheMisses === 'number');
      assert.ok(typeof stats.hitRate === 'number');
      assert.ok(typeof stats.bandwidth === 'object');
      assert.ok(typeof stats.bandwidth.served === 'number');
      assert.ok(typeof stats.bandwidth.saved === 'number');
      assert.ok(Array.isArray(stats.topPaths));
    });

    it('should integrate with performance monitoring utilities', async () => {
      mockFetch.mock.mockImplementation(() =>
        Promise.resolve({
          ok: true,
          headers: new Map([['X-Cache', 'HIT']]),
        })
      );

      const isHealthy = await CacheUtils.isHealthy();
      const metrics = await CacheUtils.getPerformanceMetrics();

      assert.ok(typeof isHealthy === 'boolean');
      assert.ok(typeof metrics.hitRate === 'number');
      assert.ok(typeof metrics.avgResponseTime === 'number');
      assert.ok(typeof metrics.status === 'string');
    });
  });

  describe('CDN fallback integration', () => {
    it('should handle CDN failures with proper fallback', async () => {
      const originalRequest = new Request('https://example.com/api/data', {
        method: 'GET',
        headers: {
          'CDN-Cache-Control': 'max-age=3600',
          'Cache-Tag': 'api,data',
          Authorization: 'Bearer token',
        },
      });

      // Mock successful fallback response
      mockFetch.mock.mockImplementation(() =>
        Promise.resolve(
          new Response('fallback data', {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      );

      const response = await cacheManager.handleCDNFailure(originalRequest);

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.headers.get('X-CDN-Fallback'), 'true');

      // Verify fallback request was made correctly
      const fallbackCall = mockFetch.mock.calls[0];
      const fallbackRequest = fallbackCall.arguments[0];

      // CDN headers should be removed
      assert.strictEqual(
        fallbackRequest.headers.get('CDN-Cache-Control'),
        null
      );
      assert.strictEqual(fallbackRequest.headers.get('Cache-Tag'), null);

      // Other headers should be preserved
      assert.ok(fallbackRequest.headers.get('Authorization'));
    });

    it('should propagate fallback failures appropriately', async () => {
      const originalRequest = new Request('https://example.com/api/data');

      mockFetch.mock.mockImplementation(() =>
        Promise.reject(new Error('Fallback also failed'))
      );

      await assert.rejects(
        () => cacheManager.handleCDNFailure(originalRequest),
        /Fallback also failed/
      );
    });
  });
});
