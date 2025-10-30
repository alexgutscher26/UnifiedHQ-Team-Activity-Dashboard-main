/**
 * Intelligent cache preloading system for service worker
 * Implements predictive caching based on user navigation patterns
 */

export interface NavigationPattern {
  path: string;
  frequency: number;
  lastAccessed: number;
  timeOfDay: number[];
  dayOfWeek: number[];
  nextPaths: { [path: string]: number };
}

export interface PreloadConfig {
  maxPatterns: number;
  minFrequency: number;
  preloadThreshold: number;
  idleTimeout: number;
  criticalPaths: string[];
}

export class CachePreloader {
  private patterns: Map<string, NavigationPattern> = new Map();
  private config: PreloadConfig;
  private isIdle = false;
  private idleTimer: number | null = null;

  constructor(config: Partial<PreloadConfig> = {}) {
    this.config = {
      maxPatterns: 100,
      minFrequency: 3,
      preloadThreshold: 0.7,
      idleTimeout: 5000, // 5 seconds
      criticalPaths: [
        '/',
        '/dashboard',
        '/api/github/activity',
        '/api/slack/messages',
        '/api/ai/summary',
      ],
      ...config,
    };

    this.loadPatterns();
    this.setupIdleDetection();
  }

  /**
   * Track user navigation to build patterns
   */
  trackNavigation(path: string): void {
    const now = Date.now();
    const hour = new Date().getHours();
    const dayOfWeek = new Date().getDay();

    let pattern = this.patterns.get(path);

    if (!pattern) {
      pattern = {
        path,
        frequency: 0,
        lastAccessed: now,
        timeOfDay: [],
        dayOfWeek: [],
        nextPaths: {},
      };
      this.patterns.set(path, pattern);
    }

    // Update pattern data
    pattern.frequency++;
    pattern.lastAccessed = now;

    // Track time patterns
    if (!pattern.timeOfDay.includes(hour)) {
      pattern.timeOfDay.push(hour);
    }

    if (!pattern.dayOfWeek.includes(dayOfWeek)) {
      pattern.dayOfWeek.push(dayOfWeek);
    }

    // Update next path predictions based on previous navigation
    this.updateNextPathPredictions(path);

    // Cleanup old patterns if we exceed max
    this.cleanupPatterns();

    // Save patterns to storage
    this.savePatterns();

    // Trigger predictive preloading
    this.triggerPredictivePreload(path);
  }

  /**
   * Update predictions for what paths come after current path
   */
  private updateNextPathPredictions(currentPath: string): void {
    // Get the last accessed path to create a transition
    const lastPath = this.getLastAccessedPath();

    if (lastPath && lastPath !== currentPath) {
      const lastPattern = this.patterns.get(lastPath);
      if (lastPattern) {
        if (!lastPattern.nextPaths[currentPath]) {
          lastPattern.nextPaths[currentPath] = 0;
        }
        lastPattern.nextPaths[currentPath]++;
      }
    }
  }

  /**
   * Get the most recently accessed path (excluding current)
   */
  private getLastAccessedPath(): string | null {
    let lastPath = null;
    let lastTime = 0;

    for (const [path, pattern] of this.patterns) {
      if (pattern.lastAccessed > lastTime) {
        lastTime = pattern.lastAccessed;
        lastPath = path;
      }
    }

    return lastPath;
  }

  /**
   * Trigger predictive preloading based on current path
   */
  private async triggerPredictivePreload(currentPath: string): Promise<void> {
    const pattern = this.patterns.get(currentPath);
    if (!pattern) return;

    // Get predicted next paths
    const predictions = this.getPredictedPaths(currentPath);

    // Preload high-probability paths
    for (const { path, probability } of predictions) {
      if (probability >= this.config.preloadThreshold) {
        await this.preloadPath(path);
      }
    }
  }

  /**
   * Get predicted next paths with probabilities
   */
  getPredictedPaths(
    currentPath: string
  ): Array<{ path: string; probability: number }> {
    const pattern = this.patterns.get(currentPath);
    if (!pattern) return [];

    const predictions: Array<{ path: string; probability: number }> = [];
    const totalTransitions = Object.values(pattern.nextPaths).reduce(
      (sum, count) => sum + count,
      0
    );

    if (totalTransitions === 0) return [];

    // Calculate probabilities for each next path
    for (const [nextPath, count] of Object.entries(pattern.nextPaths)) {
      const probability = count / totalTransitions;
      predictions.push({ path: nextPath, probability });
    }

    // Sort by probability (highest first)
    return predictions.sort((a, b) => b.probability - a.probability);
  }

  /**
   * Preload a specific path
   */
  private async preloadPath(path: string): Promise<void> {
    try {
      console.log(`[Cache Preloader] Preloading path: ${path}`);

      // Check if already cached
      const cache = await caches.open('unifiedhq-dynamic-v1');
      const cached = await cache.match(path);

      if (cached) {
        console.log(`[Cache Preloader] Path already cached: ${path}`);
        return;
      }

      // Fetch and cache the path
      const response = await fetch(path);
      if (response.ok) {
        await cache.put(path, response.clone());
        console.log(`[Cache Preloader] Successfully preloaded: ${path}`);
      }
    } catch (error) {
      console.error(`[Cache Preloader] Failed to preload ${path}:`, error);
    }
  }

  /**
   * Preload critical dashboard data
   */
  async preloadCriticalData(): Promise<void> {
    console.log('[Cache Preloader] Starting critical data preload');

    const criticalEndpoints = [
      '/api/github/activity',
      '/api/slack/messages/recent',
      '/api/ai/summary/today',
      '/api/dashboard/stats',
    ];

    // Preload in parallel but with delay to avoid overwhelming the server
    for (let i = 0; i < criticalEndpoints.length; i++) {
      setTimeout(async () => {
        await this.preloadPath(criticalEndpoints[i]);
      }, i * 500); // 500ms delay between requests
    }
  }

  /**
   * Setup idle detection for background preloading
   */
  private setupIdleDetection(): void {
    // Reset idle timer on any activity
    const resetIdleTimer = () => {
      this.isIdle = false;

      if (this.idleTimer) {
        clearTimeout(this.idleTimer);
      }

      this.idleTimer = setTimeout(() => {
        this.isIdle = true;
        this.performIdlePreloading();
      }, this.config.idleTimeout) as unknown as number;
    };

    // Listen for user activity events
    if (typeof self !== 'undefined' && self.addEventListener) {
      // In service worker context
      self.addEventListener('message', resetIdleTimer);
    }
  }

  /**
   * Perform background preloading during idle time
   */
  private async performIdlePreloading(): Promise<void> {
    if (!this.isIdle) return;

    console.log('[Cache Preloader] Starting idle preloading');

    // Get frequently accessed paths that aren't cached
    const frequentPaths = Array.from(this.patterns.values())
      .filter(pattern => pattern.frequency >= this.config.minFrequency)
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10); // Limit to top 10

    for (const pattern of frequentPaths) {
      if (!this.isIdle) break; // Stop if user becomes active

      await this.preloadPath(pattern.path);

      // Small delay between preloads
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Preload critical paths during idle time
    for (const path of this.config.criticalPaths) {
      if (!this.isIdle) break;

      await this.preloadPath(path);
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log('[Cache Preloader] Idle preloading completed');
  }

  /**
   * Get current time-based recommendations
   */
  getTimeBasedRecommendations(): string[] {
    const currentHour = new Date().getHours();
    const currentDay = new Date().getDay();

    const recommendations: string[] = [];

    for (const [path, pattern] of this.patterns) {
      // Check if this path is typically accessed at this time
      const isTimeMatch = pattern.timeOfDay.includes(currentHour);
      const isDayMatch = pattern.dayOfWeek.includes(currentDay);

      if (
        isTimeMatch &&
        isDayMatch &&
        pattern.frequency >= this.config.minFrequency
      ) {
        recommendations.push(path);
      }
    }

    return recommendations.sort((a, b) => {
      const patternA = this.patterns.get(a)!;
      const patternB = this.patterns.get(b)!;
      return patternB.frequency - patternA.frequency;
    });
  }

  /**
   * Cleanup old or infrequent patterns
   */
  private cleanupPatterns(): void {
    if (this.patterns.size <= this.config.maxPatterns) return;

    // Convert to array and sort by frequency and recency
    const patternArray = Array.from(this.patterns.entries()).map(
      ([path, pattern]) => ({
        path,
        pattern,
        score:
          pattern.frequency +
          (Date.now() - pattern.lastAccessed) / (1000 * 60 * 60 * 24), // Boost recent access
      })
    );

    // Sort by score (higher is better)
    patternArray.sort((a, b) => b.score - a.score);

    // Keep only the top patterns
    const toKeep = patternArray.slice(0, this.config.maxPatterns);

    this.patterns.clear();
    toKeep.forEach(({ path, pattern }) => {
      this.patterns.set(path, pattern);
    });
  }

  /**
   * Save patterns to IndexedDB
   */
  private async savePatterns(): Promise<void> {
    try {
      if (typeof indexedDB === 'undefined') return;

      const db = await this.openDB();
      const transaction = db.transaction(['patterns'], 'readwrite');
      const store = transaction.objectStore('patterns');

      const patternsData = {
        id: 'navigation-patterns',
        patterns: Array.from(this.patterns.entries()),
        lastUpdated: Date.now(),
      };

      await store.put(patternsData);
    } catch (error) {
      console.error('[Cache Preloader] Failed to save patterns:', error);
    }
  }

  /**
   * Load patterns from IndexedDB
   */
  private async loadPatterns(): Promise<void> {
    try {
      if (typeof indexedDB === 'undefined') return;

      const db = await this.openDB();
      const transaction = db.transaction(['patterns'], 'readonly');
      const store = transaction.objectStore('patterns');

      const result = await store.get('navigation-patterns');

      if (result?.patterns) {
        this.patterns = new Map(result.patterns);
        console.log(
          `[Cache Preloader] Loaded ${this.patterns.size} navigation patterns`
        );
      }
    } catch (error) {
      console.error('[Cache Preloader] Failed to load patterns:', error);
    }
  }

  /**
   * Open IndexedDB for pattern storage
   */
  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('unifiedhq-cache-preloader', 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = event => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('patterns')) {
          db.createObjectStore('patterns', { keyPath: 'id' });
        }
      };
    });
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalPatterns: number;
    frequentPaths: string[];
    predictions: Array<{ path: string; probability: number }>;
    timeBasedRecommendations: string[];
  }> {
    const frequentPaths = Array.from(this.patterns.values())
      .filter(pattern => pattern.frequency >= this.config.minFrequency)
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5)
      .map(pattern => pattern.path);

    const lastPath = this.getLastAccessedPath();
    const predictions = lastPath ? this.getPredictedPaths(lastPath) : [];

    return {
      totalPatterns: this.patterns.size,
      frequentPaths,
      predictions: predictions.slice(0, 5),
      timeBasedRecommendations: this.getTimeBasedRecommendations().slice(0, 5),
    };
  }

  /**
   * Clear all patterns (for testing or reset)
   */
  async clearPatterns(): Promise<void> {
    this.patterns.clear();
    await this.savePatterns();
  }
}
