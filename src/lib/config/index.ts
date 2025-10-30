// Configuration Index
// Central export for all cache and environment configurations

export { CacheConfig } from './cache-config';
export { FeatureFlags } from './feature-flags';

export type { CacheEnvironmentConfig } from './cache-config';
export type { FeatureFlagConfig } from './feature-flags';

// Environment-specific configurations
export { default as developmentConfig } from './environments/development';
export { default as stagingConfig } from './environments/staging';
export { default as productionConfig } from './environments/production';
export { default as testConfig } from './environments/test';

// Configuration utilities
export function getCurrentEnvironment(): string {
  return process.env.NODE_ENV || 'development';
}

export function isProduction(): boolean {
  return getCurrentEnvironment() === 'production';
}

export function isDevelopment(): boolean {
  return getCurrentEnvironment() === 'development';
}

export function isTest(): boolean {
  return getCurrentEnvironment() === 'test';
}

export function isStaging(): boolean {
  return getCurrentEnvironment() === 'staging';
}
