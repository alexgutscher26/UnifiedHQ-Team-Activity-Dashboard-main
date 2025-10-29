import { NextRequest, NextResponse } from 'next/server';
import { CacheInvalidationService } from '@/lib/cache-invalidation-service';
import { getUser } from '@/lib/get-user';

/**
 * Cache invalidation API endpoint
 * Provides manual cache invalidation capabilities
 */

interface InvalidationRequest {
  type:
    | 'user'
    | 'github'
    | 'slack'
    | 'ai'
    | 'api'
    | 'pattern'
    | 'smart'
    | 'realtime'
    | 'batch';
  userId?: string;
  pattern?: string;
  context?: {
    repository?: string;
    channel?: string;
    date?: string;
    endpoint?: string;
    params?: string[];
    affectedUsers?: string[];
  };
  // For batch invalidation
  operations?: Array<{
    type: 'user' | 'github' | 'slack' | 'ai' | 'api' | 'pattern';
    userId?: string;
    pattern?: string;
    context?: any;
  }>;
  // For smart invalidation
  changeType?: 'github' | 'slack' | 'user' | 'ai';
  // For realtime invalidation
  updateType?: 'commit' | 'pr' | 'issue' | 'message' | 'channel' | 'summary';
  resourceId?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: InvalidationRequest = await request.json();

    console.log(`Cache invalidation request from user ${user.id}:`, body);

    let invalidatedCount = 0;
    let message = '';

    switch (body.type) {
      case 'user':
        if (!body.userId) {
          return NextResponse.json(
            { error: 'userId is required for user invalidation' },
            { status: 400 }
          );
        }

        invalidatedCount = await CacheInvalidationService.invalidateUser(
          body.userId
        );
        message = `Invalidated all cache for user: ${body.userId}`;
        break;

      case 'github':
        if (!body.userId) {
          return NextResponse.json(
            { error: 'userId is required for GitHub invalidation' },
            { status: 400 }
          );
        }

        invalidatedCount = await CacheInvalidationService.invalidateGitHubData(
          body.userId,
          body.context?.repository
        );
        message = `Invalidated GitHub cache for user: ${body.userId}`;
        if (body.context?.repository) {
          message += `, repository: ${body.context.repository}`;
        }
        break;

      case 'slack':
        if (!body.userId) {
          return NextResponse.json(
            { error: 'userId is required for Slack invalidation' },
            { status: 400 }
          );
        }

        invalidatedCount = await CacheInvalidationService.invalidateSlackData(
          body.userId,
          body.context?.channel
        );
        message = `Invalidated Slack cache for user: ${body.userId}`;
        if (body.context?.channel) {
          message += `, channel: ${body.context.channel}`;
        }
        break;

      case 'ai':
        if (!body.userId) {
          return NextResponse.json(
            { error: 'userId is required for AI invalidation' },
            { status: 400 }
          );
        }

        invalidatedCount = await CacheInvalidationService.invalidateAISummary(
          body.userId,
          body.context?.date
        );
        message = `Invalidated AI summary cache for user: ${body.userId}`;
        if (body.context?.date) {
          message += `, date: ${body.context.date}`;
        }
        break;

      case 'api':
        if (!body.context?.endpoint) {
          return NextResponse.json(
            { error: 'endpoint is required for API invalidation' },
            { status: 400 }
          );
        }

        invalidatedCount = await CacheInvalidationService.invalidateAPICache(
          body.context.endpoint,
          ...(body.context.params || [])
        );
        message = `Invalidated API cache for endpoint: ${body.context.endpoint}`;
        break;

      case 'pattern':
        if (!body.pattern) {
          return NextResponse.json(
            { error: 'pattern is required for pattern invalidation' },
            { status: 400 }
          );
        }

        const { RedisCache } = await import('@/lib/redis');
        invalidatedCount = await RedisCache.deleteByPattern(body.pattern);
        message = `Invalidated cache by pattern: ${body.pattern}`;
        break;

      case 'smart':
        if (!body.changeType || !body.userId) {
          return NextResponse.json(
            {
              error:
                'changeType and userId are required for smart invalidation',
            },
            { status: 400 }
          );
        }

        invalidatedCount = await CacheInvalidationService.smartInvalidation(
          body.changeType,
          body.userId,
          body.context
        );
        message = `Smart invalidation completed for ${body.changeType} change, user: ${body.userId}`;
        break;

      case 'realtime':
        if (!body.updateType || !body.userId || !body.resourceId) {
          return NextResponse.json(
            {
              error:
                'updateType, userId, and resourceId are required for realtime invalidation',
            },
            { status: 400 }
          );
        }

        invalidatedCount = await CacheInvalidationService.realtimeInvalidation(
          body.updateType,
          body.userId,
          body.resourceId
        );
        message = `Real-time invalidation completed for ${body.updateType}, user: ${body.userId}, resource: ${body.resourceId}`;
        break;

      case 'batch':
        if (!body.operations || !Array.isArray(body.operations)) {
          return NextResponse.json(
            {
              error: 'operations array is required for batch invalidation',
            },
            { status: 400 }
          );
        }

        invalidatedCount = await CacheInvalidationService.batchInvalidation(
          body.operations
        );
        message = `Batch invalidation completed for ${body.operations.length} operations`;
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid invalidation type' },
          { status: 400 }
        );
    }

    console.log(
      `Cache invalidation completed: ${message}. Entries invalidated: ${invalidatedCount}`
    );

    return NextResponse.json({
      success: true,
      message,
      invalidated_entries: invalidatedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cache invalidation failed:', error);

    return NextResponse.json(
      {
        error: 'Cache invalidation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Check authentication
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      message: 'Cache invalidation API endpoint',
      available_types: [
        'user',
        'github',
        'slack',
        'ai',
        'api',
        'pattern',
        'smart',
        'realtime',
        'batch',
      ],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cache invalidation API error:', error);

    return NextResponse.json({ error: 'API error' }, { status: 500 });
  }
}
