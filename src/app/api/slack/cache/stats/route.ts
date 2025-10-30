import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { SlackCacheManager } from '@/lib/integrations/slack-cached';
import { RedisCache, CacheKeyGenerator } from '@/lib/redis';

/**
 * Get Slack cache statistics for the authenticated user
 */
async function getSlackCacheStats(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const url = new URL(request.url);
    const detailed = url.searchParams.get('detailed') === 'true';

    console.log(`Getting Slack cache stats for user: ${userId}`);

    // Get basic cache statistics
    const stats = await SlackCacheManager.getStats(userId);

    if (!detailed) {
      return NextResponse.json({
        ...stats,
        userId,
        timestamp: new Date().toISOString(),
      });
    }

    // Get detailed statistics by cache type
    const cacheTypes = [
      'channels',
      'messages',
      'users',
      'team',
      'activity',
      'stats',
    ];
    const detailedStats: Record<string, any> = {};

    for (const cacheType of cacheTypes) {
      try {
        const pattern = CacheKeyGenerator.slack(userId, `${cacheType}.*`, '*');
        const keys = await RedisCache.getKeysByPattern(pattern);

        let validEntries = 0;
        let expiredEntries = 0;
        let totalSize = 0;

        for (const key of keys) {
          const ttl = await RedisCache.ttl(key);
          if (ttl > 0 || ttl === -1) {
            validEntries++;
            // Estimate size (this is approximate)
            try {
              const value = await RedisCache.get(key);
              if (value) {
                totalSize += JSON.stringify(value).length;
              }
            } catch (error) {
              // Ignore errors when getting individual values
            }
          } else {
            expiredEntries++;
          }
        }

        detailedStats[cacheType] = {
          totalKeys: keys.length,
          validEntries,
          expiredEntries,
          estimatedSizeBytes: totalSize,
          hitRate: validEntries / Math.max(keys.length, 1),
        };
      } catch (error) {
        console.warn(`Failed to get stats for cache type ${cacheType}:`, error);
        detailedStats[cacheType] = {
          totalKeys: 0,
          validEntries: 0,
          expiredEntries: 0,
          estimatedSizeBytes: 0,
          hitRate: 0,
          error: 'Failed to retrieve stats',
        };
      }
    }

    return NextResponse.json({
      ...stats,
      userId,
      detailed: detailedStats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to get Slack cache stats:', error);
    return NextResponse.json(
      { error: 'Failed to get cache statistics' },
      { status: 500 }
    );
  }
}

/**
 * GET handler for cache statistics
 */
export async function GET(request: NextRequest) {
  return getSlackCacheStats(request);
}
