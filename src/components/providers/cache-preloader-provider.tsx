/**
 * Cache Preloader Provider
 * Initializes and manages cache preloading across the application
 */

'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { preloadManager } from '@/lib/service-worker/preload-manager';

interface CachePreloaderContextType {
  isInitialized: boolean;
  isSupported: boolean;
  error: string | null;
}

const CachePreloaderContext = createContext<CachePreloaderContextType>({
  isInitialized: false,
  isSupported: false,
  error: null,
});

/**
 * Retrieves the CachePreloaderContext using useContext.
 */
export function useCachePreloaderContext() {
  return useContext(CachePreloaderContext);
}

interface CachePreloaderProviderProps {
  children: React.ReactNode;
}

/**
 * Provides a context for cache preloading functionality.
 *
 * This component checks for the support of service workers and the Cache API in the browser.
 * If supported, it initializes the cache preloader using the preloadManager. The state is managed
 * to reflect whether the initialization was successful, and any errors encountered during the process
 * are captured and stored. The component renders its children within the CachePreloaderContext.Provider.
 *
 * @param {Object} props - The properties for the component.
 * @param {ReactNode} props.children - The child components to be rendered within the context provider.
 */
export function CachePreloaderProvider({
  children,
}: CachePreloaderProviderProps) {
  const [state, setState] = useState<CachePreloaderContextType>({
    isInitialized: false,
    isSupported: false,
    error: null,
  });

  useEffect(() => {
    // Check if service workers are supported
    const isSupported = 'serviceWorker' in navigator && 'caches' in window;

    if (!isSupported) {
      setState({
        isInitialized: false,
        isSupported: false,
        error: 'Service workers or Cache API not supported in this browser',
      });
      return;
    }

    // Initialize the cache preloader
    /**
     * Initializes the preloader and updates the application state.
     *
     * This function attempts to initialize the preloadManager. If successful, it sets the state to indicate that the preloader is initialized and supported, while logging a success message. In case of an error, it updates the state to reflect the failure and logs the error message for debugging purposes.
     */
    const initializePreloader = async () => {
      try {
        await preloadManager.initialize();

        setState({
          isInitialized: true,
          isSupported: true,
          error: null,
        });

        console.log('[Cache Preloader Provider] Successfully initialized');
      } catch (error) {
        setState({
          isInitialized: false,
          isSupported: true,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to initialize cache preloader',
        });

        console.error(
          '[Cache Preloader Provider] Initialization failed:',
          error
        );
      }
    };

    initializePreloader();
  }, []);

  return (
    <CachePreloaderContext.Provider value={state}>
      {children}
    </CachePreloaderContext.Provider>
  );
}
