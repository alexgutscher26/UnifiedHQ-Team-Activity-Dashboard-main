import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';

const prisma = new PrismaClient();

/**
 * GET /api/ai-summary/monitoring
 * Retrieves monitoring data for AI summary generation
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '30');
    const type = searchParams.get('type'); // 'DAILY_CRON', 'MANUAL', 'BACKGROUND'
    const status = searchParams.get('status'); // 'SUCCESS', 'PARTIAL_FAILURE', 'FAILURE'

    // Build where clause
    const where: any = {};
    if (type) where.type = type;
    if (status) where.status = status;

    // Get monitoring records
    const monitoringRecords = await prisma.aISummaryMonitoring.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Get summary statistics
    const stats = await prisma.aISummaryMonitoring.aggregate({
      _count: { id: true },
      _sum: { processed: true, generated: true, skipped: true, errors: true },
      where: {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
    });

    // Get recent failures
    const recentFailures = await prisma.aISummaryMonitoring.findMany({
      where: {
        status: 'FAILURE',
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Get success rate for last 7 days
    const successCount = await prisma.aISummaryMonitoring.count({
      where: {
        status: 'SUCCESS',
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    });

    const totalCount = await prisma.aISummaryMonitoring.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    });

    const successRate = totalCount > 0 ? (successCount / totalCount) * 100 : 0;

    return NextResponse.json({
      success: true,
      data: {
        records: monitoringRecords,
        statistics: {
          last7Days: {
            totalRuns: stats._count.id,
            totalProcessed: stats._sum.processed || 0,
            totalGenerated: stats._sum.generated || 0,
            totalSkipped: stats._sum.skipped || 0,
            totalErrors: stats._sum.errors || 0,
            successRate: Math.round(successRate * 100) / 100,
          },
          recentFailures,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Error fetching monitoring data:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch monitoring data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai-summary/monitoring
 * Creates a new monitoring record (for testing or manual tracking)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, status, processed, generated, skipped, errors, metadata } =
      body;

    // Validate required fields
    if (!type || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: type, status' },
        { status: 400 }
      );
    }

    const monitoringRecord = await prisma.aISummaryMonitoring.create({
      data: {
        type,
        status,
        processed: processed || 0,
        generated: generated || 0,
        skipped: skipped || 0,
        errors: errors || 0,
        metadata: metadata || {},
      },
    });

    return NextResponse.json({
      success: true,
      data: monitoringRecord,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Error creating monitoring record:', error);
    return NextResponse.json(
      {
        error: 'Failed to create monitoring record',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
