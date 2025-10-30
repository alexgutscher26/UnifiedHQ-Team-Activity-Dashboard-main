'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

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

// Get connection information if available
const getConnectionInfo = (): Partial<NetworkStatus> => {
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
};

export function useNetworkStatus(
  options: UseNetworkStatusOptions = {}
): UseNetworkStatusReturn {
  const {
    onOnline,
    onOffline,
    pingUrl = '/favicon.ico',
    enablePing = false, // Disable ping by default to avoid issues
  } = options;

  // Initialize state with current navigator status and connection info
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>(() => {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const connectionInfo = getConnectionInfo();

    return {
      isOnline,
      isOffline: !isOnline,
      ...connectionInfo,
    };
  });

  const [lastChecked, setLastChecked] = useState<number | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  // Store callback refs to avoid stale closures
  const onOnlineRef = useRef(onOnline);
  const onOfflineRef = useRef(onOffline);

  // Update refs when callbacks change
  useEffect(() => {
    onOnlineRef.current = onOnline;
  }, [onOnline]);

  useEffect(() => {
    onOfflineRef.current = onOffline;
  }, [onOffline]);

  // Stable check connection function
  const checkConnection = useCallback(async (): Promise<boolean> => {
    if (!enablePing) {
      return typeof navigator !== 'undefined' ? navigator.onLine : true;
    }

    setIsChecking(true);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(pingUrl, {
        method: 'HEAD',
        cache: 'no-cache',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      setLastChecked(Date.now());

      return response.ok;
    } catch (error) {
      setLastChecked(Date.now());
      // Always trust navigator.onLine to avoid false offline states
      return typeof navigator !== 'undefined' ? navigator.onLine : true;
    } finally {
      setIsChecking(false);
    }
  }, [enablePing, pingUrl]);

  // Use ref for update function to avoid recreating it
  const updateNetworkStatusRef = useRef<
    ((isOnline: boolean) => void) | undefined
  >(undefined);

  updateNetworkStatusRef.current = (isOnline: boolean) => {
    setNetworkStatus(prev => {
      // Only update if the status actually changed
      if (prev.isOnline === isOnline) {
        return prev;
      }

      // Call callbacks if status changed
      if (isOnline) {
        onOnlineRef.current?.();
      } else {
        onOfflineRef.current?.();
      }

      // Get fresh connection info
      const connectionInfo = getConnectionInfo();

      return {
        ...prev,
        ...connectionInfo,
        isOnline,
        isOffline: !isOnline,
      };
    });
  };

  // Handle online/offline events - set up once
  useEffect(() => {
    if (typeof window === 'undefined') return;

    /**
     * Logs the online status and updates the network status reference.
     */
    const handleOnline = () => {
      console.log('[Network Status] Browser reports online');
      updateNetworkStatusRef.current?.(true);
    };

    /**
     * Logs the offline status and updates the network status reference.
     */
    const handleOffline = () => {
      console.log('[Network Status] Browser reports offline');
      updateNetworkStatusRef.current?.(false);
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

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);

      if (connection) {
        connection.removeEventListener('change', handleConnectionChange);
      }
    };
  }, []); // Empty dependency array - set up once

  return {
    ...networkStatus,
    checkConnection,
    lastChecked,
    isChecking,
  };
}
