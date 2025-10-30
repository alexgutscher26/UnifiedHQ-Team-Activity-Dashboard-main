import { NextResponse } from 'next/server';
import { redis, CacheKeyGenerator } from '@/lib/redis';

export async function GET() {
  try {
    // Get Redis server info
    const info = await redis.info();
    const infoLines = info.split('\r\n');

    // Parse Redis metrics
    const metrics: Record<string, string> = {};
    infoLines.forEach(line => {
      if (line.includes(':') && !line.startsWith('#')) {
        const [key, value] = line.split(':');
        metrics[key] = value;
      }
    });

    // Get cache statistics by namespace
    const namespaceStats = await getCacheStatsByNamespace();

    // Get memory usage details
    const memoryStats = await getMemoryStats();

    // Get performance metrics
    const performanceStats = await getPerformanceStats(metrics);

    return NextResponse.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      redis_info: {
        version: metrics.redis_version,
        uptime_seconds: parseInt(metrics.uptime_in_seconds || '0'),
        connected_clients: parseInt(metrics.connected_clients || '0'),
        total_commands_processed: parseInt(
          metrics.total_commands_processed || '0'
        ),
        instantaneous_ops_per_sec: parseInt(
          metrics.instantaneous_ops_per_sec || '0'
        ),
      },
      memory: memoryStats,
      performance: performanceStats,
      cache_namespaces: namespaceStats,
    });
  } catch (error) {
    console.error('Cache stats error:', error);

    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error:
          error instanceof Error ? error.message : 'Failed to get cache stats',
      },
      { status: 500 }
    );
  }
}

async function getCacheStatsByNamespace() {
  try {
    const namespaces = ['user', 'github', 'slack', 'ai', 'api', 'session'];
    const stats: Record<string, { count: number; sample_keys: string[] }> = {};

    for (const namespace of namespaces) {
      const pattern = `unifiedhq:${namespace}:*`;
      const keys = await redis.keys(pattern);

      stats[namespace] = {
        count: keys.length,
        sample_keys: keys.slice(0, 5), // First 5 keys as samples
      };
    }

    return stats;
  } catch (error) {
    console.error('Error getting namespace stats:', error);
    return {};
  }
}

async function getMemoryStats() {
  try {
    const memoryInfo = await redis.info('memory');
    const lines = memoryInfo.split('\r\n');
    const memoryMetrics: Record<string, string> = {};

    lines.forEach(line => {
      if (line.includes(':') && !line.startsWith('#')) {
        const [key, value] = line.split(':');
        memoryMetrics[key] = value;
      }
    });

    return {
      used_memory_bytes: parseInt(memoryMetrics.used_memory || '0'),
      used_memory_human: memoryMetrics.used_memory_human,
      used_memory_rss_bytes: parseInt(memoryMetrics.used_memory_rss || '0'),
      used_memory_rss_human: memoryMetrics.used_memory_rss_human,
      used_memory_peak_bytes: parseInt(memoryMetrics.used_memory_peak || '0'),
      used_memory_peak_human: memoryMetrics.used_memory_peak_human,
      maxmemory_bytes: parseInt(memoryMetrics.maxmemory || '0'),
      maxmemory_human: memoryMetrics.maxmemory_human,
    };
  } catch (error) {
    console.error('Error getting memory stats:', error);
    return {};
  }
}

async function getPerformanceStats(metrics: Record<string, string>) {
  try {
    const keyspaceInfo = await redis.info('keyspace');
    const keyspaceLines = keyspaceInfo.split('\r\n');

    let totalKeys = 0;
    let totalExpires = 0;

    keyspaceLines.forEach(line => {
      if (line.startsWith('db')) {
        const match = line.match(/keys=(\d+),expires=(\d+)/);
        if (match) {
          totalKeys += parseInt(match[1]);
          totalExpires += parseInt(match[2]);
        }
      }
    });

    return {
      total_keys: totalKeys,
      keys_with_expiry: totalExpires,
      hit_rate_percentage: calculateHitRate(metrics),
      operations_per_second: parseInt(metrics.instantaneous_ops_per_sec || '0'),
      network_input_bytes_per_sec:
        parseInt(metrics.instantaneous_input_kbps || '0') * 1024,
      network_output_bytes_per_sec:
        parseInt(metrics.instantaneous_output_kbps || '0') * 1024,
    };
  } catch (error) {
    console.error('Error getting performance stats:', error);
    return {};
  }
}

function calculateHitRate(metrics: Record<string, string>): number {
  const hits = parseInt(metrics.keyspace_hits || '0');
  const misses = parseInt(metrics.keyspace_misses || '0');
  const total = hits + misses;

  if (total === 0) return 0;

  return Math.round((hits / total) * 100 * 100) / 100; // Round to 2 decimal places
}
