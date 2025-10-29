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

// Hook for safe EventSource connections
export function useSafeEventSource(
  url: string | null,
  options?: EventSourceInit
) {
  const [eventSource, setEventSource] = React.useState<EventSource | null>(
    null
  );
  const [connectionState, setConnectionState] = React.useState<
    'connecting' | 'open' | 'closed'
  >('closed');
  const [error, setError] = React.useState<Event | null>(null);
  const cleanupRef = React.useRef<(() => void) | null>(null);

  React.useEffect(() => {
    if (!url) {
      setEventSource(null);
      setConnectionState('closed');
      return;
    }

    const es = new EventSource(url, options);
    setEventSource(es);
    setConnectionState('connecting');

    es.onopen = () => {
      setConnectionState('open');
      setError(null);
    };

    es.onerror = event => {
      setError(event);
      setConnectionState('closed');
    };

    cleanupRef.current = () => {
      if (es.readyState !== EventSource.CLOSED) {
        es.close();
      }
    };

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      setEventSource(null);
      setConnectionState('closed');
    };
  }, [url, options]);

  const addEventListener = React.useCallback(
    (type: string, listener: (event: MessageEvent) => void) => {
      if (!eventSource) return () => {};

      eventSource.addEventListener(type, listener);
      return () => {
        if (eventSource) {
          eventSource.removeEventListener(type, listener);
        }
      };
    },
    [eventSource]
  );

  const close = React.useCallback(() => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    setConnectionState('closed');
  }, []);

  return {
    eventSource,
    connectionState,
    error,
    addEventListener,
    close,
  };
}

// Hook for safe WebSocket connections
export function useSafeWebSocket(
  url: string | null,
  protocols?: string | string[]
) {
  const [webSocket, setWebSocket] = React.useState<WebSocket | null>(null);
  const [connectionState, setConnectionState] = React.useState<
    'connecting' | 'open' | 'closing' | 'closed'
  >('closed');
  const [error, setError] = React.useState<Event | null>(null);
  const cleanupRef = React.useRef<(() => void) | null>(null);

  React.useEffect(() => {
    if (!url) {
      setWebSocket(null);
      setConnectionState('closed');
      return;
    }

    const ws = new WebSocket(url, protocols);
    setWebSocket(ws);
    setConnectionState('connecting');

    ws.onopen = () => {
      setConnectionState('open');
      setError(null);
    };

    ws.onclose = () => {
      setConnectionState('closed');
    };

    ws.onerror = event => {
      setError(event);
    };

    cleanupRef.current = () => {
      if (
        ws.readyState === WebSocket.OPEN ||
        ws.readyState === WebSocket.CONNECTING
      ) {
        ws.close();
      }
    };

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      setWebSocket(null);
      setConnectionState('closed');
    };
  }, [url, protocols]);

  const send = React.useCallback(
    (data: string | ArrayBufferLike | Blob | ArrayBufferView) => {
      if (webSocket && webSocket.readyState === WebSocket.OPEN) {
        webSocket.send(data);
      }
    },
    [webSocket]
  );

  const close = React.useCallback((code?: number, reason?: string) => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    setConnectionState('closing');
  }, []);

  return {
    webSocket,
    connectionState,
    error,
    send,
    close,
  };
}

// Hook for safe subscription patterns (like auth client subscriptions)
export function useSafeSubscription<T>(
  manager: { subscribe: (listener: (value: T) => void) => () => void },
  initialValue?: T
) {
  const [value, setValue] = React.useState<T | undefined>(initialValue);
  const unsubscribeRef = React.useRef<(() => void) | null>(null);

  React.useEffect(() => {
    const unsubscribe = manager.subscribe(newValue => {
      setValue(newValue);
    });

    unsubscribeRef.current = unsubscribe;

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [manager]);

  return value;
}
