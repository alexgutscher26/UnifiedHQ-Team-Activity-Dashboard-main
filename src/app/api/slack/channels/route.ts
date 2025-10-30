import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { PrismaClient } from '@/generated/prisma';
import { CachedSlackClient } from '@/lib/integrations/slack-cached';
import { withCache } from '@/middleware/cache-middleware';
import { RedisCache, CacheKeyGenerator, TTLManager } from '@/lib/redis';

const prisma = new PrismaClient();

/**
 * Fetch Slack channels for the authenticated user with Redis caching.
 *
 * @param request - The NextRequest object containing the request headers.
 * @returns A JSON response containing the user's Slack channels.
 */
async function getSlackChannels(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Generate cache key for user's Slack channels
    const cacheKey = CacheKeyGenerator.slack(userId, 'channels', 'list');

    // Try to get from Redis cache first
    const cachedChannels = await RedisCache.get(cacheKey);
    if (cachedChannels) {
      console.log(`[Slack Channels] Cache hit for user ${userId}`);
      return NextResponse.json(cachedChannels);
    }

    // Check if Slack is connected
    const connection = await prisma.connection.findFirst({
      where: {
        userId,
        type: 'slack',
      },
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'Slack not connected' },
        { status: 400 }
      );
    }

    // Create Slack client and fetch channels
    const client = new CachedSlackClient(
      connection.accessToken,
      userId,
      connection.botToken || undefined
    );

    const channels = await client.getChannels();

    // Get selected channels for this user
    const selectedChannels = await prisma.selectedChannel.findMany({
      where: { userId },
    });

    const selectedChannelIds = new Set(
      selectedChannels.map(sc => sc.channelId)
    );

    // Add selection status to channels
    const channelsWithSelection = channels.map(channel => ({
      ...channel,
      selected: selectedChannelIds.has(channel.id),
    }));

    const responseData = {
      channels: channelsWithSelection,
      total: channels.length,
      selected: selectedChannels.length,
    };

    // Cache the channels data in Redis
    await RedisCache.set(
      cacheKey,
      responseData,
      TTLManager.getTTL('SLACK_CHANNELS')
    );
    console.log(`[Slack Channels] Cached channels for user ${userId}`);

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error fetching Slack channels:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch Slack channels',
      },
      { status: 500 }
    );
  }
}

/**
 * GET handler with caching middleware
 */
export async function GET(request: NextRequest) {
  return withCache(request, getSlackChannels);
}
