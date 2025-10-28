import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { PrismaClient } from '@/generated/prisma';

const prisma = new PrismaClient();

/**
 * Handles the GET request to retrieve user-related data.
 *
 * This function first checks the user's session for authentication. If the user is authenticated, it retrieves the user's Slack connection, selected channels, and recent activities from the database. The results are then formatted and returned as a JSON response. In case of an error, it logs the error and returns a 500 status with error details.
 *
 * @param request - The incoming NextRequest object containing request headers.
 * @returns A JSON response containing user data, including Slack connection, selected channels, and activities.
 * @throws Error If an internal server error occurs during the process.
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

    // Check Slack connection
    const connection = await prisma.connection.findFirst({
      where: {
        userId,
        type: 'slack',
      },
    });

    // Check selected channels
    const selectedChannels = await prisma.selectedChannel.findMany({
      where: {
        userId,
      },
    });

    // Check Slack activities in database
    const slackActivities = await prisma.activity.findMany({
      where: {
        userId,
        source: 'slack',
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: 10,
    });

    // Check all activities
    const allActivities = await prisma.activity.findMany({
      where: {
        userId,
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: 10,
    });

    return NextResponse.json({
      userId,
      slackConnection: connection
        ? {
            id: connection.id,
            teamId: connection.teamId,
            teamName: connection.teamName,
            createdAt: connection.createdAt,
          }
        : null,
      selectedChannels: selectedChannels.map(channel => ({
        id: channel.id,
        channelId: channel.channelId,
        channelName: channel.channelName,
        channelType: channel.channelType,
        isPrivate: channel.isPrivate,
      })),
      slackActivities: slackActivities.map(activity => ({
        id: activity.id,
        title: activity.title,
        description: activity.description,
        timestamp: activity.timestamp,
        externalId: activity.externalId,
      })),
      allActivities: allActivities.map(activity => ({
        id: activity.id,
        source: activity.source,
        title: activity.title,
        timestamp: activity.timestamp,
      })),
      counts: {
        slackActivities: slackActivities.length,
        allActivities: allActivities.length,
        selectedChannels: selectedChannels.length,
      },
    });
  } catch (error) {
    console.error('Slack debug error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
