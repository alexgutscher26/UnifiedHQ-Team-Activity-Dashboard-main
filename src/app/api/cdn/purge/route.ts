// API endpoint for CDN cache purging
// Provides programmatic cache invalidation capabilities

import { NextRequest, NextResponse } from 'next/server';
import { cdnCacheManager } from '@/lib/cdn/cache-manager';
import { auth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Authenticate request
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { type, targets, reason } = body;

    let success = false;
    let message = '';

    switch (type) {
      case 'tags':
        if (!targets || !Array.isArray(targets)) {
          return NextResponse.json(
            { error: 'Invalid targets for tag purge' },
            { status: 400 }
          );
        }
        success = await cdnCacheManager.purgeByTags(targets, reason);
        message = `Purged cache for tags: ${targets.join(', ')}`;
        break;

      case 'paths':
        if (!targets || !Array.isArray(targets)) {
          return NextResponse.json(
            { error: 'Invalid targets for path purge' },
            { status: 400 }
          );
        }
        success = await cdnCacheManager.purgeByPaths(targets, reason);
        message = `Purged cache for paths: ${targets.join(', ')}`;
        break;

      case 'github':
        success = await cdnCacheManager.purgeGitHubCache(targets);
        message = `Purged GitHub cache${targets ? ` for ${targets}` : ''}`;
        break;

      case 'slack':
        success = await cdnCacheManager.purgeSlackCache(targets);
        message = `Purged Slack cache${targets ? ` for ${targets}` : ''}`;
        break;

      case 'ai-summary':
        success = await cdnCacheManager.purgeAISummaryCache(targets);
        message = `Purged AI summary cache${targets ? ` for ${targets}` : ''}`;
        break;

      case 'static':
        success = await cdnCacheManager.purgeStaticAssets();
        message = 'Purged static assets cache';
        break;

      case 'all':
        success = await cdnCacheManager.purgeAll(reason);
        message = 'Purged all cache';
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid purge type' },
          { status: 400 }
        );
    }

    if (success) {
      return NextResponse.json({
        success: true,
        message,
        timestamp: new Date().toISOString(),
      });
    } else {
      return NextResponse.json(
        { error: 'Cache purge failed' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Cache purge API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get cache health status
    const health = await cdnCacheManager.checkHealth();
    const stats = await cdnCacheManager.getCacheStats();

    return NextResponse.json({
      health,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cache status API error:', error);
    return NextResponse.json(
      { error: 'Failed to get cache status' },
      { status: 500 }
    );
  }
}
