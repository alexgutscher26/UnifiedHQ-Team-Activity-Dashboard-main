import { NextRequest, NextResponse } from 'next/server';

/**
 * Manual trigger for AI summary generation.
 *
 * This function initiates a manual trigger for the AI summary generation by calling the internal cron endpoint. It handles the response, logging success or failure, and returns a JSON response indicating the result of the operation. If an error occurs during the process, it captures and logs the error details.
 *
 * @param request - The NextRequest object containing the request information.
 * @returns A JSON response indicating the success or failure of the AI summary generation trigger.
 * @throws Error If an error occurs during the fetch operation or response handling.
 */
export async function POST(request: NextRequest) {
    try {
        console.log('[AI Summary Trigger] Manual trigger initiated');

        // Call the cron endpoint internally
        const cronUrl = new URL('/api/ai-summary/cron', request.url);

        const cronResponse = await fetch(cronUrl.toString(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Include auth header if CRON_SECRET_TOKEN is set
                ...(process.env.CRON_SECRET_TOKEN && {
                    'authorization': `Bearer ${process.env.CRON_SECRET_TOKEN}`
                })
            },
        });

        const cronResult = await cronResponse.json();

        if (cronResponse.ok) {
            console.log('[AI Summary Trigger] Cron job completed successfully');
            return NextResponse.json({
                success: true,
                message: 'AI summary generation triggered successfully',
                results: cronResult,
                timestamp: new Date().toISOString(),
            });
        } else {
            console.error('[AI Summary Trigger] Cron job failed:', cronResult);
            return NextResponse.json({
                success: false,
                error: 'Failed to trigger AI summary generation',
                details: cronResult,
            }, { status: 500 });
        }

    } catch (error) {
        console.error('[AI Summary Trigger] Error:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to trigger AI summary generation',
            details: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 500 });
    }
}

/**
 * GET endpoint to check if trigger is available
 */
export async function GET(request: NextRequest) {
    return NextResponse.json({
        available: true,
        message: 'AI summary trigger is available',
        usage: 'Send POST request to trigger AI summary generation',
        timestamp: new Date().toISOString(),
    });
}