import { NextRequest, NextResponse } from 'next/server';

/**
 * Handles GET requests and returns mock Slack stats or an error response.
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[Slack Stats] Request received');

    // Return mock Slack stats to prevent 500 errors
    const mockStats = {
      count: 0,
      status: 'Not Connected',
      details: 'Slack integration not configured',
      lastUpdate: 'Never',
      breakdown: {
        messages: 0,
        threads: 0,
        reactions: 0,
        channels: 0,
      },
      channels: {
        selected: 0,
        total: 0,
        active: 0,
      },
      cached: false,
      timestamp: new Date().toISOString(),
    };

    console.log('[Slack Stats] Returning mock data');
    return NextResponse.json(mockStats);
  } catch (error) {
    console.error('[Slack Stats] Error:', error);

    // Even if there's an error, return a valid response
    return NextResponse.json({
      count: 0,
      status: 'Error',
      details: 'Service temporarily unavailable',
      lastUpdate: 'Never',
      breakdown: {
        messages: 0,
        threads: 0,
        reactions: 0,
        channels: 0,
      },
      channels: {
        selected: 0,
        total: 0,
        active: 0,
      },
      error: true,
    });
  }
}
