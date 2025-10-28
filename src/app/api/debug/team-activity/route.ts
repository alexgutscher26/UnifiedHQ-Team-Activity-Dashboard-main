import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { PrismaClient } from '@/generated/prisma';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    console.log('[Team Activity Debug] Starting debug check...');

    // Check authentication
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json(
        {
          error: 'No session found',
          step: 'authentication',
          success: false,
        },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    console.log(`[Team Activity Debug] User ID: ${userId}`);

    // Check database connection
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });

      if (!user) {
        return NextResponse.json(
          {
            error: 'User not found in database',
            step: 'database_user',
            userId,
            success: false,
          },
          { status: 404 }
        );
      }

      console.log(
        `[Team Activity Debug] User found: ${user.name} (${user.email})`
      );

      // Check GitHub connection
      const connection = await prisma.connection.findFirst({
        where: {
          userId,
          type: 'github',
        },
      });

      if (!connection) {
        return NextResponse.json(
          {
            error: 'No GitHub connection found',
            step: 'github_connection',
            userId,
            success: false,
            message:
              'Please connect your GitHub account in the integrations page',
            action: 'Go to /integrations to connect GitHub',
          },
          { status: 404 }
        );
      }

      console.log(`[Team Activity Debug] GitHub connection found`);

      // Check selected repositories
      const selectedRepos = await prisma.selectedRepository.findMany({
        where: {
          userId,
        },
      });

      if (selectedRepos.length === 0) {
        return NextResponse.json(
          {
            error: 'No repositories selected',
            step: 'selected_repositories',
            userId,
            success: false,
            message:
              'Please select repositories to track in the integrations page',
            action: 'Go to /integrations to select repositories',
          },
          { status: 404 }
        );
      }

      console.log(
        `[Team Activity Debug] Found ${selectedRepos.length} selected repositories`
      );

      // Check activities
      const activities = await prisma.activity.findMany({
        where: {
          userId,
          source: 'github',
        },
        orderBy: {
          timestamp: 'desc',
        },
        take: 5,
      });

      console.log(
        `[Team Activity Debug] Found ${activities.length} GitHub activities`
      );

      return NextResponse.json({
        success: true,
        debug: {
          userId,
          userName: user.name,
          userEmail: user.email,
          hasGitHubConnection: !!connection,
          selectedRepositories: selectedRepos.length,
          recentActivities: activities.map(activity => ({
            id: activity.id,
            title: activity.title,
            timestamp: activity.timestamp,
            source: activity.source,
          })),
        },
      });
    } catch (dbError) {
      console.error('[Team Activity Debug] Database error:', dbError);
      return NextResponse.json(
        {
          error: 'Database connection failed',
          step: 'database_connection',
          details:
            dbError instanceof Error
              ? dbError.message
              : 'Unknown database error',
          success: false,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[Team Activity Debug] General error:', error);
    return NextResponse.json(
      {
        error: 'Debug check failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      },
      { status: 500 }
    );
  }
}
