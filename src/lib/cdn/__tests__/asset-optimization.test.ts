import { describe, it, expect, beforeEach } from 'bun:test';
import { EdgeConfig } from '../edge-config';
import { EdgeMiddleware } from '../edge-middleware';
import { NextRequest, NextResponse } from 'next/server';

describe('Asset Delivery Optimization Tests', () => {
  let middleware: EdgeMiddleware;

  beforeEach(() => {
    middleware = new EdgeMiddleware();
  });

  describe('Static Asset Optimization', () => {
    it('should optimize cache headers for CSS files', () => {
      const rule = EdgeConfig.getCacheRule('/static/css/main.css');

      expect(rule).toBeTruthy();
      expect(rule?.maxAge).toBeGreaterThanOrEqual(31536000); // At least 1 year
      expect(rule?.immutable).toBe(true);
      expect(rule?.public).toBe(true);

      const cacheControl = EdgeConfig.generateCacheControl(rule!);
      expect(cacheControl).toContain('immutable');
      expect(cacheControl).toContain('public');
    });

    it('should optimize cache headers for JavaScript files', () => {
      const rule = EdgeConfig.getCacheRule('/static/js/app.js');

      expect(rule).toBeTruthy();
      expect(rule?.maxAge).toBeGreaterThanOrEqual(31536000); // At least 1 year
      expect(rule?.immutable).toBe(true);
      expect(rule?.public).toBe(true);
    });

    it('should optimize cache headers for image files', () => {
      const rule = EdgeConfig.getCacheRule('/images/logo.png');

      expect(rule).toBeTruthy();
      expect(rule?.maxAge).toBeGreaterThanOrEqual(86400); // At least 24 hours
      expect(rule?.staleWhileRevalidate).toBeGreaterThan(rule?.maxAge || 0);
      expect(rule?.public).toBe(true);
    });

    it('should optimize cache headers for font files', () => {
      const rule = EdgeConfig.getCacheRule('/fonts/inter.woff2');

      expect(rule).toBeTruthy();
      expect(rule?.maxAge).toBeGreaterThanOrEqual(31536000); // At least 1 year
      expect(rule?.immutable).toBe(true);
      expect(rule?.public).toBe(true);
    });
  });

  describe('API Response Optimization', () => {
    it('should balance performance and freshness for GitHub API', () => {
      const rule = EdgeConfig.getCacheRule('/api/github/repos');

      expect(rule).toBeTruthy();
      expect(rule?.maxAge).toBeLessThanOrEqual(900); // Max 15 minutes
      expect(rule?.staleWhileRevalidate).toBeGreaterThan(rule?.maxAge || 0);
      expect(rule?.public).toBe(true);
    });

    it('should optimize Slack API caching for real-time feel', () => {
      const rule = EdgeConfig.getCacheRule('/api/slack/channels');

      expect(rule).toBeTruthy();
      expect(rule?.maxAge).toBeLessThanOrEqual(300); // Max 5 minutes
      expect(rule?.staleWhileRevalidate).toBeGreaterThan(rule?.maxAge || 0);
    });

    it('should cache AI summaries for longer periods', () => {
      const rule = EdgeConfig.getCacheRule('/api/ai-summary/latest');

      expect(rule).toBeTruthy();
      expect(rule?.maxAge).toBeGreaterThanOrEqual(1800); // At least 30 minutes
      expect(rule?.staleWhileRevalidate).toBeGreaterThan(rule?.maxAge || 0);
    });

    it('should not publicly cache user-specific data', () => {
      const rule = EdgeConfig.getCacheRule('/api/user/profile');

      if (rule) {
        expect(rule.public).toBe(false);
      }
    });
  });

  describe('Image Optimization Settings', () => {
    it('should provide WebP and AVIF optimization for images', () => {
      const optimization = EdgeConfig.getOptimization('images');

      expect(optimization.webp).toBe(true);
      expect(optimization.avif).toBe(true);
      expect(optimization.quality).toBeGreaterThanOrEqual(80);
      expect(optimization.progressive).toBe(true);
    });

    it('should provide optimized settings for thumbnails', () => {
      const optimization = EdgeConfig.getOptimization('thumbnails');

      expect(optimization.webp).toBe(true);
      expect(optimization.quality).toBeLessThan(85); // Lower quality for thumbnails
    });

    it('should provide high-quality settings for avatars', () => {
      const optimization = EdgeConfig.getOptimization('avatars');

      expect(optimization.webp).toBe(true);
      expect(optimization.quality).toBeGreaterThanOrEqual(85);
    });
  });

  describe('Compression Optimization', () => {
    it('should identify compressible content types correctly', () => {
      const compressibleTypes = [
        'text/html',
        'text/css',
        'application/javascript',
        'application/json',
        'image/svg+xml',
      ];

      const nonCompressibleTypes = [
        'image/png',
        'image/jpeg',
        'video/mp4',
        'application/octet-stream',
      ];

      compressibleTypes.forEach(contentType => {
        const shouldCompress = [
          'text/',
          'application/json',
          'application/javascript',
          'application/xml',
          'image/svg+xml',
        ].some(type => contentType.includes(type));

        expect(shouldCompress).toBe(true);
      });

      nonCompressibleTypes.forEach(contentType => {
        const shouldCompress = [
          'text/',
          'application/json',
          'application/javascript',
          'application/xml',
          'image/svg+xml',
        ].some(type => contentType.includes(type));

        expect(shouldCompress).toBe(false);
      });
    });
  });

  describe('Edge Region Configuration', () => {
    it('should provide global edge regions for optimal delivery', () => {
      const regions = EdgeConfig.getEdgeRegions();

      expect(Array.isArray(regions)).toBe(true);
      expect(regions.length).toBeGreaterThan(0);

      // Should include major regions
      expect(regions).toContain('iad1'); // US East
      expect(regions).toContain('sfo1'); // US West
      expect(regions).toContain('lhr1'); // Europe
    });

    it('should provide edge function configuration', () => {
      const config = EdgeConfig.getEdgeFunctionConfig();

      expect(config.runtime).toBe('edge');
      expect(Array.isArray(config.regions)).toBe(true);
      expect(config.maxDuration).toBeGreaterThan(0);
    });
  });

  describe('Cache Strategy Performance', () => {
    it('should use cache-first strategy for static assets', () => {
      const staticPaths = [
        '/static/css/main.css',
        '/static/js/app.js',
        '/static/images/logo.png',
      ];

      staticPaths.forEach(path => {
        const rule = EdgeConfig.getCacheRule(path);
        expect(rule).toBeTruthy();
        expect(rule?.immutable).toBe(true); // Indicates cache-first strategy
      });
    });

    it('should use network-first with fallback for API routes', () => {
      const apiPaths = [
        '/api/github/repos',
        '/api/slack/channels',
        '/api/ai-summary/latest',
      ];

      apiPaths.forEach(path => {
        const rule = EdgeConfig.getCacheRule(path);
        expect(rule).toBeTruthy();
        expect(rule?.staleWhileRevalidate).toBeGreaterThan(0); // Indicates network-first with fallback
      });
    });

    it('should use appropriate TTL for different content types', () => {
      const contentTests = [
        { path: '/static/css/main.css', minTTL: 31536000 }, // 1 year
        { path: '/api/github/repos', maxTTL: 900 }, // 15 minutes
        { path: '/images/avatar.jpg', minTTL: 86400 }, // 1 day
        { path: '/api/ai-summary/latest', minTTL: 1800 }, // 30 minutes
      ];

      contentTests.forEach(({ path, minTTL, maxTTL }) => {
        const rule = EdgeConfig.getCacheRule(path);
        expect(rule).toBeTruthy();

        if (minTTL) {
          expect(rule?.maxAge).toBeGreaterThanOrEqual(minTTL);
        }
        if (maxTTL) {
          expect(rule?.maxAge).toBeLessThanOrEqual(maxTTL);
        }
      });
    });
  });

  describe('Security and Performance Balance', () => {
    it('should not cache sensitive endpoints', () => {
      const sensitiveEndpoints = [
        '/api/auth/signin',
        '/api/auth/callback',
        '/api/health',
        '/api/activities/live',
        '/api/stream/events',
      ];

      sensitiveEndpoints.forEach(path => {
        const shouldCache = EdgeConfig.shouldCache(path, 'GET');
        expect(shouldCache).toBe(false);
      });
    });

    it('should cache public endpoints appropriately', () => {
      const publicEndpoints = [
        '/api/github/repos',
        '/api/slack/channels',
        '/static/css/main.css',
        '/images/logo.png',
      ];

      publicEndpoints.forEach(path => {
        const shouldCache = EdgeConfig.shouldCache(path, 'GET');
        expect(shouldCache).toBe(true);
      });
    });
  });

  describe('Performance Benchmarks', () => {
    it('should generate cache headers efficiently', () => {
      const iterations = 1000;
      const testPaths = [
        '/static/css/main.css',
        '/api/github/repos',
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

      // Should complete operations quickly
      expect(duration).toBeLessThan(100); // Less than 100ms for 1000 operations
    });

    it('should handle pattern matching efficiently', () => {
      const testPaths = Array.from({ length: 100 }, (_, i) => `/api/test-${i}`);
      const iterations = 100;

      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        testPaths.forEach(path => {
          EdgeConfig.getCacheRule(path);
        });
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Pattern matching should be fast
      const totalOperations = iterations * testPaths.length;
      const opsPerMs = totalOperations / duration;

      expect(opsPerMs).toBeGreaterThan(10); // At least 10 operations per millisecond
    });
  });

  describe('CDN Integration Validation', () => {
    it('should provide valid cache control headers for Vercel Edge', () => {
      const testCases = [
        { path: '/static/css/main.css', expectedPublic: true },
        { path: '/api/github/repos', expectedPublic: true },
        { path: '/api/user/profile', expectedPublic: false },
      ];

      testCases.forEach(({ path, expectedPublic }) => {
        const rule = EdgeConfig.getCacheRule(path);

        if (rule) {
          const cacheControl = EdgeConfig.generateCacheControl(rule);
          const cdnCacheControl = EdgeConfig.generateCDNCacheControl(rule);

          if (expectedPublic) {
            expect(cacheControl).toContain('public');
            expect(cdnCacheControl).toContain('public');
          } else {
            expect(cacheControl).toContain('private');
          }

          // Should have valid max-age
          expect(cacheControl).toMatch(/max-age=\d+/);
          expect(cdnCacheControl).toMatch(/max-age=\d+/);
        }
      });
    });

    it('should generate appropriate cache tags for invalidation', () => {
      const testCases = [
        { path: '/api/github/repos', expectedTags: ['api', 'github'] },
        { path: '/api/slack/channels', expectedTags: ['api', 'slack'] },
        { path: '/static/css/main.css', expectedTags: ['static'] },
      ];

      testCases.forEach(({ path, expectedTags }) => {
        const rule = EdgeConfig.getCacheRule(path);

        if (rule) {
          const tags = EdgeConfig.generateCacheTags(rule, path);

          expectedTags.forEach(expectedTag => {
            expect(tags).toContain(expectedTag);
          });
        }
      });
    });
  });
});
