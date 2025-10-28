/**
 * Retry utilities for handling failed requests with exponential backoff and jitter
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay in milliseconds (default: 1000) */
  initialDelay?: number;
  /** Maximum delay in milliseconds (default: 30000) */
  maxDelay?: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;
  /** Add random jitter to prevent thundering herd (default: true) */
  jitter?: boolean;
  /** Custom retry condition function */
  shouldRetry?: (error: any, attempt: number) => boolean;
  /** Custom delay function */
  getDelay?: (attempt: number, baseDelay: number) => number;
  /** Timeout for each attempt in milliseconds */
  timeout?: number;
  /** Whether to retry on network errors (default: true) */
  retryOnNetworkError?: boolean;
  /** Whether to retry on 5xx errors (default: true) */
  retryOnServerError?: boolean;
  /** Whether to retry on 429 rate limit errors (default: true) */
  retryOnRateLimit?: boolean;
  /** Custom error handler for each retry attempt */
  onRetry?: (error: any, attempt: number, delay: number) => void;
  /** Callback when all retries are exhausted */
  onMaxRetriesExceeded?: (error: any, attempts: number) => void;
}

export interface RetryResult<T> {
  data: T;
  attempts: number;
  totalTime: number;
  fromCache?: boolean;
}

export class RetryError extends Error {
  constructor(
    message: string,
    public originalError: any,
    public attempts: number,
    public totalTime: number
  ) {
    super(message);
    this.name = 'RetryError';
  }
}

/**
 * Default retry condition - retry on network errors, 5xx, and 429
 */
export function defaultShouldRetry(error: any, attempt: number): boolean {
  // Don't retry if we've exhausted attempts
  if (attempt <= 0) return false;

  // Network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }

  // HTTP errors
  if (error.status || error.statusCode) {
    const status = error.status || error.statusCode;

    // 5xx server errors
    if (status >= 500 && status < 600) {
      return true;
    }

    // 429 rate limit
    if (status === 429) {
      return true;
    }

    // 408 timeout
    if (status === 408) {
      return true;
    }

    // 502, 503, 504 gateway errors
    if ([502, 503, 504].includes(status)) {
      return true;
    }
  }

  // Timeout errors
  if (error.name === 'TimeoutError' || error.message?.includes('timeout')) {
    return true;
  }

  // AbortError (network interruption)
  if (error.name === 'AbortError') {
    return true;
  }

  return false;
}

/**
 * Calculate delay with exponential backoff and optional jitter
 */
export function calculateDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
  multiplier: number,
  jitter: boolean
): number {
  const exponentialDelay = baseDelay * Math.pow(multiplier, attempt - 1);
  const delay = Math.min(exponentialDelay, maxDelay);

  if (jitter) {
    // Add random jitter (±25% of the delay)
    const jitterAmount = delay * 0.25;
    const jitterOffset = (Math.random() - 0.5) * 2 * jitterAmount;
    return Math.max(0, delay + jitterOffset);
  }

  return delay;
}

/**
 * Sleep utility for delays
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a timeout promise that rejects after specified time
 */
export function createTimeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Operation timed out after ${ms}ms`));
    }, ms);
  });
}

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
    jitter = true,
    shouldRetry = defaultShouldRetry,
    getDelay,
    timeout,
    onRetry,
    onMaxRetriesExceeded,
  } = options;

  const startTime = Date.now();
  let lastError: any;
  let attempts = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    attempts = attempt + 1;

    try {
      // Create timeout promise if specified
      const timeoutPromise = timeout ? createTimeout(timeout) : null;

      // Execute the function with optional timeout
      const result = timeoutPromise
        ? await Promise.race([fn(), timeoutPromise])
        : await fn();

      return {
        data: result,
        attempts,
        totalTime: Date.now() - startTime,
      };
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (attempt === maxRetries || !shouldRetry(error, maxRetries - attempt)) {
        break;
      }

      // Calculate delay
      const delay = getDelay
        ? getDelay(attempt, initialDelay)
        : calculateDelay(
            attempt,
            initialDelay,
            maxDelay,
            backoffMultiplier,
            jitter
          );

      // Call retry callback
      if (onRetry) {
        onRetry(error, attempts, delay);
      }

      // Wait before retrying
      await sleep(delay);
    }
  }

  // All retries exhausted
  if (onMaxRetriesExceeded) {
    onMaxRetriesExceeded(lastError, attempts);
  }

  throw new RetryError(
    `Operation failed after ${attempts} attempts: ${lastError?.message || 'Unknown error'}`,
    lastError,
    attempts,
    Date.now() - startTime
  );
}

/**
 * Retry a fetch request with proper error handling
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<Response> {
  return withRetry(async () => {
    const response = await fetch(url, options);

    // Check for HTTP errors
    if (!response.ok) {
      const error = new Error(
        `HTTP ${response.status}: ${response.statusText}`
      );
      (error as any).status = response.status;
      (error as any).response = response;
      throw error;
    }

    return response;
  }, retryOptions).then(result => result.data);
}

/**
 * Retry configuration presets for common scenarios
 */
export const RetryPresets = {
  /** Quick retry for UI interactions (1-2 retries, short delays) */
  quick: {
    maxRetries: 2,
    initialDelay: 500,
    maxDelay: 2000,
    backoffMultiplier: 2,
    jitter: true,
  },

  /** Standard retry for API calls (3 retries, moderate delays) */
  standard: {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    jitter: true,
  },

  /** Aggressive retry for critical operations (5 retries, longer delays) */
  aggressive: {
    maxRetries: 5,
    initialDelay: 2000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    jitter: true,
  },

  /** GitHub API retry with rate limit handling */
  github: {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 60000, // 1 minute max for rate limits
    backoffMultiplier: 2,
    jitter: true,
    shouldRetry: (error: any) => {
      // Retry on rate limits and server errors
      if (error.status === 403 && error.message?.includes('rate limit')) {
        return true;
      }
      if (error.status >= 500) {
        return true;
      }
      return defaultShouldRetry(error, 1);
    },
    onRetry: (error: any, attempt: number, delay: number) => {
      if (error.status === 403) {
        console.warn(
          `GitHub rate limit hit, retrying in ${delay}ms (attempt ${attempt})`
        );
      }
    },
  },

  /** OpenRouter API retry with cost consideration */
  openrouter: {
    maxRetries: 2, // Lower retries due to cost
    initialDelay: 2000,
    maxDelay: 15000,
    backoffMultiplier: 2,
    jitter: true,
    shouldRetry: (error: any) => {
      // Only retry on server errors, not client errors (4xx)
      return error.status >= 500 || error.status === 429;
    },
  },
} as const;

/**
 * Utility to create retry options from a preset
 */
export function createRetryOptions(
  preset: keyof typeof RetryPresets,
  overrides: Partial<RetryOptions> = {}
): RetryOptions {
  return {
    ...RetryPresets[preset],
    ...overrides,
  };
}

/**
 * Retry with circuit breaker pattern
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private threshold: number = 5,
    private timeout: number = 60000, // 1 minute
    private resetTimeout: number = 30000 // 30 seconds
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
    }
  }

  getState() {
    return this.state;
  }

  reset() {
    this.failures = 0;
    this.state = 'CLOSED';
    this.lastFailureTime = 0;
  }
}
