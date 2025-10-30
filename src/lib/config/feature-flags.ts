// Feature Flag System for Gradual Rollout
// Manages feature toggles for caching and offline functionality

export interface FeatureFlagConfig {
  // Core caching features
  redisCache: boolean;
  cdnIntegration: boolean;
  serviceWorkerCache: boolean;

  // Advanced caching features
  intelligentPreloading: boolean;
  backgroundSync: boolean;
  conflictResolution: boolean;
  cacheWarming: boolean;
  realTimeInvalidation: boolean;

  // Monitoring and analytics
  cacheMonitoring: boolean;
  performanceTracking: boolean;
  errorTracking: boolean;

  // Experimental features
  predictiveCaching: boolean;
  adaptiveTTL: boolean;
  compressionOptimization: boolean;

  // Rollout controls
  rolloutPercentage: number;
  userSegments: string[];
}

export class FeatureFlags {
  private static flags: FeatureFlagConfig | null = null;

  /**
   * Initialize feature flags from environment variables
   */
  static initialize(): FeatureFlagConfig {
    if (this.flags) {
      return this.flags;
    }

    const env = process.env.NODE_ENV || 'development';

    this.flags = {
      // Core features - enabled by default in production
      redisCache: this.getEnvFlag('ENABLE_REDIS_CACHE', env !== 'test'),
      cdnIntegration: this.getEnvFlag(
        'ENABLE_CDN_INTEGRATION',
        env === 'production'
      ),
      serviceWorkerCache: this.getEnvFlag('ENABLE_SERVICE_WORKER_CACHE', true),

      // Advanced features - gradual rollout
      intelligentPreloading: this.getEnvFlag(
        'ENABLE_INTELLIGENT_PRELOADING',
        env !== 'test'
      ),
      backgroundSync: this.getEnvFlag('ENABLE_BACKGROUND_SYNC', env !== 'test'),
      conflictResolution: this.getEnvFlag('ENABLE_CONFLICT_RESOLUTION', true),
      cacheWarming: this.getEnvFlag(
        'ENABLE_CACHE_WARMING',
        env === 'production'
      ),
      realTimeInvalidation: this.getEnvFlag(
        'ENABLE_REALTIME_INVALIDATION',
        env !== 'test'
      ),

      // Monitoring features
      cacheMonitoring: this.getEnvFlag(
        'ENABLE_CACHE_MONITORING',
        env !== 'test'
      ),
      performanceTracking: this.getEnvFlag(
        'ENABLE_PERFORMANCE_TRACKING',
        env !== 'test'
      ),
      errorTracking: this.getEnvFlag('ENABLE_ERROR_TRACKING', env !== 'test'),

      // Experimental features - disabled by default
      predictiveCaching: this.getEnvFlag('ENABLE_PREDICTIVE_CACHING', false),
      adaptiveTTL: this.getEnvFlag('ENABLE_ADAPTIVE_TTL', false),
      compressionOptimization: this.getEnvFlag(
        'ENABLE_COMPRESSION_OPTIMIZATION',
        false
      ),

      // Rollout controls
      rolloutPercentage: this.getEnvNumber('FEATURE_ROLLOUT_PERCENTAGE', 100),
      userSegments: this.getEnvArray('FEATURE_USER_SEGMENTS', []),
    };

    return this.flags;
  }

  /**
   * Get boolean flag from environment variable
   */
  private static getEnvFlag(key: string, defaultValue: boolean): boolean {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    return value.toLowerCase() === 'true' || value === '1';
  }

  /**
   * Get number from environment variable
   */
  private static getEnvNumber(key: string, defaultValue: number): number {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  /**
   * Get array from environment variable (comma-separated)
   */
  private static getEnvArray(key: string, defaultValue: string[]): string[] {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    return value
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  }

  /**
   * Check if a feature is enabled
   */
  static isEnabled(feature: keyof FeatureFlagConfig): boolean {
    const flags = this.initialize();
    return flags[feature] as boolean;
  }

  /**
   * Check if a feature is enabled for a specific user
   */
  static isEnabledForUser(
    feature: keyof FeatureFlagConfig,
    userId?: string,
    userSegment?: string
  ): boolean {
    const flags = this.initialize();

    // Check base feature flag
    if (!flags[feature]) {
      return false;
    }

    // Check rollout percentage
    if (flags.rolloutPercentage < 100) {
      if (!userId) return false;

      // Use user ID hash to determine if user is in rollout
      const hash = this.hashUserId(userId);
      const userPercentile = hash % 100;
      if (userPercentile >= flags.rolloutPercentage) {
        return false;
      }
    }

    // Check user segments
    if (flags.userSegments.length > 0 && userSegment) {
      return flags.userSegments.includes(userSegment);
    }

    return true;
  }

  /**
   * Simple hash function for user ID
   */
  private static hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Get all enabled features
   */
  static getEnabledFeatures(): string[] {
    const flags = this.initialize();
    return Object.entries(flags)
      .filter(([_, enabled]) => enabled === true)
      .map(([feature, _]) => feature);
  }

  /**
   * Get feature flag configuration for client-side
   */
  static getClientConfig(): Partial<FeatureFlagConfig> {
    const flags = this.initialize();

    // Only expose client-safe flags
    return {
      serviceWorkerCache: flags.serviceWorkerCache,
      intelligentPreloading: flags.intelligentPreloading,
      backgroundSync: flags.backgroundSync,
      conflictResolution: flags.conflictResolution,
      performanceTracking: flags.performanceTracking,
    };
  }

  /**
   * Update feature flag at runtime (for testing/admin)
   */
  static updateFlag(feature: keyof FeatureFlagConfig, enabled: boolean): void {
    if (!this.flags) {
      this.initialize();
    }

    if (this.flags) {
      (this.flags[feature] as boolean) = enabled;
    }
  }

  /**
   * Reset all flags (useful for testing)
   */
  static reset(): void {
    this.flags = null;
  }

  /**
   * Validate feature flag configuration
   */
  static validate(): { valid: boolean; errors: string[] } {
    const flags = this.initialize();
    const errors: string[] = [];

    // Validate rollout percentage
    if (flags.rolloutPercentage < 0 || flags.rolloutPercentage > 100) {
      errors.push('Rollout percentage must be between 0 and 100');
    }

    // Validate dependencies
    if (flags.cacheWarming && !flags.redisCache) {
      errors.push('Cache warming requires Redis cache to be enabled');
    }

    if (flags.realTimeInvalidation && !flags.redisCache) {
      errors.push('Real-time invalidation requires Redis cache to be enabled');
    }

    if (flags.intelligentPreloading && !flags.serviceWorkerCache) {
      errors.push(
        'Intelligent preloading requires service worker cache to be enabled'
      );
    }

    if (flags.backgroundSync && !flags.serviceWorkerCache) {
      errors.push(
        'Background sync requires service worker cache to be enabled'
      );
    }

    if (flags.conflictResolution && !flags.backgroundSync) {
      errors.push('Conflict resolution requires background sync to be enabled');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get feature flag status for monitoring
   */
  static getStatus(): {
    environment: string;
    enabledFeatures: string[];
    rolloutPercentage: number;
    userSegments: string[];
    lastUpdated: string;
  } {
    const flags = this.initialize();

    return {
      environment: process.env.NODE_ENV || 'development',
      enabledFeatures: this.getEnabledFeatures(),
      rolloutPercentage: flags.rolloutPercentage,
      userSegments: flags.userSegments,
      lastUpdated: new Date().toISOString(),
    };
  }
}

// Middleware for feature flag checking
export function withFeatureFlag(feature: keyof FeatureFlagConfig) {
  return function <T extends (...args: any[]) => any>(
    target: any,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<T>
  ) {
    const method = descriptor.value!;

    descriptor.value = ((...args: any[]) => {
      if (!FeatureFlags.isEnabled(feature)) {
        console.warn(
          `Feature ${feature} is disabled, skipping ${propertyName}`
        );
        return;
      }

      return method.apply(target, args);
    }) as T;
  };
}
