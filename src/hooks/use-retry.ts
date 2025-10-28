/**
 * React hook for retry functionality with loading states and error handling
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { withRetry, RetryOptions, RetryResult } from '@/lib/retry-utils';

export interface UseRetryState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  attempts: number;
  totalTime: number;
  retrying: boolean;
  fromCache?: boolean;
}

export interface UseRetryReturn<T> extends UseRetryState<T> {
  execute: (...args: any[]) => Promise<T>;
  retry: () => Promise<T>;
  reset: () => void;
  updateState: (updates: Partial<UseRetryState<T>>) => void;
  isRetrying: boolean;
  canRetry: boolean;
}

/**
 * Hook for retry functionality with React state management.
 *
 * This hook manages the execution of an asynchronous function with retry capabilities. It maintains state for loading, error, and retry attempts, and allows for immediate execution on mount or re-execution based on dependencies. The function can be reset, and it handles the cleanup of state on component unmount. The retry logic is encapsulated in the `withRetry` function, which is called during execution.
 *
 * @param asyncFn - The asynchronous function to be executed with retry logic.
 * @param options - Configuration options for the retry behavior, including immediate execution, dependencies for re-execution, and whether to reset state on new execution.
 * @returns An object containing the current state, execution, retry, and reset functions, along with flags indicating retry status.
 */
export function useRetry<T = any>(
  asyncFn: (...args: any[]) => Promise<T>,
  options: RetryOptions & {
    /** Whether to execute immediately on mount */
    immediate?: boolean;
    /** Dependencies that trigger re-execution */
    deps?: React.DependencyList;
    /** Whether to reset state on new execution */
    resetOnExecute?: boolean;
  } = {}
): UseRetryReturn<T> {
  const {
    immediate = false,
    deps = [],
    resetOnExecute = true,
    ...retryOptions
  } = options;

  const [state, setState] = useState<UseRetryState<T>>({
    data: null,
    loading: false,
    error: null,
    attempts: 0,
    totalTime: 0,
    retrying: false,
  });

  const isMountedRef = useRef(true);
  const currentExecutionRef = useRef<Promise<any> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Execute immediately if requested
  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, deps);

  const updateState = useCallback((updates: Partial<UseRetryState<T>>) => {
    if (isMountedRef.current) {
      setState(prev => ({ ...prev, ...updates }));
    }
  }, []);

  const execute = useCallback(
    async (...args: any[]): Promise<T> => {
      // Cancel previous execution if still running
      if (currentExecutionRef.current) {
        // Note: We can't actually cancel the previous execution,
        // but we can ignore its result
      }

      if (resetOnExecute) {
        updateState({
          data: null,
          loading: true,
          error: null,
          attempts: 0,
          totalTime: 0,
          retrying: false,
        });
      } else {
        updateState({ loading: true, retrying: false });
      }

      const executionPromise = withRetry(() => asyncFn(...args), {
        ...retryOptions,
        onRetry: (error, attempt, delay) => {
          updateState({ retrying: true, attempts: attempt });
          retryOptions.onRetry?.(error, attempt, delay);
        },
        onMaxRetriesExceeded: (error, attempts) => {
          updateState({ retrying: false });
          retryOptions.onMaxRetriesExceeded?.(error, attempts);
        },
      });

      currentExecutionRef.current = executionPromise;

      try {
        const result: RetryResult<T> = await executionPromise;

        if (currentExecutionRef.current === executionPromise) {
          updateState({
            data: result.data,
            loading: false,
            error: null,
            attempts: result.attempts,
            totalTime: result.totalTime,
            retrying: false,
            fromCache: result.fromCache,
          });
        }

        return result.data;
      } catch (error) {
        if (currentExecutionRef.current === executionPromise) {
          updateState({
            loading: false,
            error: error instanceof Error ? error : new Error(String(error)),
            retrying: false,
          });
        }
        throw error;
      }
    },
    [asyncFn, retryOptions, resetOnExecute, updateState]
  );

  const retry = useCallback(async (): Promise<T> => {
    if (!state.error) {
      throw new Error('No error to retry');
    }
    return execute();
  }, [execute, state.error]);

  const reset = useCallback(() => {
    updateState({
      data: null,
      loading: false,
      error: null,
      attempts: 0,
      totalTime: 0,
      retrying: false,
    });
  }, [updateState]);

  return {
    ...state,
    execute,
    retry,
    reset,
    updateState,
    isRetrying: state.retrying,
    canRetry: !!state.error && !state.loading,
  };
}

/**
 * Hook for retry with automatic retry on mount
 */
export function useRetryOnMount<T = any>(
  asyncFn: () => Promise<T>,
  options: RetryOptions = {}
): UseRetryReturn<T> {
  return useRetry(asyncFn, { ...options, immediate: true });
}

/**
 * Executes a retryable asynchronous function with dependency tracking.
 */
export function useRetryWithDeps<T = any>(
  asyncFn: (...args: any[]) => Promise<T>,
  deps: React.DependencyList,
  options: RetryOptions = {}
): UseRetryReturn<T> {
  return useRetry(asyncFn, { ...options, deps, immediate: true });
}

/**
 * Hook for retrying an asynchronous function with manual execution only.
 */
export function useRetryManual<T = any>(
  asyncFn: (...args: any[]) => Promise<T>,
  options: RetryOptions = {}
): UseRetryReturn<T> {
  return useRetry(asyncFn, { ...options, immediate: false });
}

/**
 * Hook for retrying an asynchronous function with optimistic updates.
 */
export function useRetryOptimistic<T = any>(
  asyncFn: (...args: any[]) => Promise<T>,
  options: RetryOptions & {
    /** Initial optimistic data */
    optimisticData?: T;
    /** Whether to show optimistic data immediately */
    showOptimistic?: boolean;
  } = {}
): UseRetryReturn<T> {
  const { optimisticData, showOptimistic = true, ...retryOptions } = options;

  const retryHook = useRetry(asyncFn, retryOptions);

  const executeOptimistic = useCallback(
    async (...args: any[]): Promise<T> => {
      if (showOptimistic && optimisticData) {
        retryHook.updateState?.({ data: optimisticData });
      }
      return retryHook.execute(...args);
    },
    [retryHook, optimisticData, showOptimistic]
  );

  return {
    ...retryHook,
    execute: executeOptimistic,
  };
}

/**
 * Hook for retry with polling
 */
export function useRetryPolling<T = any>(
  asyncFn: () => Promise<T>,
  options: RetryOptions & {
    /** Polling interval in milliseconds */
    interval?: number;
    /** Whether to start polling immediately */
    startImmediately?: boolean;
    /** Whether to stop polling on error */
    stopOnError?: boolean;
  } = {}
): UseRetryReturn<T> & {
  startPolling: () => void;
  stopPolling: () => void;
  isPolling: boolean;
} {
  const {
    interval = 5000,
    startImmediately = false,
    stopOnError = true,
    ...retryOptions
  } = options;

  const retryHook = useRetry(asyncFn, retryOptions);
  const [isPolling, setIsPolling] = useState(startImmediately);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startPolling = useCallback(() => {
    if (intervalRef.current) return;

    setIsPolling(true);
    intervalRef.current = setInterval(() => {
      retryHook.execute().catch(error => {
        if (stopOnError) {
          stopPolling();
        }
      });
    }, interval);
  }, [retryHook, interval, stopOnError]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  // Start polling on mount if requested
  useEffect(() => {
    if (startImmediately) {
      startPolling();
    }

    return () => {
      stopPolling();
    };
  }, [startImmediately, startPolling, stopPolling]);

  return {
    ...retryHook,
    startPolling,
    stopPolling,
    isPolling,
  };
}

/**
 * Hook for retrying an asynchronous function with exponential backoff.
 *
 * This function utilizes a retry mechanism to handle user-initiated retries of an asynchronous function,
 * implementing an exponential backoff strategy for delays between retries. It manages the backoff delay state
 * and resets it upon successful execution of the function. The retry logic is encapsulated in the `retryHook`,
 * which is derived from the `useRetry` function.
 *
 * @param asyncFn - The asynchronous function to be retried.
 * @param options - Configuration options for the retry mechanism.
 */
export function useRetryWithBackoff<T = any>(
  asyncFn: (...args: any[]) => Promise<T>,
  options: RetryOptions = {}
): UseRetryReturn<T> & {
  retryWithBackoff: () => Promise<T>;
  backoffDelay: number;
} {
  const retryHook = useRetry(asyncFn, options);
  const [backoffDelay, setBackoffDelay] = useState(0);

  const retryWithBackoff = useCallback(async (): Promise<T> => {
    if (backoffDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }

    const result = await retryHook.retry();

    // Increase backoff delay for next retry
    setBackoffDelay(prev => Math.min(prev * 2, 30000)); // Max 30 seconds

    return result;
  }, [retryHook, backoffDelay]);

  // Reset backoff delay on successful execution
  useEffect(() => {
    if (retryHook.data && !retryHook.error) {
      setBackoffDelay(0);
    }
  }, [retryHook.data, retryHook.error]);

  return {
    ...retryHook,
    retryWithBackoff,
    backoffDelay,
  };
}
