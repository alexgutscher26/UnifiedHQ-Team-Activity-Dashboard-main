import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { AISummaryService } from '@/lib/ai-summary-service';
import { CacheInvalidator } from '@/middleware/cache-middleware';

/**
 * Handle GET requests to retrieve AI summary cache statistics.
 *
 * This function first attempts to get the user session from the request headers. If the session is not valid, it returns an unauthorized response.
 * If the session is valid, it fetches the cache statistics from the AISummaryService and returns them along with a success message and a timestamp.
 * In case of an error during the process, it logs the error and returns a failure response with the error details.
 *
 * @param request - The NextRequest object containing the request details.
 * @returns A JSON response containing the success status, cache statistics, and a timestamp, or an error message if the operation fails.
 * @throws Error If there is an issue retrieving the session or cache statistics.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stats = await AISummaryService.getCacheStats();

    return NextResponse.json({
      success: true,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error getting AI summary cache stats:', error);
    return NextResponse.json(
      {
        error: 'Failed to get cache statistics',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/ai-summary/cache
 * Invalidate AI summary cache
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope') || 'user'; // 'user' or 'all'

    if (scope === 'all') {
      // TODO: Only allow admin users to invalidate all caches
      // For now, we'll allow any authenticated user, but this should be restricted
      await AISummaryService.invalidateAllCache();
      await CacheInvalidator.invalidateAISummaryCache();

      return NextResponse.json({
        success: true,
        message: 'All AI summary caches invalidated',
        scope: 'all',
        timestamp: new Date().toISOString(),
      });
    } else {
      // Invalidate user-specific cache
      await AISummaryService.invalidateUserCache(userId);
      await CacheInvalidator.invalidateAISummaryCache(userId);

      return NextResponse.json({
        success: true,
        message: 'User AI summary cache invalidated',
        scope: 'user',
        userId,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('Error invalidating AI summary cache:', error);
    return NextResponse.json(
      {
        error: 'Failed to invalidate cache',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Warm AI summary cache for scheduled generation.
 *
 * This function handles a POST request to warm the AI summary cache by retrieving the user session, validating the user, and determining which users' caches to warm based on the request body. If no users are specified, it returns an error. Upon successful cache warming, it responds with a success message and the count of users processed. In case of errors, it logs the error and returns a failure response.
 *
 * @param request - The NextRequest object containing the request data.
 * @returns A JSON response indicating the success of the cache warming process or an error message.
 * @throws Error If an error occurs during the cache warming process.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { userIds = [], warmCurrentUser = true } = body;

    const usersToWarm = warmCurrentUser
      ? [session.user.id, ...userIds]
      : userIds;

    if (usersToWarm.length === 0) {
      return NextResponse.json(
        { error: 'No users specified for cache warming' },
        { status: 400 }
      );
    }

    await AISummaryService.warmCacheForUsers(usersToWarm);

    return NextResponse.json({
      success: true,
      message: 'Cache warming initiated',
      userCount: usersToWarm.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error warming AI summary cache:', error);
    return NextResponse.json(
      {
        error: 'Failed to warm cache',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
