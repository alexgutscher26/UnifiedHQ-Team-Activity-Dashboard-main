import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { PrismaClient } from '@/generated/prisma';
import { GitHubCacheManager } from '@/lib/integrations/github-cached';

const prisma = new PrismaClient();

/**
 * Fetch GitHub activity statistics for the authenticated user.
 *
 * This function retrieves the user's GitHub activities from the last 24 hours, calculates the number of commits, pull requests, and reviews, and formats the last commit time. It also compiles a summary of the user's activity status and cache statistics. If the user is not authenticated, it returns an unauthorized error response.
 *
 * @param request - The NextRequest object containing the request headers.
 * @returns A JSON response containing the activity count, status, details, last update time, breakdown of activities, and cache statistics.
 * @throws Error If there is an issue fetching GitHub statistics.
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

    // Get GitHub activities from the last 24 hours
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const activities = await prisma.activity.findMany({
      where: {
        userId,
        source: 'github',
        timestamp: {
          gte: twentyFourHoursAgo,
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
    });

    // Calculate statistics
    let commitCount = 0;
    let prCount = 0;
    let reviewCount = 0;
    let lastCommitTime: Date | null = null;

    activities.forEach(activity => {
      const metadata = activity.metadata as any;
      const eventType = metadata?.eventType;

      switch (eventType) {
        case 'commit':
          commitCount++;
          if (!lastCommitTime || activity.timestamp > lastCommitTime) {
            lastCommitTime = activity.timestamp;
          }
          break;
        case 'pull_request':
          prCount++;
          break;
        case 'review':
          reviewCount++;
          break;
      }
    });

    const totalActivity = commitCount + prCount + reviewCount;

    // Format last commit time
    let lastCommitText = 'No recent activity';
    if (lastCommitTime) {
      const now = new Date();
      const diffInMinutes = Math.floor(
        (now.getTime() - (lastCommitTime as Date).getTime()) / (1000 * 60)
      );

      if (diffInMinutes < 1) {
        lastCommitText = 'Just now';
      } else if (diffInMinutes < 60) {
        lastCommitText = `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`;
      } else {
        const diffInHours = Math.floor(diffInMinutes / 60);
        lastCommitText = `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
      }
    }

    // Create details string
    const details = [];
    if (commitCount > 0)
      details.push(`${commitCount} commit${commitCount === 1 ? '' : 's'}`);
    if (prCount > 0) details.push(`${prCount} PR${prCount === 1 ? '' : 's'}`);
    if (reviewCount > 0)
      details.push(`${reviewCount} review${reviewCount === 1 ? '' : 's'}`);

    const detailsText = details.length > 0 ? details.join(', ') : 'No activity';

    // Get cache statistics
    const cacheStats = GitHubCacheManager.getStats();

    return NextResponse.json({
      count: totalActivity,
      status: totalActivity > 0 ? 'Active' : 'Inactive',
      details: detailsText,
      lastUpdate: lastCommitText,
      breakdown: {
        commits: commitCount,
        pullRequests: prCount,
        reviews: reviewCount,
      },
      cache: {
        memoryCache: cacheStats,
        databaseCache: 'enabled',
      },
    });
  } catch (error) {
    console.error('Error fetching GitHub stats:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch GitHub statistics',
      },
      { status: 500 }
    );
  }
}
