import { NextRequest, NextResponse } from 'next/server';
import { CacheInvalidationService } from './cache-invalidation-service';
import { CacheInvalidationTriggers } from './cache-invalidation-triggers';

/**
 * Cache invalidation middleware for automatic cache invalidation on API mutations
 */

interface InvalidationRule {
  pattern: RegExp;
  methods: string[];
  invalidationType: 'user' | 'github' | 'slack' | 'ai' | 'api' | 'smart';
  extractContext?: (
    request: NextRequest,
    response: NextResponse
  ) => Promise<any>;
  scope?: 'user' | 'team' | 'global';
}

/**
 * Predefined invalidation rules for common API patterns
 */
const INVALIDATION_RULES: InvalidationRule[] = [
  // GitHub integration routes
  {
    pattern: /^\/api\/github\/.*$/,
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
    invalidationType: 'smart',
    extractContext: async request => {
      const url = new URL(request.url);
      const pathParts = url.pathname.split('/');
      return {
        changeType: 'github',
        repository: pathParts[4], // Assuming /api/github/user/repo pattern
      };
    },
  },

  // Slack integration routes
  {
    pattern: /^\/api\/slack\/.*$/,
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
    invalidationType: 'smart',
    extractContext: async request => {
      const url = new URL(request.url);
      const pathParts = url.pathname.split('/');
      return {
        changeType: 'slack',
        channel: pathParts[4], // Assuming /api/slack/user/channel pattern
      };
    },
  },

  // AI summary routes
  {
    pattern: /^\/api\/ai-summary\/.*$/,
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
    invalidationType: 'ai',
    extractContext: async request => {
      const url = new URL(request.url);
      const searchParams = url.searchParams;
      return {
        date:
          searchParams.get('date') || new Date().toISOString().split('T')[0],
      };
    },
  },

  // User preferences routes
  {
    pattern: /^\/api\/user-preferences\/.*$/,
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
    invalidationType: 'user',
    extractContext: async request => {
      // User context will be extracted from authentication
      return {};
    },
  },

  // Team activity routes
  {
    pattern: /^\/api\/team-activity\/.*$/,
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
    invalidationType: 'api',
    extractContext: async request => {
      return {
        endpoint: 'team-activity',
      };
    },
  },

  // Integration management routes
  {
    pattern: /^\/api\/integrations\/.*$/,
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
    invalidationType: 'smart',
    extractContext: async request => {
      const url = new URL(request.url);
      const pathParts = url.pathname.split('/');
      const integrationType = pathParts[3]; // /api/integrations/github or /api/integrations/slack

      return {
        changeType:
          integrationType === 'github'
            ? 'github'
            : integrationType === 'slack'
              ? 'slack'
              : 'user',
      };
    },
  },
];

/**
 * Cache invalidation middleware class
 */
export class CacheInvalidationMiddleware {
  /**
   * Create middleware function for Next.js API routes
   */
  static create() {
    return async (request: NextRequest, response: NextResponse) => {
      try {
        // Only process mutation methods
        if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
          return response;
        }

        const url = new URL(request.url);
        const pathname = url.pathname;

        console.log(
          `Processing cache invalidation for: ${request.method} ${pathname}`
        );

        // Find matching invalidation rules
        const matchingRules = INVALIDATION_RULES.filter(
          rule =>
            rule.pattern.test(pathname) && rule.methods.includes(request.method)
        );

        if (matchingRules.length === 0) {
          console.log(`No cache invalidation rules found for: ${pathname}`);
          return response;
        }

        // Extract user ID from request (assuming it's available in headers or auth)
        const userId = await this.extractUserId(request);

        if (!userId) {
          console.warn('No user ID found for cache invalidation');
          return response;
        }

        // Process each matching rule
        let totalInvalidated = 0;

        for (const rule of matchingRules) {
          try {
            const context = rule.extractContext
              ? await rule.extractContext(request, response)
              : {};

            let invalidatedCount = 0;

            switch (rule.invalidationType) {
              case 'user':
                invalidatedCount =
                  await CacheInvalidationService.invalidateUser(userId);
                break;

              case 'github':
                invalidatedCount =
                  await CacheInvalidationService.invalidateGitHubData(
                    userId,
                    context.repository
                  );
                break;

              case 'slack':
                invalidatedCount =
                  await CacheInvalidationService.invalidateSlackData(
                    userId,
                    context.channel
                  );
                break;

              case 'ai':
                invalidatedCount =
                  await CacheInvalidationService.invalidateAISummary(
                    userId,
                    context.date
                  );
                break;

              case 'api':
                invalidatedCount =
                  await CacheInvalidationService.invalidateAPICache(
                    context.endpoint || 'unknown',
                    ...(context.params || [])
                  );
                break;

              case 'smart':
                if (context.changeType) {
                  invalidatedCount =
                    await CacheInvalidationService.smartInvalidation(
                      context.changeType,
                      userId,
                      context
                    );
                }
                break;
            }

            totalInvalidated += invalidatedCount;

            console.log(
              `Rule ${rule.invalidationType} invalidated ${invalidatedCount} entries`
            );
          } catch (error) {
            console.error(
              `Failed to process invalidation rule ${rule.invalidationType}:`,
              error
            );
          }
        }

        console.log(
          `Cache invalidation completed for ${pathname}. Total entries invalidated: ${totalInvalidated}`
        );

        // Add invalidation info to response headers for debugging
        response.headers.set(
          'X-Cache-Invalidated',
          totalInvalidated.toString()
        );
        response.headers.set(
          'X-Cache-Rules-Applied',
          matchingRules.length.toString()
        );

        return response;
      } catch (error) {
        console.error('Cache invalidation middleware error:', error);
        return response;
      }
    };
  }

  /**
   * Extract user ID from request
   * This is a placeholder implementation - in a real app, this would extract from JWT token or session
   */
  private static async extractUserId(
    request: NextRequest
  ): Promise<string | null> {
    try {
      // Try to get user ID from authorization header
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        // In a real implementation, decode JWT token here
        // For now, return a placeholder
        return 'user_from_token';
      }

      // Try to get user ID from session cookie
      const sessionCookie = request.cookies.get('session');
      if (sessionCookie) {
        // In a real implementation, decode session here
        // For now, return a placeholder
        return 'user_from_session';
      }

      // Try to get user ID from custom header
      const userIdHeader = request.headers.get('x-user-id');
      if (userIdHeader) {
        return userIdHeader;
      }

      return null;
    } catch (error) {
      console.error('Failed to extract user ID:', error);
      return null;
    }
  }

  /**
   * Add a custom invalidation rule
   */
  static addRule(rule: InvalidationRule): void {
    console.log(
      `Adding custom cache invalidation rule for pattern: ${rule.pattern}`
    );
    INVALIDATION_RULES.push(rule);
  }

  /**
   * Remove invalidation rules by pattern
   */
  static removeRule(pattern: RegExp): boolean {
    const initialLength = INVALIDATION_RULES.length;
    const index = INVALIDATION_RULES.findIndex(
      rule => rule.pattern.source === pattern.source
    );

    if (index !== -1) {
      INVALIDATION_RULES.splice(index, 1);
      console.log(`Removed cache invalidation rule for pattern: ${pattern}`);
      return true;
    }

    return false;
  }

  /**
   * Get all registered rules
   */
  static getRules(): InvalidationRule[] {
    return [...INVALIDATION_RULES];
  }

  /**
   * Manual invalidation trigger for specific routes
   */
  static async triggerInvalidation(
    pathname: string,
    method: string,
    userId: string,
    context?: any
  ): Promise<number> {
    console.log(`Manual cache invalidation trigger for: ${method} ${pathname}`);

    const matchingRules = INVALIDATION_RULES.filter(
      rule => rule.pattern.test(pathname) && rule.methods.includes(method)
    );

    if (matchingRules.length === 0) {
      console.log(`No matching rules for manual invalidation: ${pathname}`);
      return 0;
    }

    let totalInvalidated = 0;

    for (const rule of matchingRules) {
      try {
        const ruleContext = { ...context };

        let invalidatedCount = 0;

        switch (rule.invalidationType) {
          case 'user':
            invalidatedCount =
              await CacheInvalidationService.invalidateUser(userId);
            break;

          case 'github':
            invalidatedCount =
              await CacheInvalidationService.invalidateGitHubData(
                userId,
                ruleContext.repository
              );
            break;

          case 'slack':
            invalidatedCount =
              await CacheInvalidationService.invalidateSlackData(
                userId,
                ruleContext.channel
              );
            break;

          case 'ai':
            invalidatedCount =
              await CacheInvalidationService.invalidateAISummary(
                userId,
                ruleContext.date
              );
            break;

          case 'api':
            invalidatedCount =
              await CacheInvalidationService.invalidateAPICache(
                ruleContext.endpoint || 'manual',
                ...(ruleContext.params || [])
              );
            break;

          case 'smart':
            if (ruleContext.changeType) {
              invalidatedCount =
                await CacheInvalidationService.smartInvalidation(
                  ruleContext.changeType,
                  userId,
                  ruleContext
                );
            }
            break;
        }

        totalInvalidated += invalidatedCount;
      } catch (error) {
        console.error('Manual invalidation rule failed:', error);
      }
    }

    console.log(
      `Manual cache invalidation completed. Total entries invalidated: ${totalInvalidated}`
    );
    return totalInvalidated;
  }
}
