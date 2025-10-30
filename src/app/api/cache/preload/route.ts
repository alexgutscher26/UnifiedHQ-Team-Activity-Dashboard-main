/**
 * Cache Preload API Endpoint
 * Handles server-side cache warming based on client navigation patterns
 */

import { NextRequest, NextResponse } from 'next/server';
import { CacheWarming } from '@/lib/cache-warming';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      navigationPatterns,
      timeBasedPaths,
      action = 'intelligent',
    } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'intelligent':
        await CacheWarming.intelligentPreload(userId, navigationPatterns);
        break;

      case 'time-based':
        if (!timeBasedPaths || !Array.isArray(timeBasedPaths)) {
          return NextResponse.json(
            {
              error:
                'Time-based paths array is required for time-based preloading',
            },
            { status: 400 }
          );
        }
        await CacheWarming.timeBasedPreload(userId, timeBasedPaths);
        break;

      case 'critical':
        await CacheWarming.warmUserSession(userId);
        break;

      case 'github':
        await CacheWarming.warmGitHubCache(userId);
        break;

      case 'slack':
        await CacheWarming.warmSlackCache(userId);
        break;

      case 'ai-summary':
        await CacheWarming.warmAISummaryCache(userId);
        break;

      default:
        return NextResponse.json(
          {
            error:
              'Invalid action. Supported actions: intelligent, time-based, critical, github, slack, ai-summary',
          },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      message: `Cache preloading (${action}) completed successfully`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cache preload API error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Return available preload actions and their descriptions
    return NextResponse.json({
      success: true,
      availableActions: {
        intelligent: {
          description: 'Preload cache based on navigation patterns',
          requires: ['navigationPatterns'],
        },
        'time-based': {
          description: 'Preload cache based on time-based access patterns',
          requires: ['timeBasedPaths'],
        },
        critical: {
          description: 'Preload critical user session data',
          requires: [],
        },
        github: {
          description: 'Preload GitHub integration cache',
          requires: [],
        },
        slack: {
          description: 'Preload Slack integration cache',
          requires: [],
        },
        'ai-summary': {
          description: 'Preload AI summary cache',
          requires: [],
        },
      },
      userId,
    });
  } catch (error) {
    console.error('Cache preload API error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
