import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  GitHubCacheManager,
  GitHubCacheWarming,
} from '@/lib/integrations/github-cached';
import { RedisCache, CacheKeyGenerator } from '@/lib/redis';

/**
 * GitHub cache management endpoint
 * Provides cache statistics, warming, and invalidation capabilities
 */

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const userId = session.user.id;

    switch (action) {
      case 'stats':
        // Get cache statistics
        const memoryStats = GitHubCacheManager.getStats();

        // Get Redis cache statistics for this user
        const redisPattern = `unifiedhq:github:${userId}:*`;
        const redisKeys = (await RedisCache.redis?.keys(redisPattern)) || [];

        return NextResponse.json({
          memory: memoryStats,
          redis: {
            keyCount: redisKeys.length,
            pattern: redisPattern,
          },
          user: userId,
          timestamp: new Date().toISOString(),
        });

      case 'warm':
        // Warm cache for user's repositories
        await GitHubCacheWarming.warmUserRepositories(userId);

        return NextResponse.json({
          message: 'Cache warming initiated for user repositories',
          userId,
          timestamp: new Date().toISOString(),
        });

      case 'warm-frequent':
        // Admin action to warm frequently accessed repositories
        await GitHubCacheWarming.warmFrequentRepositories();

        return NextResponse.json({
          message:
            'Cache warming initiated for frequently accessed repositories',
          timestamp: new Date().toISOString(),
        });

      default:
        return NextResponse.json({
          message: 'GitHub cache management endpoint',
          availableActions: ['stats', 'warm', 'warm-frequent'],
          usage: {
            stats: 'GET /api/github/cache?action=stats',
            warm: 'GET /api/github/cache?action=warm',
            warmFrequent: 'GET /api/github/cache?action=warm-frequent',
            clear: 'DELETE /api/github/cache',
          },
        });
    }
  } catch (error) {
    console.error('GitHub cache management error:', error);
    return NextResponse.json(
      { error: 'Failed to manage GitHub cache' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope') || 'user';
    const userId = session.user.id;

    let clearedCount = 0;

    switch (scope) {
      case 'user':
        // Clear cache for current user only
        await GitHubCacheManager.clearAllCaches(userId);
        clearedCount = await GitHubCacheManager.clearRedisCache(userId);

        return NextResponse.json({
          message: "Cleared GitHub cache for user",
          userId,
          clearedEntries: clearedCount,
          timestamp: new Date().toISOString(),
        });

      case 'memory':
        // Clear only memory cache
        GitHubCacheManager.clearMemoryCache();

        return NextResponse.json({
          message: 'Cleared GitHub memory cache',
          timestamp: new Date().toISOString(),
        });

      case 'redis':
        // Clear only Redis cache for user
        clearedCount = await GitHubCacheManager.clearRedisCache(userId);

        return NextResponse.json({
          message: 'Cleared GitHub Redis cache for user',
          userId,
          clearedEntries: clearedCount,
          timestamp: new Date().toISOString(),
        });

      default:
        return NextResponse.json(
          { error: 'Invalid scope. Use: user, memory, or redis' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('GitHub cache clear error:', error);
    return NextResponse.json(
      { error: 'Failed to clear GitHub cache' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, repository } = body;
    const userId = session.user.id;

    switch (action) {
      case 'warm-repository':
        if (!repository) {
          return NextResponse.json(
            { error: 'Repository name is required for repository warming' },
            { status: 400 }
          );
        }

        // Schedule cache warming for specific repository
        await GitHubCacheWarming.scheduleRepositoryWarming(userId, repository);

        return NextResponse.json({
          message: `Cache warming scheduled for repository: ${repository}`,
          userId,
          repository,
          timestamp: new Date().toISOString(),
        });

      case 'invalidate-repository':
        if (!repository) {
          return NextResponse.json(
            {
              error: 'Repository name is required for repository invalidation',
            },
            { status: 400 }
          );
        }

        // Invalidate cache for specific repository
        const pattern = `unifiedhq:github:${userId}:*:${repository}:*`;
        const invalidatedCount = await RedisCache.deleteByPattern(pattern);

        return NextResponse.json({
          message: `Cache invalidated for repository: ${repository}`,
          userId,
          repository,
          invalidatedEntries: invalidatedCount,
          timestamp: new Date().toISOString(),
        });

      default:
        return NextResponse.json(
          {
            error:
              'Invalid action. Use: warm-repository or invalidate-repository',
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('GitHub cache action error:', error);
    return NextResponse.json(
      { error: 'Failed to perform GitHub cache action' },
      { status: 500 }
    );
  }
}
