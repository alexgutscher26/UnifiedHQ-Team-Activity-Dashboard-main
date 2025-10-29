// API Cache Wrapper for easy integration with existing routes

import { NextRequest, NextResponse } from 'next/server';
import { withCache, CacheConfig } from '@/middleware/cache-middleware';

/**
 * Wrapper function to add caching to API route handlers
 */
export function withApiCache(
  handler: (req: NextRequest) => Promise<NextResponse>,
  config?: Partial<CacheConfig>
) {
  return async (req: NextRequest) => {
    // If custom config is provided, we need to modify the middleware behavior
    if (config) {
      // Store custom config in request headers for middleware to read
      const customConfigHeader = JSON.stringify(config);
      req.headers.set('x-cache-config', customConfigHeader);
    }

    return await withCache(req, handler);
  };
}

/**
 * Cache configuration presets for common use cases
 */
export const CachePresets = {
  /**
   * Fast changing data (user activity, real-time updates)
   */
  FAST: {
    strategy: 'network-first' as const,
    ttl: 300, // 5 minutes
    maxAge: 60, // 1 minute browser cache
    tags: ['fast', 'realtime'],
  },

  /**
   * Medium changing data (repositories, channels)
   */
  MEDIUM: {
    strategy: 'stale-while-revalidate' as const,
    ttl: 1800, // 30 minutes
    maxAge: 300, // 5 minutes browser cache
    staleWhileRevalidate: 900, // 15 minutes stale-while-revalidate
    tags: ['medium'],
  },

  /**
   * Slow changing data (user profiles, configuration)
   */
  SLOW: {
    strategy: 'cache-first' as const,
    ttl: 3600, // 1 hour
    maxAge: 1800, // 30 minutes browser cache
    tags: ['slow', 'config'],
  },

  /**
   * AI generated content (summaries, insights)
   */
  AI_CONTENT: {
    strategy: 'cache-first' as const,
    ttl: 3600, // 1 hour
    maxAge: 1800, // 30 minutes browser cache
    tags: ['ai', 'generated'],
  },

  /**
   * Static or rarely changing data
   */
  STATIC: {
    strategy: 'cache-first' as const,
    ttl: 86400, // 24 hours
    maxAge: 43200, // 12 hours browser cache
    tags: ['static'],
  },

  /**
   * No caching (for sensitive or always-fresh data)
   */
  NO_CACHE: {
    strategy: 'network-first' as const,
    skipCache: true,
    maxAge: 0,
    tags: ['no-cache'],
  },
} as const;

/**
 * Helper function to create cache-enabled API handlers
 */
export function createCachedApiHandler(
  handler: (req: NextRequest) => Promise<NextResponse>,
  preset: keyof typeof CachePresets = 'MEDIUM'
) {
  return withApiCache(handler, CachePresets[preset]);
}

/**
 * Conditional caching based on request characteristics
 */
export function withConditionalCache(
  handler: (req: NextRequest) => Promise<NextResponse>,
  condition: (req: NextRequest) => keyof typeof CachePresets | null
) {
  return async (req: NextRequest) => {
    const presetKey = condition(req);

    if (!presetKey) {
      // No caching
      return await handler(req);
    }

    return await withApiCache(handler, CachePresets[presetKey])(req);
  };
}

/**
 * Example usage patterns for different API endpoints
 */
export const ApiCachePatterns = {
  /**
   * GitHub API endpoints
   */
  github: (req: NextRequest) => {
    const url = new URL(req.url);

    if (
      url.pathname.includes('/commits') ||
      url.pathname.includes('/activity')
    ) {
      return 'FAST'; // Recent activity changes frequently
    }

    if (url.pathname.includes('/repos') || url.pathname.includes('/issues')) {
      return 'MEDIUM'; // Repository data changes moderately
    }

    if (url.pathname.includes('/profile') || url.pathname.includes('/config')) {
      return 'SLOW'; // Profile data changes rarely
    }

    return 'MEDIUM'; // Default for GitHub endpoints
  },

  /**
   * Slack API endpoints
   */
  slack: (req: NextRequest) => {
    const url = new URL(req.url);

    if (
      url.pathname.includes('/messages') ||
      url.pathname.includes('/activity')
    ) {
      return 'FAST'; // Messages change frequently
    }

    if (url.pathname.includes('/channels') || url.pathname.includes('/users')) {
      return 'MEDIUM'; // Channel/user data changes moderately
    }

    return 'MEDIUM'; // Default for Slack endpoints
  },

  /**
   * AI Summary endpoints
   */
  aiSummary: (req: NextRequest) => {
    const url = new URL(req.url);

    if (url.searchParams.get('regenerate') === 'true') {
      return null; // No caching for forced regeneration
    }

    return 'AI_CONTENT'; // Cache AI-generated content
  },

  /**
   * User-related endpoints
   */
  user: (req: NextRequest) => {
    const url = new URL(req.url);

    if (
      url.pathname.includes('/activity') ||
      url.pathname.includes('/notifications')
    ) {
      return 'FAST'; // User activity changes frequently
    }

    if (
      url.pathname.includes('/preferences') ||
      url.pathname.includes('/settings')
    ) {
      return 'SLOW'; // Settings change rarely
    }

    return 'MEDIUM'; // Default for user endpoints
  },
};

/**
 * Utility to get cache statistics
 */
export async function getCacheStats() {
  // This would integrate with Redis to get actual cache statistics
  // For now, return a placeholder structure
  return {
    hitRate: 0,
    missRate: 0,
    totalRequests: 0,
    cacheSize: 0,
    topKeys: [],
    recentActivity: [],
  };
}
