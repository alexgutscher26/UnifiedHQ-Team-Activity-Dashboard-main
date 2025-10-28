import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { PrismaClient } from '@/generated/prisma';

const prisma = new PrismaClient();

/**
 * Handles the POST request to clear the Slack cache for the authenticated user.
 *
 * This function retrieves the user session from the request headers and checks if the user is authenticated.
 * If the user is not authenticated, it returns a 401 Unauthorized response. If authenticated, it deletes all
 * Slack cache entries associated with the user and logs the action. In case of any errors during the process,
 * it returns a 500 error response.
 *
 * @param request - The NextRequest object containing the request details.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Clear all Slack cache for this user
    await prisma.slackCache.deleteMany({
      where: {
        userId,
      },
    });

    console.log(`[Slack Cache Clear] Cleared all cache for user: ${userId}`);

    return NextResponse.json({
      success: true,
      message: 'Slack cache cleared successfully',
    });
  } catch (error) {
    console.error('Slack cache clear error:', error);
    return NextResponse.json(
      { error: 'Failed to clear cache' },
      { status: 500 }
    );
  }
}
