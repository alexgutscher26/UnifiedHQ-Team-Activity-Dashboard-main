import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { SlackCacheManager } from '@/lib/integrations/slack-cached';

/**
 * Invalidate Slack cache for the authenticated user.
 *
 * This function retrieves the user's session and checks for authorization. It then parses the request body to determine the type of cache to invalidate, which can include channels, users, messages, Redis, database, or all caches. Depending on the type, it calls the appropriate methods from SlackCacheManager to perform the invalidation and returns a response with the result.
 *
 * @param request - The NextRequest object containing the request data.
 * @returns A NextResponse object indicating the result of the cache invalidation process.
 * @throws Error If the cache invalidation process fails.
 */
async function invalidateSlackCache(
  request: NextRequest
): Promise<NextResponse> {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Parse request body for specific invalidation options
    let body: any = {};
    try {
      const text = await request.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch (error) {
      // Ignore JSON parsing errors, use empty body
    }

    const { type = 'all', channelId, cacheType } = body;

    console.log(`Invalidating Slack cache for user: ${userId}, type: ${type}`);

    let invalidatedCount = 0;

    switch (type) {
      case 'channels':
        await SlackCacheManager.invalidateChannels(userId);
        invalidatedCount = 1;
        break;

      case 'users':
        await SlackCacheManager.invalidateUsers(userId);
        invalidatedCount = 1;
        break;

      case 'messages':
        if (channelId) {
          await SlackCacheManager.invalidateChannelMessages(userId, channelId);
          invalidatedCount = 1;
        } else {
          // Invalidate all message caches
          await SlackCacheManager.clearUserCache(userId);
          invalidatedCount = 1;
        }
        break;

      case 'redis':
        await SlackCacheManager.clearRedisCache(userId);
        invalidatedCount = 1;
        break;

      case 'database':
        await SlackCacheManager.clearDatabaseCache();
        invalidatedCount = 1;
        break;

      case 'all':
      default:
        await SlackCacheManager.clearAllCaches(userId);
        invalidatedCount = 1;
        break;
    }

    return NextResponse.json({
      message: 'Cache invalidation completed',
      userId,
      type,
      channelId: channelId || null,
      invalidatedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cache invalidation failed:', error);
    return NextResponse.json(
      { error: 'Cache invalidation failed' },
      { status: 500 }
    );
  }
}

/**
 * POST handler for cache invalidation
 */
export async function POST(request: NextRequest) {
  return invalidateSlackCache(request);
}

/**
 * DELETE handler for cache invalidation (alternative method)
 */
export async function DELETE(request: NextRequest) {
  return invalidateSlackCache(request);
}
