import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Test database connectivity with a simple query
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: 'healthy',
      service: 'database',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Database health check failed:', error);

    return NextResponse.json(
      {
        status: 'unhealthy',
        service: 'database',
        timestamp: new Date().toISOString(),
        error:
          error instanceof Error ? error.message : 'Database connection failed',
      },
      { status: 500 }
    );
  }
}
