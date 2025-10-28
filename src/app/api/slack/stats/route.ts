import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { PrismaClient } from '@/generated/prisma';
import {
  isSlackConnected,
  getSelectedChannelCount,
} from '@/lib/integrations/slack-cached';

const prisma = new PrismaClient();

/**
 * Fetch Slack activity statistics for the authenticated user.
 *
 * This function retrieves the user's Slack activities from the last 24 hours, calculates the number of messages, threads, and reactions, and formats the last message time. It also compiles a summary of the user's activity status and channel information.
 *
 * @param request - The NextRequest object containing the request headers.
 * @returns A JSON response containing the activity count, status, details, last update time, breakdown of activities, and channel statistics.
 * @throws Error If there is an issue fetching Slack statistics.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Check if Slack is connected
    const connected = await isSlackConnected(userId);
    if (!connected) {
      return NextResponse.json({
        count: 0,
        status: 'Not Connected',
        details: 'Slack not connected',
        lastUpdate: 'Never',
        breakdown: {
          messages: 0,
          threads: 0,
          reactions: 0,
        },
        channels: {
          selected: 0,
          total: 0,
        },
      });
    }

    // Get selected channel count
    const selectedChannelCount = await getSelectedChannelCount(userId);

    // Get activities from the last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const activities = await prisma.activity.findMany({
      where: {
        userId,
        source: 'slack',
        timestamp: {
          gte: twentyFourHoursAgo,
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
    });

    // Calculate breakdown
    let messageCount = 0;
    let threadCount = 0;
    let reactionCount = 0;
    let lastMessageTime: Date | null = null;
    let uniqueChannels = new Set<string>();

    for (const activity of activities) {
      const metadata = activity.metadata as any;

      // Count different types of activities
      if (metadata?.eventType === 'message') {
        messageCount++;

        // Track unique channels
        if (metadata?.channel) {
          uniqueChannels.add(metadata.channel);
        }

        // Check if it's a thread reply
        if (metadata?.payload?.thread_ts) {
          threadCount++;
        }
      }

      // Count reactions (if we track them)
      if (metadata?.eventType === 'reaction') {
        reactionCount++;
      }

      // Track the most recent message time
      if (!lastMessageTime || activity.timestamp > lastMessageTime) {
        lastMessageTime = activity.timestamp;
      }
    }

    const totalActivity = activities.length;
    const channelCount = uniqueChannels.size;

    // Format last message time
    let lastMessageText = 'Never';
    if (lastMessageTime) {
      const now = new Date();
      const diffMs = now.getTime() - lastMessageTime.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMinutes < 1) {
        lastMessageText = 'Just now';
      } else if (diffMinutes < 60) {
        lastMessageText = `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
      } else if (diffHours < 24) {
        lastMessageText = `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
      } else {
        lastMessageText = `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
      }
    }

    // Create details string
    const details = [];
    if (messageCount > 0) {
      details.push(`${messageCount} message${messageCount === 1 ? '' : 's'}`);
    }
    if (threadCount > 0) {
      details.push(`${threadCount} thread${threadCount === 1 ? '' : 's'}`);
    }
    if (reactionCount > 0) {
      details.push(
        `${reactionCount} reaction${reactionCount === 1 ? '' : 's'}`
      );
    }
    if (selectedChannelCount > 0) {
      details.push(
        `${selectedChannelCount} channel${selectedChannelCount === 1 ? '' : 's'}`
      );
    }

    const detailsText = details.length > 0 ? details.join(', ') : 'No activity';

    // TODO: Get total channels available (this would need to be implemented)
    const totalChannels = selectedChannelCount; // For now, use selected channels as total

    return NextResponse.json({
      count: totalActivity,
      status: totalActivity > 0 ? 'Active' : 'Inactive',
      details: detailsText,
      lastUpdate: lastMessageText,
      breakdown: {
        messages: messageCount,
        threads: threadCount,
        reactions: reactionCount,
        channels: channelCount,
      },
      channels: {
        selected: selectedChannelCount,
        total: totalChannels,
        active: channelCount,
      },
    });
  } catch (error) {
    console.error('Error fetching Slack stats:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch Slack statistics',
      },
      { status: 500 }
    );
  }
}
