import { NextRequest, NextResponse } from 'next/server';
import { scheduledCacheWarming } from '@/lib/cache-warming';

/**
 * Cron job endpoint for scheduled cache warming
 * 
 * This endpoint should be called by a cron service (like Vercel Cron or external cron)
 * to periodically warm the cache for better performance.
 */
export async function GET(request: NextRequest) {
    try {
        // Verify cron secret to prevent unauthorized access
        const cronSecret = request.headers.get('authorization');
        const expectedSecret = process.env.CRON_SECRET_TOKEN;

        if (!expectedSecret) {
            console.warn('CRON_SECRET_TOKEN not configured');
            return NextResponse.json(
                { error: 'Cron secret not configured' },
                { status: 500 }
            );
        }

        if (cronSecret !== `Bearer ${expectedSecret}`) {
            console.warn('Invalid cron secret provided');
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        console.log('🕐 Starting scheduled cache warming...');
        const startTime = Date.now();

        // Run scheduled cache warming
        await scheduledCacheWarming();

        const duration = Date.now() - startTime;
        console.log(`✅ Scheduled cache warming completed in ${duration}ms`);

        return NextResponse.json({
            success: true,
            message: 'Scheduled cache warming completed',
            duration: `${duration}ms`,
            timestamp: new Date().toISOString(),
        });

    } catch (error) {
        console.error('❌ Scheduled cache warming failed:', error);

        return NextResponse.json(
            {
                error: 'Scheduled cache warming failed',
                details: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString(),
            },
            { status: 500 }
        );
    }
}

/**
 * POST endpoint for manual cache warming trigger
 */
export async function POST(request: NextRequest) {
    try {
        // Verify cron secret for manual triggers too
        const cronSecret = request.headers.get('authorization');
        const expectedSecret = process.env.CRON_SECRET_TOKEN;

        if (!expectedSecret) {
            return NextResponse.json(
                { error: 'Cron secret not configured' },
                { status: 500 }
            );
        }

        if (cronSecret !== `Bearer ${expectedSecret}`) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        console.log('🔥 Manual cache warming triggered...');
        const startTime = Date.now();

        await scheduledCacheWarming();

        const duration = Date.now() - startTime;
        console.log(`✅ Manual cache warming completed in ${duration}ms`);

        return NextResponse.json({
            success: true,
            message: 'Manual cache warming completed',
            duration: `${duration}ms`,
            timestamp: new Date().toISOString(),
        });

    } catch (error) {
        console.error('❌ Manual cache warming failed:', error);

        return NextResponse.json(
            {
                error: 'Manual cache warming failed',
                details: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString(),
            },
            { status: 500 }
        );
    }
}