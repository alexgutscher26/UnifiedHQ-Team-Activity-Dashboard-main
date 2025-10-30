import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { PrismaClient } from '@/generated/prisma';

const prisma = new PrismaClient();

interface AIInsight {
    id: string;
    type: 'productivity' | 'collaboration' | 'code_quality' | 'trend' | 'recommendation';
    title: string;
    description: string;
    confidence: number;
    impact: 'high' | 'medium' | 'low';
    category: string;
    data: any;
    generatedAt: string;
    timeRange: {
        start: string;
        end: string;
    };
}

/**
 * GET /api/ai-insights
 * Fetch AI-powered insights about team productivity and collaboration
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

        // Calculate time range
        const now = new Date();
        const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
        const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

        // Get user activities for analysis
        const activities = await prisma.activity.findMany({
            where: {
                userId,
                timestamp: {
                    gte: startDate,
                    lte: now,
                },
            },
            orderBy: {
                timestamp: 'desc',
            },
        });

        // Generate insights based on activity patterns
        const insights = await generateInsightsFromActivities(activities, startDate, now);

        return NextResponse.json({
            insights,
            timeRange: {
                start: startDate.toISOString(),
                end: now.toISOString(),
            },
            activityCount: activities.length,
            generatedAt: new Date().toISOString(),
        });

    } catch (error) {
        console.error('Error fetching AI insights:', error);
        return NextResponse.json(
            { error: 'Failed to fetch AI insights' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/ai-insights/generate
 * Generate new AI insights based on recent activity
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
        const body = await request.json();
        const { timeRange = '30d', forceRegenerate = false } = body;

        // Calculate time range
        const now = new Date();
        const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
        const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

        // Get user activities for analysis
        const activities = await prisma.activity.findMany({
            where: {
                userId,
                timestamp: {
                    gte: startDate,
                    lte: now,
                },
            },
            orderBy: {
                timestamp: 'desc',
            },
        });

        if (activities.length === 0) {
            return NextResponse.json({
                error: 'No activities found for the specified time range',
                message: 'Connect your integrations and perform some activities to generate insights',
            }, { status: 404 });
        }

        // Generate new insights
        const insights = await generateInsightsFromActivities(activities, startDate, now);

        return NextResponse.json({
            insights,
            generated: true,
            activityCount: activities.length,
            timeRange: {
                start: startDate.toISOString(),
                end: now.toISOString(),
            },
            generatedAt: new Date().toISOString(),
        });

    } catch (error) {
        console.error('Error generating AI insights:', error);
        return NextResponse.json(
            { error: 'Failed to generate AI insights' },
            { status: 500 }
        );
    }
}

/**
 * Generate AI insights from activity data
 */
async function generateInsightsFromActivities(
    activities: any[],
    startDate: Date,
    endDate: Date
): Promise<AIInsight[]> {
    const insights: AIInsight[] = [];

    // Analyze activity patterns
    const sourceBreakdown = activities.reduce((acc, activity) => {
        acc[activity.source] = (acc[activity.source] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const totalActivities = activities.length;
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const avgActivitiesPerDay = totalActivities / daysDiff;

    // Productivity Insights
    if (avgActivitiesPerDay > 5) {
        insights.push({
            id: `productivity_${Date.now()}_1`,
            type: 'productivity',
            title: 'High Activity Period Detected',
            description: `Your team averaged ${avgActivitiesPerDay.toFixed(1)} activities per day, indicating strong productivity momentum.`,
            confidence: 0.85,
            impact: 'high',
            category: 'Productivity',
            data: { avgPerDay: avgActivitiesPerDay, totalActivities },
            generatedAt: new Date().toISOString(),
            timeRange: {
                start: startDate.toISOString(),
                end: endDate.toISOString(),
            },
        });
    } else if (avgActivitiesPerDay < 2) {
        insights.push({
            id: `productivity_${Date.now()}_2`,
            type: 'productivity',
            title: 'Low Activity Period',
            description: `Activity levels are below average with ${avgActivitiesPerDay.toFixed(1)} activities per day. Consider reviewing workflow efficiency.`,
            confidence: 0.78,
            impact: 'medium',
            category: 'Productivity',
            data: { avgPerDay: avgActivitiesPerDay, totalActivities },
            generatedAt: new Date().toISOString(),
            timeRange: {
                start: startDate.toISOString(),
                end: endDate.toISOString(),
            },
        });
    }

    // Collaboration Insights
    if (sourceBreakdown.github && sourceBreakdown.slack) {
        const githubRatio = sourceBreakdown.github / totalActivities;
        const slackRatio = sourceBreakdown.slack / totalActivities;

        if (Math.abs(githubRatio - slackRatio) < 0.3) {
            insights.push({
                id: `collaboration_${Date.now()}_1`,
                type: 'collaboration',
                title: 'Balanced Development and Communication',
                description: `Good balance between development work (${Math.round(githubRatio * 100)}%) and team communication (${Math.round(slackRatio * 100)}%).`,
                confidence: 0.82,
                impact: 'medium',
                category: 'Collaboration',
                data: { githubRatio, slackRatio, balance: 'good' },
                generatedAt: new Date().toISOString(),
                timeRange: {
                    start: startDate.toISOString(),
                    end: endDate.toISOString(),
                },
            });
        }
    }

    // Trend Analysis
    const midPoint = new Date(startDate.getTime() + (endDate.getTime() - startDate.getTime()) / 2);
    const firstHalf = activities.filter(a => new Date(a.timestamp) < midPoint).length;
    const secondHalf = activities.filter(a => new Date(a.timestamp) >= midPoint).length;

    if (secondHalf > firstHalf * 1.2) {
        insights.push({
            id: `trend_${Date.now()}_1`,
            type: 'trend',
            title: 'Increasing Activity Trend',
            description: `Activity has increased by ${Math.round(((secondHalf - firstHalf) / firstHalf) * 100)}% in the recent period, showing positive momentum.`,
            confidence: 0.75,
            impact: 'medium',
            category: 'Trends',
            data: { firstHalf, secondHalf, increase: ((secondHalf - firstHalf) / firstHalf) * 100 },
            generatedAt: new Date().toISOString(),
            timeRange: {
                start: startDate.toISOString(),
                end: endDate.toISOString(),
            },
        });
    }

    // Code Quality Insights (GitHub specific)
    if (sourceBreakdown.github) {
        const githubActivities = activities.filter(a => a.source === 'github');
        const commitCount = githubActivities.filter(a => a.metadata?.eventType === 'commit').length;
        const prCount = githubActivities.filter(a => a.metadata?.eventType === 'pull_request').length;

        if (commitCount > 0 && prCount > 0) {
            const commitToPrRatio = commitCount / prCount;

            if (commitToPrRatio > 10) {
                insights.push({
                    id: `code_quality_${Date.now()}_1`,
                    type: 'code_quality',
                    title: 'High Commit-to-PR Ratio',
                    description: `${commitToPrRatio.toFixed(1)} commits per pull request suggests opportunities for more frequent code reviews.`,
                    confidence: 0.70,
                    impact: 'medium',
                    category: 'Code Quality',
                    data: { commitCount, prCount, ratio: commitToPrRatio },
                    generatedAt: new Date().toISOString(),
                    timeRange: {
                        start: startDate.toISOString(),
                        end: endDate.toISOString(),
                    },
                });
            }
        }
    }

    // Recommendations
    if (Object.keys(sourceBreakdown).length === 1) {
        const singleSource = Object.keys(sourceBreakdown)[0];
        insights.push({
            id: `recommendation_${Date.now()}_1`,
            type: 'recommendation',
            title: 'Diversify Activity Sources',
            description: `All activity is from ${singleSource}. Consider connecting additional integrations for comprehensive insights.`,
            confidence: 0.90,
            impact: 'low',
            category: 'Recommendations',
            data: { currentSources: Object.keys(sourceBreakdown), dominantSource: singleSource },
            generatedAt: new Date().toISOString(),
            timeRange: {
                start: startDate.toISOString(),
                end: endDate.toISOString(),
            },
        });
    }

    // Time-based insights
    const hourlyActivity = activities.reduce((acc, activity) => {
        const hour = new Date(activity.timestamp).getHours();
        acc[hour] = (acc[hour] || 0) + 1;
        return acc;
    }, {} as Record<number, number>);

    const peakHours = Object.entries(hourlyActivity)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 3)
        .map(([hour]) => parseInt(hour));

    if (peakHours.length > 0) {
        insights.push({
            id: `productivity_${Date.now()}_3`,
            type: 'productivity',
            title: 'Peak Activity Hours Identified',
            description: `Highest activity occurs at ${peakHours.map(h => `${h}:00`).join(', ')}. Consider scheduling important work during these periods.`,
            confidence: 0.80,
            impact: 'medium',
            category: 'Productivity',
            data: { peakHours, hourlyBreakdown: hourlyActivity },
            generatedAt: new Date().toISOString(),
            timeRange: {
                start: startDate.toISOString(),
                end: endDate.toISOString(),
            },
        });
    }

    return insights;
}