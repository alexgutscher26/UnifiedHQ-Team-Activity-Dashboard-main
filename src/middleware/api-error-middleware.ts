// API Error Handling Middleware

import { NextRequest, NextResponse } from 'next/server';
import { ApiErrorType, createApiError } from '@/lib/api-error-handler';

// Global error handler for API routes
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
export function checkApiRateLimit(req: NextRequest): boolean {
  // Simple rate limiting based on IP
  const ip =
    req.headers.get('x-forwarded-for') ||
    req.headers.get('x-real-ip') ||
    'unknown';
  const key = `rate_limit_${ip}`;

  // TODO: This is a simple in-memory rate limiter
  // In production, use Redis or a proper rate limiting service
  if (!global.rateLimitStore) {
    global.rateLimitStore = new Map();
  }

  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const limit = 100; // 100 requests per window

  const requests = global.rateLimitStore.get(key) || [];
  const recentRequests = requests.filter(
    (timestamp: number) => timestamp > now - windowMs
  );

  if (recentRequests.length >= limit) {
    return false;
  }

  recentRequests.push(now);
  global.rateLimitStore.set(key, recentRequests);

  return true;
}

// CORS middleware
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
export function addRequestId(res: NextResponse): NextResponse {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  res.headers.set('X-Request-ID', requestId);
  return res;
}

// Global rate limit store type
declare global {
  var rateLimitStore: Map<string, number[]> | undefined;
}
