// Next.js Middleware for caching and request handling

import { NextRequest, NextResponse } from 'next/server';
import { withCache } from '@/middleware/cache-middleware';
import { applyEdgeMiddleware } from '@/lib/cdn/edge-middleware';

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
