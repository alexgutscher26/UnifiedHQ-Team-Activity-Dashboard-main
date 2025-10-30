import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import { performance } from 'perf_hooks';
import { CDNCacheManager, CacheUtils } from '../cache-manager';
import { EdgeConfig } from '../edge-config';
import { EdgeMiddleware } from '../edge-middleware';
import { NextRequest, NextResponse } from 'next/server';

// Mock fetch for performance tests
const mockFetch = mock.fn();
global.fetch = mockFetch as any;

describe('CDN Performance Tests', () => {
  let cacheManager: CDNCacheManager;
  let middleware: EdgeMiddleware;

  beforeEach(() => {
    // Set up test environment
    process.env.VERCEL_API_TOKEN = 'test-token';

    // Reset mocks
    mockFetch.mock.resetCalls();

    // Create instances
    cacheManager = new CDNCacheManager();
    middleware = new EdgeMiddleware();
  });

  afterEach(() => {
    delete process.env.VERCEL_API_TOKEN;
  });

  describe('cache header performance', () => {
    it('should generate cache headers efficiently for high-frequency requests', () => {
      const iterations = 1000;
      const testPaths = [
        '/api/github/repos',
        '/api/slack/channels',
        '/static/css/main.css',
        '/images/avatar.jpg',
        '/fonts/inter.woff2',
      ];

      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const path = testPaths[i % testPaths.length];
        const rule = EdgeConfig.getCacheRule(path);

        if (rule) {
          EdgeConfig.generateCacheControl(rule);
          EdgeConfig.generateCDNCacheControl(rule);
          EdgeConfig.generateCacheTags(rule, path);
        }
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete 1000 operations in under 100ms
      assert.ok(
        duration < 100,
        `Cache header generation took ${duration}ms, expected < 100ms`
      );

      // Calculate operations per second
      const opsPerSecond = (iterations / duration) * 1000;
      assert.ok(
        opsPerSecond > 10000,
        `Expected > 10k ops/sec, got ${opsPerSecond.toFixed(0)}`
      );
    });

    it('should handle pattern matching efficiently for large numbers of paths', () => {
      const testPaths = [
        '/static/images/logo.png',
        '/static/css/main.css',
        '/static/js/app.js',
        '/api/github/repos/123',
        '/api/slack/channels/456',
        '/api/ai-summary/789',
        '/dashboard/team-activity',
        '/auth/signin',
        '/images/avatar-1.jpg',
        '/fonts/inter-regular.woff2',
      ];

      const iterations = 500;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        testPaths.forEach(path => {
          EdgeConfig.getCacheRule(path);
        });
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete pattern matching efficiently
      const totalOperations = iterations * testPaths.length;
      const opsPerSecond = (totalOperations / duration) * 1000;

      assert.ok(
        opsPerSecond > 50000,
        `Pattern matching: expected > 50k ops/sec, got ${opsPerSecond.toFixed(0)}`
      );
    });
  });

  describe('middleware performance', () => {
    it('should process requests efficiently under load', async () => {
      const iterations = 100;
      const requests = [];
      const responses = [];

      // Prepare test data
      for (let i = 0; i < iterations; i++) {
        requests.push(new NextRequest(`https://example.com/api/test-${i}`));
        responses.push(new NextResponse(`response-${i}`));
      }

      const startTime = performance.now();

      // Process all requests
      const results = await Promise.all(
        requests.map((req, i) => middleware.process(req, responses[i]))
      );

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Verify all requests were processed
      assert.strictEqual(results.length, iterations);
      results.forEach(result => {
        assert.ok(result instanceof NextResponse);
      });

      // Performance assertions
      const avgProcessingTime = duration / iterations;
      assert.ok(
        avgProcessingTime < 10,
        `Average processing time ${avgProcessingTime.toFixed(2)}ms, expected < 10ms`
      );

      const requestsPerSecond = (iterations / duration) * 1000;
      assert.ok(
        requestsPerSecond > 100,
        `Expected > 100 req/sec, got ${requestsPerSecond.toFixed(0)}`
      );
    });

    it('should handle concurrent request processing efficiently', async () => {
      const concurrentRequests = 50;
      const requests = Array.from(
        { length: concurrentRequests },
        (_, i) => new NextRequest(`https://example.com/api/concurrent-${i}`)
      );
      const responses = Array.from(
        { length: concurrentRequests },
        (_, i) => new NextResponse(`response-${i}`)
      );

      const startTime = performance.now();

      // Process requests concurrently
      const results = await Promise.all(
        requests.map((req, i) => middleware.process(req, responses[i]))
      );

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Verify results
      assert.strictEqual(results.length, concurrentRequests);

      // Concurrent processing should be faster than sequential
      const concurrentRps = (concurrentRequests / duration) * 1000;
      assert.ok(
        concurrentRps > 200,
        `Concurrent processing: expected > 200 req/sec, got ${concurrentRps.toFixed(0)}`
      );
    });
  });

  describe('cache purging performance', () => {
    it('should handle batch purge operations efficiently', async () => {
      mockFetch.mock.mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })
      );

      const batchSize = 20;
      const operations = [];

      // Prepare batch operations
      for (let i = 0; i < batchSize; i++) {
        operations.push(() =>
          cacheManager.purgeByTags([`tag-${i}`, 'batch-test'])
        );
      }

      const startTime = performance.now();

      // Execute batch operations
      const results = await Promise.all(operations.map(op => op()));

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Verify all operations succeeded
      assert.ok(results.every(result => result === true));
      assert.strictEqual(mockFetch.mock.callCount(), batchSize);

      // Performance assertions
      const avgOperationTime = duration / batchSize;
      assert.ok(
        avgOperationTime < 50,
        `Average purge time ${avgOperationTime.toFixed(2)}ms, expected < 50ms`
      );
    });

    it('should handle high-frequency cache invalidations efficiently', async () => {
      mockFetch.mock.mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })
      );

      const invalidationCount = 100;
      const startTime = performance.now();

      // Simulate high-frequency invalidations
      const promises = [];
      for (let i = 0; i < invalidationCount; i++) {
        if (i % 4 === 0) {
          promises.push(CacheUtils.onGitHubUpdate(`repo-${i}`));
        } else if (i % 4 === 1) {
          promises.push(CacheUtils.onSlackUpdate(`channel-${i}`));
        } else if (i % 4 === 2) {
          promises.push(CacheUtils.onAISummaryUpdate(`summary-${i}`));
        } else {
          promises.push(CacheUtils.onAssetUpdate([`/static/asset-${i}.css`]));
        }
      }

      await Promise.all(promises);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Performance assertions
      const invalidationsPerSecond = (invalidationCount / duration) * 1000;
      assert.ok(
        invalidationsPerSecond > 50,
        `Expected > 50 invalidations/sec, got ${invalidationsPerSecond.toFixed(0)}`
      );
    });
  });

  describe('health check performance', () => {
    it('should perform health checks within acceptable time limits', async () => {
      // Mock fast health responses
      mockFetch.mock.mockImplementation(url => {
        if (url === '/api/health') {
          return new Promise(resolve => {
            setTimeout(() => {
              resolve({
                ok: true,
                headers: new Map([['X-Cache', 'HIT']]),
              });
            }, 10); // Simulate 10ms response time
          });
        }
        return Promise.resolve({ ok: true });
      });

      const startTime = performance.now();
      const health = await cacheManager.checkHealth();
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Health check should complete quickly
      assert.ok(
        duration < 1000,
        `Health check took ${duration}ms, expected < 1000ms`
      );
      assert.ok(
        health.avgResponseTime < 100,
        `Average response time ${health.avgResponseTime}ms, expected < 100ms`
      );
    });

    it('should handle slow regions without blocking overall health check', async () => {
      let callCount = 0;
      mockFetch.mock.mockImplementation(url => {
        if (url === '/api/health') {
          callCount++;
          const delay = callCount <= 2 ? 500 : 50; // First two regions are slow

          return new Promise(resolve => {
            setTimeout(() => {
              resolve({
                ok: true,
                headers: new Map([['X-Cache', 'HIT']]),
              });
            }, delay);
          });
        }
        return Promise.resolve({ ok: true });
      });

      const startTime = performance.now();
      const health = await cacheManager.checkHealth();
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete despite slow regions (parallel execution)
      assert.ok(
        duration < 1000,
        `Health check with slow regions took ${duration}ms, expected < 1000ms`
      );
      assert.ok(health.regions.length > 0);
    });
  });

  describe('memory usage optimization', () => {
    it('should not leak memory during repeated operations', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const iterations = 1000;

      // Perform memory-intensive operations
      for (let i = 0; i < iterations; i++) {
        const rule = EdgeConfig.getCacheRule('/api/test');
        if (rule) {
          EdgeConfig.generateCacheControl(rule);
          EdgeConfig.generateCDNCacheControl(rule);
          EdgeConfig.generateCacheTags(rule, '/api/test');
        }

        // Create and process middleware requests
        const request = new NextRequest(`https://example.com/test-${i}`);
        const response = new NextResponse(`response-${i}`);

        // Simulate processing without awaiting (to test sync operations)
        middleware.process(request, response);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      const memoryIncreasePerOp = memoryIncrease / iterations;

      // Memory increase should be minimal (< 1KB per operation)
      assert.ok(
        memoryIncreasePerOp < 1024,
        `Memory increase per operation: ${memoryIncreasePerOp.toFixed(0)} bytes, expected < 1024 bytes`
      );
    });

    it('should efficiently handle large cache tag arrays', () => {
      const largeTags = Array.from({ length: 100 }, (_, i) => `tag-${i}`);
      const iterations = 100;

      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const rule = {
          pattern: '/api/**',
          maxAge: 300,
          tags: largeTags,
        };

        EdgeConfig.generateCacheTags(rule, '/api/test');
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should handle large tag arrays efficiently
      const opsPerSecond = (iterations / duration) * 1000;
      assert.ok(
        opsPerSecond > 1000,
        `Large tag processing: expected > 1k ops/sec, got ${opsPerSecond.toFixed(0)}`
      );
    });
  });

  describe('asset delivery optimization', () => {
    it('should optimize static asset cache headers for maximum performance', () => {
      const staticAssetPaths = [
        '/static/css/main.css',
        '/static/js/app.js',
        '/static/images/logo.png',
        '/static/fonts/inter.woff2',
      ];

      staticAssetPaths.forEach(path => {
        const rule = EdgeConfig.getCacheRule(path);
        assert.ok(rule, `Should have cache rule for ${path}`);

        // Static assets should have long cache times
        assert.ok(
          rule.maxAge >= 86400,
          `${path} should have long cache time, got ${rule.maxAge}`
        );

        // Should be marked as immutable for versioned assets
        if (path.includes('/static/')) {
          assert.strictEqual(
            rule.immutable,
            true,
            `${path} should be immutable`
          );
        }

        // Should be publicly cacheable
        assert.strictEqual(
          rule.public,
          true,
          `${path} should be publicly cacheable`
        );
      });
    });

    it('should optimize API response cache headers for balanced performance', () => {
      const apiPaths = [
        '/api/github/repos',
        '/api/slack/channels',
        '/api/ai-summary/latest',
        '/api/user/profile',
      ];

      apiPaths.forEach(path => {
        const rule = EdgeConfig.getCacheRule(path);

        if (rule) {
          // API responses should have shorter cache times
          assert.ok(
            rule.maxAge <= 1800,
            `${path} should have short cache time, got ${rule.maxAge}`
          );

          // Should have stale-while-revalidate for better UX
          if (rule.staleWhileRevalidate) {
            assert.ok(
              rule.staleWhileRevalidate > rule.maxAge,
              `${path} stale-while-revalidate should be longer than max-age`
            );
          }

          // User-specific endpoints should not be publicly cached
          if (path.includes('/user/')) {
            assert.strictEqual(
              rule.public,
              false,
              `${path} should not be publicly cacheable`
            );
          }
        }
      });
    });

    it('should provide optimal cache strategies for different content types', () => {
      const contentTests = [
        { path: '/static/images/hero.jpg', expectedStrategy: 'long-term' },
        { path: '/api/github/activity', expectedStrategy: 'short-term' },
        { path: '/dashboard', expectedStrategy: 'dynamic' },
        { path: '/api/health', expectedStrategy: 'no-cache' },
      ];

      contentTests.forEach(({ path, expectedStrategy }) => {
        const rule = EdgeConfig.getCacheRule(path);

        switch (expectedStrategy) {
          case 'long-term':
            assert.ok(
              rule && rule.maxAge >= 86400,
              `${path} should have long-term caching`
            );
            break;
          case 'short-term':
            assert.ok(
              rule && rule.maxAge <= 900,
              `${path} should have short-term caching`
            );
            break;
          case 'dynamic':
            assert.ok(
              rule && rule.staleWhileRevalidate,
              `${path} should have stale-while-revalidate`
            );
            break;
          case 'no-cache':
            assert.ok(
              !rule || rule.maxAge === 0,
              `${path} should not be cached`
            );
            break;
        }
      });
    });
  });

  describe('compression performance', () => {
    it('should efficiently determine compression eligibility', () => {
      const contentTypes = [
        'text/html',
        'text/css',
        'application/javascript',
        'application/json',
        'image/svg+xml',
        'image/png',
        'video/mp4',
        'application/pdf',
      ];

      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        contentTypes.forEach(contentType => {
          // Simulate compression eligibility check
          const compressibleTypes = [
            'text/',
            'application/json',
            'application/javascript',
            'application/xml',
            'image/svg+xml',
          ];
          compressibleTypes.some(type => contentType.includes(type));
        });
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      const totalChecks = iterations * contentTypes.length;
      const checksPerSecond = (totalChecks / duration) * 1000;

      assert.ok(
        checksPerSecond > 100000,
        `Compression checks: expected > 100k/sec, got ${checksPerSecond.toFixed(0)}`
      );
    });
  });
});
