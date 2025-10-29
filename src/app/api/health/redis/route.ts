import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

export async function GET() {
  try {
    // Test Redis connectivity with a ping
    const result = await redis.ping();

    if (result === 'PONG') {
      return NextResponse.json({
        status: 'healthy',
        service: 'redis',
        timestamp: new Date().toISOString(),
      });
    } else {
      throw new Error('Redis ping returned unexpected result');
    }
  } catch (error) {
    console.error('Redis health check failed:', error);

    return NextResponse.json(
      {
        status: 'unhealthy',
        service: 'redis',
        timestamp: new Date().toISOString(),
        error:
          error instanceof Error ? error.message : 'Redis connection failed',
      },
      { status: 500 }
    );
  }
}
