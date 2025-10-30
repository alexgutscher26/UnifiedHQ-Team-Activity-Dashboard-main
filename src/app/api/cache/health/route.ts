import { NextRequest, NextResponse } from 'next/server';
import { redis, RedisCache } from '@/lib/redis';
import { CacheInvalidationTriggers } from '@/lib/cache-invalidation-triggers';

/**
 * Cache health check endpoint
 * Provides comprehensive health information about the caching system
 */

export async function GET(request: NextRequest) {
  try {
    const startTime = Date.now();

    // Check Redis connection
    const redisHealth = await checkRedisHealth();

    // Get cache statistics
    const cacheStats = await getCacheStatistics();

    // Get invalidation trigger status
    const triggerStatus = getInvalidationTriggerStatus();

    // Performance metrics
    const responseTime = Date.now() - startTime;

    const healthStatus = {
      status: redisHealth.connected ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      response_time_ms: responseTime,
      redis: redisHealth,
      cache_statistics: cacheStats,
      invalidation_triggers: triggerStatus,
      version: '1.0.0',
    };

    const httpStatus = redisHealth.connected ? 200 : 503;

    return NextResponse.json(healthStatus, { status: httpStatus });
  } catch (error) {
    console.error('Cache health check failed:', error);

    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Check Redis connection and basic operations
 */
async function checkRedisHealth() {
  try {
    const testKey = 'unifiedhq:health:test';
    const testValue = { timestamp: Date.now(), test: true };

    // Test basic operations
    const setResult = await RedisCache.set(testKey, testValue, 60); // 1 minute TTL
    const getValue = await RedisCache.get(testKey);
    const existsResult = await RedisCache.exists(testKey);
    const ttlResult = await RedisCache.ttl(testKey);
    const deleteResult = await RedisCache.del(testKey);

    // Get Redis info
    const redisInfo = await redis.info('server');
    const redisMemory = await redis.info('memory');

    return {
      connected: true,
      operations: {
        set: setResult,
        get: getValue !== null,
        exists: existsResult,
        ttl: ttlResult > 0,
        delete: deleteResult,
      },
      server_info: parseRedisInfo(redisInfo),
      memory_info: parseRedisInfo(redisMemory),
    };
  } catch (error) {
    console.error('Redis health check failed:', error);

    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown Redis error',
      operations: {
        set: false,
        get: false,
        exists: false,
        ttl: false,
        delete: false,
      },
    };
  }
}

/**
 * Get cache statistics
 */
async function getCacheStatistics() {
  try {
    // Get all keys in our namespace
    const allKeys = await redis.keys('unifiedhq:*');

    // Categorize keys by type
    const keysByType: Record<string, number> = {};
    const keysByTTL: Record<string, number> = {
      no_expiry: 0,
      expires_soon: 0, // < 5 minutes
      expires_later: 0, // >= 5 minutes
    };

    for (const key of allKeys.slice(0, 1000)) {
      // Limit to 1000 keys for performance
      // Extract type from key pattern
      const keyParts = key.split(':');
      if (keyParts.length >= 3) {
        const type = keyParts[1]; // unifiedhq:type:...
        keysByType[type] = (keysByType[type] || 0) + 1;
      }

      // Check TTL
      try {
        const ttl = await RedisCache.ttl(key);
        if (ttl === -1) {
          keysByTTL.no_expiry++;
        } else if (ttl > 0 && ttl < 300) {
          // Less than 5 minutes
          keysByTTL.expires_soon++;
        } else if (ttl >= 300) {
          keysByTTL.expires_later++;
        }
      } catch (error) {
        // Skip TTL check for this key
      }
    }

    return {
      total_keys: allKeys.length,
      keys_by_type: keysByType,
      keys_by_ttl: keysByTTL,
      sample_size: Math.min(allKeys.length, 1000),
    };
  } catch (error) {
    console.error('Failed to get cache statistics:', error);

    return {
      total_keys: 0,
      keys_by_type: {},
      keys_by_ttl: {},
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get invalidation trigger status
 */
function getInvalidationTriggerStatus() {
  try {
    const allTriggers = CacheInvalidationTriggers.getAllTriggers();
    const enabledTriggers = CacheInvalidationTriggers.getEnabledTriggers();

    const triggersByType: Record<string, number> = {};

    allTriggers.forEach(trigger => {
      const eventType = trigger.conditions.eventType;
      triggersByType[eventType] = (triggersByType[eventType] || 0) + 1;
    });

    return {
      total_triggers: allTriggers.length,
      enabled_triggers: enabledTriggers.length,
      disabled_triggers: allTriggers.length - enabledTriggers.length,
      triggers_by_event_type: triggersByType,
      trigger_details: allTriggers.map(trigger => ({
        id: trigger.id,
        name: trigger.name,
        enabled: trigger.enabled,
        event_type: trigger.conditions.eventType,
        data_type: trigger.conditions.dataType,
      })),
    };
  } catch (error) {
    console.error('Failed to get invalidation trigger status:', error);

    return {
      total_triggers: 0,
      enabled_triggers: 0,
      disabled_triggers: 0,
      triggers_by_event_type: {},
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Parse Redis INFO command output
 */
function parseRedisInfo(infoString: string): Record<string, string> {
  const info: Record<string, string> = {};

  const lines = infoString.split('\r\n');

  for (const line of lines) {
    if (line && !line.startsWith('#') && line.includes(':')) {
      const [key, value] = line.split(':');
      if (key && value !== undefined) {
        info[key] = value;
      }
    }
  }

  return info;
}

/**
 * POST endpoint for triggering health checks or maintenance operations
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'cleanup_expired':
        // todo: This would typically be handled by Redis automatically,
        // but we can provide a manual trigger for cleanup operations
        const expiredKeys = await findExpiredKeys();

        return NextResponse.json({
          action: 'cleanup_expired',
          expired_keys_found: expiredKeys.length,
          message:
            'Expired keys identified (Redis handles cleanup automatically)',
        });

      case 'validate_triggers':
        // Validate all invalidation triggers
        const triggers = CacheInvalidationTriggers.getAllTriggers();
        const validationResults = triggers.map(trigger => ({
          id: trigger.id,
          name: trigger.name,
          valid: validateTrigger(trigger),
        }));

        return NextResponse.json({
          action: 'validate_triggers',
          total_triggers: triggers.length,
          validation_results: validationResults,
        });

      case 'refresh_expiring':
        // Trigger background cache refresh for expiring entries
        const { CacheWarming } = await import('@/lib/cache-warming');
        await CacheWarming.refreshExpiringCache(300); // 5 minutes threshold

        return NextResponse.json({
          action: 'refresh_expiring',
          message: 'Background cache refresh triggered for expiring entries',
        });

      default:
        return NextResponse.json(
          {
            error:
              'Invalid action. Supported actions: cleanup_expired, validate_triggers, refresh_expiring',
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Cache health POST operation failed:', error);

    return NextResponse.json(
      {
        error: 'Health check operation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Find keys that are about to expire
 */
async function findExpiredKeys(): Promise<string[]> {
  try {
    const allKeys = await redis.keys('unifiedhq:*');
    const expiredKeys: string[] = [];

    for (const key of allKeys.slice(0, 100)) {
      // Limit for performance
      const ttl = await RedisCache.ttl(key);
      if (ttl === 0 || (ttl > 0 && ttl < 60)) {
        // Expired or expiring within 1 minute
        expiredKeys.push(key);
      }
    }

    return expiredKeys;
  } catch (error) {
    console.error('Failed to find expired keys:', error);
    return [];
  }
}

/**
 * Validate a trigger configuration
 */
function validateTrigger(trigger: any): boolean {
  try {
    // Basic validation
    if (
      !trigger.id ||
      !trigger.name ||
      !trigger.conditions ||
      !trigger.actions
    ) {
      return false;
    }

    if (!trigger.conditions.eventType || !trigger.conditions.dataType) {
      return false;
    }

    if (!Array.isArray(trigger.actions) || trigger.actions.length === 0) {
      return false;
    }

    // Validate each action
    for (const action of trigger.actions) {
      if (!action.invalidationType || !action.scope) {
        return false;
      }
    }

    return true;
  } catch (error) {
    return false;
  }
}
