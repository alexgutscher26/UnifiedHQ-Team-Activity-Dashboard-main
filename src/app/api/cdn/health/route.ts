// CDN health monitoring endpoint
// Provides real-time CDN performance and health metrics

import { NextRequest, NextResponse } from 'next/server';
import { cdnCacheManager } from '@/lib/cdn/cache-manager';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const detailed = searchParams.get('detailed') === 'true';
    const region = searchParams.get('region');

    // Get basic health status
    const health = await cdnCacheManager.checkHealth();

    if (!detailed) {
      // Return simple health check
      return NextResponse.json({
        status: health.status,
        healthy: health.status === 'healthy',
        timestamp: health.lastChecked,
      });
    }

    // Get detailed metrics
    const stats = await cdnCacheManager.getCacheStats();

    const response = {
      health: {
        status: health.status,
        hitRate: health.hitRate,
        avgResponseTime: health.avgResponseTime,
        errorRate: health.errorRate,
        lastChecked: health.lastChecked,
      },
      regions: region
        ? health.regions.filter(r => r.region === region)
        : health.regions,
      performance: {
        totalRequests: stats.totalRequests,
        cacheHits: stats.cacheHits,
        cacheMisses: stats.cacheMisses,
        hitRate: stats.hitRate,
        bandwidth: stats.bandwidth,
      },
      topPaths: stats.topPaths,
      timestamp: new Date().toISOString(),
    };

    // Set appropriate cache headers for health endpoint
    const headers = new Headers();
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    headers.set('Pragma', 'no-cache');
    headers.set('Expires', '0');

    return NextResponse.json(response, { headers });
  } catch (error) {
    console.error('CDN health check error:', error);

    return NextResponse.json(
      {
        status: 'unhealthy',
        healthy: false,
        error: 'Health check failed',
        timestamp: new Date().toISOString(),
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Trigger manual health check
    const health = await cdnCacheManager.checkHealth();

    return NextResponse.json({
      message: 'Health check completed',
      status: health.status,
      regions: health.regions.length,
      timestamp: health.lastChecked,
    });
  } catch (error) {
    console.error('Manual health check error:', error);

    return NextResponse.json(
      { error: 'Manual health check failed' },
      { status: 500 }
    );
  }
}
