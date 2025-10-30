import { NextRequest, NextResponse } from 'next/server';
import { redis, RedisCache, CacheKeyGenerator } from '@/lib/redis';
import { CacheInvalidationService } from '@/lib/cache-invalidation-service';
import { CacheInvalidationTriggers } from '@/lib/cache-invalidation-triggers';
import { CacheWarming } from '@/lib/cache-warming';

// GET - Get cache entry information
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    const pattern = searchParams.get('pattern');

    if (key) {
      // Get specific key information
      const exists = await RedisCache.exists(key);

      if (!exists) {
        return NextResponse.json({ error: 'Key not found' }, { status: 404 });
      }

      const value = await RedisCache.get(key);
      const ttl = await RedisCache.ttl(key);

      return NextResponse.json({
        key,
        value,
        ttl,
        exists: true,
      });
    }

    if (pattern) {
      // Get keys matching pattern
      const keys = await redis.keys(pattern);
      const keyInfo = await Promise.all(
        keys.slice(0, 50).map(async k => ({
          // Limit to 50 keys for performance
          key: k,
          ttl: await RedisCache.ttl(k),
        }))
      );

      return NextResponse.json({
        pattern,
        total_matches: keys.length,
        keys: keyInfo,
      });
    }

    return NextResponse.json(
      { error: 'Either key or pattern parameter is required' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Cache GET error:', error);
    return NextResponse.json(
      { error: 'Failed to get cache data' },
      { status: 500 }
    );
  }
}

// DELETE - Delete cache entries
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    const pattern = searchParams.get('pattern');
    const tag = searchParams.get('tag');

    if (key) {
      // Delete specific key
      const deleted = await RedisCache.del(key);

      return NextResponse.json({
        action: 'delete_key',
        key,
        deleted,
      });
    }

    if (pattern) {
      // Delete keys matching pattern
      const deletedCount = await RedisCache.deleteByPattern(pattern);

      return NextResponse.json({
        action: 'delete_pattern',
        pattern,
        deleted_count: deletedCount,
      });
    }

    if (tag) {
      // Delete keys by tag
      const deletedCount = await RedisCache.invalidateByTag(tag);

      return NextResponse.json({
        action: 'delete_tag',
        tag,
        deleted_count: deletedCount,
      });
    }

    return NextResponse.json(
      { error: 'Either key, pattern, or tag parameter is required' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Cache DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete cache data' },
      { status: 500 }
    );
  }
}

// POST - Set cache entries or perform cache operations
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, key, value, ttl, pattern } = body;

    switch (action) {
      case 'set':
        if (!key || value === undefined) {
          return NextResponse.json(
            { error: 'Key and value are required for set operation' },
            { status: 400 }
          );
        }

        const success = await RedisCache.set(key, value, ttl);

        return NextResponse.json({
          action: 'set',
          key,
          success,
          ttl: ttl || null,
        });

      case 'expire':
        if (!key || !ttl) {
          return NextResponse.json(
            { error: 'Key and TTL are required for expire operation' },
            { status: 400 }
          );
        }

        const expired = await RedisCache.expire(key, ttl);

        return NextResponse.json({
          action: 'expire',
          key,
          success: expired,
          ttl,
        });

      case 'flush_namespace':
        if (!pattern) {
          return NextResponse.json(
            { error: 'Pattern is required for flush_namespace operation' },
            { status: 400 }
          );
        }

        const flushedCount = await RedisCache.deleteByPattern(
          `unifiedhq:${pattern}:*`
        );

        return NextResponse.json({
          action: 'flush_namespace',
          namespace: pattern,
          deleted_count: flushedCount,
        });

      case 'warm_cache':
        const { userId, repositories, channels, commonEndpoints } = body;

        if (!userId) {
          return NextResponse.json(
            { error: 'userId is required for cache warming' },
            { status: 400 }
          );
        }

        await CacheWarming.warmUserSession(userId, {
          repositories,
          channels,
          commonEndpoints,
        });

        return NextResponse.json({
          action: 'warm_cache',
          userId,
          message: 'Cache warming completed successfully',
        });

      case 'invalidate_user':
        const { targetUserId } = body;

        if (!targetUserId) {
          return NextResponse.json(
            { error: 'targetUserId is required for user invalidation' },
            { status: 400 }
          );
        }

        const userInvalidatedCount =
          await CacheInvalidationService.invalidateUser(targetUserId);

        return NextResponse.json({
          action: 'invalidate_user',
          userId: targetUserId,
          invalidated_entries: userInvalidatedCount,
        });

      case 'invalidate_github':
        const { githubUserId, repository } = body;

        if (!githubUserId) {
          return NextResponse.json(
            { error: 'githubUserId is required for GitHub invalidation' },
            { status: 400 }
          );
        }

        const githubInvalidatedCount =
          await CacheInvalidationService.invalidateGitHubData(
            githubUserId,
            repository
          );

        return NextResponse.json({
          action: 'invalidate_github',
          userId: githubUserId,
          repository: repository || 'all',
          invalidated_entries: githubInvalidatedCount,
        });

      case 'invalidate_slack':
        const { slackUserId, channel } = body;

        if (!slackUserId) {
          return NextResponse.json(
            { error: 'slackUserId is required for Slack invalidation' },
            { status: 400 }
          );
        }

        const slackInvalidatedCount =
          await CacheInvalidationService.invalidateSlackData(
            slackUserId,
            channel
          );

        return NextResponse.json({
          action: 'invalidate_slack',
          userId: slackUserId,
          channel: channel || 'all',
          invalidated_entries: slackInvalidatedCount,
        });

      case 'smart_invalidation':
        const { changeType, smartUserId, context } = body;

        if (!changeType || !smartUserId) {
          return NextResponse.json(
            {
              error:
                'changeType and smartUserId are required for smart invalidation',
            },
            { status: 400 }
          );
        }

        const smartInvalidatedCount =
          await CacheInvalidationService.smartInvalidation(
            changeType,
            smartUserId,
            context
          );

        return NextResponse.json({
          action: 'smart_invalidation',
          changeType,
          userId: smartUserId,
          context,
          invalidated_entries: smartInvalidatedCount,
        });

      case 'trigger_event':
        const { eventType, dataType, eventContext } = body;

        if (!eventType || !dataType) {
          return NextResponse.json(
            { error: 'eventType and dataType are required for trigger event' },
            { status: 400 }
          );
        }

        const triggerInvalidatedCount =
          await CacheInvalidationTriggers.processEvent(
            eventType,
            dataType,
            eventContext
          );

        return NextResponse.json({
          action: 'trigger_event',
          eventType,
          dataType,
          context: eventContext,
          invalidated_entries: triggerInvalidatedCount,
        });

      case 'batch_invalidation':
        const { operations } = body;

        if (!operations || !Array.isArray(operations)) {
          return NextResponse.json(
            { error: 'operations array is required for batch invalidation' },
            { status: 400 }
          );
        }

        const batchInvalidatedCount =
          await CacheInvalidationService.batchInvalidation(operations);

        return NextResponse.json({
          action: 'batch_invalidation',
          operations_count: operations.length,
          invalidated_entries: batchInvalidatedCount,
        });

      default:
        return NextResponse.json(
          {
            error:
              'Invalid action. Supported actions: set, expire, flush_namespace, warm_cache, invalidate_user, invalidate_github, invalidate_slack, smart_invalidation, trigger_event, batch_invalidation',
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Cache POST error:', error);
    return NextResponse.json(
      { error: 'Failed to perform cache operation' },
      { status: 500 }
    );
  }
}
