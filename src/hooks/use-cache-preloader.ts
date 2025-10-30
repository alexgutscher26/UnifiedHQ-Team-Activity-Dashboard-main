/**
 * React hook for cache preloading functionality
 */

import { useEffect, useState, useCallback } from 'react';
import {
  preloadManager,
  type PreloadStats,
} from '@/lib/service-worker/preload-manager';

export interface CachePreloaderState {
  isInitialized: boolean;
  stats: PreloadStats | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Manages the cache preloading process and provides various utilities for data preloading.
 *
 * This function initializes the cache preloader, retrieves preload statistics, preloads critical data,
 * clears navigation patterns, fetches navigation recommendations, tracks navigation, and triggers
 * server-side or time-based preloading. It maintains the loading state and error handling throughout
 * these operations, ensuring a smooth user experience.
 *
 * @returns An object containing the current state and methods for managing the cache preloader.
 */
export function useCachePreloader() {
  const [state, setState] = useState<CachePreloaderState>({
    isInitialized: false,
    stats: null,
    isLoading: false,
    error: null,
  });

  /**
   * Initialize the cache preloader
   */
  const initialize = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      await preloadManager.initialize();

      setState(prev => ({
        ...prev,
        isInitialized: true,
        isLoading: false,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to initialize cache preloader',
        isLoading: false,
      }));
    }
  }, []);

  /**
   * Get current preload statistics
   */
  const getStats = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const stats = await preloadManager.getPreloadStats();

      setState(prev => ({
        ...prev,
        stats,
        isLoading: false,
      }));

      return stats;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get preload stats',
        isLoading: false,
      }));
      return null;
    }
  }, []);

  /**
   * Preload critical data manually
   */
  const preloadCriticalData = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      await preloadManager.preloadCriticalData();

      setState(prev => ({ ...prev, isLoading: false }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to preload critical data',
        isLoading: false,
      }));
    }
  }, []);

  /**
   * Clear navigation patterns
   */
  const clearPatterns = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const success = await preloadManager.clearNavigationPatterns();

      if (success) {
        // Refresh stats after clearing
        await getStats();
      }

      setState(prev => ({ ...prev, isLoading: false }));

      return success;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error:
          error instanceof Error ? error.message : 'Failed to clear patterns',
        isLoading: false,
      }));
      return false;
    }
  }, [getStats]);

  /**
   * Get navigation recommendations
   */
  const getRecommendations = useCallback(async () => {
    try {
      return await preloadManager.getNavigationRecommendations();
    } catch (error) {
      console.error('Failed to get navigation recommendations:', error);
      return [];
    }
  }, []);

  /**
   * Track navigation manually
   */
  const trackNavigation = useCallback(async (path: string) => {
    try {
      await preloadManager.trackNavigation(path);
    } catch (error) {
      console.error('Failed to track navigation:', error);
    }
  }, []);

  /**
   * Trigger smart preloading
   */
  const smartPreload = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      await preloadManager.smartPreload();

      setState(prev => ({ ...prev, isLoading: false }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Smart preload failed',
        isLoading: false,
      }));
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Refresh stats periodically
  useEffect(() => {
    if (!state.isInitialized) return;

    const interval = setInterval(() => {
      getStats();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [state.isInitialized, getStats]);

  /**
   * Trigger server-side preloading
   */
  const triggerServerPreload = useCallback(async (userId: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      await preloadManager.triggerServerSidePreload(userId);

      setState(prev => ({ ...prev, isLoading: false }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Server preload failed',
        isLoading: false,
      }));
    }
  }, []);

  /**
   * Trigger time-based server preloading
   */
  const triggerTimeBasedServerPreload = useCallback(async (userId: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      await preloadManager.triggerTimeBasedServerPreload(userId);

      setState(prev => ({ ...prev, isLoading: false }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error:
          error instanceof Error
            ? error.message
            : 'Time-based server preload failed',
        isLoading: false,
      }));
    }
  }, []);

  return {
    ...state,
    initialize,
    getStats,
    preloadCriticalData,
    clearPatterns,
    getRecommendations,
    trackNavigation,
    smartPreload,
    triggerServerPreload,
    triggerTimeBasedServerPreload,
  };
}

/**
 * Hook for tracking navigation in components
 */
export function useNavigationTracking() {
  const trackNavigation = useCallback(async (path: string) => {
    try {
      await preloadManager.trackNavigation(path);
    } catch (error) {
      console.error('Failed to track navigation:', error);
    }
  }, []);

  return { trackNavigation };
}

/**
 * Hook for managing preload recommendations and loading state.
 */
export function usePreloadRecommendations() {
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refreshRecommendations = useCallback(async () => {
    try {
      setIsLoading(true);
      const recs = await preloadManager.getNavigationRecommendations();
      setRecommendations(recs);
    } catch (error) {
      console.error('Failed to get recommendations:', error);
      setRecommendations([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshRecommendations();

    // Refresh recommendations every 2 minutes
    const interval = setInterval(refreshRecommendations, 120000);

    return () => clearInterval(interval);
  }, [refreshRecommendations]);

  return {
    recommendations,
    isLoading,
    refreshRecommendations,
  };
}
