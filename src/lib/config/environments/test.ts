// Test Environment Configuration
// Minimal configuration for testing with fast execution

import { CacheEnvironmentConfig } from '../cache-config';

export const testConfig: CacheEnvironmentConfig = {
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379/1', // Use DB 1 for tests
    maxRetries: 1,
    retryDelay: 100,
    connectionTimeout: 5000,
    commandTimeout: 2000,
    poolSize: {
      min: 1,
      max: 2, // Minimal pool for tests
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
    enabled: false, // Disabled in tests to avoid complexity
    cacheVersion: 'test-v1',
    maxCacheSize: 10, // 10MB
    offlinePages: ['/'],
  },
  monitoring: {
    enabled: false, // Disabled in tests
    metricsInterval: 300, // 5 minutes (not used)
    alertThresholds: {
      hitRate: 50, // Relaxed thresholds for tests
      responseTime: 5000, // 5 seconds
      errorRate: 10, // 10% error rate
    },
  },
  featureFlags: {
    intelligentPreloading: false,
    backgroundSync: false,
    conflictResolution: true, // Keep enabled for testing conflict logic
    cacheWarming: false,
    realTimeInvalidation: false,
  },
};

export default testConfig;
