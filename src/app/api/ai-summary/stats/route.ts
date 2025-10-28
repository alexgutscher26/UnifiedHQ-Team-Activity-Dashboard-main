import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { PrismaClient } from '@/generated/prisma';

const prisma = new PrismaClient();

/**
 * Handles the GET request to fetch AI summary statistics for a user.
 *
 * This function retrieves the user's session, validates authorization, and calculates various statistics based on a specified time range. It gathers total summaries, the most recent summary, and all summaries for comprehensive analysis, including average activities and tokens used. Additionally, it computes daily trends, activity distribution, and extracts common insights from recent summaries before returning the aggregated data in JSON format.
 *
 * @param request - The NextRequest object containing the request details.
 * @returns A JSON response containing the total summaries, average activities, total tokens used, average tokens per summary, model breakdown, daily trends, top insights, activity distribution, and metadata about the time range.
 * @throws Error If there is an issue fetching AI summary statistics.
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
    const timeRange = searchParams.get('timeRange') || '30d'; // 24h, 7d, 30d

    // Calculate time range
    const now = new Date();
    let startDate: Date;

    switch (timeRange) {
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get total summary count for the time range
    const totalSummaries = await prisma.aISummary.count({
      where: {
        userId,
        generatedAt: {
          gte: startDate,
          lte: now,
        },
      },
    });

    // Get the most recent summary
    const mostRecentSummary = await prisma.aISummary.findFirst({
      where: {
        userId,
        generatedAt: {
          gte: startDate,
          lte: now,
        },
      },
      orderBy: {
        generatedAt: 'desc',
      },
      select: {
        generatedAt: true,
        metadata: true,
      },
    });

    // Get all summaries for comprehensive analysis
    const allSummaries = await prisma.aISummary.findMany({
      where: {
        userId,
        generatedAt: {
          gte: startDate,
          lte: now,
        },
      },
      select: {
        id: true,
        title: true,
        keyHighlights: true,
        actionItems: true,
        insights: true,
        generatedAt: true,
        metadata: true,
      },
    });

    // Calculate comprehensive statistics
    const totalActivities = allSummaries.reduce((sum, summary) => {
      const metadata = summary.metadata as any;
      return sum + (metadata?.activityCount || 0);
    }, 0);

    const totalTokensUsed = allSummaries.reduce((sum, summary) => {
      const metadata = summary.metadata as any;
      return sum + (metadata?.tokensUsed || 0);
    }, 0);

    const averageActivities =
      allSummaries.length > 0
        ? Math.round(totalActivities / allSummaries.length)
        : 0;

    const averageTokensPerSummary =
      allSummaries.length > 0
        ? Math.round(totalTokensUsed / allSummaries.length)
        : 0;

    // Model breakdown
    const modelBreakdown: Record<string, number> = {};
    allSummaries.forEach(summary => {
      const metadata = summary.metadata as any;
      const model = metadata?.model || 'unknown';
      const modelName = model.split('/')[1] || model;
      modelBreakdown[modelName] = (modelBreakdown[modelName] || 0) + 1;
    });

    // Daily trends (last 7 days)
    const dailyTrends: Array<{
      date: string;
      count: number;
      tokensUsed: number;
    }> = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayStart = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
      );
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

      const daySummaries = allSummaries.filter(summary => {
        const summaryDate = new Date(summary.generatedAt);
        return summaryDate >= dayStart && summaryDate < dayEnd;
      });

      const dayTokens = daySummaries.reduce((sum, summary) => {
        const metadata = summary.metadata as any;
        return sum + (metadata?.tokensUsed || 0);
      }, 0);

      dailyTrends.push({
        date: dayStart.toISOString().split('T')[0],
        count: daySummaries.length,
        tokensUsed: dayTokens,
      });
    }

    // Activity distribution
    const activityDistribution: Record<string, number> = {};
    allSummaries.forEach(summary => {
      const metadata = summary.metadata as any;
      const sourceBreakdown = metadata?.sourceBreakdown || {};
      Object.entries(sourceBreakdown).forEach(([source, count]) => {
        activityDistribution[source] =
          (activityDistribution[source] || 0) + (count as number);
      });
    });

    // Extract common insights (simplified - just take first few insights from recent summaries)
    const topInsights: string[] = [];
    const recentSummaries = allSummaries.slice(0, 5);
    recentSummaries.forEach(summary => {
      if (
        summary.insights &&
        Array.isArray(summary.insights) &&
        summary.insights.length > 0
      ) {
        topInsights.push(...(summary.insights as string[]).slice(0, 2));
      }
    });

    return NextResponse.json({
      totalSummaries: allSummaries.length,
      averageActivities,
      totalTokensUsed,
      averageTokensPerSummary,
      modelBreakdown,
      dailyTrends,
      topInsights: topInsights.slice(0, 10), // Limit to 10 insights
      activityDistribution,
      metadata: {
        timeRange,
        startDate: startDate.toISOString(),
        endDate: now.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching AI summary stats:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch AI summary statistics',
      },
      { status: 500 }
    );
  }
}
