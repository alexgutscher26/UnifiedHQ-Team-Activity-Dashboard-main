/**
 * Client-side cache preload manager
 * Interfaces with service worker cache preloader
 */

export interface PreloadStats {
  totalPatterns: number;
  frequentPaths: string[];
  predictions: Array<{ path: string; probability: number }>;
  timeBasedRecommendations: string[];
}

export class PreloadManager {
  private serviceWorker: ServiceWorker | null = null;

  constructor() {
    this.initializeServiceWorker();
  }

  /**
   * Initialize service worker connection
   */
  private async initializeServiceWorker(): Promise<void> {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        this.serviceWorker = registration.active;

        // Listen for navigation changes to track patterns
        this.setupNavigationTracking();

        console.log('[Preload Manager] Service worker connection established');
      } catch (error) {
        console.error(
          '[Preload Manager] Failed to initialize service worker:',
          error
        );
      }
    }
  }

  /**
   * Setup automatic navigation tracking
   */
  private setupNavigationTracking(): void {
    // Track initial page load
    this.trackNavigation(window.location.pathname);

    // Track navigation changes (for SPA routing)
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
      originalPushState.apply(history, args);
      // Track the new path
      setTimeout(() => {
        preloadManager.trackNavigation(window.location.pathname);
      }, 0);
    };

    history.replaceState = function (...args) {
      originalReplaceState.apply(history, args);
      // Track the new path
      setTimeout(() => {
        preloadManager.trackNavigation(window.location.pathname);
      }, 0);
    };

    // Track popstate events (back/forward navigation)
    window.addEventListener('popstate', () => {
      setTimeout(() => {
        this.trackNavigation(window.location.pathname);
      }, 0);
    });

    // Track hash changes
    window.addEventListener('hashchange', () => {
      this.trackNavigation(window.location.pathname + window.location.hash);
    });
  }

  /**
   * Track navigation to a specific path
   */
  async trackNavigation(path: string): Promise<void> {
    if (!this.serviceWorker) {
      await this.initializeServiceWorker();
    }

    try {
      await this.sendMessage('TRACK_NAVIGATION', { path });
    } catch (error) {
      console.error('[Preload Manager] Failed to track navigation:', error);
    }
  }

  /**
   * Trigger critical data preloading
   */
  async preloadCriticalData(): Promise<void> {
    try {
      const result = await this.sendMessage('PRELOAD_CRITICAL_DATA');
      if (result.success) {
        console.log('[Preload Manager] Critical data preloading initiated');
      } else {
        console.error(
          '[Preload Manager] Critical data preloading failed:',
          result.error
        );
      }
    } catch (error) {
      console.error(
        '[Preload Manager] Failed to preload critical data:',
        error
      );
    }
  }

  /**
   * Get cache preloader statistics
   */
  async getPreloadStats(): Promise<PreloadStats | null> {
    try {
      const result = await this.sendMessage('GET_PRELOAD_STATS');
      if (result.success) {
        return result.stats;
      } else {
        console.error(
          '[Preload Manager] Failed to get preload stats:',
          result.error
        );
        return null;
      }
    } catch (error) {
      console.error('[Preload Manager] Failed to get preload stats:', error);
      return null;
    }
  }

  /**
   * Clear navigation patterns (for testing or reset)
   */
  async clearNavigationPatterns(): Promise<boolean> {
    try {
      const result = await this.sendMessage('CLEAR_NAVIGATION_PATTERNS');
      if (result.success) {
        console.log('[Preload Manager] Navigation patterns cleared');
        return true;
      } else {
        console.error(
          '[Preload Manager] Failed to clear patterns:',
          result.error
        );
        return false;
      }
    } catch (error) {
      console.error('[Preload Manager] Failed to clear patterns:', error);
      return false;
    }
  }

  /**
   * Send message to service worker
   */
  private sendMessage(type: string, payload?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.serviceWorker) {
        reject(new Error('Service worker not available'));
        return;
      }

      const messageChannel = new MessageChannel();

      messageChannel.port1.onmessage = event => {
        resolve(event.data);
      };

      this.serviceWorker.postMessage({ type, payload }, [messageChannel.port2]);

      // Timeout after 10 seconds
      setTimeout(() => {
        reject(new Error('Service worker message timeout'));
      }, 10000);
    });
  }

  /**
   * Preload specific paths manually
   */
  async preloadPaths(paths: string[]): Promise<void> {
    for (const path of paths) {
      await this.trackNavigation(path);
      // Small delay between tracking calls
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Get navigation recommendations based on current context
   */
  async getNavigationRecommendations(): Promise<string[]> {
    try {
      const stats = await this.getPreloadStats();
      if (!stats) return [];

      // Combine predictions and time-based recommendations
      const recommendations = [
        ...stats.predictions.map(p => p.path),
        ...stats.timeBasedRecommendations,
      ];

      // Remove duplicates and return top 5
      return [...new Set(recommendations)].slice(0, 5);
    } catch (error) {
      console.error('[Preload Manager] Failed to get recommendations:', error);
      return [];
    }
  }

  /**
   * Setup idle detection for triggering background preloading
   */
  setupIdlePreloading(idleTimeout: number = 5000): void {
    let idleTimer: number | null = null;

    const resetIdleTimer = () => {
      if (idleTimer) {
        clearTimeout(idleTimer);
      }

      idleTimer = setTimeout(async () => {
        // Trigger background preloading during idle time
        await this.preloadCriticalData();

        // Get and preload recommendations
        const recommendations = await this.getNavigationRecommendations();
        if (recommendations.length > 0) {
          await this.preloadPaths(recommendations);
        }
      }, idleTimeout) as unknown as number;
    };

    // Reset timer on user activity
    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
    ];
    events.forEach(event => {
      document.addEventListener(event, resetIdleTimer, { passive: true });
    });

    // Initial timer setup
    resetIdleTimer();
  }

  /**
   * Preload based on user behavior patterns
   */
  async smartPreload(): Promise<void> {
    try {
      const stats = await this.getPreloadStats();
      if (!stats) return;

      // Preload high-probability next paths
      const highProbabilityPaths = stats.predictions
        .filter(p => p.probability > 0.7)
        .map(p => p.path);

      if (highProbabilityPaths.length > 0) {
        console.log(
          '[Preload Manager] Preloading high-probability paths:',
          highProbabilityPaths
        );
        await this.preloadPaths(highProbabilityPaths);
      }

      // Preload time-based recommendations
      if (stats.timeBasedRecommendations.length > 0) {
        console.log(
          '[Preload Manager] Preloading time-based recommendations:',
          stats.timeBasedRecommendations
        );
        await this.preloadPaths(stats.timeBasedRecommendations.slice(0, 3));
      }
    } catch (error) {
      console.error('[Preload Manager] Smart preload failed:', error);
    }
  }

  /**
   * Trigger server-side cache warming based on patterns
   */
  async triggerServerSidePreload(userId: string): Promise<void> {
    try {
      const stats = await this.getPreloadStats();
      if (!stats) return;

      // Convert patterns to format expected by server
      const navigationPatterns = stats.frequentPaths.map(path => ({
        path,
        frequency: 1, // We don't have exact frequency from stats
      }));

      // Trigger intelligent preloading on server
      const response = await fetch('/api/cache/preload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          action: 'intelligent',
          navigationPatterns,
        }),
      });

      if (response.ok) {
        console.log(
          '[Preload Manager] Server-side preloading triggered successfully'
        );
      } else {
        console.error(
          '[Preload Manager] Server-side preloading failed:',
          await response.text()
        );
      }
    } catch (error) {
      console.error(
        '[Preload Manager] Failed to trigger server-side preload:',
        error
      );
    }
  }

  /**
   * Trigger time-based server-side preloading
   */
  async triggerTimeBasedServerPreload(userId: string): Promise<void> {
    try {
      const stats = await this.getPreloadStats();
      if (!stats || !stats.timeBasedRecommendations.length) return;

      const response = await fetch('/api/cache/preload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          action: 'time-based',
          timeBasedPaths: stats.timeBasedRecommendations,
        }),
      });

      if (response.ok) {
        console.log(
          '[Preload Manager] Time-based server preloading triggered successfully'
        );
      } else {
        console.error(
          '[Preload Manager] Time-based server preloading failed:',
          await response.text()
        );
      }
    } catch (error) {
      console.error(
        '[Preload Manager] Failed to trigger time-based server preload:',
        error
      );
    }
  }

  /**
   * Initialize automatic preloading features
   */
  async initialize(): Promise<void> {
    // Wait for service worker to be ready
    await this.initializeServiceWorker();

    // Setup idle preloading
    this.setupIdlePreloading();

    // Preload critical data on initialization
    await this.preloadCriticalData();

    // Setup smart preloading
    setTimeout(() => {
      this.smartPreload();
    }, 2000); // Delay to avoid interfering with initial page load

    console.log('[Preload Manager] Initialization complete');
  }
}

// Create global instance
export const preloadManager = new PreloadManager();
