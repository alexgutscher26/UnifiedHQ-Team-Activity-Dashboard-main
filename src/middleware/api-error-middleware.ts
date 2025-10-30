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
 * This function implements a simple in-memory rate limiting mechanism based on the client's IP address.
 * It retrieves the IP from the request headers, maintains a record of request timestamps, and enforces a limit
 * of 100 requests within a 15-minute window. If the limit is reached, it returns false; otherwise, it updates
 * the request log and returns true.
 *
 * @param req - The NextRequest object representing the incoming request.
 */
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
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  res.headers.set('X-Request-ID', requestId);
  return res;
}

// Global rate limit store type
declare global {
  var rateLimitStore: Map<string, number[]> | undefined;
}
