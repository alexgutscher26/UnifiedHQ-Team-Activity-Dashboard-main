import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { PrismaClient } from '@/generated/prisma';

const prisma = new PrismaClient();

interface ProductivityMetrics {
  commitFrequency: {
    current: number;
    previous: number;
    trend: 'up' | 'down' | 'stable';
  };
  codeReviewTime: {
    average: number;
    trend: 'up' | 'down' | 'stable';
  };
  issueResolutionTime: {
    average: number;
    trend: 'up' | 'down' | 'stable';
  };
  collaborationScore: {
    score: number;
    trend: 'up' | 'down' | 'stable';
  };
}

/**
 * Fetch productivity metrics for the dashboard.
 *
 * This function retrieves the user's session and checks for authorization. It calculates the time range for the current and previous periods based on the provided query parameter. It then fetches the activity data for both periods concurrently and computes the relevant metrics using the calculateMetrics function. Finally, it returns the metrics along with the time range details.
 *
 * @param request - The NextRequest object containing the request details.
 * @returns A JSON response containing the calculated metrics and time range information.
 * @throws Error If there is an issue fetching the productivity metrics.
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
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '30d';

    // Calculate time ranges
    const now = new Date();
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const currentPeriodStart = new Date(
      now.getTime() - days * 24 * 60 * 60 * 1000
    );
    const previousPeriodStart = new Date(
      currentPeriodStart.getTime() - days * 24 * 60 * 60 * 1000
    );

    // Get activities for current and previous periods
    const [currentActivities, previousActivities] = await Promise.all([
      prisma.activity.findMany({
        where: {
          userId,
          timestamp: {
            gte: currentPeriodStart,
            lte: now,
          },
        },
      }),
      prisma.activity.findMany({
        where: {
          userId,
          timestamp: {
            gte: previousPeriodStart,
            lt: currentPeriodStart,
          },
        },
      }),
    ]);

    // Calculate metrics
    const metrics = calculateMetrics(
      currentActivities,
      previousActivities,
      days
    );

    return NextResponse.json({
      metrics,
      timeRange: {
        current: {
          start: currentPeriodStart.toISOString(),
          end: now.toISOString(),
        },
        previous: {
          start: previousPeriodStart.toISOString(),
          end: currentPeriodStart.toISOString(),
        },
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching productivity metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch productivity metrics' },
      { status: 500 }
    );
  }
}

/**
 * Calculate various productivity metrics based on current and previous activities.
 *
 * This function computes commit frequency, average code review time, average issue resolution time,
 * and collaboration scores by analyzing activities from two time periods. It utilizes helper functions
 * to determine trends in these metrics, comparing current values against previous ones to assess
 * performance changes over a specified number of days.
 *
 * @param currentActivities - An array of activity objects representing the current period's activities.
 * @param previousActivities - An array of activity objects representing the previous period's activities.
 * @param days - The number of days over which to calculate the metrics.
 * @returns An object containing calculated productivity metrics including commit frequency,
 *          code review time, issue resolution time, and collaboration score.
 */
function calculateMetrics(
  currentActivities: any[],
  previousActivities: any[],
  days: number
): ProductivityMetrics {
  // Helper function to calculate trends
  /**
   * Determines the trend of a value compared to its previous value.
   *
   * This function calculates the percentage change between the current and previous values.
   * It returns 'up' if the change exceeds a 10% increase, 'down' for a 10% decrease,
   * and 'stable' if the change is within the threshold. The calculation handles cases
   * where the previous value is zero to avoid division by zero errors.
   *
   * @param current - The current value to compare.
   * @param previous - The previous value to compare against.
   */
  const getTrend = (
    current: number,
    previous: number
  ): 'up' | 'down' | 'stable' => {
    const threshold = 0.1; // 10% threshold
    const change = previous > 0 ? (current - previous) / previous : 0;

    if (change > threshold) return 'up';
    if (change < -threshold) return 'down';
    return 'stable';
  };

  // Commit frequency calculation
  const currentCommits = currentActivities.filter(
    a => a.source === 'github' && a.metadata?.eventType === 'commit'
  ).length;
  const previousCommits = previousActivities.filter(
    a => a.source === 'github' && a.metadata?.eventType === 'commit'
  ).length;

  const currentCommitFreq = currentCommits / days;
  const previousCommitFreq = previousCommits / days;

  // Code review time calculation based on PR lifecycle
  const currentPRs = currentActivities.filter(
    a => a.source === 'github' && a.metadata?.eventType === 'pull_request'
  );

  let avgReviewTime = 0;
  let previousAvgReviewTime = 0;

  if (currentPRs.length > 0) {
    // Calculate average time between PR creation and merge/close
    const reviewTimes = currentPRs
      .filter(pr => pr.metadata?.action === 'closed' && pr.metadata?.merged)
      .map(pr => {
        const createdAt = new Date(pr.metadata?.created_at || pr.timestamp);
        const closedAt = new Date(pr.metadata?.closed_at || pr.timestamp);
        return (closedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24); // Days
      })
      .filter(time => time > 0 && time < 30); // Filter out invalid times

    avgReviewTime = reviewTimes.length > 0
      ? reviewTimes.reduce((sum, time) => sum + time, 0) / reviewTimes.length
      : 0;
  }

  // Calculate previous period review time
  const previousPRs = previousActivities.filter(
    a => a.source === 'github' && a.metadata?.eventType === 'pull_request'
  );

  if (previousPRs.length > 0) {
    const previousReviewTimes = previousPRs
      .filter(pr => pr.metadata?.action === 'closed' && pr.metadata?.merged)
      .map(pr => {
        const createdAt = new Date(pr.metadata?.created_at || pr.timestamp);
        const closedAt = new Date(pr.metadata?.closed_at || pr.timestamp);
        return (closedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
      })
      .filter(time => time > 0 && time < 30);

    previousAvgReviewTime = previousReviewTimes.length > 0
      ? previousReviewTimes.reduce((sum, time) => sum + time, 0) / previousReviewTimes.length
      : 0;
  }

  // Issue resolution time calculation
  const currentIssues = currentActivities.filter(
    a => a.source === 'github' && a.metadata?.eventType === 'issue'
  );

  let avgResolutionTime = 0;
  let previousAvgResolutionTime = 0;

  if (currentIssues.length > 0) {
    const resolutionTimes = currentIssues
      .filter(issue => issue.metadata?.action === 'closed')
      .map(issue => {
        const createdAt = new Date(issue.metadata?.created_at || issue.timestamp);
        const closedAt = new Date(issue.metadata?.closed_at || issue.timestamp);
        return (closedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24); // Days
      })
      .filter(time => time > 0 && time < 365); // Filter out invalid times

    avgResolutionTime = resolutionTimes.length > 0
      ? resolutionTimes.reduce((sum, time) => sum + time, 0) / resolutionTimes.length
      : 0;
  }

  // Calculate previous period resolution time
  const previousIssues = previousActivities.filter(
    a => a.source === 'github' && a.metadata?.eventType === 'issue'
  );

  if (previousIssues.length > 0) {
    const previousResolutionTimes = previousIssues
      .filter(issue => issue.metadata?.action === 'closed')
      .map(issue => {
        const createdAt = new Date(issue.metadata?.created_at || issue.timestamp);
        const closedAt = new Date(issue.metadata?.closed_at || issue.timestamp);
        return (closedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
      })
      .filter(time => time > 0 && time < 365);

    previousAvgResolutionTime = previousResolutionTimes.length > 0
      ? previousResolutionTimes.reduce((sum, time) => sum + time, 0) / previousResolutionTimes.length
      : 0;
  }

  // Collaboration score calculation based on activity patterns
  const githubActivity = currentActivities.filter(a => a.source === 'github').length;
  const slackActivity = currentActivities.filter(a => a.source === 'slack').length;
  const totalActivity = currentActivities.length;

  // Calculate previous collaboration score for trend
  const previousGithubActivity = previousActivities.filter(a => a.source === 'github').length;
  const previousSlackActivity = previousActivities.filter(a => a.source === 'slack').length;
  const previousTotalActivity = previousActivities.length;

  let collaborationScore = 0;
  let previousCollaborationScore = 0;

  if (totalActivity > 0) {
    // Score based on activity diversity and engagement
    const platformDiversity = (githubActivity > 0 ? 1 : 0) + (slackActivity > 0 ? 1 : 0);
    const activityBalance = githubActivity > 0 && slackActivity > 0
      ? 1 - Math.abs(githubActivity - slackActivity) / Math.max(githubActivity, slackActivity)
      : 0.5;

    const activityLevel = Math.min(totalActivity / (days * 3), 1); // Normalize to max 3 activities per day

    collaborationScore = Math.round(
      (platformDiversity / 2) * 0.4 + // Platform diversity (40%)
      activityBalance * 0.3 + // Activity balance (30%)
      activityLevel * 0.3 // Activity level (30%)
    ) * 100;
  }

  if (previousTotalActivity > 0) {
    const prevPlatformDiversity = (previousGithubActivity > 0 ? 1 : 0) + (previousSlackActivity > 0 ? 1 : 0);
    const prevActivityBalance = previousGithubActivity > 0 && previousSlackActivity > 0
      ? 1 - Math.abs(previousGithubActivity - previousSlackActivity) / Math.max(previousGithubActivity, previousSlackActivity)
      : 0.5;

    const prevActivityLevel = Math.min(previousTotalActivity / (days * 3), 1);

    previousCollaborationScore = Math.round(
      (prevPlatformDiversity / 2) * 0.4 +
      prevActivityBalance * 0.3 +
      prevActivityLevel * 0.3
    ) * 100;
  }

  return {
    commitFrequency: {
      current: Math.round(currentCommitFreq * 10) / 10,
      previous: Math.round(previousCommitFreq * 10) / 10,
      trend: getTrend(currentCommitFreq, previousCommitFreq),
    },
    codeReviewTime: {
      average: Math.round(avgReviewTime * 10) / 10,
      trend: getTrend(avgReviewTime, previousAvgReviewTime),
    },
    issueResolutionTime: {
      average: Math.round(avgResolutionTime * 10) / 10,
      trend: getTrend(avgResolutionTime, previousAvgResolutionTime),
    },
    collaborationScore: {
      score: collaborationScore,
      trend: getTrend(collaborationScore, previousCollaborationScore),
    },
  };
}
