import { NextRequest, NextResponse } from 'next/server';
import { withDefaultMiddleware, withCustomRateLimit } from '@/middleware/api-middleware';

/**
 * Test endpoint to demonstrate rate limiting functionality
 */
async function handler(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const testType = searchParams.get('type') || 'default';

    return NextResponse.json({
        success: true,
        message: `Rate limit test successful - ${testType}`,
        timestamp: new Date().toISOString(),
        testType,
    });
}

/**
 * GET endpoint with default rate limiting
 */
export const GET = withDefaultMiddleware(handler);

/**
 * POST endpoint with custom strict rate limiting
 */
export async function POST(request: NextRequest) {
    return withCustomRateLimit(request, handler, 'STRICT');
}

/**
 * PUT endpoint with AI generation rate limiting
 */
export async function PUT(request: NextRequest) {
    return withCustomRateLimit(request, handler, 'AI_GENERATION');
}

/**
 * DELETE endpoint with auth rate limiting
 */
export async function DELETE(request: NextRequest) {
    return withCustomRateLimit(request, handler, 'AUTH');
}