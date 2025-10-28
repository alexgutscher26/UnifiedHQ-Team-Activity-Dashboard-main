import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { PrismaClient } from '@/generated/prisma';

const prisma = new PrismaClient();

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
      githubConnected: !!connection,
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
