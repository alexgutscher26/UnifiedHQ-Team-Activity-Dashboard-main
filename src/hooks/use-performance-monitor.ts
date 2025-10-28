/**
 * Performance monitoring hooks and utilities for activity feeds
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

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
}

export interface PerformanceConfig {
  enableMemoryMonitoring?: boolean;
  enableFPSMonitoring?: boolean;
  enableScrollMonitoring?: boolean;
  sampleRate?: number; // 0-1, how often to sample
}

/**
 * Hook for monitoring component performance
 */
export const usePerformanceMonitor = (config: PerformanceConfig = {}) => {
  const {
    enableMemoryMonitoring = true,
    enableFPSMonitoring = false,
    enableScrollMonitoring = true,
    sampleRate = 0.1,
  } = config;

  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    itemCount: 0,
    lastUpdate: new Date(),
  });

  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const scrollEventsRef = useRef(0);
  const scrollTimesRef = useRef<number[]>([]);

  const measureRender = useCallback(
    (itemCount: number, renderTime: number) => {
      const newMetrics: PerformanceMetrics = {
        renderTime,
        itemCount,
        lastUpdate: new Date(),
      };

      // Memory monitoring
      if (enableMemoryMonitoring && 'memory' in performance) {
        const memory = (performance as any).memory;
        if (memory) {
          newMetrics.memoryUsage = memory.usedJSHeapSize / 1024 / 1024; // MB
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
    [enableMemoryMonitoring, enableFPSMonitoring, enableScrollMonitoring]
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

  return { metrics, measureRender, recordScrollEvent, resetMetrics };
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
 * Hook for virtual scrolling calculations
 */
export const useVirtualScroll = (
  itemCount: number,
  itemHeight: number,
  containerHeight: number,
  overscan: number = 5
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
 * Memory leak detection
 */
export const useMemoryLeakDetection = () => {
  const [leakCount, setLeakCount] = useState(0);
  const componentRefs = useRef(new Set<string>());

  const registerComponent = useCallback((componentName: string) => {
    componentRefs.current.add(componentName);
  }, []);

  const unregisterComponent = useCallback((componentName: string) => {
    componentRefs.current.delete(componentName);
  }, []);

  const checkForLeaks = useCallback(() => {
    const currentCount = componentRefs.current.size;
    if (currentCount > leakCount) {
      console.warn(
        `Potential memory leak detected: ${currentCount} components registered`
      );
      setLeakCount(currentCount);
    }
  }, [leakCount]);

  useEffect(() => {
    const interval = setInterval(checkForLeaks, 5000);
    return () => clearInterval(interval);
  }, [checkForLeaks]);

  return { registerComponent, unregisterComponent, leakCount };
};
