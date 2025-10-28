import { PrismaClient } from '@/generated/prisma';

const prisma = new PrismaClient();

// In-memory cache for Slack API responses
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class SlackCache {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly defaultTTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Stores data in the cache with a specified key and time-to-live.
   */
  set<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Deletes a key from the cache.
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clears the cache.
   */
  clear(): void {
    this.cache.clear();
  }

  // Generate cache key for Slack API calls
  /**
   * Generates a key based on the operation and sorted parameters.
   */
  generateKey(operation: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}:${params[key]}`)
      .join('|');
    return `slack:${operation}:${sortedParams}`;
  }

  // Get cache statistics
  /**
   * Retrieves statistics about cache entries, including total, valid, and expired entries.
   */
  getStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;

    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > entry.ttl) {
        expiredEntries++;
      } else {
        validEntries++;
      }
    }

    return {
      totalEntries: this.cache.size,
      validEntries,
      expiredEntries,
    };
  }
}

// Global cache instance
const slackCache = new SlackCache();

// Cache configuration for different API operations
const CACHE_CONFIG = {
  // Channel data - cache for 30 minutes
  channels: {
    list: 30 * 60 * 1000,
  },
  // Messages - cache for 5 minutes
  messages: {
    history: 5 * 60 * 1000,
  },
  // Team info - cache for 1 hour
  team: {
    info: 60 * 60 * 1000,
  },
  // User data - cache for 1 hour
  users: {
    list: 60 * 60 * 1000,
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
   * Get cached or fetch fresh data from Slack API.
   */
  private async cachedRequest<T>(
    operation: string,
    params: Record<string, any>,
    ttl: number,
    fetcher: () => Promise<T>
  ): Promise<T> {
    const cacheKey = slackCache.generateKey(
      `${this.userId}:${operation}`,
      params
    );

    // Try to get from cache first
    const cached = slackCache.get<T>(cacheKey);
    if (cached) {
      console.log(`[Slack Cache] Cache hit for ${operation}`);
      return cached;
    }

    console.log(`[Slack Cache] Cache miss for ${operation}, fetching from API`);

    try {
      const data = await fetcher();

      // Store in cache
      slackCache.set(cacheKey, data, ttl);

      return data;
    } catch (error: any) {
      // If it's a rate limit error, try to get cached data even if expired
      if (error.status === 429 || error.message?.includes('rate limit')) {
        console.warn(
          `[Slack Cache] Rate limit hit for ${operation}, trying expired cache`
        );
        const expiredCache = slackCache.get<T>(cacheKey);
        if (expiredCache) {
          return expiredCache;
        }
      }
      throw error;
    }
  }

  /**
   * Retrieves the workspace channels with caching.
   */
  async getChannels(): Promise<SlackChannel[]> {
    return this.cachedRequest(
      'channels.list',
      { userId: this.userId },
      CACHE_CONFIG.channels.list,
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
   * Get channel message history with caching
   */
  async getChannelHistory(
    channelId: string,
    limit: number = 20
  ): Promise<SlackMessage[]> {
    return this.cachedRequest(
      'messages.history',
      { channelId, limit },
      CACHE_CONFIG.messages.history,
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
   * Get team/workspace information with caching
   */
  async getTeamInfo(): Promise<any> {
    return this.cachedRequest(
      'team.info',
      { userId: this.userId },
      CACHE_CONFIG.team.info,
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
   * Get workspace users with caching
   */
  async getUsers(): Promise<SlackUser[]> {
    return this.cachedRequest(
      'users.list',
      { userId: this.userId },
      CACHE_CONFIG.users.list,
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
  bypassCache: boolean = false
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
  limit: number = 10
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
  return !!connection;
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
   * Get cache statistics
   */
  getStats: () => slackCache.getStats(),

  /**
   * Clear in-memory cache
   */
  clearMemoryCache: () => slackCache.clear(),

  /**
   * Clear database cache
   */
  clearDatabaseCache: () => DatabaseCache.clearExpiredCache(),

  /**
   * Clear all cache for a user
   */
  clearUserCache: (userId: string) => DatabaseCache.clearUserCache(userId),

  /**
   * Clear all caches
   */
  clearAllCaches: async (userId?: string) => {
    slackCache.clear();
    if (userId) {
      await DatabaseCache.clearUserCache(userId);
    } else {
      await DatabaseCache.clearExpiredCache();
    }
  },
};
