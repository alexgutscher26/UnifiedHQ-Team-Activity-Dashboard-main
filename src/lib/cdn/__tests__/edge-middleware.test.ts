import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert';
import { NextRequest, NextResponse } from 'next/server';
import {
  EdgeMiddleware,
  createEdgeMiddleware,
  applyEdgeMiddleware,
} from '../edge-middleware';

// Mock EdgeConfig
const mockEdgeConfig = {
  shouldCache: mock.fn(),
  getCacheRule: mock.fn(),
  generateCacheControl: mock.fn(),
  generateCDNCacheControl: mock.fn(),
  generateCacheTags: mock.fn(),
};

// Replace EdgeConfig import with mock
mock.module('../edge-config', () => ({
  EdgeConfig: mockEdgeConfig,
}));

describe('EdgeMiddleware', () => {
  let middleware: EdgeMiddleware;
  let mockRequest: NextRequest;
  let mockResponse: NextResponse;

  beforeEach(() => {
    // Reset all mocks
    mockEdgeConfig.shouldCache.mock.resetCalls();
    mockEdgeConfig.getCacheRule.mock.resetCalls();
    mockEdgeConfig.generateCacheControl.mock.resetCalls();
    mockEdgeConfig.generateCDNCacheControl.mock.resetCalls();
    mockEdgeConfig.generateCacheTags.mock.resetCalls();

    // Create middleware instance
    middleware = new EdgeMiddleware();

    // Create mock request
    mockRequest = new NextRequest('https://example.com/api/test', {
      method: 'GET',
      headers: {
        'Accept-Encoding': 'gzip, br',
        'User-Agent': 'test-agent',
      },
    });

    // Create mock response
    mockResponse = new NextResponse('test response', {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  });

  describe('constructor', () => {
    it('should create middleware with default options', () => {
      const defaultMiddleware = new EdgeMiddleware();
      assert.ok(defaultMiddleware);
    });

    it('should create middleware with custom options', () => {
      const customMiddleware = new EdgeMiddleware({
        enableCaching: false,
        enableOptimization: false,
        enableCompression: false,
        enableSecurityHeaders: false,
      });
      assert.ok(customMiddleware);
    });
  });

  describe('process', () => {
    it('should skip processing for non-cacheable requests', async () => {
      mockEdgeConfig.shouldCache.mock.mockImplementationOnce(() => false);

      const result = await middleware.process(mockRequest, mockResponse);

      assert.strictEqual(mockEdgeConfig.shouldCache.mock.callCount(), 1);
      assert.strictEqual(mockEdgeConfig.getCacheRule.mock.callCount(), 0);
      assert.ok(result instanceof NextResponse);
    });

    it('should skip processing when no cache rule found', async () => {
      mockEdgeConfig.shouldCache.mock.mockImplementationOnce(() => true);
      mockEdgeConfig.getCacheRule.mock.mockImplementationOnce(() => null);

      const result = await middleware.process(mockRequest, mockResponse);

      assert.strictEqual(mockEdgeConfig.shouldCache.mock.callCount(), 1);
      assert.strictEqual(mockEdgeConfig.getCacheRule.mock.callCount(), 1);
      assert.ok(result instanceof NextResponse);
    });

    it('should apply all middleware features when cache rule exists', async () => {
      const mockCacheRule = {
        pattern: '/api/**',
        maxAge: 300,
        staleWhileRevalidate: 600,
        public: true,
        tags: ['api', 'test'],
      };

      mockEdgeConfig.shouldCache.mock.mockImplementationOnce(() => true);
      mockEdgeConfig.getCacheRule.mock.mockImplementationOnce(
        () => mockCacheRule
      );
      mockEdgeConfig.generateCacheControl.mock.mockImplementationOnce(
        () => 'public, max-age=300'
      );
      mockEdgeConfig.generateCDNCacheControl.mock.mockImplementationOnce(
        () => 'public, max-age=60'
      );
      mockEdgeConfig.generateCacheTags.mock.mockImplementationOnce(() => [
        'api',
        'test',
      ]);

      const result = await middleware.process(mockRequest, mockResponse);

      assert.strictEqual(mockEdgeConfig.shouldCache.mock.callCount(), 1);
      assert.strictEqual(mockEdgeConfig.getCacheRule.mock.callCount(), 1);
      assert.strictEqual(
        mockEdgeConfig.generateCacheControl.mock.callCount(),
        1
      );
      assert.strictEqual(
        mockEdgeConfig.generateCDNCacheControl.mock.callCount(),
        1
      );
      assert.strictEqual(mockEdgeConfig.generateCacheTags.mock.callCount(), 1);

      // Check that cache headers were applied
      assert.strictEqual(
        result.headers.get('Cache-Control'),
        'public, max-age=300'
      );
      assert.strictEqual(
        result.headers.get('CDN-Cache-Control'),
        'public, max-age=60'
      );
      assert.strictEqual(result.headers.get('Cache-Tag'), 'api,test');
      assert.ok(result.headers.has('ETag'));
    });
  });

  describe('cache headers', () => {
    beforeEach(() => {
      mockEdgeConfig.shouldCache.mock.mockImplementation(() => true);
      mockEdgeConfig.generateCacheControl.mock.mockImplementation(
        () => 'public, max-age=300'
      );
      mockEdgeConfig.generateCDNCacheControl.mock.mockImplementation(
        () => 'public, max-age=60'
      );
      mockEdgeConfig.generateCacheTags.mock.mockImplementation(() => ['api']);
    });

    it('should set ETag header when not present', async () => {
      const mockCacheRule = {
        pattern: '/api/**',
        maxAge: 300,
        public: true,
        tags: ['api'],
      };
      mockEdgeConfig.getCacheRule.mock.mockImplementationOnce(
        () => mockCacheRule
      );

      const result = await middleware.process(mockRequest, mockResponse);

      assert.ok(result.headers.has('ETag'));
      const etag = result.headers.get('ETag');
      assert.ok(etag?.startsWith('"'));
      assert.ok(etag?.endsWith('"'));
    });

    it('should not override existing ETag header', async () => {
      const mockCacheRule = {
        pattern: '/api/**',
        maxAge: 300,
        public: true,
        tags: ['api'],
      };
      mockEdgeConfig.getCacheRule.mock.mockImplementationOnce(
        () => mockCacheRule
      );

      mockResponse.headers.set('ETag', '"existing-etag"');

      const result = await middleware.process(mockRequest, mockResponse);

      assert.strictEqual(result.headers.get('ETag'), '"existing-etag"');
    });

    it('should set Last-Modified for immutable assets', async () => {
      const mockCacheRule = {
        pattern: '/static/**',
        maxAge: 31536000,
        immutable: true,
        public: true,
        tags: ['static'],
      };
      mockEdgeConfig.getCacheRule.mock.mockImplementationOnce(
        () => mockCacheRule
      );

      const result = await middleware.process(mockRequest, mockResponse);

      assert.ok(result.headers.has('Last-Modified'));
    });

    it('should set Vary header for compressible content', async () => {
      const mockCacheRule = {
        pattern: '/api/**',
        maxAge: 300,
        public: true,
        tags: ['api'],
      };
      mockEdgeConfig.getCacheRule.mock.mockImplementationOnce(
        () => mockCacheRule
      );

      const result = await middleware.process(mockRequest, mockResponse);

      assert.ok(result.headers.get('Vary')?.includes('Accept-Encoding'));
    });

    it('should preserve existing Vary headers', async () => {
      const mockCacheRule = {
        pattern: '/api/**',
        maxAge: 300,
        public: true,
        tags: ['api'],
      };
      mockEdgeConfig.getCacheRule.mock.mockImplementationOnce(
        () => mockCacheRule
      );

      mockResponse.headers.set('Vary', 'Accept-Language');

      const result = await middleware.process(mockRequest, mockResponse);

      const varyHeader = result.headers.get('Vary');
      assert.ok(varyHeader?.includes('Accept-Language'));
      assert.ok(varyHeader?.includes('Accept-Encoding'));
    });
  });

  describe('optimization headers', () => {
    beforeEach(() => {
      mockEdgeConfig.shouldCache.mock.mockImplementation(() => true);
      mockEdgeConfig.getCacheRule.mock.mockImplementation(() => ({
        pattern: '**/*',
        maxAge: 300,
        public: true,
        tags: ['test'],
      }));
      mockEdgeConfig.generateCacheControl.mock.mockImplementation(
        () => 'public, max-age=300'
      );
      mockEdgeConfig.generateCDNCacheControl.mock.mockImplementation(
        () => 'public, max-age=60'
      );
      mockEdgeConfig.generateCacheTags.mock.mockImplementation(() => ['test']);
    });

    it('should add image optimization headers for image paths', async () => {
      const imageRequest = new NextRequest(
        'https://example.com/images/logo.png'
      );

      const result = await middleware.process(imageRequest, mockResponse);

      assert.strictEqual(
        result.headers.get('X-Content-Type-Options'),
        'nosniff'
      );
      assert.ok(result.headers.has('Accept-CH'));
    });

    it('should add font optimization headers for font paths', async () => {
      const fontRequest = new NextRequest(
        'https://example.com/fonts/main.woff2'
      );

      const result = await middleware.process(fontRequest, mockResponse);

      assert.strictEqual(
        result.headers.get('Access-Control-Allow-Origin'),
        '*'
      );
      assert.strictEqual(
        result.headers.get('Cross-Origin-Resource-Policy'),
        'cross-origin'
      );
    });

    it('should add asset optimization headers for CSS/JS', async () => {
      const assetRequest = new NextRequest(
        'https://example.com/static/main.css'
      );

      const result = await middleware.process(assetRequest, mockResponse);

      assert.strictEqual(
        result.headers.get('X-Content-Type-Options'),
        'nosniff'
      );
    });

    it('should mark critical resources', async () => {
      const criticalRequest = new NextRequest(
        'https://example.com/static/critical.css'
      );

      const result = await middleware.process(criticalRequest, mockResponse);

      assert.strictEqual(result.headers.get('X-Critical-Resource'), 'true');
    });
  });

  describe('compression headers', () => {
    beforeEach(() => {
      mockEdgeConfig.shouldCache.mock.mockImplementation(() => true);
      mockEdgeConfig.getCacheRule.mock.mockImplementation(() => ({
        pattern: '**/*',
        maxAge: 300,
        public: true,
        tags: ['test'],
      }));
      mockEdgeConfig.generateCacheControl.mock.mockImplementation(
        () => 'public, max-age=300'
      );
      mockEdgeConfig.generateCDNCacheControl.mock.mockImplementation(
        () => 'public, max-age=60'
      );
      mockEdgeConfig.generateCacheTags.mock.mockImplementation(() => ['test']);
    });

    it('should prefer Brotli compression when supported', async () => {
      const brRequest = new NextRequest('https://example.com/api/test', {
        headers: { 'Accept-Encoding': 'gzip, br' },
      });

      const jsonResponse = new NextResponse('{}', {
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await middleware.process(brRequest, jsonResponse);

      assert.strictEqual(result.headers.get('Content-Encoding'), 'br');
    });

    it('should fallback to Gzip when Brotli not supported', async () => {
      const gzipRequest = new NextRequest('https://example.com/api/test', {
        headers: { 'Accept-Encoding': 'gzip' },
      });

      const jsonResponse = new NextResponse('{}', {
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await middleware.process(gzipRequest, jsonResponse);

      assert.strictEqual(result.headers.get('Content-Encoding'), 'gzip');
    });

    it('should not compress non-compressible content', async () => {
      const imageResponse = new NextResponse('binary-data', {
        headers: { 'Content-Type': 'image/png' },
      });

      const result = await middleware.process(mockRequest, imageResponse);

      assert.strictEqual(result.headers.get('Content-Encoding'), null);
    });
  });

  describe('security headers', () => {
    it('should add comprehensive security headers', async () => {
      mockEdgeConfig.shouldCache.mock.mockImplementationOnce(() => false);

      const result = await middleware.process(mockRequest, mockResponse);

      // Check security headers
      assert.ok(result.headers.has('Content-Security-Policy'));
      assert.strictEqual(result.headers.get('X-Frame-Options'), 'DENY');
      assert.strictEqual(
        result.headers.get('X-Content-Type-Options'),
        'nosniff'
      );
      assert.strictEqual(
        result.headers.get('Referrer-Policy'),
        'strict-origin-when-cross-origin'
      );
      assert.ok(result.headers.has('Permissions-Policy'));
    });

    it('should add HSTS header in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      mockEdgeConfig.shouldCache.mock.mockImplementationOnce(() => false);

      const result = await middleware.process(mockRequest, mockResponse);

      assert.ok(result.headers.has('Strict-Transport-Security'));
      assert.ok(
        result.headers
          .get('Strict-Transport-Security')
          ?.includes('max-age=31536000')
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should not override existing CSP header', async () => {
      mockEdgeConfig.shouldCache.mock.mockImplementationOnce(() => false);
      mockResponse.headers.set('Content-Security-Policy', "default-src 'self'");

      const result = await middleware.process(mockRequest, mockResponse);

      assert.strictEqual(
        result.headers.get('Content-Security-Policy'),
        "default-src 'self'"
      );
    });
  });

  describe('disabled features', () => {
    it('should skip caching when disabled', async () => {
      const noCacheMiddleware = new EdgeMiddleware({ enableCaching: false });

      mockEdgeConfig.shouldCache.mock.mockImplementationOnce(() => true);
      mockEdgeConfig.getCacheRule.mock.mockImplementationOnce(() => ({
        pattern: '/api/**',
        maxAge: 300,
        public: true,
        tags: ['api'],
      }));

      const result = await noCacheMiddleware.process(mockRequest, mockResponse);

      assert.strictEqual(
        mockEdgeConfig.generateCacheControl.mock.callCount(),
        0
      );
      assert.strictEqual(result.headers.get('Cache-Control'), null);
    });

    it('should skip optimization when disabled', async () => {
      const noOptMiddleware = new EdgeMiddleware({ enableOptimization: false });

      mockEdgeConfig.shouldCache.mock.mockImplementationOnce(() => false);

      const imageRequest = new NextRequest(
        'https://example.com/images/logo.png'
      );
      const result = await noOptMiddleware.process(imageRequest, mockResponse);

      assert.strictEqual(result.headers.get('Accept-CH'), null);
    });

    it('should skip compression when disabled', async () => {
      const noCompMiddleware = new EdgeMiddleware({ enableCompression: false });

      mockEdgeConfig.shouldCache.mock.mockImplementationOnce(() => false);

      const jsonResponse = new NextResponse('{}', {
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await noCompMiddleware.process(mockRequest, jsonResponse);

      assert.strictEqual(result.headers.get('Content-Encoding'), null);
    });

    it('should skip security headers when disabled', async () => {
      const noSecMiddleware = new EdgeMiddleware({
        enableSecurityHeaders: false,
      });

      mockEdgeConfig.shouldCache.mock.mockImplementationOnce(() => false);

      const result = await noSecMiddleware.process(mockRequest, mockResponse);

      assert.strictEqual(result.headers.get('X-Frame-Options'), null);
      assert.strictEqual(result.headers.get('Content-Security-Policy'), null);
    });
  });
});

describe('utility functions', () => {
  beforeEach(() => {
    // Reset mocks
    mockEdgeConfig.shouldCache.mock.resetCalls();
    mockEdgeConfig.getCacheRule.mock.resetCalls();
  });

  describe('createEdgeMiddleware', () => {
    it('should create middleware with default options', () => {
      const middleware = createEdgeMiddleware();
      assert.ok(middleware instanceof EdgeMiddleware);
    });

    it('should create middleware with custom options', () => {
      const middleware = createEdgeMiddleware({ enableCaching: false });
      assert.ok(middleware instanceof EdgeMiddleware);
    });
  });

  describe('applyEdgeMiddleware', () => {
    it('should apply middleware to request/response', async () => {
      mockEdgeConfig.shouldCache.mock.mockImplementationOnce(() => false);

      const request = new NextRequest('https://example.com/test');
      const response = new NextResponse('test');

      const result = await applyEdgeMiddleware(request, response);

      assert.ok(result instanceof NextResponse);
      assert.ok(result.headers.has('X-Frame-Options'));
    });

    it('should apply middleware with custom options', async () => {
      mockEdgeConfig.shouldCache.mock.mockImplementationOnce(() => false);

      const request = new NextRequest('https://example.com/test');
      const response = new NextResponse('test');

      const result = await applyEdgeMiddleware(request, response, {
        enableSecurityHeaders: false,
      });

      assert.ok(result instanceof NextResponse);
      assert.strictEqual(result.headers.get('X-Frame-Options'), null);
    });
  });
});
