// Main Health Check API Endpoint
// Provides overall system health including caching layers

import { NextRequest, NextResponse } from 'next/server';

interface SystemHealthCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  details?: any;
  error?: string;
}

interface SystemHealthResponse {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  environment: string;
  version: string;
  uptime: number;
  checks: SystemHealthCheck[];
  summary: {
    healthy: number;
    degraded: number;
    unhealthy: number;
    total: number;
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const checks: SystemHealthCheck[] = [];

  try {
    // Check database connectivity
    const dbCheck = await checkDatabaseHealth();
    checks.push(dbCheck);

    // Check cache systems (delegate to cache health endpoint)
    const cacheCheck = await checkCacheSystemsHealth();
    checks.push(cacheCheck);

    // Check external integrations
    const integrationsCheck = await checkIntegrationsHealth();
    checks.push(integrationsCheck);

    // Check system resources
    const resourcesCheck = await checkSystemResources();
    checks.push(resourcesCheck);

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

    const response: SystemHealthResponse = {
      overall,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
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
    console.error('System health check error:', error);

    const errorResponse: SystemHealthResponse = {
      overall: 'unhealthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      checks: [
        {
          service: 'system-health',
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
 * Check database health
 */
async function checkDatabaseHealth(): Promise<SystemHealthCheck> {
  const startTime = Date.now();

  try {
    const { prisma } = await import('@/lib/prisma');

    // Test database connectivity with a simple query
    await prisma.$queryRaw`SELECT 1`;

    const responseTime = Date.now() - startTime;

    return {
      service: 'database',
      status:
        responseTime < 100
          ? 'healthy'
          : responseTime < 500
            ? 'degraded'
            : 'unhealthy',
      responseTime,
      details: {
        type: 'postgresql',
        connected: true,
      },
    };
  } catch (error) {
    return {
      service: 'database',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown database error',
    };
  }
}

/**
 * Check cache systems health by calling cache health endpoint
 */
async function checkCacheSystemsHealth(): Promise<SystemHealthCheck> {
  const startTime = Date.now();

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/health/cache`, {
      method: 'GET',
      headers: {
        'User-Agent': 'UnifiedHQ-HealthCheck/1.0',
      },
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      throw new Error(
        `Cache health check failed with status: ${response.status}`
      );
    }

    const cacheHealth = await response.json();

    return {
      service: 'cache-systems',
      status: cacheHealth.overall,
      responseTime,
      details: {
        summary: cacheHealth.summary,
        services: cacheHealth.checks.map((check: any) => ({
          name: check.service,
          status: check.status,
        })),
      },
    };
  } catch (error) {
    return {
      service: 'cache-systems',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error:
        error instanceof Error ? error.message : 'Unknown cache systems error',
    };
  }
}

/**
 * Check external integrations health
 */
async function checkIntegrationsHealth(): Promise<SystemHealthCheck> {
  const startTime = Date.now();

  try {
    const integrationChecks = [];

    // Check GitHub API connectivity (if configured)
    if (process.env.GITHUB_CLIENT_ID) {
      try {
        const response = await fetch('https://api.github.com/rate_limit', {
          headers: {
            'User-Agent': 'UnifiedHQ-HealthCheck/1.0',
            ...(process.env.GITHUB_TOKEN && {
              Authorization: `token ${process.env.GITHUB_TOKEN}`,
            }),
          },
        });

        integrationChecks.push({
          name: 'github',
          status: response.ok ? 'healthy' : 'degraded',
          responseTime: Date.now() - startTime,
        });
      } catch {
        integrationChecks.push({
          name: 'github',
          status: 'unhealthy',
          responseTime: Date.now() - startTime,
        });
      }
    }

    // Check Slack API connectivity (if configured)
    if (process.env.SLACK_BOT_TOKEN) {
      try {
        const response = await fetch('https://slack.com/api/auth.test', {
          headers: {
            Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
          },
        });

        integrationChecks.push({
          name: 'slack',
          status: response.ok ? 'healthy' : 'degraded',
          responseTime: Date.now() - startTime,
        });
      } catch {
        integrationChecks.push({
          name: 'slack',
          status: 'unhealthy',
          responseTime: Date.now() - startTime,
        });
      }
    }

    const responseTime = Date.now() - startTime;
    const unhealthyCount = integrationChecks.filter(
      c => c.status === 'unhealthy'
    ).length;
    const degradedCount = integrationChecks.filter(
      c => c.status === 'degraded'
    ).length;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (unhealthyCount > 0) {
      status = 'unhealthy';
    } else if (degradedCount > 0) {
      status = 'degraded';
    }

    return {
      service: 'integrations',
      status,
      responseTime,
      details: {
        configured: integrationChecks.length,
        checks: integrationChecks,
      },
    };
  } catch (error) {
    return {
      service: 'integrations',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error:
        error instanceof Error ? error.message : 'Unknown integrations error',
    };
  }
}

/**
 * Check system resources
 */
async function checkSystemResources(): Promise<SystemHealthCheck> {
  const startTime = Date.now();

  try {
    const memoryUsage = process.memoryUsage();
    const memoryUsageMB = {
      rss: Math.round(memoryUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      external: Math.round(memoryUsage.external / 1024 / 1024),
    };

    const heapUsagePercentage =
      (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (heapUsagePercentage > 90) {
      status = 'unhealthy';
    } else if (heapUsagePercentage > 75) {
      status = 'degraded';
    }

    return {
      service: 'system-resources',
      status,
      responseTime: Date.now() - startTime,
      details: {
        memory: memoryUsageMB,
        heapUsagePercentage: Math.round(heapUsagePercentage),
        uptime: process.uptime(),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      },
    };
  } catch (error) {
    return {
      service: 'system-resources',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error:
        error instanceof Error
          ? error.message
          : 'Unknown system resources error',
    };
  }
}
