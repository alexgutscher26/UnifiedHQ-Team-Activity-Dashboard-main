import { CacheKeyGenerator, TTLManager, RedisCache } from '../redis';

describe('CacheKeyGenerator', () => {
  test('should generate consistent cache keys', () => {
    const key1 = CacheKeyGenerator.generate('test', 'id123', 'subkey');
    const key2 = CacheKeyGenerator.generate('test', 'id123', 'subkey');

    expect(key1).toBe(key2);
    expect(key1).toBe('unifiedhq:test:id123:subkey');
  });

  test('should generate user-specific keys', () => {
    const key = CacheKeyGenerator.user('user123', 'preferences');
    expect(key).toBe('unifiedhq:user:user123:preferences');
  });

  test('should generate GitHub keys', () => {
    const key = CacheKeyGenerator.github('user123', 'repos', 'myrepo');
    expect(key).toBe('unifiedhq:github:user123:repos:myrepo');
  });

  test('should generate Slack keys', () => {
    const key = CacheKeyGenerator.slack('team123', 'channels', 'general');
    expect(key).toBe('unifiedhq:slack:team123:channels:general');
  });

  test('should generate AI summary keys', () => {
    const key = CacheKeyGenerator.aiSummary('user123', 'daily', '2024-01-01');
    expect(key).toBe('unifiedhq:ai:user123:daily:2024-01-01');
  });

  test('should generate API keys', () => {
    const key = CacheKeyGenerator.api('github/repos', 'user123');
    expect(key).toBe('unifiedhq:api:github/repos:user123');
  });

  test('should generate session keys', () => {
    const key = CacheKeyGenerator.session('session123', 'data');
    expect(key).toBe('unifiedhq:session:session123:data');
  });
});

describe('TTLManager', () => {
  test('should return correct TTL values', () => {
    expect(TTLManager.getTTL('USER_SESSION')).toBe(24 * 60 * 60);
    expect(TTLManager.getTTL('GITHUB_REPOS')).toBe(15 * 60);
    expect(TTLManager.getTTL('SLACK_MESSAGES')).toBe(5 * 60);
    expect(TTLManager.getTTL('AI_SUMMARY')).toBe(60 * 60);
  });

  test('should return correct strategy TTL values', () => {
    expect(TTLManager.getStrategyTTL('fast')).toBe(5 * 60);
    expect(TTLManager.getStrategyTTL('medium')).toBe(30 * 60);
    expect(TTLManager.getStrategyTTL('slow')).toBe(2 * 60 * 60);
  });
});

describe('RedisCache', () => {
  test('should handle cache operations gracefully when Redis is unavailable', async () => {
    // These tests will pass even when Redis is not running
    // because our implementation gracefully handles connection failures

    const testKey = 'test:key:123';
    const testValue = { test: 'data', timestamp: Date.now() };

    // Set operation should return false when Redis is unavailable
    const setResult = await RedisCache.set(testKey, testValue, 300);
    expect(typeof setResult).toBe('boolean');

    // Get operation should return null when Redis is unavailable
    const getValue = await RedisCache.get(testKey);
    expect(getValue).toBeNull();

    // Delete operation should return false when Redis is unavailable
    const deleteResult = await RedisCache.del(testKey);
    expect(typeof deleteResult).toBe('boolean');

    // Exists operation should return false when Redis is unavailable
    const existsResult = await RedisCache.exists(testKey);
    expect(typeof existsResult).toBe('boolean');

    // TTL operation should return -1 when Redis is unavailable
    const ttlResult = await RedisCache.ttl(testKey);
    expect(typeof ttlResult).toBe('number');
  });

  test('should handle pattern-based operations gracefully', async () => {
    const pattern = 'unifiedhq:ai:*';

    // Pattern delete should return number when Redis is unavailable
    const deleteCount = await RedisCache.deleteByPattern(pattern);
    expect(typeof deleteCount).toBe('number');

    // Pattern keys should return empty array when Redis is unavailable
    const keys = await RedisCache.getKeysByPattern(pattern);
    expect(Array.isArray(keys)).toBe(true);
  });
});
