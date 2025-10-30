import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';

const prisma = new PrismaClient();

/**
 * Retrieves monitoring data for AI summary generation.
 *
 * This function processes a GET request to fetch monitoring records based on optional query parameters for type and status.
 * It aggregates statistics for the last 7 days, retrieves recent failures from the last 24 hours, and calculates the success rate.
 * The results are returned in a structured JSON response, including error handling for potential failures during data fetching.
 *
 * @param request - The incoming NextRequest object containing the request details.
 * @returns A JSON response containing the monitoring records, statistics, and recent failures.
 * @throws Error If there is an issue fetching the monitoring data.
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
 * Creates a new monitoring record for testing or manual tracking.
 *
 * This function processes a POST request, extracts the JSON body, and validates the required fields: type and status.
 * If validation passes, it creates a new monitoring record in the database using prisma.aISummaryMonitoring.create.
 * In case of an error during the process, it logs the error and returns a JSON response with the error details.
 *
 * @param request - The NextRequest object containing the request data.
 * @returns A JSON response indicating success or failure, along with the created monitoring record or error details.
 * @throws Error If there is an issue creating the monitoring record or if required fields are missing.
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
