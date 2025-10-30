// Development Environment Configuration
// Optimized for local development with minimal resource usage

import { CacheEnvironmentConfig } from '../cache-config';

export const developmentConfig: CacheEnvironmentConfig = {
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
    enabled: false, // Disabled in development to avoid CDN costs
    provider: 'vercel',
    regions: ['iad1'], // Single region for development
  },
  serviceWorker: {
    enabled: true,
    cacheVersion: 'dev-v1',
    maxCacheSize: 50, // 50MB - smaller cache for development
    offlinePages: ['/dashboard', '/'],
  },
  monitoring: {
    enabled: true,
    metricsInterval: 60, // 1 minute intervals
    alertThresholds: {
      hitRate: 70, // Lower threshold for development
      responseTime: 2000, // 2 seconds
      errorRate: 5, // 5% error rate
    },
  },
  featureFlags: {
    intelligentPreloading: true,
    backgroundSync: true,
    conflictResolution: true,
    cacheWarming: false, // Disabled to avoid unnecessary load
    realTimeInvalidation: true,
  },
};

export default developmentConfig;
