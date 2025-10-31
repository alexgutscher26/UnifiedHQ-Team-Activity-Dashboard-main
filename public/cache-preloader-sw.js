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
   * Track navigation and trigger appropriate preloading
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
   * Enhanced navigation tracking with pattern analysis
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
   * Get resource definition for a path
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
   * Schedule resources for preloading
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
   * Execute immediate preloading
   */
  async executePreload () {
    const batch = this.getNextBatch()
    const promises = batch.map(item => this.preloadResource(item))

    await Promise.allSettled(promises)
  }

  /**
   * Execute predictive preloading based on confidence
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
   * Execute critical resource preloading
   */
  async executeCriticalPreload () {
    const criticalItems = Array.from(PRELOAD_STATE.queue.values())
      .filter(item => item.priority === PRELOADER_CONFIG.priorities.critical)

    const promises = criticalItems.map(item => this.preloadResource(item))
    await Promise.allSettled(promises)
  }

  /**
   * Get next batch of resources to preload
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
   * Predictive preloading based on navigation patterns
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
   * Calculate confidence for path transition
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
   * Calculate preload confidence for a resource
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
   * Initialize idle detection for idle preloading
   */
  initializeIdleDetection () {
    // Use requestIdleCallback if available
    if (typeof requestIdleCallback !== 'undefined') {
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
   * Schedule preloading during idle time
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
   * Bind to existing navigation tracking system
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
   * Enhanced critical data preloading
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
   * Enhanced cache statistics
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
   * Enhanced pattern clearing
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
   * Get preloader-specific statistics
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
   * Force preload specific resources
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
   * Calculate success rate
   */
  calculateSuccessRate () {
    const completed = Array.from(PRELOAD_STATE.completed.values())
    if (completed.length === 0) return 0

    const successful = completed.filter(c => c.success).length
    return successful / completed.length
  }

  /**
   * Calculate average preload time
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
