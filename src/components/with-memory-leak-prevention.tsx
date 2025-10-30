'use client';

import React from 'react';
import { withMemoryLeakPrevention } from '@/lib/memory-leak-prevention';

// Higher-order component for automatic memory leak prevention
/**
 * Higher-order component that prevents memory leaks for the given React component.
 */
export function withMemoryLeakPreventionHOC<P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
) {
  return withMemoryLeakPrevention(Component, componentName);
}

// Hook for components that need manual cleanup
/**
 * Executes a cleanup function when the component unmounts or dependencies change.
 */
export function useCleanupEffect(
  cleanup: () => void,
  deps: React.DependencyList = []
) {
  React.useEffect(() => {
    return cleanup;
  }, deps);
}

// Hook for safe async operations with cleanup
/**
 * Executes an asynchronous function safely within a React effect.
 *
 * This hook ensures that the asynchronous function is only executed while the component is mounted.
 * It also provides an optional cleanup function that is called with the result of the async function,
 * if the component is still mounted when the promise resolves. Errors during execution are logged
 * to the console if the component is still mounted.
 *
 * @param asyncFn - The asynchronous function to execute.
 * @param cleanup - An optional cleanup function that receives the result of asyncFn.
 * @param deps - An array of dependencies that determine when the effect should re-run.
 */
export function useSafeAsyncEffect<T>(
  asyncFn: () => Promise<T>,
  cleanup?: (result: T) => void,
  deps: React.DependencyList = []
) {
  const isMountedRef = React.useRef(true);

  React.useEffect(() => {
    isMountedRef.current = true;

    /**
     * Executes an asynchronous function and handles the result or any errors.
     *
     * The function calls asyncFn and awaits its result. If the component is still mounted and a cleanup function is provided, it invokes the cleanup function with the result. In case of an error during the async operation, it logs the error to the console if the component remains mounted.
     */
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
/**
 * Sets a safe timeout that updates the callback when it changes.
 */
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
/**
 * Attaches a safe event listener to a specified element or the window.
 *
 * This function uses React hooks to ensure that the latest event handler is used when the event is triggered. It sets up an event listener on the provided element or the window if no element is specified. The listener is cleaned up when the component unmounts or when the event name or element changes.
 *
 * @param eventName - The name of the event to listen for.
 * @param handler - The function to call when the event is triggered.
 * @param element - The element to attach the event listener to, defaults to the window.
 */
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

    /**
     * Handles the event by invoking the saved handler.
     */
    const eventListener = (event: Event) =>
      savedHandler.current(event as WindowEventMap[K]);
    targetElement.addEventListener(eventName, eventListener);

    return () => {
      targetElement.removeEventListener(eventName, eventListener);
    };
  }, [eventName, element]);
}

// Hook for safe refs that don't cause memory leaks
/**
 * Creates a safe reference that resets to null on unmount.
 */
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
/**
 * A custom hook that provides a safe way to update state in a React component.
 */
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
/**
 * Manages a safe EventSource connection with automatic cleanup.
 *
 * This hook initializes an EventSource connection based on the provided URL and options. It handles connection states ('connecting', 'open', 'closed') and errors, updating the state accordingly. The hook also provides methods to add event listeners and close the connection, ensuring proper cleanup when the component unmounts or the URL changes.
 *
 * @param {string | null} url - The URL to connect to for the EventSource. If null, the connection will be closed.
 * @param {EventSourceInit} [options] - Optional configuration for the EventSource.
 */
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
/**
 * Manages a WebSocket connection with automatic state handling.
 *
 * This hook initializes a WebSocket connection based on the provided URL and protocols. It manages the connection state, error handling, and provides methods to send data and close the connection. The connection is cleaned up when the component unmounts or when the URL changes, ensuring proper resource management.
 *
 * @param {string | null} url - The WebSocket server URL. If null, the connection will be closed.
 * @param {string | string[]} [protocols] - Optional subprotocols for the WebSocket connection.
 */
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
/**
 * Manages a safe subscription to a value from a manager.
 */
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
