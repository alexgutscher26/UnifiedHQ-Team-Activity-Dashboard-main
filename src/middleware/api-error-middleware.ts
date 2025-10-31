import { NextRequest, NextResponse } from 'next/server';
import { ApiErrorType, createApiError } from '@/lib/api-error-handler';

// Global error handler for API routes
/**
 * Handle API errors and return appropriate responses.
 *
 * This function logs the error details and determines the type of error based on the error message.
 * It creates a structured API error response for various error types such as authentication, authorization,
 * not found, validation, and generic server errors. If the error is unknown, a default internal server error
 * response is generated.
 *
 * @param error - The error object that occurred during the API request.
 * @param req - The NextRequest object representing the incoming request.
 * @returns A NextResponse object containing the error details and appropriate HTTP status code.
 */
export function handleApiError(error: unknown, req: NextRequest): NextResponse {
  console.error('[API Middleware Error]', {
    error,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  // Handle different error types
  if (error instanceof Error) {
    // Check for specific error types
    if (error.message.includes('Authentication')) {
      const apiError = createApiError(
        ApiErrorType.AUTHENTICATION_ERROR,
        error.message
      );
      return NextResponse.json(
        { success: false, error: apiError },
        { status: apiError.statusCode }
      );
    }

    if (
      error.message.includes('Permission') ||
      error.message.includes('Forbidden')
    ) {
      const apiError = createApiError(
        ApiErrorType.AUTHORIZATION_ERROR,
        error.message
      );
      return NextResponse.json(
        { success: false, error: apiError },
        { status: apiError.statusCode }
      );
    }

    if (
      error.message.includes('Not found') ||
      error.message.includes('not found')
    ) {
      const apiError = createApiError(ApiErrorType.NOT_FOUND, error.message);
      return NextResponse.json(
        { success: false, error: apiError },
        { status: apiError.statusCode }
      );
    }

    if (
      error.message.includes('Validation') ||
      error.message.includes('Invalid')
    ) {
      const apiError = createApiError(
        ApiErrorType.VALIDATION_ERROR,
        error.message
      );
      return NextResponse.json(
        { success: false, error: apiError },
        { status: apiError.statusCode }
      );
    }

    // Generic server error
    const apiError = createApiError(
      ApiErrorType.INTERNAL_SERVER_ERROR,
      process.env.NODE_ENV === 'production'
        ? 'An internal server error occurred'
        : error.message
    );
    return NextResponse.json(
      { success: false, error: apiError },
      { status: apiError.statusCode }
    );
  }

  // Unknown error
  const apiError = createApiError(
    ApiErrorType.INTERNAL_SERVER_ERROR,
    'An unknown error occurred'
  );
  return NextResponse.json(
    { success: false, error: apiError },
    { status: apiError.statusCode }
  );
}

// Request logging middleware
/**
 * Logs API request details in development mode.
 */
export function logApiRequest(req: NextRequest): void {
  if (process.env.NODE_ENV === 'development') {
    console.log('[API Request]', {
      method: req.method,
      url: req.url,
      headers: Object.fromEntries(req.headers.entries()),
      timestamp: new Date().toISOString(),
    });
  }
}

// Response logging middleware
export function logApiResponse(res: NextResponse, req: NextRequest): void {
  if (process.env.NODE_ENV === 'development') {
    console.log('[API Response]', {
      method: req.method,
      url: req.url,
      status: res.status,
      timestamp: new Date().toISOString(),
    });
  }
}

// Rate limiting middleware
/**
 * Checks if the API rate limit has been exceeded for a given request.
 *
 * This function implements a Redis-based distributed rate limiting mechanism with fallback to in-memory storage.
 * It uses sliding window algorithm for accurate rate limiting and supports different rate limit configurations
 * based on the request path and user authentication status.
 *
 * @param req - The NextRequest object representing the incoming request.
 * @returns Promise<RateLimitResult> containing rate limit status and metadata.
 */
export async function checkApiRateLimit(req: NextRequest): Promise<{
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}> {
  const { RateLimiters, FallbackRateLimiters, getClientIdentifier } =
    await import('@/lib/rate-limiter');

  const identifier = getClientIdentifier(req);
  const url = new URL(req.url);
  const pathname = url.pathname;

  try {
    // Choose appropriate rate limiter based on endpoint
    let limiter = RateLimiters.API;

    if (pathname.includes('/auth/')) {
      limiter = RateLimiters.AUTH;
    } else if (
      pathname.includes('/sync') ||
      pathname.includes('/integrations/')
    ) {
      limiter = RateLimiters.INTEGRATION_SYNC;
    } else if (
      pathname.includes('/ai-summary') ||
      pathname.includes('/openrouter')
    ) {
      limiter = RateLimiters.AI_GENERATION;
    } else if (pathname.includes('/upload')) {
      limiter = RateLimiters.UPLOAD;
    }

    // Try Redis-based rate limiter first
    const result = await limiter.checkLimit(identifier);
    return result;
  } catch (error) {
    console.warn('Redis rate limiter failed, using fallback:', error);

    // Fallback to in-memory rate limiter
    let fallbackLimiter = FallbackRateLimiters.API;

    if (pathname.includes('/auth/')) {
      fallbackLimiter = FallbackRateLimiters.AUTH;
    } else if (
      pathname.includes('/sync') ||
      pathname.includes('/integrations/')
    ) {
      fallbackLimiter = FallbackRateLimiters.STRICT;
    }

    return fallbackLimiter.checkLimit(identifier);
  }
}

// CORS middleware
/**
 * Handles CORS (Cross-Origin Resource Sharing) for incoming requests.
 *
 * This function checks the 'origin' header of the request against a list of allowed origins.
 * If the origin is not in the allowed list, it returns a JSON response indicating a CORS policy violation with a 403 status.
 * If the origin is valid or not present, it returns null, allowing the request to proceed.
 *
 * @param req - The incoming request of type NextRequest.
 */
export function handleCors(req: NextRequest): NextResponse | null {
  const origin = req.headers.get('origin');
  const allowedOrigins = [
    'http://localhost:3000',
    process.env.NEXT_PUBLIC_APP_URL,
  ].filter(Boolean);

  if (origin && !allowedOrigins.includes(origin)) {
    return NextResponse.json(
      { success: false, error: 'CORS policy violation' },
      { status: 403 }
    );
  }

  return null;
}

// Security headers middleware
/**
 * Adds security headers to the response.
 */
export function addSecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-XSS-Protection', '1; mode=block');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (process.env.NODE_ENV === 'production') {
    res.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    );
  }

  return res;
}

// Request ID middleware
/**
 * Adds a unique request ID to the response headers.
 */
export function addRequestId(res: NextResponse): NextResponse {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  res.headers.set('X-Request-ID', requestId);
  return res;
}

// Rate limit response middleware
/**
 * Adds rate limit headers to the response and handles rate limit exceeded cases.
 */
export async function handleRateLimit(
  req: NextRequest
): Promise<NextResponse | null> {
  const rateLimitResult = await checkApiRateLimit(req);

  if (!rateLimitResult.allowed) {
    const response = NextResponse.json(
      {
        success: false,
        error: {
          type: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
          code: 'RATE_LIMIT_EXCEEDED',
          statusCode: 429,
          retryAfter: rateLimitResult.retryAfter,
        },
      },
      { status: 429 }
    );

    // Add rate limit headers
    response.headers.set('X-RateLimit-Limit', rateLimitResult.limit.toString());
    response.headers.set('X-RateLimit-Remaining', '0');
    response.headers.set(
      'X-RateLimit-Reset',
      rateLimitResult.resetTime.toString()
    );

    if (rateLimitResult.retryAfter) {
      response.headers.set(
        'Retry-After',
        rateLimitResult.retryAfter.toString()
      );
    }

    return response;
  }

  return null; // Allow request to proceed
}

// Add rate limit headers to successful responses
/**
 * Adds rate limit headers to successful API responses.
 */
export async function addRateLimitHeaders(
  res: NextResponse,
  req: NextRequest
): Promise<NextResponse> {
  try {
    const rateLimitResult = await checkApiRateLimit(req);

    res.headers.set('X-RateLimit-Limit', rateLimitResult.limit.toString());
    res.headers.set(
      'X-RateLimit-Remaining',
      rateLimitResult.remaining.toString()
    );
    res.headers.set('X-RateLimit-Reset', rateLimitResult.resetTime.toString());

    return res;
  } catch (error) {
    console.error('Error adding rate limit headers:', error);
    return res;
  }
}

// Export rate limiting utilities for use in API routes
export {
  RateLimiters,
  getClientIdentifier,
  addRateLimitHeaders as addRateLimitHeadersToResponse,
} from '@/lib/rate-limiter';
