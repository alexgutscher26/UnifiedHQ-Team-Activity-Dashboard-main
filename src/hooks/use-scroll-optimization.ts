/**
 * Scroll throttling and optimization utilities
 */

import { useCallback, useRef, useEffect, useState } from 'react';

export interface ScrollThrottleConfig {
  throttleMs?: number;
  passive?: boolean;
  capture?: boolean;
}

export interface ScrollOptimizationConfig {
  enableThrottling?: boolean;
  enablePassiveListeners?: boolean;
  enableRAF?: boolean;
  enableDebouncing?: boolean;
  debounceMs?: number;
}

/**
 * Hook for throttled scroll handling
 */
export const useScrollThrottle = (
  callback: (event: Event) => void,
  config: ScrollThrottleConfig = {}
) => {
  const {
    throttleMs = 16, // ~60fps
    passive = true,
    capture = false,
  } = config;

  const lastCallRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const throttledCallback = useCallback(
    (event: Event) => {
      const now = Date.now();
      const timeSinceLastCall = now - lastCallRef.current;

      if (timeSinceLastCall >= throttleMs) {
        lastCallRef.current = now;
        callback(event);
      } else {
        // Clear any pending timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        // Schedule the callback for the remaining time
        timeoutRef.current = setTimeout(() => {
          lastCallRef.current = Date.now();
          callback(event);
        }, throttleMs - timeSinceLastCall);
      }
    },
    [callback, throttleMs]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return throttledCallback;
};

/**
 * Hook for debounced scroll handling
 */
export const useScrollDebounce = (
  callback: (event: Event) => void,
  delay: number = 100
) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedCallback = useCallback(
    (event: Event) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(event);
      }, delay);
    },
    [callback, delay]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
};

/**
 * Hook for RequestAnimationFrame optimized scroll handling
 */
export const useScrollRAF = (callback: (event: Event) => void) => {
  const rafRef = useRef<number | null>(null);
  const lastEventRef = useRef<Event | null>(null);

  const rafCallback = useCallback(
    (event: Event) => {
      lastEventRef.current = event;

      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => {
          if (lastEventRef.current) {
            callback(lastEventRef.current);
          }
          rafRef.current = null;
        });
      }
    },
    [callback]
  );

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return rafCallback;
};

/**
 * Hook for optimized scroll event handling with multiple strategies
 */
export const useOptimizedScroll = (
  callback: (event: Event) => void,
  config: ScrollOptimizationConfig = {}
) => {
  const {
    enableThrottling = true,
    enablePassiveListeners = true,
    enableRAF = true,
    enableDebouncing = false,
    debounceMs = 100,
  } = config;

  // Create optimized callback based on configuration
  // Always call hooks unconditionally to follow rules of hooks
  const rafCallback = useScrollRAF(callback);
  const throttledCallback = useScrollThrottle(callback, {
    throttleMs: 16, // 60fps
    passive: enablePassiveListeners,
  });
  const debouncedCallback = useScrollDebounce(callback, debounceMs);

  // Apply optimizations based on configuration
  let optimizedCallback = callback;

  if (enableRAF) {
    optimizedCallback = rafCallback;
  }

  if (enableThrottling) {
    optimizedCallback = throttledCallback;
  }

  if (enableDebouncing) {
    optimizedCallback = debouncedCallback;
  }

  return optimizedCallback;
};

/**
 * Hook for scroll position tracking with optimization
 */
export const useScrollPosition = (config: ScrollOptimizationConfig = {}) => {
  const [scrollPosition, setScrollPosition] = useState({
    x: 0,
    y: 0,
    deltaX: 0,
    deltaY: 0,
    direction: 'none' as 'up' | 'down' | 'left' | 'right' | 'none',
  });

  const lastPositionRef = useRef({ x: 0, y: 0 });

  const handleScroll = useOptimizedScroll(
    useCallback((event: Event) => {
      const target = event.target as HTMLElement;
      const x = target.scrollLeft || window.scrollX;
      const y = target.scrollTop || window.scrollY;

      const deltaX = x - lastPositionRef.current.x;
      const deltaY = y - lastPositionRef.current.y;

      let direction: 'up' | 'down' | 'left' | 'right' | 'none' = 'none';
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        direction = deltaY > 0 ? 'down' : 'up';
      } else if (Math.abs(deltaX) > Math.abs(deltaY)) {
        direction = deltaX > 0 ? 'right' : 'left';
      }

      setScrollPosition({
        x,
        y,
        deltaX,
        deltaY,
        direction,
      });

      lastPositionRef.current = { x, y };
    }, []),
    config
  );

  return { scrollPosition, handleScroll };
};

/**
 * Hook for scroll-based visibility detection
 */
export const useScrollVisibility = (
  elementRef: React.RefObject<HTMLElement>,
  config: ScrollOptimizationConfig = {}
) => {
  const [isVisible, setIsVisible] = useState(false);
  const [visibilityRatio, setVisibilityRatio] = useState(0);

  const handleScroll = useOptimizedScroll(
    useCallback(() => {
      if (!elementRef.current) return;

      const rect = elementRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const windowWidth = window.innerWidth;

      const visibleHeight =
        Math.min(rect.bottom, windowHeight) - Math.max(rect.top, 0);
      const visibleWidth =
        Math.min(rect.right, windowWidth) - Math.max(rect.left, 0);

      const visibleArea =
        Math.max(0, visibleHeight) * Math.max(0, visibleWidth);
      const totalArea = rect.height * rect.width;

      const ratio = totalArea > 0 ? visibleArea / totalArea : 0;
      const visible = ratio > 0;

      setIsVisible(visible);
      setVisibilityRatio(ratio);
    }, [elementRef]),
    config
  );

  return { isVisible, visibilityRatio, handleScroll };
};

/**
 * Hook for scroll-based lazy loading
 */
export const useScrollLazyLoad = (
  elementRef: React.RefObject<HTMLElement>,
  threshold: number = 0.1,
  config: ScrollOptimizationConfig = {}
) => {
  const [shouldLoad, setShouldLoad] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const handleScroll = useOptimizedScroll(
    useCallback(() => {
      if (!elementRef.current || hasLoaded) return;

      const rect = elementRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      // Check if element is within threshold distance of viewport
      const isNearViewport =
        rect.top <= windowHeight * (1 + threshold) &&
        rect.bottom >= -windowHeight * threshold;

      if (isNearViewport && !shouldLoad) {
        setShouldLoad(true);
        setHasLoaded(true);
      }
    }, [elementRef, threshold, shouldLoad, hasLoaded]),
    config
  );

  return { shouldLoad, handleScroll };
};

/**
 * Hook for scroll-based performance monitoring
 */
export const useScrollPerformanceMonitor = (
  config: ScrollOptimizationConfig = {}
) => {
  const [metrics, setMetrics] = useState({
    scrollEvents: 0,
    averageScrollTime: 0,
    maxScrollTime: 0,
    scrollJank: 0, // Number of scroll events that took >16ms
  });

  const scrollTimesRef = useRef<number[]>([]);
  const lastScrollTimeRef = useRef<number>(0);

  const handleScroll = useOptimizedScroll(
    useCallback((event: Event) => {
      const now = performance.now();
      const scrollTime = now - lastScrollTimeRef.current;
      lastScrollTimeRef.current = now;

      // Track scroll times
      scrollTimesRef.current.push(scrollTime);
      if (scrollTimesRef.current.length > 100) {
        scrollTimesRef.current = scrollTimesRef.current.slice(-100);
      }

      // Calculate metrics
      const averageScrollTime =
        scrollTimesRef.current.reduce((a, b) => a + b, 0) /
        scrollTimesRef.current.length;

      const maxScrollTime = Math.max(...scrollTimesRef.current);

      const scrollJank = scrollTimesRef.current.filter(
        time => time > 16
      ).length;

      setMetrics({
        scrollEvents: scrollTimesRef.current.length,
        averageScrollTime,
        maxScrollTime,
        scrollJank,
      });
    }, []),
    config
  );

  return { metrics, handleScroll };
};

/**
 * Utility function to add optimized scroll listener
 */
export const addOptimizedScrollListener = (
  element: HTMLElement | Window,
  callback: (event: Event) => void,
  config: ScrollOptimizationConfig = {}
) => {
  const {
    enableThrottling = true,
    enablePassiveListeners = true,
    enableRAF = true,
    enableDebouncing = false,
    debounceMs = 100,
  } = config;

  let optimizedCallback = callback;

  // Apply optimizations in order
  if (enableRAF) {
    let rafId: number | null = null;
    const rafCallback = (event: Event) => {
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          optimizedCallback(event);
          rafId = null;
        });
      }
    };
    optimizedCallback = rafCallback;
  }

  if (enableThrottling) {
    let lastCall = 0;
    const throttleMs = 16; // 60fps
    const throttledCallback = (event: Event) => {
      const now = Date.now();
      if (now - lastCall >= throttleMs) {
        lastCall = now;
        optimizedCallback(event);
      }
    };
    optimizedCallback = throttledCallback;
  }

  if (enableDebouncing) {
    let timeoutId: NodeJS.Timeout | null = null;
    const debouncedCallback = (event: Event) => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => optimizedCallback(event), debounceMs);
    };
    optimizedCallback = debouncedCallback;
  }

  // Add the listener with passive option for better performance
  const options: AddEventListenerOptions = {
    passive: enablePassiveListeners,
  };

  element.addEventListener('scroll', optimizedCallback, options);

  // Return cleanup function
  return () => {
    element.removeEventListener('scroll', optimizedCallback, options);
  };
};

/**
 * Utility function to detect scroll performance issues
 */
export const detectScrollPerformanceIssues = (metrics: {
  averageScrollTime: number;
  maxScrollTime: number;
  scrollJank: number;
  scrollEvents: number;
}) => {
  const issues: string[] = [];

  if (metrics.averageScrollTime > 16) {
    issues.push('Average scroll time exceeds 16ms (60fps threshold)');
  }

  if (metrics.maxScrollTime > 50) {
    issues.push('Maximum scroll time exceeds 50ms (significant jank)');
  }

  if (metrics.scrollJank > metrics.scrollEvents * 0.1) {
    issues.push('More than 10% of scroll events are janky');
  }

  return issues;
};

/**
 * Scroll optimization presets
 */
export const scrollOptimizationPresets = {
  // For smooth scrolling with minimal performance impact
  smooth: {
    enableThrottling: true,
    enablePassiveListeners: true,
    enableRAF: true,
    enableDebouncing: false,
  },

  // For high-frequency scroll events (like virtual scrolling)
  highFrequency: {
    enableThrottling: true,
    enablePassiveListeners: true,
    enableRAF: true,
    enableDebouncing: false,
  },

  // For scroll-based animations
  animations: {
    enableThrottling: false,
    enablePassiveListeners: true,
    enableRAF: true,
    enableDebouncing: false,
  },

  // For scroll-based lazy loading
  lazyLoading: {
    enableThrottling: true,
    enablePassiveListeners: true,
    enableRAF: false,
    enableDebouncing: true,
    debounceMs: 100,
  },

  // For scroll performance monitoring
  monitoring: {
    enableThrottling: true,
    enablePassiveListeners: true,
    enableRAF: false,
    enableDebouncing: false,
  },
};
