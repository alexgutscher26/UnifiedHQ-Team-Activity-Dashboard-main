# Rate Limiting System

UnifiedHQ implements a comprehensive Redis-based rate limiting system with fallback to in-memory storage. The system uses a sliding window algorithm for accurate rate limiting and supports different configurations for various endpoint types.

## Features

- **Redis-based distributed rate limiting** with in-memory fallback
- **Sliding window algorithm** for accurate rate limiting
- **Multiple rate limit configurations** for different endpoint types
- **Automatic fallback** when Redis is unavailable
- **Rate limit headers** in API responses
- **Comprehensive middleware** integration

## Rate Limit Configurations

### Default Rate Limiters

| Limiter | Window | Max Requests | Use Case |
|---------|--------|--------------|----------|
| `API` | 15 minutes | 100 | General API endpoints |
| `STRICT` | 15 minutes | 20 | Sensitive operations |
| `AUTH` | 15 minutes | 5 | Authentication endpoints |
| `INTEGRATION_SYNC` | 1 hour | 10 | GitHub/Slack sync operations |
| `AI_GENERATION` | 1 hour | 50 | AI summary generation |
| `UPLOAD` | 1 hour | 100 | File upload endpoints |

### Rate Limit Headers

All API responses include rate limiting headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200000
Retry-After: 300 (only when rate limited)
```

## Usage

### Basic Middleware

```typescript
import { withDefaultMiddleware } from '@/middleware/api-middleware';

async function handler(request: NextRequest) {
  // Your API logic here
  return NextResponse.json({ success: true });
}

export const GET = withDefaultMiddleware(handler);
```

### Custom Rate Limiting

```typescript
import { withCustomRateLimit } from '@/middleware/api-middleware';

export async function POST(request: NextRequest) {
  return withCustomRateLimit(request, handler, 'AI_GENERATION');
}
```

### Manual Rate Limit Check

```typescript
import { RateLimiters, getClientIdentifier } from '@/lib/rate-limiter';

const identifier = getClientIdentifier(request);
const result = await RateLimiters.API.checkLimit(identifier);

if (!result.allowed) {
  return NextResponse.json(
    { error: 'Rate limit exceeded' },
    { status: 429 }
  );
}
```

## API Endpoints

### Check Rate Limit Status

```bash
GET /api/rate-limit/status?type=API
```

Response:
```json
{
  "success": true,
  "rateLimit": {
    "identifier": "user:123",
    "limiterType": "API",
    "allowed": true,
    "limit": 100,
    "remaining": 95,
    "resetTime": 1640995200000,
    "resetTimeFormatted": "2022-01-01T12:00:00.000Z",
    "windowMs": 900000
  }
}
```

### Reset Rate Limit

```bash
DELETE /api/rate-limit/status?type=API
```

### Test Rate Limiting

```bash
# Test default rate limiting
GET /api/rate-limit/test

# Test strict rate limiting
POST /api/rate-limit/test

# Test AI generation rate limiting
PUT /api/rate-limit/test

# Test auth rate limiting
DELETE /api/rate-limit/test
```

## Configuration

### Environment Variables

```env
# Redis configuration (required for distributed rate limiting)
REDIS_URL=redis://localhost:6379

# Rate limiting configuration (optional)
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=900000
API_RATE_LIMIT=1000
API_RATE_WINDOW=900000
```

### Custom Rate Limiter

```typescript
import { RateLimiter } from '@/lib/rate-limiter';

const customLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,
  keyGenerator: (id: string) => `custom:${id}`,
});

const result = await customLimiter.checkLimit('user123');
```

## Middleware Configurations

### Predefined Configurations

```typescript
import { MiddlewareConfigs } from '@/middleware/api-middleware';

// Standard API endpoint
export const GET = withApiMiddleware(handler, MiddlewareConfigs.DEFAULT);

// Public endpoint (no rate limiting)
export const GET = withApiMiddleware(handler, MiddlewareConfigs.PUBLIC);

// Strict endpoint (enhanced security)
export const GET = withApiMiddleware(handler, MiddlewareConfigs.STRICT);

// Internal endpoint (minimal middleware)
export const GET = withApiMiddleware(handler, MiddlewareConfigs.INTERNAL);
```

### Custom Configuration

```typescript
export const GET = withApiMiddleware(handler, {
  enableRateLimit: true,
  enableCors: true,
  enableSecurityHeaders: true,
  enableLogging: false,
  enableRequestId: true,
});
```

## Special Middleware

### SSE Endpoints

```typescript
import { withSSEMiddleware } from '@/middleware/api-middleware';

export const GET = withSSEMiddleware(handler);
```

### Webhook Endpoints

```typescript
import { withWebhookMiddleware } from '@/middleware/api-middleware';

export const POST = withWebhookMiddleware(handler, {
  verifySignature: true
});
```

## Error Handling

When rate limits are exceeded, the API returns:

```json
{
  "success": false,
  "error": {
    "type": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later.",
    "code": "RATE_LIMIT_EXCEEDED",
    "statusCode": 429,
    "retryAfter": 300
  }
}
```

## Monitoring

### Rate Limit Metrics

The system provides comprehensive logging for monitoring:

```
Rate limiter: user:123 - API limit check: 95/100 remaining
Rate limiter: ip:192.168.1.1 - STRICT limit exceeded: 0/20 remaining
```

### Redis Fallback

When Redis is unavailable, the system automatically falls back to in-memory rate limiting:

```
Redis rate limiter failed, using fallback: Connection refused
```

## Best Practices

1. **Use appropriate rate limiters** for different endpoint types
2. **Monitor rate limit usage** through logs and metrics
3. **Set up Redis** for production environments
4. **Configure alerts** for rate limit violations
5. **Test rate limiting** in development environments
6. **Document rate limits** for API consumers

## Troubleshooting

### Common Issues

1. **Redis Connection Issues**
   - Check Redis URL configuration
   - Verify Redis server is running
   - System falls back to in-memory limiting

2. **Rate Limits Too Strict**
   - Adjust rate limit configurations
   - Use appropriate rate limiter types
   - Consider user-specific limits

3. **Performance Impact**
   - Redis operations are optimized
   - In-memory fallback for edge cases
   - Minimal overhead on API responses

### Debug Mode

Enable debug logging:

```env
DEBUG=true
NEXT_PUBLIC_DEBUG=true
```

This will provide detailed rate limiting logs for troubleshooting.