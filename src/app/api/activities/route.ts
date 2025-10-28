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
    const limit = 20; // Limit to 20 most recent activities

    // Get all activities from database (both GitHub and Slack)
    const allActivities = await prisma.activity.findMany({
      where: {
        userId,
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: limit,
    });

    // Convert to the format expected by the frontend
    const activities = allActivities.map(activity => ({
      id: activity.externalId || activity.timestamp.getTime().toString(),
      source: activity.source,
      title: activity.title,
      description: activity.description,
      timestamp: activity.timestamp,
      externalId: activity.externalId,
      metadata: activity.metadata,
    }));

    return NextResponse.json({
      activities,
      count: activities.length,
    });
  } catch (error) {
    console.error('Error fetching activities:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch activities',
      },
      { status: 500 }
    );
  }
}
