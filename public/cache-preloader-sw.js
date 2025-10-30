/**
 * Service Worker Cache Preloader
 * Intelligent cache preloading based on user navigation patterns
 */

class ServiceWorkerCachePreloader {
  constructor () {
    this.patterns = new Map()
    this.config = {
      maxPatterns: 100,
      minFrequency: 3,
      preloadThreshold: 0.7,
      idleTimeout: 5000,
      criticalPaths: [
        '/',
        '/dashboard',
        '/api/github/activity',
        '/api/slack/messages',
        '/api/ai/summary'
      ]
    }

    this.isIdle = false
    this.idleTimer = null
    this.lastNavigationTime = Date.now()

    this.loadPatterns()
    this.setupIdleDetection()
  }

  /**
     * Track user navigation to build patterns
     */
  trackNavigation (path) {
    const now = Date.now()
    const hour = new Date().getHours()
    const dayOfWeek = new Date().getDay()

    let pattern = this.patterns.get(path)

    if (!pattern) {
      pattern = {
        path,
        frequency: 0,
        lastAccessed: now,
        timeOfDay: [],
        dayOfWeek: [],
        nextPaths: {}
      }
      this.patterns.set(path, pattern)
    }

    // Update pattern data
    pattern.frequency++
    pattern.lastAccessed = now

    // Track time patterns
    if (!pattern.timeOfDay.includes(hour)) {
      pattern.timeOfDay.push(hour)
    }

    if (!pattern.dayOfWeek.includes(dayOfWeek)) {
      pattern.dayOfWeek.push(dayOfWeek)
    }

    // Update next path predictions
    this.updateNextPathPredictions(path)

    // Cleanup and save
    this.cleanupPatterns()
    this.savePatterns()

    // Trigger predictive preloading
    this.triggerPredictivePreload(path)

    // Reset idle detection
    this.resetIdleTimer()
  }

  /**
     * Update predictions for what paths come after current path
     */
  updateNextPathPredictions (currentPath) {
    const lastPath = this.getLastAccessedPath(currentPath)

    if (lastPath && lastPath !== currentPath) {
      const lastPattern = this.patterns.get(lastPath)
      if (lastPattern) {
        if (!lastPattern.nextPaths[currentPath]) {
          lastPattern.nextPaths[currentPath] = 0
        }
        lastPattern.nextPaths[currentPath]++
      }
    }
  }

  /**
     * Get the most recently accessed path (excluding current)
     */
  getLastAccessedPath (excludePath) {
    let lastPath = null
    let lastTime = 0

    for (const [path, pattern] of this.patterns) {
      if (path !== excludePath && pattern.lastAccessed > lastTime) {
        lastTime = pattern.lastAccessed
        lastPath = path
      }
    }

    return lastPath
  }

  /**
     * Trigger predictive preloading based on current path
     */
  async triggerPredictivePreload (currentPath) {
    const pattern = this.patterns.get(currentPath)
    if (!pattern) return

    // Get predicted next paths
    const predictions = this.getPredictedPaths(currentPath)

    // Preload high-probability paths
    for (const { path, probability } of predictions) {
      if (probability >= this.config.preloadThreshold) {
        await this.preloadPath(path)
      }
    }
  }

  /**
     * Get predicted next paths with probabilities
     */
  getPredictedPaths (currentPath) {
    const pattern = this.patterns.get(currentPath)
    if (!pattern) return []

    const predictions = []
    const totalTransitions = Object.values(pattern.nextPaths).reduce((sum, count) => sum + count, 0)

    if (totalTransitions === 0) return []

    // Calculate probabilities for each next path
    for (const [nextPath, count] of Object.entries(pattern.nextPaths)) {
      const probability = count / totalTransitions
      predictions.push({ path: nextPath, probability })
    }

    // Sort by probability (highest first)
    return predictions.sort((a, b) => b.probability - a.probability)
  }

  /**
     * Preload a specific path
     */
  async preloadPath (path) {
    try {
      console.log(`[SW Cache Preloader] Preloading path: ${path}`)

      // Fallback cache names if not available from main SW
      const cacheNames = self.CACHE_NAMES || {
        static: 'unifiedhq-static-v1',
        dynamic: 'unifiedhq-dynamic-v1',
        api: 'unifiedhq-api-v1',
        offline: 'unifiedhq-offline-v1'
      }

      const cacheConfigs = self.CACHE_CONFIGS || {
        [cacheNames.dynamic]: { maxAgeSeconds: 3600, maxEntries: 75 },
        [cacheNames.api]: { maxAgeSeconds: 900, maxEntries: 50 },
        [cacheNames.static]: { maxAgeSeconds: 86400, maxEntries: 100 }
      }

      // Determine appropriate cache based on path
      let cacheName = cacheNames.dynamic
      if (path.startsWith('/api/')) {
        cacheName = cacheNames.api
      } else if (this.isStaticAsset(path)) {
        cacheName = cacheNames.static
      }

      // Check if already cached
      const cache = await caches.open(cacheName)
      const cached = await cache.match(path)

      if (cached && !this.isExpired(cached, cacheConfigs[cacheName])) {
        console.log(`[SW Cache Preloader] Path already cached: ${path}`)
        return
      }

      // Fetch and cache the path
      const response = await fetch(path)
      if (response.ok) {
        await this.putInCache(cache, new Request(path), response.clone(), cacheConfigs[cacheName])
        console.log(`[SW Cache Preloader] Successfully preloaded: ${path}`)
      }
    } catch (error) {
      console.error(`[SW Cache Preloader] Failed to preload ${path}:`, error)
    }
  }

  /**
     * Check if URL is a static asset
     */
  isStaticAsset (path) {
    return (
      path.startsWith('/_next/static/') ||
            path.startsWith('/static/') ||
            path.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/)
    )
  }

  /**
     * Put response in cache with timestamp (reuse existing function)
     */
  async putInCache (cache, request, response, config) {
    if (!response.ok) return

    const responseWithTimestamp = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        ...Object.fromEntries(response.headers.entries()),
        'sw-cached-at': Date.now().toString()
      }
    })

    await cache.put(request, responseWithTimestamp)
    await this.cleanupCache(cache, config)
  }

  /**
     * Check if cached response is expired (reuse existing function)
     */
  isExpired (response, config) {
    if (!config.maxAgeSeconds) return false

    const cachedAt = response.headers.get('sw-cached-at')
    if (!cachedAt) return true

    const age = (Date.now() - parseInt(cachedAt)) / 1000
    return age > config.maxAgeSeconds
  }

  /**
     * Cleanup cache based on size and age limits (reuse existing function)
     */
  async cleanupCache (cache, config) {
    if (!config.maxEntries && !config.maxAgeSeconds) return

    const requests = await cache.keys()

    // Remove expired entries
    if (config.maxAgeSeconds) {
      for (const request of requests) {
        const response = await cache.match(request)
        if (response && this.isExpired(response, config)) {
          await cache.delete(request)
        }
      }
    }

    // Remove oldest entries if over limit
    if (config.maxEntries) {
      const remainingRequests = await cache.keys()
      if (remainingRequests.length > config.maxEntries) {
        const entriesToRemove = remainingRequests.length - config.maxEntries

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

  /**
     * Preload critical dashboard data
     */
  async preloadCriticalData () {
    console.log('[SW Cache Preloader] Starting critical data preload')

    const criticalEndpoints = [
      '/api/github/activity',
      '/api/slack/messages/recent',
      '/api/ai/summary/today',
      '/api/dashboard/stats'
    ]

    // Preload with delays to avoid overwhelming the server
    for (let i = 0; i < criticalEndpoints.length; i++) {
      setTimeout(async () => {
        await this.preloadPath(criticalEndpoints[i])
      }, i * 500)
    }
  }

  /**
     * Setup idle detection for background preloading
     */
  setupIdleDetection () {
    this.resetIdleTimer()
  }

  /**
     * Reset idle timer
     */
  resetIdleTimer () {
    this.isIdle = false
    this.lastNavigationTime = Date.now()

    if (this.idleTimer) {
      clearTimeout(this.idleTimer)
    }

    this.idleTimer = setTimeout(() => {
      this.isIdle = true
      this.performIdlePreloading()
    }, this.config.idleTimeout)
  }

  /**
     * Perform background preloading during idle time
     */
  async performIdlePreloading () {
    if (!this.isIdle) return

    console.log('[SW Cache Preloader] Starting idle preloading')

    // Get frequently accessed paths that might need refreshing
    const frequentPaths = Array.from(this.patterns.values())
      .filter(pattern => pattern.frequency >= this.config.minFrequency)
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10)

    for (const pattern of frequentPaths) {
      if (!this.isIdle) break

      await this.preloadPath(pattern.path)
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    // Preload critical paths during idle time
    for (const path of this.config.criticalPaths) {
      if (!this.isIdle) break

      await this.preloadPath(path)
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    // Preload time-based recommendations
    const timeBasedPaths = this.getTimeBasedRecommendations()
    for (const path of timeBasedPaths.slice(0, 5)) {
      if (!this.isIdle) break

      await this.preloadPath(path)
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    console.log('[SW Cache Preloader] Idle preloading completed')
  }

  /**
     * Get current time-based recommendations
     */
  getTimeBasedRecommendations () {
    const currentHour = new Date().getHours()
    const currentDay = new Date().getDay()

    const recommendations = []

    for (const [path, pattern] of this.patterns) {
      const isTimeMatch = pattern.timeOfDay.includes(currentHour)
      const isDayMatch = pattern.dayOfWeek.includes(currentDay)

      if (isTimeMatch && isDayMatch && pattern.frequency >= this.config.minFrequency) {
        recommendations.push(path)
      }
    }

    return recommendations.sort((a, b) => {
      const patternA = this.patterns.get(a)
      const patternB = this.patterns.get(b)
      return patternB.frequency - patternA.frequency
    })
  }

  /**
     * Cleanup old or infrequent patterns
     */
  cleanupPatterns () {
    if (this.patterns.size <= this.config.maxPatterns) return

    const patternArray = Array.from(this.patterns.entries()).map(([path, pattern]) => ({
      path,
      pattern,
      score: pattern.frequency + (Date.now() - pattern.lastAccessed) / (1000 * 60 * 60 * 24)
    }))

    patternArray.sort((a, b) => b.score - a.score)

    const toKeep = patternArray.slice(0, this.config.maxPatterns)

    this.patterns.clear()
    toKeep.forEach(({ path, pattern }) => {
      this.patterns.set(path, pattern)
    })
  }

  /**
     * Save patterns to IndexedDB
     */
  async savePatterns () {
    try {
      const db = await this.openDB()
      const transaction = db.transaction(['patterns'], 'readwrite')
      const store = transaction.objectStore('patterns')

      const patternsData = {
        id: 'navigation-patterns',
        patterns: Array.from(this.patterns.entries()),
        lastUpdated: Date.now()
      }

      await store.put(patternsData)
    } catch (error) {
      console.error('[SW Cache Preloader] Failed to save patterns:', error)
    }
  }

  /**
     * Load patterns from IndexedDB
     */
  async loadPatterns () {
    try {
      const db = await this.openDB()
      const transaction = db.transaction(['patterns'], 'readonly')
      const store = transaction.objectStore('patterns')

      const result = await store.get('navigation-patterns')

      if (result && result.patterns) {
        this.patterns = new Map(result.patterns)
        console.log(`[SW Cache Preloader] Loaded ${this.patterns.size} navigation patterns`)
      }
    } catch (error) {
      console.error('[SW Cache Preloader] Failed to load patterns:', error)
    }
  }

  /**
     * Open IndexedDB for pattern storage
     */
  openDB () {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('unifiedhq-cache-preloader', 1)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)

      request.onupgradeneeded = (event) => {
        const db = event.target.result

        if (!db.objectStoreNames.contains('patterns')) {
          db.createObjectStore('patterns', { keyPath: 'id' })
        }
      }
    })
  }

  /**
     * Get cache statistics
     */
  async getCacheStats () {
    const frequentPaths = Array.from(this.patterns.values())
      .filter(pattern => pattern.frequency >= this.config.minFrequency)
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5)
      .map(pattern => pattern.path)

    const lastPath = this.getLastAccessedPath()
    const predictions = lastPath ? this.getPredictedPaths(lastPath) : []

    return {
      totalPatterns: this.patterns.size,
      frequentPaths,
      predictions: predictions.slice(0, 5),
      timeBasedRecommendations: this.getTimeBasedRecommendations().slice(0, 5)
    }
  }

  /**
     * Clear all patterns
     */
  async clearPatterns () {
    this.patterns.clear()
    await this.savePatterns()
  }
}

// Initialize cache preloader and expose globally
const cachePreloader = new ServiceWorkerCachePreloader()
self.cachePreloader = cachePreloader
