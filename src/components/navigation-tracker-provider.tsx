/**
 * Navigation Tracker Provider
 * Automatically tracks navigation and provides context for the app
 */

'use client';

import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useNavigationTracking } from '@/hooks/use-navigation-tracking';

interface NavigationTrackerContextType {
  sessionId: string;
  trackNavigation: (path?: string) => Promise<void>;
  preloadForCurrentPath: () => Promise<void>;
  preloadCriticalData: () => Promise<void>;
  isTracking: boolean;
}

const NavigationTrackerContext =
  createContext<NavigationTrackerContextType | null>(null);

interface NavigationTrackerProviderProps {
  children: ReactNode;
  /**
   * Whether to preload critical data on app start
   * @default true
   */
  preloadOnStart?: boolean;
  /**
   * Whether to automatically track navigation changes
   * @default true
   */
  autoTrack?: boolean;
}

export function NavigationTrackerProvider({
  children,
  preloadOnStart = true,
  autoTrack = true,
}: NavigationTrackerProviderProps) {
  const tracking = useNavigationTracking({
    autoTrack,
    preloadOnMount: preloadOnStart,
    debounceMs: 150,
  });

  // Log navigation tracking status in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.debug('[NavigationTracker] Provider initialized', {
        sessionId: tracking.sessionId,
        autoTrack,
        preloadOnStart,
      });
    }
  }, [tracking.sessionId, autoTrack, preloadOnStart]);

  const contextValue: NavigationTrackerContextType = {
    sessionId: tracking.sessionId,
    trackNavigation: tracking.trackNavigation,
    preloadForCurrentPath: tracking.preloadForCurrentPath,
    preloadCriticalData: tracking.preloadCriticalData,
    isTracking: tracking.isTracking,
  };

  return (
    <NavigationTrackerContext.Provider value={contextValue}>
      {children}
    </NavigationTrackerContext.Provider>
  );
}

/**
 * Hook to access navigation tracker context
 */
export function useNavigationTrackerContext() {
  const context = useContext(NavigationTrackerContext);

  if (!context) {
    throw new Error(
      'useNavigationTrackerContext must be used within NavigationTrackerProvider'
    );
  }

  return context;
}

/**
 * Optional hook that doesn't throw if used outside provider
 */
export function useOptionalNavigationTracker() {
  return useContext(NavigationTrackerContext);
}
