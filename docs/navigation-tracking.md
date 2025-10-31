# Navigation Tracking System

The navigation tracking system provides intelligent caching and preloading based on user navigation patterns. It runs in the service worker and learns from user behavior to optimize performance.

## Features

- **Pattern Recognition**: Tracks navigation patterns and identifies frequently accessed paths
- **Smart Preloading**: Preloads likely next destinations based on historical data
- **Session Tracking**: Groups navigation events by user session
- **Critical Path Detection**: Identifies and prioritizes important application routes
- **Real-time Statistics**: Provides insights into navigation behavior and cache performance

## Architecture

### Service Worker (`public/sw.js`)
- Tracks navigation events automatically
- Stores patterns and session data in memory
- Preloads resources based on learned patterns
- Provides statistics and management APIs

### Cache Preloader (`public/cache-preloader-sw.js`)
- Advanced preloading strategies (immediate, idle, predictive, critical)
- Resource prioritization and queue management
- Pattern-based confidence scoring
- Performance monitoring and statistics

### Client Library (`src/lib/navigation-tracker.ts`)
- Communicates with service worker
- Provides TypeScript interfaces
- Handles session management

### React Integration
- **Hook**: `useNavigationTracking` for component-level integration
- **Provider**: `NavigationTrackerProvider` for app-wide tracking
- **Dashboard**: `NavigationTrackingDashboard` for monitoring

## Quick Start

### 1. Add Provider to Your App

```tsx
// app/layout.tsx
import { NavigationTrackerProvider } from '@/components/navigation-tracker-provider'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <NavigationTrackerProvider>
          {children}
        </NavigationTrackerProvider>
      </body>
    </html>
  )
}
```

### 2. Use in Components

```tsx
// components/my-component.tsx
import { useNavigationTracking } from '@/hooks/use-navigation-tracking'

export function MyComponent() {
  const { trackNavigation, preloadForCurrentPath, stats } = useNavigationTracking()

  const handleNavigate = async (path: string) => {
    // Manually track navigation
    await trackNavigation(path)
    
    // Preload resources for the path
    await preloadForCurrentPath()
  }

  return (
    <div>
      <button onClick={() => handleNavigate('/dashboard')}>
        Go to Dashboard
      </button>
    </div>
  )
}
```

### 3. Monitor Performance

```tsx
// pages/admin/navigation.tsx
import { NavigationTrackingDashboard } from '@/components/navigation-tracking-dashboard'

export default function NavigationAdminPage() {
  return (
    <div>
      <h1>Navigation Analytics</h1>
      <NavigationTrackingDashboard />
    </div>
  )
}
```

## API Reference

### NavigationTracker Class

```typescript
// Track navigation
await navigationTracker.trackNavigation('/dashboard', 'session-123')

// Get patterns
const stats = await navigationTracker.getNavigationPatterns(10)

// Preload for path
await navigationTracker.preloadForPath('/dashboard')

// Clear patterns
await navigationTracker.clearPatterns()
```

### useNavigationTracking Hook

```typescript
const {
  // State
  isTracking,
  stats,
  error,
  
  // Actions
  trackNavigation,
  getStats,
  preloadForCurrentPath,
  preloadCriticalData,
  clearPatterns,
  
  // Utilities
  sessionId,
  renewSession
} = useNavigationTracking({
  autoTrack: true,
  preloadOnMount: false,
  debounceMs: 100
})
```

### Service Worker Messages

The service worker accepts these message types:

- `TRACK_NAVIGATION`: Manual navigation tracking
- `GET_NAVIGATION_PATTERNS`: Retrieve pattern statistics
- `PRELOAD_FOR_PATH`: Trigger preloading for specific path
- `PRELOAD_CRITICAL_DATA`: Preload all critical paths
- `CLEAR_NAVIGATION_PATTERNS`: Clear all stored patterns

## Configuration

### Pattern Storage Limits

```javascript
// In service worker
const NAVIGATION_TRACKING = {
  maxPatterns: 100,        // Maximum stored patterns
  maxSessions: 50,         // Maximum active sessions
  minAccessCount: 2,       // Minimum visits to consider critical
  sessionTimeout: 30 * 60 * 1000  // 30 minutes
}
```

### Preload Targets

The enhanced cache preloader automatically determines what to preload based on path patterns:

- `/dashboard` → preloads `/api/activities/recent`, `/api/integrations/status`, `/api/user/preferences`
- `/integrations` → preloads `/api/integrations`, `/api/integrations/github`, `/api/integrations/slack`
- `/settings` → preloads `/api/user/profile`, `/api/user/settings`, `/api/user/preferences`
- `/activities` → preloads `/api/activities`, `/api/activities/github`, `/api/activities/slack`

### Preloading Strategies

1. **Immediate**: Preload resources immediately on navigation
2. **Idle**: Preload during browser idle time using `requestIdleCallback`
3. **Predictive**: Preload based on navigation pattern confidence
4. **Critical**: Always preload high-priority resources

## Performance Considerations

### Memory Usage
- Patterns are stored in service worker memory
- Automatic cleanup removes old patterns and sessions
- Configurable limits prevent excessive memory usage

### Network Impact
- Preloading only occurs for high-confidence predictions
- Limited to 3 preload targets per navigation
- Respects cache strategies and network conditions

### Storage Cleanup
- Expired patterns are automatically removed
- LRU eviction when limits are exceeded
- Manual cleanup available via API

## Monitoring

### Dashboard Metrics
- Total patterns and sessions
- Top navigation patterns
- Session activity and duration
- Critical path identification
- Cache hit rates and performance

### Development Tools
- Console logging in development mode
- Pattern visualization in dashboard
- Real-time statistics updates
- Manual pattern management

## Best Practices

1. **Enable Auto-tracking**: Let the system learn patterns automatically
2. **Monitor Performance**: Use the dashboard to identify optimization opportunities
3. **Tune Limits**: Adjust pattern limits based on your app's navigation complexity
4. **Critical Paths**: Manually identify and preload your most important routes
5. **Session Management**: Use meaningful session IDs for better analytics

## Troubleshooting

### Service Worker Not Available
- Ensure service worker is registered and active
- Check browser compatibility
- Verify HTTPS in production

### Patterns Not Learning
- Check if auto-tracking is enabled
- Verify navigation events are being fired
- Monitor console for tracking errors

### Poor Preload Performance
- Review preload target configuration
- Check network conditions and cache strategies
- Monitor cache hit rates in dashboard

## Integration with UnifiedHQ

The navigation tracking system is designed to work seamlessly with UnifiedHQ's architecture:

- **Next.js App Router**: Automatic route change detection
- **API Caching**: Smart preloading of dashboard data
- **Real-time Updates**: Coordination with WebSocket connections
- **Performance Monitoring**: Integration with existing metrics