// Cache Management System for Service Worker
// Handles cache storage, versioning, and cleanup

export interface CacheConfig {
  name: string;
  version: string;
  strategy: CacheStrategy;
  maxEntries?: number;
  maxAgeSeconds?: number;
  networkTimeoutSeconds?: number;
}

export type CacheStrategy =
  | 'cache-first'
  | 'network-first'
  | 'stale-while-revalidate'
  | 'network-only'
  | 'cache-only';

export interface CacheEntry {
  url: string;
  response: Response;
  timestamp: number;
  headers: Record<string, string>;
}

export interface CacheStats {
  name: string;
  size: number;
  entries: number;
  hitRate: number;
  lastAccessed: number;
}

export class CacheManager {
  private configs: Map<string, CacheConfig> = new Map();
  private stats: Map<
    string,
    { hits: number; misses: number; lastAccessed: number }
  > = new Map();

  constructor() {
    this.initializeDefaultConfigs();
  }

  /**
   * Initialize default cache configurations
   */
  private initializeDefaultConfigs(): void {
    const defaultConfigs: CacheConfig[] = [
      {
        name: 'unifiedhq-static-v1',
        version: '1.0.0',
        strategy: 'cache-first',
        maxEntries: 100,
        maxAgeSeconds: 24 * 60 * 60, // 24 hours
      },
      {
        name: 'unifiedhq-api-v1',
        version: '1.0.0',
        strategy: 'network-first',
        maxEntries: 50,
        maxAgeSeconds: 15 * 60, // 15 minutes
        networkTimeoutSeconds: 5,
      },
      {
        name: 'unifiedhq-dynamic-v1',
        version: '1.0.0',
        strategy: 'stale-while-revalidate',
        maxEntries: 75,
        maxAgeSeconds: 60 * 60, // 1 hour
      },
      {
        name: 'unifiedhq-offline-v1',
        version: '1.0.0',
        strategy: 'cache-only',
        maxEntries: 10,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
      },
    ];

    defaultConfigs.forEach(config => {
      this.configs.set(config.name, config);
      this.stats.set(config.name, {
        hits: 0,
        misses: 0,
        lastAccessed: Date.now(),
      });
    });
  }

  /**
   * Add or update a cache configuration
   */
  addConfig(config: CacheConfig): void {
    this.configs.set(config.name, config);
    if (!this.stats.has(config.name)) {
      this.stats.set(config.name, {
        hits: 0,
        misses: 0,
        lastAccessed: Date.now(),
      });
    }
  }

  /**
   * Get cache configuration by name
   */
  getConfig(cacheName: string): CacheConfig | undefined {
    return this.configs.get(cacheName);
  }

  /**
   * Handle fetch request with appropriate caching strategy
   */
  async handleRequest(request: Request, cacheName: string): Promise<Response> {
    const config = this.configs.get(cacheName);
    if (!config) {
      throw new Error(`Cache configuration not found: ${cacheName}`);
    }

    const stats = this.stats.get(cacheName)!;
    stats.lastAccessed = Date.now();

    switch (config.strategy) {
      case 'cache-first':
        return this.cacheFirstStrategy(request, config);
      case 'network-first':
        return this.networkFirstStrategy(request, config);
      case 'stale-while-revalidate':
        return this.staleWhileRevalidateStrategy(request, config);
      case 'network-only':
        return this.networkOnlyStrategy(request);
      case 'cache-only':
        return this.cacheOnlyStrategy(request, config);
      default:
        throw new Error(`Unknown cache strategy: ${config.strategy}`);
    }
  }

  /**
   * Cache First Strategy
   */
  private async cacheFirstStrategy(
    request: Request,
    config: CacheConfig
  ): Promise<Response> {
    const cache = await caches.open(config.name);
    const cachedResponse = await cache.match(request);

    if (cachedResponse && !this.isExpired(cachedResponse, config)) {
      this.recordHit(config.name);
      return cachedResponse;
    }

    try {
      const networkResponse = await fetch(request);
      if (networkResponse.ok) {
        await this.putInCache(cache, request, networkResponse.clone(), config);
      }
      this.recordMiss(config.name);
      return networkResponse;
    } catch (error) {
      // Return stale cache if network fails
      if (cachedResponse) {
        this.recordHit(config.name);
        return cachedResponse;
      }
      throw error;
    }
  }

  /**
   * Network First Strategy
   */
  private async networkFirstStrategy(
    request: Request,
    config: CacheConfig
  ): Promise<Response> {
    const cache = await caches.open(config.name);
    const timeoutMs = (config.networkTimeoutSeconds || 5) * 1000;

    try {
      const networkResponse = await Promise.race([
        fetch(request),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Network timeout')), timeoutMs)
        ),
      ]);

      if (networkResponse.ok) {
        await this.putInCache(cache, request, networkResponse.clone(), config);
        this.recordHit(config.name);
        return networkResponse;
      }
    } catch (error) {
      console.log(
        `[Cache Manager] Network failed for ${request.url}, trying cache`
      );
    }

    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      this.recordMiss(config.name);
      return cachedResponse;
    }

    throw new Error(`No cached response available for ${request.url}`);
  }

  /**
   * Stale While Revalidate Strategy
   */
  private async staleWhileRevalidateStrategy(
    request: Request,
    config: CacheConfig
  ): Promise<Response> {
    const cache = await caches.open(config.name);
    const cachedResponse = await cache.match(request);

    // Start network request in background
    const networkPromise = fetch(request)
      .then(async response => {
        if (response.ok) {
          await this.putInCache(cache, request, response.clone(), config);
        }
        return response;
      })
      .catch(error => {
        console.log(
          `[Cache Manager] Background fetch failed for ${request.url}:`,
          error
        );
      });

    // Return cached response immediately if available
    if (cachedResponse) {
      this.recordHit(config.name);
      // Don't await the network promise - let it update in background
      networkPromise;
      return cachedResponse;
    }

    // Wait for network if no cache available
    try {
      const networkResponse = await networkPromise;
      this.recordMiss(config.name);
      return networkResponse as Response;
    } catch (error) {
      throw new Error(
        `No cached response and network failed for ${request.url}`
      );
    }
  }

  /**
   * Network Only Strategy
   */
  private async networkOnlyStrategy(request: Request): Promise<Response> {
    return fetch(request);
  }

  /**
   * Cache Only Strategy
   */
  private async cacheOnlyStrategy(
    request: Request,
    config: CacheConfig
  ): Promise<Response> {
    const cache = await caches.open(config.name);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      this.recordHit(config.name);
      return cachedResponse;
    }

    this.recordMiss(config.name);
    throw new Error(`No cached response available for ${request.url}`);
  }

  /**
   * Put response in cache with size and age management
   */
  private async putInCache(
    cache: Cache,
    request: Request,
    response: Response,
    config: CacheConfig
  ): Promise<void> {
    // Don't cache non-successful responses
    if (!response.ok) {
      return;
    }

    // Add timestamp header for expiration tracking
    const responseWithTimestamp = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        ...Object.fromEntries(response.headers.entries()),
        'sw-cached-at': Date.now().toString(),
      },
    });

    await cache.put(request, responseWithTimestamp);

    // Cleanup old entries if needed
    await this.cleanupCache(cache, config);
  }

  /**
   * Check if cached response is expired
   */
  private isExpired(response: Response, config: CacheConfig): boolean {
    if (!config.maxAgeSeconds) {
      return false;
    }

    const cachedAt = response.headers.get('sw-cached-at');
    if (!cachedAt) {
      return true; // Assume expired if no timestamp
    }

    const age = (Date.now() - parseInt(cachedAt)) / 1000;
    return age > config.maxAgeSeconds;
  }

  /**
   * Cleanup cache based on size and age limits
   */
  private async cleanupCache(cache: Cache, config: CacheConfig): Promise<void> {
    if (!config.maxEntries && !config.maxAgeSeconds) {
      return;
    }

    const requests = await cache.keys();

    // Remove expired entries
    if (config.maxAgeSeconds) {
      for (const request of requests) {
        const response = await cache.match(request);
        if (response && this.isExpired(response, config)) {
          await cache.delete(request);
        }
      }
    }

    // Remove oldest entries if over limit
    if (config.maxEntries) {
      const remainingRequests = await cache.keys();
      if (remainingRequests.length > config.maxEntries) {
        const entriesToRemove = remainingRequests.length - config.maxEntries;

        // Sort by timestamp (oldest first)
        const requestsWithTimestamp = await Promise.all(
          remainingRequests.map(async request => {
            const response = await cache.match(request);
            const timestamp = response?.headers.get('sw-cached-at') || '0';
            return { request, timestamp: parseInt(timestamp) };
          })
        );

        requestsWithTimestamp
          .sort((a, b) => a.timestamp - b.timestamp)
          .slice(0, entriesToRemove)
          .forEach(({ request }) => cache.delete(request));
      }
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<CacheStats[]> {
    const stats: CacheStats[] = [];

    for (const [cacheName, config] of this.configs) {
      try {
        const cache = await caches.open(cacheName);
        const requests = await cache.keys();
        const cacheStats = this.stats.get(cacheName)!;

        let totalSize = 0;
        for (const request of requests) {
          const response = await cache.match(request);
          if (response) {
            const blob = await response.blob();
            totalSize += blob.size;
          }
        }

        const totalRequests = cacheStats.hits + cacheStats.misses;
        const hitRate = totalRequests > 0 ? cacheStats.hits / totalRequests : 0;

        stats.push({
          name: cacheName,
          size: totalSize,
          entries: requests.length,
          hitRate,
          lastAccessed: cacheStats.lastAccessed,
        });
      } catch (error) {
        console.error(
          `[Cache Manager] Failed to get stats for ${cacheName}:`,
          error
        );
      }
    }

    return stats;
  }

  /**
   * Clear specific cache or all caches
   */
  async clearCache(cacheName?: string): Promise<void> {
    if (cacheName) {
      const cache = await caches.open(cacheName);
      const requests = await cache.keys();
      await Promise.all(requests.map(request => cache.delete(request)));

      // Reset stats
      const stats = this.stats.get(cacheName);
      if (stats) {
        stats.hits = 0;
        stats.misses = 0;
      }
    } else {
      // Clear all managed caches
      for (const cacheName of this.configs.keys()) {
        await this.clearCache(cacheName);
      }
    }
  }

  /**
   * Record cache hit
   */
  private recordHit(cacheName: string): void {
    const stats = this.stats.get(cacheName);
    if (stats) {
      stats.hits++;
    }
  }

  /**
   * Record cache miss
   */
  private recordMiss(cacheName: string): void {
    const stats = this.stats.get(cacheName);
    if (stats) {
      stats.misses++;
    }
  }

  /**
   * Check storage quota and usage
   */
  async getStorageInfo(): Promise<{
    quota: number;
    usage: number;
    available: number;
  }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const quota = estimate.quota || 0;
      const usage = estimate.usage || 0;
      const available = quota - usage;

      return { quota, usage, available };
    }

    return { quota: 0, usage: 0, available: 0 };
  }

  /**
   * Check if storage quota is exceeded
   */
  async isStorageQuotaExceeded(): Promise<boolean> {
    const { quota, usage } = await this.getStorageInfo();
    if (quota === 0) return false;

    // Consider quota exceeded if usage is over 80%
    return usage / quota > 0.8;
  }
}

// Export singleton instance
export const cacheManager = new CacheManager();
