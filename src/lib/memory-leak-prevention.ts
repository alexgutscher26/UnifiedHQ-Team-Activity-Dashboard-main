import React, { useEffect, useRef, useCallback } from 'react';

// Memory leak detection and monitoring
export class MemoryLeakDetector {
  private static instance: MemoryLeakDetector;
  private activeSubscriptions = new Set<() => void>();
  private activeTimers = new Set<NodeJS.Timeout | number>();
  private activeEventListeners = new Map<
    Element,
    Array<{ event: string; handler: EventListener }>
  >();
  private componentMounts = new Map<string, number>();
  private memorySnapshots: Array<{ timestamp: number; memory: any }> = [];

  static getInstance(): MemoryLeakDetector {
    if (!MemoryLeakDetector.instance) {
      MemoryLeakDetector.instance = new MemoryLeakDetector();
    }
    return MemoryLeakDetector.instance;
  }

  // Track component mount
  trackComponentMount(componentName: string) {
    const count = this.componentMounts.get(componentName) || 0;
    this.componentMounts.set(componentName, count + 1);

    if (process.env.NODE_ENV === 'development') {
      console.log(
        `[Memory] Component ${componentName} mounted (${count + 1} times)`
      );
    }
  }

  // Track component unmount
  trackComponentUnmount(componentName: string) {
    const count = this.componentMounts.get(componentName) || 0;
    this.componentMounts.set(componentName, Math.max(0, count - 1));

    if (process.env.NODE_ENV === 'development') {
      console.log(
        `[Memory] Component ${componentName} unmounted (${count - 1} remaining)`
      );
    }
  }

  // Track subscription
  trackSubscription(cleanup: () => void) {
    this.activeSubscriptions.add(cleanup);
    return () => {
      this.activeSubscriptions.delete(cleanup);
      cleanup();
    };
  }

  // Track timer
  trackTimer(timerId: NodeJS.Timeout | number) {
    this.activeTimers.add(timerId);
    return timerId;
  }

  // Track event listener
  trackEventListener(element: Element, event: string, handler: EventListener) {
    if (!this.activeEventListeners.has(element)) {
      this.activeEventListeners.set(element, []);
    }
    this.activeEventListeners.get(element)!.push({ event, handler });
    return { event, handler };
  }

  // Cleanup all tracked resources
  cleanupAll() {
    // Cleanup subscriptions
    this.activeSubscriptions.forEach(cleanup => {
      try {
        cleanup();
      } catch (error) {
        console.error('[Memory] Error cleaning up subscription:', error);
      }
    });
    this.activeSubscriptions.clear();

    // Cleanup timers
    this.activeTimers.forEach(timerId => {
      try {
        clearTimeout(timerId as NodeJS.Timeout);
        clearInterval(timerId as NodeJS.Timeout);
      } catch (error) {
        console.error('[Memory] Error cleaning up timer:', error);
      }
    });
    this.activeTimers.clear();

    // Cleanup event listeners
    this.activeEventListeners.forEach((listeners, element) => {
      listeners.forEach(({ event, handler }) => {
        try {
          element.removeEventListener(event, handler);
        } catch (error) {
          console.error('[Memory] Error cleaning up event listener:', error);
        }
      });
    });
    this.activeEventListeners.clear();
  }

  // Get memory usage report
  getMemoryReport() {
    const report = {
      activeSubscriptions: this.activeSubscriptions.size,
      activeTimers: this.activeTimers.size,
      activeEventListeners: Array.from(
        this.activeEventListeners.values()
      ).reduce((total, listeners) => total + listeners.length, 0),
      componentMounts: Object.fromEntries(this.componentMounts),
      memorySnapshots: this.memorySnapshots.slice(-10), // Last 10 snapshots
    };

    if (process.env.NODE_ENV === 'development') {
      console.log('[Memory] Current memory report:', report);
    }

    return report;
  }

  // Take memory snapshot
  takeMemorySnapshot() {
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const memory = (performance as any).memory;
      const snapshot = {
        timestamp: Date.now(),
        memory: {
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit,
        },
      };
      this.memorySnapshots.push(snapshot);

      // Keep only last 50 snapshots
      if (this.memorySnapshots.length > 50) {
        this.memorySnapshots = this.memorySnapshots.slice(-50);
      }
    }
  }
}

// Hook for automatic cleanup
export function useMemoryLeakPrevention(componentName: string) {
  const detector = MemoryLeakDetector.getInstance();
  const cleanupFunctions = useRef<Array<() => void>>([]);

  useEffect(() => {
    detector.trackComponentMount(componentName);

    return () => {
      detector.trackComponentUnmount(componentName);
      // Run all cleanup functions
      cleanupFunctions.current.forEach(cleanup => {
        try {
          cleanup();
        } catch (error) {
          console.error(`[Memory] Error cleaning up ${componentName}:`, error);
        }
      });
      cleanupFunctions.current = [];
    };
  }, [componentName]);

  const addCleanup = useCallback((cleanup: () => void) => {
    cleanupFunctions.current.push(cleanup);
  }, []);

  return { addCleanup };
}

// Hook for safe subscriptions
export function useSafeSubscription<T>(
  subscribe: (callback: (value: T) => void) => () => void,
  initialValue?: T
) {
  const detector = MemoryLeakDetector.getInstance();
  const [value, setValue] = React.useState<T | undefined>(initialValue);
  const subscriptionRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const unsubscribe = subscribe(newValue => {
      setValue(newValue);
    });

    subscriptionRef.current = unsubscribe;
    const trackedUnsubscribe = detector.trackSubscription(unsubscribe);

    return () => {
      if (subscriptionRef.current) {
        trackedUnsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, [subscribe]);

  return value;
}

// Hook for safe timers
export function useSafeTimer() {
  const detector = MemoryLeakDetector.getInstance();
  const timersRef = useRef<Set<NodeJS.Timeout | number>>(new Set());

  const setTimeout = useCallback((callback: () => void, delay: number) => {
    const timerId = global.setTimeout(() => {
      timersRef.current.delete(timerId);
      callback();
    }, delay);

    timersRef.current.add(timerId);
    detector.trackTimer(timerId);

    return timerId;
  }, []);

  const setInterval = useCallback((callback: () => void, delay: number) => {
    const timerId = global.setInterval(callback, delay);

    timersRef.current.add(timerId);
    detector.trackTimer(timerId);

    return timerId;
  }, []);

  const clearTimeout = useCallback((timerId: NodeJS.Timeout | number) => {
    timersRef.current.delete(timerId);
    global.clearTimeout(timerId);
  }, []);

  const clearInterval = useCallback((timerId: NodeJS.Timeout | number) => {
    timersRef.current.delete(timerId);
    global.clearInterval(timerId);
  }, []);

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach(timerId => {
        global.clearTimeout(timerId);
        global.clearInterval(timerId);
      });
      timersRef.current.clear();
    };
  }, []);

  return { setTimeout, setInterval, clearTimeout, clearInterval };
}

// Hook for safe event listeners
export function useSafeEventListener<T extends Element>(
  element: T | null,
  event: string,
  handler: EventListener,
  options?: AddEventListenerOptions
) {
  const detector = MemoryLeakDetector.getInstance();
  const handlerRef = useRef(handler);

  // Update handler ref when handler changes
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!element) return;

    const eventHandler = (e: Event) => handlerRef.current(e);

    element.addEventListener(event, eventHandler, options);
    detector.trackEventListener(element, event, eventHandler);

    return () => {
      element.removeEventListener(event, eventHandler, options);
    };
  }, [element, event, options]);
}

// Hook for safe async operations
export function useSafeAsync<T>(
  asyncFn: () => Promise<T>,
  deps: React.DependencyList = []
) {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const execute = useCallback(async () => {
    if (!isMountedRef.current) return;

    setLoading(true);
    setError(null);

    try {
      const result = await asyncFn();
      if (isMountedRef.current) {
        setData(result);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, deps);

  useEffect(() => {
    execute();
  }, [execute]);

  return { data, loading, error, execute };
}

// Hook for safe fetch operations
export function useSafeFetch<T>(url: string | null, options?: RequestInit) {
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async (): Promise<T> => {
    if (!url) throw new Error('URL is required');

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    const response = await fetch(url, {
      ...options,
      signal: abortControllerRef.current.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }, [url, options]);

  const { data, loading, error } = useSafeAsync(fetchData, [url, options]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return { data, loading, error };
}

// Hook for debounced values
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);
  const { setTimeout, clearTimeout } = useSafeTimer();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay, setTimeout, clearTimeout]);

  return debouncedValue;
}

// Hook for throttled values
export function useThrottle<T>(value: T, delay: number): T {
  const [throttledValue, setThrottledValue] = React.useState<T>(value);
  const lastExecuted = useRef<number>(Date.now());
  const { setTimeout, clearTimeout } = useSafeTimer();

  useEffect(() => {
    const now = Date.now();
    const timeSinceLastExecution = now - lastExecuted.current;

    if (timeSinceLastExecution >= delay) {
      setThrottledValue(value);
      lastExecuted.current = now;
    } else {
      const timer = setTimeout(() => {
        setThrottledValue(value);
        lastExecuted.current = Date.now();
      }, delay - timeSinceLastExecution);

      return () => clearTimeout(timer);
    }
  }, [value, delay, setTimeout, clearTimeout]);

  return throttledValue;
}

// Component wrapper for automatic memory leak prevention
export function withMemoryLeakPrevention<P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
) {
  const WrappedComponent = (props: P) => {
    const name =
      componentName || Component.displayName || Component.name || 'Unknown';
    useMemoryLeakPrevention(name);

    return React.createElement(Component, props);
  };

  WrappedComponent.displayName = `withMemoryLeakPrevention(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

// Global cleanup function
export function cleanupAllMemoryLeaks() {
  const detector = MemoryLeakDetector.getInstance();
  detector.cleanupAll();
}

// Development helper
export function getMemoryReport() {
  const detector = MemoryLeakDetector.getInstance();
  return detector.getMemoryReport();
}

// Memory monitoring hook for development
export function useMemoryMonitoring(interval: number = 5000) {
  const detector = MemoryLeakDetector.getInstance();
  const { setInterval, clearInterval } = useSafeTimer();

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const timer = setInterval(() => {
      detector.takeMemorySnapshot();
      detector.getMemoryReport();
    }, interval);

    return () => clearInterval(timer);
  }, [interval, setInterval, clearInterval]);
}
