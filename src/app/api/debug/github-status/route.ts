import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { PrismaClient } from '@/generated/prisma';

const prisma = new PrismaClient();

/**
 * Handles the GET request to fetch user-related GitHub activity data.
 *
 * This function retrieves the user's session, checks for authorization, and then fetches the user's GitHub connection status, selected repositories, and recent activities. It counts the activities by type and formats the response to include user ID, connection status, repository details, and activity statistics. In case of an error, it logs the error and returns a failure response.
 *
 * @param request - The incoming NextRequest object containing request headers.
 * @returns A JSON response containing user ID, GitHub connection status, selected repositories count, and recent activity details.
 * @throws Error If there is an issue fetching the session or data from the database.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Get GitHub connection status
    const connection = await prisma.connection.findFirst({
      where: {
        userId,
        type: 'github',
      },
    });

    // Get selected repositories
    const selectedRepos = await prisma.selectedRepository.findMany({
      where: {
        userId,
      },
    });

    // Get recent GitHub activities
    const activities = await prisma.activity.findMany({
      where: {
        userId,
        source: 'github',
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: 10,
    });

    // Count activities by type
    const activityCounts = {
      commits: 0,
      pullRequests: 0,
      reviews: 0,
      total: activities.length,
    };

    activities.forEach(activity => {
      const metadata = activity.metadata as any;
      const eventType = metadata?.eventType;

      switch (eventType) {
        case 'commit':
          activityCounts.commits++;
          break;
        case 'pull_request':
          activityCounts.pullRequests++;
          break;
        case 'review':
          activityCounts.reviews++;
          break;
      }
    });

    return NextResponse.json({
      userId,
      githubConnected: Boolean(connection),
      selectedRepositories: selectedRepos.length,
      repositories: selectedRepos.map(repo => ({
        id: repo.repoId,
        name: repo.repoName,
      })),
      activities: {
        total: activities.length,
        counts: activityCounts,
        recent: activities.slice(0, 5).map(activity => ({
          id: activity.id,
          title: activity.title,
          timestamp: activity.timestamp,
          eventType: (activity.metadata as any)?.eventType,
        })),
      },
    });
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch debug information',
      },
      { status: 500 }
    );
  }
}
