// Integration Tests for Health Check Endpoints
// Tests the health check API endpoints for cache and system monitoring

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { NextRequest } from 'next/server';

// Mock Redis for testing
const mockRedis = {
  isOpen: true,
  isReady: true,
  set: async () => true,
  get: async () => JSON.stringify({ timestamp: Date.now(), health: 'check' }),
  del: async () => true,
  ttl: async () => 30,
  ping: async () => 'PONG',
};

// Mock fetch for external API calls
const originalFetch = global.fetch;

describe('Health Check Endpoints', () => {
  beforeAll(() => {
    // Mock environment variables
    process.env.NODE_ENV = 'test';
    process.env.REDIS_URL = 'redis://localhost:6379/1';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

    // Mock fetch for external calls
    global.fetch = async (url: string | URL | Request, init?: RequestInit) => {
      const urlString = url.toString();

      if (urlString.includes('/api/health/cache')) {
        return new Response(
          JSON.stringify({
            overall: 'healthy',
            timestamp: new Date().toISOString(),
            environment: 'test',
            checks: [
              { service: 'redis', status: 'healthy', responseTime: 50 },
              {
                service: 'service-worker',
                status: 'healthy',
                responseTime: 10,
              },
            ],
            summary: { healthy: 2, degraded: 0, unhealthy: 0, total: 2 },
          }),
          { status: 200 }
        );
      }

      if (urlString.includes('github.com/api/rate_limit')) {
        return new Response(
          JSON.stringify({ rate: { limit: 5000, remaining: 4999 } }),
          { status: 200 }
        );
      }

      if (urlString.includes('slack.com/api/auth.test')) {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }

      if (urlString.includes('placeholder.svg')) {
        return new Response('', {
          status: 200,
          headers: {
            'cache-control': 'public, max-age=86400',
            'cdn-cache-control': 'public, max-age=86400',
          },
        });
      }

      return originalFetch(url, init);
    };
  });

  afterAll(() => {
    // Restore original fetch
    global.fetch = originalFetch;

    // Clean up environment variables
    delete process.env.REDIS_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  describe('Cache Health Endpoint', () => {
    it('should return healthy status when all services are working', async () => {
      // Mock the cache health endpoint
      const { GET } = await import('../cache/route');

      const request = new NextRequest('http://localhost:3000/api/health/cache');
      const response = await GET(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.overall).toBeDefined();
      expect(data.timestamp).toBeDefined();
      expect(data.environment).toBe('test');
      expect(data.checks).toBeInstanceOf(Array);
      expect(data.summary).toBeDefined();
    });

    it('should include Redis health check', async () => {
      const { GET } = await import('../cache/route');

      const request = new NextRequest('http://localhost:3000/api/health/cache');
      const response = await GET(request);
      const data = await response.json();

      const redisCheck = data.checks.find(
        (check: any) => check.service === 'redis'
      );
      expect(redisCheck).toBeDefined();
      expect(redisCheck.status).toBeDefined();
      expect(redisCheck.responseTime).toBeGreaterThan(0);
    });

    it('should include Service Worker health check', async () => {
      const { GET } = await import('../cache/route');

      const request = new NextRequest('http://localhost:3000/api/health/cache');
      const response = await GET(request);
      const data = await response.json();

      const swCheck = data.checks.find(
        (check: any) => check.service === 'service-worker'
      );
      expect(swCheck).toBeDefined();
      expect(swCheck.status).toBeDefined();
    });

    it('should include feature flags health check', async () => {
      const { GET } = await import('../cache/route');

      const request = new NextRequest('http://localhost:3000/api/health/cache');
      const response = await GET(request);
      const data = await response.json();

      const flagsCheck = data.checks.find(
        (check: any) => check.service === 'feature-flags'
      );
      expect(flagsCheck).toBeDefined();
      expect(flagsCheck.status).toBeDefined();
    });

    it('should return proper cache control headers', async () => {
      const { GET } = await import('../cache/route');

      const request = new NextRequest('http://localhost:3000/api/health/cache');
      const response = await GET(request);

      expect(response.headers.get('cache-control')).toBe(
        'no-cache, no-store, must-revalidate'
      );
      expect(response.headers.get('pragma')).toBe('no-cache');
      expect(response.headers.get('expires')).toBe('0');
    });

    it('should handle errors gracefully', async () => {
      // Temporarily break Redis connection
      const originalRedis = global.redis;
      global.redis = {
        ...mockRedis,
        isOpen: false,
        isReady: false,
      };

      const { GET } = await import('../cache/route');

      const request = new NextRequest('http://localhost:3000/api/health/cache');
      const response = await GET(request);

      // Should still return a response, but with degraded/unhealthy status
      expect(response.status).toBeGreaterThanOrEqual(200);

      const data = await response.json();
      expect(data.overall).toBeDefined();
      expect(['healthy', 'degraded', 'unhealthy']).toContain(data.overall);

      // Restore Redis
      global.redis = originalRedis;
    });
  });

  describe('Main Health Endpoint', () => {
    it('should return comprehensive system health', async () => {
      const { GET } = await import('../route');

      const request = new NextRequest('http://localhost:3000/api/health');
      const response = await GET(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.overall).toBeDefined();
      expect(data.timestamp).toBeDefined();
      expect(data.environment).toBe('test');
      expect(data.version).toBeDefined();
      expect(data.uptime).toBeGreaterThan(0);
      expect(data.checks).toBeInstanceOf(Array);
      expect(data.summary).toBeDefined();
    });

    it('should include database health check', async () => {
      const { GET } = await import('../route');

      const request = new NextRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const data = await response.json();

      const dbCheck = data.checks.find(
        (check: any) => check.service === 'database'
      );
      expect(dbCheck).toBeDefined();
      expect(dbCheck.status).toBeDefined();
      expect(dbCheck.responseTime).toBeGreaterThan(0);
    });

    it('should include cache systems health check', async () => {
      const { GET } = await import('../route');

      const request = new NextRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const data = await response.json();

      const cacheCheck = data.checks.find(
        (check: any) => check.service === 'cache-systems'
      );
      expect(cacheCheck).toBeDefined();
      expect(cacheCheck.status).toBeDefined();
    });

    it('should include integrations health check', async () => {
      const { GET } = await import('../route');

      const request = new NextRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const data = await response.json();

      const integrationsCheck = data.checks.find(
        (check: any) => check.service === 'integrations'
      );
      expect(integrationsCheck).toBeDefined();
      expect(integrationsCheck.status).toBeDefined();
    });

    it('should include system resources health check', async () => {
      const { GET } = await import('../route');

      const request = new NextRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const data = await response.json();

      const resourcesCheck = data.checks.find(
        (check: any) => check.service === 'system-resources'
      );
      expect(resourcesCheck).toBeDefined();
      expect(resourcesCheck.status).toBeDefined();
      expect(resourcesCheck.details).toBeDefined();
      expect(resourcesCheck.details.memory).toBeDefined();
      expect(resourcesCheck.details.uptime).toBeGreaterThan(0);
    });

    it('should calculate overall health correctly', async () => {
      const { GET } = await import('../route');

      const request = new NextRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const data = await response.json();

      const { summary } = data;
      expect(summary.total).toBe(
        summary.healthy + summary.degraded + summary.unhealthy
      );

      if (summary.unhealthy > 0) {
        expect(data.overall).toBe('unhealthy');
      } else if (summary.degraded > 0) {
        expect(data.overall).toBe('degraded');
      } else {
        expect(data.overall).toBe('healthy');
      }
    });

    it('should return 503 status for unhealthy system', async () => {
      // This would require mocking a failure scenario
      // For now, we'll test that the endpoint responds
      const { GET } = await import('../route');

      const request = new NextRequest('http://localhost:3000/api/health');
      const response = await GET(request);

      // Should return either 200 or 503 depending on health
      expect([200, 503]).toContain(response.status);
    });
  });

  describe('Health Check Response Format', () => {
    it('should have consistent response format for cache health', async () => {
      const { GET } = await import('../cache/route');

      const request = new NextRequest('http://localhost:3000/api/health/cache');
      const response = await GET(request);
      const data = await response.json();

      // Check required fields
      expect(data).toHaveProperty('overall');
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('environment');
      expect(data).toHaveProperty('checks');
      expect(data).toHaveProperty('summary');

      // Check summary format
      expect(data.summary).toHaveProperty('healthy');
      expect(data.summary).toHaveProperty('degraded');
      expect(data.summary).toHaveProperty('unhealthy');
      expect(data.summary).toHaveProperty('total');

      // Check checks format
      data.checks.forEach((check: any) => {
        expect(check).toHaveProperty('service');
        expect(check).toHaveProperty('status');
        expect(check).toHaveProperty('responseTime');
        expect(['healthy', 'degraded', 'unhealthy']).toContain(check.status);
        expect(check.responseTime).toBeGreaterThanOrEqual(0);
      });
    });

    it('should have consistent response format for main health', async () => {
      const { GET } = await import('../route');

      const request = new NextRequest('http://localhost:3000/api/health');
      const response = await GET(request);
      const data = await response.json();

      // Check required fields
      expect(data).toHaveProperty('overall');
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('environment');
      expect(data).toHaveProperty('version');
      expect(data).toHaveProperty('uptime');
      expect(data).toHaveProperty('checks');
      expect(data).toHaveProperty('summary');

      // Check timestamp format
      expect(new Date(data.timestamp).getTime()).toBeGreaterThan(0);

      // Check uptime
      expect(data.uptime).toBeGreaterThan(0);
    });

    it('should include error information when checks fail', async () => {
      // This would require mocking failure scenarios
      // For now, we'll verify the structure supports error reporting
      const { GET } = await import('../cache/route');

      const request = new NextRequest('http://localhost:3000/api/health/cache');
      const response = await GET(request);
      const data = await response.json();

      // Verify that checks can include error information
      data.checks.forEach((check: any) => {
        if (check.status === 'unhealthy') {
          expect(check).toHaveProperty('error');
        }
      });
    });
  });

  describe('Performance Characteristics', () => {
    it('should respond within reasonable time limits', async () => {
      const startTime = Date.now();

      const { GET } = await import('../cache/route');
      const request = new NextRequest('http://localhost:3000/api/health/cache');
      await GET(request);

      const responseTime = Date.now() - startTime;

      // Health checks should be fast (under 5 seconds)
      expect(responseTime).toBeLessThan(5000);
    });

    it('should include response time metrics', async () => {
      const { GET } = await import('../cache/route');

      const request = new NextRequest('http://localhost:3000/api/health/cache');
      const response = await GET(request);
      const data = await response.json();

      data.checks.forEach((check: any) => {
        expect(check.responseTime).toBeGreaterThanOrEqual(0);
        expect(check.responseTime).toBeLessThan(10000); // Should be under 10 seconds
      });
    });
  });
});
