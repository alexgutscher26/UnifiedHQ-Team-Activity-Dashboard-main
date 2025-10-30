// Staging Environment Configuration
// Production-like settings with reduced scale for testing

import { CacheEnvironmentConfig } from '../cache-config';

export const stagingConfig: CacheEnvironmentConfig = {
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
      enabled: false, // Single instance for staging
    },
  },
  cdn: {
    enabled: true,
    provider: 'vercel',
    regions: ['iad1', 'sfo1'], // Two regions for staging
    purgeApiKey: process.env.VERCEL_PURGE_API_KEY,
    purgeEndpoint: process.env.VERCEL_PURGE_ENDPOINT,
  },
  serviceWorker: {
    enabled: true,
    cacheVersion: process.env.CACHE_VERSION || 'staging-v1',
    maxCacheSize: 100, // 100MB
    offlinePages: ['/dashboard', '/', '/integrations', '/settings'],
  },
  monitoring: {
    enabled: true,
    metricsInterval: 30, // 30 second intervals
    alertThresholds: {
      hitRate: 80, // Higher threshold for staging
      responseTime: 1500, // 1.5 seconds
      errorRate: 3, // 3% error rate
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

export default stagingConfig;
