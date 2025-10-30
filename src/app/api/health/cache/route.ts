// Cache Health Check API Endpoint
// Provides comprehensive health status for all caching layers

import { NextRequest, NextResponse } from 'next/server';
import { RedisCache, CacheKeyGenerator } from '@/lib/redis';
import { CacheConfig } from '@/lib/config';
import { FeatureFlags } from '@/lib/config/feature-flags';

interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  details?: any;
  error?: string;
}

interface CacheHealthResponse {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  environment: string;
  checks: HealthCheckResult[];
  summary: {
    healthy: number;
    degraded: number;
    unhealthy: number;
    total: number;
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const checks: HealthCheckResult[] = [];

  try {
    // Check Redis cache
    const redisCheck = await checkRedisHealth();
    checks.push(redisCheck);

    // Check CDN health (if enabled)
    if (CacheConfig.getCDNConfig().enabled) {
      const cdnCheck = await checkCDNHealth();
      checks.push(cdnCheck);
    }

    // Check Service Worker cache (client-side check)
    const swCheck = await checkServiceWorkerHealth();
    checks.push(swCheck);

    // Check cache monitoring
    if (CacheConfig.getMonitoringConfig().enabled) {
      const monitoringCheck = await checkMonitoringHealth();
      checks.push(monitoringCheck);
    }

    // Check feature flags
    const featureFlagsCheck = await checkFeatureFlagsHealth();
    checks.push(featureFlagsCheck);

    // Calculate overall health
    const summary = {
      healthy: checks.filter(c => c.status === 'healthy').length,
      degraded: checks.filter(c => c.status === 'degraded').length,
      unhealthy: checks.filter(c => c.status === 'unhealthy').length,
      total: checks.length,
    };

    let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (summary.unhealthy > 0) {
      overall = 'unhealthy';
    } else if (summary.degraded > 0) {
      overall = 'degraded';
    }

    const response: CacheHealthResponse = {
      overall,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      checks,
      summary,
    };

    const statusCode =
      overall === 'healthy' ? 200 : overall === 'degraded' ? 200 : 503;

    return NextResponse.json(response, {
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  } catch (error) {
    console.error('Health check error:', error);

    const errorResponse: CacheHealthResponse = {
      overall: 'unhealthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      checks: [
        {
          service: 'health-check',
          status: 'unhealthy',
          responseTime: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      ],
      summary: {
        healthy: 0,
        degraded: 0,
        unhealthy: 1,
        total: 1,
      },
    };

    return NextResponse.json(errorResponse, { status: 503 });
  }
}

/**
 * Check Redis cache health
 */
async function checkRedisHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();

  try {
    if (!FeatureFlags.isEnabled('redisCache')) {
      return {
        service: 'redis',
        status: 'healthy',
        responseTime: Date.now() - startTime,
        details: { enabled: false, reason: 'Feature disabled' },
      };
    }

    // Test basic Redis operations
    const testKey = CacheKeyGenerator.generate(
      'health',
      'check',
      Date.now().toString()
    );
    const testValue = { timestamp: Date.now(), health: 'check' };

    // Test SET operation
    const setResult = await RedisCache.set(testKey, testValue, 60);
    if (!setResult) {
      throw new Error('Redis SET operation failed');
    }

    // Test GET operation
    const getValue = await RedisCache.get(testKey);
    if (!getValue || getValue.timestamp !== testValue.timestamp) {
      throw new Error('Redis GET operation failed or returned incorrect data');
    }

    // Test TTL operation
    const ttl = await RedisCache.ttl(testKey);
    if (ttl <= 0 || ttl > 60) {
      throw new Error('Redis TTL operation failed');
    }

    // Test DELETE operation
    const delResult = await RedisCache.del(testKey);
    if (!delResult) {
      throw new Error('Redis DELETE operation failed');
    }

    const responseTime = Date.now() - startTime;

    return {
      service: 'redis',
      status:
        responseTime < 100
          ? 'healthy'
          : responseTime < 500
            ? 'degraded'
            : 'unhealthy',
      responseTime,
      details: {
        enabled: true,
        operations: ['SET', 'GET', 'TTL', 'DEL'],
        url: CacheConfig.getRedisConfig().url.replace(/\/\/.*@/, '//***@'),
      },
    };
  } catch (error) {
    return {
      service: 'redis',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown Redis error',
    };
  }
}

/**
 * Check CDN health
 */
async function checkCDNHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();

  try {
    const cdnConfig = CacheConfig.getCDNConfig();

    if (!cdnConfig.enabled) {
      return {
        service: 'cdn',
        status: 'healthy',
        responseTime: Date.now() - startTime,
        details: { enabled: false, reason: 'CDN disabled in configuration' },
      };
    }

    // Test CDN connectivity by checking a static asset
    const testUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/placeholder.svg`;
    const response = await fetch(testUrl, {
      method: 'HEAD',
      cache: 'no-cache',
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      throw new Error(`CDN test failed with status: ${response.status}`);
    }

    // Check cache headers
    const cacheControl = response.headers.get('cache-control');
    const cdnCacheControl = response.headers.get('cdn-cache-control');

    return {
      service: 'cdn',
      status:
        responseTime < 200
          ? 'healthy'
          : responseTime < 1000
            ? 'degraded'
            : 'unhealthy',
      responseTime,
      details: {
        enabled: true,
        provider: cdnConfig.provider,
        regions: cdnConfig.regions,
        cacheHeaders: {
          cacheControl,
          cdnCacheControl,
        },
      },
    };
  } catch (error) {
    return {
      service: 'cdn',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown CDN error',
    };
  }
}

/**
 * Check Service Worker health (server-side validation)
 */
async function checkServiceWorkerHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();

  try {
    const swConfig = CacheConfig.getServiceWorkerConfig();

    if (!swConfig.enabled) {
      return {
        service: 'service-worker',
        status: 'healthy',
        responseTime: Date.now() - startTime,
        details: {
          enabled: false,
          reason: 'Service Worker disabled in configuration',
        },
      };
    }

    // Check if service worker file exists
    const swPath = 'public/sw.js';
    const fs = await import('fs');
    const path = await import('path');

    const swFilePath = path.join(process.cwd(), swPath);
    const swExists = fs.existsSync(swFilePath);

    if (!swExists) {
      throw new Error('Service Worker file not found');
    }

    // Check service worker file size (basic validation)
    const stats = fs.statSync(swFilePath);
    const fileSizeKB = stats.size / 1024;

    if (fileSizeKB < 1) {
      throw new Error('Service Worker file appears to be empty or corrupted');
    }

    return {
      service: 'service-worker',
      status: 'healthy',
      responseTime: Date.now() - startTime,
      details: {
        enabled: true,
        cacheVersion: swConfig.cacheVersion,
        maxCacheSize: swConfig.maxCacheSize,
        offlinePages: swConfig.offlinePages.length,
        fileSizeKB: Math.round(fileSizeKB),
      },
    };
  } catch (error) {
    return {
      service: 'service-worker',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error:
        error instanceof Error ? error.message : 'Unknown Service Worker error',
    };
  }
}

/**
 * Check monitoring health
 */
async function checkMonitoringHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();

  try {
    const monitoringConfig = CacheConfig.getMonitoringConfig();

    if (!monitoringConfig.enabled) {
      return {
        service: 'monitoring',
        status: 'healthy',
        responseTime: Date.now() - startTime,
        details: {
          enabled: false,
          reason: 'Monitoring disabled in configuration',
        },
      };
    }

    // Basic monitoring validation
    const thresholds = monitoringConfig.alertThresholds;
    const validThresholds =
      thresholds.hitRate >= 0 &&
      thresholds.hitRate <= 100 &&
      thresholds.responseTime > 0 &&
      thresholds.errorRate >= 0 &&
      thresholds.errorRate <= 100;

    if (!validThresholds) {
      throw new Error('Invalid monitoring thresholds configuration');
    }

    return {
      service: 'monitoring',
      status: 'healthy',
      responseTime: Date.now() - startTime,
      details: {
        enabled: true,
        metricsInterval: monitoringConfig.metricsInterval,
        thresholds: monitoringConfig.alertThresholds,
      },
    };
  } catch (error) {
    return {
      service: 'monitoring',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error:
        error instanceof Error ? error.message : 'Unknown monitoring error',
    };
  }
}

/**
 * Check feature flags health
 */
async function checkFeatureFlagsHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();

  try {
    // Validate feature flags configuration
    const validation = FeatureFlags.validate();

    if (!validation.valid) {
      throw new Error(
        `Feature flags validation failed: ${validation.errors.join(', ')}`
      );
    }

    const enabledFeatures = FeatureFlags.getEnabledFeatures();
    const status = FeatureFlags.getStatus();

    return {
      service: 'feature-flags',
      status: 'healthy',
      responseTime: Date.now() - startTime,
      details: {
        enabled: true,
        enabledFeatures: enabledFeatures.length,
        rolloutPercentage: status.rolloutPercentage,
        environment: status.environment,
      },
    };
  } catch (error) {
    return {
      service: 'feature-flags',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error:
        error instanceof Error ? error.message : 'Unknown feature flags error',
    };
  }
}
