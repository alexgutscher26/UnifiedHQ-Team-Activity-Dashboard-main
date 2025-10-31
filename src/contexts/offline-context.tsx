'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import { useNetworkStatusContext } from '@/contexts/network-status-context';
import { useServiceWorkerContext } from '@/components/service-worker-provider';
import { toast } from 'sonner';

interface OfflineContextType {
  isOffline: boolean;
  isOnline: boolean;
  hasBeenOffline: boolean;
  offlineSince: Date | null;
  cachedPages: string[];
  queuedActions: number;
  syncInProgress: boolean;
  lastSyncAttempt: Date | null;
  retrySync: () => Promise<void>;
  clearOfflineData: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType | null>(null);

export function useOfflineContext(): OfflineContextType {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOfflineContext must be used within OfflineProvider');
  }
  return context;
}

interface OfflineProviderProps {
  children: React.ReactNode;
  enableNotifications?: boolean;
  enableAutoSync?: boolean;
}

export function OfflineProvider({
  children,
  enableNotifications = true,
  enableAutoSync = true,
}: OfflineProviderProps) {
  const [hasBeenOffline, setHasBeenOffline] = useState(false);
  const [offlineSince, setOfflineSince] = useState<Date | null>(null);
  const [cachedPages, setCachedPages] = useState<string[]>([]);
  const [queuedActions, setQueuedActions] = useState(0);
  const [syncInProgress, setSyncInProgress] = useState(false);
  const [lastSyncAttempt, setLastSyncAttempt] = useState<Date | null>(null);

  const networkStatus = useNetworkStatusContext();

  // Handle network status changes with useEffect instead of callbacks
  const prevOnlineStatus = useRef(networkStatus.isOnline);

  useEffect(() => {
    // Only react to actual changes
    if (prevOnlineStatus.current === networkStatus.isOnline) {
      return;
    }

    prevOnlineStatus.current = networkStatus.isOnline;

    if (networkStatus.isOffline) {
      console.log('[Offline Context] Going offline');
      setHasBeenOffline(true);
      setOfflineSince(new Date());

      if (enableNotifications) {
        toast.warning("You're now offline", {
          description:
            'Some features may be limited. Changes will be saved locally.',
          duration: 5000,
        });
      }
    } else if (networkStatus.isOnline) {
      console.log('[Offline Context] Coming back online');
      setOfflineSince(null);

      if (enableNotifications && hasBeenOffline) {
        toast.success("You're back online!", {
          description: 'Syncing your offline changes...',
          duration: 3000,
        });
      }

      // Auto-sync when coming back online
      if (enableAutoSync && queuedActions > 0) {
        retrySyncRef.current?.();
      }
    }
  }, [
    networkStatus.isOnline,
    networkStatus.isOffline,
    enableNotifications,
    hasBeenOffline,
    enableAutoSync,
    queuedActions,
  ]);

  const serviceWorker = useServiceWorkerContext();
  const isServiceWorkerDisabled = process.env.NEXT_PUBLIC_DISABLE_SW === 'true';

  // Load cached pages from service worker
  useEffect(() => {
    if (isServiceWorkerDisabled) return;

    if (serviceWorker.isActive) {
      loadCachedPages();
    }
  }, [isServiceWorkerDisabled, serviceWorker.isActive]);

  // Load queued actions count (this would typically come from IndexedDB)
  useEffect(() => {
    loadQueuedActionsCount();
  }, []);

  const loadCachedPages = useCallback(async () => {
    try {
      // tODO: This would typically query the service worker for cached URLs
      // For now, we'll simulate with common pages
      const commonPages = ['/', '/dashboard', '/integrations', '/settings'];
      setCachedPages(commonPages);
    } catch (error) {
      console.error('[Offline Context] Failed to load cached pages:', error);
    }
  }, []);

  const loadQueuedActionsCount = useCallback(async () => {
    try {
      // TODO: This would typically query IndexedDB for queued actions
      // For now, we'll simulate
      const stored = localStorage.getItem('offline-queued-actions');
      const count = stored ? parseInt(stored, 10) : 0;
      setQueuedActions(count);
    } catch (error) {
      console.error('[Offline Context] Failed to load queued actions:', error);
    }
  }, []);

  const retrySyncRef = useRef<(() => Promise<void>) | undefined>(undefined);

  retrySyncRef.current = async () => {
    if (syncInProgress || networkStatus.isOffline) {
      return;
    }

    setSyncInProgress(true);
    setLastSyncAttempt(new Date());

    try {
      console.log('[Offline Context] Starting sync...');

      // This would typically process the offline queue
      // For now, we'll simulate the sync process
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Clear queued actions after successful sync
      setQueuedActions(0);
      localStorage.removeItem('offline-queued-actions');

      if (enableNotifications) {
        toast.success('Sync completed', {
          description: 'All offline changes have been synchronized.',
        });
      }

      console.log('[Offline Context] Sync completed successfully');
    } catch (error) {
      console.error('[Offline Context] Sync failed:', error);

      if (enableNotifications) {
        toast.error('Sync failed', {
          description:
            'Failed to sync offline changes. Will retry automatically.',
        });
      }
    } finally {
      setSyncInProgress(false);
    }
  };

  const retrySync = useCallback(async () => {
    return retrySyncRef.current?.();
  }, []);

  const clearOfflineData = useCallback(async () => {
    try {
      // Clear service worker caches
      if (!isServiceWorkerDisabled) {
        await serviceWorker.clearCache();
      }

      // Clear local storage
      localStorage.removeItem('offline-queued-actions');

      // Reset state
      setQueuedActions(0);
      setCachedPages([]);
      setHasBeenOffline(false);
      setOfflineSince(null);

      if (enableNotifications) {
        toast.success('Offline data cleared', {
          description: 'All cached data and queued actions have been removed.',
        });
      }

      console.log('[Offline Context] Offline data cleared');
    } catch (error) {
      console.error('[Offline Context] Failed to clear offline data:', error);

      if (enableNotifications) {
        toast.error('Failed to clear offline data', {
          description: 'Some cached data may still be present.',
        });
      }
    }
  }, [isServiceWorkerDisabled, serviceWorker, enableNotifications]);

  // Auto-retry sync when coming back online
  useEffect(() => {
    if (
      networkStatus.isOnline &&
      hasBeenOffline &&
      queuedActions > 0 &&
      enableAutoSync
    ) {
      const timer = setTimeout(() => {
        retrySyncRef.current?.();
      }, 2000); // Wait 2 seconds after coming online

      return () => clearTimeout(timer);
    }
  }, [networkStatus.isOnline, hasBeenOffline, queuedActions, enableAutoSync]);

  const contextValue: OfflineContextType = {
    isOffline: networkStatus.isOffline,
    isOnline: networkStatus.isOnline,
    hasBeenOffline,
    offlineSince,
    cachedPages,
    queuedActions,
    syncInProgress,
    lastSyncAttempt,
    retrySync,
    clearOfflineData,
  };

  return (
    <OfflineContext.Provider value={contextValue}>
      {children}
    </OfflineContext.Provider>
  );
}
