/**
 * Performance monitoring hooks and utilities for activity feeds
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { toast } from '@/hooks/use-toast';

export interface PerformanceMetrics {
  renderTime: number;
  itemCount: number;
  lastUpdate: Date;
  memoryUsage?: number;
  fps?: number;
  scrollPerformance?: {
    scrollEvents: number;
    averageScrollTime: number;
  };
  memoryMetrics?: MemoryMetrics;
}

export interface MemoryMetrics {
  heapUsed: number;
  heapTotal: number;
  heapLimit: number;
  external: number;
  arrayBuffers: number;
  gcFrequency: number;
  memoryGrowthRate: number;
  suspiciousGrowth: boolean;
  timestamp: Date;
}

export interface MemoryTrend {
  timestamp: Date;
  memoryUsage: number;
  componentCount: number;
  eventListenerCount: number;
  intervalCount: number;
  trend: 'stable' | 'growing' | 'declining';
  growthRate: number;
}

export interface PerformanceConfig {
  enableMemoryMonitoring?: boolean;
  enableFPSMonitoring?: boolean;
  enableScrollMonitoring?: boolean;
  sampleRate?: number; // 0-1, how often to sample
  memoryThreshold?: number; // MB
  memoryAlertEnabled?: boolean;
  memoryTrackingInterval?: number; // ms
  trendAnalysisEnabled?: boolean;
}

/**
 * Hook for monitoring component performance with enhanced memory leak detection
 */
export const usePerformanceMonitor = (config: PerformanceConfig = {}) => {
  const {
    enableMemoryMonitoring = true,
    enableFPSMonitoring = false,
    enableScrollMonitoring = true,
    sampleRate = 0.1,
    memoryThreshold = 100, // 100MB default threshold
    memoryAlertEnabled = true,
    memoryTrackingInterval = 5000, // 5 seconds
    trendAnalysisEnabled = true,
  } = config;

  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    itemCount: 0,
    lastUpdate: new Date(),
  });

  const [memoryTrends, setMemoryTrends] = useState<MemoryTrend[]>([]);
  const [lastGCCount, setLastGCCount] = useState(0);

  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const scrollEventsRef = useRef(0);
  const scrollTimesRef = useRef<number[]>([]);
  const memoryHistoryRef = useRef<{ timestamp: Date; usage: number }[]>([]);
  const componentCountRef = useRef(0);
  const eventListenerCountRef = useRef(0);
  const intervalCountRef = useRef(0);
  const leakDetection = useMemoryLeakDetection();

  // Update refs with current leak detection counts
  useEffect(() => {
    componentCountRef.current = leakDetection.componentLifecycle.active;
    eventListenerCountRef.current = leakDetection.eventListenerCount;
    intervalCountRef.current = leakDetection.intervalCount;
  }, [
    leakDetection.componentLifecycle.active,
    leakDetection.eventListenerCount,
    leakDetection.intervalCount,
  ]);

  const getMemoryMetrics = useCallback((): MemoryMetrics | undefined => {
    if (!enableMemoryMonitoring || !('memory' in performance)) {
      return undefined;
    }

    const memory = (performance as any).memory;
    if (!memory) return undefined;

    const now = new Date();
    const currentUsage = memory.usedJSHeapSize / 1024 / 1024; // MB

    // Calculate growth rate
    const history = memoryHistoryRef.current;
    let memoryGrowthRate = 0;
    let suspiciousGrowth = false;

    if (history.length > 1) {
      const recent = history.slice(-5); // Last 5 measurements
      if (recent.length >= 2) {
        const oldestRecent = recent[0];
        const timeDiff =
          (now.getTime() - oldestRecent.timestamp.getTime()) / 1000; // seconds
        const usageDiff = currentUsage - oldestRecent.usage;
        memoryGrowthRate = timeDiff > 0 ? usageDiff / timeDiff : 0; // MB/second

        // Flag suspicious growth (>1MB/second sustained)
        suspiciousGrowth = memoryGrowthRate > 1;
      }
    }

    // Update memory history
    history.push({ timestamp: now, usage: currentUsage });
    if (history.length > 50) {
      history.shift(); // Keep only last 50 measurements
    }

    // Calculate GC frequency (approximate)
    const currentGCCount = (performance as any).measureUserAgentSpecificMemory
      ? Math.floor(currentUsage / 10)
      : lastGCCount; // Rough approximation
    const gcFrequency = Math.max(0, currentGCCount - lastGCCount);
    setLastGCCount(currentGCCount);

    return {
      heapUsed: memory.usedJSHeapSize / 1024 / 1024, // MB
      heapTotal: memory.totalJSHeapSize / 1024 / 1024, // MB
      heapLimit: memory.jsHeapSizeLimit / 1024 / 1024, // MB
      external: 0, // Not available in browser
      arrayBuffers: 0, // Not directly available
      gcFrequency,
      memoryGrowthRate,
      suspiciousGrowth,
      timestamp: now,
    };
  }, [enableMemoryMonitoring, lastGCCount]);

  const checkMemoryThreshold = useCallback(
    (memoryMetrics: MemoryMetrics) => {
      if (!memoryAlertEnabled) return;

      const { heapUsed, suspiciousGrowth, memoryGrowthRate } = memoryMetrics;

      // Alert on memory threshold exceeded
      if (heapUsed > memoryThreshold) {
        toast({
          title: 'Memory Usage Alert',
          description: `Memory usage (${heapUsed.toFixed(1)}MB) exceeds threshold (${memoryThreshold}MB)`,
          variant: 'destructive',
        });
      }

      // Alert on suspicious memory growth
      if (suspiciousGrowth && memoryGrowthRate > 1) {
        toast({
          title: 'Memory Leak Detected',
          description: `Rapid memory growth detected: ${memoryGrowthRate.toFixed(2)}MB/second`,
          variant: 'destructive',
        });
      }

      // Alert on heap limit approaching (90% of limit)
      const heapUsagePercent = (heapUsed / memoryMetrics.heapLimit) * 100;
      if (heapUsagePercent > 90) {
        toast({
          title: 'Memory Limit Warning',
          description: `Heap usage at ${heapUsagePercent.toFixed(1)}% of limit`,
          variant: 'destructive',
        });
      }
    },
    [memoryAlertEnabled, memoryThreshold]
  );

  const analyzeMemoryTrends = useCallback(() => {
    if (!trendAnalysisEnabled || memoryHistoryRef.current.length < 3) {
      return;
    }

    const history = memoryHistoryRef.current;
    const now = new Date();

    // Calculate trend over last 10 measurements
    const recentHistory = history.slice(-10);
    if (recentHistory.length < 3) return;

    const firstPoint = recentHistory[0];
    const lastPoint = recentHistory[recentHistory.length - 1];
    const timeDiff =
      (lastPoint.timestamp.getTime() - firstPoint.timestamp.getTime()) / 1000; // seconds
    const usageDiff = lastPoint.usage - firstPoint.usage;
    const growthRate = timeDiff > 0 ? usageDiff / timeDiff : 0; // MB/second

    // Determine trend direction
    let trend: 'stable' | 'growing' | 'declining' = 'stable';
    if (Math.abs(growthRate) > 0.1) {
      // Threshold for significant change
      trend = growthRate > 0 ? 'growing' : 'declining';
    }

    // Create trend entry
    const trendEntry: MemoryTrend = {
      timestamp: now,
      memoryUsage: lastPoint.usage,
      componentCount: componentCountRef.current,
      eventListenerCount: eventListenerCountRef.current,
      intervalCount: intervalCountRef.current,
      trend,
      growthRate,
    };

    setMemoryTrends(prevTrends => {
      const newTrends = [...prevTrends, trendEntry];
      // Keep only last 100 trend entries
      return newTrends.slice(-100);
    });

    // Alert on concerning trends
    if (trend === 'growing' && growthRate > 0.5) {
      // >0.5MB/second growth
      toast({
        title: 'Memory Trend Alert',
        description: `Sustained memory growth detected: ${growthRate.toFixed(2)}MB/second`,
        variant: 'destructive',
      });
    }
  }, [trendAnalysisEnabled]);

  const calculateMemoryLeakProbability = useCallback((): number => {
    if (memoryTrends.length < 5) return 0;

    const recentTrends = memoryTrends.slice(-5);
    let score = 0;

    // Check for consistent growth
    const growingTrends = recentTrends.filter(
      t => t.trend === 'growing'
    ).length;
    score += (growingTrends / recentTrends.length) * 40; // Max 40 points

    // Check growth rate
    const avgGrowthRate =
      recentTrends.reduce((sum, t) => sum + Math.max(0, t.growthRate), 0) /
      recentTrends.length;
    score += Math.min(avgGrowthRate * 20, 30); // Max 30 points

    // Check component/listener count correlation
    const componentGrowth =
      recentTrends[recentTrends.length - 1].componentCount -
      recentTrends[0].componentCount;
    const listenerGrowth =
      recentTrends[recentTrends.length - 1].eventListenerCount -
      recentTrends[0].eventListenerCount;
    const intervalGrowth =
      recentTrends[recentTrends.length - 1].intervalCount -
      recentTrends[0].intervalCount;

    if (componentGrowth > 0 || listenerGrowth > 0 || intervalGrowth > 0) {
      score += 20; // Max 20 points
    }

    // Check memory usage percentage
    const currentMemory = recentTrends[recentTrends.length - 1].memoryUsage;
    if (currentMemory > memoryThreshold * 0.8) {
      score += 10; // Max 10 points
    }

    return Math.min(score, 100); // Cap at 100%
  }, [memoryTrends, memoryThreshold]);

  const measureRender = useCallback(
    (itemCount: number, renderTime: number) => {
      const newMetrics: PerformanceMetrics = {
        renderTime,
        itemCount,
        lastUpdate: new Date(),
      };

      // Enhanced memory monitoring
      if (enableMemoryMonitoring) {
        const memoryMetrics = getMemoryMetrics();
        if (memoryMetrics) {
          newMetrics.memoryUsage = memoryMetrics.heapUsed;
          newMetrics.memoryMetrics = memoryMetrics;

          // Check for memory threshold alerts
          checkMemoryThreshold(memoryMetrics);
        }
      }

      // FPS monitoring
      if (enableFPSMonitoring) {
        frameCountRef.current++;
        const now = performance.now();
        if (now - lastTimeRef.current >= 1000) {
          newMetrics.fps = frameCountRef.current;
          frameCountRef.current = 0;
          lastTimeRef.current = now;
        }
      }

      // Scroll performance monitoring
      if (enableScrollMonitoring) {
        newMetrics.scrollPerformance = {
          scrollEvents: scrollEventsRef.current,
          averageScrollTime:
            scrollTimesRef.current.length > 0
              ? scrollTimesRef.current.reduce((a, b) => a + b, 0) /
                scrollTimesRef.current.length
              : 0,
        };
      }

      setMetrics(newMetrics);
    },
    [
      enableMemoryMonitoring,
      enableFPSMonitoring,
      enableScrollMonitoring,
      getMemoryMetrics,
      checkMemoryThreshold,
    ]
  );

  const recordScrollEvent = useCallback(
    (scrollTime: number) => {
      if (Math.random() < sampleRate) {
        scrollEventsRef.current++;
        scrollTimesRef.current.push(scrollTime);

        // Keep only last 100 measurements
        if (scrollTimesRef.current.length > 100) {
          scrollTimesRef.current = scrollTimesRef.current.slice(-100);
        }
      }
    },
    [sampleRate]
  );

  const resetMetrics = useCallback(() => {
    setMetrics({
      renderTime: 0,
      itemCount: 0,
      lastUpdate: new Date(),
    });
    scrollEventsRef.current = 0;
    scrollTimesRef.current = [];
    frameCountRef.current = 0;
    lastTimeRef.current = performance.now();
  }, []);

  // Continuous memory monitoring
  useEffect(() => {
    if (!enableMemoryMonitoring) return;

    const interval = setInterval(() => {
      const memoryMetrics = getMemoryMetrics();
      if (memoryMetrics) {
        if (memoryAlertEnabled) {
          checkMemoryThreshold(memoryMetrics);
        }

        if (trendAnalysisEnabled) {
          analyzeMemoryTrends();
        }
      }
    }, memoryTrackingInterval);

    return () => clearInterval(interval);
  }, [
    enableMemoryMonitoring,
    memoryAlertEnabled,
    trendAnalysisEnabled,
    memoryTrackingInterval,
    getMemoryMetrics,
    checkMemoryThreshold,
    analyzeMemoryTrends,
  ]);

  return {
    metrics,
    measureRender,
    recordScrollEvent,
    resetMetrics,
    memoryTrends,
    getMemoryMetrics,
    analyzeMemoryTrends,
    calculateMemoryLeakProbability,
    // Runtime leak detection
    registerComponent: leakDetection.registerComponent,
    unregisterComponent: leakDetection.unregisterComponent,
    registerEventListener: leakDetection.registerEventListener,
    unregisterEventListener: leakDetection.unregisterEventListener,
    registerInterval: leakDetection.registerInterval,
    unregisterInterval: leakDetection.unregisterInterval,
    registerTimeout: leakDetection.registerTimeout,
    unregisterTimeout: leakDetection.unregisterTimeout,
    getLeakStatistics: leakDetection.getLeakStatistics,
    checkForLeaks: leakDetection.checkForLeaks,
  };
};

/**
 * Hook for debouncing values
 */
export const useDebounce = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

/**
 * Hook for throttling function calls
 */
export const useThrottle = <T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T => {
  const lastRun = useRef(Date.now());

  return useCallback(
    ((...args: Parameters<T>) => {
      if (Date.now() - lastRun.current >= delay) {
        callback(...args);
        lastRun.current = Date.now();
      }
    }) as T,
    [callback, delay]
  );
};

/**
 * Hook for intersection observer (lazy loading)
 */
export const useIntersectionObserver = (
  elementRef: React.RefObject<Element>,
  options: IntersectionObserverInit = {}
) => {
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
      },
      {
        threshold: 0.1,
        rootMargin: '50px',
        ...options,
      }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [elementRef, options]);

  return isIntersecting;
};

/**
 * Custom hook for managing virtual scrolling.
 */
export const useVirtualScroll = (
  itemCount: number,
  itemHeight: number,
  containerHeight: number,
  overscan = 5
) => {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleRange = useMemo(() => {
    const startIndex = Math.max(
      0,
      Math.floor(scrollTop / itemHeight) - overscan
    );
    const endIndex = Math.min(
      itemCount - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );

    return { startIndex, endIndex };
  }, [scrollTop, itemHeight, containerHeight, overscan, itemCount]);

  const totalHeight = itemCount * itemHeight;
  const offsetY = visibleRange.startIndex * itemHeight;

  return {
    visibleRange,
    totalHeight,
    offsetY,
    setScrollTop,
  };
};

/**
 * Performance optimization utilities
 */
export const performanceUtils = {
  /**
   * Memoize expensive calculations
   */
  memoize: <T extends (...args: any[]) => any>(fn: T): T => {
    const cache = new Map();
    return ((...args: Parameters<T>) => {
      const key = JSON.stringify(args);
      if (cache.has(key)) {
        return cache.get(key);
      }
      const result = fn(...args);
      cache.set(key, result);
      return result;
    }) as T;
  },

  /**
   * Batch DOM updates
   */
  batchUpdates: (updates: (() => void)[]) => {
    requestAnimationFrame(() => {
      updates.forEach(update => update());
    });
  },

  /**
   * Measure function execution time
   */
  measureTime: <T extends (...args: any[]) => any>(
    fn: T,
    label?: string
  ): T => {
    return ((...args: Parameters<T>) => {
      const start = performance.now();
      const result = fn(...args);
      const end = performance.now();

      if (label) {
        console.log(`${label}: ${(end - start).toFixed(2)}ms`);
      }

      return result;
    }) as T;
  },

  /**
   * Check if component should re-render
   */
  shouldRender: (prevProps: any, nextProps: any, keys: string[]) => {
    return keys.some(key => prevProps[key] !== nextProps[key]);
  },
};

/**
 * Enhanced memory leak detection with runtime tracking
 */
export const useMemoryLeakDetection = () => {
  const [leakCount, setLeakCount] = useState(0);
  const [eventListenerCount, setEventListenerCount] = useState(0);
  const [intervalCount, setIntervalCount] = useState(0);
  const [componentLifecycle, setComponentLifecycle] = useState<{
    mounted: number;
    unmounted: number;
    active: number;
  }>({ mounted: 0, unmounted: 0, active: 0 });

  const componentRefs = useRef(new Set<string>());
  const eventListenerRefs = useRef(new Map<string, number>());
  const intervalRefs = useRef(new Set<number>());
  const timeoutRefs = useRef(new Set<number>());

  const registerComponent = useCallback((componentName: string) => {
    componentRefs.current.add(componentName);
    setComponentLifecycle(prev => ({
      ...prev,
      mounted: prev.mounted + 1,
      active: prev.active + 1,
    }));
  }, []);

  const unregisterComponent = useCallback((componentName: string) => {
    const wasRemoved = componentRefs.current.delete(componentName);
    if (wasRemoved) {
      setComponentLifecycle(prev => ({
        ...prev,
        unmounted: prev.unmounted + 1,
        active: Math.max(0, prev.active - 1),
      }));
    }
  }, []);

  const registerEventListener = useCallback(
    (elementId: string, eventType: string) => {
      const key = `${elementId}:${eventType}`;
      const currentCount = eventListenerRefs.current.get(key) || 0;
      eventListenerRefs.current.set(key, currentCount + 1);
      setEventListenerCount(prev => prev + 1);
    },
    []
  );

  const unregisterEventListener = useCallback(
    (elementId: string, eventType: string) => {
      const key = `${elementId}:${eventType}`;
      const currentCount = eventListenerRefs.current.get(key) || 0;
      if (currentCount > 0) {
        eventListenerRefs.current.set(key, currentCount - 1);
        setEventListenerCount(prev => Math.max(0, prev - 1));

        if (currentCount === 1) {
          eventListenerRefs.current.delete(key);
        }
      }
    },
    []
  );

  const registerInterval = useCallback((intervalId: number) => {
    intervalRefs.current.add(intervalId);
    setIntervalCount(prev => prev + 1);
  }, []);

  const unregisterInterval = useCallback((intervalId: number) => {
    const wasRemoved = intervalRefs.current.delete(intervalId);
    if (wasRemoved) {
      setIntervalCount(prev => Math.max(0, prev - 1));
    }
  }, []);

  const registerTimeout = useCallback((timeoutId: number) => {
    timeoutRefs.current.add(timeoutId);
  }, []);

  const unregisterTimeout = useCallback((timeoutId: number) => {
    timeoutRefs.current.delete(timeoutId);
  }, []);

  const checkForLeaks = useCallback(() => {
    const currentComponentCount = componentRefs.current.size;
    const currentEventListenerCount = eventListenerRefs.current.size;
    const currentIntervalCount = intervalRefs.current.size;
    const currentTimeoutCount = timeoutRefs.current.size;

    // Check for component leaks
    if (currentComponentCount > leakCount) {
      console.warn(
        `Potential component memory leak detected: ${currentComponentCount} components registered`
      );
      setLeakCount(currentComponentCount);
    }

    // Check for event listener leaks
    if (currentEventListenerCount > 50) {
      // Threshold for too many listeners
      console.warn(
        `Potential event listener leak detected: ${currentEventListenerCount} listeners registered`
      );
      toast({
        title: 'Event Listener Leak Detected',
        description: `${currentEventListenerCount} event listeners are registered`,
        variant: 'destructive',
      });
    }

    // Check for interval leaks
    if (currentIntervalCount > 10) {
      // Threshold for too many intervals
      console.warn(
        `Potential interval leak detected: ${currentIntervalCount} intervals active`
      );
      toast({
        title: 'Interval Leak Detected',
        description: `${currentIntervalCount} intervals are still active`,
        variant: 'destructive',
      });
    }

    // Check for timeout accumulation (potential leak)
    if (currentTimeoutCount > 100) {
      console.warn(
        `High timeout count detected: ${currentTimeoutCount} timeouts registered`
      );
    }

    // Check component lifecycle balance
    const { mounted, unmounted, active } = componentLifecycle;
    if (mounted > 0 && unmounted > 0) {
      const leakRatio = active / mounted;
      if (leakRatio > 0.8 && mounted > 10) {
        // 80% of components still active after significant usage
        console.warn(
          `Component lifecycle imbalance: ${active}/${mounted} components still active`
        );
        toast({
          title: 'Component Lifecycle Warning',
          description: `${active} components may not be properly unmounting`,
          variant: 'destructive',
        });
      }
    }
  }, [leakCount, componentLifecycle]);

  const getLeakStatistics = useCallback(() => {
    return {
      componentCount: componentRefs.current.size,
      eventListenerCount: eventListenerRefs.current.size,
      intervalCount: intervalRefs.current.size,
      timeoutCount: timeoutRefs.current.size,
      componentLifecycle,
      leakCount,
    };
  }, [componentLifecycle, leakCount]);

  useEffect(() => {
    const interval = setInterval(checkForLeaks, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [checkForLeaks]);

  return {
    registerComponent,
    unregisterComponent,
    registerEventListener,
    unregisterEventListener,
    registerInterval,
    unregisterInterval,
    registerTimeout,
    unregisterTimeout,
    leakCount,
    eventListenerCount,
    intervalCount,
    componentLifecycle,
    getLeakStatistics,
    checkForLeaks,
  };
};
