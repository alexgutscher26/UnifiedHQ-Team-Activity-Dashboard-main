import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { AISummaryService, AISummaryData } from '@/lib/ai-summary-service';
import { Activity } from '@/types/components';

const prisma = new PrismaClient();

/**
 * Handles the POST request for generating AI summaries in the background.
 *
 * This function verifies the authorization token, checks the connection to the AI service, and retrieves users with recent activity who lack recent summaries. It processes each user to generate and save AI summaries, while handling potential errors and logging the results. The function also includes a delay to prevent rate limiting during summary generation.
 *
 * @param request - The NextRequest object containing the request data.
 * @returns A JSON response indicating the success of the operation and the results of the summary generation.
 * @throws Error If there is an issue with the AI service connection or during summary generation.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify this is a background job request
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.CRON_SECRET_TOKEN;

    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🤖 Starting background AI summary generation...');

    // Validate OpenRouter connection
    const isConnected = await AISummaryService.validateConnection();
    if (!isConnected) {
      console.error('❌ OpenRouter connection failed');
      return NextResponse.json(
        { error: 'AI service is not available' },
        { status: 503 }
      );
    }

    // Get users who have recent activity but no recent summaries
    const now = new Date();
    const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours

    const usersWithActivity = await prisma.user.findMany({
      where: {
        activities: {
          some: {
            timestamp: {
              gte: startDate,
            },
          },
        },
        OR: [
          // Users with no summaries
          {
            aiSummaries: {
              none: {},
            },
          },
          // Users with summaries older than 24 hours
          {
            aiSummaries: {
              some: {
                generatedAt: {
                  lt: new Date(now.getTime() - 24 * 60 * 60 * 1000), // Older than 24 hours
                },
              },
            },
          },
        ],
      },
      include: {
        activities: {
          where: {
            timestamp: {
              gte: startDate,
            },
          },
          orderBy: {
            timestamp: 'desc',
          },
          take: 100,
        },
        selectedRepositories: {
          select: { repoName: true },
        },
        selectedChannels: {
          select: { channelName: true },
        },
      },
    });

    console.log(`📊 Found ${usersWithActivity.length} users needing summaries`);

    const results = {
      processed: 0,
      generated: 0,
      skipped: 0,
      errors: 0,
    };

    for (const user of usersWithActivity) {
      try {
        results.processed++;

        // Check if user has any activity (daily summaries for all users)
        if (user.activities.length < 1) {
          console.log(
            `⏭️ Skipping user ${user.id} - no activity (${user.activities.length} activities)`
          );
          results.skipped++;
          continue;
        }

        // Prepare data for AI summary
        const summaryData: AISummaryData = {
          activities: user.activities.map(activity => ({
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
            repositories: user.selectedRepositories.map(r => r.repoName),
            channels: user.selectedChannels.map(c => c.channelName),
            teamSize: 1,
          },
        };

        // Generate AI summary
        const aiSummary = await AISummaryService.generateSummary(
          user.id,
          summaryData
        );

        // Save to database
        await prisma.aISummary.create({
          data: {
            userId: user.id,
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

        console.log(
          `✅ Generated summary for user ${user.id} (${aiSummary.metadata.activityCount} activities)`
        );
        results.generated++;

        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`❌ Error processing user ${user.id}:`, error);
        results.errors++;
      }
    }

    console.log('🎉 Background AI summary generation completed:', results);

    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Error in background AI summary generation:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate background summaries',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Health check endpoint
/**
 * Handles the GET request to check the health status of the AI service.
 *
 * This function validates the connection to the AI service using the
 * AISummaryService. It returns a JSON response indicating whether the
 * service is connected or disconnected, along with a timestamp. In case
 * of an error during the connection validation, it returns an unhealthy
 * status with the error message.
 *
 * @param request - The NextRequest object representing the incoming request.
 */
export async function GET(request: NextRequest) {
  try {
    const isConnected = await AISummaryService.validateConnection();

    return NextResponse.json({
      status: 'healthy',
      aiService: isConnected ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
