import { RedisCache, CacheKeyGenerator } from './redis';

/**
 * Cache invalidation service for real-time updates and smart invalidation
 */
export class CacheInvalidationService {
  /**
   * Invalidate all cache entries for a specific user
   */
  static async invalidateUser(userId: string): Promise<number> {
    try {
      console.log(`Invalidating all cache for user: ${userId}`);

      const pattern = `unifiedhq:user:${userId}:*`;
      const deletedCount = await RedisCache.deleteByPattern(pattern);

      console.log(
        `Invalidated ${deletedCount} cache entries for user: ${userId}`
      );
      return deletedCount;
    } catch (error) {
      console.error(`Failed to invalidate user cache for ${userId}:`, error);
      return 0;
    }
  }

  /**
   * Invalidate GitHub-related cache for a user
   */
  static async invalidateGitHubData(
    userId: string,
    repository?: string
  ): Promise<number> {
    try {
      let pattern: string;

      if (repository) {
        // Invalidate specific repository data
        pattern = `unifiedhq:github:${userId}:*:${repository}:*`;
        console.log(
          `Invalidating GitHub cache for user ${userId}, repository: ${repository}`
        );
      } else {
        // Invalidate all GitHub data for user
        pattern = `unifiedhq:github:${userId}:*`;
        console.log(`Invalidating all GitHub cache for user: ${userId}`);
      }

      const deletedCount = await RedisCache.deleteByPattern(pattern);

      // Also invalidate related API cache entries
      const apiPattern = `unifiedhq:api:github:${userId}:*`;
      const apiDeletedCount = await RedisCache.deleteByPattern(apiPattern);

      const totalDeleted = deletedCount + apiDeletedCount;
      console.log(
        `Invalidated ${totalDeleted} GitHub cache entries for user: ${userId}`
      );
      return totalDeleted;
    } catch (error) {
      console.error(`Failed to invalidate GitHub cache for ${userId}:`, error);
      return 0;
    }
  }

  /**
   * Invalidate Slack-related cache for a user
   */
  static async invalidateSlackData(
    userId: string,
    channel?: string
  ): Promise<number> {
    try {
      let pattern: string;

      if (channel) {
        // Invalidate specific channel data
        pattern = `unifiedhq:slack:${userId}:*:${channel}:*`;
        console.log(
          `Invalidating Slack cache for user ${userId}, channel: ${channel}`
        );
      } else {
        // Invalidate all Slack data for user
        pattern = `unifiedhq:slack:${userId}:*`;
        console.log(`Invalidating all Slack cache for user: ${userId}`);
      }

      const deletedCount = await RedisCache.deleteByPattern(pattern);

      // Also invalidate related API cache entries
      const apiPattern = `unifiedhq:api:slack:${userId}:*`;
      const apiDeletedCount = await RedisCache.deleteByPattern(apiPattern);

      const totalDeleted = deletedCount + apiDeletedCount;
      console.log(
        `Invalidated ${totalDeleted} Slack cache entries for user: ${userId}`
      );
      return totalDeleted;
    } catch (error) {
      console.error(`Failed to invalidate Slack cache for ${userId}:`, error);
      return 0;
    }
  }

  /**
   * Invalidate AI summary cache for a user
   */
  static async invalidateAISummary(
    userId: string,
    date?: string
  ): Promise<number> {
    try {
      let pattern: string;

      if (date) {
        // Invalidate specific date summary
        pattern = `unifiedhq:ai:${userId}:*:${date}:*`;
        console.log(
          `Invalidating AI summary cache for user ${userId}, date: ${date}`
        );
      } else {
        // Invalidate all AI summaries for user
        pattern = `unifiedhq:ai:${userId}:*`;
        console.log(`Invalidating all AI summary cache for user: ${userId}`);
      }

      const deletedCount = await RedisCache.deleteByPattern(pattern);

      console.log(
        `Invalidated ${deletedCount} AI summary cache entries for user: ${userId}`
      );
      return deletedCount;
    } catch (error) {
      console.error(
        `Failed to invalidate AI summary cache for ${userId}:`,
        error
      );
      return 0;
    }
  }

  /**
   * Invalidate API response cache by endpoint pattern
   */
  static async invalidateAPICache(
    endpoint: string,
    ...params: string[]
  ): Promise<number> {
    try {
      const pattern = `unifiedhq:api:${endpoint}:${params.join(':')}:*`;
      console.log(`Invalidating API cache for pattern: ${pattern}`);

      const deletedCount = await RedisCache.deleteByPattern(pattern);

      console.log(
        `Invalidated ${deletedCount} API cache entries for endpoint: ${endpoint}`
      );
      return deletedCount;
    } catch (error) {
      console.error(`Failed to invalidate API cache for ${endpoint}:`, error);
      return 0;
    }
  }

  /**
   * Smart invalidation based on data relationships
   * When one type of data changes, invalidate related cached data
   */
  static async smartInvalidation(
    changeType: 'github' | 'slack' | 'user' | 'ai',
    userId: string,
    context?: {
      repository?: string;
      channel?: string;
      date?: string;
      affectedUsers?: string[];
    }
  ): Promise<number> {
    try {
      console.log(
        `Starting smart invalidation for ${changeType} change, user: ${userId}`
      );

      let totalInvalidated = 0;

      switch (changeType) {
        case 'github':
          // Invalidate GitHub data
          totalInvalidated += await this.invalidateGitHubData(
            userId,
            context?.repository
          );

          // Invalidate AI summaries that might include this GitHub data
          totalInvalidated += await this.invalidateAISummary(userId);

          // Invalidate team activity cache that might include this user's GitHub activity
          totalInvalidated += await this.invalidateAPICache(
            'team-activity',
            userId
          );

          // If repository is specified, invalidate repository-specific caches
          if (context?.repository) {
            totalInvalidated += await this.invalidateAPICache(
              'github',
              'repository',
              context.repository
            );
          }
          break;

        case 'slack':
          // Invalidate Slack data
          totalInvalidated += await this.invalidateSlackData(
            userId,
            context?.channel
          );

          // Invalidate AI summaries that might include this Slack data
          totalInvalidated += await this.invalidateAISummary(userId);

          // Invalidate team activity cache
          totalInvalidated += await this.invalidateAPICache(
            'team-activity',
            userId
          );

          // If channel is specified, invalidate channel-specific caches for all affected users
          if (context?.channel && context?.affectedUsers) {
            for (const affectedUserId of context.affectedUsers) {
              totalInvalidated += await this.invalidateSlackData(
                affectedUserId,
                context.channel
              );
            }
          }
          break;

        case 'user':
          // Invalidate all user-related data
          totalInvalidated += await this.invalidateUser(userId);

          // Invalidate team-level caches that might include this user
          totalInvalidated += await this.invalidateAPICache('team-stats');
          totalInvalidated += await this.invalidateAPICache('team-members');
          break;

        case 'ai':
          // Invalidate AI summary data
          totalInvalidated += await this.invalidateAISummary(
            userId,
            context?.date
          );

          // Invalidate dashboard caches that display AI summaries
          totalInvalidated += await this.invalidateAPICache(
            'dashboard',
            userId
          );
          break;

        default:
          console.warn(
            `Unknown change type for smart invalidation: ${changeType}`
          );
      }

      console.log(
        `Smart invalidation completed. Total entries invalidated: ${totalInvalidated}`
      );
      return totalInvalidated;
    } catch (error) {
      console.error(`Smart invalidation failed for ${changeType}:`, error);
      return 0;
    }
  }

  /**
   * Invalidate cache by tags (using key patterns)
   */
  static async invalidateByTags(tags: string[]): Promise<number> {
    try {
      console.log(`Invalidating cache by tags: ${tags.join(', ')}`);

      let totalInvalidated = 0;

      for (const tag of tags) {
        // Create pattern to match keys containing the tag
        const pattern = `*:${tag}:*`;
        const deletedCount = await RedisCache.deleteByPattern(pattern);
        totalInvalidated += deletedCount;

        console.log(`Invalidated ${deletedCount} entries for tag: ${tag}`);
      }

      console.log(`Total entries invalidated by tags: ${totalInvalidated}`);
      return totalInvalidated;
    } catch (error) {
      console.error("Failed to invalidate cache by tags:", error);
      return 0;
    }
  }

  /**
   * Selective invalidation for real-time updates
   * Only invalidates specific cache entries that need immediate updates
   */
  static async realtimeInvalidation(
    updateType: 'commit' | 'pr' | 'issue' | 'message' | 'channel' | 'summary',
    userId: string,
    resourceId: string
  ): Promise<number> {
    try {
      console.log(
        `Real-time invalidation for ${updateType}, user: ${userId}, resource: ${resourceId}`
      );

      let totalInvalidated = 0;

      switch (updateType) {
        case 'commit':
          // Invalidate specific repository commit cache
          totalInvalidated += await RedisCache.deleteByPattern(
            `unifiedhq:github:${userId}:commits:${resourceId}:*`
          );
          // Invalidate repository activity summary
          totalInvalidated += await RedisCache.deleteByPattern(
            `unifiedhq:github:${userId}:activity:${resourceId}:*`
          );
          break;

        case 'pr':
          // Invalidate pull request cache
          totalInvalidated += await RedisCache.deleteByPattern(
            `unifiedhq:github:${userId}:prs:${resourceId}:*`
          );
          // Invalidate repository activity summary
          totalInvalidated += await RedisCache.deleteByPattern(
            `unifiedhq:github:${userId}:activity:${resourceId}:*`
          );
          break;

        case 'issue':
          // Invalidate issues cache
          totalInvalidated += await RedisCache.deleteByPattern(
            `unifiedhq:github:${userId}:issues:${resourceId}:*`
          );
          break;

        case 'message':
          // Invalidate specific channel messages cache
          totalInvalidated += await RedisCache.deleteByPattern(
            `unifiedhq:slack:${userId}:messages:${resourceId}:*`
          );
          break;

        case 'channel':
          // Invalidate channel-specific cache
          totalInvalidated += await RedisCache.deleteByPattern(
            `unifiedhq:slack:${userId}:*:${resourceId}:*`
          );
          break;

        case 'summary':
          // Invalidate specific AI summary
          const summaryKey = CacheKeyGenerator.aiSummary(
            userId,
            'daily',
            resourceId
          );
          const deleted = await RedisCache.del(summaryKey);
          totalInvalidated += deleted ? 1 : 0;
          break;

        default:
          console.warn(
            `Unknown update type for real-time invalidation: ${updateType}`
          );
      }

      console.log(
        `Real-time invalidation completed. Entries invalidated: ${totalInvalidated}`
      );
      return totalInvalidated;
    } catch (error) {
      console.error(`Real-time invalidation failed for ${updateType}:`, error);
      return 0;
    }
  }

  /**
   * Batch invalidation for multiple cache entries
   */
  static async batchInvalidation(
    invalidations: Array<{
      type: 'user' | 'github' | 'slack' | 'ai' | 'api' | 'pattern';
      userId?: string;
      pattern?: string;
      context?: any;
    }>
  ): Promise<number> {
    try {
      console.log(
        `Starting batch invalidation for ${invalidations.length} operations`
      );

      let totalInvalidated = 0;

      // Process invalidations in parallel for better performance
      const results = await Promise.allSettled(
        invalidations.map(async invalidation => {
          switch (invalidation.type) {
            case 'user':
              return invalidation.userId
                ? await this.invalidateUser(invalidation.userId)
                : 0;
            case 'github':
              return invalidation.userId
                ? await this.invalidateGitHubData(
                    invalidation.userId,
                    invalidation.context?.repository
                  )
                : 0;
            case 'slack':
              return invalidation.userId
                ? await this.invalidateSlackData(
                    invalidation.userId,
                    invalidation.context?.channel
                  )
                : 0;
            case 'ai':
              return invalidation.userId
                ? await this.invalidateAISummary(
                    invalidation.userId,
                    invalidation.context?.date
                  )
                : 0;
            case 'api':
              return invalidation.context?.endpoint
                ? await this.invalidateAPICache(
                    invalidation.context.endpoint,
                    ...(invalidation.context.params || [])
                  )
                : 0;
            case 'pattern':
              return invalidation.pattern
                ? await RedisCache.deleteByPattern(invalidation.pattern)
                : 0;
            default:
              return 0;
          }
        })
      );

      // Sum up successful results
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          totalInvalidated += result.value;
        } else {
          console.error(
            `Batch invalidation failed for operation ${index}:`,
            result.reason
          );
        }
      });

      console.log(
        `Batch invalidation completed. Total entries invalidated: ${totalInvalidated}`
      );
      return totalInvalidated;
    } catch (error) {
      console.error('Batch invalidation failed:', error);
      return 0;
    }
  }
}
