import { NextRequest, NextResponse } from 'next/server';
import { safeLogger, sanitizeError } from '@/lib/safe-logger';

/**
 * Manual trigger for AI summary generation
 * This endpoint can be called to manually trigger the cron job
 */
export async function POST(request: NextRequest) {
  try {
    safeLogger.log('[AI Summary Trigger] Manual trigger initiated');

    // Call the cron endpoint internally
    const cronUrl = new URL('/api/ai-summary/cron', request.url);

    const cronResponse = await fetch(cronUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Include auth header if CRON_SECRET_TOKEN is set
        ...(process.env.CRON_SECRET_TOKEN && {
          authorization: `Bearer ${process.env.CRON_SECRET_TOKEN}`,
        }),
      },
    });

    const cronResult = await cronResponse.json();

    if (cronResponse.ok) {
      safeLogger.log('[AI Summary Trigger] Cron job completed successfully');
      return NextResponse.json({
        success: true,
        message: 'AI summary generation triggered successfully',
        results: cronResult,
        timestamp: new Date().toISOString(),
      });
    } else {
      safeLogger.error('[AI Summary Trigger] Cron job failed:', cronResult);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to trigger AI summary generation',
          details: cronResult,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    safeLogger.error('[AI Summary Trigger] Error:', sanitizeError(error));
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to trigger AI summary generation',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Returns a JSON response indicating the availability of the AI summary trigger.
 */
export async function GET() {
  return NextResponse.json({
    available: true,
    message: 'AI summary trigger is available',
    usage: 'Send POST request to trigger AI summary generation',
    timestamp: new Date().toISOString(),
  });
}
