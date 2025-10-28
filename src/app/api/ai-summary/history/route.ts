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
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const timeRange = searchParams.get('timeRange') || '30d';

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    switch (timeRange) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get summaries with pagination
    const summaries = await prisma.aISummary.findMany({
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
      skip: (page - 1) * limit,
      take: limit,
    });

    // Get total count for pagination
    const totalCount = await prisma.aISummary.count({
      where: {
        userId,
        generatedAt: {
          gte: startDate,
          lte: now,
        },
      },
    });

    // Get summary statistics
    const stats = await prisma.aISummary.aggregate({
      where: {
        userId,
        generatedAt: {
          gte: startDate,
          lte: now,
        },
      },
      _count: {
        id: true,
      },
    });

    // Calculate average activities manually
    const summariesForStats = await prisma.aISummary.findMany({
      where: {
        userId,
        generatedAt: {
          gte: startDate,
          lte: now,
        },
      },
      select: {
        metadata: true,
      },
    });

    const averageActivities =
      summariesForStats.length > 0
        ? summariesForStats.reduce((sum, summary) => {
            const metadata = summary.metadata as any;
            return sum + (metadata?.activityCount || 0);
          }, 0) / summariesForStats.length
        : 0;

    return NextResponse.json({
      summaries: summaries.map(summary => ({
        id: summary.id,
        title: summary.title,
        keyHighlights: summary.keyHighlights,
        actionItems: summary.actionItems,
        insights: summary.insights,
        generatedAt: summary.generatedAt,
        timeRange: {
          start: summary.timeRangeStart,
          end: summary.timeRangeEnd,
        },
        metadata: summary.metadata,
      })),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: page * limit < totalCount,
        hasPrev: page > 1,
      },
      stats: {
        totalSummaries: stats._count.id,
        averageActivities: Math.round(averageActivities),
      },
    });
  } catch (error) {
    console.error('Error fetching AI summary history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch summary history' },
      { status: 500 }
    );
  }
}
