import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { PrismaClient } from '@/generated/prisma';

const prisma = new PrismaClient();

/**
 * Manual AI summary generation endpoint
 * This endpoint allows users to manually trigger AI summary generation
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
        const now = new Date();
        const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours

        // Get activities from the last 24 hours
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

        console.log(`[AI Summary] Found ${activities.length} activities for user ${userId}`);

        if (activities.length === 0) {
            return NextResponse.json({
                error: 'No activities found for the last 24 hours',
                message: 'Connect your integrations and perform some activities to generate summaries',
            }, { status: 404 });
        }

        // For now, generate a mock summary based on actual activity data
        const sourceBreakdown = activities.reduce((acc, activity) => {
            acc[activity.source] = (acc[activity.source] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const repositories = await prisma.selectedRepository.count({
            where: { userId }
        });

        const channels = await prisma.selectedChannel.count({
            where: { userId }
        });

        // Generate intelligent mock summary based on actual data
        const mockSummary = generateIntelligentSummary(activities, sourceBreakdown, repositories, channels);

        // Save to database
        const savedSummary = await prisma.aISummary.create({
            data: {
                userId,
                title: mockSummary.title,
                keyHighlights: mockSummary.keyHighlights,
                actionItems: mockSummary.actionItems,
                insights: mockSummary.insights,
                generatedAt: now,
                timeRangeStart: startDate,
                timeRangeEnd: now,
                metadata: {
                    activityCount: activities.length,
                    sourceBreakdown,
                    activeRepositories: repositories,
                    activeChannels: channels,
                    model: 'mock-intelligent-v1',
                    tokensUsed: 0,
                },
            },
        });

        console.log(`[AI Summary] Generated summary for user ${userId}`);

        return NextResponse.json({
            summary: {
                id: savedSummary.id,
                title: savedSummary.title,
                keyHighlights: savedSummary.keyHighlights,
                actionItems: savedSummary.actionItems,
                insights: savedSummary.insights,
                generatedAt: savedSummary.generatedAt,
                timeRange: {
                    start: savedSummary.timeRangeStart,
                    end: savedSummary.timeRangeEnd,
                },
                metadata: savedSummary.metadata,
            },
            generated: true,
            activityCount: activities.length,
        });

    } catch (error) {
        console.error('Error generating AI summary:', error);
        return NextResponse.json(
            {
                error: 'Failed to generate AI summary',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}

/**
 * Generate an intelligent summary based on actual activity data.
 *
 * This function analyzes the provided activities and source breakdown to generate a summary that includes a title based on activity levels, key highlights, action items, and insights. It evaluates the total number of activities, identifies the primary source of activity, and assesses engagement across different platforms. The function also calculates the time spread of activities using the calculateTimeSpread function.
 *
 * @param activities - An array of activity data.
 * @param sourceBreakdown - A record mapping source names to their respective activity counts.
 * @param repositories - The number of connected GitHub repositories.
 * @param channels - The number of connected Slack channels.
 * @returns An object containing the summary title, key highlights, action items, and insights.
 */
function generateIntelligentSummary(
    activities: any[],
    sourceBreakdown: Record<string, number>,
    repositories: number,
    channels: number
) {
    const totalActivities = activities.length;
    const sources = Object.keys(sourceBreakdown);
    const primarySource = Object.entries(sourceBreakdown).sort(([, a], [, b]) => b - a)[0];

    // Generate title based on activity level
    let title = "Daily Activity Summary";
    if (totalActivities > 20) {
        title = "High Activity Day - Great Progress!";
    } else if (totalActivities > 10) {
        title = "Productive Day - Steady Progress";
    } else if (totalActivities > 5) {
        title = "Active Day - Good Momentum";
    } else {
        title = "Light Activity Day";
    }

    // Generate key highlights
    const keyHighlights = [];

    if (primarySource) {
        keyHighlights.push(`Most active on ${primarySource[0]} with ${primarySource[1]} activities`);
    }

    if (totalActivities > 0) {
        keyHighlights.push(`Total of ${totalActivities} activities across ${sources.length} platform${sources.length !== 1 ? 's' : ''}`);
    }

    if (sourceBreakdown.github > 0) {
        keyHighlights.push(`GitHub activity: ${sourceBreakdown.github} commits/PRs/issues`);
    }

    if (sourceBreakdown.slack > 0) {
        keyHighlights.push(`Slack engagement: ${sourceBreakdown.slack} messages/interactions`);
    }

    // Generate action items
    const actionItems = [];

    if (repositories === 0) {
        actionItems.push("Connect GitHub repositories to track development progress");
    }

    if (channels === 0) {
        actionItems.push("Connect Slack channels to monitor team communication");
    }

    if (totalActivities < 5) {
        actionItems.push("Consider increasing daily activity to build momentum");
    }

    if (sources.length === 1) {
        actionItems.push("Diversify activity across multiple platforms for better insights");
    }

    // Generate insights
    const insights = [];

    const activityTrend = totalActivities > 10 ? "high" : totalActivities > 5 ? "moderate" : "low";
    insights.push(`Activity level: ${activityTrend} (${totalActivities} activities in 24h)`);

    if (sourceBreakdown.github && sourceBreakdown.slack) {
        insights.push("Good balance between development work and team communication");
    } else if (sourceBreakdown.github) {
        insights.push("Focus on development activities - consider increasing team communication");
    } else if (sourceBreakdown.slack) {
        insights.push("Active in team communication - consider balancing with development work");
    }

    const timeSpread = calculateTimeSpread(activities);
    insights.push(`Activity spread: ${timeSpread}`);

    return {
        title,
        keyHighlights: keyHighlights.slice(0, 4), // Limit to 4 highlights
        actionItems: actionItems.slice(0, 3), // Limit to 3 action items
        insights: insights.slice(0, 3), // Limit to 3 insights
    };
}

/**
 * Calculate how activities are spread throughout the day.
 *
 * This function analyzes an array of activities, extracting the hour from each activity's timestamp.
 * It determines the distribution of activities based on the number of unique hours in which they occur.
 * Depending on the count of unique hours, it categorizes the spread as either distributed, concentrated, or focused.
 *
 * @param {any[]} activities - An array of activity objects, each containing a timestamp.
 */
function calculateTimeSpread(activities: any[]): string {
    if (activities.length === 0) return "No activity";

    const hours = activities.map(a => new Date(a.timestamp).getHours());
    const uniqueHours = new Set(hours);

    if (uniqueHours.size > 8) {
        return "Distributed throughout the day";
    } else if (uniqueHours.size > 4) {
        return "Concentrated in several time periods";
    } else {
        return "Focused in specific time windows";
    }
}