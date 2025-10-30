// Next.js Middleware for caching and request handling

import { NextRequest, NextResponse } from 'next/server';
import { withCache } from '@/middleware/cache-middleware';
import { applyEdgeMiddleware } from '@/lib/cdn/edge-middleware';

/**
 * Middleware function to handle requests and apply caching and edge optimizations.
 *
 * The function first checks if the request is for internal Next.js routes and skips processing if so.
 * For API routes, it applies caching middleware and handles any errors that may occur.
 * Finally, it applies edge middleware for CDN optimization, enabling various features such as caching, optimization, compression, and security headers.
 *
 * @param request - The NextRequest object representing the incoming request.
 * @returns A NextResponse object representing the response to the request.
 */
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Skip middleware for Next.js internal routes
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/_vercel/') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  let response: NextResponse;

  // Apply caching middleware to API routes
  if (pathname.startsWith('/api/')) {
    try {
      // Create a handler that continues to the actual API route
      /**
       * Handles the incoming request and returns the next response.
       */
      const handler = async (req: NextRequest) => {
        return NextResponse.next();
      };

      // Apply caching middleware
      response = await withCache(request, handler);
    } catch (error) {
      console.error('Cache middleware error:', error);
      response = NextResponse.next();
    }
  } else {
    // For non-API routes, continue normally
    response = NextResponse.next();
  }

  // Apply edge middleware for CDN optimization
  try {
    response = await applyEdgeMiddleware(request, response, {
      enableCaching: true,
      enableOptimization: true,
      enableCompression: true,
      enableSecurityHeaders: true,
    });
  } catch (error) {
    console.error('Edge middleware error:', error);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
