import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  fetchGithubActivity,
  saveGithubActivities,
  isGithubConnected,
  getSelectedRepositoryCount,
} from '@/lib/integrations/github-cached';

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

    // Fetch and save GitHub activity
    const activities = await fetchGithubActivity(userId);
    await saveGithubActivities(userId, activities);

    return NextResponse.json({
      success: true,
      message: `Synced ${activities.length} GitHub activities from ${selectedRepoCount} selected repositories`,
      count: activities.length,
      selectedRepositories: selectedRepoCount,
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
