'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  serviceWorkerManager,
  type ServiceWorkerState,
  type ServiceWorkerCallbacks,
} from '@/lib/service-worker/registration';

export interface UseServiceWorkerOptions {
  autoRegister?: boolean;
  onUpdateAvailable?: (registration: ServiceWorkerRegistration) => void;
  onUpdateReady?: () => void;
  onError?: (error: Error) => void;
}

export interface UseServiceWorkerReturn extends ServiceWorkerState {
  register: () => Promise<void>;
  unregister: () => Promise<void>;
  update: () => Promise<void>;
  skipWaiting: () => Promise<void>;
  clearCache: (cacheName?: string) => Promise<void>;
  getVersion: () => Promise<string | null>;
  isLoading: boolean;
  error: Error | null;
}

export function useServiceWorker(
  options: UseServiceWorkerOptions = {}
): UseServiceWorkerReturn {
  const {
    autoRegister = true,
    onUpdateAvailable,
    onUpdateReady,
    onError,
  } = options;

  const [state, setState] = useState<ServiceWorkerState>(() =>
    serviceWorkerManager.getState()
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Update state when service worker state changes
  const updateState = useCallback(() => {
    setState(serviceWorkerManager.getState());
  }, []);

  // Register service worker
  const register = useCallback(async () => {
    if (!state.isSupported) {
      const error = new Error('Service Worker is not supported');
      setError(error);
      onError?.(error);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const callbacks: ServiceWorkerCallbacks = {
        onInstalling: () => {
          console.log('[useServiceWorker] Service worker installing...');
          updateState();
        },
        onWaiting: () => {
          console.log('[useServiceWorker] Service worker waiting...');
          updateState();
        },
        onActive: () => {
          console.log('[useServiceWorker] Service worker active');
          updateState();
          onUpdateReady?.();
        },
        onUpdateAvailable: registration => {
          console.log('[useServiceWorker] Service worker update available');
          updateState();
          onUpdateAvailable?.(registration);
        },
        onUpdateReady: () => {
          console.log('[useServiceWorker] Service worker update ready');
          updateState();
          onUpdateReady?.();
        },
        onError: error => {
          console.error('[useServiceWorker] Service worker error:', error);
          setError(error);
          onError?.(error);
        },
      };

      await serviceWorkerManager.register(callbacks);
      updateState();
    } catch (error) {
      const swError = error as Error;
      setError(swError);
      onError?.(swError);
    } finally {
      setIsLoading(false);
    }
  }, [
    state.isSupported,
    updateState,
    onUpdateAvailable,
    onUpdateReady,
    onError,
  ]);

  // Unregister service worker
  const unregister = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await serviceWorkerManager.unregister();
      updateState();
    } catch (error) {
      const swError = error as Error;
      setError(swError);
      onError?.(swError);
    } finally {
      setIsLoading(false);
    }
  }, [updateState, onError]);

  // Update service worker
  const update = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await serviceWorkerManager.update();
      updateState();
    } catch (error) {
      const swError = error as Error;
      setError(swError);
      onError?.(swError);
    } finally {
      setIsLoading(false);
    }
  }, [updateState, onError]);

  // Skip waiting and activate new service worker
  const skipWaiting = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await serviceWorkerManager.skipWaiting();
      updateState();
    } catch (error) {
      const swError = error as Error;
      setError(swError);
      onError?.(swError);
    } finally {
      setIsLoading(false);
    }
  }, [updateState, onError]);

  // Clear service worker cache
  const clearCache = useCallback(
    async (cacheName?: string) => {
      setIsLoading(true);
      setError(null);

      try {
        await serviceWorkerManager.clearCache(cacheName);
      } catch (error) {
        const swError = error as Error;
        setError(swError);
        onError?.(swError);
      } finally {
        setIsLoading(false);
      }
    },
    [onError]
  );

  // Get service worker version
  const getVersion = useCallback(async () => {
    try {
      return await serviceWorkerManager.getVersion();
    } catch (error) {
      const swError = error as Error;
      setError(swError);
      onError?.(swError);
      return null;
    }
  }, [onError]);

  // Auto-register on mount
  useEffect(() => {
    if (
      autoRegister &&
      state.isSupported &&
      !state.isRegistered &&
      !isLoading
    ) {
      register();
    }
  }, [
    autoRegister,
    state.isSupported,
    state.isRegistered,
    isLoading,
    register,
  ]);

  // Set up periodic update checks
  useEffect(() => {
    if (!state.isRegistered) return;

    const checkForUpdates = () => {
      if (!isLoading) {
        update().catch(console.error);
      }
    };

    // Check for updates every 30 minutes
    const interval = setInterval(checkForUpdates, 30 * 60 * 1000);

    // Check for updates when the page becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdates();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [state.isRegistered, isLoading, update]);

  return {
    ...state,
    register,
    unregister,
    update,
    skipWaiting,
    clearCache,
    getVersion,
    isLoading,
    error,
  };
}
