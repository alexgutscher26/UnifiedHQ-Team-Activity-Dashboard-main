// API Caching Middleware for Next.js

import { NextRequest, NextResponse } from 'next/server';
import { RedisCache, CacheKeyGenerator, TTLManager } from '@/lib/redis';

export interface CacheConfig {
  strategy: 'cache-first' | 'network-first' | 'stale-while-revalidate';
  ttl?: number;
  maxAge?: number;
  staleWhileRevalidate?: number;
  tags?: string[];
  varyBy?: string[];
  skipCache?: boolean;
}

export interface CacheContext {
  key: string;
  config: CacheConfig;
  request: NextRequest;
}

// Default cache configurations for different content types
const DEFAULT_CACHE_CONFIGS: Record<string, CacheConfig> = {
  'application/json': {
    strategy: 'stale-while-revalidate',
    ttl: TTLManager.getTTL('API_MEDIUM'),
    maxAge: 300, // 5 minutes browser cache
    staleWhileRevalidate: 600, // 10 minutes stale-while-revalidate
    tags: ['api'],
  },
  'text/html': {
    strategy: 'network-first',
    ttl: TTLManager.getTTL('API_FAST'),
    maxAge: 60, // 1 minute browser cache
    tags: ['html'],
  },
  'image/*': {
    strategy: 'cache-first',
    ttl: TTLManager.getTTL('CONFIG'),
    maxAge: 86400, // 24 hours browser cache
    tags: ['static', 'images'],
  },
  'text/css': {
    strategy: 'cache-first',
    ttl: TTLManager.getTTL('CONFIG'),
    maxAge: 86400, // 24 hours browser cache
    tags: ['static', 'css'],
  },
  'application/javascript': {
    strategy: 'cache-first',
    ttl: TTLManager.getTTL('CONFIG'),
    maxAge: 86400, // 24 hours browser cache
    tags: ['static', 'js'],
  },
};

// Route-specific cache configurations
const ROUTE_CACHE_CONFIGS: Record<string, CacheConfig> = {
  '/api/github': {
    strategy: 'stale-while-revalidate',
    ttl: TTLManager.getTTL('GITHUB_REPOS'),
    maxAge: 300,
    staleWhileRevalidate: 900,
    tags: ['github', 'api'],
    varyBy: ['authorization'],
  },
  '/api/slack': {
    strategy: 'stale-while-revalidate',
    ttl: TTLManager.getTTL('SLACK_MESSAGES'),
    maxAge: 180,
    staleWhileRevalidate: 600,
    tags: ['slack', 'api'],
    varyBy: ['authorization'],
  },
  '/api/slack/activity': {
    strategy: 'network-first',
    ttl: TTLManager.getTTL('SLACK_MESSAGES'),
    maxAge: 300, // 5 minutes
    staleWhileRevalidate: 900, // 15 minutes
    tags: ['slack', 'activity', 'api'],
    varyBy: ['authorization', 'limit', 'refresh'],
  },
  '/api/slack/channels': {
    strategy: 'stale-while-revalidate',
    ttl: TTLManager.getTTL('SLACK_CHANNELS'),
    maxAge: 1800, // 30 minutes
    staleWhileRevalidate: 3600, // 1 hour
    tags: ['slack', 'channels', 'api'],
    varyBy: ['authorization'],
  },
  '/api/slack/stats': {
    strategy: 'cache-first',
    ttl: TTLManager.getTTL('SLACK_MESSAGES') * 2, // 10 minutes
    maxAge: 600, // 10 minutes
    staleWhileRevalidate: 1800, // 30 minutes
    tags: ['slack', 'stats', 'api'],
    varyBy: ['authorization'],
  },
  '/api/ai-summary': {
    strategy: 'cache-first',
    ttl: TTLManager.getTTL('AI_SUMMARY'),
    maxAge: 1800,
    tags: ['ai', 'summary', 'api'],
    varyBy: ['authorization'],
  },
  '/api/openrouter': {
    strategy: 'cache-first',
    ttl: TTLManager.getTTL('AI_SUMMARY'),
    maxAge: 1800,
    tags: ['ai', 'openrouter', 'api'],
    varyBy: ['authorization'],
  },
  '/api/user': {
    strategy: 'network-first',
    ttl: TTLManager.getTTL('USER_SESSION'),
    maxAge: 300,
    tags: ['user', 'api'],
    varyBy: ['authorization'],
  },
  // SSE endpoints - skip caching for real-time connections
  '/api/activities/live': {
    strategy: 'network-first',
    skipCache: true,
    maxAge: 0,
    tags: ['sse', 'realtime'],
  },
  '/api/offline/sync/events': {
    strategy: 'network-first',
    skipCache: true,
    maxAge: 0,
    tags: ['sse', 'realtime', 'sync'],
  },
  // Health check endpoints - minimal caching
  '/api/health': {
    strategy: 'network-first',
    ttl: 30, // 30 seconds
    maxAge: 30,
    tags: ['health', 'api'],
  },
};

/**
 * Generate cache key for API request.
 *
 * This function constructs a cache key based on the request's URL and specified configuration.
 * It extracts the pathname and search parameters from the request URL, and appends them to the key.
 * Additionally, it includes headers specified in the config.varyBy array, hashing sensitive headers like
 * authorization for security. The final cache key is generated using CacheKeyGenerator.api.
 *
 * @param req - The NextRequest object representing the API request.
 * @param config - The CacheConfig object containing configuration options for caching.
 */
function generateCacheKey(req: NextRequest, config: CacheConfig): string {
  const url = new URL(req.url);
  const pathname = url.pathname;
  const searchParams = url.searchParams.toString();

  // Base key components
  const keyParts = [pathname];

  if (searchParams) {
    keyParts.push(searchParams);
  }

  // Add vary-by headers to key
  if (config.varyBy) {
    for (const header of config.varyBy) {
      const value = req.headers.get(header);
      if (value) {
        // Hash sensitive headers like authorization
        if (header.toLowerCase() === 'authorization') {
          // Use TextEncoder/btoa for Edge Runtime compatibility
          const encoder = new TextEncoder();
          const data = encoder.encode(value);
          const hash = btoa(String.fromCharCode(...data)).substring(0, 8);
          keyParts.push(`${header}:${hash}`);
        } else {
          keyParts.push(`${header}:${value}`);
        }
      }
    }
  }

  return CacheKeyGenerator.api('response', ...keyParts);
}

/**
 * Get cache configuration for request.
 *
 * This function retrieves the appropriate cache configuration based on the request's URL pathname and the 'accept' header.
 * It first checks for any route-specific configurations defined in ROUTE_CACHE_CONFIGS. If none are found, it then looks for
 * content-type specific configurations in DEFAULT_CACHE_CONFIGS. If no specific configurations are matched, a default
 * cache configuration is returned.
 *
 * @param req - The NextRequest object containing the request details.
 */
function getCacheConfig(req: NextRequest): CacheConfig {
  const url = new URL(req.url);
  const pathname = url.pathname;

  // Check for route-specific configuration
  for (const [route, config] of Object.entries(ROUTE_CACHE_CONFIGS)) {
    if (pathname.startsWith(route)) {
      return config;
    }
  }

  // Check for content-type specific configuration
  const acceptHeader = req.headers.get('accept') || '';
  for (const [contentType, config] of Object.entries(DEFAULT_CACHE_CONFIGS)) {
    if (acceptHeader.includes(contentType.replace(/\*/g, ''))) {
      return config;
    }
  }

  // Default configuration
  return {
    strategy: 'network-first',
    ttl: TTLManager.getTTL('API_MEDIUM'),
    maxAge: 300,
    tags: ['api'],
  };
}

/**
 * Set cache-control headers based on configuration
 */
function setCacheHeaders(
  response: NextResponse,
  config: CacheConfig
): NextResponse {
  const cacheControl = [];

  if (config.maxAge) {
    cacheControl.push(`max-age=${config.maxAge}`);
  }

  if (config.staleWhileRevalidate) {
    cacheControl.push(`stale-while-revalidate=${config.staleWhileRevalidate}`);
  }

  if (config.strategy === 'cache-first') {
    cacheControl.push('public');
  } else if (config.strategy === 'network-first') {
    cacheControl.push('no-cache');
  }

  if (cacheControl.length > 0) {
    response.headers.set('Cache-Control', cacheControl.join(', '));
  }

  // Add cache tags for CDN invalidation
  if (config.tags && config.tags.length > 0) {
    response.headers.set('Cache-Tag', config.tags.join(','));
  }

  // Add ETag for conditional requests
  const etag = `"${Date.now()}-${Math.random().toString(36).substring(2, 11)}"`;
  response.headers.set('ETag', etag);

  return response;
}

/**
 * Check if request is for SSE endpoint
 */
function isSSEEndpoint(req: NextRequest): boolean {
  const url = new URL(req.url);
  const pathname = url.pathname;

  // Check for SSE endpoints
  const sseEndpoints = ['/api/activities/live', '/api/offline/sync/events'];

  return sseEndpoints.some(endpoint => pathname.startsWith(endpoint));
}

/**
 * Check if request should skip cache.
 *
 * This function determines whether to skip caching based on several conditions:
 * if caching is explicitly disabled in the config, if the request method is not GET,
 * if a no-cache header is present, if it's an SSE endpoint, or if the request includes
 * authorization in a development environment with a specific configuration. If none of
 * these conditions are met, caching is allowed.
 *
 * @param req - The request object of type NextRequest.
 * @param config - The configuration object of type CacheConfig.
 * @returns A boolean indicating whether the cache should be skipped.
 */
function shouldSkipCache(req: NextRequest, config: CacheConfig): boolean {
  // Skip cache if explicitly configured
  if (config.skipCache) {
    return true;
  }

  // Skip cache for non-GET requests
  if (req.method !== 'GET') {
    return true;
  }

  // Always skip cache for SSE endpoints
  if (isSSEEndpoint(req)) {
    return true;
  }

  // Skip cache if no-cache header is present
  const cacheControl = req.headers.get('cache-control');
  if (cacheControl?.includes('no-cache')) {
    return true;
  }

  // Skip cache for requests with authorization in development
  if (
    process.env.NODE_ENV === 'development' &&
    req.headers.get('authorization')
  ) {
    const skipAuth = process.env.CACHE_SKIP_AUTH === 'true';
    if (skipAuth) {
      return true;
    }
  }

  return false;
}

/**
 * Main caching middleware function that handles caching logic for requests.
 *
 * This function checks if caching should be skipped based on the request and configuration.
 * If caching is applicable, it attempts to retrieve a cached response from Redis.
 * Depending on the cache strategy, it may serve cached content, stale content, or fetch fresh data
 * while also handling potential errors gracefully.
 *
 * @param req - The NextRequest object representing the incoming request.
 * @param handler - A function that processes the request and returns a Promise of NextResponse.
 * @returns A Promise that resolves to the NextResponse object.
 */
export async function withCache(
  req: NextRequest,
  handler: (req: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  const config = getCacheConfig(req);

  // Skip cache if conditions are met
  if (shouldSkipCache(req, config)) {
    const response = await handler(req);
    return setCacheHeaders(response, config);
  }

  const cacheKey = generateCacheKey(req, config);

  try {
    // Try to get cached response - handle Edge Runtime gracefully
    let cachedData: {
      body: string;
      headers: Record<string, string>;
      status: number;
      timestamp: number;
    } | null = null;

    try {
      cachedData = await RedisCache.get<{
        body: string;
        headers: Record<string, string>;
        status: number;
        timestamp: number;
      }>(cacheKey);
    } catch (redisError) {
      console.warn(
        'Redis not available in Edge Runtime, skipping cache lookup:',
        redisError
      );
      cachedData = null;
    }

    if (cachedData) {
      // Check if we should serve stale content
      const age = Date.now() - cachedData.timestamp;
      const isStale = config.ttl && age > config.ttl * 1000;

      if (config.strategy === 'cache-first' || !isStale) {
        // Serve from cache
        const response = new NextResponse(cachedData.body, {
          status: cachedData.status,
          headers: cachedData.headers,
        });

        response.headers.set('X-Cache', 'HIT');
        response.headers.set('X-Cache-Age', Math.floor(age / 1000).toString());

        return setCacheHeaders(response, config);
      }

      if (config.strategy === 'stale-while-revalidate' && isStale) {
        // Serve stale content and revalidate in background
        const response = new NextResponse(cachedData.body, {
          status: cachedData.status,
          headers: cachedData.headers,
        });

        response.headers.set('X-Cache', 'STALE');
        response.headers.set('X-Cache-Age', Math.floor(age / 1000).toString());

        // Revalidate in background (fire and forget)
        setTimeout(async () => {
          try {
            const freshResponse = await handler(req);
            // Create a proper NextResponse for caching
            const responseForCache = new NextResponse(freshResponse.body, {
              status: freshResponse.status,
              statusText: freshResponse.statusText,
              headers: freshResponse.headers,
            });
            await cacheResponse(cacheKey, responseForCache, config);
          } catch (error) {
            console.error('Background revalidation failed:', error);
          }
        }, 0);

        return setCacheHeaders(response, config);
      }
    }

    // Cache miss or network-first strategy - fetch fresh data
    const response = await handler(req);

    // Cache the response if it's successful
    if (response.status >= 200 && response.status < 300) {
      // Create a proper NextResponse clone for caching
      const responseForCache = new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
      await cacheResponse(cacheKey, responseForCache, config);
    }

    response.headers.set('X-Cache', 'MISS');

    return setCacheHeaders(response, config);
  } catch (error) {
    console.error('Cache middleware error:', error);

    // Fallback to handler without caching
    const response = await handler(req);
    response.headers.set('X-Cache', 'ERROR');

    return setCacheHeaders(response, config);
  }
}

/**
 * Cache response data.
 *
 * This function caches the response data by extracting the body and relevant headers from the provided NextResponse object.
 * It constructs a cacheData object containing the body, headers, status, and a timestamp, and attempts to store it in Redis using the specified cacheKey and CacheConfig.
 * If Redis is unavailable, it logs a warning and continues without caching.
 *
 * @param cacheKey - The key under which the response data will be cached.
 * @param response - The NextResponse object containing the data to be cached.
 * @param config - The CacheConfig object that includes the time-to-live (ttl) for the cache.
 */
async function cacheResponse(
  cacheKey: string,
  response: NextResponse,
  config: CacheConfig
): Promise<void> {
  try {
    // Clone the response to avoid consuming the original body
    const clonedResponse = response.clone();
    const body = await clonedResponse.text();
    const headers: Record<string, string> = {};

    // Copy relevant headers
    response.headers.forEach((value, key) => {
      if (!key.startsWith('x-cache') && key !== 'set-cookie') {
        headers[key] = value;
      }
    });

    const cacheData = {
      body,
      headers,
      status: response.status,
      timestamp: Date.now(),
    };

    try {
      await RedisCache.set(cacheKey, cacheData, config.ttl);
    } catch (redisError) {
      console.warn(
        'Redis not available in Edge Runtime, skipping cache set:',
        redisError
      );
    }
  } catch (error) {
    console.error('Failed to cache response:', error);
  }
}

/**
 * Cache warming utility for frequently accessed endpoints
 */
export class CacheWarmer {
  private static warmingQueue = new Set<string>();

  /**
   * Warm cache for specific endpoints
   */
  static async warmEndpoints(
    endpoints: Array<{
      url: string;
      headers?: Record<string, string>;
    }>
  ): Promise<void> {
    const promises = endpoints.map(async ({ url, headers = {} }) => {
      if (this.warmingQueue.has(url)) {
        return; // Already warming this endpoint
      }

      this.warmingQueue.add(url);

      try {
        // TODO: This would need to be called with the actual handler
        // In practice, this would be integrated with the route handlers
        console.log(`Warming cache for: ${url}`);
      } catch (error) {
        console.error(`Failed to warm cache for ${url}:`, error);
      } finally {
        this.warmingQueue.delete(url);
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Warms cache for user-specific data by fetching from predefined endpoints.
   */
  static async warmUserCache(userId: string): Promise<void> {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const endpoints = [
      { url: `${baseUrl}/api/user/profile`, headers: { 'x-user-id': userId } },
      { url: `${baseUrl}/api/github/repos` },
      { url: `${baseUrl}/api/slack/channels` },
      { url: `${baseUrl}/api/slack/stats` },
    ];

    await this.warmEndpoints(endpoints);
  }

  /**
   * Warms the cache for dashboard data by fetching from predefined endpoints.
   */
  static async warmDashboardCache(): Promise<void> {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const endpoints = [
      { url: `${baseUrl}/api/dashboard/summary` },
      { url: `${baseUrl}/api/github/activity` },
      { url: `${baseUrl}/api/slack/activity` },
    ];

    await this.warmEndpoints(endpoints);
  }
}

/**
 * Cache invalidation utilities
 */
export class CacheInvalidator {
  /**
   * Invalidate cache by tags
   */
  static async invalidateByTags(tags: string[]): Promise<void> {
    try {
      const promises = tags.map(tag => RedisCache.invalidateByTag(tag));
      await Promise.allSettled(promises);
    } catch (error) {
      console.warn('Redis not available for cache invalidation:', error);
    }
  }

  /**
   * Invalidate user-specific cache.
   */
  static async invalidateUserCache(userId: string): Promise<void> {
    try {
      const pattern = CacheKeyGenerator.user(userId, '*');
      await RedisCache.deleteByPattern(pattern);
    } catch (error) {
      console.warn('Redis not available for user cache invalidation:', error);
    }
  }

  /**
   * Invalidate GitHub cache based on the provided identifier.
   */
  static async invalidateGitHubCache(identifier?: string): Promise<void> {
    const pattern = identifier
      ? CacheKeyGenerator.github(identifier, '*')
      : CacheKeyGenerator.github('*', '*');
    await RedisCache.deleteByPattern(pattern);
  }

  /**
   * Invalidate Slack cache
   */
  static async invalidateSlackCache(identifier?: string): Promise<void> {
    const pattern = identifier
      ? CacheKeyGenerator.slack(identifier, '*')
      : CacheKeyGenerator.slack('*', '*');
    await RedisCache.deleteByPattern(pattern);
  }

  /**
   * Invalidate AI summary cache based on the provided identifier.
   */
  static async invalidateAISummaryCache(identifier?: string): Promise<void> {
    const pattern = identifier
      ? CacheKeyGenerator.aiSummary(identifier, '*')
      : CacheKeyGenerator.aiSummary('*', '*');
    await RedisCache.deleteByPattern(pattern);
  }

  /**
   * Invalidate OpenRouter API cache
   */
  static async invalidateOpenRouterCache(): Promise<void> {
    const pattern = CacheKeyGenerator.generate('openrouter', '*');
    await RedisCache.deleteByPattern(pattern);
  }
}
