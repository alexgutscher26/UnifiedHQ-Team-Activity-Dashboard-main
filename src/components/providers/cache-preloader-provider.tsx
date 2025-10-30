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

export function useCachePreloaderContext() {
  return useContext(CachePreloaderContext);
}

interface CachePreloaderProviderProps {
  children: React.ReactNode;
}

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
