import { createClient, RedisClientType } from 'redis';

const globalForRedis = globalThis as unknown as {
  redis: RedisClientType | undefined;
};

// Redis client configuration with connection pooling and retry logic
const redisConfig = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    connectTimeout: 10000,
    lazyConnect: true,
    reconnectStrategy: (retries: number) => {
      if (retries > 10) {
        console.error('Redis connection failed after 10 retries');
        return false;
      }
      return Math.min(retries * 100, 3000);
    },
  },
  // Connection pooling configuration
  isolationPoolOptions: {
    min: 2,
    max: 10,
  },
};

export const redis: RedisClientType =
  globalForRedis.redis ?? createClient(redisConfig);

// Initialize connection only when not in test or build environment
if (
  typeof window === 'undefined' &&
  process.env.NODE_ENV !== 'test' &&
  process.env.NEXT_PHASE !== 'phase-production-build'
) {
  if (process.env.NODE_ENV !== 'production') {
    // Only attempt connection in development runtime
    if (!redis.isOpen && !redis.isReady) {
      redis.connect().catch(error => {
        console.error('Redis connection failed:', error);
      });
    }
  } else {
    // In production, attempt connection but don't block
    redis.connect().catch(error => {
      console.error('Redis connection failed:', error);
    });
  }
}

// Error handling
redis.on('error', error => {
  console.error('Redis client error:', error);
});

redis.on('connect', () => {
  console.log('Redis client connected');
});

redis.on('ready', () => {
  console.log('Redis client ready');
});

redis.on('end', () => {
  console.log('Redis client connection ended');
});

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}

// Cache key generation utilities
export class CacheKeyGenerator {
  private static readonly NAMESPACE = 'unifiedhq';
  private static readonly SEPARATOR = ':';

  /**
   * Generate a consistent cache key with namespace and type
   */
  static generate(
    type: string,
    identifier: string,
    ...subKeys: string[]
  ): string {
    const parts = [
      this.NAMESPACE,
      type,
      identifier,
      ...subKeys.filter(Boolean),
    ];
    return parts.join(this.SEPARATOR);
  }

  /**
   * Generate cache key for user-specific data
   */
  static user(userId: string, dataType: string, ...subKeys: string[]): string {
    return this.generate('user', userId, dataType, ...subKeys);
  }

  /**
   * Generate cache key for GitHub integration data
   */
  static github(
    identifier: string,
    dataType: string,
    ...subKeys: string[]
  ): string {
    return this.generate('github', identifier, dataType, ...subKeys);
  }

  /**
   * Generate cache key for Slack integration data
   */
  static slack(
    identifier: string,
    dataType: string,
    ...subKeys: string[]
  ): string {
    return this.generate('slack', identifier, dataType, ...subKeys);
  }

  /**
   * Generate cache key for AI summary data
   */
  static aiSummary(
    identifier: string,
    dataType: string,
    ...subKeys: string[]
  ): string {
    return this.generate('ai', identifier, dataType, ...subKeys);
  }

  /**
   * Generate cache key for API responses
   */
  static api(endpoint: string, ...params: string[]): string {
    return this.generate('api', endpoint, ...params);
  }

  /**
   * Generate cache key for session data
   */
  static session(sessionId: string, ...subKeys: string[]): string {
    return this.generate('session', sessionId, ...subKeys);
  }
}

// TTL management system for different data types
export class TTLManager {
  // TTL values in seconds
  static readonly TTL = {
    // User sessions - 24 hours
    USER_SESSION: 24 * 60 * 60,

    // GitHub data - 15 minutes with background refresh
    GITHUB_REPOS: 15 * 60,
    GITHUB_COMMITS: 15 * 60,
    GITHUB_ISSUES: 10 * 60,
    GITHUB_PRS: 10 * 60,

    // Slack data - 5 minutes for real-time feel
    SLACK_MESSAGES: 5 * 60,
    SLACK_CHANNELS: 30 * 60,
    SLACK_USERS: 60 * 60,

    // AI summaries - 1 hour with manual invalidation
    AI_SUMMARY: 60 * 60,
    AI_INSIGHTS: 60 * 60,

    // Static configuration - 24 hours
    CONFIG: 24 * 60 * 60,

    // API responses - variable based on endpoint
    API_FAST: 5 * 60, // 5 minutes for frequently changing data
    API_MEDIUM: 30 * 60, // 30 minutes for moderately changing data
    API_SLOW: 2 * 60 * 60, // 2 hours for slowly changing data

    // Short-term cache for rate limiting
    RATE_LIMIT: 15 * 60,
  } as const;

  /**
   * Get TTL for a specific data type
   */
  static getTTL(dataType: keyof typeof TTLManager.TTL): number {
    return this.TTL[dataType];
  }

  /**
   * Get TTL based on cache strategy
   */
  static getStrategyTTL(strategy: 'fast' | 'medium' | 'slow'): number {
    switch (strategy) {
      case 'fast':
        return this.TTL.API_FAST;
      case 'medium':
        return this.TTL.API_MEDIUM;
      case 'slow':
        return this.TTL.API_SLOW;
      default:
        return this.TTL.API_MEDIUM;
    }
  }
}

// Redis cache service with CRUD operations
export class RedisCache {
  /**
   * Check if Redis is available
   */
  private static isRedisAvailable(): boolean {
    try {
      // Skip Redis during build phase
      if (process.env.NEXT_PHASE === 'phase-production-build') {
        return false;
      }
      return redis.isOpen || redis.isReady;
    } catch {
      return false;
    }
  }

  /**
   * Get Redis client instance
   * Returns a Promise that resolves to the Redis client or null if unavailable
   */
  static async getClient(): Promise<RedisClientType | null> {
    try {
      // Skip Redis during build phase
      if (process.env.NEXT_PHASE === 'phase-production-build') {
        return null;
      }

      // If Redis is not connected, try to connect
      if (!redis.isOpen && !redis.isReady) {
        await redis.connect();
      }

      // Return the client if it's ready
      if (redis.isReady || redis.isOpen) {
        return redis;
      }

      return null;
    } catch (error) {
      console.error('Error getting Redis client:', error);
      return null;
    }
  }

  /**
   * Set a value in cache with TTL
   */
  static async set(key: string, value: any, ttl?: number): Promise<boolean> {
    try {
      if (!this.isRedisAvailable()) {
        console.warn('Redis not available, skipping cache set');
        return false;
      }

      const serializedValue = JSON.stringify(value);

      if (ttl) {
        await redis.setEx(key, ttl, serializedValue);
      } else {
        await redis.set(key, serializedValue);
      }

      return true;
    } catch (error) {
      console.error('Redis set error:', error);
      return false;
    }
  }

  /**
   * Get a value from cache
   */
  static async get<T = any>(key: string): Promise<T | null> {
    try {
      if (!this.isRedisAvailable()) {
        console.warn('Redis not available, returning null for cache get');
        return null;
      }

      const value = await redis.get(key);

      if (value === null) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  /**
   * Delete a key from cache
   */
  static async del(key: string): Promise<boolean> {
    try {
      if (!this.isRedisAvailable()) {
        console.warn('Redis not available, skipping cache delete');
        return false;
      }

      const result = await redis.del(key);
      return result > 0;
    } catch (error) {
      console.error('Redis delete error:', error);
      return false;
    }
  }

  /**
   * Check if a key exists
   */
  static async exists(key: string): Promise<boolean> {
    try {
      if (!this.isRedisAvailable()) {
        console.warn('Redis not available, returning false for exists check');
        return false;
      }

      const result = await redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Redis exists error:', error);
      return false;
    }
  }

  /**
   * Get TTL for a key
   */
  static async ttl(key: string): Promise<number> {
    try {
      if (!this.isRedisAvailable()) {
        console.warn('Redis not available, returning -1 for TTL');
        return -1;
      }

      return await redis.ttl(key);
    } catch (error) {
      console.error('Redis TTL error:', error);
      return -1;
    }
  }

  /**
   * Set TTL for an existing key
   */
  static async expire(key: string, ttl: number): Promise<boolean> {
    try {
      if (!this.isRedisAvailable()) {
        console.warn('Redis not available, skipping expire');
        return false;
      }

      const result = await redis.expire(key, ttl);
      return result === 1;
    } catch (error) {
      console.error('Redis expire error:', error);
      return false;
    }
  }

  /**
   * Delete keys by pattern
   */
  static async deleteByPattern(pattern: string): Promise<number> {
    try {
      if (!this.isRedisAvailable()) {
        console.warn('Redis not available, skipping pattern delete');
        return 0;
      }

      const keys = await redis.keys(pattern);

      if (keys.length === 0) {
        return 0;
      }

      return await redis.del(keys);
    } catch (error) {
      console.error('Redis delete by pattern error:', error);
      return 0;
    }
  }

  /**
   * Get keys by pattern
   */
  static async getKeysByPattern(pattern: string): Promise<string[]> {
    try {
      if (!this.isRedisAvailable()) {
        console.warn(
          'Redis not available, returning empty array for keys pattern'
        );
        return [];
      }

      return await redis.keys(pattern);
    } catch (error) {
      console.error('Redis keys by pattern error:', error);
      return [];
    }
  }

  /**
   * Invalidate cache by tags (using key patterns)
   */
  static async invalidateByTag(tag: string): Promise<number> {
    const pattern = `*:${tag}:*`;
    return this.deleteByPattern(pattern);
  }

  /**
   * Add member to sorted set with score
   */
  static async zadd(key: string, score: number, member: string): Promise<number> {
    try {
      if (!this.isRedisAvailable()) {
        console.warn('Redis not available, skipping zadd');
        return 0;
      }

      return await redis.zAdd(key, { score, value: member });
    } catch (error) {
      console.error('Redis zadd error:', error);
      return 0;
    }
  }

  /**
   * Get members from sorted set by score range
   */
  static async zrangebyscore(key: string, min: number, max: number): Promise<string[]> {
    try {
      if (!this.isRedisAvailable()) {
        console.warn('Redis not available, returning empty array for zrangebyscore');
        return [];
      }

      return await redis.zRangeByScore(key, min, max);
    } catch (error) {
      console.error('Redis zrangebyscore error:', error);
      return [];
    }
  }

  /**
   * Remove members from sorted set by score range
   */
  static async zremrangebyscore(key: string, min: number, max: number): Promise<number> {
    try {
      if (!this.isRedisAvailable()) {
        console.warn('Redis not available, skipping zremrangebyscore');
        return 0;
      }

      return await redis.zRemRangeByScore(key, min, max);
    } catch (error) {
      console.error('Redis zremrangebyscore error:', error);
      return 0;
    }
  }

  /**
   * Get count of members in sorted set by score range
   */
  static async zcount(key: string, min: number, max: number): Promise<number> {
    try {
      if (!this.isRedisAvailable()) {
        console.warn('Redis not available, returning 0 for zcount');
        return 0;
      }

      return await redis.zCount(key, min, max);
    } catch (error) {
      console.error('Redis zcount error:', error);
      return 0;
    }
  }
}
