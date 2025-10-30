// Cache Configuration for Different Environments
// Provides environment-specific caching settings and feature flags

export interface CacheEnvironmentConfig {
  redis: {
    url: string;
    maxRetries: number;
    retryDelay: number;
    connectionTimeout: number;
    commandTimeout: number;
    poolSize: {
      min: number;
      max: number;
    };
    cluster?: {
      enabled: boolean;
      nodes?: string[];
    };
  };
  cdn: {
    enabled: boolean;
    provider: 'vercel' | 'cloudflare' | 'aws';
    regions: string[];
    purgeApiKey?: string;
    purgeEndpoint?: string;
  };
  serviceWorker: {
    enabled: boolean;
    cacheVersion: string;
    maxCacheSize: number; // in MB
    offlinePages: string[];
  };
  monitoring: {
    enabled: boolean;
    metricsInterval: number; // in seconds
    alertThresholds: {
      hitRate: number; // minimum hit rate percentage
      responseTime: number; // maximum response time in ms
      errorRate: number; // maximum error rate percentage
    };
  };
  featureFlags: {
    intelligentPreloading: boolean;
    backgroundSync: boolean;
    conflictResolution: boolean;
    cacheWarming: boolean;
    realTimeInvalidation: boolean;
  };
}

export class CacheConfig {
  private static config: CacheEnvironmentConfig | null = null;

  /**
   * Get cache configuration for current environment
   */
  static getConfig(): CacheEnvironmentConfig {
    if (this.config) {
      return this.config;
    }

    const env =
      (process.env.NODE_ENV as
        | 'development'
        | 'production'
        | 'staging'
        | 'test') || 'development';

    switch (env) {
      case 'production':
        this.config = this.getProductionConfig();
        break;
      case 'staging':
        this.config = this.getStagingConfig();
        break;
      case 'test':
        this.config = this.getTestConfig();
        break;
      default:
        this.config = this.getDevelopmentConfig();
    }

    return this.config;
  }

  /**
   * Development environment configuration
   */
  private static getDevelopmentConfig(): CacheEnvironmentConfig {
    return {
      redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        maxRetries: 3,
        retryDelay: 1000,
        connectionTimeout: 10000,
        commandTimeout: 5000,
        poolSize: {
          min: 1,
          max: 5,
        },
        cluster: {
          enabled: false,
        },
      },
      cdn: {
        enabled: false, // Disabled in development
        provider: 'vercel',
        regions: ['iad1'],
      },
      serviceWorker: {
        enabled: true,
        cacheVersion: 'dev-v1',
        maxCacheSize: 50, // 50MB
        offlinePages: ['/dashboard', '/'],
      },
      monitoring: {
        enabled: true,
        metricsInterval: 60,
        alertThresholds: {
          hitRate: 70,
          responseTime: 2000,
          errorRate: 5,
        },
      },
      featureFlags: {
        intelligentPreloading: true,
        backgroundSync: true,
        conflictResolution: true,
        cacheWarming: false, // Disabled in dev to avoid unnecessary load
        realTimeInvalidation: true,
      },
    };
  }

  /**
   * Staging environment configuration
   */
  private static getStagingConfig(): CacheEnvironmentConfig {
    return {
      redis: {
        url: process.env.REDIS_URL || 'redis://staging-redis:6379',
        maxRetries: 5,
        retryDelay: 2000,
        connectionTimeout: 15000,
        commandTimeout: 10000,
        poolSize: {
          min: 2,
          max: 10,
        },
        cluster: {
          enabled: false,
        },
      },
      cdn: {
        enabled: true,
        provider: 'vercel',
        regions: ['iad1', 'sfo1'],
        purgeApiKey: process.env.VERCEL_PURGE_API_KEY,
        purgeEndpoint: process.env.VERCEL_PURGE_ENDPOINT,
      },
      serviceWorker: {
        enabled: true,
        cacheVersion: 'staging-v1',
        maxCacheSize: 100, // 100MB
        offlinePages: ['/dashboard', '/', '/integrations'],
      },
      monitoring: {
        enabled: true,
        metricsInterval: 30,
        alertThresholds: {
          hitRate: 80,
          responseTime: 1500,
          errorRate: 3,
        },
      },
      featureFlags: {
        intelligentPreloading: true,
        backgroundSync: true,
        conflictResolution: true,
        cacheWarming: true,
        realTimeInvalidation: true,
      },
    };
  }

  /**
   * Production environment configuration
   */
  private static getProductionConfig(): CacheEnvironmentConfig {
    return {
      redis: {
        url: process.env.REDIS_URL || 'redis://production-redis:6379',
        maxRetries: 10,
        retryDelay: 3000,
        connectionTimeout: 20000,
        commandTimeout: 15000,
        poolSize: {
          min: 5,
          max: 20,
        },
        cluster: {
          enabled: process.env.REDIS_CLUSTER_ENABLED === 'true',
          nodes: process.env.REDIS_CLUSTER_NODES?.split(','),
        },
      },
      cdn: {
        enabled: true,
        provider: 'vercel',
        regions: ['iad1', 'sfo1', 'lhr1', 'hnd1', 'syd1'],
        purgeApiKey: process.env.VERCEL_PURGE_API_KEY,
        purgeEndpoint: process.env.VERCEL_PURGE_ENDPOINT,
      },
      serviceWorker: {
        enabled: true,
        cacheVersion: process.env.CACHE_VERSION || 'prod-v1',
        maxCacheSize: 200, // 200MB
        offlinePages: [
          '/dashboard',
          '/',
          '/integrations',
          '/settings',
          '/team',
        ],
      },
      monitoring: {
        enabled: true,
        metricsInterval: 15,
        alertThresholds: {
          hitRate: 90,
          responseTime: 1000,
          errorRate: 1,
        },
      },
      featureFlags: {
        intelligentPreloading:
          process.env.ENABLE_INTELLIGENT_PRELOADING !== 'false',
        backgroundSync: process.env.ENABLE_BACKGROUND_SYNC !== 'false',
        conflictResolution: process.env.ENABLE_CONFLICT_RESOLUTION !== 'false',
        cacheWarming: process.env.ENABLE_CACHE_WARMING !== 'false',
        realTimeInvalidation:
          process.env.ENABLE_REALTIME_INVALIDATION !== 'false',
      },
    };
  }

  /**
   * Test environment configuration
   */
  private static getTestConfig(): CacheEnvironmentConfig {
    return {
      redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379/1', // Use DB 1 for tests
        maxRetries: 1,
        retryDelay: 100,
        connectionTimeout: 5000,
        commandTimeout: 2000,
        poolSize: {
          min: 1,
          max: 2,
        },
        cluster: {
          enabled: false,
        },
      },
      cdn: {
        enabled: false, // Disabled in tests
        provider: 'vercel',
        regions: ['iad1'],
      },
      serviceWorker: {
        enabled: false, // Disabled in tests
        cacheVersion: 'test-v1',
        maxCacheSize: 10, // 10MB
        offlinePages: ['/'],
      },
      monitoring: {
        enabled: false, // Disabled in tests
        metricsInterval: 300,
        alertThresholds: {
          hitRate: 50,
          responseTime: 5000,
          errorRate: 10,
        },
      },
      featureFlags: {
        intelligentPreloading: false,
        backgroundSync: false,
        conflictResolution: true,
        cacheWarming: false,
        realTimeInvalidation: false,
      },
    };
  }

  /**
   * Get Redis configuration
   */
  static getRedisConfig() {
    return this.getConfig().redis;
  }

  /**
   * Get CDN configuration
   */
  static getCDNConfig() {
    return this.getConfig().cdn;
  }

  /**
   * Get Service Worker configuration
   */
  static getServiceWorkerConfig() {
    return this.getConfig().serviceWorker;
  }

  /**
   * Get monitoring configuration
   */
  static getMonitoringConfig() {
    return this.getConfig().monitoring;
  }

  /**
   * Get feature flags
   */
  static getFeatureFlags() {
    return this.getConfig().featureFlags;
  }

  /**
   * Check if a feature is enabled
   */
  static isFeatureEnabled(
    feature: keyof CacheEnvironmentConfig['featureFlags']
  ): boolean {
    return this.getFeatureFlags()[feature];
  }

  /**
   * Get cache TTL configuration based on environment
   */
  static getCacheTTL() {
    const env = process.env.NODE_ENV || 'development';

    const baseTTL = {
      userSession: 24 * 60 * 60, // 24 hours
      githubData: 15 * 60, // 15 minutes
      slackData: 5 * 60, // 5 minutes
      aiSummary: 60 * 60, // 1 hour
      staticConfig: 24 * 60 * 60, // 24 hours
      apiResponse: 5 * 60, // 5 minutes
    };

    // Adjust TTL based on environment
    const multiplier = env === 'production' ? 0.5 : 0.25;

    return Object.fromEntries(
      Object.entries(baseTTL).map(([key, value]) => [
        key,
        Math.max(60, Math.floor(value * multiplier)), // Minimum 1 minute
      ])
    );
  }

  /**
   * Validate configuration
   */
  static validateConfig(): { valid: boolean; errors: string[] } {
    const config = this.getConfig();
    const errors: string[] = [];

    // Validate Redis configuration
    if (!config.redis.url) {
      errors.push('Redis URL is required');
    }

    if (config.redis.poolSize.min > config.redis.poolSize.max) {
      errors.push('Redis pool min size cannot be greater than max size');
    }

    // Validate CDN configuration
    if (config.cdn.enabled && !config.cdn.regions.length) {
      errors.push('CDN regions must be specified when CDN is enabled');
    }

    // Validate Service Worker configuration
    if (
      config.serviceWorker.enabled &&
      config.serviceWorker.maxCacheSize <= 0
    ) {
      errors.push('Service Worker max cache size must be positive');
    }

    // Validate monitoring configuration
    if (config.monitoring.enabled) {
      const thresholds = config.monitoring.alertThresholds;
      if (thresholds.hitRate < 0 || thresholds.hitRate > 100) {
        errors.push('Hit rate threshold must be between 0 and 100');
      }
      if (thresholds.responseTime <= 0) {
        errors.push('Response time threshold must be positive');
      }
      if (thresholds.errorRate < 0 || thresholds.errorRate > 100) {
        errors.push('Error rate threshold must be between 0 and 100');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Reset configuration (useful for testing)
   */
  static resetConfig(): void {
    this.config = null;
  }
}
