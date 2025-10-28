// Standardized error handling for API endpoints

import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { auth } from '@/lib/auth';
import { PrismaClient } from '@/generated/prisma';
import { withRetry, RetryOptions, RetryPresets } from '@/lib/retry-utils';

// Error types
export enum ApiErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  BAD_REQUEST = 'BAD_REQUEST',
  UNPROCESSABLE_ENTITY = 'UNPROCESSABLE_ENTITY',
}

export interface ApiError {
  type: ApiErrorType;
  message: string;
  code: string;
  statusCode: number;
  details?: any;
  timestamp: string;
  requestId?: string;
}

export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
  timestamp: string;
  requestId?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiError;
}

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

// HTTP status codes mapping
const HTTP_STATUS_CODES: Record<ApiErrorType, number> = {
  [ApiErrorType.VALIDATION_ERROR]: 400,
  [ApiErrorType.AUTHENTICATION_ERROR]: 401,
  [ApiErrorType.AUTHORIZATION_ERROR]: 403,
  [ApiErrorType.NOT_FOUND]: 404,
  [ApiErrorType.CONFLICT]: 409,
  [ApiErrorType.RATE_LIMIT_ERROR]: 429,
  [ApiErrorType.EXTERNAL_SERVICE_ERROR]: 502,
  [ApiErrorType.INTERNAL_SERVER_ERROR]: 500,
  [ApiErrorType.BAD_REQUEST]: 400,
  [ApiErrorType.UNPROCESSABLE_ENTITY]: 422,
};

// Error codes mapping
const ERROR_CODES: Record<ApiErrorType, string> = {
  [ApiErrorType.VALIDATION_ERROR]: 'VALIDATION_FAILED',
  [ApiErrorType.AUTHENTICATION_ERROR]: 'UNAUTHORIZED',
  [ApiErrorType.AUTHORIZATION_ERROR]: 'FORBIDDEN',
  [ApiErrorType.NOT_FOUND]: 'RESOURCE_NOT_FOUND',
  [ApiErrorType.CONFLICT]: 'RESOURCE_CONFLICT',
  [ApiErrorType.RATE_LIMIT_ERROR]: 'RATE_LIMIT_EXCEEDED',
  [ApiErrorType.EXTERNAL_SERVICE_ERROR]: 'EXTERNAL_SERVICE_UNAVAILABLE',
  [ApiErrorType.INTERNAL_SERVER_ERROR]: 'INTERNAL_ERROR',
  [ApiErrorType.BAD_REQUEST]: 'BAD_REQUEST',
  [ApiErrorType.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
};

// Generate request ID
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Create standardized error
export function createApiError(
  type: ApiErrorType,
  message: string,
  details?: any,
  requestId?: string
): ApiError {
  return {
    type,
    message,
    code: ERROR_CODES[type],
    statusCode: HTTP_STATUS_CODES[type],
    details,
    timestamp: new Date().toISOString(),
    requestId: requestId || generateRequestId(),
  };
}

// Create success response
export function createApiSuccess<T>(
  data: T,
  message?: string,
  requestId?: string
): ApiSuccessResponse<T> {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
    requestId: requestId || generateRequestId(),
  };
}

// Create error response
export function createApiErrorResponse(
  error: ApiError
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error,
    },
    { status: error.statusCode }
  );
}

// Create success response
export function createApiSuccessResponse<T>(
  data: T,
  message?: string,
  requestId?: string
): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json(createApiSuccess(data, message, requestId), {
    status: 200,
  });
}

// Handle different error types
export function handleApiError(
  error: unknown,
  requestId?: string
): NextResponse<ApiErrorResponse> {
  console.error('[API Error]', { error, requestId });

  // Zod validation errors
  if (error instanceof ZodError) {
    const validationError = createApiError(
      ApiErrorType.VALIDATION_ERROR,
      'Validation failed',
      {
        issues: error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        })),
      },
      requestId
    );
    return createApiErrorResponse(validationError);
  }

  // Custom API errors
  if (error && typeof error === 'object' && 'type' in error) {
    const apiError = error as ApiError;
    return createApiErrorResponse(apiError);
  }

  // Generic errors
  if (error instanceof Error) {
    const internalError = createApiError(
      ApiErrorType.INTERNAL_SERVER_ERROR,
      process.env.NODE_ENV === 'production'
        ? 'An internal server error occurred'
        : error.message,
      process.env.NODE_ENV === 'development'
        ? { stack: error.stack }
        : undefined,
      requestId
    );
    return createApiErrorResponse(internalError);
  }

  // Unknown errors
  const unknownError = createApiError(
    ApiErrorType.INTERNAL_SERVER_ERROR,
    'An unknown error occurred',
    undefined,
    requestId
  );
  return createApiErrorResponse(unknownError);
}

// Enhanced wrapper for API route handlers with authentication
/**
 * Wraps a request handler with error handling, authentication, and rate limiting.
 *
 * This function first checks for rate limiting based on the request's IP address. If rate limits are exceeded, it returns an error response.
 * It then performs authentication checks based on the provided options, handling any authentication errors.
 * Finally, it executes the handler with optional retry logic, logging any errors that occur during the process.
 *
 * @param handler - A function that processes the request and returns a promise of a NextResponse.
 * @param options - An optional configuration object for authentication, rate limiting, and retry options.
 * @returns A function that takes a NextRequest and context, returning a promise of a NextResponse.
 */
export function withErrorHandling<T = any>(
  handler: (req: NextRequest, context?: any) => Promise<NextResponse<T>>,
  options?: {
    requireAuth?: boolean;
    requireAdmin?: boolean;
    requiredPermissions?: string[];
    rateLimit?: {
      limit: number;
      windowMs: number;
    };
    retry?: RetryOptions | boolean;
  }
) {
  return async (req: NextRequest, context?: any): Promise<NextResponse> => {
    const requestId = generateRequestId();

    try {
      // Rate limiting check
      if (options?.rateLimit) {
        const identifier =
          req.headers.get('x-forwarded-for') ||
          req.headers.get('x-real-ip') ||
          'unknown';

        if (
          !checkRateLimit(
            identifier,
            options.rateLimit.limit,
            options.rateLimit.windowMs
          )
        ) {
          const rateLimitError = ApiErrors.rateLimit(
            `Rate limit exceeded. Try again in ${Math.ceil(options.rateLimit.windowMs / 1000)} seconds`
          );
          return createApiErrorResponse(rateLimitError);
        }
      }

      // Authentication checks
      if (
        options?.requireAuth ||
        options?.requireAdmin ||
        options?.requiredPermissions
      ) {
        try {
          if (options.requireAdmin) {
            await requireAdmin(req);
          } else if (options.requiredPermissions) {
            await requireAuthWithContext(req, options.requiredPermissions);
          } else {
            await requireAuth(req);
          }
        } catch (authError) {
          return handleApiError(authError, requestId);
        }
      }

      // Execute handler with optional retry
      /**
       * Executes the handler and sets the X-Request-ID header.
       */
      const executeHandler = async () => {
        const response = await handler(req, context);
        response.headers.set('X-Request-ID', requestId);
        return response;
      };

      const response = options?.retry
        ? await withRetry(
            executeHandler,
            typeof options.retry === 'boolean'
              ? RetryPresets.standard
              : options.retry
          ).then(result => result.data)
        : await executeHandler();

      return response;
    } catch (error) {
      const errorResponse = handleApiError(error, requestId);

      // Log error with additional context
      if (errorResponse.status >= 400) {
        const errorBody = await errorResponse.json();
        logApiError(errorBody.error, req, {
          requestId,
          context,
          options,
        });
      }

      return errorResponse;
    }
  };
}

// Convenience wrappers for common authentication patterns
export const withAuth = <T = any>(
  handler: (req: NextRequest, context?: any) => Promise<NextResponse<T>>
) => withErrorHandling(handler, { requireAuth: true });

export const withAdmin = <T = any>(
  handler: (req: NextRequest, context?: any) => Promise<NextResponse<T>>
) => withErrorHandling(handler, { requireAdmin: true });

export const withPermissions = <T = any>(
  permissions: string[],
  handler: (req: NextRequest, context?: any) => Promise<NextResponse<T>>
) => withErrorHandling(handler, { requiredPermissions: permissions });

export const withRateLimit = <T = any>(
  limit: number,
  windowMs: number,
  handler: (req: NextRequest, context?: any) => Promise<NextResponse<T>>
) => withErrorHandling(handler, { rateLimit: { limit, windowMs } });

// Common error creators
export const ApiErrors = {
  validation: (message: string, details?: any, requestId?: string) =>
    createApiError(ApiErrorType.VALIDATION_ERROR, message, details, requestId),

  authentication: (
    message: string = 'Authentication required',
    requestId?: string
  ) =>
    createApiError(
      ApiErrorType.AUTHENTICATION_ERROR,
      message,
      undefined,
      requestId
    ),

  authorization: (
    message: string = 'Insufficient permissions',
    requestId?: string
  ) =>
    createApiError(
      ApiErrorType.AUTHORIZATION_ERROR,
      message,
      undefined,
      requestId
    ),

  notFound: (resource: string = 'Resource', requestId?: string) =>
    createApiError(
      ApiErrorType.NOT_FOUND,
      `${resource} not found`,
      undefined,
      requestId
    ),

  conflict: (message: string, details?: any, requestId?: string) =>
    createApiError(ApiErrorType.CONFLICT, message, details, requestId),

  rateLimit: (message: string = 'Rate limit exceeded', requestId?: string) =>
    createApiError(
      ApiErrorType.RATE_LIMIT_ERROR,
      message,
      undefined,
      requestId
    ),

  externalService: (service: string, message?: string, requestId?: string) =>
    createApiError(
      ApiErrorType.EXTERNAL_SERVICE_ERROR,
      message || `${service} service unavailable`,
      { service },
      requestId
    ),

  internal: (
    message: string = 'Internal server error',
    details?: any,
    requestId?: string
  ) =>
    createApiError(
      ApiErrorType.INTERNAL_SERVER_ERROR,
      message,
      details,
      requestId
    ),

  badRequest: (message: string, details?: any, requestId?: string) =>
    createApiError(ApiErrorType.BAD_REQUEST, message, details, requestId),

  unprocessableEntity: (message: string, details?: any, requestId?: string) =>
    createApiError(
      ApiErrorType.UNPROCESSABLE_ENTITY,
      message,
      details,
      requestId
    ),
};

// Validation helpers
export function validateRequest<T>(
  schema: any,
  data: unknown,
  requestId?: string
): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      throw createApiError(
        ApiErrorType.VALIDATION_ERROR,
        'Validation failed',
        {
          issues: error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message,
            code: issue.code,
          })),
        },
        requestId
      );
    }
    throw error;
  }
}

// Rate limiting helper
export function checkRateLimit(
  identifier: string,
  limit: number = 100,
  windowMs: number = 15 * 60 * 1000 // 15 minutes
): boolean {
  // This is a simple in-memory rate limiter
  // In production, use Redis or a proper rate limiting service
  const now = Date.now();
  const windowStart = now - windowMs;

  // Get or create rate limit data
  if (!global.rateLimitStore) {
    global.rateLimitStore = new Map();
  }

  const key = `rate_limit_${identifier}`;
  const requests = global.rateLimitStore.get(key) || [];

  // Filter requests within the window
  const recentRequests = requests.filter(
    (timestamp: number) => timestamp > windowStart
  );

  // Check if limit exceeded
  if (recentRequests.length >= limit) {
    return false;
  }

  // Add current request
  recentRequests.push(now);
  global.rateLimitStore.set(key, recentRequests);

  return true;
}

// Authentication helpers
export async function requireAuth(
  req: NextRequest
): Promise<{ userId: string; user: any; session: any }> {
  try {
    // Extract session from cookies
    const sessionToken = req.cookies.get('session_token')?.value;
    const sessionData = req.cookies.get('session_data')?.value;

    if (!sessionToken || !sessionData) {
      throw ApiErrors.authentication('No session found');
    }

    // Verify session with Better Auth
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session) {
      throw ApiErrors.authentication('Invalid or expired session');
    }

    // Get user data from database
    const prisma = new PrismaClient();
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        lastLoginMethod: true,
      },
    });

    if (!user) {
      throw ApiErrors.authentication('User not found');
    }

    // Check if session is still valid
    const now = new Date();
    if (
      session.session.expiresAt &&
      new Date(session.session.expiresAt) < now
    ) {
      throw ApiErrors.authentication('Session expired');
    }

    return {
      userId: user.id,
      user,
      session,
    };
  } catch (error) {
    if (error && typeof error === 'object' && 'type' in error) {
      throw error; // Re-throw API errors
    }

    // Handle authentication errors
    if (error instanceof Error) {
      if (
        error.message.includes('session') ||
        error.message.includes('token')
      ) {
        throw ApiErrors.authentication(error.message);
      }
    }

    throw ApiErrors.authentication('Authentication failed');
  }
}

// Optional authentication helper (doesn't throw if no auth)
export async function getOptionalAuth(
  req: NextRequest
): Promise<{ userId: string; user: any; session: any } | null> {
  try {
    return await requireAuth(req);
  } catch {
    return null;
  }
}

// Admin-only authentication helper
export async function requireAdmin(
  req: NextRequest
): Promise<{ userId: string; user: any; session: any }> {
  const authResult = await requireAuth(req);

  // TODO: Check if user has admin privileges
  // This would depend on your user role system
  // For now, we'll check if the user email contains 'admin' or is a specific admin email
  const prisma = new PrismaClient();
  const adminUser = await prisma.user.findUnique({
    where: { id: authResult.userId },
    select: { email: true },
  });

  if (!adminUser || !adminUser.email?.includes('admin')) {
    throw ApiErrors.authorization('Admin privileges required');
  }

  return authResult;
}

// Enhanced authentication with user context
export async function requireAuthWithContext(
  req: NextRequest,
  requiredPermissions?: string[]
): Promise<{
  userId: string;
  user: any;
  session: any;
  permissions: string[];
}> {
  const authResult = await requireAuth(req);

  // Get user permissions/roles from database
  // TODO: For now, we'll use a simple permission system based on user properties
  const prisma = new PrismaClient();
  const userPermissions = await prisma.user.findUnique({
    where: { id: authResult.userId },
    select: {
      email: true,
      emailVerified: true,
    },
  });

  // Simple permission system - can be extended based on your needs
  const permissions: string[] = [];
  if (userPermissions?.emailVerified) {
    permissions.push('verified');
  }
  if (userPermissions?.email?.includes('admin')) {
    permissions.push('admin');
  }

  // Check required permissions if specified
  if (requiredPermissions && requiredPermissions.length > 0) {
    const hasRequiredPermissions = requiredPermissions.every(permission =>
      permissions.includes(permission)
    );

    if (!hasRequiredPermissions) {
      throw ApiErrors.authorization(
        `Missing required permissions: ${requiredPermissions.join(', ')}`
      );
    }
  }

  return {
    ...authResult,
    permissions,
  };
}

// API key authentication helper
export async function requireApiKey(
  req: NextRequest
): Promise<{ apiKey: string; client: any }> {
  const apiKey =
    req.headers.get('x-api-key') ||
    req.headers.get('authorization')?.replace('Bearer ', '');

  if (!apiKey) {
    throw ApiErrors.authentication('API key required');
  }

  // For now, we'll use a simple API key validation
  // TODO: In a real implementation, you'd store API keys in the database
  const validApiKeys = process.env.VALID_API_KEYS?.split(',') || [];

  if (!validApiKeys.includes(apiKey)) {
    throw ApiErrors.authentication('Invalid API key');
  }

  // Simulate client data
  const client = {
    key: apiKey,
    active: true,
    user: { id: 'api_user', email: 'api@example.com' },
  };

  return { apiKey, client };
}

// Rate limiting with user context
export function checkRateLimitWithUser(
  identifier: string,
  userId?: string,
  limit: number = 100,
  windowMs: number = 15 * 60 * 1000
): boolean {
  // Use user ID if available, otherwise fall back to identifier
  const rateLimitKey = userId ? `user_${userId}` : identifier;
  return checkRateLimit(rateLimitKey, limit, windowMs);
}

// Logging helper with enhanced context
export function logApiError(
  error: ApiError,
  req: NextRequest,
  additionalContext?: any
) {
  const logData = {
    error: {
      type: error.type,
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      details: error.details,
    },
    request: {
      method: req.method,
      url: req.url,
      headers: Object.fromEntries(req.headers.entries()),
      requestId: error.requestId,
      userAgent: req.headers.get('user-agent'),
      ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
    },
    timestamp: error.timestamp,
    environment: {
      nodeEnv: process.env.NODE_ENV,
      version: process.env.npm_package_version,
    },
    ...additionalContext,
  };

  if (error.statusCode >= 500) {
    console.error('[API Error - Server Error]', logData);
  } else if (error.statusCode >= 400) {
    console.warn('[API Error - Client Error]', logData);
  }
}

// Global rate limit store type
declare global {
  var rateLimitStore: Map<string, number[]> | undefined;
}
