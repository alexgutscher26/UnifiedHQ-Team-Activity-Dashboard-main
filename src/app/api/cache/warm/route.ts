import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { CacheWarmer } from '@/middleware/cache-middleware';

/**
 * API endpoint to warm cache for authenticated users
 */
export async function POST(request: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: request.headers,
        });

        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json().catch(() => ({}));
        const { type = 'user', authToken } = body;

        console.log(`🔥 Cache warming requested by user: ${session.user.id}, type: ${type}`);

        switch (type) {
            case 'user':
                await CacheWarmer.warmUserCache(session.user.id, authToken);
                return NextResponse.json({
                    success: true,
                    message: 'User cache warming initiated',
                    userId: session.user.id,
                });

            case 'dashboard':
                await CacheWarmer.warmDashboardCache(authToken);
                return NextResponse.json({
                    success: true,
                    message: 'Dashboard cache warming initiated',
                });

            case 'all':
                await Promise.all([
                    CacheWarmer.warmUserCache(session.user.id, authToken),
                    CacheWarmer.warmDashboardCache(authToken),
                ]);
                return NextResponse.json({
                    success: true,
                    message: 'Full cache warming initiated',
                    userId: session.user.id,
                });

            default:
                return NextResponse.json(
                    { error: 'Invalid warming type. Use: user, dashboard, or all' },
                    { status: 400 }
                );
        }
    } catch (error) {
        console.error('Cache warming error:', error);
        return NextResponse.json(
            { error: 'Failed to warm cache' },
            { status: 500 }
        );
    }
}

/**
 * Get cache warming status
 */
export async function GET(request: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: request.headers,
        });

        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        return NextResponse.json({
            success: true,
            message: 'Cache warming API is available',
            endpoints: {
                warmUser: 'POST /api/cache/warm { "type": "user" }',
                warmDashboard: 'POST /api/cache/warm { "type": "dashboard" }',
                warmAll: 'POST /api/cache/warm { "type": "all" }',
            },
        });
    } catch (error) {
        console.error('Cache warming status error:', error);
        return NextResponse.json(
            { error: 'Failed to get cache warming status' },
            { status: 500 }
        );
    }
}