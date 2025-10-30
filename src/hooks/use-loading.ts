import { useState, useCallback } from 'react';

interface UseLoadingOptions {
  initialLoading?: boolean;
  onError?: (error: Error) => void;
}

interface UseLoadingReturn {
  loading: boolean;
  error: string | null;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  execute: <T>(asyncFn: () => Promise<T>) => Promise<T | null>;
  reset: () => void;
}

/**
 * Custom hook for managing loading states with error handling.
 *
 * This hook provides a way to manage loading states and handle errors during asynchronous operations. It initializes loading and error states based on the provided options. The `execute` function allows for executing an asynchronous function while managing the loading state and capturing any errors that occur. The `reset` function can be used to clear the loading and error states.
 *
 * @param {UseLoadingOptions} [options={}] - Options to configure the loading state and error handling.
 */
export function useLoading(options: UseLoadingOptions = {}): UseLoadingReturn {
  const { initialLoading = false, onError } = options;

  const [loading, setLoading] = useState(initialLoading);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async <T>(asyncFn: () => Promise<T>): Promise<T | null> => {
      setLoading(true);
      setError(null);

      try {
        const result = await asyncFn();
        return result;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'An error occurred';
        setError(errorMessage);

        if (onError && err instanceof Error) {
          onError(err);
        }

        return null;
      } finally {
        setLoading(false);
      }
    },
    [onError]
  );

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
  }, []);

  return {
    loading,
    error,
    setLoading,
    setError,
    execute,
    reset,
  };
}

/**
 * Hook for managing multiple loading states.
 *
 * This hook initializes a loading state for each key provided in the `keys` array, allowing for individual loading management.
 * It provides functions to set the loading state for a specific key, check if a specific key is loading, determine if any keys are loading,
 * and reset all loading states to false. The loading states are stored in a record, and updates are handled immutably.
 *
 * @param {string[]} keys - An array of keys representing the loading states to manage.
 */
export function useMultipleLoading(keys: string[]) {
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>(
    keys.reduce((acc, key) => ({ ...acc, [key]: false }), {})
  );

  const setLoading = useCallback((key: string, loading: boolean) => {
    setLoadingStates(prev => ({ ...prev, [key]: loading }));
  }, []);

  const isLoading = useCallback(
    (key: string) => {
      return loadingStates[key] || false;
    },
    [loadingStates]
  );

  const isAnyLoading = Object.values(loadingStates).some(Boolean);

  const resetAll = useCallback(() => {
    setLoadingStates(keys.reduce((acc, key) => ({ ...acc, [key]: false }), {}));
  }, [keys]);

  return {
    setLoading,
    isLoading,
    isAnyLoading,
    resetAll,
    loadingStates,
  };
}

/**
 * Hook for managing async operations with loading and error states.
 *
 * This hook provides a way to execute asynchronous functions while managing their loading and error states.
 * It maintains the current data, loading status, and any error messages. The `execute` function runs the provided
 * asynchronous function and updates the state accordingly, while the `reset` function clears the current state.
 */
export function useAsyncOperation<T>() {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (asyncFn: () => Promise<T>) => {
    setLoading(true);
    setError(null);

    try {
      const result = await asyncFn();
      setData(result);
      return result;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    data,
    loading,
    error,
    execute,
    reset,
    setData,
    setError,
    setLoading,
  };
}
