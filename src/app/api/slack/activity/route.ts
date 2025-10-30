import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  fetchSlackActivity,
  getSlackActivities,
  saveSlackActivities,
} from '@/lib/integrations/slack-cached';
import { withCache } from '@/middleware/cache-middleware';
import { RedisCache, CacheKeyGenerator, TTLManager } from '@/lib/redis';

/**
 * Fetch Slack activity for the authenticated user with Redis caching.
 *
 * @param request - The NextRequest object containing the request headers.
 * @returns A JSON response containing the user's Slack activities.
 */
async function getSlackActivity(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const refresh = url.searchParams.get('refresh') === 'true';

    // Generate cache key for user's Slack activity
    const cacheKey = CacheKeyGenerator.slack(
      userId,
      'activity',
      `limit:${limit}`
    );

    // Try to get from Redis cache first (unless refresh is requested)
    if (!refresh) {
      const cachedActivity = await RedisCache.get(cacheKey);
      if (cachedActivity) {
        console.log(`[Slack Activity] Cache hit for user ${userId}`);
        return NextResponse.json(cachedActivity);
      }
    }

    console.log(
      `[Slack Activity] ${refresh ? 'Refresh requested' : 'Cache miss'} for user ${userId}`
    );

    try {
      // Fetch fresh activity from Slack API
      const activities = await fetchSlackActivity(userId, refresh);

      // Save activities to database
      await saveSlackActivities(userId, activities);

      // Get the requested number of activities
      const limitedActivities = activities.slice(0, limit);

      const responseData = {
        activities: limitedActivities,
        total: activities.length,
        cached: false,
        timestamp: new Date().toISOString(),
      };

      // Cache the activity data in Redis
      await RedisCache.set(
        cacheKey,
        responseData,
        TTLManager.getTTL('SLACK_MESSAGES')
      );
      console.log(`[Slack Activity] Cached activity for user ${userId}`);

      return NextResponse.json(responseData);
    } catch (fetchError: any) {
      // If API fetch fails, try to get stored activities from database
      console.warn(
        `[Slack Activity] API fetch failed for user ${userId}:`,
        fetchError.message
      );

      try {
        const storedActivities = await getSlackActivities(userId, limit);

        const fallbackData = {
          activities: storedActivities,
          total: storedActivities.length,
          cached: true,
          fallback: true,
          error: fetchError.message,
          timestamp: new Date().toISOString(),
        };

        // Cache the fallback data briefly
        await RedisCache.set(
          cacheKey,
          fallbackData,
          60 // 1 minute TTL for fallback data
        );

        return NextResponse.json(fallbackData);
      } catch (dbError: any) {
        console.error(
          `[Slack Activity] Database fallback failed for user ${userId}:`,
          dbError.message
        );

        return NextResponse.json(
          {
            error: 'Failed to fetch Slack activity',
            details: fetchError.message,
            activities: [],
            total: 0,
            cached: false,
            timestamp: new Date().toISOString(),
          },
          { status: 500 }
        );
      }
    }
  } catch (error: any) {
    console.error('Error in Slack activity endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET handler with caching middleware
 */
export async function GET(request: NextRequest) {
  return withCache(request, getSlackActivity);
}
