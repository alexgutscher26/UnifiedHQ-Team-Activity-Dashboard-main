import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { AISummaryService } from '@/lib/ai-summary-service';
import { CacheInvalidator } from '@/middleware/cache-middleware';

/**
 * GET /api/ai-summary/cache
 * Get AI summary cache statistics
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
      // Only allow admin users to invalidate all caches
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
 * POST /api/ai-summary/cache/warm
 * Warm AI summary cache for scheduled generation
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
