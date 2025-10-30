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
 * GET /api/ai-insights/metrics
 * Fetch productivity metrics for the dashboard
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
        const currentPeriodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        const previousPeriodStart = new Date(currentPeriodStart.getTime() - days * 24 * 60 * 60 * 1000);

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
        const metrics = calculateMetrics(currentActivities, previousActivities, days);

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

// TODO: Dont use mock

function calculateMetrics(
    currentActivities: any[],
    previousActivities: any[],
    days: number
): ProductivityMetrics {
    // Commit frequency
    const currentCommits = currentActivities.filter(a =>
        a.source === 'github' && a.metadata?.eventType === 'commit'
    ).length;
    const previousCommits = previousActivities.filter(a =>
        a.source === 'github' && a.metadata?.eventType === 'commit'
    ).length;

    const currentCommitFreq = currentCommits / days;
    const previousCommitFreq = previousCommits / days;

    // Code review time (mock calculation based on PR activity)
    const currentPRs = currentActivities.filter(a =>
        a.source === 'github' && a.metadata?.eventType === 'pull_request'
    ).length;
    const avgReviewTime = currentPRs > 0 ? 2.3 : 0; // Mock average

    // Issue resolution time (mock calculation)
    const currentIssues = currentActivities.filter(a =>
        a.source === 'github' && a.metadata?.eventType === 'issue'
    ).length;
    const avgResolutionTime = currentIssues > 0 ? 1.8 : 0; // Mock average

    // Collaboration score (based on activity diversity)
    const githubActivity = currentActivities.filter(a => a.source === 'github').length;
    const slackActivity = currentActivities.filter(a => a.source === 'slack').length;
    const totalActivity = currentActivities.length;

    let collaborationScore = 0;
    if (totalActivity > 0) {
        const diversity = githubActivity > 0 && slackActivity > 0 ? 1 : 0.5;
        const activityLevel = Math.min(totalActivity / (days * 5), 1); // Normalize to max 5 activities per day
        collaborationScore = Math.round((diversity * activityLevel) * 100);
    }

    // Calculate trends
    const getTrend = (current: number, previous: number): 'up' | 'down' | 'stable' => {
        const threshold = 0.1; // 10% threshold
        const change = previous > 0 ? (current - previous) / previous : 0;

        if (change > threshold) return 'up';
        if (change < -threshold) return 'down';
        return 'stable';
    };

    return {
        commitFrequency: {
            current: Math.round(currentCommitFreq * 10) / 10,
            previous: Math.round(previousCommitFreq * 10) / 10,
            trend: getTrend(currentCommitFreq, previousCommitFreq),
        },
        codeReviewTime: {
            average: avgReviewTime,
            trend: 'stable', // Mock trend
        },
        issueResolutionTime: {
            average: avgResolutionTime,
            trend: 'stable', // Mock trend
        },
        collaborationScore: {
            score: collaborationScore,
            trend: getTrend(collaborationScore, Math.max(collaborationScore - 10, 0)), // Mock comparison
        },
    };
}