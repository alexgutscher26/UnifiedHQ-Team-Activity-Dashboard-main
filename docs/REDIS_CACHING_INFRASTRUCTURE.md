# Redis Caching Infrastructure

This document describes the Redis caching infrastructure implemented for UnifiedHQ, providing comprehensive caching capabilities with intelligent TTL management, connection pooling, and monitoring.

## Overview

The Redis infrastructure provides:
- **Connection pooling** with automatic retry logic
- **Consistent cache key generation** with namespacing
- **TTL management system** for different data types
- **Health check and monitoring** endpoints
- **Cache warming utilities** for performance optimization
- **Graceful degradation** when Redis is unavailable

## Components

### 1. Redis Client Configuration (`src/lib/redis.ts`)

Enhanced Redis client with:
- Connection pooling (min: 2, max: 10 connections)
- Automatic reconnection with exponential backoff
- Graceful error handling and logging
- Environment-aware connection management

### 2. Cache Key Generator

Provides consistent cache key generation with namespacing:

```typescript
// User-specific data
CacheKeyGenerator.user('user123', 'preferences')
// → 'unifiedhq:user:user123:preferences'

// GitHub integration data
CacheKeyGenerator.github('user123', 'repos', 'myrepo')
// → 'unifiedhq:github:user123:repos:myrepo'

// Slack integration data
CacheKeyGenerator.slack('team123', 'channels', 'general')
// → 'unifiedhq:slack:team123:channels:general'

// AI summary data
CacheKeyGenerator.aiSummary('user123', 'daily', '2024-01-01')
// → 'unifiedhq:ai:user123:daily:2024-01-01'
```

### 3. TTL Management System

Intelligent TTL management for different data types:

- **User Sessions**: 24 hours
- **GitHub Data**: 15 minutes (repos), 10 minutes (issues/PRs)
- **Slack Data**: 5 minutes (messages), 30 minutes (channels)
- **AI Summaries**: 1 hour
- **API Responses**: 5 minutes (fast), 30 minutes (medium), 2 hours (slow)

### 4. Redis Cache Service

Comprehensive CRUD operations with error handling:

```typescript
// Set with TTL
await RedisCache.set(key, value, TTLManager.getTTL('GITHUB_REPOS'));

// Get cached value
const data = await RedisCache.get<MyDataType>(key);

// Delete cache entry
await RedisCache.del(key);

// Check existence
const exists = await RedisCache.exists(key);

// Pattern-based operations
await RedisCache.deleteByPattern('unifiedhq:user:*');
await RedisCache.invalidateByTag('github');
```

## API Endpoints

### Health Check: `/api/health/redis`

Comprehensive Redis health monitoring:
- Connection status and latency
- Memory usage statistics
- Server metrics and version info
- Basic operation testing

### Cache Statistics: `/api/cache/stats`

Detailed cache analytics:
- Redis server information
- Memory usage breakdown
- Performance metrics
- Cache hit rates
- Namespace-based statistics

### Cache Management: `/api/cache/manage`

Cache administration operations:
- Get cache entries by key or pattern
- Delete cache entries
- Set cache values with TTL
- Flush cache namespaces

## Cache Warming

Intelligent cache preloading for improved performance:

```typescript
// Warm cache for user session
await CacheWarming.warmUserSession('user123', {
  repositories: ['repo1', 'repo2'],
  channels: ['general', 'dev'],
  commonEndpoints: ['/api/dashboard', '/api/activity']
});

// Background refresh for expiring entries
await CacheWarming.refreshExpiringCache(300); // 5 minutes threshold
```

## Environment Configuration

Required environment variables:

```bash
# Redis connection string
REDIS_URL=redis://localhost:6379

# Optional: Redis connection settings
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-password
```

## Usage Examples

### Basic Caching

```typescript
import { RedisCache, CacheKeyGenerator, TTLManager } from '@/lib/redis';

// Cache user preferences
const key = CacheKeyGenerator.user(userId, 'preferences');
await RedisCache.set(key, userPrefs, TTLManager.getTTL('USER_SESSION'));

// Retrieve cached preferences
const cachedPrefs = await RedisCache.get(key);
```

### Integration-Specific Caching

```typescript
// Cache GitHub repository data
const repoKey = CacheKeyGenerator.github(userId, 'repos');
await RedisCache.set(repoKey, repositories, TTLManager.getTTL('GITHUB_REPOS'));

// Cache Slack messages
const msgKey = CacheKeyGenerator.slack(teamId, 'messages', channelId);
await RedisCache.set(msgKey, messages, TTLManager.getTTL('SLACK_MESSAGES'));
```

### Cache Invalidation

```typescript
// Invalidate user-specific cache
await RedisCache.deleteByPattern(`unifiedhq:user:${userId}:*`);

// Invalidate by integration
await RedisCache.invalidateByTag('github');
```

## Monitoring and Debugging

### Health Checks

Monitor Redis health via `/api/health/redis`:
- Connection status
- Response latency
- Memory usage
- Server metrics

### Cache Statistics

View cache performance via `/api/cache/stats`:
- Hit/miss rates
- Memory utilization
- Key distribution by namespace
- Performance metrics

### Logging

Redis operations are logged with appropriate levels:
- Connection events (info)
- Operation errors (error)
- Availability warnings (warn)

## Error Handling

The Redis infrastructure gracefully handles:
- **Connection failures**: Operations return appropriate defaults
- **Memory limits**: LRU eviction with monitoring
- **Network issues**: Automatic retry with exponential backoff
- **Build-time errors**: No connection attempts during builds/tests

## Performance Considerations

- **Connection pooling** reduces connection overhead
- **Intelligent TTL** balances freshness with performance
- **Pattern-based invalidation** for efficient cache management
- **Background warming** for frequently accessed data
- **Graceful degradation** ensures application availability

## Testing

Comprehensive test suite covers:
- Cache key generation consistency
- TTL management accuracy
- CRUD operations with error handling
- Graceful degradation when Redis is unavailable

Run tests:
```bash
bun test src/lib/__tests__/redis.test.ts
```

## Security

- Connection encryption via TLS (production)
- Authentication with Redis AUTH
- Input validation for cache keys and values
- Rate limiting for cache operations