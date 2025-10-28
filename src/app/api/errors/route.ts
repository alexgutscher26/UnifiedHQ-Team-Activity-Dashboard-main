import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import {
  withErrorHandling,
  createApiSuccessResponse,
} from '@/lib/api-error-handler';
import { validateRequestBody } from '@/lib/api-validation';
import { z } from 'zod';

// Error report schema
const errorReportSchema = z.object({
  error: z.object({
    message: z.string(),
    stack: z.string().optional(),
    name: z.string().optional(),
  }),
  errorInfo: z
    .object({
      componentStack: z.string().optional(),
    })
    .optional(),
  errorId: z.string().optional(),
  url: z.string().url().optional(),
  userAgent: z.string().optional(),
  timestamp: z.string().optional(),
});

/**
 * Report an error by logging it and associating it with a user session.
 *
 * The function retrieves the user session from the request headers, validates the request body against a schema,
 * and logs the error details to the server console for debugging purposes.
 *
 * @param request - The NextRequest object containing the request data.
 * @returns A success response indicating that the error report was received.
 */
async function reportError(request: NextRequest) {
  // Get the session to associate errors with users
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  const errorData = validateRequestBody(
    errorReportSchema,
    await request.json()
  );

  // Log error details to console for debugging
  console.error('Client Error Report:', {
    error: errorData.error,
    errorInfo: errorData.errorInfo,
    errorId: errorData.errorId,
    url: errorData.url,
    userAgent: errorData.userAgent,
    timestamp: errorData.timestamp || new Date().toISOString(),
    userId: session?.user?.id || 'anonymous',
    environment: process.env.NODE_ENV,
  });

  return createApiSuccessResponse(
    { received: true },
    'Error report received successfully'
  );
}

export const POST = withErrorHandling(reportError);
