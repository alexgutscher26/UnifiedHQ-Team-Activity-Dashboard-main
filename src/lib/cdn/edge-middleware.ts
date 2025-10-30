// Enhanced middleware for Vercel Edge Network integration
// Applies CDN caching rules and optimization headers

import { NextRequest, NextResponse } from 'next/server';
import { EdgeConfig, type EdgeCacheRule } from './edge-config';

export interface EdgeMiddlewareOptions {
  enableCaching?: boolean;
  enableOptimization?: boolean;
  enableCompression?: boolean;
  enableSecurityHeaders?: boolean;
}

export class EdgeMiddleware {
  private options: EdgeMiddlewareOptions;

  constructor(options: EdgeMiddlewareOptions = {}) {
    this.options = {
      enableCaching: true,
      enableOptimization: true,
      enableCompression: true,
      enableSecurityHeaders: true,
      ...options,
    };
  }

  /**
   * Apply edge caching and optimization to response
   */
  async process(
    request: NextRequest,
    response: NextResponse
  ): Promise<NextResponse> {
    const pathname = request.nextUrl.pathname;
    const method = request.method;

    // Skip processing for non-cacheable requests
    if (!EdgeConfig.shouldCache(pathname, method)) {
      return this.addSecurityHeaders(response);
    }

    // Get cache rule for this path
    const cacheRule = EdgeConfig.getCacheRule(pathname);
    if (!cacheRule) {
      return this.addSecurityHeaders(response);
    }

    // Apply caching headers
    if (this.options.enableCaching) {
      this.applyCacheHeaders(response, cacheRule, pathname);
    }

    // Apply optimization headers
    if (this.options.enableOptimization) {
      this.applyOptimizationHeaders(response, pathname);
    }

    // Apply compression headers
    if (this.options.enableCompression) {
      this.applyCompressionHeaders(response, request);
    }

    // Apply security headers
    if (this.options.enableSecurityHeaders) {
      this.addSecurityHeaders(response);
    }

    return response;
  }

  /**
   * Apply cache headers based on edge configuration
   */
  private applyCacheHeaders(
    response: NextResponse,
    rule: EdgeCacheRule,
    pathname: string
  ): void {
    // Set Cache-Control header
    const cacheControl = EdgeConfig.generateCacheControl(rule);
    response.headers.set('Cache-Control', cacheControl);

    // Set CDN-specific cache control for Vercel Edge
    const cdnCacheControl = EdgeConfig.generateCDNCacheControl(rule);
    response.headers.set('CDN-Cache-Control', cdnCacheControl);

    // Set cache tags for invalidation
    const cacheTags = EdgeConfig.generateCacheTags(rule, pathname);
    if (cacheTags.length > 0) {
      response.headers.set('Cache-Tag', cacheTags.join(','));
    }

    // Set ETag for conditional requests
    if (!response.headers.has('ETag')) {
      const etag = this.generateETag(pathname);
      response.headers.set('ETag', etag);
    }

    // Set Last-Modified for static assets
    if (rule.immutable && !response.headers.has('Last-Modified')) {
      const lastModified = new Date().toUTCString();
      response.headers.set('Last-Modified', lastModified);
    }

    // Set Vary header for content negotiation
    if (this.shouldVaryByAcceptEncoding(pathname)) {
      const existingVary = response.headers.get('Vary') || '';
      const varyHeaders = new Set(
        existingVary
          .split(',')
          .map(h => h.trim())
          .filter(Boolean)
      );
      varyHeaders.add('Accept-Encoding');
      response.headers.set('Vary', Array.from(varyHeaders).join(', '));
    }
  }

  /**
   * Apply optimization headers for assets
   */
  private applyOptimizationHeaders(
    response: NextResponse,
    pathname: string
  ): void {
    // Image optimization hints
    if (this.isImagePath(pathname)) {
      const optimization = EdgeConfig.getOptimization('images');

      // Add image optimization headers
      response.headers.set('X-Content-Type-Options', 'nosniff');

      // Suggest WebP/AVIF support
      if (optimization.webp || optimization.avif) {
        response.headers.set(
          'Accept-CH',
          'Sec-CH-UA, Sec-CH-UA-Mobile, Sec-CH-UA-Platform, Sec-CH-Prefers-Color-Scheme'
        );
      }
    }

    // Font optimization
    if (this.isFontPath(pathname)) {
      response.headers.set('Access-Control-Allow-Origin', '*');
      response.headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
    }

    // JavaScript/CSS optimization
    if (this.isAssetPath(pathname)) {
      response.headers.set('X-Content-Type-Options', 'nosniff');

      // Preload hints for critical resources
      if (pathname.includes('critical') || pathname.includes('main')) {
        response.headers.set('X-Critical-Resource', 'true');
      }
    }
  }

  /**
   * Apply compression headers
   */
  private applyCompressionHeaders(
    response: NextResponse,
    request: NextRequest
  ): void {
    const acceptEncoding = request.headers.get('Accept-Encoding') || '';
    const contentType = response.headers.get('Content-Type') || '';

    // Check if content should be compressed
    if (this.shouldCompress(contentType)) {
      // Prefer Brotli over Gzip
      if (acceptEncoding.includes('br')) {
        response.headers.set('Content-Encoding', 'br');
      } else if (acceptEncoding.includes('gzip')) {
        response.headers.set('Content-Encoding', 'gzip');
      }
    }
  }

  /**
   * Add security headers
   */
  private addSecurityHeaders(response: NextResponse): NextResponse {
    // Content Security Policy
    if (!response.headers.has('Content-Security-Policy')) {
      const csp = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https: blob:",
        "font-src 'self' data:",
        "connect-src 'self' https: wss:",
        "frame-ancestors 'none'",
      ].join('; ');
      response.headers.set('Content-Security-Policy', csp);
    }

    // Security headers
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=()'
    );

    // HSTS for HTTPS
    if (process.env.NODE_ENV === 'production') {
      response.headers.set(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload'
      );
    }

    return response;
  }

  /**
   * Generate ETag for caching
   */
  private generateETag(pathname: string): string {
    const timestamp = Date.now();
    // Use TextEncoder and btoa for Edge Runtime compatibility
    const encoder = new TextEncoder();
    const data = encoder.encode(pathname);
    const hash = btoa(String.fromCharCode(...data)).slice(0, 8);
    return `"${timestamp}-${hash}"`;
  }

  /**
   * Check if path is an image
   */
  private isImagePath(pathname: string): boolean {
    return /\.(jpg|jpeg|png|gif|webp|avif|svg|ico)$/i.test(pathname);
  }

  /**
   * Check if path is a font
   */
  private isFontPath(pathname: string): boolean {
    return /\.(woff|woff2|eot|ttf|otf)$/i.test(pathname);
  }

  /**
   * Check if path is a static asset
   */
  private isAssetPath(pathname: string): boolean {
    return (
      /\.(css|js|json)$/i.test(pathname) || pathname.startsWith('/static/')
    );
  }

  /**
   * Check if content should be compressed
   */
  private shouldCompress(contentType: string): boolean {
    const compressibleTypes = [
      'text/',
      'application/json',
      'application/javascript',
      'application/xml',
      'image/svg+xml',
    ];

    return compressibleTypes.some(type => contentType.includes(type));
  }

  /**
   * Check if should vary by Accept-Encoding
   */
  private shouldVaryByAcceptEncoding(pathname: string): boolean {
    // Vary by Accept-Encoding for compressible content
    return (
      this.isAssetPath(pathname) ||
      pathname.startsWith('/api/') ||
      pathname.endsWith('.html')
    );
  }
}

/**
 * Create edge middleware instance with default options
 */
export function createEdgeMiddleware(
  options?: EdgeMiddlewareOptions
): EdgeMiddleware {
  return new EdgeMiddleware(options);
}

/**
 * Utility function to apply edge middleware to a response
 */
export async function applyEdgeMiddleware(
  request: NextRequest,
  response: NextResponse,
  options?: EdgeMiddlewareOptions
): Promise<NextResponse> {
  const middleware = createEdgeMiddleware(options);
  return middleware.process(request, response);
}
