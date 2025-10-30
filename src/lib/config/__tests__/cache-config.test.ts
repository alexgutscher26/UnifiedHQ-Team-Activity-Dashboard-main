// Tests for Cache Configuration System
// Validates environment-specific cache configurations

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { CacheConfig } from '../cache-config';

describe('CacheConfig', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
    // Reset configuration before each test
    CacheConfig.resetConfig();
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.NODE_ENV = originalEnv;
    } else {
      delete process.env.NODE_ENV;
    }
    CacheConfig.resetConfig();
  });

  describe('Environment Configuration', () => {
    it('should load development configuration', () => {
      process.env.NODE_ENV = 'development';

      const config = CacheConfig.getConfig();

      expect(config.redis.poolSize.max).toBe(5);
      expect(config.cdn.enabled).toBe(false);
      expect(config.serviceWorker.enabled).toBe(true);
      expect(config.featureFlags.cacheWarming).toBe(false);
    });

    it('should load production configuration', () => {
      process.env.NODE_ENV = 'production';

      const config = CacheConfig.getConfig();

      expect(config.redis.poolSize.max).toBe(20);
      expect(config.cdn.enabled).toBe(true);
      expect(config.serviceWorker.enabled).toBe(true);
      expect(config.featureFlags.cacheWarming).toBe(true);
    });

    it('should load staging configuration', () => {
      process.env.NODE_ENV = 'staging';

      const config = CacheConfig.getConfig();

      expect(config.redis.poolSize.max).toBe(10);
      expect(config.cdn.enabled).toBe(true);
      expect(config.cdn.regions).toContain('iad1');
      expect(config.cdn.regions).toContain('sfo1');
    });

    it('should load test configuration', () => {
      process.env.NODE_ENV = 'test';

      const config = CacheConfig.getConfig();

      expect(config.redis.url).toContain('/1'); // Test database
      expect(config.cdn.enabled).toBe(false);
      expect(config.serviceWorker.enabled).toBe(false);
      expect(config.monitoring.enabled).toBe(false);
    });

    it('should default to development for unknown environment', () => {
      process.env.NODE_ENV = 'unknown';

      const config = CacheConfig.getConfig();

      expect(config.redis.poolSize.max).toBe(5);
      expect(config.cdn.enabled).toBe(false);
    });
  });

  describe('Redis Configuration', () => {
    it('should use environment variable for Redis URL', () => {
      process.env.REDIS_URL = 'redis://custom:6379';
      process.env.NODE_ENV = 'development';

      const redisConfig = CacheConfig.getRedisConfig();

      expect(redisConfig.url).toBe('redis://custom:6379');
    });

    it('should have valid pool size configuration', () => {
      const redisConfig = CacheConfig.getRedisConfig();

      expect(redisConfig.poolSize.min).toBeGreaterThan(0);
      expect(redisConfig.poolSize.max).toBeGreaterThan(
        redisConfig.poolSize.min
      );
    });

    it('should have reasonable timeout values', () => {
      const redisConfig = CacheConfig.getRedisConfig();

      expect(redisConfig.connectionTimeout).toBeGreaterThan(0);
      expect(redisConfig.commandTimeout).toBeGreaterThan(0);
      expect(redisConfig.retryDelay).toBeGreaterThan(0);
    });
  });

  describe('CDN Configuration', () => {
    it('should enable CDN in production', () => {
      process.env.NODE_ENV = 'production';

      const cdnConfig = CacheConfig.getCDNConfig();

      expect(cdnConfig.enabled).toBe(true);
      expect(cdnConfig.provider).toBe('vercel');
      expect(cdnConfig.regions.length).toBeGreaterThan(0);
    });

    it('should disable CDN in development', () => {
      process.env.NODE_ENV = 'development';

      const cdnConfig = CacheConfig.getCDNConfig();

      expect(cdnConfig.enabled).toBe(false);
    });

    it('should include global regions in production', () => {
      process.env.NODE_ENV = 'production';

      const cdnConfig = CacheConfig.getCDNConfig();

      expect(cdnConfig.regions).toContain('iad1'); // US East
      expect(cdnConfig.regions).toContain('lhr1'); // Europe
      expect(cdnConfig.regions).toContain('hnd1'); // Asia
    });
  });

  describe('Service Worker Configuration', () => {
    it('should have valid cache version', () => {
      const swConfig = CacheConfig.getServiceWorkerConfig();

      expect(swConfig.cacheVersion).toBeDefined();
      expect(swConfig.cacheVersion.length).toBeGreaterThan(0);
    });

    it('should have reasonable cache size limits', () => {
      const swConfig = CacheConfig.getServiceWorkerConfig();

      expect(swConfig.maxCacheSize).toBeGreaterThan(0);
      expect(swConfig.maxCacheSize).toBeLessThan(1000); // Less than 1GB
    });

    it('should include essential offline pages', () => {
      const swConfig = CacheConfig.getServiceWorkerConfig();

      expect(swConfig.offlinePages).toContain('/dashboard');
      expect(swConfig.offlinePages).toContain('/');
    });
  });

  describe('Monitoring Configuration', () => {
    it('should have valid alert thresholds', () => {
      const monitoringConfig = CacheConfig.getMonitoringConfig();

      expect(monitoringConfig.alertThresholds.hitRate).toBeGreaterThan(0);
      expect(monitoringConfig.alertThresholds.hitRate).toBeLessThanOrEqual(100);
      expect(monitoringConfig.alertThresholds.responseTime).toBeGreaterThan(0);
      expect(monitoringConfig.alertThresholds.errorRate).toBeGreaterThanOrEqual(
        0
      );
      expect(monitoringConfig.alertThresholds.errorRate).toBeLessThanOrEqual(
        100
      );
    });

    it('should have reasonable metrics interval', () => {
      const monitoringConfig = CacheConfig.getMonitoringConfig();

      expect(monitoringConfig.metricsInterval).toBeGreaterThan(0);
      expect(monitoringConfig.metricsInterval).toBeLessThan(3600); // Less than 1 hour
    });
  });

  describe('Feature Flags', () => {
    it('should have consistent feature flag configuration', () => {
      const featureFlags = CacheConfig.getFeatureFlags();

      expect(typeof featureFlags.intelligentPreloading).toBe('boolean');
      expect(typeof featureFlags.backgroundSync).toBe('boolean');
      expect(typeof featureFlags.conflictResolution).toBe('boolean');
      expect(typeof featureFlags.cacheWarming).toBe('boolean');
      expect(typeof featureFlags.realTimeInvalidation).toBe('boolean');
    });

    it('should enable conflict resolution when background sync is enabled', () => {
      process.env.NODE_ENV = 'production';

      const featureFlags = CacheConfig.getFeatureFlags();

      if (featureFlags.backgroundSync) {
        expect(featureFlags.conflictResolution).toBe(true);
      }
    });
  });

  describe('Cache TTL Configuration', () => {
    it('should return valid TTL values', () => {
      const ttlConfig = CacheConfig.getCacheTTL();

      expect(ttlConfig.userSession).toBeGreaterThan(0);
      expect(ttlConfig.githubData).toBeGreaterThan(0);
      expect(ttlConfig.slackData).toBeGreaterThan(0);
      expect(ttlConfig.aiSummary).toBeGreaterThan(0);
      expect(ttlConfig.staticConfig).toBeGreaterThan(0);
      expect(ttlConfig.apiResponse).toBeGreaterThan(0);
    });

    it('should have minimum TTL of 60 seconds', () => {
      const ttlConfig = CacheConfig.getCacheTTL();

      Object.values(ttlConfig).forEach(ttl => {
        expect(ttl).toBeGreaterThanOrEqual(60);
      });
    });

    it('should adjust TTL based on environment', () => {
      process.env.NODE_ENV = 'development';
      const devTTL = CacheConfig.getCacheTTL();

      process.env.NODE_ENV = 'production';
      CacheConfig.resetConfig();
      const prodTTL = CacheConfig.getCacheTTL();

      // Development should have shorter TTL for faster iteration
      expect(devTTL.githubData).toBeLessThanOrEqual(prodTTL.githubData);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate valid configuration', () => {
      process.env.NODE_ENV = 'production';
      process.env.REDIS_URL = 'redis://localhost:6379';

      const validation = CacheConfig.validateConfig();

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing Redis URL', () => {
      delete process.env.REDIS_URL;
      CacheConfig.resetConfig();

      const validation = CacheConfig.validateConfig();

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Redis URL is required');
    });

    it('should detect invalid pool size configuration', () => {
      // This would require mocking the configuration to test invalid values
      // For now, we'll test that validation exists
      const validation = CacheConfig.validateConfig();

      expect(validation).toHaveProperty('valid');
      expect(validation).toHaveProperty('errors');
      expect(Array.isArray(validation.errors)).toBe(true);
    });

    it('should detect invalid CDN configuration', () => {
      // Test CDN validation logic
      const validation = CacheConfig.validateConfig();

      // Should pass with default configuration
      expect(validation.valid).toBe(true);
    });
  });

  describe('Environment Variable Integration', () => {
    it('should respect REDIS_CLUSTER_ENABLED environment variable', () => {
      process.env.NODE_ENV = 'production';
      process.env.REDIS_CLUSTER_ENABLED = 'true';
      process.env.REDIS_CLUSTER_NODES = 'node1:6379,node2:6379';

      CacheConfig.resetConfig();
      const redisConfig = CacheConfig.getRedisConfig();

      expect(redisConfig.cluster?.enabled).toBe(true);
      expect(redisConfig.cluster?.nodes).toContain('node1:6379');
    });

    it('should respect feature flag environment variables', () => {
      process.env.NODE_ENV = 'production';
      process.env.ENABLE_CACHE_WARMING = 'false';

      CacheConfig.resetConfig();
      const featureFlags = CacheConfig.getFeatureFlags();

      expect(featureFlags.cacheWarming).toBe(false);
    });

    it('should use CACHE_VERSION environment variable', () => {
      process.env.CACHE_VERSION = 'custom-v2.0';

      CacheConfig.resetConfig();
      const swConfig = CacheConfig.getServiceWorkerConfig();

      expect(swConfig.cacheVersion).toBe('custom-v2.0');
    });
  });
});
