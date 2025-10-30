/**
 * GitHub Cache Warming Service
 *
 * This service provides cache warming functionality for GitHub integration endpoints.
 * It pre-loads frequently accessed data into Redis cache to improve response times.
 */

import { GitHubCacheWarming } from './integrations/github-cached';

/**
 * Schedule cache warming for all users with GitHub connections
 */
export async function scheduleGlobalCacheWarming(): Promise<void> {
  try {
    console.log(
      '[GitHub Cache Warming] Starting global cache warming schedule'
    );

    // Warm frequently accessed repositories
    await GitHubCacheWarming.warmFrequentRepositories();

    console.log('[GitHub Cache Warming] Global cache warming completed');
  } catch (error) {
    console.error('[GitHub Cache Warming] Global cache warming failed:', error);
  }
}

/**
 * Schedule cache warming for a specific user
 */
export async function scheduleUserCacheWarming(userId: string): Promise<void> {
  try {
    console.log(
      `[GitHub Cache Warming] Starting cache warming for user: ${userId}`
    );

    await GitHubCacheWarming.warmUserRepositories(userId);

    console.log(
      `[GitHub Cache Warming] User cache warming completed for: ${userId}`
    );
  } catch (error) {
    console.error(
      `[GitHub Cache Warming] User cache warming failed for ${userId}:`,
      error
    );
  }
}

/**
 * Initialize cache warming intervals (for production use)
 */
export function initializeCacheWarmingSchedule(): void {
  // Warm frequently accessed repositories every 30 minutes
  setInterval(
    async () => {
      await scheduleGlobalCacheWarming();
    },
    30 * 60 * 1000
  );

  console.log('[GitHub Cache Warming] Cache warming schedule initialized');
}

export { GitHubCacheWarming };
