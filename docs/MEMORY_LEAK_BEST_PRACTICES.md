# Memory Leak Prevention Best Practices

## Overview

This guide provides comprehensive best practices for preventing memory leaks in React applications. Following these patterns will help you write memory-efficient code and avoid common pitfalls that lead to memory leaks.

## Table of Contents

- [React Hooks Best Practices](#react-hooks-best-practices)
- [Event Listener Management](#event-listener-management)
- [Timer and Interval Management](#timer-and-interval-management)
- [Subscription Management](#subscription-management)
- [Connection Management](#connection-management)
- [Component Lifecycle](#component-lifecycle)
- [Third-Party Library Integration](#third-party-library-integration)
- [Performance Optimization](#performance-optimization)
- [Testing for Memory Leaks](#testing-for-memory-leaks)

## React Hooks Best Practices

### useEffect Cleanup

Always provide cleanup functions for effects that create resources:

```tsx
// ❌ Bad: No cleanup
function BadComponent() {
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('Running...');
    }, 1000);
    
    document.addEventListener('click', handleClick);
    
    const subscription = api.subscribe(handleData);
  }, []);

  return <div>Content</div>;
}

// ✅ Good: Proper cleanup
function GoodComponent() {
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('Running...');
    }, 1000);
    
    document.addEventListener('click', handleClick);
    
    const subscription = api.subscribe(handleData);

    // Cleanup function
    return () => {
      clearInterval(interval);
      document.removeEventListener('click', handleClick);
      subscription.unsubscribe();
    };
  }, []);

  return <div>Content</div>;
}
```

### Conditional Effects

Be careful with conditional effects that might skip cleanup:

```tsx
// ❌ Bad: Conditional effect without proper cleanup
function BadConditionalEffect({ shouldListen }: { shouldListen: boolean }) {
  useEffect(() => {
    if (shouldListen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    // Missing cleanup when shouldListen changes
  }, [shouldListen]);

  return <div>Content</div>;
}

// ✅ Good: Proper conditional cleanup
function GoodConditionalEffect({ shouldListen }: { shouldListen: boolean }) {
  useEffect(() => {
    if (shouldListen) {
      document.addEventListener('keydown', handleKeyDown);
      
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [shouldListen]);

  return <div>Content</div>;
}
```

### Custom Hooks with Cleanup

Create reusable hooks with proper resource management:

```tsx
// ✅ Custom hook with cleanup
function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay !== null) {
      const id = setInterval(() => savedCallback.current(), delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}

// Usage
function ComponentWithInterval() {
  const [count, setCount] = useState(0);

  useInterval(() => {
    setCount(count + 1);
  }, 1000);

  return <div>Count: {count}</div>;
}
```

## Event Listener Management

### DOM Event Listeners

Always remove event listeners when components unmount:

```tsx
// ❌ Bad: Event listener not removed
function BadEventListener() {
  useEffect(() => {
    const handleResize = () => {
      console.log('Window resized');
    };

    window.addEventListener('resize', handleResize);
    // Missing cleanup
  }, []);

  return <div>Content</div>;
}

// ✅ Good: Event listener properly removed
function GoodEventListener() {
  useEffect(() => {
    const handleResize = () => {
      console.log('Window resized');
    };

    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return <div>Content</div>;
}
```

### Multiple Event Listeners

Manage multiple event listeners efficiently:

```tsx
// ✅ Managing multiple event listeners
function MultipleEventListeners() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      console.log('Key pressed:', e.key);
    };

    const handleClick = (e: MouseEvent) => {
      console.log('Clicked at:', e.clientX, e.clientY);
    };

    const handleScroll = () => {
      console.log('Scrolled');
    };

    // Add all listeners
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('click', handleClick);
    window.addEventListener('scroll', handleScroll);

    // Remove all listeners in cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('click', handleClick);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return <div>Content</div>;
}
```

### Event Listener Hook

Create a reusable hook for event listeners:

```tsx
// ✅ Reusable event listener hook
function useEventListener<T extends keyof WindowEventMap>(
  eventName: T,
  handler: (event: WindowEventMap[T]) => void,
  element: Window | Document | HTMLElement = window
) {
  const savedHandler = useRef(handler);

  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  useEffect(() => {
    const eventListener = (event: WindowEventMap[T]) => savedHandler.current(event);
    
    element.addEventListener(eventName, eventListener as EventListener);
    
    return () => {
      element.removeEventListener(eventName, eventListener as EventListener);
    };
  }, [eventName, element]);
}

// Usage
function ComponentWithEventListener() {
  useEventListener('resize', () => {
    console.log('Window resized');
  });

  useEventListener('keydown', (e) => {
    console.log('Key pressed:', e.key);
  });

  return <div>Content</div>;
}
```

## Timer and Interval Management

### setTimeout and setInterval

Always clear timers in cleanup functions:

```tsx
// ❌ Bad: Timer not cleared
function BadTimer() {
  const [message, setMessage] = useState('');

  useEffect(() => {
    setTimeout(() => {
      setMessage('Hello after 3 seconds');
    }, 3000);
    // Timer not cleared if component unmounts
  }, []);

  return <div>{message}</div>;
}

// ✅ Good: Timer properly cleared
function GoodTimer() {
  const [message, setMessage] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setMessage('Hello after 3 seconds');
    }, 3000);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  return <div>{message}</div>;
}
```

### Interval Management

Handle intervals with proper cleanup:

```tsx
// ✅ Proper interval management
function IntervalComponent() {
  const [count, setCount] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isRunning) {
      interval = setInterval(() => {
        setCount(prevCount => prevCount + 1);
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isRunning]);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setIsRunning(!isRunning)}>
        {isRunning ? 'Stop' : 'Start'}
      </button>
    </div>
  );
}
```

### Timer Hook

Create a reusable timer hook:

```tsx
// ✅ Reusable timer hook
function useTimeout(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay !== null) {
      const id = setTimeout(() => savedCallback.current(), delay);
      return () => clearTimeout(id);
    }
  }, [delay]);
}

// Usage
function ComponentWithTimeout() {
  const [showMessage, setShowMessage] = useState(false);

  useTimeout(() => {
    setShowMessage(true);
  }, 3000);

  return <div>{showMessage && 'Message appeared!'}</div>;
}
```

## Subscription Management

### Observable Subscriptions

Always unsubscribe from observables:

```tsx
// ❌ Bad: Subscription not cleaned up
function BadSubscription() {
  const [data, setData] = useState(null);

  useEffect(() => {
    const subscription = dataStream.subscribe(setData);
    // Missing unsubscribe
  }, []);

  return <div>{data}</div>;
}

// ✅ Good: Subscription properly cleaned up
function GoodSubscription() {
  const [data, setData] = useState(null);

  useEffect(() => {
    const subscription = dataStream.subscribe(setData);
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return <div>{data}</div>;
}
```

### Multiple Subscriptions

Manage multiple subscriptions efficiently:

```tsx
// ✅ Managing multiple subscriptions
function MultipleSubscriptions() {
  const [userData, setUserData] = useState(null);
  const [notificationData, setNotificationData] = useState(null);

  useEffect(() => {
    const userSubscription = userStream.subscribe(setUserData);
    const notificationSubscription = notificationStream.subscribe(setNotificationData);

    return () => {
      userSubscription.unsubscribe();
      notificationSubscription.unsubscribe();
    };
  }, []);

  return (
    <div>
      <div>User: {userData}</div>
      <div>Notifications: {notificationData}</div>
    </div>
  );
}
```

### Subscription Manager Hook

Create a hook to manage multiple subscriptions:

```tsx
// ✅ Subscription manager hook
function useSubscriptions() {
  const subscriptionsRef = useRef<Array<{ unsubscribe: () => void }>>([]);

  const addSubscription = useCallback((subscription: { unsubscribe: () => void }) => {
    subscriptionsRef.current.push(subscription);
    return subscription;
  }, []);

  useEffect(() => {
    return () => {
      subscriptionsRef.current.forEach(sub => sub.unsubscribe());
      subscriptionsRef.current = [];
    };
  }, []);

  return { addSubscription };
}

// Usage
function ComponentWithSubscriptions() {
  const [data1, setData1] = useState(null);
  const [data2, setData2] = useState(null);
  const { addSubscription } = useSubscriptions();

  useEffect(() => {
    addSubscription(stream1.subscribe(setData1));
    addSubscription(stream2.subscribe(setData2));
  }, [addSubscription]);

  return <div>{data1} - {data2}</div>;
}
```

## Connection Management

### WebSocket Connections

Properly manage WebSocket connections:

```tsx
// ❌ Bad: WebSocket not closed
function BadWebSocket() {
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8080');
    
    ws.onmessage = (event) => {
      setMessages(prev => [...prev, event.data]);
    };
    // WebSocket not closed
  }, []);

  return <div>{messages.map(msg => <p key={msg}>{msg}</p>)}</div>;
}

// ✅ Good: WebSocket properly closed
function GoodWebSocket() {
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8080');
    
    ws.onmessage = (event) => {
      setMessages(prev => [...prev, event.data]);
    };

    return () => {
      ws.close();
    };
  }, []);

  return <div>{messages.map(msg => <p key={msg}>{msg}</p>)}</div>;
}
```

### EventSource Connections

Handle Server-Sent Events properly:

```tsx
// ✅ Proper EventSource management
function EventSourceComponent() {
  const [events, setEvents] = useState<string[]>([]);

  useEffect(() => {
    const eventSource = new EventSource('/api/events');
    
    eventSource.onmessage = (event) => {
      setEvents(prev => [...prev, event.data]);
    };

    eventSource.onerror = (error) => {
      console.error('EventSource error:', error);
    };

    return () => {
      eventSource.close();
    };
  }, []);

  return <div>{events.map(event => <p key={event}>{event}</p>)}</div>;
}
```

### Connection Hook

Create a reusable connection hook:

```tsx
// ✅ Reusable connection hook
function useWebSocket(url: string) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'Connecting' | 'Open' | 'Closing' | 'Closed'>('Connecting');

  useEffect(() => {
    const ws = new WebSocket(url);
    
    ws.onopen = () => {
      setConnectionStatus('Open');
      setSocket(ws);
    };
    
    ws.onmessage = (event) => {
      setLastMessage(event.data);
    };
    
    ws.onclose = () => {
      setConnectionStatus('Closed');
      setSocket(null);
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      ws.close();
    };
  }, [url]);

  const sendMessage = useCallback((message: string) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(message);
    }
  }, [socket]);

  return { socket, lastMessage, connectionStatus, sendMessage };
}
```

## Component Lifecycle

### Cleanup on Unmount

Ensure all resources are cleaned up when components unmount:

```tsx
// ✅ Comprehensive cleanup
function ComponentWithResources() {
  const [data, setData] = useState(null);
  const intervalRef = useRef<NodeJS.Timeout>();
  const subscriptionRef = useRef<{ unsubscribe: () => void }>();
  const abortControllerRef = useRef<AbortController>();

  useEffect(() => {
    // Create abort controller for fetch requests
    abortControllerRef.current = new AbortController();

    // Set up interval
    intervalRef.current = setInterval(() => {
      fetchData();
    }, 5000);

    // Set up subscription
    subscriptionRef.current = dataStream.subscribe(setData);

    // Set up event listeners
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Pause updates when tab is hidden
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      } else {
        // Resume updates when tab is visible
        intervalRef.current = setInterval(fetchData, 5000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Fetch initial data
    fetchData();

    return () => {
      // Clean up interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      // Clean up subscription
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }

      // Abort pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Clean up event listeners
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const fetchData = async () => {
    try {
      const response = await fetch('/api/data', {
        signal: abortControllerRef.current?.signal
      });
      const result = await response.json();
      setData(result);
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Fetch error:', error);
      }
    }
  };

  return <div>{data ? JSON.stringify(data) : 'Loading...'}</div>;
}
```

### Conditional Rendering Cleanup

Be careful with conditional rendering and cleanup:

```tsx
// ❌ Bad: Cleanup might not run
function BadConditionalRendering({ showComponent }: { showComponent: boolean }) {
  return (
    <div>
      {showComponent && <ComponentWithResources />}
    </div>
  );
}

// ✅ Good: Use key to force remount and cleanup
function GoodConditionalRendering({ showComponent }: { showComponent: boolean }) {
  return (
    <div>
      {showComponent && <ComponentWithResources key="resources" />}
    </div>
  );
}
```

## Third-Party Library Integration

### Library Cleanup

Ensure third-party libraries are properly cleaned up:

```tsx
// ✅ Third-party library cleanup
function ChartComponent() {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (chartRef.current) {
      // Initialize chart library
      chartInstanceRef.current = new ChartLibrary(chartRef.current, {
        // chart options
      });
    }

    return () => {
      // Clean up chart instance
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, []);

  return <div ref={chartRef} />;
}
```

### Map Libraries

Handle map libraries with proper cleanup:

```tsx
// ✅ Map library cleanup
function MapComponent() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (mapRef.current) {
      mapInstanceRef.current = new MapLibrary(mapRef.current, {
        zoom: 10,
        center: [0, 0]
      });

      // Add event listeners
      mapInstanceRef.current.on('click', handleMapClick);
      mapInstanceRef.current.on('zoom', handleMapZoom);
    }

    return () => {
      if (mapInstanceRef.current) {
        // Remove event listeners
        mapInstanceRef.current.off('click', handleMapClick);
        mapInstanceRef.current.off('zoom', handleMapZoom);
        
        // Destroy map instance
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const handleMapClick = (event: any) => {
    console.log('Map clicked:', event);
  };

  const handleMapZoom = (event: any) => {
    console.log('Map zoomed:', event);
  };

  return <div ref={mapRef} style={{ width: '100%', height: '400px' }} />;
}
```

## Performance Optimization

### Memoization

Use memoization to prevent unnecessary re-renders and resource creation:

```tsx
// ✅ Memoized component with cleanup
const MemoizedComponent = React.memo(function ExpensiveComponent({ data }: { data: any }) {
  const [processedData, setProcessedData] = useState(null);

  useEffect(() => {
    const worker = new Worker('/worker.js');
    
    worker.postMessage(data);
    
    worker.onmessage = (event) => {
      setProcessedData(event.data);
    };

    return () => {
      worker.terminate();
    };
  }, [data]);

  return <div>{processedData}</div>;
});
```

### Debounced Effects

Use debouncing to prevent excessive resource creation:

```tsx
// ✅ Debounced effect
function useDebounce<T>(value: T, delay: number): T {
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
}

function SearchComponent() {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  useEffect(() => {
    if (debouncedSearchTerm) {
      const abortController = new AbortController();
      
      fetch(`/api/search?q=${debouncedSearchTerm}`, {
        signal: abortController.signal
      })
      .then(response => response.json())
      .then(data => {
        // Handle search results
      })
      .catch(error => {
        if (error.name !== 'AbortError') {
          console.error('Search error:', error);
        }
      });

      return () => {
        abortController.abort();
      };
    }
  }, [debouncedSearchTerm]);

  return (
    <input
      type="text"
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      placeholder="Search..."
    />
  );
}
```

## Testing for Memory Leaks

### Unit Testing

Test that cleanup functions are called:

```tsx
// ✅ Testing cleanup
import { render, unmount } from '@testing-library/react';

describe('ComponentWithCleanup', () => {
  it('should clean up resources on unmount', () => {
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener');

    const { unmount } = render(<ComponentWithCleanup />);
    
    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
    expect(removeEventListenerSpy).toHaveBeenCalled();

    clearIntervalSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });
});
```

### Memory Leak Testing

Use the memory leak detection system in tests:

```tsx
// ✅ Memory leak testing
import { createMemoryLeakDetector } from '@/lib/memory-leak-detection';

describe('Memory Leak Tests', () => {
  it('should not have memory leaks in component', async () => {
    const detector = createMemoryLeakDetector();
    const reports = await detector.scanFile('src/components/MyComponent.tsx');
    
    expect(reports).toHaveLength(0);
  });

  it('should clean up all resources', async () => {
    const { unmount } = render(<ComponentWithResources />);
    
    // Simulate some time passing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    unmount();
    
    // Check that no resources are leaked
    const detector = createMemoryLeakDetector();
    const runtimeReport = await detector.analyzeRuntime();
    
    expect(runtimeReport.activeResources.intervals).toBe(0);
    expect(runtimeReport.activeResources.timeouts).toBe(0);
    expect(runtimeReport.activeResources.eventListeners).toBe(0);
  });
});
```

## Summary

Following these best practices will help you:

1. **Prevent Memory Leaks**: Proper cleanup prevents resources from accumulating
2. **Improve Performance**: Efficient resource management reduces memory usage
3. **Enhance User Experience**: Prevents application slowdowns and crashes
4. **Maintain Code Quality**: Clean, predictable resource management patterns
5. **Enable Testing**: Testable cleanup functions and resource management

### Key Takeaways

- Always provide cleanup functions in `useEffect`
- Remove event listeners when components unmount
- Clear timers and intervals in cleanup functions
- Unsubscribe from observables and subscriptions
- Close connections (WebSocket, EventSource) properly
- Handle third-party library cleanup
- Use memoization and debouncing for performance
- Test cleanup functions and resource management
- Monitor memory usage in development and production

By following these patterns consistently, you'll build React applications that are memory-efficient, performant, and maintainable.