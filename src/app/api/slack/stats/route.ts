import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { PrismaClient } from '@/generated/prisma';
import {
  isSlackConnected,
  getSelectedChannelCount,
} from '@/lib/integrations/slack-cached';
import { withCache } from '@/middleware/cache-middleware';
import { RedisCache, CacheKeyGenerator, TTLManager } from '@/lib/redis';

const prisma = new PrismaClient();

/**
 * Fetch Slack activity statistics for the authenticated user with Redis caching.
 *
 * This function retrieves the user's Slack activities from the last 24 hours, calculates the number of messages, threads, and reactions, and formats the last message time. It checks for a cached version of the stats, verifies Slack connection, and compiles a summary of the user's activity status and channel information before returning the data. If an error occurs during the process, it handles the exception and returns an appropriate error response.
 *
 * @param request - The NextRequest object containing the request headers.
 * @returns A JSON response containing the activity count, status, details, last update time, breakdown of activities, and channel statistics.
 * @throws Error If there is an issue fetching Slack statistics.
 */
async function getSlackStats(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Generate cache key for user's Slack stats
    let cacheKey: string;
    let cachedStats: any = null;

    try {
      cacheKey = CacheKeyGenerator.slack(userId, 'stats', 'daily');
      // Try to get from Redis cache first
      cachedStats = await RedisCache.get(cacheKey);
      if (cachedStats) {
        console.log(`[Slack Stats] Cache hit for user ${userId}`);
        return NextResponse.json(cachedStats);
      }
    } catch (cacheError) {
      console.warn(
        '[Slack Stats] Cache error, proceeding without cache:',
        cacheError
      );
    }

    // Check if Slack is connected
    let connected = false;
    let selectedChannelCount = 0;

    try {
      connected = await isSlackConnected(userId);
      if (connected) {
        selectedChannelCount = await getSelectedChannelCount(userId);
      }
    } catch (connectionError) {
      console.warn('[Slack Stats] Connection check error:', connectionError);
      // Return default not connected state
      return NextResponse.json({
        count: 0,
        status: 'Connection Error',
        details: 'Unable to check Slack connection',
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

    if (!connected) {
      const notConnectedStats = {
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
      };

      // Try to cache the result
      try {
        await RedisCache.set(
          cacheKey!,
          notConnectedStats,
          TTLManager.getTTL('SLACK_MESSAGES')
        );
      } catch (cacheError) {
        console.warn(
          '[Slack Stats] Failed to cache not connected state:',
          cacheError
        );
      }

      return NextResponse.json(notConnectedStats);
    }

    // Get activities from the last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    let activities: any[] = [];

    try {
      activities = await prisma.activity.findMany({
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
    } catch (dbError) {
      console.error('[Slack Stats] Database error:', dbError);
      // Return empty stats if database fails
      return NextResponse.json({
        count: 0,
        status: 'Database Error',
        details: 'Unable to fetch activity data',
        lastUpdate: 'Never',
        breakdown: {
          messages: 0,
          threads: 0,
          reactions: 0,
        },
        channels: {
          selected: selectedChannelCount,
          total: selectedChannelCount,
        },
      });
    }

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

    const statsData = {
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
    };

    // Cache the stats data in Redis
    try {
      await RedisCache.set(
        cacheKey!,
        statsData,
        TTLManager.getTTL('SLACK_MESSAGES')
      );
      console.log(`[Slack Stats] Cached stats for user ${userId}`);
    } catch (cacheError) {
      console.warn('[Slack Stats] Failed to cache stats:', cacheError);
      // Continue without caching
    }

    return NextResponse.json(statsData);
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

/**
 * Handles GET requests with caching.
 */
export async function GET(request: NextRequest) {
  return withCache(request, getSlackStats);
}
