// Tests for Feature Flag System
// Validates feature flag functionality and rollout controls

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { FeatureFlags } from '../feature-flags';

describe('FeatureFlags', () => {
  let originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    // Save original environment variables
    originalEnv = {
      NODE_ENV: process.env.NODE_ENV,
      ENABLE_REDIS_CACHE: process.env.ENABLE_REDIS_CACHE,
      ENABLE_CDN_INTEGRATION: process.env.ENABLE_CDN_INTEGRATION,
      ENABLE_SERVICE_WORKER_CACHE: process.env.ENABLE_SERVICE_WORKER_CACHE,
      ENABLE_INTELLIGENT_PRELOADING: process.env.ENABLE_INTELLIGENT_PRELOADING,
      ENABLE_BACKGROUND_SYNC: process.env.ENABLE_BACKGROUND_SYNC,
      ENABLE_CONFLICT_RESOLUTION: process.env.ENABLE_CONFLICT_RESOLUTION,
      ENABLE_CACHE_WARMING: process.env.ENABLE_CACHE_WARMING,
      ENABLE_REALTIME_INVALIDATION: process.env.ENABLE_REALTIME_INVALIDATION,
      ENABLE_CACHE_MONITORING: process.env.ENABLE_CACHE_MONITORING,
      ENABLE_PERFORMANCE_TRACKING: process.env.ENABLE_PERFORMANCE_TRACKING,
      ENABLE_ERROR_TRACKING: process.env.ENABLE_ERROR_TRACKING,
      ENABLE_PREDICTIVE_CACHING: process.env.ENABLE_PREDICTIVE_CACHING,
      ENABLE_ADAPTIVE_TTL: process.env.ENABLE_ADAPTIVE_TTL,
      ENABLE_COMPRESSION_OPTIMIZATION:
        process.env.ENABLE_COMPRESSION_OPTIMIZATION,
      FEATURE_ROLLOUT_PERCENTAGE: process.env.FEATURE_ROLLOUT_PERCENTAGE,
      FEATURE_USER_SEGMENTS: process.env.FEATURE_USER_SEGMENTS,
    };

    // Reset feature flags
    FeatureFlags.reset();
  });

  afterEach(() => {
    // Restore original environment variables
    Object.entries(originalEnv).forEach(([key, value]) => {
      if (value !== undefined) {
        process.env[key] = value;
      } else {
        // Use Reflect.deleteProperty instead of delete operator for dynamic keys
        Reflect.deleteProperty(process.env, key);
      }
    });

    // Reset feature flags
    FeatureFlags.reset();
  });

  describe('Feature Flag Initialization', () => {
    it('should initialize with default values for development', () => {
      (process.env as any).NODE_ENV = 'development';

      const flags = FeatureFlags.initialize();

      expect(flags.redisCache).toBe(true);
      expect(flags.cdnIntegration).toBe(false); // Disabled in development
      expect(flags.serviceWorkerCache).toBe(true);
      expect(flags.intelligentPreloading).toBe(true);
      expect(flags.backgroundSync).toBe(true);
      expect(flags.conflictResolution).toBe(true);
      expect(flags.cacheWarming).toBe(false); // Disabled in development
      expect(flags.realTimeInvalidation).toBe(true);
    });

    it('should initialize with default values for production', () => {
      (process.env as any).NODE_ENV = 'production';

      const flags = FeatureFlags.initialize();

      expect(flags.redisCache).toBe(true);
      expect(flags.cdnIntegration).toBe(true); // Enabled in production
      expect(flags.serviceWorkerCache).toBe(true);
      expect(flags.cacheWarming).toBe(true); // Enabled in production
      expect(flags.rolloutPercentage).toBe(100);
    });

    it('should initialize with default values for test environment', () => {
      (process.env as any).NODE_ENV = 'test';

      const flags = FeatureFlags.initialize();

      expect(flags.redisCache).toBe(false); // Disabled in test
      expect(flags.cdnIntegration).toBe(false);
      expect(flags.serviceWorkerCache).toBe(true);
      expect(flags.intelligentPreloading).toBe(false);
      expect(flags.backgroundSync).toBe(false);
      expect(flags.realTimeInvalidation).toBe(false);
    });

    it('should respect environment variable overrides', () => {
      (process.env as any).NODE_ENV = 'development';
      process.env.ENABLE_REDIS_CACHE = 'false';
      process.env.ENABLE_CDN_INTEGRATION = 'true';
      process.env.ENABLE_CACHE_WARMING = 'true';

      const flags = FeatureFlags.initialize();

      expect(flags.redisCache).toBe(false);
      expect(flags.cdnIntegration).toBe(true);
      expect(flags.cacheWarming).toBe(true);
    });
  });

  describe('Feature Flag Checking', () => {
    it('should check if feature is enabled', () => {
      (process.env as any).NODE_ENV = 'development';
      process.env.ENABLE_REDIS_CACHE = 'true';

      expect(FeatureFlags.isEnabled('redisCache')).toBe(true);

      process.env.ENABLE_REDIS_CACHE = 'false';
      FeatureFlags.reset();

      expect(FeatureFlags.isEnabled('redisCache')).toBe(false);
    });

    it('should handle boolean string values correctly', () => {
      process.env.ENABLE_REDIS_CACHE = '1';
      FeatureFlags.reset();
      expect(FeatureFlags.isEnabled('redisCache')).toBe(true);

      process.env.ENABLE_REDIS_CACHE = 'TRUE';
      FeatureFlags.reset();
      expect(FeatureFlags.isEnabled('redisCache')).toBe(true);

      process.env.ENABLE_REDIS_CACHE = 'false';
      FeatureFlags.reset();
      expect(FeatureFlags.isEnabled('redisCache')).toBe(false);

      process.env.ENABLE_REDIS_CACHE = '0';
      FeatureFlags.reset();
      expect(FeatureFlags.isEnabled('redisCache')).toBe(false);
    });
  });

  describe('User-based Feature Rollout', () => {
    beforeEach(() => {
      (process.env as any).NODE_ENV = 'production';
      process.env.ENABLE_REDIS_CACHE = 'true';
    });

    it('should enable feature for all users when rollout is 100%', () => {
      process.env.FEATURE_ROLLOUT_PERCENTAGE = '100';

      expect(FeatureFlags.isEnabledForUser('redisCache', 'user123')).toBe(true);
      expect(FeatureFlags.isEnabledForUser('redisCache', 'user456')).toBe(true);
    });

    it('should disable feature for all users when rollout is 0%', () => {
      process.env.FEATURE_ROLLOUT_PERCENTAGE = '0';
      FeatureFlags.reset();

      expect(FeatureFlags.isEnabledForUser('redisCache', 'user123')).toBe(
        false
      );
      expect(FeatureFlags.isEnabledForUser('redisCache', 'user456')).toBe(
        false
      );
    });

    it('should enable feature for some users when rollout is 50%', () => {
      process.env.FEATURE_ROLLOUT_PERCENTAGE = '50';
      FeatureFlags.reset();

      // Test with multiple users to ensure some are enabled and some are not
      const users = Array.from({ length: 100 }, (_, i) => `user${i}`);
      const enabledUsers = users.filter(userId =>
        FeatureFlags.isEnabledForUser('redisCache', userId)
      );

      // Should be approximately 50% (allow some variance due to hashing)
      expect(enabledUsers.length).toBeGreaterThan(30);
      expect(enabledUsers.length).toBeLessThan(70);
    });

    it('should return false when no user ID is provided for partial rollout', () => {
      process.env.FEATURE_ROLLOUT_PERCENTAGE = '50';
      FeatureFlags.reset();

      expect(FeatureFlags.isEnabledForUser('redisCache')).toBe(false);
    });

    it('should respect user segments', () => {
      process.env.FEATURE_USER_SEGMENTS = 'beta,premium';
      FeatureFlags.reset();

      expect(
        FeatureFlags.isEnabledForUser('redisCache', 'user123', 'beta')
      ).toBe(true);
      expect(
        FeatureFlags.isEnabledForUser('redisCache', 'user123', 'premium')
      ).toBe(true);
      expect(
        FeatureFlags.isEnabledForUser('redisCache', 'user123', 'standard')
      ).toBe(false);
    });

    it('should return false for disabled features regardless of user', () => {
      process.env.ENABLE_REDIS_CACHE = 'false';
      process.env.FEATURE_ROLLOUT_PERCENTAGE = '100';
      FeatureFlags.reset();

      expect(FeatureFlags.isEnabledForUser('redisCache', 'user123')).toBe(
        false
      );
    });
  });

  describe('Feature Flag Management', () => {
    it('should get all enabled features', () => {
      (process.env as any).NODE_ENV = 'production';
      process.env.ENABLE_REDIS_CACHE = 'true';
      process.env.ENABLE_CDN_INTEGRATION = 'true';
      process.env.ENABLE_SERVICE_WORKER_CACHE = 'false';

      const enabledFeatures = FeatureFlags.getEnabledFeatures();

      expect(enabledFeatures).toContain('redisCache');
      expect(enabledFeatures).toContain('cdnIntegration');
      expect(enabledFeatures).not.toContain('serviceWorkerCache');
    });

    it('should get client-safe configuration', () => {
      (process.env as any).NODE_ENV = 'production';

      const clientConfig = FeatureFlags.getClientConfig();

      // Should only include client-safe flags
      expect(clientConfig).toHaveProperty('serviceWorkerCache');
      expect(clientConfig).toHaveProperty('intelligentPreloading');
      expect(clientConfig).toHaveProperty('backgroundSync');
      expect(clientConfig).toHaveProperty('conflictResolution');
      expect(clientConfig).toHaveProperty('performanceTracking');

      // Should not include server-only flags
      expect(clientConfig).not.toHaveProperty('redisCache');
      expect(clientConfig).not.toHaveProperty('cdnIntegration');
    });

    it('should update feature flags at runtime', () => {
      (process.env as any).NODE_ENV = 'development';

      expect(FeatureFlags.isEnabled('redisCache')).toBe(true);

      FeatureFlags.updateFlag('redisCache', false);

      expect(FeatureFlags.isEnabled('redisCache')).toBe(false);
    });

    it('should get feature flag status', () => {
      (process.env as any).NODE_ENV = 'production';
      process.env.FEATURE_ROLLOUT_PERCENTAGE = '75';
      process.env.FEATURE_USER_SEGMENTS = 'beta,premium';

      const status = FeatureFlags.getStatus();

      expect(status.environment).toBe('production');
      expect(status.rolloutPercentage).toBe(75);
      expect(status.userSegments).toContain('beta');
      expect(status.userSegments).toContain('premium');
      expect(status.enabledFeatures).toBeInstanceOf(Array);
      expect(status.lastUpdated).toBeDefined();
    });
  });

  describe('Feature Flag Validation', () => {
    it('should validate valid configuration', () => {
      (process.env as any).NODE_ENV = 'production';
      process.env.FEATURE_ROLLOUT_PERCENTAGE = '100';
      process.env.ENABLE_REDIS_CACHE = 'true';
      process.env.ENABLE_CACHE_WARMING = 'true';
      process.env.ENABLE_REALTIME_INVALIDATION = 'true';
      process.env.ENABLE_SERVICE_WORKER_CACHE = 'true';
      process.env.ENABLE_BACKGROUND_SYNC = 'true';
      process.env.ENABLE_CONFLICT_RESOLUTION = 'true';

      const validation = FeatureFlags.validate();

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect invalid rollout percentage', () => {
      process.env.FEATURE_ROLLOUT_PERCENTAGE = '150';
      FeatureFlags.reset();

      const validation = FeatureFlags.validate();

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain(
        'Rollout percentage must be between 0 and 100'
      );
    });

    it('should detect dependency violations', () => {
      process.env.ENABLE_REDIS_CACHE = 'false';
      process.env.ENABLE_CACHE_WARMING = 'true';
      FeatureFlags.reset();

      const validation = FeatureFlags.validate();

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain(
        'Cache warming requires Redis cache to be enabled'
      );
    });

    it('should detect service worker dependency violations', () => {
      process.env.ENABLE_SERVICE_WORKER_CACHE = 'false';
      process.env.ENABLE_BACKGROUND_SYNC = 'true';
      FeatureFlags.reset();

      const validation = FeatureFlags.validate();

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain(
        'Background sync requires service worker cache to be enabled'
      );
    });

    it('should detect conflict resolution dependency', () => {
      process.env.ENABLE_BACKGROUND_SYNC = 'false';
      process.env.ENABLE_CONFLICT_RESOLUTION = 'true';
      FeatureFlags.reset();

      const validation = FeatureFlags.validate();

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain(
        'Conflict resolution requires background sync to be enabled'
      );
    });
  });

  describe('Environment Variable Parsing', () => {
    it('should parse rollout percentage correctly', () => {
      process.env.FEATURE_ROLLOUT_PERCENTAGE = '75';
      FeatureFlags.reset();

      const flags = FeatureFlags.initialize();

      expect(flags.rolloutPercentage).toBe(75);
    });

    it('should handle invalid rollout percentage', () => {
      process.env.FEATURE_ROLLOUT_PERCENTAGE = 'invalid';
      FeatureFlags.reset();

      const flags = FeatureFlags.initialize();

      expect(flags.rolloutPercentage).toBe(100); // Default value
    });

    it('should parse user segments correctly', () => {
      process.env.FEATURE_USER_SEGMENTS = 'beta,premium,enterprise';
      FeatureFlags.reset();

      const flags = FeatureFlags.initialize();

      expect(flags.userSegments).toContain('beta');
      expect(flags.userSegments).toContain('premium');
      expect(flags.userSegments).toContain('enterprise');
      expect(flags.userSegments).toHaveLength(3);
    });

    it('should handle empty user segments', () => {
      process.env.FEATURE_USER_SEGMENTS = '';
      FeatureFlags.reset();

      const flags = FeatureFlags.initialize();

      expect(flags.userSegments).toHaveLength(0);
    });

    it('should trim whitespace from user segments', () => {
      process.env.FEATURE_USER_SEGMENTS = ' beta , premium , enterprise ';
      FeatureFlags.reset();

      const flags = FeatureFlags.initialize();

      expect(flags.userSegments).toContain('beta');
      expect(flags.userSegments).toContain('premium');
      expect(flags.userSegments).toContain('enterprise');
      expect(flags.userSegments).not.toContain(' beta ');
    });
  });
});
