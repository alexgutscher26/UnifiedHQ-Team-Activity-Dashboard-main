import { describe, it, expect } from 'bun:test';
import { EdgeConfig } from '../edge-config';

describe('EdgeConfig', () => {
  describe('cache rule matching', () => {
    it('should match static asset patterns', () => {
      const rule = EdgeConfig.getCacheRule('/static/images/logo.png');
      assert.ok(rule);
      assert.strictEqual(rule.maxAge, 31536000);
      assert.strictEqual(rule.immutable, true);
      assert.ok(rule.tags?.includes('static'));
    });

    it('should match image patterns', () => {
      const rule = EdgeConfig.getCacheRule('/images/avatar.jpg');
      assert.ok(rule);
      assert.strictEqual(rule.maxAge, 86400);
      assert.strictEqual(rule.staleWhileRevalidate, 604800);
      assert.ok(rule.tags?.includes('images'));
    });

    it('should match API route patterns', () => {
      const rule = EdgeConfig.getCacheRule('/api/github/repos');
      assert.ok(rule);
      assert.strictEqual(rule.maxAge, 300);
      assert.strictEqual(rule.staleWhileRevalidate, 900);
      assert.ok(rule.tags?.includes('github'));
    });

    it('should match CSS/JS patterns', () => {
      const cssRule = EdgeConfig.getCacheRule('/styles/main.css');
      assert.ok(cssRule);
      assert.strictEqual(cssRule.maxAge, 31536000);
      assert.strictEqual(cssRule.immutable, true);

      const jsRule = EdgeConfig.getCacheRule('/scripts/app.js');
      assert.ok(jsRule);
      assert.strictEqual(jsRule.maxAge, 31536000);
      assert.strictEqual(jsRule.immutable, true);
    });

    it('should return null for unmatched patterns', () => {
      const rule = EdgeConfig.getCacheRule('/unknown/path');
      assert.strictEqual(rule, null);
    });
  });

  describe('cache control header generation', () => {
    it('should generate correct Cache-Control for static assets', () => {
      const rule = {
        pattern: '/static/**/*',
        maxAge: 31536000,
        immutable: true,
        public: true,
        tags: ['static'],
      };

      const cacheControl = EdgeConfig.generateCacheControl(rule);
      assert.ok(cacheControl.includes('public'));
      assert.ok(cacheControl.includes('max-age=31536000'));
      assert.ok(cacheControl.includes('immutable'));
    });

    it('should generate correct Cache-Control for API routes', () => {
      const rule = {
        pattern: '/api/**',
        maxAge: 300,
        staleWhileRevalidate: 600,
        public: true,
        tags: ['api'],
      };

      const cacheControl = EdgeConfig.generateCacheControl(rule);
      assert.ok(cacheControl.includes('public'));
      assert.ok(cacheControl.includes('max-age=300'));
      assert.ok(cacheControl.includes('stale-while-revalidate=600'));
    });

    it('should generate private cache control for user data', () => {
      const rule = {
        pattern: '/api/user/**',
        maxAge: 300,
        public: false,
        tags: ['user'],
      };

      const cacheControl = EdgeConfig.generateCacheControl(rule);
      assert.ok(cacheControl.includes('private'));
      assert.ok(cacheControl.includes('max-age=300'));
    });

    it('should handle no-cache scenarios', () => {
      const rule = {
        pattern: '/api/health',
        maxAge: 0,
        public: true,
        tags: ['health'],
      };

      const cacheControl = EdgeConfig.generateCacheControl(rule);
      assert.ok(cacheControl.includes('max-age=0'));
    });
  });

  describe('CDN cache control generation', () => {
    it('should use sMaxAge when available', () => {
      const rule = {
        pattern: '/api/**',
        maxAge: 300,
        sMaxAge: 60,
        public: true,
        tags: ['api'],
      };

      const cdnCacheControl = EdgeConfig.generateCDNCacheControl(rule);
      assert.ok(cdnCacheControl.includes('max-age=60'));
    });

    it('should fallback to maxAge when sMaxAge not available', () => {
      const rule = {
        pattern: '/static/**',
        maxAge: 31536000,
        public: true,
        tags: ['static'],
      };

      const cdnCacheControl = EdgeConfig.generateCDNCacheControl(rule);
      assert.ok(cdnCacheControl.includes('max-age=31536000'));
    });
  });

  describe('cache tag generation', () => {
    it('should generate tags from rule and path', () => {
      const rule = {
        pattern: '/api/github/**',
        maxAge: 300,
        tags: ['api', 'github'],
      };

      const tags = EdgeConfig.generateCacheTags(rule, '/api/github/repos');
      assert.ok(tags.includes('api'));
      assert.ok(tags.includes('github'));
      assert.ok(tags.includes('path:api'));
    });

    it('should add path-specific tags', () => {
      const rule = {
        pattern: '/static/**',
        maxAge: 31536000,
        tags: ['static'],
      };

      const tags = EdgeConfig.generateCacheTags(
        rule,
        '/static/images/logo.png'
      );
      assert.ok(tags.includes('static'));
      assert.ok(tags.includes('path:static'));
    });

    it('should remove duplicate tags', () => {
      const rule = {
        pattern: '/api/**',
        maxAge: 300,
        tags: ['api'],
      };

      const tags = EdgeConfig.generateCacheTags(rule, '/api/github/repos');
      const apiTags = tags.filter(tag => tag === 'api');
      assert.strictEqual(apiTags.length, 1);
    });
  });

  describe('caching eligibility', () => {
    it('should cache GET requests', () => {
      assert.strictEqual(EdgeConfig.shouldCache('/api/data', 'GET'), true);
    });

    it('should not cache non-GET requests', () => {
      assert.strictEqual(EdgeConfig.shouldCache('/api/data', 'POST'), false);
      assert.strictEqual(EdgeConfig.shouldCache('/api/data', 'PUT'), false);
      assert.strictEqual(EdgeConfig.shouldCache('/api/data', 'DELETE'), false);
    });

    it('should not cache auth endpoints', () => {
      assert.strictEqual(
        EdgeConfig.shouldCache('/api/auth/signin', 'GET'),
        false
      );
      assert.strictEqual(
        EdgeConfig.shouldCache('/api/auth/callback', 'GET'),
        false
      );
    });

    it('should not cache health endpoints', () => {
      assert.strictEqual(EdgeConfig.shouldCache('/api/health', 'GET'), false);
    });

    it('should not cache real-time endpoints', () => {
      assert.strictEqual(
        EdgeConfig.shouldCache('/api/activities/live', 'GET'),
        false
      );
      assert.strictEqual(
        EdgeConfig.shouldCache('/api/stream/events', 'GET'),
        false
      );
    });
  });

  describe('pattern matching', () => {
    it('should match wildcard patterns', () => {
      assert.strictEqual(
        EdgeConfig['matchesPattern']('/static/css/main.css', '/static/**/*'),
        true
      );
      assert.strictEqual(
        EdgeConfig['matchesPattern']('/api/github/repos', '/api/**'),
        true
      );
    });

    it('should match single wildcard patterns', () => {
      assert.strictEqual(
        EdgeConfig['matchesPattern']('/images/logo.png', '/images/*'),
        true
      );
      assert.strictEqual(
        EdgeConfig['matchesPattern']('/images/subfolder/logo.png', '/images/*'),
        false
      );
    });

    it('should match file extension patterns', () => {
      assert.strictEqual(
        EdgeConfig['matchesPattern']('/styles/main.css', '**/*.{css,js}'),
        true
      );
      assert.strictEqual(
        EdgeConfig['matchesPattern']('/scripts/app.js', '**/*.{css,js}'),
        true
      );
      assert.strictEqual(
        EdgeConfig['matchesPattern']('/images/logo.png', '**/*.{css,js}'),
        false
      );
    });

    it('should match exact patterns', () => {
      assert.strictEqual(EdgeConfig['matchesPattern']('/', '/'), true);
      assert.strictEqual(
        EdgeConfig['matchesPattern']('/api/health', '/api/health'),
        true
      );
      assert.strictEqual(
        EdgeConfig['matchesPattern']('/api/health/check', '/api/health'),
        false
      );
    });
  });

  describe('optimization settings', () => {
    it('should return image optimization settings', () => {
      const optimization = EdgeConfig.getOptimization('images');
      assert.strictEqual(optimization.webp, true);
      assert.strictEqual(optimization.avif, true);
      assert.strictEqual(optimization.quality, 85);
      assert.strictEqual(optimization.progressive, true);
    });

    it('should return thumbnail optimization settings', () => {
      const optimization = EdgeConfig.getOptimization('thumbnails');
      assert.strictEqual(optimization.webp, true);
      assert.strictEqual(optimization.avif, true);
      assert.strictEqual(optimization.quality, 75);
      assert.strictEqual(optimization.progressive, false);
    });

    it('should fallback to default image settings', () => {
      const optimization = EdgeConfig.getOptimization('unknown');
      assert.strictEqual(optimization.webp, true);
      assert.strictEqual(optimization.avif, true);
      assert.strictEqual(optimization.quality, 85);
    });
  });

  describe('edge regions', () => {
    it('should return configured edge regions', () => {
      const regions = EdgeConfig.getEdgeRegions();
      assert.ok(Array.isArray(regions));
      assert.ok(regions.length > 0);
      assert.ok(regions.includes('iad1')); // US East
      assert.ok(regions.includes('sfo1')); // US West
      assert.ok(regions.includes('lhr1')); // Europe
    });
  });

  describe('edge function configuration', () => {
    it('should return edge function config', () => {
      const config = EdgeConfig.getEdgeFunctionConfig();
      assert.strictEqual(config.runtime, 'edge');
      assert.ok(Array.isArray(config.regions));
      assert.strictEqual(config.maxDuration, 30);
    });
  });
});
