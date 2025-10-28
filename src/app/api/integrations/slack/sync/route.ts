import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  fetchSlackActivity,
  saveSlackActivities,
  isSlackConnected,
  getSelectedChannelCount,
} from '@/lib/integrations/slack-cached';

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
    console.log(`[Slack Sync API] Starting sync for user: ${userId}`);

    // Check if Slack is connected
    const connected = await isSlackConnected(userId);
    console.log(`[Slack Sync API] Slack connected: ${connected}`);
    if (!connected) {
      return NextResponse.json(
        { error: 'Slack not connected' },
        { status: 400 }
      );
    }

    // Get selected channel count
    const selectedChannelCount = await getSelectedChannelCount(userId);
    console.log(`[Slack Sync API] Selected channels: ${selectedChannelCount}`);

    if (selectedChannelCount === 0) {
      console.log(`[Slack Sync API] No channels selected, returning early`);
      return NextResponse.json({
        success: true,
        message:
          'No channels selected. Please select channels to track activity.',
        count: 0,
        selectedChannels: 0,
      });
    }

    // Fetch and save Slack activity
    console.log(`[Slack Sync API] Fetching Slack activities...`);
    const activities = await fetchSlackActivity(userId, true); // Bypass cache
    console.log(`[Slack Sync API] Fetched ${activities.length} activities`);

    console.log(`[Slack Sync API] Saving activities to database...`);
    await saveSlackActivities(userId, activities);
    console.log(`[Slack Sync API] Saved activities successfully`);

    // Broadcast update to connected clients
    try {
      broadcastToUser(userId, {
        type: 'sync_completed',
        source: 'slack',
        count: activities.length,
        selectedChannels: selectedChannelCount,
        message: `Synced ${activities.length} Slack activities from ${selectedChannelCount} selected channels`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to broadcast sync update:', error);
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${activities.length} Slack activities from ${selectedChannelCount} selected channels`,
      count: activities.length,
      selectedChannels: selectedChannelCount,
      activities: activities.slice(0, 10), // Return first 10 activities for immediate display
    });
  } catch (error: any) {
    console.error('Slack sync error:', error);

    if (
      error.message.includes('token expired') ||
      error.message.includes('invalid')
    ) {
      return NextResponse.json(
        {
          error: 'Slack token expired. Please reconnect your account.',
          code: 'TOKEN_EXPIRED',
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        error: error.message || 'Failed to sync Slack activity',
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
    const connected = await isSlackConnected(userId);

    return NextResponse.json({
      connected,
      message: connected ? 'Slack is connected' : 'Slack not connected',
    });
  } catch (error) {
    console.error('Slack status check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
