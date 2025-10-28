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
 * Custom hook for managing loading states with error handling
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
 * Hook for managing multiple loading states
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
 * Hook for managing async operations with loading and error states
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
