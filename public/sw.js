// Service Worker for UnifiedHQ Offline Infrastructure
// Version: 1.0.0

const CACHE_VERSION = 'v1.0.0'
const CACHE_NAMES = {
  static: 'unifiedhq-static-v1',
  dynamic: 'unifiedhq-dynamic-v1',
  api: 'unifiedhq-api-v1',
  offline: 'unifiedhq-offline-v1'
}

// Make cache names available globally for imported scripts
self.CACHE_NAMES = CACHE_NAMES

// Cache configurations
const CACHE_CONFIGS = {
  [CACHE_NAMES.static]: {
    name: CACHE_NAMES.static,
    version: CACHE_VERSION,
    strategy: 'cache-first',
    maxEntries: 100,
    maxAgeSeconds: 24 * 60 * 60 // 24 hours
  },
  [CACHE_NAMES.api]: {
    name: CACHE_NAMES.api,
    version: CACHE_VERSION,
    strategy: 'network-first',
    maxEntries: 50,
    maxAgeSeconds: 15 * 60, // 15 minutes
    networkTimeoutSeconds: 5
  },
  [CACHE_NAMES.dynamic]: {
    name: CACHE_NAMES.dynamic,
    version: CACHE_VERSION,
    strategy: 'stale-while-revalidate',
    maxEntries: 75,
    maxAgeSeconds: 60 * 60 // 1 hour
  },
  [CACHE_NAMES.offline]: {
    name: CACHE_NAMES.offline,
    version: CACHE_VERSION,
    strategy: 'cache-only',
    maxEntries: 10,
    maxAgeSeconds: 7 * 24 * 60 * 60 // 7 days
  }
}

// Make cache configs available globally for imported scripts
self.CACHE_CONFIGS = CACHE_CONFIGS

const STATIC_ASSETS = [
  '/',
  '/offline'
]

// Create a fallback cachePreloader object for now to avoid import issues
self.cachePreloader = {
  trackNavigation: () => { },
  preloadCriticalData: () => Promise.resolve(),
  getCacheStats: () => Promise.resolve({}),
  clearPatterns: () => Promise.resolve()
}

// TODO: Re-enable cache preloader once import issues are resolved
// try {
//     importScripts('/cache-preloader-sw.js');
// } catch (error) {
//     console.warn('[SW] Cache preloader not available:', error);
// }

// Install Event - Cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker version:', CACHE_VERSION)

  event.waitUntil(
    (async () => {
      try {
        const staticCache = await caches.open(CACHE_NAMES.static)

        // Cache core static assets
        await staticCache.addAll([
          '/',
          '/offline'
        ])

        console.log('[SW] Static assets cached successfully')

        // Skip waiting to activate immediately
        self.skipWaiting()
      } catch (error) {
        console.error('[SW] Failed to cache static assets:', error)
      }
    })()
  )
})

// Activate Event - Clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker version:', CACHE_VERSION)

  event.waitUntil(
    (async () => {
      try {
        // Clean up old caches
        const cacheNames = await caches.keys()
        const oldCaches = cacheNames.filter(name =>
          name.startsWith('unifiedhq-') &&
                    !Object.values(CACHE_NAMES).includes(name)
        )

        await Promise.all(
          oldCaches.map(cacheName => {
            console.log('[SW] Deleting old cache:', cacheName)
            return caches.delete(cacheName)
          })
        )

        // Take control of all clients
        await self.clients.claim()

        console.log('[SW] Service worker activated successfully')
      } catch (error) {
        console.error('[SW] Failed to activate service worker:', error)
      }
    })()
  )
})

// Fetch Event - Handle network requests with caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests and chrome-extension requests
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return
  }

  // Track navigation for cache preloading
  if (request.mode === 'navigate' || url.pathname.startsWith('/api/')) {
    cachePreloader.trackNavigation(url.pathname)
  }

  event.respondWith(handleFetch(request))
})

// Handle fetch requests with appropriate caching strategy
/**
 * Handle fetch requests with different strategies based on the request type.
 *
 * The function determines the type of request (API, static asset, or dynamic content) and applies the appropriate caching strategy.
 * It utilizes the handleCachedRequest function to manage the requests and handles errors by returning an offline page for navigation requests or a network error response.
 *
 * @param request - The fetch request object containing the URL and other request details.
 * @returns A Response object based on the request type and caching strategy.
 * @throws Error If there is an issue during the fetch process.
 */
async function handleFetch (request) {
  const url = new URL(request.url)

  try {
    // API requests - Network first with cache fallback
    if (url.pathname.startsWith('/api/')) {
      return await handleCachedRequest(request, CACHE_CONFIGS[CACHE_NAMES.api])
    }

    // Static assets - Cache first
    if (isStaticAsset(url)) {
      return await handleCachedRequest(request, CACHE_CONFIGS[CACHE_NAMES.static])
    }

    // Dynamic content - Stale while revalidate
    return await handleCachedRequest(request, CACHE_CONFIGS[CACHE_NAMES.dynamic])
  } catch (error) {
    console.error('[SW] Fetch error:', error)

    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      const offlineCache = await caches.open(CACHE_NAMES.offline)
      const offlineResponse = await offlineCache.match('/offline')
      return offlineResponse || new Response('Offline', { status: 503 })
    }

    return new Response('Network error', { status: 503 })
  }
}

// Handle cached request based on strategy
async function handleCachedRequest (request, config) {
  switch (config.strategy) {
    case 'cache-first':
      return await cacheFirstStrategy(request, config)
    case 'network-first':
      return await networkFirstStrategy(request, config)
    case 'stale-while-revalidate':
      return await staleWhileRevalidateStrategy(request, config)
    case 'cache-only':
      return await cacheOnlyStrategy(request, config)
    default:
      return await fetch(request)
  }
}

// Network First Strategy - Try network, fallback to cache
/**
 * Implements a network-first strategy for handling requests.
 *
 * The function attempts to fetch a response from the network, applying a timeout to avoid long waits.
 * If the network request fails, it checks the cache for a valid response. If a cached response is found
 * and is not expired, it returns that response; otherwise, it throws the original error.
 *
 * @param request - The request object to be fetched from the network.
 * @param config - Configuration object containing cache name and network timeout settings.
 * @returns The network response or a cached response if the network request fails.
 * @throws Error If the network request fails and no valid cached response is available.
 */
async function networkFirstStrategy (request, config) {
  const cache = await caches.open(config.name)
  const timeoutMs = (config.networkTimeoutSeconds || 5) * 1000

  try {
    const networkResponse = await Promise.race([
      fetch(request),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Network timeout')), timeoutMs)
      )
    ])

    if (networkResponse.ok) {
      await putInCache(cache, request, networkResponse.clone(), config)
    }

    return networkResponse
  } catch (error) {
    console.log('[SW] Network failed, trying cache for:', request.url)
    const cachedResponse = await cache.match(request)

    if (cachedResponse && !isExpired(cachedResponse, config)) {
      return cachedResponse
    }

    throw error
  }
}

// Cache First Strategy - Try cache, fallback to network
async function cacheFirstStrategy (request, config) {
  const cache = await caches.open(config.name)
  const cachedResponse = await cache.match(request)

  if (cachedResponse && !isExpired(cachedResponse, config)) {
    return cachedResponse
  }

  try {
    const networkResponse = await fetch(request)
    if (networkResponse.ok) {
      await putInCache(cache, request, networkResponse.clone(), config)
    }
    return networkResponse
  } catch (error) {
    // Return stale cache if network fails
    if (cachedResponse) {
      return cachedResponse
    }
    throw error
  }
}

// Stale While Revalidate Strategy - Return cache, update in background
async function staleWhileRevalidateStrategy (request, config) {
  const cache = await caches.open(config.name)
  const cachedResponse = await cache.match(request)

  // Fetch from network in background
  const networkPromise = fetch(request).then(async response => {
    if (response.ok) {
      await putInCache(cache, request, response.clone(), config)
    }
    return response
  }).catch(error => {
    console.log('[SW] Background fetch failed:', error)
  })

  // Return cached version immediately if available
  if (cachedResponse) {
    // Don't await the network promise - let it update in background

    return cachedResponse
  }

  // Wait for network if no cache available
  return await networkPromise
}

// Cache Only Strategy - Only return cached responses
/**
 * Retrieves a cached response for a given request using the specified configuration.
 *
 * This function opens a cache with the name provided in the config, then attempts to match
 * the request against the cached responses. If a valid cached response is found and it is not
 * expired (as determined by the isExpired function), that response is returned. If no valid
 * cached response is available, an error is thrown.
 *
 * @param {Request} request - The request object to match against the cache.
 * @param {Object} config - The configuration object containing cache settings.
 */
async function cacheOnlyStrategy (request, config) {
  const cache = await caches.open(config.name)
  const cachedResponse = await cache.match(request)

  if (cachedResponse && !isExpired(cachedResponse, config)) {
    return cachedResponse
  }

  throw new Error(`No cached response available for ${request.url}`)
}

// Check if URL is a static asset
function isStaticAsset (url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
        url.pathname.startsWith('/static/') ||
        url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/)
  )
}

// Background Sync Event - Handle offline action synchronization
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync event:', event.tag)

  if (event.tag === 'offline-actions-sync') {
    event.waitUntil(handleBackgroundSync())
  }
})

// Handle background sync for offline actions
/**
 * Handles background synchronization for offline actions.
 */
async function handleBackgroundSync () {
  try {
    console.log('[SW] Starting background sync for offline actions')

    // Notify the main thread that sync is starting
    const clients = await self.clients.matchAll()
    clients.forEach(client => {
      client.postMessage({
        type: 'BACKGROUND_SYNC_START',
        payload: { timestamp: Date.now() }
      })
    })

    console.log('[SW] Background sync notification sent to clients')
  } catch (error) {
    console.error('[SW] Background sync failed:', error)
  }
}

// Message handling for cache management and sync
self.addEventListener('message', (event) => {
  const { type, payload } = event.data

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting()
      break

    case 'GET_VERSION':
      event.ports[0].postMessage({ version: CACHE_VERSION })
      break

    case 'CLEAR_CACHE':
      clearCache(payload?.cacheName).then(() => {
        event.ports[0].postMessage({ success: true })
      }).catch(error => {
        event.ports[0].postMessage({ success: false, error: error.message })
      })
      break

    case 'GET_CACHE_STATS':
      getCacheStats().then(stats => {
        event.ports[0].postMessage({ success: true, stats })
      }).catch(error => {
        event.ports[0].postMessage({ success: false, error: error.message })
      })
      break

    case 'GET_STORAGE_INFO':
      getStorageInfo().then(info => {
        event.ports[0].postMessage({ success: true, info })
      }).catch(error => {
        event.ports[0].postMessage({ success: false, error: error.message })
      })
      break

    case 'REGISTER_BACKGROUND_SYNC':
      // Register background sync from main thread
      self.registration.sync.register('offline-actions-sync').then(() => {
        event.ports[0].postMessage({ success: true })
      }).catch(error => {
        event.ports[0].postMessage({ success: false, error: error.message })
      })
      break

    case 'PRELOAD_CRITICAL_DATA':
      // Trigger critical data preloading
      cachePreloader.preloadCriticalData().then(() => {
        event.ports[0].postMessage({ success: true })
      }).catch(error => {
        event.ports[0].postMessage({ success: false, error: error.message })
      })
      break

    case 'GET_PRELOAD_STATS':
      // Get cache preloader statistics
      cachePreloader.getCacheStats().then(stats => {
        event.ports[0].postMessage({ success: true, stats })
      }).catch(error => {
        event.ports[0].postMessage({ success: false, error: error.message })
      })
      break

    case 'CLEAR_NAVIGATION_PATTERNS':
      // Clear navigation patterns
      cachePreloader.clearPatterns().then(() => {
        event.ports[0].postMessage({ success: true })
      }).catch(error => {
        event.ports[0].postMessage({ success: false, error: error.message })
      })
      break

    case 'TRACK_NAVIGATION':
      // Manual navigation tracking
      if (payload?.path) {
        cachePreloader.trackNavigation(payload.path)
        event.ports[0].postMessage({ success: true })
      } else {
        event.ports[0].postMessage({ success: false, error: 'Path required' })
      }
      break

    default:
      console.log('[SW] Unknown message type:', type)
  }
})

// Clear specific cache or all caches
/**
 * Clears the specified cache or all caches if no name is provided.
 *
 * The function checks if a cacheName is provided. If it is, it deletes the specific cache associated with that name.
 * If no cacheName is given, it retrieves all cache names and deletes each one using Promise.all to handle the deletions concurrently.
 *
 * @param {string} cacheName - The name of the cache to be deleted. If not provided, all caches will be cleared.
 */
async function clearCache (cacheName) {
  if (cacheName) {
    return await caches.delete(cacheName)
  } else {
    const cacheNames = await caches.keys()
    return await Promise.all(
      cacheNames.map(name => caches.delete(name))
    )
  }
}

// Get cache statistics
/**
 * Retrieve statistics for all caches defined in CACHE_CONFIGS.
 *
 * The function iterates over each cache configuration, opens the corresponding cache, and calculates the total size of all cached responses.
 * It collects the cache name, total size, number of entries, and configuration details into an array.
 * Errors during cache access are logged to the console but do not interrupt the process for other caches.
 *
 * @returns An array of objects containing cache statistics, including name, size, entries, and config.
 */
async function getCacheStats () {
  const stats = []

  for (const [cacheName, config] of Object.entries(CACHE_CONFIGS)) {
    try {
      const cache = await caches.open(cacheName)
      const requests = await cache.keys()

      let totalSize = 0
      for (const request of requests) {
        const response = await cache.match(request)
        if (response) {
          const blob = await response.blob()
          totalSize += blob.size
        }
      }

      stats.push({
        name: cacheName,
        size: totalSize,
        entries: requests.length,
        config
      })
    } catch (error) {
      console.error(`[SW] Failed to get stats for ${cacheName}:`, error)
    }
  }

  return stats
}

// Cache management utilities

// Put response in cache with timestamp and cleanup
/**
 * Caches a successful response with a timestamp for expiration tracking.
 *
 * This function checks if the response is successful before caching it. If successful, it creates a new response object that includes a timestamp header. The response is then stored in the cache using the provided request. Finally, it calls the cleanupCache function to remove old entries based on the provided config.
 *
 * @param {Cache} cache - The cache object where the response will be stored.
 * @param {Request} request - The request object associated with the response.
 * @param {Response} response - The response object to be cached.
 * @param {Object} config - Configuration object for cache cleanup.
 */
async function putInCache (cache, request, response, config) {
  // Don't cache non-successful responses
  if (!response.ok) {
    return
  }

  // Add timestamp header for expiration tracking
  const responseWithTimestamp = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      ...Object.fromEntries(response.headers.entries()),
      'sw-cached-at': Date.now().toString()
    }
  })

  await cache.put(request, responseWithTimestamp)

  // Cleanup old entries if needed
  await cleanupCache(cache, config)
}

// Check if cached response is expired
/**
 * Checks if a cached response has expired based on the provided configuration.
 *
 * The function first verifies if a maximum age is specified in the config. If not, it assumes the response is not expired.
 * It then retrieves the cached timestamp from the response headers. If the timestamp is absent, the function assumes the response is expired.
 * Finally, it calculates the age of the cache and compares it to the maximum age to determine if the response is expired.
 *
 * @param {Response} response - The response object containing headers to check for cache information.
 * @param {Object} config - Configuration object containing the maxAgeSeconds property.
 */
function isExpired (response, config) {
  if (!config.maxAgeSeconds) {
    return false
  }

  const cachedAt = response.headers.get('sw-cached-at')
  if (!cachedAt) {
    return true // Assume expired if no timestamp
  }

  const age = (Date.now() - parseInt(cachedAt)) / 1000
  return age > config.maxAgeSeconds
}

// Cleanup cache based on size and age limits
/**
 * Cleans up the cache by removing expired entries and oldest entries if limits are exceeded.
 *
 * The function first checks if there are any constraints on max entries or max age. If so, it retrieves all cache keys and removes entries that are expired based on the provided configuration. If the number of remaining entries exceeds the maxEntries limit, it sorts the entries by their timestamp and deletes the oldest ones until the limit is met.
 *
 * @param cache - The cache object to be cleaned up.
 * @param config - Configuration object containing maxEntries and maxAgeSeconds.
 */
async function cleanupCache (cache, config) {
  if (!config.maxEntries && !config.maxAgeSeconds) {
    return
  }

  const requests = await cache.keys()

  // Remove expired entries
  if (config.maxAgeSeconds) {
    for (const request of requests) {
      const response = await cache.match(request)
      if (response && isExpired(response, config)) {
        await cache.delete(request)
      }
    }
  }

  // Remove oldest entries if over limit
  if (config.maxEntries) {
    const remainingRequests = await cache.keys()
    if (remainingRequests.length > config.maxEntries) {
      const entriesToRemove = remainingRequests.length - config.maxEntries

      // Sort by timestamp (oldest first)
      const requestsWithTimestamp = await Promise.all(
        remainingRequests.map(async (request) => {
          const response = await cache.match(request)
          const timestamp = response?.headers.get('sw-cached-at') || '0'
          return { request, timestamp: parseInt(timestamp) }
        })
      )

      const toDelete = requestsWithTimestamp
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(0, entriesToRemove)

      await Promise.all(
        toDelete.map(({ request }) => cache.delete(request))
      )
    }
  }
}

// Get storage quota information
/**
 * Retrieves storage information from the browser's storage API.
 *
 * This function checks if the browser supports the storage API and if the estimate method is available.
 * If so, it retrieves the storage estimate, returning an object containing the quota, usage, and available space.
 * If the storage API is not supported, it returns an object with all values set to zero.
 */
async function getStorageInfo () {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate()
    return {
      quota: estimate.quota || 0,
      usage: estimate.usage || 0,
      available: (estimate.quota || 0) - (estimate.usage || 0)
    }
  }
  return { quota: 0, usage: 0, available: 0 }
}

// Check if storage quota is exceeded
async function isStorageQuotaExceeded () {
  const { quota, usage } = await getStorageInfo()
  if (quota === 0) return false

  // Consider quota exceeded if usage is over 80%
  return (usage / quota) > 0.8
}
