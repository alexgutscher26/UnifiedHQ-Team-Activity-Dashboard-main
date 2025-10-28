import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { withErrorHandling } from '@/lib/api-error-handler';
import { fetchGithubActivity } from '@/lib/integrations/github-cached';
import { PrismaClient } from '@/generated/prisma';

const prisma = new PrismaClient();

interface TeamActivity {
  id: string;
  type: 'commit' | 'pull_request' | 'issue' | 'review' | 'comment';
  title: string;
  description?: string;
  author: {
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
  };
  repository: string;
  timestamp: string;
  status?: 'open' | 'closed' | 'merged' | 'draft';
  url?: string;
  metadata?: Record<string, unknown>;
}

async function getTeamActivity(request: NextRequest): Promise<NextResponse> {
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

  const { searchParams } = new URL(request.url);
  const timeRange = searchParams.get('timeRange') || '30d';

  try {
    // Get GitHub activity for the current user
    console.log(
      `[Team Activity] Fetching GitHub activity for user: ${user.id}`
    );

    try {
      const githubActivities = await fetchGithubActivity(user.id);
      console.log(
        `[Team Activity] Found ${githubActivities.length} GitHub activities`
      );

      // Check if no repositories are selected
      if (githubActivities.length === 0) {
        // Check if user has GitHub connection but no selected repos
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
            return NextResponse.json({
              data: [],
              success: true,
              message:
                'No repositories selected. Please select repositories to track in the integrations page.',
              timestamp: new Date().toISOString(),
            });
          }
        }
      }

      console.log(
        `[Team Activity] Transforming ${githubActivities.length} GitHub activities`
      );

      // Debug: Log sample GitHub activity
      if (githubActivities.length > 0) {
        console.log(`[Team Activity] Sample GitHub activity:`, {
          title: githubActivities[0].title,
          timestamp: githubActivities[0].timestamp,
          timestampType: typeof githubActivities[0].timestamp,
          metadata: githubActivities[0].metadata,
        });
      }

      // Transform GitHub activities into team activity format
      const teamActivities: TeamActivity[] = githubActivities.map(
        (activity, index) => {
          // Extract activity type from metadata
          const eventType = activity.metadata?.eventType || 'commit';
          const repoInfo = activity.metadata?.repo;
          const actor = activity.metadata?.actor;

          console.log(
            `[Team Activity] Transforming activity ${index + 1}: ${activity.title}`
          );
          console.log(
            `[Team Activity] Event type: ${eventType}, Repo: ${repoInfo?.name}`
          );

          return {
            id: `activity-${activity.externalId || index}`,
            type: eventType as
              | 'commit'
              | 'pull_request'
              | 'issue'
              | 'review'
              | 'comment',
            title: activity.title || 'Untitled Activity',
            description: activity.description,
            author: {
              id: user.id,
              name: user.name || 'Unknown User',
              email: user.email || '',
              avatar: user.image,
              role: 'Developer',
              status: 'active' as const,
              lastActive: new Date().toISOString(),
              commits: eventType === 'commit' ? 1 : 0,
              pullRequests: eventType === 'pull_request' ? 1 : 0,
              issues: eventType === 'issue' ? 1 : 0,
              reviews: eventType === 'review' ? 1 : 0,
            },
            repository: repoInfo?.name || 'Unknown Repository',
            timestamp:
              activity.timestamp instanceof Date
                ? activity.timestamp.toISOString()
                : new Date(activity.timestamp).toISOString(),
            status:
              activity.metadata?.payload?.pull_request?.state ||
              activity.metadata?.payload?.issue?.state ||
              'open',
            url:
              activity.metadata?.payload?.commit?.url ||
              activity.metadata?.payload?.pull_request?.html_url ||
              activity.metadata?.payload?.issue?.html_url,
            metadata: activity.metadata,
          };
        }
      );

      // Filter by time range
      const now = new Date();
      const timeRangeDays =
        timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      const cutoffDate = new Date(
        now.getTime() - timeRangeDays * 24 * 60 * 60 * 1000
      );

      console.log(
        `[Team Activity] Time filtering: cutoffDate=${cutoffDate.toISOString()}, timeRange=${timeRange}`
      );
      console.log(
        `[Team Activity] Before filtering: ${teamActivities.length} activities`
      );

      const filteredActivities = teamActivities.filter(activity => {
        const activityDate = new Date(activity.timestamp);
        const isWithinRange = activityDate >= cutoffDate;
        console.log(
          `[Team Activity] Activity ${activity.id}: ${activity.timestamp} >= ${cutoffDate.toISOString()} = ${isWithinRange}`
        );
        return isWithinRange;
      });

      console.log(
        `[Team Activity] After filtering: ${filteredActivities.length} activities`
      );

      console.log(
        `[Team Activity] Returning ${filteredActivities.length} filtered activities`
      );
      console.log(
        `[Team Activity] Sample activity:`,
        filteredActivities[0]
          ? {
              id: filteredActivities[0].id,
              type: filteredActivities[0].type,
              title: filteredActivities[0].title,
              repository: filteredActivities[0].repository,
              timestamp: filteredActivities[0].timestamp,
            }
          : 'No activities'
      );

      return NextResponse.json({
        data: filteredActivities,
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (githubError) {
      // Handle GitHub-specific errors gracefully
      console.log(
        `[Team Activity] GitHub error for user ${user.id}:`,
        githubError
      );

      if (githubError instanceof Error) {
        if (githubError.message.includes('GitHub not connected')) {
          return NextResponse.json({
            data: [],
            success: true,
            message:
              'GitHub account not connected. Please connect your GitHub account in the integrations page.',
            timestamp: new Date().toISOString(),
          });
        } else if (
          githubError.message.includes('token expired') ||
          githubError.message.includes('invalid')
        ) {
          return NextResponse.json({
            data: [],
            success: true,
            message:
              'GitHub token expired. Please reconnect your GitHub account.',
            timestamp: new Date().toISOString(),
          });
        } else if (githubError.message.includes('rate limit')) {
          return NextResponse.json({
            data: [],
            success: true,
            message: 'GitHub API rate limit exceeded. Please try again later.',
            timestamp: new Date().toISOString(),
          });
        }
      }

      // For other errors, return empty data with generic message
      return NextResponse.json({
        data: [],
        success: true,
        message:
          'Unable to fetch GitHub activity. Please check your GitHub connection.',
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('Error fetching team activity:', error);

    // Handle specific error cases
    let errorMessage = 'Failed to fetch team activity';
    if (error instanceof Error) {
      if (error.message.includes('GitHub not connected')) {
        errorMessage =
          'GitHub account not connected. Please connect your GitHub account in the integrations page.';
      } else if (
        error.message.includes('token expired') ||
        error.message.includes('invalid')
      ) {
        errorMessage =
          'GitHub token expired. Please reconnect your GitHub account.';
      } else if (error.message.includes('rate limit')) {
        errorMessage =
          'GitHub API rate limit exceeded. Please try again later.';
      } else {
        errorMessage = error.message;
      }
    }

    // Log error for debugging
    console.error('Team activity API error:', error);

    return NextResponse.json(
      {
        error: errorMessage,
        success: false,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export const GET = withErrorHandling(getTeamActivity);
