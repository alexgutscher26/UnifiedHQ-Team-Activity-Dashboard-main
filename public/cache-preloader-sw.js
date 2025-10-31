/**
 * Cache Preloader for UnifiedHQ Service Worker
 * Advanced caching and preloading strategies based on navigation patterns
 */

// Ensure this script is only loaded in service worker context
if (typeof importScripts !== 'function') {
  throw new Error('cache-preloader-sw.js must be loaded in a service worker context')
}

// Cache preloader configuration
const PRELOADER_CONFIG = {
  // Preloading strategies
  strategies: {
    immediate: 'immediate', // Preload immediately on navigation
    idle: 'idle', // Preload during idle time
    predictive: 'predictive', // Preload based on patterns
    critical: 'critical' // Always preload critical resources
  },

  // Resource priorities
  priorities: {
    critical: 1,
    high: 2,
    normal: 3,
    low: 4
  },

  // Timing configurations
  idleTimeout: 2000, // Wait 2s before idle preloading
  preloadBatchSize: 3, // Max concurrent preloads
  maxPreloadAge: 5 * 60 * 1000, // 5 minutes max age for preloaded resources

  // Pattern matching
  patternConfidence: 0.7, // Minimum confidence for predictive preloading
  minPatternOccurrences: 3 // Minimum occurrences to establish pattern
}

// Resource definitions for different app sections
const RESOURCE_DEFINITIONS = {
  '/dashboard': {
    priority: PRELOADER_CONFIG.priorities.critical,
    strategy: PRELOADER_CONFIG.strategies.immediate,
    resources: [
      { url: '/api/activities/recent', type: 'api', cacheName: self.CACHE_NAMES?.api },
      { url: '/api/integrations/status', type: 'api', cacheName: self.CACHE_NAMES?.api },
      { url: '/api/user/preferences', type: 'api', cacheName: self.CACHE_NAMES?.api }
    ]
  },

  '/integrations': {
    priority: PRELOADER_CONFIG.priorities.high,
    strategy: PRELOADER_CONFIG.strategies.predictive,
    resources: [
      { url: '/api/integrations', type: 'api', cacheName: self.CACHE_NAMES?.api },
      { url: '/api/integrations/github', type: 'api', cacheName: self.CACHE_NAMES?.api },
      { url: '/api/integrations/slack', type: 'api', cacheName: self.CACHE_NAMES?.api }
    ]
  },

  '/settings': {
    priority: PRELOADER_CONFIG.priorities.normal,
    strategy: PRELOADER_CONFIG.strategies.idle,
    resources: [
      { url: '/api/user/profile', type: 'api', cacheName: self.CACHE_NAMES?.api },
      { url: '/api/user/settings', type: 'api', cacheName: self.CACHE_NAMES?.api },
      { url: '/api/user/preferences', type: 'api', cacheName: self.CACHE_NAMES?.api }
    ]
  },

  '/activities': {
    priority: PRELOADER_CONFIG.priorities.normal,
    strategy: PRELOADER_CONFIG.strategies.predictive,
    resources: [
      { url: '/api/activities', type: 'api', cacheName: self.CACHE_NAMES?.api },
      { url: '/api/activities/github', type: 'api', cacheName: self.CACHE_NAMES?.api },
      { url: '/api/activities/slack', type: 'api', cacheName: self.CACHE_NAMES?.api }
    ]
  }
}

// Preload queue and state management
const PRELOAD_STATE = {
  queue: new Map(), // url -> { priority, strategy, timestamp, attempts }
  active: new Set(), // Currently preloading URLs
  completed: new Map(), // url -> { timestamp, success, cacheHit }
  patterns: new Map(), // Enhanced pattern storage
  idleTimer: null,
  isIdle: false
}

/**
 * Enhanced cache preloader that integrates with navigation tracking
 */
class CachePreloader {
  constructor () {
    this.initializeIdleDetection()
    this.bindToNavigationTracking()
  }

  /**
   * Track navigation and trigger appropriate preloading.
   *
   * This function checks if a navigation tracking method exists in the cachePreloader.
   * If it does and is not a placeholder, it calls the enhancedTrackNavigation method.
   * Regardless of the tracking method's existence, it then triggers preloading based on the provided path and sessionId.
   * Any errors encountered during this process are logged to the console.
   *
   * @param {string} path - The navigation path to track.
   * @param {string} [sessionId='default'] - The session identifier for tracking.
   */
  trackNavigation (path, sessionId = 'default') {
    try {
      // Call the original navigation tracking if it exists
      if (self.cachePreloader?.trackNavigation && typeof self.cachePreloader.trackNavigation === 'function') {
        // Don't call if we're replacing it
        if (self.cachePreloader.trackNavigation.toString().includes('Navigation tracking not implemented')) {
          this.enhancedTrackNavigation(path, sessionId)
        }
      } else {
        this.enhancedTrackNavigation(path, sessionId)
      }

      // Trigger preloading based on the navigation
      this.handleNavigationPreload(path, sessionId)
    } catch (error) {
      console.error('[CachePreloader] Navigation tracking error:', error)
    }
  }

  /**
   * Enhanced navigation tracking with pattern analysis.
   *
   * This function updates navigation tracking data based on the provided path and sessionId.
   * It checks if navigation tracking is enabled and updates the path patterns and session data accordingly.
   * If a session is new or has timed out, it initializes a new session. The function also detects navigation patterns
   * within the session and updates preload targets for previous paths, enhancing the tracking capabilities.
   *
   * @param {string} path - The current navigation path being tracked.
   * @param {string} sessionId - The unique identifier for the user session.
   */
  enhancedTrackNavigation (path, sessionId) {
    const now = Date.now()

    // Update navigation tracking if available
    if (self.NAVIGATION_TRACKING) {
      // Update path patterns
      const existing = self.NAVIGATION_TRACKING.patterns.get(path) || {
        count: 0,
        lastAccessed: 0,
        preloadTargets: new Set(),
        firstAccessed: now
      }

      existing.count++
      existing.lastAccessed = now
      self.NAVIGATION_TRACKING.patterns.set(path, existing)

      // Update session tracking
      let session = self.NAVIGATION_TRACKING.sessions.get(sessionId)
      if (!session || (now - session.lastActivity) > (self.NAVIGATION_TRACKING.sessionTimeout || 30 * 60 * 1000)) {
        session = {
          startTime: now,
          lastActivity: now,
          paths: [],
          patterns: new Set()
        }
        self.NAVIGATION_TRACKING.sessions.set(sessionId, session)
      }

      session.lastActivity = now
      session.paths.push({ path, timestamp: now })

      // Detect navigation patterns within session
      if (session.paths.length >= 2) {
        const previousPath = session.paths[session.paths.length - 2].path
        const pattern = `${previousPath} -> ${path}`
        session.patterns.add(pattern)

        // Update preload targets for the previous path
        const prevPattern = self.NAVIGATION_TRACKING.patterns.get(previousPath)
        if (prevPattern) {
          prevPattern.preloadTargets.add(path)
        }
      }
    }

    console.debug('[CachePreloader] Enhanced navigation tracked:', { path, sessionId })
  }

  /**
   * Handle preloading based on navigation event
   */
  async handleNavigationPreload (path, sessionId) {
    try {
      // Get resource definition for this path
      const resourceDef = this.getResourceDefinition(path)

      if (resourceDef) {
        await this.schedulePreload(resourceDef.resources, resourceDef.strategy, resourceDef.priority)
      }

      // Predictive preloading based on patterns
      await this.predictivePreload(path, sessionId)
    } catch (error) {
      console.error('[CachePreloader] Navigation preload error:', error)
    }
  }

  /**
   * Get resource definition for a path.
   *
   * This function first checks for an exact match in the RESOURCE_DEFINITIONS object using the provided path.
   * If no exact match is found, it iterates through the entries of RESOURCE_DEFINITIONS to find a pattern
   * that the path starts with, returning the corresponding definition if a match is found.
   * If no matches are found, it returns null.
   *
   * @param {string} path - The path for which to retrieve the resource definition.
   */
  getResourceDefinition (path) {
    // Exact match first
    if (RESOURCE_DEFINITIONS[path]) {
      return RESOURCE_DEFINITIONS[path]
    }

    // Pattern matching for dynamic routes
    for (const [pattern, definition] of Object.entries(RESOURCE_DEFINITIONS)) {
      if (path.startsWith(pattern)) {
        return definition
      }
    }

    return null
  }

  /**
   * Schedule resources for preloading.
   *
   * This function iterates over the provided resources, creating a queue item for each resource with its associated priority, strategy, and timestamp.
   * It then executes preloading based on the specified strategy, which can be immediate, idle, predictive, or critical, invoking the appropriate preload method as needed.
   *
   * @param resources - An array of resources to be preloaded.
   * @param strategy - The strategy to use for preloading resources.
   * @param priority - The priority level for the preloading operation.
   * @returns A promise that resolves when the preloading process is complete.
   */
  async schedulePreload (resources, strategy, priority) {
    const now = Date.now()

    for (const resource of resources) {
      const queueItem = {
        ...resource,
        priority,
        strategy,
        timestamp: now,
        attempts: 0
      }

      PRELOAD_STATE.queue.set(resource.url, queueItem)
    }

    // Execute preloading based on strategy
    switch (strategy) {
      case PRELOADER_CONFIG.strategies.immediate:
        await this.executePreload()
        break

      case PRELOADER_CONFIG.strategies.idle:
        this.scheduleIdlePreload()
        break

      case PRELOADER_CONFIG.strategies.predictive:
        await this.executePredictivePreload()
        break

      case PRELOADER_CONFIG.strategies.critical:
        await this.executeCriticalPreload()
        break
    }
  }

  /**
   * Execute immediate preloading of resources in the next batch.
   */
  async executePreload () {
    const batch = this.getNextBatch()
    const promises = batch.map(item => this.preloadResource(item))

    await Promise.allSettled(promises)
  }

  /**
   * Executes predictive preloading for high confidence items.
   */
  async executePredictivePreload () {
    const highConfidenceItems = Array.from(PRELOAD_STATE.queue.values())
      .filter(item => this.calculatePreloadConfidence(item) >= PRELOADER_CONFIG.patternConfidence)

    if (highConfidenceItems.length > 0) {
      const promises = highConfidenceItems
        .slice(0, PRELOADER_CONFIG.preloadBatchSize)
        .map(item => this.preloadResource(item))

      await Promise.allSettled(promises)
    }
  }

  /**
   * Execute critical resource preloading.
   */
  async executeCriticalPreload () {
    const criticalItems = Array.from(PRELOAD_STATE.queue.values())
      .filter(item => item.priority === PRELOADER_CONFIG.priorities.critical)

    const promises = criticalItems.map(item => this.preloadResource(item))
    await Promise.allSettled(promises)
  }

  /**
   * Get the next batch of resources to preload based on priority.
   */
  getNextBatch () {
    const available = Array.from(PRELOAD_STATE.queue.values())
      .filter(item => !PRELOAD_STATE.active.has(item.url))
      .sort((a, b) => a.priority - b.priority)

    return available.slice(0, PRELOADER_CONFIG.preloadBatchSize)
  }

  /**
   * Preload a single resource
   */
  async preloadResource (item) {
    if (PRELOAD_STATE.active.has(item.url)) {
      return
    }

    PRELOAD_STATE.active.add(item.url)

    try {
      console.debug('[CachePreloader] Preloading:', item.url)

      const response = await fetch(item.url, {
        method: 'GET',
        headers: {
          'X-Preload': 'true',
          'X-Cache-Strategy': item.strategy
        }
      })

      if (response.ok && item.cacheName) {
        const cache = await caches.open(item.cacheName)
        await cache.put(item.url, response.clone())

        PRELOAD_STATE.completed.set(item.url, {
          timestamp: Date.now(),
          success: true,
          cacheHit: false,
          strategy: item.strategy
        })

        console.debug('[CachePreloader] Successfully preloaded and cached:', item.url)
      }

      PRELOAD_STATE.queue.delete(item.url)
    } catch (error) {
      console.warn('[CachePreloader] Preload failed:', item.url, error)

      item.attempts++
      if (item.attempts < 3) {
        // Retry with exponential backoff
        setTimeout(() => {
          PRELOAD_STATE.queue.set(item.url, item)
        }, Math.pow(2, item.attempts) * 1000)
      } else {
        PRELOAD_STATE.queue.delete(item.url)
      }

      PRELOAD_STATE.completed.set(item.url, {
        timestamp: Date.now(),
        success: false,
        error: error.message,
        strategy: item.strategy
      })
    } finally {
      PRELOAD_STATE.active.delete(item.url)
    }
  }

  /**
   * Predictive preloading based on navigation patterns.
   *
   * This function analyzes the current navigation path and retrieves likely next destinations based on predefined patterns.
   * It calculates the confidence for each target path and preloads resources for the top three targets that meet the confidence threshold.
   * The function relies on external configurations and methods to determine resource definitions and scheduling for preloading.
   *
   * @param currentPath - The current navigation path being analyzed.
   * @param sessionId - The session identifier for tracking user navigation.
   * @returns {Promise<void>} A promise that resolves when the preloading is complete.
   */
  async predictivePreload (currentPath, sessionId) {
    if (!self.NAVIGATION_TRACKING) return

    const pattern = self.NAVIGATION_TRACKING.patterns.get(currentPath)
    if (!pattern || pattern.preloadTargets.size === 0) return

    // Get likely next destinations
    const targets = Array.from(pattern.preloadTargets)
      .map(targetPath => ({
        path: targetPath,
        confidence: this.calculatePathConfidence(currentPath, targetPath)
      }))
      .filter(target => target.confidence >= PRELOADER_CONFIG.patternConfidence)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3)

    // Preload resources for likely destinations
    for (const target of targets) {
      const resourceDef = this.getResourceDefinition(target.path)
      if (resourceDef) {
        await this.schedulePreload(
          resourceDef.resources,
          PRELOADER_CONFIG.strategies.predictive,
          resourceDef.priority
        )
      }
    }
  }

  /**
   * Calculate confidence for path transition.
   *
   * This function computes the confidence level for transitioning from one path to another based on the navigation tracking patterns.
   * It first checks if navigation tracking is enabled, then retrieves the pattern associated with the `fromPath`.
   * If the pattern exists, it counts the occurrences of the `toPath` in the preload targets and calculates the confidence as the ratio of
   * successful transitions to the total number of transitions. If there are no transitions, it returns 0.
   *
   * @param {string} fromPath - The starting path for the transition.
   * @param {string} toPath - The target path for the transition.
   */
  calculatePathConfidence (fromPath, toPath) {
    if (!self.NAVIGATION_TRACKING) return 0

    const fromPattern = self.NAVIGATION_TRACKING.patterns.get(fromPath)
    if (!fromPattern) return 0

    const transitionCount = Array.from(fromPattern.preloadTargets).filter(p => p === toPath).length
    const totalTransitions = fromPattern.preloadTargets.size

    return totalTransitions > 0 ? transitionCount / totalTransitions : 0
  }

  /**
   * Calculate preload confidence based on item priority and age.
   */
  calculatePreloadConfidence (item) {
    const now = Date.now()
    const age = now - item.timestamp
    const maxAge = PRELOADER_CONFIG.maxPreloadAge

    // Base confidence on priority and age
    let confidence = 1 - (item.priority / 4) // Higher priority = higher confidence
    confidence *= Math.max(0, 1 - (age / maxAge)) // Newer = higher confidence

    return confidence
  }

  /**
   * Initialize idle detection for preloading based on available APIs.
   */
  initializeIdleDetection () {
    // Use requestIdleCallback if available
    if (typeof requestIdleCallback !== 'undefined') {
      /**
       * Schedules work to be done during idle periods.
       */
      const scheduleIdleWork = () => {
        requestIdleCallback((deadline) => {
          if (deadline.timeRemaining() > 0) {
            PRELOAD_STATE.isIdle = true
            this.processIdleQueue()
          }
          scheduleIdleWork()
        })
      }
      scheduleIdleWork()
    } else {
      // Fallback to setTimeout
      setInterval(() => {
        PRELOAD_STATE.isIdle = true
        this.processIdleQueue()
      }, PRELOADER_CONFIG.idleTimeout)
    }
  }

  /**
   * Schedules preloading during idle time if the system is idle.
   */
  scheduleIdlePreload () {
    if (PRELOAD_STATE.isIdle) {
      this.processIdleQueue()
    }
  }

  /**
   * Process preload queue during idle time
   */
  async processIdleQueue () {
    if (!PRELOAD_STATE.isIdle) return

    const idleItems = Array.from(PRELOAD_STATE.queue.values())
      .filter(item => item.strategy === PRELOADER_CONFIG.strategies.idle)

    if (idleItems.length > 0) {
      const batch = idleItems.slice(0, Math.min(2, PRELOADER_CONFIG.preloadBatchSize))
      const promises = batch.map(item => this.preloadResource(item))

      await Promise.allSettled(promises)
    }

    PRELOAD_STATE.isIdle = false
  }

  /**
   * Bind to existing navigation tracking system and enhance cachePreloader methods.
   */
  bindToNavigationTracking () {
    // Enhance existing cachePreloader if it exists
    if (self.cachePreloader) {
      // Store original methods
      const originalMethods = {
        preloadCriticalData: self.cachePreloader.preloadCriticalData,
        getCacheStats: self.cachePreloader.getCacheStats,
        clearPatterns: self.cachePreloader.clearPatterns
      }

      // Enhance with new functionality
      self.cachePreloader.trackNavigation = this.trackNavigation.bind(this)
      self.cachePreloader.preloadCriticalData = this.enhancedPreloadCriticalData.bind(this, originalMethods.preloadCriticalData)
      self.cachePreloader.getCacheStats = this.enhancedGetCacheStats.bind(this, originalMethods.getCacheStats)
      self.cachePreloader.clearPatterns = this.enhancedClearPatterns.bind(this, originalMethods.clearPatterns)

      // Add new methods
      self.cachePreloader.getPreloadStats = this.getPreloadStats.bind(this)
      self.cachePreloader.forcePreload = this.forcePreload.bind(this)
      self.cachePreloader.clearPreloadQueue = this.clearPreloadQueue.bind(this)
    }
  }

  /**
   * Enhanced critical data preloading.
   *
   * This function enhances the preloading of critical data by first calling an optional original method,
   * then iterating over predefined critical paths to schedule preloading of resources.
   * It utilizes the resource definitions obtained from the paths and applies specific preloader strategies
   * and priorities. Finally, it executes the critical preload and handles any errors that may occur during the process.
   *
   * @param {Function} originalMethod - An optional method to call before preloading critical data.
   */
  async enhancedPreloadCriticalData (originalMethod) {
    try {
      // Call original method if it exists
      if (originalMethod) {
        await originalMethod()
      }

      // Add enhanced critical preloading
      const criticalPaths = ['/dashboard', '/api/activities/recent', '/api/integrations/status']

      for (const path of criticalPaths) {
        const resourceDef = this.getResourceDefinition(path)
        if (resourceDef) {
          await this.schedulePreload(
            resourceDef.resources,
            PRELOADER_CONFIG.strategies.critical,
            PRELOADER_CONFIG.priorities.critical
          )
        }
      }

      await this.executeCriticalPreload()
    } catch (error) {
      console.error('[CachePreloader] Enhanced critical preload error:', error)
    }
  }

  /**
   * Enhanced cache statistics.
   *
   * This function retrieves enhanced cache statistics by optionally invoking an original method to get existing stats.
   * It then combines these stats with additional information about preloading, including queue size, active and completed preloads,
   * success rate, average preload time, and the number of resource definitions. In case of an error, it logs the error and returns an empty object.
   *
   * @param {Function} originalMethod - An optional function that returns the original cache statistics.
   */
  async enhancedGetCacheStats (originalMethod) {
    try {
      const originalStats = originalMethod ? await originalMethod() : {}

      const preloadStats = {
        ...originalStats,
        preloader: {
          queueSize: PRELOAD_STATE.queue.size,
          activePreloads: PRELOAD_STATE.active.size,
          completedPreloads: PRELOAD_STATE.completed.size,
          successRate: this.calculateSuccessRate(),
          averagePreloadTime: this.calculateAveragePreloadTime(),
          resourceDefinitions: Object.keys(RESOURCE_DEFINITIONS).length
        }
      }

      return preloadStats
    } catch (error) {
      console.error('[CachePreloader] Enhanced stats error:', error)
      return {}
    }
  }

  /**
   * Enhanced pattern clearing.
   *
   * This function asynchronously clears the preloader state by invoking the original method if provided,
   * and then clearing various states related to the preloader. It handles any errors that may occur
   * during the process and logs them for debugging purposes.
   *
   * @param {Function} originalMethod - The original method to be called before clearing the states.
   */
  async enhancedClearPatterns (originalMethod) {
    try {
      // Call original method
      if (originalMethod) {
        await originalMethod()
      }

      // Clear preloader state
      PRELOAD_STATE.queue.clear()
      PRELOAD_STATE.active.clear()
      PRELOAD_STATE.completed.clear()
      PRELOAD_STATE.patterns.clear()

      console.debug('[CachePreloader] Enhanced patterns cleared')
    } catch (error) {
      console.error('[CachePreloader] Enhanced clear patterns error:', error)
    }
  }

  /**
   * Retrieves preloader-specific statistics including queue, active items, completed tasks, and performance metrics.
   */
  getPreloadStats () {
    return {
      queue: {
        size: PRELOAD_STATE.queue.size,
        items: Array.from(PRELOAD_STATE.queue.entries()).map(([url, item]) => ({
          url,
          priority: item.priority,
          strategy: item.strategy,
          attempts: item.attempts,
          age: Date.now() - item.timestamp
        }))
      },
      active: Array.from(PRELOAD_STATE.active),
      completed: {
        total: PRELOAD_STATE.completed.size,
        successful: Array.from(PRELOAD_STATE.completed.values()).filter(c => c.success).length,
        failed: Array.from(PRELOAD_STATE.completed.values()).filter(c => !c.success).length
      },
      performance: {
        successRate: this.calculateSuccessRate(),
        averageTime: this.calculateAveragePreloadTime()
      }
    }
  }

  /**
   * Force preload specific resources.
   *
   * This function takes an array of URLs and constructs a resources array with each URL,
   * setting the type to 'api' and the cache name to a default or specified value. It then
   * schedules the preloading of these resources using the immediate strategy and high priority,
   * followed by executing the preload process.
   *
   * @param {string[]} urls - An array of URLs to preload.
   */
  async forcePreload (urls) {
    const resources = urls.map(url => ({
      url,
      type: 'api',
      cacheName: self.CACHE_NAMES?.api || 'default'
    }))

    await this.schedulePreload(
      resources,
      PRELOADER_CONFIG.strategies.immediate,
      PRELOADER_CONFIG.priorities.high
    )

    await this.executePreload()
  }

  /**
   * Clear preload queue
   */
  clearPreloadQueue () {
    PRELOAD_STATE.queue.clear()
    PRELOAD_STATE.active.clear()
  }

  /**
   * Calculate the success rate of completed tasks.
   */
  calculateSuccessRate () {
    const completed = Array.from(PRELOAD_STATE.completed.values())
    if (completed.length === 0) return 0

    const successful = completed.filter(c => c.success).length
    return successful / completed.length
  }

  /**
   * Calculate average preload time.
   *
   * This function computes the average duration of successful preload operations.
   * It first filters the completed preload states to include only those that were successful
   * and have a defined duration. If no successful preloads are found, it returns 0.
   * Otherwise, it sums the durations of the successful preloads and divides by their count
   * to obtain the average.
   */
  calculateAveragePreloadTime () {
    const completed = Array.from(PRELOAD_STATE.completed.values())
      .filter(c => c.success && c.duration)

    if (completed.length === 0) return 0

    const totalTime = completed.reduce((sum, c) => sum + (c.duration || 0), 0)
    return totalTime / completed.length
  }
}

// Initialize the cache preloader
const cachePreloader = new CachePreloader()

// Export for external access
self.CachePreloader = CachePreloader
self.PRELOADER_CONFIG = PRELOADER_CONFIG
self.RESOURCE_DEFINITIONS = RESOURCE_DEFINITIONS

console.log('[CachePreloader] Cache preloader initialized successfully')
