// Production Environment Configuration
// Optimized for high performance and reliability

import { CacheEnvironmentConfig } from '../cache-config';

export const productionConfig: CacheEnvironmentConfig = {
  redis: {
    url: process.env.REDIS_URL || 'redis://production-redis:6379',
    maxRetries: 10,
    retryDelay: 3000,
    connectionTimeout: 20000,
    commandTimeout: 15000,
    poolSize: {
      min: 5,
      max: 20, // Higher pool size for production load
    },
    cluster: {
      enabled: process.env.REDIS_CLUSTER_ENABLED === 'true',
      nodes: process.env.REDIS_CLUSTER_NODES?.split(','),
    },
  },
  cdn: {
    enabled: true,
    provider: 'vercel',
    regions: ['iad1', 'sfo1', 'lhr1', 'hnd1', 'syd1'], // Global distribution
    purgeApiKey: process.env.VERCEL_PURGE_API_KEY,
    purgeEndpoint: process.env.VERCEL_PURGE_ENDPOINT,
  },
  serviceWorker: {
    enabled: true,
    cacheVersion: process.env.CACHE_VERSION || 'prod-v1',
    maxCacheSize: 200, // 200MB for production
    offlinePages: [
      '/dashboard',
      '/',
      '/integrations',
      '/settings',
      '/team',
      '/analytics',
    ],
  },
  monitoring: {
    enabled: true,
    metricsInterval: 15, // 15 second intervals for real-time monitoring
    alertThresholds: {
      hitRate: 90, // High threshold for production
      responseTime: 1000, // 1 second
      errorRate: 1, // 1% error rate
    },
  },
  featureFlags: {
    intelligentPreloading:
      process.env.ENABLE_INTELLIGENT_PRELOADING !== 'false',
    backgroundSync: process.env.ENABLE_BACKGROUND_SYNC !== 'false',
    conflictResolution: process.env.ENABLE_CONFLICT_RESOLUTION !== 'false',
    cacheWarming: process.env.ENABLE_CACHE_WARMING !== 'false',
    realTimeInvalidation: process.env.ENABLE_REALTIME_INVALIDATION !== 'false',
  },
};

export default productionConfig;
