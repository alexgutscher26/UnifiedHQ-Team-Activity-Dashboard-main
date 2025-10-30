import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { withErrorHandling } from '@/lib/api-error-handler';
import { fetchGithubActivity } from '@/lib/integrations/github-cached';
import { PrismaClient } from '@/generated/prisma';

const prisma = new PrismaClient();

interface TeamStats {
  totalMembers: number;
  activeMembers: number;
  totalCommits: number;
  totalPullRequests: number;
  totalIssues: number;
  totalReviews: number;
  averageActivityPerDay: number;
  topContributors: Array<{
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
    role: string;
    status: 'active' | 'away' | 'offline';
    lastActive: string;
    commits: number;
    pullRequests: number;
    issues: number;
    reviews: number;
  }>;
  activityTrends: Array<{
    date: string;
    commits: number;
    pullRequests: number;
    issues: number;
    reviews: number;
  }>;
  repositoryStats: Array<{
    name: string;
    commits: number;
    pullRequests: number;
    issues: number;
    contributors: number;
  }>;
}

async function getTeamStats(request: NextRequest): Promise<NextResponse> {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
  };

  try {

    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '30d';

    console.log(`[Team Stats] Fetching activity for user: ${user.id}`);

    // Try to get GitHub activity, but handle errors gracefully
    let githubActivities: any[] = [];
    try {
      githubActivities = await fetchGithubActivity(user.id);
      console.log(`[Team Stats] Found ${githubActivities.length} GitHub activities`);
    } catch (githubError) {
      console.warn('[Team Stats] GitHub fetch failed, returning empty stats:', githubError);

      // Return empty stats instead of throwing error
      const emptyStats: TeamStats = {
        totalMembers: 1,
        activeMembers: 1,
        totalCommits: 0,
        totalPullRequests: 0,
        totalIssues: 0,
        totalReviews: 0,
        averageActivityPerDay: 0,
        topContributors: [
          {
            id: user.id,
            name: user.name || 'Unknown User',
            email: user.email || '',
            avatar: user.image,
            role: 'Developer',
            status: 'active' as const,
            lastActive: new Date().toISOString(),
            commits: 0,
            pullRequests: 0,
            issues: 0,
            reviews: 0,
          },
        ],
        activityTrends: [],
        repositoryStats: [],
      };

      return NextResponse.json({
        data: emptyStats,
        success: true,
        message: 'Unable to fetch GitHub activity. Please check your GitHub connection.',
        timestamp: new Date().toISOString(),
      });
    }

    // Check if no repositories are selected
    if (githubActivities.length === 0) {
      try {
        const connection = await prisma.connection.findFirst({
          where: {
            userId: user.id,
            type: 'github',
          },
        });

        if (connection) {
          const selectedRepos = await prisma.selectedRepository.findMany({
            where: {
              userId: user.id,
            },
          });

          if (selectedRepos.length === 0) {
            // Return empty stats with helpful message
            const emptyStats: TeamStats = {
              totalMembers: 1,
              activeMembers: 1,
              totalCommits: 0,
              totalPullRequests: 0,
              totalIssues: 0,
              totalReviews: 0,
              averageActivityPerDay: 0,
              topContributors: [
                {
                  id: user.id,
                  name: user.name || 'Unknown User',
                  email: user.email || '',
                  avatar: user.image,
                  role: 'Developer',
                  status: 'active' as const,
                  lastActive: new Date().toISOString(),
                  commits: 0,
                  pullRequests: 0,
                  issues: 0,
                  reviews: 0,
                },
              ],
              activityTrends: [],
              repositoryStats: [],
            };

            return NextResponse.json({
              data: emptyStats,
              success: true,
              message: 'No repositories selected. Please select repositories to track in the integrations page.',
              timestamp: new Date().toISOString(),
            });
          }
        }
      } catch (dbError) {
        console.warn('[Team Stats] Database check failed:', dbError);
        // Continue with empty stats
      }
    }

    // Filter activities by time range first
    const now = new Date();
    const timeRangeDays =
      timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const cutoffDate = new Date(
      now.getTime() - timeRangeDays * 24 * 60 * 60 * 1000
    );

    console.log(
      `[Team Stats] Time filtering: cutoffDate=${cutoffDate.toISOString()}, timeRange=${timeRange}`
    );
    console.log(
      `[Team Stats] Before filtering: ${githubActivities.length} activities`
    );

    const filteredActivities = githubActivities.filter(activity => {
      const activityDate =
        activity.timestamp instanceof Date
          ? activity.timestamp
          : new Date(activity.timestamp);
      return activityDate >= cutoffDate;
    });

    console.log(
      `[Team Stats] After filtering: ${filteredActivities.length} activities`
    );

    // Calculate statistics from filtered activities
    const totalCommits = filteredActivities.filter(
      a => a.metadata?.eventType === 'commit'
    ).length;
    const totalPullRequests = filteredActivities.filter(
      a => a.metadata?.eventType === 'pull_request'
    ).length;
    const totalIssues = filteredActivities.filter(
      a => a.metadata?.eventType === 'issue'
    ).length;
    const totalReviews = filteredActivities.filter(
      a => a.metadata?.eventType === 'review'
    ).length;

    // Calculate average activity per day
    const averageActivityPerDay = Math.round(
      filteredActivities.length / timeRangeDays
    );

    // Get unique repositories from filtered activities
    const repositories = [
      ...new Set(
        filteredActivities.map(a => a.metadata?.repo?.name).filter(Boolean)
      ),
    ];

    // Calculate repository stats from filtered activities
    const repositoryStats = repositories.map(repo => {
      const repoActivities = filteredActivities.filter(
        a => a.metadata?.repo?.name === repo
      );
      return {
        name: repo,
        commits: repoActivities.filter(
          a => a.metadata?.eventType === 'commit'
        ).length,
        pullRequests: repoActivities.filter(
          a => a.metadata?.eventType === 'pull_request'
        ).length,
        issues: repoActivities.filter(a => a.metadata?.eventType === 'issue')
          .length,
        contributors: 1, // For now, just the current user
      };
    });

    // Generate activity trends (simplified - just show current stats)
    const activityTrends = [
      {
        date: new Date().toISOString().split('T')[0],
        commits: totalCommits,
        pullRequests: totalPullRequests,
        issues: totalIssues,
        reviews: totalReviews,
      },
    ];

    // Top contributors (just the current user for now)
    const topContributors = [
      {
        id: user.id,
        name: user.name || 'Unknown User',
        email: user.email || '',
        avatar: user.image,
        role: 'Developer',
        status: 'active' as const,
        lastActive: new Date().toISOString(),
        commits: totalCommits,
        pullRequests: totalPullRequests,
        issues: totalIssues,
        reviews: totalReviews,
      },
    ];

    const stats: TeamStats = {
      totalMembers: 1, // Just the current user for now
      activeMembers: 1,
      totalCommits,
      totalPullRequests,
      totalIssues,
      totalReviews,
      averageActivityPerDay,
      topContributors,
      activityTrends,
      repositoryStats,
    };

    return NextResponse.json({
      data: stats,
      success: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.log(`[Team Stats] Error for user ${user.id}:`, error);

    // Return empty stats with helpful message
    const emptyStats: TeamStats = {
      totalMembers: 1,
      activeMembers: 1,
      totalCommits: 0,
      totalPullRequests: 0,
      totalIssues: 0,
      totalReviews: 0,
      averageActivityPerDay: 0,
      topContributors: [
        {
          id: user.id,
          name: user.name || 'Unknown User',
          email: user.email || '',
          avatar: user.image,
          role: 'Developer',
          status: 'active' as const,
          lastActive: new Date().toISOString(),
          commits: 0,
          pullRequests: 0,
          issues: 0,
          reviews: 0,
        },
      ],
      activityTrends: [],
      repositoryStats: [],
    };

    let message = 'Unable to fetch GitHub activity. Please check your GitHub connection.';
    if (error instanceof Error) {
      if (error.message.includes('GitHub not connected')) {
        message = 'GitHub account not connected. Please connect your GitHub account in the integrations page.';
      } else if (
        error.message.includes('token expired') ||
        error.message.includes('invalid')
      ) {
        message = 'GitHub token expired. Please reconnect your GitHub account.';
      } else if (error.message.includes('rate limit')) {
        message = 'GitHub API rate limit exceeded. Please try again later.';
      }
    }

    return NextResponse.json({
      data: emptyStats,
      success: true,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}

export async function GET(request: NextRequest) {
  try {
    return await getTeamStats(request);
  } catch (error) {
    console.error('[Team Stats API] Unhandled error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        success: false,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
