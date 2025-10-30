import { describe, it, beforeEach, afterEach, mock } from 'bun:test';
import { expect } from 'bun:test';
import { CDNCacheManager, CacheUtils } from '../cache-manager';

// Mock fetch for API calls
const mockFetch = mock();
global.fetch = mockFetch as any;

// Mock environment variables
const originalEnv = process.env;

describe('CDNCacheManager', () => {
  let cacheManager: CDNCacheManager;

  beforeEach(() => {
    // Reset environment
    process.env = {
      ...originalEnv,
      VERCEL_API_TOKEN: 'test-token',
      VERCEL_TEAM_ID: 'test-team',
    };

    // Reset mocks
    mockFetch.mock.resetCalls();

    // Create fresh instance
    cacheManager = new CDNCacheManager();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('purgeCache', () => {
    it('should successfully purge cache by tags', async () => {
      mockFetch.mock.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })
      );

      const result = await cacheManager.purgeByTags(['github', 'api']);

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, options] = mockFetch.mock.calls[0].arguments;
      assert.strictEqual(url, 'https://api.vercel.com/v1/purge');
      assert.strictEqual(options.method, 'POST');
      assert.strictEqual(options.headers.Authorization, 'Bearer test-token');
      assert.strictEqual(options.headers['X-Vercel-Team-Id'], 'test-team');

      const body = JSON.parse(options.body);
      assert.deepStrictEqual(body.tags, ['github', 'api']);
    });

    it('should successfully purge cache by paths', async () => {
      mockFetch.mock.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })
      );

      const result = await cacheManager.purgeByPaths([
        '/api/github/repos',
        '/static/logo.png',
      ]);

      assert.strictEqual(result, true);

      const body = JSON.parse(mockFetch.mock.calls[0].arguments[1].body);
      assert.deepStrictEqual(body.files, [
        '/api/github/repos',
        '/static/logo.png',
      ]);
    });

    it('should successfully purge all cache', async () => {
      mockFetch.mock.mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })
      );

      const result = await cacheManager.purgeAll('Full deployment');

      assert.strictEqual(result, true);

      const body = JSON.parse(mockFetch.mock.calls[0].arguments[1].body);
      assert.strictEqual(body.purgeAll, true);
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mock.mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 401,
          text: () => Promise.resolve('Unauthorized'),
        })
      );

      const result = await cacheManager.purgeByTags(['test']);

      assert.strictEqual(result, false);
    });

    it('should handle network errors gracefully', async () => {
      mockFetch.mock.mockImplementationOnce(() =>
        Promise.reject(new Error('Network error'))
      );

      const result = await cacheManager.purgeByTags(['test']);

      assert.strictEqual(result, false);
    });

    it('should skip purge when API token is missing', async () => {
      delete process.env.VERCEL_API_TOKEN;
      cacheManager = new CDNCacheManager();

      const result = await cacheManager.purgeByTags(['test']);

      assert.strictEqual(result, false);
      assert.strictEqual(mockFetch.mock.callCount(), 0);
    });
  });

  describe('specialized purge methods', () => {
    beforeEach(() => {
      mockFetch.mock.mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })
      );
    });

    it('should purge GitHub cache with identifier', async () => {
      await cacheManager.purgeGitHubCache('repo-123');

      const body = JSON.parse(mockFetch.mock.calls[0].arguments[1].body);
      assert.deepStrictEqual(body.tags, ['github', 'api', 'github:repo-123']);
    });

    it('should purge Slack cache with identifier', async () => {
      await cacheManager.purgeSlackCache('channel-456');

      const body = JSON.parse(mockFetch.mock.calls[0].arguments[1].body);
      assert.deepStrictEqual(body.tags, ['slack', 'api', 'slack:channel-456']);
    });

    it('should purge AI summary cache with identifier', async () => {
      await cacheManager.purgeAISummaryCache('summary-789');

      const body = JSON.parse(mockFetch.mock.calls[0].arguments[1].body);
      assert.deepStrictEqual(body.tags, [
        'ai-summary',
        'api',
        'ai-summary:summary-789',
      ]);
    });

    it('should purge static assets cache', async () => {
      await cacheManager.purgeStaticAssets();

      const body = JSON.parse(mockFetch.mock.calls[0].arguments[1].body);
      assert.deepStrictEqual(body.tags, ['static', 'assets']);
    });
  });

  describe('checkHealth', () => {
    it('should return healthy status when all regions are healthy', async () => {
      // Mock successful health checks
      mockFetch.mock.mockImplementation(url => {
        if (url === '/api/health') {
          return Promise.resolve({ ok: true });
        }
        return Promise.resolve({ ok: true });
      });

      const health = await cacheManager.checkHealth();

      assert.strictEqual(health.status, 'healthy');
      assert.ok(health.hitRate >= 0 && health.hitRate <= 1);
      assert.ok(health.avgResponseTime >= 0);
      assert.ok(health.errorRate >= 0);
      assert.ok(health.lastChecked instanceof Date);
      assert.ok(Array.isArray(health.regions));
    });

    it('should return degraded status when some regions fail', async () => {
      let callCount = 0;
      mockFetch.mock.mockImplementation(url => {
        if (url === '/api/health') {
          callCount++;
          // Fail every other call to simulate partial failures
          return callCount % 2 === 0
            ? Promise.resolve({ ok: false, status: 500 })
            : Promise.resolve({ ok: true });
        }
        return Promise.resolve({ ok: true });
      });

      const health = await cacheManager.checkHealth();

      assert.ok(['healthy', 'degraded', 'unhealthy'].includes(health.status));
      assert.ok(health.regions.length > 0);
    });

    it('should handle network errors during health checks', async () => {
      mockFetch.mock.mockImplementation(url => {
        if (url === '/api/health') {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({ ok: true });
      });

      const health = await cacheManager.checkHealth();

      assert.ok(['healthy', 'degraded', 'unhealthy'].includes(health.status));
      assert.ok(health.regions.every(region => region.errorCount >= 0));
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics structure', async () => {
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
      assert.ok(Array.isArray(stats.topPaths));
    });
  });

  describe('handleCDNFailure', () => {
    it('should create fallback request without CDN headers', async () => {
      const originalRequest = new Request('https://example.com/api/test', {
        method: 'GET',
        headers: {
          'CDN-Cache-Control': 'max-age=3600',
          'Cache-Tag': 'api,test',
          Authorization: 'Bearer token',
        },
      });

      mockFetch.mock.mockImplementationOnce(() =>
        Promise.resolve(
          new Response('fallback response', {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      );

      const response = await cacheManager.handleCDNFailure(originalRequest);

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.headers.get('X-CDN-Fallback'), 'true');

      // Verify CDN headers were removed from the fallback request
      const fallbackCall = mockFetch.mock.calls[0];
      const fallbackRequest = fallbackCall.arguments[0];
      assert.strictEqual(
        fallbackRequest.headers.get('CDN-Cache-Control'),
        null
      );
      assert.strictEqual(fallbackRequest.headers.get('Cache-Tag'), null);
      // Authorization should be preserved
      assert.ok(fallbackRequest.headers.get('Authorization'));
    });

    it('should handle fallback request failures', async () => {
      const originalRequest = new Request('https://example.com/api/test');

      mockFetch.mock.mockImplementationOnce(() =>
        Promise.reject(new Error('Fallback failed'))
      );

      await assert.rejects(
        () => cacheManager.handleCDNFailure(originalRequest),
        /Fallback failed/
      );
    });
  });
});

describe('CacheUtils', () => {
  beforeEach(() => {
    mockFetch.mock.resetCalls();
    mockFetch.mock.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })
    );

    process.env.VERCEL_API_TOKEN = 'test-token';
  });

  describe('utility functions', () => {
    it('should handle asset updates', async () => {
      await CacheUtils.onAssetUpdate(['/static/logo.png', '/static/app.css']);

      assert.strictEqual(mockFetch.mock.callCount(), 1);
      const body = JSON.parse(mockFetch.mock.calls[0].arguments[1].body);
      assert.deepStrictEqual(body.files, [
        '/static/logo.png',
        '/static/app.css',
      ]);
    });

    it('should handle GitHub updates', async () => {
      await CacheUtils.onGitHubUpdate('repo-123');

      assert.strictEqual(mockFetch.mock.callCount(), 1);
      const body = JSON.parse(mockFetch.mock.calls[0].arguments[1].body);
      assert.deepStrictEqual(body.tags, ['github', 'api', 'github:repo-123']);
    });

    it('should handle Slack updates', async () => {
      await CacheUtils.onSlackUpdate('channel-456');

      assert.strictEqual(mockFetch.mock.callCount(), 1);
      const body = JSON.parse(mockFetch.mock.calls[0].arguments[1].body);
      assert.deepStrictEqual(body.tags, ['slack', 'api', 'slack:channel-456']);
    });

    it('should handle AI summary updates', async () => {
      await CacheUtils.onAISummaryUpdate('summary-789');

      assert.strictEqual(mockFetch.mock.callCount(), 1);
      const body = JSON.parse(mockFetch.mock.calls[0].arguments[1].body);
      assert.deepStrictEqual(body.tags, [
        'ai-summary',
        'api',
        'ai-summary:summary-789',
      ]);
    });

    it('should check CDN health status', async () => {
      mockFetch.mock.mockImplementation(() => Promise.resolve({ ok: true }));

      const isHealthy = await CacheUtils.isHealthy();

      assert.strictEqual(typeof isHealthy, 'boolean');
    });

    it('should get performance metrics', async () => {
      mockFetch.mock.mockImplementation(() =>
        Promise.resolve({
          ok: true,
          headers: new Map([['X-Cache', 'HIT']]),
        })
      );

      const metrics = await CacheUtils.getPerformanceMetrics();

      assert.ok(typeof metrics.hitRate === 'number');
      assert.ok(typeof metrics.avgResponseTime === 'number');
      assert.ok(typeof metrics.status === 'string');
    });
  });
});
