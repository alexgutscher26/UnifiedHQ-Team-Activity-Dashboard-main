import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { SlackCacheManager } from '@/lib/integrations/slack-cached';

/**
 * Warm Slack cache for the authenticated user
 */
async function warmSlackCache(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const url = new URL(request.url);
    const scheduled = url.searchParams.get('scheduled') === 'true';

    console.log(`Starting cache warming for user: ${userId}`);

    if (scheduled) {
      // Trigger scheduled warming for all active users (admin only)
      // In a real app, you'd want to check admin permissions here
      await SlackCacheManager.scheduledCacheWarming();

      return NextResponse.json({
        message: 'Scheduled cache warming completed',
        timestamp: new Date().toISOString(),
      });
    } else {
      // Warm cache for the specific user
      await SlackCacheManager.warmCache(userId);

      return NextResponse.json({
        message: 'Cache warming completed',
        userId,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('Cache warming failed:', error);
    return NextResponse.json(
      { error: 'Cache warming failed' },
      { status: 500 }
    );
  }
}

/**
 * POST handler for cache warming
 */
export async function POST(request: NextRequest) {
  return warmSlackCache(request);
}

/**
 * GET handler for cache warming (for convenience)
 */
export async function GET(request: NextRequest) {
  return warmSlackCache(request);
}
