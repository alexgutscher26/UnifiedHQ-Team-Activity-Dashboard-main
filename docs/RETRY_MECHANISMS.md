# Retry Mechanisms Documentation

This document describes the comprehensive retry mechanism system implemented in the application to handle failed requests with exponential backoff, jitter, and circuit breaker patterns.

## Overview

The retry system provides:
- **Exponential backoff** with configurable jitter
- **Circuit breaker pattern** for preventing cascading failures
- **React hooks** for easy integration with components
- **Pre-configured presets** for common scenarios
- **Comprehensive error handling** and logging
- **UI components** for retry feedback

## Core Components

### 1. Retry Utilities (`src/lib/retry-utils.ts`)

The core retry functionality with exponential backoff and jitter.

#### Key Features:
- Configurable retry attempts, delays, and backoff multipliers
- Random jitter to prevent thundering herd problems
- Custom retry conditions and delay functions
- Timeout support for each attempt
- Comprehensive error handling

#### Usage:
```typescript
import { withRetry, RetryPresets } from '@/lib/retry-utils';

const result = await withRetry(
  async () => {
    const response = await fetch('/api/data');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  },
  RetryPresets.standard
);
```

#### Retry Presets:
- `quick`: 2 retries, short delays (500ms-2s)
- `standard`: 3 retries, moderate delays (1s-10s)
- `aggressive`: 5 retries, longer delays (2s-30s)
- `github`: Optimized for GitHub API with rate limit handling
- `openrouter`: Cost-conscious retry for LLM API calls

### 2. React Hooks (`src/hooks/use-retry.ts`)

React hooks for integrating retry functionality with components.

#### Available Hooks:

##### `useRetry<T>(asyncFn, options)`
Basic retry hook with manual execution.

```typescript
const retryHook = useRetry(fetchData, {
  ...RetryPresets.standard,
  onRetry: (error, attempt, delay) => {
    console.log(`Retrying in ${delay}ms (attempt ${attempt})`);
  }
});

// Execute manually
await retryHook.execute();
```

##### `useRetryOnMount<T>(asyncFn, options)`
Automatically executes on component mount.

```typescript
const retryHook = useRetryOnMount(() => fetchUserData(userId), {
  ...RetryPresets.quick
});
```

##### `useRetryWithDeps<T>(asyncFn, deps, options)`
Re-executes when dependencies change.

```typescript
const retryHook = useRetryWithDeps(
  () => fetchUserData(userId),
  [userId], // Re-execute when userId changes
  RetryPresets.standard
);
```

##### `useRetryPolling<T>(asyncFn, options)`
Polls data with automatic retry on failures.

```typescript
const retryHook = useRetryPolling(fetchData, {
  interval: 10000, // Poll every 10 seconds
  startImmediately: true,
  stopOnError: false
});
```

### 3. UI Components (`src/components/retry-component.tsx`)

React components for displaying retry states and handling user interactions.

#### `RetryComponent`
Main component for displaying retry states with error handling.

```typescript
<RetryComponent
  state={{
    loading: retryHook.loading,
    error: retryHook.error,
    attempts: retryHook.attempts,
    retrying: retryHook.retrying,
    canRetry: retryHook.canRetry,
  }}
  onRetry={retryHook.retry}
  onReset={retryHook.reset}
  retryText="Retry Operation"
  errorMessage="Custom error message"
  showAttempts={true}
>
  {retryHook.data && <div>Success content</div>}
</RetryComponent>
```

#### `UseRetryComponent`
Wrapper component that uses retry hook directly.

```typescript
<UseRetryComponent
  retryHook={retryHook}
  retryProps={{
    retryText: 'Load Data',
    showAttempts: true,
  }}
>
  {retryHook.data && <div>Data loaded successfully</div>}
</UseRetryComponent>
```

#### `InlineRetry`
Inline retry component for simple use cases.

```typescript
<InlineRetry
  error={error}
  loading={loading}
  onRetry={handleRetry}
  errorMessage="Failed to load data"
  retryText="Try Again"
/>
```

#### `RetryButton`
Standalone retry button component.

```typescript
<RetryButton
  onRetry={handleRetry}
  loading={isRetrying}
  disabled={!canRetry}
  variant="outline"
  size="sm"
>
  Retry
</RetryButton>
```

## Integration Examples

### 1. API Route with Retry

```typescript
// src/app/api/data/route.ts
import { withErrorHandling, RetryPresets } from '@/lib/api-error-handler';

async function getData(request: NextRequest) {
  // Your API logic here
  return NextResponse.json({ data: 'success' });
}

// Enable retry for this endpoint
export const GET = withErrorHandling(getData, {
  retry: RetryPresets.standard
});
```

### 2. Client-Side Data Fetching

```typescript
// In a React component
import { useRetry } from '@/hooks/use-retry';
import { RetryPresets } from '@/lib/retry-utils';

function DataComponent() {
  const retryHook = useRetry(
    async () => {
      const response = await fetch('/api/data');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    },
    RetryPresets.standard
  );

  return (
    <UseRetryComponent retryHook={retryHook}>
      {retryHook.data && (
        <div>
          <h2>Data Loaded</h2>
          <p>Items: {retryHook.data.length}</p>
        </div>
      )}
    </UseRetryComponent>
  );
}
```

### 3. GitHub API with Caching and Retry

```typescript
// Already integrated in GitHub cached client
const client = new CachedGitHubClient(accessToken, userId);
const repos = await client.getRepositories(); // Automatically retries on failure
```

### 4. OpenRouter LLM with Retry

```typescript
// Already integrated in OpenRouter client
const response = await generateWithOpenRouter({
  model: 'gpt-3.5-turbo',
  messages: [{ role: 'user', content: 'Hello' }]
}); // Automatically retries on failure
```

## Configuration Options

### RetryOptions Interface

```typescript
interface RetryOptions {
  maxRetries?: number;           // Default: 3
  initialDelay?: number;         // Default: 1000ms
  maxDelay?: number;             // Default: 30000ms
  backoffMultiplier?: number;    // Default: 2
  jitter?: boolean;              // Default: true
  shouldRetry?: (error, attempt) => boolean;
  getDelay?: (attempt, baseDelay) => number;
  timeout?: number;              // Timeout per attempt
  retryOnNetworkError?: boolean; // Default: true
  retryOnServerError?: boolean;  // Default: true
  retryOnRateLimit?: boolean;    // Default: true
  onRetry?: (error, attempt, delay) => void;
  onMaxRetriesExceeded?: (error, attempts) => void;
}
```

### Custom Retry Logic

```typescript
const customRetry = await withRetry(
  async () => {
    // Your operation
  },
  {
    maxRetries: 5,
    initialDelay: 2000,
    maxDelay: 60000,
    backoffMultiplier: 1.5,
    jitter: true,
    shouldRetry: (error, attempt) => {
      // Only retry on 5xx errors and rate limits
      if (error.status >= 500) return true;
      if (error.status === 429) return true;
      return false;
    },
    onRetry: (error, attempt, delay) => {
      console.log(`Retry ${attempt}: ${error.message} (delay: ${delay}ms)`);
    },
  }
);
```

## Circuit Breaker Pattern

The system includes a circuit breaker implementation to prevent cascading failures:

```typescript
import { CircuitBreaker } from '@/lib/retry-utils';

const circuitBreaker = new CircuitBreaker(5, 60000, 30000); // 5 failures, 1min timeout, 30s reset

const result = await circuitBreaker.execute(async () => {
  // Your operation
});
```

## Error Handling

### RetryError

When all retries are exhausted, a `RetryError` is thrown with additional context:

```typescript
try {
  await withRetry(operation, options);
} catch (error) {
  if (error instanceof RetryError) {
    console.log(`Failed after ${error.attempts} attempts`);
    console.log(`Total time: ${error.totalTime}ms`);
    console.log(`Original error: ${error.originalError.message}`);
  }
}
```

### Error Types Handled

The retry system automatically handles:
- Network errors (TypeError with fetch)
- HTTP 5xx server errors
- HTTP 429 rate limit errors
- HTTP 408 timeout errors
- HTTP 502, 503, 504 gateway errors
- Timeout errors
- AbortError (network interruption)

## Performance Considerations

### Memory Management
- Retry attempts are limited to prevent memory leaks
- Circuit breaker prevents excessive retry attempts
- Cache integration reduces unnecessary API calls

### Rate Limiting
- Jitter prevents thundering herd problems
- Exponential backoff respects rate limits
- GitHub-specific retry logic handles API limits

### Cost Optimization
- OpenRouter preset uses fewer retries due to cost
- Caching reduces retry frequency
- Timeout prevents hanging requests

## Monitoring and Logging

### Built-in Logging
- Retry attempts are logged with timing information
- Error context is preserved through retry chain
- Performance metrics are tracked

## Best Practices

### 1. Choose Appropriate Presets
- Use `quick` for UI interactions
- Use `standard` for most API calls
- Use `aggressive` for critical operations
- Use service-specific presets when available

### 2. Handle Retry States in UI
- Show loading states during retries
- Display attempt counts for transparency
- Provide manual retry options
- Handle success and error states appropriately

### 3. Monitor Retry Performance
- Track retry success rates
- Monitor retry delays and backoff
- Alert on high retry failure rates
- Optimize retry configurations based on data

### 4. Consider Circuit Breakers
- Use circuit breakers for external services
- Implement fallback mechanisms
- Monitor circuit breaker states
- Reset circuit breakers appropriately

## Troubleshooting

### Common Issues

1. **High Retry Failure Rates**
   - Check if errors are retryable
   - Adjust retry conditions
   - Consider circuit breaker implementation

2. **Long Retry Delays**
   - Reduce maxDelay setting
   - Adjust backoffMultiplier
   - Consider using quick preset for UI operations

3. **Memory Issues**
   - Ensure retry attempts are limited
   - Check for memory leaks in retry callbacks
   - Monitor circuit breaker state

4. **Rate Limit Issues**
   - Use appropriate jitter settings
   - Consider service-specific retry logic
   - Implement proper backoff strategies

### Debug Information

Enable debug logging to troubleshoot retry issues:

```typescript
const retryHook = useRetry(operation, {
  onRetry: (error, attempt, delay) => {
    console.log(`[DEBUG] Retry ${attempt}: ${error.message} (delay: ${delay}ms)`);
  },
  onMaxRetriesExceeded: (error, attempts) => {
    console.error(`[DEBUG] Max retries exceeded after ${attempts} attempts:`, error);
  },
});
```

## Migration Guide

### From Manual Retry Logic

1. Replace manual retry loops with `withRetry` utility
2. Use retry presets instead of custom configurations
3. Replace manual error handling with retry error handling
4. Update UI to use retry components

### From Basic Error Handling

1. Wrap API calls with retry utilities
2. Add retry hooks to React components
3. Implement retry UI components
4. Configure appropriate retry presets

## Future Enhancements

- Redis-based distributed retry coordination
- Machine learning-based retry optimization
- Advanced circuit breaker patterns
- Retry analytics and insights
- A/B testing for retry configurations
