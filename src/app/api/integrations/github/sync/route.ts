import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  fetchGithubActivity,
  saveGithubActivities,
  isGithubConnected,
  getSelectedRepositoryCount,
} from '@/lib/integrations/github-cached';
import { CacheInvalidationService } from '@/lib/cache-invalidation-service';

// Helper function to broadcast updates to connected users
function broadcastToUser(userId: string, data: any) {
  const userConnections = (global as any).userConnections;
  if (userConnections?.has(userId)) {
    const controller = userConnections.get(userId);
    try {
      const message = JSON.stringify({
        type: 'activity_update',
        data,
        timestamp: new Date().toISOString(),
      });
      controller.enqueue(`data: ${message}\n\n`);
    } catch (error) {
      console.error('Failed to broadcast to user:', error);
      userConnections?.delete(userId);
    }
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

    const userId = session.user.id;

    // Check if GitHub is connected
    const connected = await isGithubConnected(userId);
    if (!connected) {
      return NextResponse.json(
        { error: 'GitHub not connected' },
        { status: 400 }
      );
    }

    // Get selected repository count
    const selectedRepoCount = await getSelectedRepositoryCount(userId);

    if (selectedRepoCount === 0) {
      return NextResponse.json({
        success: true,
        message:
          'No repositories selected. Please select repositories to track activity.',
        count: 0,
        selectedRepositories: 0,
      });
    }

    // Check if force refresh is requested
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('force') === 'true';

    // If force refresh, invalidate existing cache
    if (forceRefresh) {
      await CacheInvalidationService.invalidateGitHubData(userId);
    }

    // Fetch and save GitHub activity (uses cached version unless force refresh)
    const activities = await fetchGithubActivity(userId);
    await saveGithubActivities(userId, activities);

    // Warm cache for user's repositories in the background if not force refresh
    if (!forceRefresh) {
      const { GitHubCacheWarming } = await import(
        '@/lib/integrations/github-cached'
      );
      GitHubCacheWarming.warmUserRepositories(userId);
    }

    // Broadcast update to connected clients
    try {
      broadcastToUser(userId, {
        type: 'sync_completed',
        count: activities.length,
        selectedRepositories: selectedRepoCount,
        message: `Synced ${activities.length} GitHub activities from ${selectedRepoCount} selected repositories`,
        cached: !forceRefresh,
      });
    } catch (error) {
      console.error('Failed to broadcast sync update:', error);
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${activities.length} GitHub activities from ${selectedRepoCount} selected repositories`,
      count: activities.length,
      selectedRepositories: selectedRepoCount,
      activities: activities.slice(0, 10), // Return first 10 activities for immediate display
      cached: !forceRefresh,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('GitHub sync error:', error);

    if (
      error.message.includes('token expired') ||
      error.message.includes('invalid')
    ) {
      return NextResponse.json(
        {
          error: 'GitHub token expired. Please reconnect your account.',
          code: 'TOKEN_EXPIRED',
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        error: error.message || 'Failed to sync GitHub activity',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const connected = await isGithubConnected(userId);

    return NextResponse.json({
      connected,
      message: connected ? 'GitHub is connected' : 'GitHub not connected',
    });
  } catch (error) {
    console.error('GitHub status check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
