import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { PrismaClient } from '@/generated/prisma';
import { AISummaryService, AISummaryData } from '@/lib/ai-summary-service';
import { Activity } from '@/types/components';

const prisma = new PrismaClient();

/**
 * Generate an intelligent mock summary based on actual activity data
 */
async function generateIntelligentMockSummary(
  userId: string,
  activities: any[],
  startDate: Date,
  endDate: Date
) {
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

  // Save to database
  const savedSummary = await prisma.aISummary.create({
    data: {
      userId,
      title,
      keyHighlights: keyHighlights.slice(0, 4),
      actionItems: actionItems.slice(0, 3),
      insights: insights.slice(0, 3),
      generatedAt: endDate,
      timeRangeStart: startDate,
      timeRangeEnd: endDate,
      metadata: {
        activityCount: totalActivities,
        sourceBreakdown,
        activeRepositories: repositories,
        activeChannels: channels,
        model: 'intelligent-mock-v1',
        tokensUsed: 0,
      },
    },
  });

  return {
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
  };
}

/**
 * Calculate how activities are spread throughout the day
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

/**
 * Handles the GET request to fetch AI summaries for a user.
 *
 * This function retrieves the user's session and checks for authorization. It calculates the time range for fetching summaries based on the request parameters. If necessary, it auto-generates a summary using activity data if it's been 24 hours since the last summary. Finally, it returns the summaries in JSON format, including any newly generated summaries.
 *
 * @param request - The NextRequest object containing the request details.
 * @returns A JSON response containing the summaries and additional metadata.
 * @throws Error If there is an issue fetching AI summaries or if the user is not found.
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
    const limit = parseInt(searchParams.get('limit') || '5');
    const timeRange = searchParams.get('timeRange') || '24h'; // 24h, 7d, 30d

    // Calculate time range
    const now = new Date();
    let startDate: Date;

    switch (timeRange) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // First, check if we need to auto-generate a summary (regardless of time range filter)
    const mostRecentSummary = await prisma.aISummary.findFirst({
      where: {
        userId,
      },
      orderBy: {
        generatedAt: 'desc',
      },
    });

    // Get existing summaries for the requested time range (for display)
    let summaries;
    if (timeRange === '24h') {
      // For "Today" view, always include the most recent daily summary (last 24 hours)
      // Use a slightly wider range to account for timing differences
      const dailyStartDate = new Date(now.getTime() - 25 * 60 * 60 * 1000); // 25 hours ago
      summaries = await prisma.aISummary.findMany({
        where: {
          userId,
          timeRangeStart: {
            gte: dailyStartDate,
          },
        },
        orderBy: {
          generatedAt: 'desc',
        },
        take: limit,
      });
    } else {
      // For other time ranges, use the original logic
      summaries = await prisma.aISummary.findMany({
        where: {
          userId,
          timeRangeStart: {
            gte: startDate,
          },
        },
        orderBy: {
          generatedAt: 'desc',
        },
        take: limit,
      });
    }

    // Check if it's been 24 hours since last summary
    const hoursSinceLastSummary = mostRecentSummary
      ? (now.getTime() - new Date(mostRecentSummary.generatedAt).getTime()) /
      (60 * 60 * 1000)
      : 24; // If no summaries, consider it as 24+ hours

    // Auto-generate summary if it's been 24+ hours since last summary OR if no summaries exist
    if (hoursSinceLastSummary >= 24 || !mostRecentSummary) {
      // For auto-generation, always use the last 24 hours regardless of user's time range filter
      const dailyStartDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const activityCount = await prisma.activity.count({
        where: {
          userId,
          timestamp: {
            gte: dailyStartDate,
            lte: now,
          },
        },
      });

      // Generate summary even with minimal activity (for daily summaries)
      if (activityCount >= 1) {
        try {
          // Try to use AI service, but fall back to intelligent mock if not available
          let useAI = false;
          try {
            useAI = await AISummaryService.validateConnection();
          } catch (error) {
            console.log('[AI Summary] AI service not available, using intelligent mock');
            useAI = false;
          }

          if (useAI) {
            // Get activities for auto-generation (last 24 hours)
            const activities = await prisma.activity.findMany({
              where: {
                userId,
                timestamp: {
                  gte: dailyStartDate,
                  lte: now,
                },
              },
              orderBy: {
                timestamp: 'desc',
              },
              take: 100,
            });

            // Get team context
            const [repositories, channels] = await Promise.all([
              prisma.selectedRepository.findMany({
                where: { userId },
                select: { repoName: true },
              }),
              prisma.selectedChannel.findMany({
                where: { userId },
                select: { channelName: true },
              }),
            ]);

            // Prepare data for AI summary (always use 24-hour range for daily summaries)
            const summaryData: AISummaryData = {
              activities: activities.map(activity => ({
                id: activity.id,
                source: activity.source,
                title: activity.title,
                description: activity.description,
                timestamp: activity.timestamp,
                externalId: activity.externalId,
                metadata: activity.metadata,
              })) as Activity[],
              timeRange: {
                start: dailyStartDate,
                end: now,
              },
              teamContext: {
                repositories: repositories.map(r => r.repoName),
                channels: channels.map(c => c.channelName),
                teamSize: 1,
              },
            };

            // Generate AI summary with caching
            const aiSummary = await AISummaryService.generateSummary(
              userId,
              summaryData,
              { useCache: true, forceRegenerate: false }
            );

            // Save to database
            const savedSummary = await prisma.aISummary.create({
              data: {
                userId,
                title: aiSummary.title,
                keyHighlights: aiSummary.keyHighlights,
                actionItems: aiSummary.actionItems,
                insights: aiSummary.insights,
                generatedAt: aiSummary.generatedAt,
                timeRangeStart: aiSummary.timeRange.start,
                timeRangeEnd: aiSummary.timeRange.end,
                metadata: aiSummary.metadata,
              },
            });

            // Return the newly generated summary
            return NextResponse.json({
              summaries: [
                {
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
              ],
              count: 1,
              autoGenerated: true,
            });
          } else {
            // Generate intelligent mock summary when AI service is not available
            const activities = await prisma.activity.findMany({
              where: {
                userId,
                timestamp: {
                  gte: dailyStartDate,
                  lte: now,
                },
              },
              orderBy: {
                timestamp: 'desc',
              },
              take: 100,
            });

            if (activities.length > 0) {
              const mockSummary = await generateIntelligentMockSummary(userId, activities, dailyStartDate, now);

              return NextResponse.json({
                summaries: [mockSummary],
                count: 1,
                autoGenerated: true,
                usingMockAI: true,
              });
            }
          }
        } catch (error) {
          console.error('Auto-generation failed:', error);
          // Try to generate a mock summary as fallback
          try {
            const activities = await prisma.activity.findMany({
              where: {
                userId,
                timestamp: {
                  gte: dailyStartDate,
                  lte: now,
                },
              },
              orderBy: {
                timestamp: 'desc',
              },
              take: 100,
            });

            if (activities.length > 0) {
              const mockSummary = await generateIntelligentMockSummary(userId, activities, dailyStartDate, now);

              return NextResponse.json({
                summaries: [mockSummary],
                count: 1,
                autoGenerated: true,
                usingMockAI: true,
                fallback: true,
              });
            }
          } catch (fallbackError) {
            console.error('Fallback generation also failed:', fallbackError);
          }
        }
      }
    }

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
      count: summaries.length,
      autoGenerated: false,
    });
  } catch (error) {
    console.error('Error fetching AI summaries:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch AI summaries',
      },
      { status: 500 }
    );
  }
}

/**
 * Handles the POST request to generate an AI summary based on user activities.
 *
 * This function retrieves the user's session, validates the time range for activities, checks for existing summaries, and generates a new AI summary if necessary. It also handles potential errors, including unauthorized access and service availability issues, while ensuring that the response is appropriately formatted based on the outcome of the operations.
 *
 * @param request - The NextRequest object containing the request data.
 * @returns A JSON response containing the generated summary or an error message.
 * @throws Error If an error occurs during the summary generation process.
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
    const { timeRange = '24h', forceRegenerate = false } = body;

    // Calculate time range
    const now = new Date();
    let startDate: Date;

    switch (timeRange) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // Check if we already have a recent summary (unless force regenerate)
    if (!forceRegenerate) {
      const existingSummary = await prisma.aISummary.findFirst({
        where: {
          userId,
          timeRangeStart: {
            gte: startDate,
          },
          generatedAt: {
            gte: new Date(now.getTime() - 24 * 60 * 60 * 1000), // Within last 24 hours
          },
        },
        orderBy: {
          generatedAt: 'desc',
        },
      });

      if (existingSummary) {
        return NextResponse.json({
          summary: {
            id: existingSummary.id,
            title: existingSummary.title,
            keyHighlights: existingSummary.keyHighlights,
            actionItems: existingSummary.actionItems,
            insights: existingSummary.insights,
            generatedAt: existingSummary.generatedAt,
            timeRange: {
              start: existingSummary.timeRangeStart,
              end: existingSummary.timeRangeEnd,
            },
            metadata: existingSummary.metadata,
          },
          cached: true,
        });
      }
    }

    // Validate OpenRouter connection
    const isConnected = await AISummaryService.validateConnection();
    if (!isConnected) {
      return NextResponse.json(
        {
          error:
            'AI service is not available. Please check your OpenRouter API key.',
        },
        { status: 503 }
      );
    }

    // Get activities for the time range
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
      take: 100, // Limit to prevent token overflow
    });

    if (activities.length === 0) {
      return NextResponse.json(
        { error: 'No activities found for the specified time range' },
        { status: 404 }
      );
    }

    // Get team context
    const [repositories, channels] = await Promise.all([
      prisma.selectedRepository.findMany({
        where: { userId },
        select: { repoName: true },
      }),
      prisma.selectedChannel.findMany({
        where: { userId },
        select: { channelName: true },
      }),
    ]);

    // Prepare data for AI summary
    const summaryData: AISummaryData = {
      activities: activities.map(activity => ({
        id: activity.id,
        source: activity.source,
        title: activity.title,
        description: activity.description,
        timestamp: activity.timestamp,
        externalId: activity.externalId,
        metadata: activity.metadata,
      })) as Activity[],
      timeRange: {
        start: startDate,
        end: now,
      },
      teamContext: {
        repositories: repositories.map(r => r.repoName),
        channels: channels.map(c => c.channelName),
        teamSize: 1, // For now, single user
      },
    };

    // Generate AI summary with caching (force regenerate if requested)
    const aiSummary = await AISummaryService.generateSummary(
      userId,
      summaryData,
      { useCache: true, forceRegenerate }
    );

    // Save to database
    const savedSummary = await prisma.aISummary.create({
      data: {
        userId,
        title: aiSummary.title,
        keyHighlights: aiSummary.keyHighlights,
        actionItems: aiSummary.actionItems,
        insights: aiSummary.insights,
        generatedAt: aiSummary.generatedAt,
        timeRangeStart: aiSummary.timeRange.start,
        timeRangeEnd: aiSummary.timeRange.end,
        metadata: aiSummary.metadata,
      },
    });

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
      cached: false,
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
