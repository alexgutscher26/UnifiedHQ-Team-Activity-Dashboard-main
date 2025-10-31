/**
 * Redis-based Rate Limiter
 * 
 * Provides distributed rate limiting using Redis with sliding window algorithm
 * and multiple rate limiting strategies.
 */

import { RedisCache } from '@/lib/redis';

export interface RateLimitConfig {
    windowMs: number;        // Time window in milliseconds
    maxRequests: number;     // Maximum requests per window
    keyGenerator?: (identifier: string) => string;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
    message?: string;
    headers?: boolean;
}

export interface RateLimitResult {
    allowed: boolean;
    limit: number;
    remaining: number;
    resetTime: number;
    retryAfter?: number;
}

export class RateLimiter {
    private readonly config: RateLimitConfig;

    constructor(config: RateLimitConfig) {
        this.config = {
            keyGenerator: (id: string) => `rate_limit:${id}`,
            skipSuccessfulRequests: false,
            skipFailedRequests: false,
            message: 'Too many requests',
            headers: true,
            ...config,
        };
    }

    /**
     * Check if request is within rate limit using sliding window algorithm
     */
    async checkLimit(identifier: string): Promise<RateLimitResult> {
        const key = this.config.keyGenerator!(identifier);
        const now = Date.now();
        const windowStart = now - this.config.windowMs;

        try {
            // Use Redis for distributed rate limiting
            const requests = await this.getRequestsInWindow(key, windowStart, now);
            const currentCount = requests.length;

            const result: RateLimitResult = {
                allowed: currentCount < this.config.maxRequests,
                limit: this.config.maxRequests,
                remaining: Math.max(0, this.config.maxRequests - currentCount - 1),
                resetTime: now + this.config.windowMs,
            };

            if (!result.allowed) {
                // Calculate retry after based on oldest request in window
                const oldestRequest = Math.min(...requests);
                result.retryAfter = Math.ceil((oldestRequest + this.config.windowMs - now) / 1000);
            } else {
                // Add current request to the window
                await this.addRequest(key, now, this.config.windowMs);
            }

            return result;
        } catch (error) {
            console.error('Rate limiter error:', error);
            // Fallback to allow request if Redis is unavailable
            return {
                allowed: true,
                limit: this.config.maxRequests,
                remaining: this.config.maxRequests - 1,
                resetTime: now + this.config.windowMs,
            };
        }
    }

    /**
     * Get requests in the current window using Redis sorted sets
     */
    private async getRequestsInWindow(
        key: string,
        windowStart: number,
        windowEnd: number
    ): Promise<number[]> {
        try {
            // Remove expired requests
            await RedisCache.zremrangebyscore(key, 0, windowStart);

            // Get current requests in window
            const results = await RedisCache.zrangebyscore(key, windowStart, windowEnd);

            // Set expiration for the key
            await RedisCache.expire(key, Math.ceil(this.config.windowMs / 1000));

            return results.map(Number);
        } catch (error) {
            console.error('Error getting requests from Redis:', error);
            // Fallback to in-memory storage (less reliable but prevents errors)
            return this.getInMemoryRequests(key, windowStart, windowEnd);
        }
    }

    // In-memory fallback for when Redis is unavailable
    private static memoryStore = new Map<string, number[]>();

    private getInMemoryRequests(key: string, windowStart: number, windowEnd: number): number[] {
        const requests = RateLimiter.memoryStore.get(key) || [];
        // Filter requests within the time window
        const validRequests = requests.filter(timestamp => timestamp >= windowStart && timestamp <= windowEnd);
        // Update the store with valid requests only
        RateLimiter.memoryStore.set(key, validRequests);
        return validRequests;
    }

    private addInMemoryRequest(key: string, timestamp: number): void {
        const requests = RateLimiter.memoryStore.get(key) || [];
        requests.push(timestamp);
        RateLimiter.memoryStore.set(key, requests);
    }

    /**
     * Add request timestamp to Redis sorted set
     */
    private async addRequest(key: string, timestamp: number, ttl: number): Promise<void> {
        try {
            // Add timestamp to sorted set
            await RedisCache.zadd(key, timestamp, timestamp.toString());

            // Set expiration
            await RedisCache.expire(key, Math.ceil(ttl / 1000));
        } catch (error) {
            console.error('Error adding request to Redis:', error);
            // Fallback to in-memory storage
            this.addInMemoryRequest(key, timestamp);
        }
    }

    /**
     * Reset rate limit for identifier
     */
    async reset(identifier: string): Promise<void> {
        const key = this.config.keyGenerator!(identifier);
        try {
            await RedisCache.del(key);
        } catch (error) {
            console.error('Error resetting rate limit:', error);
        }
        // Also clear from in-memory store
        RateLimiter.memoryStore.delete(key);
    }
}

/**
 * Predefined rate limiters for different use cases
 */
export class RateLimiters {
    // General API rate limiter
    static readonly API = new RateLimiter({
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 100,
        keyGenerator: (id: string) => `api_limit:${id}`,
    });

    // Strict rate limiter for sensitive endpoints
    static readonly STRICT = new RateLimiter({
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 20,
        keyGenerator: (id: string) => `strict_limit:${id}`,
    });

    // Authentication rate limiter
    static readonly AUTH = new RateLimiter({
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 5,
        keyGenerator: (id: string) => `auth_limit:${id}`,
    });

    // Integration sync rate limiter
    static readonly INTEGRATION_SYNC = new RateLimiter({
        windowMs: 60 * 60 * 1000, // 1 hour
        maxRequests: 10,
        keyGenerator: (id: string) => `sync_limit:${id}`,
    });

    // AI generation rate limiter
    static readonly AI_GENERATION = new RateLimiter({
        windowMs: 60 * 60 * 1000, // 1 hour
        maxRequests: 50,
        keyGenerator: (id: string) => `ai_limit:${id}`,
    });

    // File upload rate limiter
    static readonly UPLOAD = new RateLimiter({
        windowMs: 60 * 60 * 1000, // 1 hour
        maxRequests: 100,
        keyGenerator: (id: string) => `upload_limit:${id}`,
    });
}

/**
 * Rate limiting middleware factory
 */
export function createRateLimitMiddleware(limiter: RateLimiter) {
    return async function rateLimitMiddleware(
        identifier: string,
        onSuccess?: () => void,
        onFailure?: () => void
    ): Promise<RateLimitResult> {
        const result = await limiter.checkLimit(identifier);

        if (result.allowed) {
            onSuccess?.();
        } else {
            onFailure?.();
        }

        return result;
    };
}

/**
 * Get client identifier from request
 */
export function getClientIdentifier(req: Request): string {
    // Try to get user ID from session/auth first
    const userId = req.headers.get('x-user-id');
    if (userId) {
        return `user:${userId}`;
    }

    // Fallback to IP address
    const forwarded = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    const ip = forwarded?.split(',')[0] || realIp || 'unknown';

    return `ip:${ip}`;
}

/**
 * Rate limit response headers
 */
export function addRateLimitHeaders(
    response: Response,
    result: RateLimitResult
): Response {
    const headers = new Headers(response.headers);

    headers.set('X-RateLimit-Limit', result.limit.toString());
    headers.set('X-RateLimit-Remaining', result.remaining.toString());
    headers.set('X-RateLimit-Reset', result.resetTime.toString());

    if (result.retryAfter) {
        headers.set('Retry-After', result.retryAfter.toString());
    }

    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
    });
}

/**
 * In-memory fallback rate limiter for when Redis is unavailable
 */
class InMemoryRateLimiter {
    private store = new Map<string, number[]>();
    private readonly config: RateLimitConfig;

    constructor(config: RateLimitConfig) {
        this.config = config;

        // Clean up expired entries every 5 minutes
        setInterval(() => {
            this.cleanup();
        }, 5 * 60 * 1000);
    }

    checkLimit(identifier: string): RateLimitResult {
        const key = this.config.keyGenerator!(identifier);
        const now = Date.now();
        const windowStart = now - this.config.windowMs;

        const requests = this.store.get(key) || [];
        const recentRequests = requests.filter(timestamp => timestamp > windowStart);

        const result: RateLimitResult = {
            allowed: recentRequests.length < this.config.maxRequests,
            limit: this.config.maxRequests,
            remaining: Math.max(0, this.config.maxRequests - recentRequests.length - 1),
            resetTime: now + this.config.windowMs,
        };

        if (!result.allowed) {
            const oldestRequest = Math.min(...recentRequests);
            result.retryAfter = Math.ceil((oldestRequest + this.config.windowMs - now) / 1000);
        } else {
            recentRequests.push(now);
            this.store.set(key, recentRequests);
        }

        return result;
    }

    private cleanup(): void {
        const now = Date.now();
        for (const [key, requests] of this.store.entries()) {
            const windowStart = now - this.config.windowMs;
            const recentRequests = requests.filter(timestamp => timestamp > windowStart);

            if (recentRequests.length === 0) {
                this.store.delete(key);
            } else {
                this.store.set(key, recentRequests);
            }
        }
    }
}

/**
 * Fallback rate limiters using in-memory storage
 */
export const FallbackRateLimiters = {
    API: new InMemoryRateLimiter({
        windowMs: 15 * 60 * 1000,
        maxRequests: 100,
        keyGenerator: (id: string) => `api_limit:${id}`,
    }),

    STRICT: new InMemoryRateLimiter({
        windowMs: 15 * 60 * 1000,
        maxRequests: 20,
        keyGenerator: (id: string) => `strict_limit:${id}`,
    }),

    AUTH: new InMemoryRateLimiter({
        windowMs: 15 * 60 * 1000,
        maxRequests: 5,
        keyGenerator: (id: string) => `auth_limit:${id}`,
    }),
};