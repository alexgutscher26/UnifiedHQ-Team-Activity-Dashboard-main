import { PrismaClient } from '@/generated/prisma';
import { RedisCache, CacheKeyGenerator, TTLManager } from '@/lib/redis';

const prisma = new PrismaClient();

// Enhanced cache configuration for different Slack data types with strategies
const CACHE_CONFIG = {
  // Channel data - cache for 30 minutes (moderate refresh rate)
  channels: {
    list: TTLManager.getTTL('SLACK_CHANNELS'),
    strategy: 'stale-while-revalidate' as const,
    priority: 'medium' as const,
  },
  // Messages - cache for 5 minutes (high refresh rate for real-time feel)
  messages: {
    history: TTLManager.getTTL('SLACK_MESSAGES'),
    strategy: 'network-first' as const,
    priority: 'high' as const,
  },
  // Team info - cache for 1 hour (low refresh rate)
  team: {
    info: TTLManager.getTTL('SLACK_USERS'),
    strategy: 'cache-first' as const,
    priority: 'low' as const,
  },
  // User data - cache for 1 hour (low refresh rate)
  users: {
    list: TTLManager.getTTL('SLACK_USERS'),
    strategy: 'cache-first' as const,
    priority: 'low' as const,
  },
  // Activity data - cache for 5 minutes with background refresh
  activity: {
    fetch: TTLManager.getTTL('SLACK_MESSAGES'),
    strategy: 'stale-while-revalidate' as const,
    priority: 'high' as const,
  },
  // Stats data - cache for 10 minutes
  stats: {
    daily: TTLManager.getTTL('SLACK_MESSAGES') * 2, // 10 minutes
    strategy: 'cache-first' as const,
    priority: 'medium' as const,
  },
};

export interface SlackActivity {
  source: 'slack';
  title: string;
  description?: string;
  timestamp: Date;
  externalId: string;
  metadata?: any;
}

export interface SlackChannel {
  id: string;
  name: string;
  is_channel: boolean;
  is_group: boolean;
  is_im: boolean;
  is_mpim: boolean;
  is_private: boolean;
  is_member: boolean;
  is_archived: boolean;
  num_members?: number;
  topic?: {
    value: string;
  };
  purpose?: {
    value: string;
  };
}

export interface SlackMessage {
  type: string;
  text: string;
  user: string;
  ts: string;
  channel: string;
  thread_ts?: string;
  reply_count?: number;
  reactions?: Array<{
    name: string;
    count: number;
    users: string[];
  }>;
}

export interface SlackUser {
  id: string;
  name: string;
  real_name: string;
  profile: {
    display_name?: string;
    image_24?: string;
    image_32?: string;
    image_48?: string;
    image_72?: string;
    image_192?: string;
    image_512?: string;
  };
  is_bot?: boolean;
  deleted?: boolean;
}

/**
 * Cached Slack API client wrapper
 */
export class CachedSlackClient {
  private accessToken: string;
  private userId: string;
  private botToken?: string;

  constructor(accessToken: string, userId: string, botToken?: string) {
    this.accessToken = accessToken;
    this.userId = userId;
    this.botToken = botToken;
  }

  /**
   * Enhanced cached request with strategy-based caching and real-time invalidation support
   */
  private async cachedRequest<T>(
    operation: string,
    params: Record<string, any>,
    config: {
      ttl: number;
      strategy: 'cache-first' | 'network-first' | 'stale-while-revalidate';
      priority: 'high' | 'medium' | 'low';
    },
    fetcher: () => Promise<T>
  ): Promise<T> {
    // Generate Redis cache key with enhanced structure
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}:${params[key]}`)
      .join('|');
    const cacheKey = CacheKeyGenerator.slack(
      this.userId,
      operation,
      sortedParams
    );

    // Add tags for cache invalidation
    const tags = ['slack', operation, this.userId];
    if (params.channelId) {
      tags.push(`channel:${params.channelId}`);
    }

    try {
      // Apply caching strategy
      switch (config.strategy) {
        case 'cache-first':
          return await this.cacheFirstStrategy(
            cacheKey,
            config.ttl,
            fetcher,
            tags
          );

        case 'network-first':
          return await this.networkFirstStrategy(
            cacheKey,
            config.ttl,
            fetcher,
            tags
          );

        case 'stale-while-revalidate':
          return await this.staleWhileRevalidateStrategy(
            cacheKey,
            config.ttl,
            fetcher,
            tags
          );

        default:
          return await this.cacheFirstStrategy(
            cacheKey,
            config.ttl,
            fetcher,
            tags
          );
      }
    } catch (error: any) {
      // Enhanced error handling with fallback strategies
      return await this.handleCacheError(error, cacheKey, operation, fetcher);
    }
  }

  /**
   * Cache-first strategy: Check cache first, fetch if miss
   */
  private async cacheFirstStrategy<T>(
    cacheKey: string,
    ttl: number,
    fetcher: () => Promise<T>,
    tags: string[]
  ): Promise<T> {
    const cached = await RedisCache.get<T>(cacheKey);
    if (cached) {
      console.log(`[Slack Cache] Cache hit (cache-first): ${cacheKey}`);
      return cached;
    }

    console.log(`[Slack Cache] Cache miss (cache-first): ${cacheKey}`);
    const data = await fetcher();
    await this.setCacheWithTags(cacheKey, data, ttl, tags);
    return data;
  }

  /**
   * Network-first strategy: Try network first, fallback to cache
   */
  private async networkFirstStrategy<T>(
    cacheKey: string,
    ttl: number,
    fetcher: () => Promise<T>,
    tags: string[]
  ): Promise<T> {
    try {
      console.log(`[Slack Cache] Network-first fetch: ${cacheKey}`);
      const data = await fetcher();
      await this.setCacheWithTags(cacheKey, data, ttl, tags);
      return data;
    } catch (error) {
      console.warn(`[Slack Cache] Network failed, trying cache: ${cacheKey}`);
      const cached = await RedisCache.get<T>(cacheKey);
      if (cached) {
        console.log(`[Slack Cache] Cache fallback success: ${cacheKey}`);
        return cached;
      }
      throw error;
    }
  }

  /**
   * Stale-while-revalidate strategy: Return cache immediately, update in background
   */
  private async staleWhileRevalidateStrategy<T>(
    cacheKey: string,
    ttl: number,
    fetcher: () => Promise<T>,
    tags: string[]
  ): Promise<T> {
    const cached = await RedisCache.get<T>(cacheKey);

    if (cached) {
      console.log(`[Slack Cache] Stale cache hit: ${cacheKey}`);

      // Check if cache is stale (older than half TTL)
      const cacheAge = await RedisCache.ttl(cacheKey);
      const isStale = cacheAge < ttl / 2;

      if (isStale) {
        // Background revalidation
        console.log(`[Slack Cache] Background revalidation: ${cacheKey}`);
        setImmediate(async () => {
          try {
            const freshData = await fetcher();
            await this.setCacheWithTags(cacheKey, freshData, ttl, tags);
            console.log(
              `[Slack Cache] Background update completed: ${cacheKey}`
            );
          } catch (error) {
            console.warn(
              `[Slack Cache] Background update failed: ${cacheKey}`,
              error
            );
          }
        });
      }

      return cached;
    }

    // No cache, fetch immediately
    console.log(`[Slack Cache] No cache, fetching: ${cacheKey}`);
    const data = await fetcher();
    await this.setCacheWithTags(cacheKey, data, ttl, tags);
    return data;
  }

  /**
   * Set cache with tags for invalidation
   */
  private async setCacheWithTags<T>(
    cacheKey: string,
    data: T,
    ttl: number,
    tags: string[]
  ): Promise<void> {
    await RedisCache.set(cacheKey, data, ttl);

    // Store tag associations for cache invalidation
    for (const tag of tags) {
      const tagKey = `tag:${tag}:${cacheKey}`;
      await RedisCache.set(tagKey, true, ttl + 60); // Tags live slightly longer
    }
  }

  /**
   * Enhanced error handling with fallback strategies
   */
  private async handleCacheError<T>(
    error: any,
    cacheKey: string,
    operation: string,
    fetcher: () => Promise<T>
  ): Promise<T> {
    // Rate limit handling
    if (error.status === 429 || error.message?.includes('rate limit')) {
      console.warn(
        `[Slack Cache] Rate limit hit for ${operation}, trying expired cache`
      );

      // Try to get any cached data, even if expired
      const expiredCache = await RedisCache.get<T>(cacheKey);
      if (expiredCache) {
        console.log(
          `[Slack Cache] Using expired cache due to rate limit: ${cacheKey}`
        );
        return expiredCache;
      }

      // If no cache available, wait and retry once
      console.log(
        `[Slack Cache] No expired cache, waiting before retry: ${operation}`
      );
      await new Promise(resolve => setTimeout(resolve, 2000));

      try {
        const data = await fetcher();
        await RedisCache.set(cacheKey, data, CACHE_CONFIG.messages.history);
        return data;
      } catch (retryError) {
        console.error(
          `[Slack Cache] Retry failed for ${operation}:`,
          retryError
        );
        throw new Error(
          `Slack API rate limited and no cached data available for ${operation}`
        );
      }
    }

    // Token expiration handling
    if (
      error.message?.includes('invalid_auth') ||
      error.message?.includes('token_revoked')
    ) {
      console.error(
        `[Slack Cache] Authentication error for ${operation}:`,
        error.message
      );
      throw new Error(
        'Slack token expired or invalid. Please reconnect your Slack account.'
      );
    }

    // Network or other errors
    console.error(`[Slack Cache] Error for ${operation}:`, error);

    // Try to return cached data as fallback
    const fallbackCache = await RedisCache.get<T>(cacheKey);
    if (fallbackCache) {
      console.log(
        `[Slack Cache] Using fallback cache due to error: ${cacheKey}`
      );
      return fallbackCache;
    }

    throw error;
  }

  /**
   * Retrieves the workspace channels with enhanced caching.
   */
  async getChannels(): Promise<SlackChannel[]> {
    return this.cachedRequest(
      'channels.list',
      { userId: this.userId },
      {
        ttl: CACHE_CONFIG.channels.list,
        strategy: CACHE_CONFIG.channels.strategy,
        priority: CACHE_CONFIG.channels.priority,
      },
      async () => {
        const response = await fetch(
          'https://slack.com/api/conversations.list',
          {
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Slack API error: ${response.status}`);
        }

        const data = await response.json();

        if (!data.ok) {
          throw new Error(`Slack API error: ${data.error}`);
        }

        return data.channels || [];
      }
    );
  }

  /**
   * Join a channel (for bot users)
   */
  async joinChannel(channelId: string): Promise<boolean> {
    try {
      // Use bot token for joining channels (bot tokens work better for this)
      const token = this.botToken || this.accessToken;
      const response = await fetch('https://slack.com/api/conversations.join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ channel: channelId }),
      });
      const data = await response.json();
      return data.ok;
    } catch (error) {
      console.error(`Failed to join channel ${channelId}:`, error);
      return false;
    }
  }

  /**
   * Get channel message history with enhanced caching and real-time invalidation support
   */
  async getChannelHistory(
    channelId: string,
    limit = 20
  ): Promise<SlackMessage[]> {
    return this.cachedRequest(
      'messages.history',
      { channelId, limit },
      {
        ttl: CACHE_CONFIG.messages.history,
        strategy: CACHE_CONFIG.messages.strategy,
        priority: CACHE_CONFIG.messages.priority,
      },
      async () => {
        // Use bot token if available for better channel access
        const token = this.botToken || this.accessToken;
        const response = await fetch(
          `https://slack.com/api/conversations.history?channel=${channelId}&limit=${limit}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Slack API error: ${response.status}`);
        }

        const data = await response.json();

        if (!data.ok) {
          throw new Error(`Slack API error: ${data.error}`);
        }

        return data.messages || [];
      }
    );
  }

  /**
   * Get team/workspace information with enhanced caching
   */
  async getTeamInfo(): Promise<any> {
    return this.cachedRequest(
      'team.info',
      { userId: this.userId },
      {
        ttl: CACHE_CONFIG.team.info,
        strategy: CACHE_CONFIG.team.strategy,
        priority: CACHE_CONFIG.team.priority,
      },
      async () => {
        const response = await fetch('https://slack.com/api/team.info', {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Slack API error: ${response.status}`);
        }

        const data = await response.json();

        if (!data.ok) {
          throw new Error(`Slack API error: ${data.error}`);
        }

        return data.team;
      }
    );
  }

  /**
   * Get workspace users with enhanced caching
   */
  async getUsers(): Promise<SlackUser[]> {
    return this.cachedRequest(
      'users.list',
      { userId: this.userId },
      {
        ttl: CACHE_CONFIG.users.list,
        strategy: CACHE_CONFIG.users.strategy,
        priority: CACHE_CONFIG.users.priority,
      },
      async () => {
        const response = await fetch('https://slack.com/api/users.list', {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Slack API error: ${response.status}`);
        }

        const data = await response.json();

        if (!data.ok) {
          throw new Error(`Slack API error: ${data.error}`);
        }

        return data.members || [];
      }
    );
  }
}

/**
 * Database-based cache for Slack activities
 */
class DatabaseCache {
  /**
   * Store Slack activities in database with caching metadata
   */
  static async storeActivities(
    userId: string,
    activities: SlackActivity[],
    cacheKey: string
  ): Promise<void> {
    const cacheEntry = {
      userId,
      cacheKey,
      data: activities,
      timestamp: new Date(),
      ttl: 5 * 60 * 1000, // 5 minutes
    };

    // Store in database cache table
    await prisma.slackCache.upsert({
      where: {
        userId_cacheKey: {
          userId,
          cacheKey,
        },
      },
      update: {
        data: cacheEntry.data as any,
        timestamp: cacheEntry.timestamp,
        ttl: cacheEntry.ttl,
      },
      create: {
        userId,
        cacheKey,
        data: cacheEntry.data as any,
        timestamp: cacheEntry.timestamp,
        ttl: cacheEntry.ttl,
      },
    });
  }

  /**
   * Retrieves cached activities from the database for a specific user.
   */
  static async getCachedActivities(
    userId: string,
    cacheKey: string
  ): Promise<SlackActivity[] | null> {
    const cacheEntry = await prisma.slackCache.findUnique({
      where: {
        userId_cacheKey: {
          userId,
          cacheKey,
        },
      },
    });

    if (!cacheEntry) return null;

    const now = new Date();
    const cacheAge = now.getTime() - cacheEntry.timestamp.getTime();

    if (cacheAge > cacheEntry.ttl) {
      // Cache expired, delete it
      await prisma.slackCache.delete({
        where: {
          userId_cacheKey: {
            userId,
            cacheKey,
          },
        },
      });
      return null;
    }

    return cacheEntry.data as unknown as SlackActivity[];
  }

  /**
   * Clear expired cache entries older than 24 hours.
   */
  static async clearExpiredCache(): Promise<void> {
    const now = new Date();
    await prisma.slackCache.deleteMany({
      where: {
        timestamp: {
          lt: new Date(now.getTime() - 24 * 60 * 60 * 1000), // Delete entries older than 24 hours
        },
      },
    });
  }

  /**
   * Clear all cache for a user.
   */
  static async clearUserCache(userId: string): Promise<void> {
    await prisma.slackCache.deleteMany({
      where: { userId },
    });
  }
}

/**
 * Fetches Slack activity for a specified user with comprehensive caching.
 */
export async function fetchSlackActivity(
  userId: string,
  bypassCache = false
): Promise<SlackActivity[]> {
  console.log(`[Slack Sync] Starting cached sync for user: ${userId}`);

  const connection = await prisma.connection.findFirst({
    where: {
      userId,
      type: 'slack',
    },
  });

  if (!connection) {
    console.log(`[Slack Sync] No Slack connection found for user: ${userId}`);
    throw new Error('Slack not connected');
  }

  // Get selected channels
  const selectedChannels = await prisma.selectedChannel.findMany({
    where: {
      userId,
    },
  });

  if (selectedChannels.length === 0) {
    return [];
  }

  // Generate cache key for this user's activity
  const cacheKey = `activities:${userId}:${selectedChannels
    .map(c => c.channelId)
    .sort()
    .join(',')}`;

  // Try to get from database cache first (unless bypassed)
  if (!bypassCache) {
    const cachedActivities = await DatabaseCache.getCachedActivities(
      userId,
      cacheKey
    );
    if (cachedActivities && cachedActivities.length > 0) {
      console.log(
        `[Slack Cache] Database cache hit for user ${userId} with ${cachedActivities.length} activities`
      );
      return cachedActivities;
    }
  }

  console.log(
    `[Slack Cache] ${bypassCache ? 'Cache bypassed' : 'Database cache miss'} for user ${userId}, fetching from API`
  );

  const client = new CachedSlackClient(
    connection.accessToken,
    userId,
    connection.botToken || undefined
  );
  const allActivities: SlackActivity[] = [];

  try {
    console.log(
      `[Slack Sync] Fetching activity for ${selectedChannels.length} channels`
    );

    // Get users for mention resolution
    const users = await client.getUsers();
    console.log(`[Slack Sync] Fetched ${users.length} users`);
    const userMap = new Map(users.map(user => [user.id, user]));

    // Fetch activity from each selected channel
    for (const channel of selectedChannels) {
      try {
        console.log(
          `[Slack Sync] Fetching messages from channel: ${channel.channelName} (${channel.channelId})`
        );
        // Fetch recent messages with caching
        const messages = await client.getChannelHistory(channel.channelId, 20);
        console.log(
          `[Slack Sync] Fetched ${messages.length} messages from ${channel.channelName}`
        );

        // Convert messages to activities
        messages.forEach(message => {
          const user = userMap.get(message.user);
          const messageText = message.text || '';

          allActivities.push({
            source: 'slack',
            title:
              messageText.slice(0, 100) +
              (messageText.length > 100 ? '...' : ''),
            description: `Message in ${channel.channelName}`,
            timestamp: new Date(Number(message.ts) * 1000),
            externalId: `${channel.channelId}:${message.ts}`,
            metadata: {
              eventType: 'message',
              channel: {
                id: channel.channelId,
                name: channel.channelName,
                type: channel.channelType,
              },
              user: user
                ? {
                    id: user.id,
                    name: user.name,
                    real_name: user.real_name,
                    display_name: user.profile.display_name,
                    avatar_url: user.profile.image_48,
                  }
                : null,
              payload: {
                message: {
                  text: messageText,
                  ts: message.ts,
                  thread_ts: message.thread_ts,
                  reply_count: message.reply_count,
                  reactions: message.reactions,
                },
              },
            },
          });
        });
      } catch (channelError: any) {
        console.warn(
          `Failed to fetch activity for channel ${channel.channelName}:`,
          channelError.message
        );
      }
    }

    // Sort by timestamp (most recent first) and limit to 50 activities
    const sortedActivities = allActivities
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 50);

    // Store in database cache
    await DatabaseCache.storeActivities(userId, sortedActivities, cacheKey);

    console.log(
      `[Slack Sync] Created ${sortedActivities.length} activities from ${selectedChannels.length} channels`
    );

    return sortedActivities;
  } catch (error: any) {
    if (
      error.message.includes('invalid_auth') ||
      error.message.includes('token_revoked')
    ) {
      throw new Error(
        'Slack token expired or invalid. Please reconnect your Slack account.'
      );
    }
    throw new Error(`Failed to fetch Slack activity: ${error.message}`);
  }
}

/**
 * Save Slack activities to the database, avoiding duplicates.
 */
export async function saveSlackActivities(
  userId: string,
  activities: SlackActivity[]
): Promise<void> {
  for (const activity of activities) {
    await prisma.activity.upsert({
      where: {
        userId_source_externalId: {
          userId,
          source: activity.source,
          externalId: activity.externalId,
        },
      },
      update: {
        title: activity.title,
        description: activity.description,
        timestamp: activity.timestamp,
        metadata: activity.metadata,
      },
      create: {
        userId,
        source: activity.source,
        title: activity.title,
        description: activity.description,
        timestamp: activity.timestamp,
        externalId: activity.externalId,
        metadata: activity.metadata,
      },
    });
  }
}

/**
 * Get stored Slack activities for a user
 * Only returns activities from selected channels
 */
export async function getSlackActivities(
  userId: string,
  limit = 10
): Promise<SlackActivity[]> {
  // Get selected channels
  const selectedChannels = await prisma.selectedChannel.findMany({
    where: {
      userId,
    },
  });

  if (selectedChannels.length === 0) {
    return [];
  }

  const selectedChannelIds = new Set(
    selectedChannels.map(channel => channel.channelId)
  );

  const activities = await prisma.activity.findMany({
    where: {
      userId,
      source: 'slack',
    },
    orderBy: {
      timestamp: 'desc',
    },
    take: limit * 2, // Get more activities to filter
  });

  // Filter activities to only include those from selected channels
  const filteredActivities = activities.filter(activity => {
    const metadata = activity.metadata as any;
    const channelId = metadata?.channel?.id;
    return channelId && selectedChannelIds.has(channelId);
  });

  return filteredActivities.slice(0, limit).map(activity => ({
    source: activity.source as 'slack',
    title: activity.title,
    description: activity.description || undefined,
    timestamp: activity.timestamp,
    externalId: activity.externalId || '',
    metadata: activity.metadata,
  }));
}

/**
 * Checks if the user has a Slack connection.
 */
export async function isSlackConnected(userId: string): Promise<boolean> {
  const connection = await prisma.connection.findFirst({
    where: {
      userId,
      type: 'slack',
    },
  });
  return Boolean(connection);
}

/**
 * Retrieves the count of selected channels for a given user.
 */
export async function getSelectedChannelCount(userId: string): Promise<number> {
  const count = await prisma.selectedChannel.count({
    where: {
      userId,
    },
  });
  return count;
}

/**
 * Disconnect Slack integration for a user.
 */
export async function disconnectSlack(userId: string): Promise<void> {
  await prisma.connection.deleteMany({
    where: {
      userId,
      type: 'slack',
    },
  });

  // Clean up selected channels
  await prisma.selectedChannel.deleteMany({
    where: {
      userId,
    },
  });

  // Clean up old activities
  await prisma.activity.deleteMany({
    where: {
      userId,
      source: 'slack',
    },
  });

  // Clear cache for this user
  await DatabaseCache.clearUserCache(userId);
}

/**
 * Cache management functions
 */
export const SlackCacheManager = {
  /**
   * Get cache statistics (Redis-based)
   */
  getStats: async (userId?: string) => {
    try {
      const pattern = userId
        ? CacheKeyGenerator.slack(userId, '*', '*')
        : CacheKeyGenerator.slack('*', '*', '*');

      const keys = await RedisCache.getKeysByPattern(pattern);
      let validEntries = 0;
      let expiredEntries = 0;

      // Check TTL for each key to determine if it's valid or expired
      for (const key of keys) {
        const ttl = await RedisCache.ttl(key);
        if (ttl > 0) {
          validEntries++;
        } else if (ttl === -1) {
          // Key exists but has no expiration
          validEntries++;
        } else {
          expiredEntries++;
        }
      }

      return {
        totalEntries: keys.length,
        validEntries,
        expiredEntries,
        hitRate: validEntries / Math.max(keys.length, 1),
      };
    } catch (error) {
      console.error('Failed to get Slack cache stats:', error);
      return {
        totalEntries: 0,
        validEntries: 0,
        expiredEntries: 0,
        hitRate: 0,
      };
    }
  },

  /**
   * Clear Redis cache for Slack data
   */
  clearRedisCache: async (userId?: string) => {
    const pattern = userId
      ? CacheKeyGenerator.slack(userId, '*')
      : CacheKeyGenerator.slack('*', '*');
    await RedisCache.deleteByPattern(pattern);
  },

  /**
   * Clear database cache
   */
  clearDatabaseCache: () => DatabaseCache.clearExpiredCache(),

  /**
   * Clear all cache for a user
   */
  clearUserCache: async (userId: string) => {
    await Promise.all([
      RedisCache.deleteByPattern(CacheKeyGenerator.slack(userId, '*')),
      DatabaseCache.clearUserCache(userId),
    ]);
  },

  /**
   * Clear all caches
   */
  clearAllCaches: async (userId?: string) => {
    if (userId) {
      await SlackCacheManager.clearUserCache(userId);
    } else {
      await Promise.all([
        RedisCache.deleteByPattern(CacheKeyGenerator.slack('*', '*')),
        DatabaseCache.clearExpiredCache(),
      ]);
    }
  },

  /**
   * Warm cache for frequently accessed Slack data
   */
  warmCache: async (userId: string) => {
    try {
      console.log(`Starting cache warming for user: ${userId}`);

      const connection = await prisma.connection.findFirst({
        where: {
          userId,
          type: 'slack',
        },
      });

      if (!connection) {
        console.log(`No Slack connection found for user: ${userId}`);
        return;
      }

      const client = new CachedSlackClient(
        connection.accessToken,
        userId,
        connection.botToken || undefined
      );

      // Warm essential caches in parallel
      const warmingPromises = [
        // Warm channels list
        client
          .getChannels()
          .catch(error =>
            console.warn(`Failed to warm channels cache for ${userId}:`, error)
          ),

        // Warm users list
        client
          .getUsers()
          .catch(error =>
            console.warn(`Failed to warm users cache for ${userId}:`, error)
          ),

        // Warm team info
        client
          .getTeamInfo()
          .catch(error =>
            console.warn(`Failed to warm team info cache for ${userId}:`, error)
          ),
      ];

      // Get selected channels and warm their message history
      const selectedChannels = await prisma.selectedChannel.findMany({
        where: { userId },
        take: 5, // Limit to top 5 channels to avoid overwhelming the API
      });

      for (const channel of selectedChannels) {
        warmingPromises.push(
          client
            .getChannelHistory(channel.channelId, 10)
            .catch(error =>
              console.warn(
                `Failed to warm messages cache for channel ${channel.channelId}:`,
                error
              )
            )
        );
      }

      await Promise.allSettled(warmingPromises);
      console.log(`Cache warming completed for user: ${userId}`);
    } catch (error) {
      console.error(`Cache warming failed for user ${userId}:`, error);
    }
  },

  /**
   * Scheduled cache warming for active users
   */
  scheduledCacheWarming: async () => {
    try {
      console.log('Starting scheduled cache warming for active Slack users');

      // Get users who have been active in the last 24 hours
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const activeUsers = await prisma.activity.findMany({
        where: {
          source: 'slack',
          timestamp: {
            gte: twentyFourHoursAgo,
          },
        },
        select: {
          userId: true,
        },
        distinct: ['userId'],
        take: 20, // Limit to prevent overwhelming the system
      });

      console.log(
        `Found ${activeUsers.length} active Slack users for cache warming`
      );

      // Warm cache for active users in batches to avoid rate limits
      const batchSize = 5;
      for (let i = 0; i < activeUsers.length; i += batchSize) {
        const batch = activeUsers.slice(i, i + batchSize);

        await Promise.allSettled(
          batch.map(user => SlackCacheManager.warmCache(user.userId))
        );

        // Wait between batches to respect rate limits
        if (i + batchSize < activeUsers.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      console.log('Scheduled cache warming completed');
    } catch (error) {
      console.error('Scheduled cache warming failed:', error);
    }
  },

  /**
   * Invalidate specific Slack data types
   */
  invalidateChannels: async (userId: string) => {
    const pattern = CacheKeyGenerator.slack(userId, 'channels.list', '*');
    await RedisCache.deleteByPattern(pattern);
  },

  /**
   * Invalidate message history for a channel
   */
  invalidateChannelMessages: async (userId: string, channelId: string) => {
    const pattern = CacheKeyGenerator.slack(
      userId,
      'messages.history',
      `*channelId:${channelId}*`
    );
    await RedisCache.deleteByPattern(pattern);

    // Also invalidate activity cache that includes this channel
    const activityPattern = CacheKeyGenerator.slack(userId, 'activity', '*');
    await RedisCache.deleteByPattern(activityPattern);

    // Invalidate stats cache as message counts may have changed
    const statsPattern = CacheKeyGenerator.slack(userId, 'stats', '*');
    await RedisCache.deleteByPattern(statsPattern);
  },

  /**
   * Invalidate user data
   */
  invalidateUsers: async (userId: string) => {
    const pattern = CacheKeyGenerator.slack(userId, 'users.list', '*');
    await RedisCache.deleteByPattern(pattern);
  },
};
