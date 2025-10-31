/**
 * @fileoverview React hook for managing service worker lifecycle and operations.
 *
 * This module provides a comprehensive React hook for service worker management,
 * including registration, updates, cache management, and lifecycle event handling.
 * It supports automatic registration, periodic update checks, and graceful degradation
 * when service workers are disabled or unsupported.
 *
 * @author UnifiedHQ Team
 * @version 1.0.0
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  serviceWorkerManager,
  type ServiceWorkerState,
  type ServiceWorkerCallbacks,
} from '@/lib/service-worker/registration';

/**
 * Configuration options for the useServiceWorker hook.
 *
 * @interface UseServiceWorkerOptions
 */
export interface UseServiceWorkerOptions {
  /** Whether to automatically register the service worker on mount. Defaults to true. */
  autoRegister?: boolean;
  /** Callback invoked when a service worker update is available but not yet activated. */
  onUpdateAvailable?: (registration: ServiceWorkerRegistration) => void;
  /** Callback invoked when a service worker update is ready to be activated. */
  onUpdateReady?: () => void;
  /** Callback invoked when an error occurs during service worker operations. */
  onError?: (error: Error) => void;
}

/**
 * Return type for the useServiceWorker hook, extending ServiceWorkerState with additional methods and properties.
 *
 * @interface UseServiceWorkerReturn
 * @extends ServiceWorkerState
 */
export interface UseServiceWorkerReturn extends ServiceWorkerState {
  /** Manually register the service worker. */
  register: () => Promise<void>;
  /** Unregister the service worker and clean up resources. */
  unregister: () => Promise<void>;
  /** Check for and install service worker updates. */
  update: () => Promise<void>;
  /** Skip waiting phase and immediately activate a new service worker. */
  skipWaiting: () => Promise<void>;
  /** Clear service worker cache. If cacheName is provided, only that cache is cleared. */
  clearCache: (cacheName?: string) => Promise<void>;
  /** Get the current version of the service worker. Returns null if unavailable. */
  getVersion: () => Promise<string | null>;
  /** Whether any service worker operation is currently in progress. */
  isLoading: boolean;
  /** The last error that occurred during service worker operations, if any. */
  error: Error | null;
}

/**
 * Manage the lifecycle and updates of a service worker.
 *
 * This function handles the registration, unregistration, updating, and cache management of a service worker. It also sets up automatic registration and periodic update checks based on the service worker's state. Callbacks for various service worker events can be provided through the options parameter to handle updates and errors effectively.
 *
 * @param options - Configuration options for the service worker management.
 * @param options.autoRegister - Indicates whether to automatically register the service worker (default is true).
 * @param options.onUpdateAvailable - Callback invoked when an update is available.
 * @param options.onUpdateReady - Callback invoked when the service worker is ready to be activated.
 * @param options.onError - Callback invoked when an error occurs during service worker operations.
 * @returns An object containing the current state of the service worker and methods to manage it.
 */
export function useServiceWorker(
  options: UseServiceWorkerOptions = {}
): UseServiceWorkerReturn {
  // Destructure options at the top of function scope
  const {
    autoRegister = true,
    onUpdateAvailable,
    onUpdateReady,
    onError,
  } = options;

  // Check if service worker should be disabled - declare at top of function scope
  const isDisabled =
    process.env.NEXT_PUBLIC_DISABLE_SW === 'true' ||
    process.env.NEXT_PUBLIC_DISABLE_SW === true ||
    !('serviceWorker' in navigator);

  // Define disabled state object at top level for better hoisting clarity
  const disabledState: ServiceWorkerState = {
    isSupported: false,
    isRegistered: false,
    isInstalling: false,
    isWaiting: false,
    isActive: false,
    hasUpdate: false,
    registration: null,
  };

  // Early return for disabled service worker with consistent API
  if (isDisabled) {
    /**
     * Return a completely disabled service worker implementation immediately.
     * This provides a consistent API even when service workers are disabled,
     * preventing runtime errors and maintaining type safety.
     */
    return {
      ...disabledState,
      // Interface compliance: these methods must return Promises to match UseServiceWorkerReturn type
      register: () => Promise.resolve(),
      unregister: () => Promise.resolve(),
      update: () => Promise.resolve(),
      skipWaiting: () => Promise.resolve(),
      clearCache: () => Promise.resolve(),
      getVersion: () => Promise.resolve(null),
      isLoading: false,
      error: null,
    };
  }

  // State declarations - all at top of main execution path
  const [state, setState] = useState<ServiceWorkerState>(() =>
    serviceWorkerManager.getState()
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasAttemptedRegistration, setHasAttemptedRegistration] =
    useState(false);

  /**
   * Updates the local state with the current service worker state from the manager.
   * Skips update if service worker is disabled.
   */
  const updateState = useCallback(() => {
    if (isDisabled) return;
    setState(serviceWorkerManager.getState());
  }, [isDisabled]);

  /**
   * Registers the service worker with appropriate callbacks for lifecycle events.
   * Handles errors and loading states, and skips registration if service worker is disabled or unsupported.
   *
   * @throws {Error} When service worker is not supported
   */
  const register = useCallback(async () => {
    // Declare variables at top of function scope for better hoisting clarity
    let error: Error;

    if (isDisabled) {
      console.log(
        '[useServiceWorker] Service worker disabled, skipping registration'
      );
      return;
    }

    if (!state.isSupported) {
      error = new Error('Service Worker is not supported');
      setError(error);
      onError?.(error);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      /**
       * Service worker lifecycle callbacks that handle state updates and user notifications.
       * Each callback updates the local state and forwards events to user-provided handlers.
       */
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

      // ✅ FIXED: Use wrapper function to preserve class scope
      await serviceWorkerManager.register(callbacks);
      updateState();
    } catch (err) {
      const swError = err as Error;
      setError(swError);
      onError?.(swError);
    } finally {
      setIsLoading(false);
    }
  }, [
    isDisabled,
    state.isSupported,
    updateState,
    onUpdateAvailable,
    onUpdateReady,
    onError,
  ]);

  /**
   * Unregisters the service worker and updates the local state.
   * Handles errors and loading states during the unregistration process.
   */
  const unregister = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // ✅ FIXED: Use wrapper function to preserve class scope
      await serviceWorkerManager.unregister();
      updateState();
    } catch (err) {
      const swError = err as Error;
      setError(swError);
      onError?.(swError);
    } finally {
      setIsLoading(false);
    }
  }, [updateState, onError]);

  /**
   * Checks for and installs service worker updates.
   * This will trigger the update process if a new version is available.
   */
  const update = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // ✅ FIXED: Use wrapper function to preserve class scope
      await serviceWorkerManager.update();
      updateState();
    } catch (err) {
      const swError = err as Error;
      setError(swError);
      onError?.(swError);
    } finally {
      setIsLoading(false);
    }
  }, [updateState, onError]);

  /**
   * Skips the waiting phase and immediately activates a new service worker.
   * This is typically called when the user chooses to apply an update immediately.
   */
  const skipWaiting = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // ✅ FIXED: Use wrapper function to preserve class scope
      await serviceWorkerManager.skipWaiting();
      updateState();
    } catch (err) {
      const swError = err as Error;
      setError(swError);
      onError?.(swError);
    } finally {
      setIsLoading(false);
    }
  }, [updateState, onError]);

  /**
   * Clears service worker cache storage.
   *
   * @param cacheName - Optional specific cache name to clear. If not provided, all caches are cleared.
   */
  const clearCache = useCallback(
    async (cacheName?: string) => {
      setIsLoading(true);
      setError(null);

      try {
        // ✅ FIXED: Use wrapper function to preserve class scope
        await serviceWorkerManager.clearCache(cacheName);
      } catch (err) {
        const swError = err as Error;
        setError(swError);
        onError?.(swError);
      } finally {
        setIsLoading(false);
      }
    },
    [onError]
  );

  /**
   * Retrieves the current version of the service worker.
   *
   * @returns Promise that resolves to the version string, or null if unavailable
   */
  const getVersion = useCallback(async () => {
    try {
      // ✅ FIXED: Use wrapper function to preserve class scope
      return await serviceWorkerManager.getVersion();
    } catch (err) {
      const swError = err as Error;
      setError(swError);
      onError?.(swError);
      return null;
    }
  }, [onError]);

  /**
   * Effect for auto-registering the service worker on component mount.
   * Only registers once if autoRegister is enabled and conditions are met.
   */
  useEffect(() => {
    // Don't auto-register if service worker is disabled
    if (isDisabled) {
      return;
    }

    // Only attempt registration once
    if (
      autoRegister &&
      state.isSupported &&
      !state.isRegistered &&
      !isLoading &&
      !hasAttemptedRegistration
    ) {
      setHasAttemptedRegistration(true);
      register();
    }
  }, [
    isDisabled,
    autoRegister,
    state.isSupported,
    state.isRegistered,
    isLoading,
    hasAttemptedRegistration,
    register,
  ]);

  /**
   * Effect for setting up periodic service worker update checks.
   * Checks for updates every 30 minutes and when the page becomes visible.
   */
  useEffect(() => {
    // Don't set up update checks if service worker is disabled
    if (isDisabled) {
      return;
    }

    if (!state.isRegistered) return;

    /**
     * Checks for service worker updates if not currently loading.
     * Prevents concurrent update operations and logs any errors.
     */
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
  }, [isDisabled, state.isRegistered, isLoading, update]);

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
