'use client';

import React from 'react';
import { withMemoryLeakPrevention } from '@/lib/memory-leak-prevention';

// Higher-order component for automatic memory leak prevention
export function withMemoryLeakPreventionHOC<P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
) {
  return withMemoryLeakPrevention(Component, componentName);
}

// Hook for components that need manual cleanup
export function useCleanupEffect(
  cleanup: () => void,
  deps: React.DependencyList = []
) {
  React.useEffect(() => {
    return cleanup;
  }, deps);
}

// Hook for safe async operations with cleanup
export function useSafeAsyncEffect<T>(
  asyncFn: () => Promise<T>,
  cleanup?: (result: T) => void,
  deps: React.DependencyList = []
) {
  const isMountedRef = React.useRef(true);

  React.useEffect(() => {
    isMountedRef.current = true;

    const execute = async () => {
      try {
        const result = await asyncFn();
        if (isMountedRef.current && cleanup) {
          cleanup(result);
        }
      } catch (error) {
        if (isMountedRef.current) {
          console.error('Async effect error:', error);
        }
      }
    };

    execute();

    return () => {
      isMountedRef.current = false;
    };
  }, deps);
}

// Hook for safe intervals
export function useSafeInterval(callback: () => void, delay: number | null) {
  const savedCallback = React.useRef(callback);

  React.useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  React.useEffect(() => {
    if (delay === null) return;

    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

// Hook for safe timeouts
export function useSafeTimeout(callback: () => void, delay: number | null) {
  const savedCallback = React.useRef(callback);

  React.useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  React.useEffect(() => {
    if (delay === null) return;

    const id = setTimeout(() => savedCallback.current(), delay);
    return () => clearTimeout(id);
  }, [delay]);
}

// Hook for safe event listeners
export function useSafeEventListener<K extends keyof WindowEventMap>(
  eventName: K,
  handler: (event: WindowEventMap[K]) => void,
  element: Element | Window | null = null
) {
  const savedHandler = React.useRef(handler);

  React.useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  React.useEffect(() => {
    const targetElement = element || window;
    if (!targetElement || !targetElement.addEventListener) return;

    const eventListener = (event: Event) =>
      savedHandler.current(event as WindowEventMap[K]);
    targetElement.addEventListener(eventName, eventListener);

    return () => {
      targetElement.removeEventListener(eventName, eventListener);
    };
  }, [eventName, element]);
}

// Hook for safe refs that don't cause memory leaks
export function useSafeRef<T>(initialValue: T | null = null) {
  const ref = React.useRef<T | null>(initialValue);

  React.useEffect(() => {
    return () => {
      ref.current = null;
    };
  }, []);

  return ref;
}

// Hook for safe state that resets on unmount
export function useSafeState<T>(initialState: T | (() => T)) {
  const [state, setState] = React.useState(initialState);
  const isMountedRef = React.useRef(true);

  React.useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const safeSetState = React.useCallback(
    (newState: T | ((prevState: T) => T)) => {
      if (isMountedRef.current) {
        setState(newState);
      }
    },
    []
  );

  return [state, safeSetState] as const;
}
