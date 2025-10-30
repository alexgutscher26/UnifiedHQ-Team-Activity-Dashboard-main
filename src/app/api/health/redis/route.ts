import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

export async function GET() {
  try {
    const startTime = Date.now();

    // Test Redis connectivity with a ping
    const pingResult = await redis.ping();
    const pingLatency = Date.now() - startTime;

    if (pingResult !== 'PONG') {
      throw new Error('Redis ping returned unexpected result');
    }

    // Get Redis server info
    const info = await redis.info();
    const infoLines = info.split('\r\n');

    // Parse key metrics from Redis INFO
    const metrics: Record<string, string> = {};
    infoLines.forEach(line => {
      if (line.includes(':') && !line.startsWith('#')) {
        const [key, value] = line.split(':');
        metrics[key] = value;
      }
    });

    // Get memory usage (using sendCommand for MEMORY USAGE)
    let memoryInfo = 'unknown';
    try {
      memoryInfo = await redis.sendCommand(['MEMORY', 'USAGE']);
    } catch (memoryError) {
      console.warn('Redis MEMORY command not available:', memoryError);
      memoryInfo = 'not_available';
    }

    // Test basic operations
    const testKey = 'health_check_test';
    const testValue = { timestamp: Date.now(), test: true };

    await redis.setEx(testKey, 10, JSON.stringify(testValue));
    const retrievedValue = await redis.get(testKey);
    await redis.del(testKey);

    const operationSuccess = retrievedValue !== null;

    // Calculate connection pool status
    const connectionStatus = {
      isOpen: redis.isOpen,
      isReady: redis.isReady,
    };

    return NextResponse.json({
      status: 'healthy',
      service: 'redis',
      timestamp: new Date().toISOString(),
      metrics: {
        ping_latency_ms: pingLatency,
        memory_usage_bytes: memoryInfo,
        connected_clients: metrics.connected_clients || 'unknown',
        used_memory: metrics.used_memory || 'unknown',
        used_memory_human: metrics.used_memory_human || 'unknown',
        redis_version: metrics.redis_version || 'unknown',
        uptime_in_seconds: metrics.uptime_in_seconds || 'unknown',
        total_commands_processed: metrics.total_commands_processed || 'unknown',
      },
      connection: connectionStatus,
      operations: {
        basic_crud: operationSuccess ? 'working' : 'failed',
      },
    });
  } catch (error) {
    console.error('Redis health check failed:', error);

    return NextResponse.json(
      {
        status: 'unhealthy',
        service: 'redis',
        timestamp: new Date().toISOString(),
        error:
          error instanceof Error ? error.message : 'Redis connection failed',
        connection: {
          isOpen: redis?.isOpen || false,
          isReady: redis?.isReady || false,
        },
      },
      { status: 500 }
    );
  }
}
