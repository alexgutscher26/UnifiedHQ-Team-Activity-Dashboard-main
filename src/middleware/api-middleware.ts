/**
 * Comprehensive API Middleware
 * 
 * Combines all middleware functions for API routes including:
 * - Rate limiting with Redis
 * - Error handling
 * - CORS
 * - Security headers
 * - Request/response logging
 * - Request ID generation
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    handleApiError,
    logApiRequest,
    logApiResponse,
    handleCors,
    addSecurityHeaders,
    addRequestId,
    handleRateLimit,
    addRateLimitHeaders,
} from './api-error-middleware';

export interface ApiMiddlewareConfig {
    enableRateLimit?: boolean;
    enableCors?: boolean;
    enableSecurityHeaders?: boolean;
    enableLogging?: boolean;
    enableRequestId?: boolean;
}

/**
 * Comprehensive API middleware wrapper
 */
export function withApiMiddleware(
    handler: (req: NextRequest) => Promise<NextResponse>,
    config: ApiMiddlewareConfig = {}
) {
    const {
        enableRateLimit = true,
        enableCors = true,
        enableSecurityHeaders = true,
        enableLogging = true,
        enableRequestId = true,
    } = config;

    return async function middlewareWrapper(req: NextRequest): Promise<NextResponse> {
        try {
            // Log incoming request
            if (enableLogging) {
                logApiRequest(req);
            }

            // Handle CORS
            if (enableCors) {
                const corsResponse = handleCors(req);
                if (corsResponse) {
                    return corsResponse;
                }
            }

            // Handle rate limiting
            if (enableRateLimit) {
                const rateLimitResponse = await handleRateLimit(req);
                if (rateLimitResponse) {
                    return rateLimitResponse;
                }
            }

            // Execute the actual handler
            let response = await handler(req);

            // Add security headers
            if (enableSecurityHeaders) {
                response = addSecurityHeaders(response);
            }

            // Add request ID
            if (enableRequestId) {
                response = addRequestId(response);
            }

            // Add rate limit headers to successful responses
            if (enableRateLimit) {
                response = await addRateLimitHeaders(response, req);
            }

            // Log response
            if (enableLogging) {
                logApiResponse(response, req);
            }

            return response;

        } catch (error) {
            // Handle any errors that occurred during middleware or handler execution
            return handleApiError(error, req);
        }
    };
}

/**
 * Predefined middleware configurations for different use cases
 */
export const MiddlewareConfigs = {
    // Standard API endpoint
    DEFAULT: {
        enableRateLimit: true,
        enableCors: true,
        enableSecurityHeaders: true,
        enableLogging: true,
        enableRequestId: true,
    },

    // Public endpoints (no rate limiting)
    PUBLIC: {
        enableRateLimit: false,
        enableCors: true,
        enableSecurityHeaders: true,
        enableLogging: true,
        enableRequestId: true,
    },

    // Strict endpoints (enhanced security)
    STRICT: {
        enableRateLimit: true,
        enableCors: true,
        enableSecurityHeaders: true,
        enableLogging: true,
        enableRequestId: true,
    },

    // Internal endpoints (minimal middleware)
    INTERNAL: {
        enableRateLimit: false,
        enableCors: false,
        enableSecurityHeaders: false,
        enableLogging: false,
        enableRequestId: true,
    },

    // Development endpoints
    DEVELOPMENT: {
        enableRateLimit: false,
        enableCors: true,
        enableSecurityHeaders: false,
        enableLogging: true,
        enableRequestId: true,
    },
};

/**
 * Convenience functions for common middleware patterns
 */
export const withDefaultMiddleware = (handler: (req: NextRequest) => Promise<NextResponse>) =>
    withApiMiddleware(handler, MiddlewareConfigs.DEFAULT);

export const withPublicMiddleware = (handler: (req: NextRequest) => Promise<NextResponse>) =>
    withApiMiddleware(handler, MiddlewareConfigs.PUBLIC);

export const withStrictMiddleware = (handler: (req: NextRequest) => Promise<NextResponse>) =>
    withApiMiddleware(handler, MiddlewareConfigs.STRICT);

export const withInternalMiddleware = (handler: (req: NextRequest) => Promise<NextResponse>) =>
    withApiMiddleware(handler, MiddlewareConfigs.INTERNAL);

/**
 * Rate limit specific endpoints with custom configurations
 */
export async function withCustomRateLimit(
    req: NextRequest,
    handler: (req: NextRequest) => Promise<NextResponse>,
    rateLimiter: 'API' | 'STRICT' | 'AUTH' | 'INTEGRATION_SYNC' | 'AI_GENERATION' | 'UPLOAD'
): Promise<NextResponse> {
    try {
        const { RateLimiters, getClientIdentifier } = await import('@/lib/rate-limiter');

        const identifier = getClientIdentifier(req);
        const limiter = RateLimiters[rateLimiter];
        const result = await limiter.checkLimit(identifier);

        if (!result.allowed) {
            const response = NextResponse.json(
                {
                    success: false,
                    error: {
                        type: 'RATE_LIMIT_EXCEEDED',
                        message: `Rate limit exceeded for ${rateLimiter.toLowerCase()} endpoint`,
                        code: 'RATE_LIMIT_EXCEEDED',
                        statusCode: 429,
                        retryAfter: result.retryAfter,
                    },
                },
                { status: 429 }
            );

            response.headers.set('X-RateLimit-Limit', result.limit.toString());
            response.headers.set('X-RateLimit-Remaining', '0');
            response.headers.set('X-RateLimit-Reset', result.resetTime.toString());

            if (result.retryAfter) {
                response.headers.set('Retry-After', result.retryAfter.toString());
            }

            return response;
        }

        // Execute handler and add rate limit headers
        const response = await handler(req);
        response.headers.set('X-RateLimit-Limit', result.limit.toString());
        response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
        response.headers.set('X-RateLimit-Reset', result.resetTime.toString());

        return response;

    } catch (error) {
        console.error('Custom rate limit error:', error);
        return await handler(req); // Fallback to handler without rate limiting
    }
}

/**
 * Middleware for SSE endpoints (no rate limiting, special headers)
 */
export function withSSEMiddleware(
    handler: (req: NextRequest) => Promise<NextResponse>
) {
    return async function sseMiddleware(req: NextRequest): Promise<NextResponse> {
        try {
            logApiRequest(req);

            // Handle CORS for SSE
            const corsResponse = handleCors(req);
            if (corsResponse) {
                return corsResponse;
            }

            // Execute handler
            let response = await handler(req);

            // Add SSE-specific headers
            response.headers.set('Content-Type', 'text/event-stream');
            response.headers.set('Cache-Control', 'no-cache');
            response.headers.set('Connection', 'keep-alive');
            response.headers.set('Access-Control-Allow-Origin', '*');
            response.headers.set('Access-Control-Allow-Headers', 'Cache-Control');

            // Add request ID
            response = addRequestId(response);

            logApiResponse(response, req);

            return response;

        } catch (error) {
            return handleApiError(error, req);
        }
    };
}

/**
 * Middleware for webhook endpoints (no rate limiting, signature verification)
 */
export function withWebhookMiddleware(
    handler: (req: NextRequest) => Promise<NextResponse>,
    options: { verifySignature?: boolean } = {}
) {
    return async function webhookMiddleware(req: NextRequest): Promise<NextResponse> {
        try {
            logApiRequest(req);

            // TODO: Add signature verification if enabled
            if (options.verifySignature) {
                // Implement webhook signature verification
                console.log('Webhook signature verification not yet implemented');
            }

            // Execute handler
            let response = await handler(req);

            // Add basic security headers
            response = addSecurityHeaders(response);
            response = addRequestId(response);

            logApiResponse(response, req);

            return response;

        } catch (error) {
            return handleApiError(error, req);
        }
    };
}