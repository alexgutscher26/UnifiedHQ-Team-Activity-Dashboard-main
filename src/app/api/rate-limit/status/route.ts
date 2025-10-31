import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { RateLimiters, getClientIdentifier } from '@/lib/rate-limiter';
import { withDefaultMiddleware } from '@/middleware/api-middleware';

/**
 * Get rate limit status for the current user/IP
 */
async function handler(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    const identifier = getClientIdentifier(request);
    const { searchParams } = new URL(request.url);
    const limiterType = searchParams.get('type') || 'API';

    // Get the appropriate rate limiter
    let limiter = RateLimiters.API;
    switch (limiterType.toUpperCase()) {
      case 'STRICT':
        limiter = RateLimiters.STRICT;
        break;
      case 'AUTH':
        limiter = RateLimiters.AUTH;
        break;
      case 'INTEGRATION_SYNC':
        limiter = RateLimiters.INTEGRATION_SYNC;
        break;
      case 'AI_GENERATION':
        limiter = RateLimiters.AI_GENERATION;
        break;
      case 'UPLOAD':
        limiter = RateLimiters.UPLOAD;
        break;
    }

    // Check current rate limit status without consuming a request
    const result = await limiter.checkLimit(identifier);

    return NextResponse.json({
      success: true,
      rateLimit: {
        identifier: session?.user?.id ? `user:${session.user.id}` : identifier,
        limiterType,
        allowed: result.allowed,
        limit: result.limit,
        remaining: result.remaining,
        resetTime: result.resetTime,
        resetTimeFormatted: new Date(result.resetTime).toISOString(),
        retryAfter: result.retryAfter,
        windowMs: limiter.config?.windowMs || 'unknown',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Rate limit status error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get rate limit status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export const GET = withDefaultMiddleware(handler);

/**
 * Reset rate limit for the current user (admin only)
 */
async function resetHandler(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // TODO: Add admin check here
    // For now, allow users to reset their own rate limits

    const identifier = getClientIdentifier(request);
    const { searchParams } = new URL(request.url);
    const limiterType = searchParams.get('type') || 'API';

    // Get the appropriate rate limiter
    let limiter = RateLimiters.API;
    switch (limiterType.toUpperCase()) {
      case 'STRICT':
        limiter = RateLimiters.STRICT;
        break;
      case 'AUTH':
        limiter = RateLimiters.AUTH;
        break;
      case 'INTEGRATION_SYNC':
        limiter = RateLimiters.INTEGRATION_SYNC;
        break;
      case 'AI_GENERATION':
        limiter = RateLimiters.AI_GENERATION;
        break;
      case 'UPLOAD':
        limiter = RateLimiters.UPLOAD;
        break;
    }

    // Reset the rate limit
    await limiter.reset(identifier);

    return NextResponse.json({
      success: true,
      message: `Rate limit reset for ${limiterType}`,
      identifier: session.user.id ? `user:${session.user.id}` : identifier,
      limiterType,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Rate limit reset error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to reset rate limit',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export const DELETE = withDefaultMiddleware(resetHandler);
