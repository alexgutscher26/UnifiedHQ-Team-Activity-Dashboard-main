# AI Summary Caching Implementation

This document describes the Redis caching implementation for AI summary endpoints in UnifiedHQ.

## Overview

The AI summary caching system provides:
- **Redis caching** for OpenAI/OpenRouter API responses
- **Manual cache invalidation** for summary regeneration
- **Cache warming** for scheduled summary generation
- **Performance monitoring** and statistics

## Features Implemented

### 1. Redis Caching for AI Responses

#### AISummaryService Caching
- Automatic caching of generated AI summaries with 1-hour TTL
- Cache key generation based on user ID, time range, and activity data hash
- Configurable cache options: `useCache` and `forceRegenerate`

```typescript
// Generate summary with caching
const summary = await AISummaryService.generateSummary(
  userId,
  summaryData,
  { useCache: true, forceRegenerate: false }
);
```

#### OpenRouter API Caching
- Direct caching of OpenRouter API responses
- Cache key based on prompt, model, and parameters
- Configurable via API parameters

```typescript
// POST /api/openrouter
{
  "prompt": "Your prompt here",
  "model": "gpt-3.5-turbo",
  "useCache": true,
  "forceRegenerate": false
}
```

### 2. Manual Cache Invalidation

#### Cache Management API
- `GET /api/ai-summary/cache` - Get cache statistics
- `DELETE /api/ai-summary/cache?scope=user` - Invalidate user cache
- `DELETE /api/ai-summary/cache?scope=all` - Invalidate all caches

#### Service Methods
```typescript
// Invalidate specific user cache
await AISummaryService.invalidateUserCache(userId);

// Invalidate all AI summary caches
await AISummaryService.invalidateAllCache();
```

### 3. Cache Warming for Scheduled Generation

#### Automatic Warming
- Cron jobs automatically warm cache before processing users
- Pre-loads activity data for faster summary generation

#### Manual Warming
```typescript
// POST /api/ai-summary/cache/warm
{
  "userIds": ["user1", "user2"],
  "warmCurrentUser": true
}
```

#### Service Method
```typescript
// Warm cache for multiple users
await AISummaryService.warmCacheForUsers(userIds);
```

## Cache Configuration

### TTL Settings
- **AI Summaries**: 1 hour (3600 seconds)
- **OpenRouter Responses**: 1 hour (3600 seconds)
- **Activity Data**: Configurable per endpoint

### Cache Keys
- AI Summaries: `unifiedhq:ai:{userId}:summary:{timeRange}:{activityHash}`
- OpenRouter: `unifiedhq:openrouter:response:{paramHash}`
- Activity Data: `unifiedhq:user:{userId}:activity_data`

## Performance Benefits

### Response Time Improvements
- **Cache Hit**: ~50ms response time
- **Cache Miss**: ~2-5s response time (API call + processing)
- **Cache Hit Rate**: Expected 70-80% for repeated requests

### Cost Optimization
- Reduces OpenAI/OpenRouter API calls by 70-80%
- Prevents duplicate processing for identical requests
- Optimizes token usage through intelligent caching

## Monitoring and Statistics

### Cache Statistics API
```typescript
// GET /api/ai-summary/cache
{
  "success": true,
  "stats": {
    "totalKeys": 150,
    "userCaches": {
      "user123": 5,
      "user456": 3
    }
  }
}
```

### Service Statistics
```typescript
const stats = await AISummaryService.getCacheStats();
console.log(`Total cached summaries: ${stats.totalKeys}`);
```

## Integration Points

### API Routes
- `/api/ai-summary` - Main summary endpoint with caching
- `/api/ai-summary/background` - Background job with caching
- `/api/ai-summary/cron` - Scheduled job with cache warming
- `/api/openrouter` - Direct OpenRouter API with caching

### Cache Middleware
- Automatic HTTP response caching for API endpoints
- Cache-Control headers for browser caching
- ETag support for conditional requests

## Error Handling

### Redis Unavailable
- Graceful degradation when Redis is not available
- Automatic fallback to direct API calls
- No service interruption

### Cache Errors
- Automatic retry logic for transient failures
- Error logging for monitoring
- Fallback to fresh generation

## Testing

### Unit Tests
- Cache key generation consistency
- Cache invalidation functionality
- Error handling scenarios
- Statistics calculation

### Integration Tests
- End-to-end caching workflow
- Cache warming effectiveness
- Performance impact measurement

## Usage Examples

### Basic Summary Generation
```typescript
// With caching (default)
const summary = await AISummaryService.generateSummary(userId, data);

// Force regeneration
const freshSummary = await AISummaryService.generateSummary(
  userId, 
  data, 
  { forceRegenerate: true }
);
```

### Cache Management
```typescript
// Invalidate user cache before regeneration
await AISummaryService.invalidateUserCache(userId);
const newSummary = await AISummaryService.generateSummary(userId, data);

// Warm cache before batch processing
await AISummaryService.warmCacheForUsers(userIds);
```

### API Usage
```bash
# Get cache statistics
curl -X GET /api/ai-summary/cache

# Invalidate user cache
curl -X DELETE /api/ai-summary/cache?scope=user

# Warm cache
curl -X POST /api/ai-summary/cache/warm \
  -d '{"userIds": ["user123"], "warmCurrentUser": true}'
```

## Configuration

### Environment Variables
- `REDIS_URL` - Redis connection string
- `OPENROUTER_API_KEY` - OpenRouter API key
- `CACHE_SKIP_AUTH` - Skip cache for authenticated requests in development

### Cache Settings
- Modify TTL values in `TTLManager.TTL`
- Configure cache strategies in `ROUTE_CACHE_CONFIGS`
- Adjust cache warming intervals in cron jobs

## Best Practices

1. **Use caching by default** for all AI summary operations
2. **Invalidate cache** when underlying data changes significantly
3. **Monitor cache hit rates** to optimize performance
4. **Warm cache** before scheduled batch operations
5. **Handle Redis failures** gracefully with fallbacks