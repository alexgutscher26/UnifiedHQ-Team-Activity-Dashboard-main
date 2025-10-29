'use client';

import { useState, useEffect, useCallback } from 'react';

export interface NetworkStatus {
  isOnline: boolean;
  isOffline: boolean;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

export interface UseNetworkStatusOptions {
  onOnline?: () => void;
  onOffline?: () => void;
  pingUrl?: string;
  pingInterval?: number;
  enablePing?: boolean;
}

export interface UseNetworkStatusReturn extends NetworkStatus {
  checkConnection: () => Promise<boolean>;
  lastChecked: number | null;
  isChecking: boolean;
}

export function useNetworkStatus(
  options: UseNetworkStatusOptions = {}
): UseNetworkStatusReturn {
  const {
    onOnline,
    onOffline,
    pingUrl = '/api/health',
    pingInterval = 30000, // 30 seconds
    enablePing = true,
  } = options;

  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>(() => ({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isOffline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
  }));

  const [lastChecked, setLastChecked] = useState<number | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  // Get connection information if available
  const getConnectionInfo = useCallback((): Partial<NetworkStatus> => {
    if (typeof navigator === 'undefined') return {};

    const connection =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection;

    if (!connection) return {};

    return {
      effectiveType: connection.effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt,
      saveData: connection.saveData,
    };
  }, []);

  // Check actual connectivity by making a request
  const checkConnection = useCallback(async (): Promise<boolean> => {
    if (!enablePing) {
      return navigator.onLine;
    }

    setIsChecking(true);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(pingUrl, {
        method: 'HEAD',
        cache: 'no-cache',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      setLastChecked(Date.now());

      return response.ok;
    } catch (error) {
      console.log('[Network Status] Ping failed:', error);
      setLastChecked(Date.now());
      return false;
    } finally {
      setIsChecking(false);
    }
  }, [enablePing, pingUrl]);

  // Update network status
  const updateNetworkStatus = useCallback(
    (isOnline: boolean) => {
      const connectionInfo = getConnectionInfo();

      setNetworkStatus(prev => {
        const newStatus = {
          ...prev,
          ...connectionInfo,
          isOnline,
          isOffline: !isOnline,
        };

        // Call callbacks if status changed
        if (prev.isOnline !== isOnline) {
          if (isOnline) {
            onOnline?.();
          } else {
            onOffline?.();
          }
        }

        return newStatus;
      });
    },
    [getConnectionInfo, onOnline, onOffline]
  );

  // Handle online/offline events
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      console.log('[Network Status] Browser reports online');
      updateNetworkStatus(true);

      // Verify with ping if enabled
      if (enablePing) {
        checkConnection().then(isActuallyOnline => {
          if (!isActuallyOnline) {
            updateNetworkStatus(false);
          }
        });
      }
    };

    const handleOffline = () => {
      console.log('[Network Status] Browser reports offline');
      updateNetworkStatus(false);
    };

    const handleConnectionChange = () => {
      console.log('[Network Status] Connection changed');
      const connectionInfo = getConnectionInfo();
      setNetworkStatus(prev => ({ ...prev, ...connectionInfo }));
    };

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for connection changes
    const connection =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection;

    if (connection) {
      connection.addEventListener('change', handleConnectionChange);
    }

    // Initial status check
    updateNetworkStatus(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);

      if (connection) {
        connection.removeEventListener('change', handleConnectionChange);
      }
    };
  }, [updateNetworkStatus, checkConnection, enablePing, getConnectionInfo]);

  // Periodic connectivity checks
  useEffect(() => {
    if (!enablePing || pingInterval <= 0) return;

    const interval = setInterval(() => {
      if (networkStatus.isOnline && !isChecking) {
        checkConnection().then(isOnline => {
          if (!isOnline && networkStatus.isOnline) {
            updateNetworkStatus(false);
          }
        });
      }
    }, pingInterval);

    return () => clearInterval(interval);
  }, [
    enablePing,
    pingInterval,
    networkStatus.isOnline,
    isChecking,
    checkConnection,
    updateNetworkStatus,
  ]);

  // Check connection when coming back online
  useEffect(() => {
    if (networkStatus.isOnline && enablePing && !isChecking) {
      checkConnection().then(isActuallyOnline => {
        if (!isActuallyOnline) {
          updateNetworkStatus(false);
        }
      });
    }
  }, [
    networkStatus.isOnline,
    enablePing,
    isChecking,
    checkConnection,
    updateNetworkStatus,
  ]);

  return {
    ...networkStatus,
    checkConnection,
    lastChecked,
    isChecking,
  };
}
