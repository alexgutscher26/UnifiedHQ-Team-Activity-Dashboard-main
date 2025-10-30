import { describe, test, expect } from '@jest/globals';

describe('GitHub Cache Integration', () => {
  test('should import GitHubCacheManager without errors', async () => {
    const { GitHubCacheManager } = await import(
      '../integrations/github-cached'
    );

    expect(GitHubCacheManager).toBeDefined();
    expect(typeof GitHubCacheManager.getStats).toBe('function');
    expect(typeof GitHubCacheManager.clearMemoryCache).toBe('function');
    expect(typeof GitHubCacheManager.clearAllCaches).toBe('function');
  });

  test('should import GitHubCacheWarming without errors', async () => {
    const { GitHubCacheWarming } = await import(
      '../integrations/github-cached'
    );

    expect(GitHubCacheWarming).toBeDefined();
    expect(typeof GitHubCacheWarming.warmUserRepositories).toBe('function');
    expect(typeof GitHubCacheWarming.warmFrequentRepositories).toBe('function');
    expect(typeof GitHubCacheWarming.scheduleRepositoryWarming).toBe(
      'function'
    );
  });

  test('should provide cache statistics', async () => {
    const { GitHubCacheManager } = await import(
      '../integrations/github-cached'
    );

    const stats = GitHubCacheManager.getStats();

    expect(stats).toBeDefined();
    expect(typeof stats.totalEntries).toBe('number');
    expect(typeof stats.validEntries).toBe('number');
    expect(typeof stats.expiredEntries).toBe('number');
  });

  test('should clear memory cache without errors', async () => {
    const { GitHubCacheManager } = await import(
      '../integrations/github-cached'
    );

    expect(() => GitHubCacheManager.clearMemoryCache()).not.toThrow();
  });

  test('should generate correct cache keys', async () => {
    const { CacheKeyGenerator } = await import('../redis');

    const key = CacheKeyGenerator.github('user123', 'repositories', 'params');
    expect(key).toBe('unifiedhq:github:user123:repositories:params');
  });

  test('should use appropriate TTL values for GitHub data', async () => {
    const { TTLManager } = await import('../redis');

    const reposTTL = TTLManager.getTTL('GITHUB_REPOS');
    const commitsTTL = TTLManager.getTTL('GITHUB_COMMITS');
    const prsTTL = TTLManager.getTTL('GITHUB_PRS');

    expect(typeof reposTTL).toBe('number');
    expect(typeof commitsTTL).toBe('number');
    expect(typeof prsTTL).toBe('number');

    expect(reposTTL).toBeGreaterThan(0);
    expect(commitsTTL).toBeGreaterThan(0);
    expect(prsTTL).toBeGreaterThan(0);
  });
});
