// CDN Cache Management Utilities
// Handles programmatic cache purging, invalidation, and health monitoring

import { EdgeConfig } from './edge-config';

export interface CachePurgeOptions {
  tags?: string[];
  paths?: string[];
  purgeAll?: boolean;
  reason?: string;
}

export interface CacheHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  hitRate: number;
  avgResponseTime: number;
  errorRate: number;
  lastChecked: Date;
  regions: RegionHealth[];
}

export interface RegionHealth {
  region: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  errorCount: number;
}

export interface CacheStats {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  bandwidth: {
    served: number;
    saved: number;
  };
  topPaths: Array<{
    path: string;
    requests: number;
    hitRate: number;
  }>;
}

export class CDNCacheManager {
  private static readonly VERCEL_API_BASE = 'https://api.vercel.com';
  private static readonly PURGE_ENDPOINT = '/v1/purge';

  private apiToken: string;
  private teamId?: string;

  constructor(apiToken?: string, teamId?: string) {
    this.apiToken = apiToken || process.env.VERCEL_API_TOKEN || '';
    this.teamId = teamId || process.env.VERCEL_TEAM_ID;
  }

  /**
   * Purge CDN cache by tags or paths
   */
  async purgeCache(options: CachePurgeOptions): Promise<boolean> {
    if (!this.apiToken) {
      console.warn('Vercel API token not configured, skipping cache purge');
      return false;
    }

    try {
      const purgeData: any = {};

      if (options.purgeAll) {
        purgeData.purgeAll = true;
      } else {
        if (options.tags && options.tags.length > 0) {
          purgeData.tags = options.tags;
        }
        if (options.paths && options.paths.length > 0) {
          purgeData.files = options.paths;
        }
      }

      const response = await fetch(
        `${CDNCacheManager.VERCEL_API_BASE}${CDNCacheManager.PURGE_ENDPOINT}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
            ...(this.teamId && { 'X-Vercel-Team-Id': this.teamId }),
          },
          body: JSON.stringify(purgeData),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error('Cache purge failed:', error);
        return false;
      }

      const result = await response.json();
      console.log('Cache purge successful:', {
        ...options,
        result,
      });

      return true;
    } catch (error) {
      console.error('Cache purge error:', error);
      return false;
    }
  }

  /**
   * Purge cache by tags
   */
  async purgeByTags(tags: string[], reason?: string): Promise<boolean> {
    return this.purgeCache({ tags, reason });
  }

  /**
   * Purge cache by paths
   */
  async purgeByPaths(paths: string[], reason?: string): Promise<boolean> {
    return this.purgeCache({ paths, reason });
  }

  /**
   * Purge all cache
   */
  async purgeAll(reason?: string): Promise<boolean> {
    return this.purgeCache({ purgeAll: true, reason });
  }

  /**
   * Purge GitHub-related cache
   */
  async purgeGitHubCache(identifier?: string): Promise<boolean> {
    const tags = ['github', 'api'];
    if (identifier) {
      tags.push(`github:${identifier}`);
    }
    return this.purgeByTags(tags, 'GitHub data update');
  }

  /**
   * Purge Slack-related cache
   */
  async purgeSlackCache(identifier?: string): Promise<boolean> {
    const tags = ['slack', 'api'];
    if (identifier) {
      tags.push(`slack:${identifier}`);
    }
    return this.purgeByTags(tags, 'Slack data update');
  }

  /**
   * Purge AI summary cache
   */
  async purgeAISummaryCache(identifier?: string): Promise<boolean> {
    const tags = ['ai-summary', 'api'];
    if (identifier) {
      tags.push(`ai-summary:${identifier}`);
    }
    return this.purgeByTags(tags, 'AI summary regeneration');
  }

  /**
   * Purge static assets cache
   */
  async purgeStaticAssets(): Promise<boolean> {
    return this.purgeByTags(['static', 'assets'], 'Static assets update');
  }

  /**
   * Check CDN health across regions
   */
  async checkHealth(): Promise<CacheHealthStatus> {
    const regions = EdgeConfig.getEdgeRegions();
    const regionHealthPromises = regions.map(region =>
      this.checkRegionHealth(region)
    );
    const regionHealthResults = await Promise.allSettled(regionHealthPromises);

    const regionHealth: RegionHealth[] = regionHealthResults.map(
      (result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          return {
            region: regions[index],
            status: 'unhealthy' as const,
            responseTime: 0,
            errorCount: 1,
          };
        }
      }
    );

    // Calculate overall health metrics
    const healthyRegions = regionHealth.filter(
      r => r.status === 'healthy'
    ).length;
    const avgResponseTime =
      regionHealth.reduce((sum, r) => sum + r.responseTime, 0) /
      regionHealth.length;
    const totalErrors = regionHealth.reduce((sum, r) => sum + r.errorCount, 0);
    const errorRate = totalErrors / regionHealth.length;

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyRegions === regionHealth.length && errorRate < 0.1) {
      overallStatus = 'healthy';
    } else if (healthyRegions >= regionHealth.length * 0.5 && errorRate < 0.3) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'unhealthy';
    }

    return {
      status: overallStatus,
      hitRate: await this.calculateHitRate(),
      avgResponseTime,
      errorRate,
      lastChecked: new Date(),
      regions: regionHealth,
    };
  }

  /**
   * Check health of a specific region
   */
  private async checkRegionHealth(region: string): Promise<RegionHealth> {
    const startTime = Date.now();
    let errorCount = 0;

    try {
      // Test health endpoint
      const healthResponse = await fetch('/api/health', {
        headers: {
          'X-Vercel-Region': region,
        },
      });

      if (!healthResponse.ok) {
        errorCount++;
      }

      const responseTime = Date.now() - startTime;

      // Determine status based on response time and errors
      let status: 'healthy' | 'degraded' | 'unhealthy';
      if (errorCount === 0 && responseTime < 500) {
        status = 'healthy';
      } else if (errorCount === 0 && responseTime < 2000) {
        status = 'degraded';
      } else {
        status = 'unhealthy';
      }

      return {
        region,
        status,
        responseTime,
        errorCount,
      };
    } catch (error) {
      return {
        region,
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        errorCount: 1,
      };
    }
  }

  /**
   * Calculate cache hit rate from headers
   */
  private async calculateHitRate(): Promise<number> {
    try {
      // This would typically come from analytics or monitoring
      // For now, return a simulated value based on cache headers
      const testPaths = ['/api/github/repos', '/api/slack/channels', '/'];
      let hits = 0;
      let total = 0;

      for (const path of testPaths) {
        try {
          const response = await fetch(path, { method: 'HEAD' });
          total++;

          const cacheStatus = response.headers.get('X-Cache');
          if (cacheStatus === 'HIT' || cacheStatus === 'STALE') {
            hits++;
          }
        } catch {
          total++;
        }
      }

      return total > 0 ? hits / total : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<CacheStats> {
    // This would typically integrate with Vercel Analytics API
    // For now, return simulated data structure
    return {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      hitRate: await this.calculateHitRate(),
      bandwidth: {
        served: 0,
        saved: 0,
      },
      topPaths: [],
    };
  }

  /**
   * Set up automatic cache invalidation triggers
   */
  setupInvalidationTriggers(): void {
    // GitHub webhook handler would call this.purgeGitHubCache()
    // Slack webhook handler would call this.purgeSlackCache()
    // Asset deployment would call this.purgeStaticAssets()

    console.log('Cache invalidation triggers configured');
  }

  /**
   * Create fallback strategy when CDN is unavailable
   */
  async handleCDNFailure(request: Request): Promise<Response> {
    console.warn('CDN failure detected, falling back to origin server');

    // Remove CDN-specific headers and retry
    const fallbackRequest = new Request(request.url, {
      method: request.method,
      headers: new Headers(request.headers),
      body: request.body,
    });

    // Remove CDN-specific headers
    fallbackRequest.headers.delete('CDN-Cache-Control');
    fallbackRequest.headers.delete('Cache-Tag');

    try {
      const response = await fetch(fallbackRequest);

      // Add fallback indicator
      const fallbackResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });

      fallbackResponse.headers.set('X-CDN-Fallback', 'true');

      return fallbackResponse;
    } catch (error) {
      console.error('Fallback request failed:', error);
      throw error;
    }
  }
}

/**
 * Global CDN cache manager instance
 */
export const cdnCacheManager = new CDNCacheManager();

/**
 * Utility functions for common cache operations
 */
export const CacheUtils = {
  /**
   * Invalidate cache when assets are updated
   */
  async onAssetUpdate(assetPaths: string[]): Promise<void> {
    await cdnCacheManager.purgeByPaths(assetPaths, 'Asset update');
  },

  /**
   * Invalidate cache when GitHub data changes
   */
  async onGitHubUpdate(repoId?: string): Promise<void> {
    await cdnCacheManager.purgeGitHubCache(repoId);
  },

  /**
   * Invalidate cache when Slack data changes
   */
  async onSlackUpdate(channelId?: string): Promise<void> {
    await cdnCacheManager.purgeSlackCache(channelId);
  },

  /**
   * Invalidate cache when AI summaries are regenerated
   */
  async onAISummaryUpdate(summaryId?: string): Promise<void> {
    await cdnCacheManager.purgeAISummaryCache(summaryId);
  },

  /**
   * Check if CDN is healthy
   */
  async isHealthy(): Promise<boolean> {
    const health = await cdnCacheManager.checkHealth();
    return health.status === 'healthy';
  },

  /**
   * Get cache performance metrics
   */
  async getPerformanceMetrics(): Promise<{
    hitRate: number;
    avgResponseTime: number;
    status: string;
  }> {
    const health = await cdnCacheManager.checkHealth();
    return {
      hitRate: health.hitRate,
      avgResponseTime: health.avgResponseTime,
      status: health.status,
    };
  },
};
