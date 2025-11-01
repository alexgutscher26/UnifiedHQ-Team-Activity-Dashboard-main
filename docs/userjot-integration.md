# UserJot Integration Guide

The UserJot feedback widget has been successfully integrated into UnifiedHQ using the correct UserJot SDK v2.

## Implementation

### ✅ Global Integration

The UserJot widget is **automatically available on every page** through the root layout integration:

- **Root Layout**: `src/app/layout.tsx` includes `UserJotProvider`
- **All Pages**: Widget appears on every page without additional setup
- **Automatic Loading**: No manual initialization required per page

### Correct UserJot Script

The integration uses the official UserJot SDK v2 with the correct script:

```javascript
// Initialize queue and proxy
window.$ujq = window.$ujq || [];
window.uj = window.uj || new Proxy({}, {
    get: (_, p) => (...a) => window.$ujq.push([p, ...a])
});

// Load SDK
const script = document.createElement('script');
script.src = 'https://cdn.userjot.com/sdk/v2/uj.js';
script.type = 'module';
script.async = true;
document.head.appendChild(script);

// Initialize widget
window.uj.init('cmhfef2jb024s15n3zd3551vq', {
    widget: true,
    position: 'right',
    theme: 'auto'
});
```

### React Integration

**Components:**
- `src/components/userjot-widget-v2.tsx` - Main widget component
- `src/components/providers/userjot-provider.tsx` - Global provider
- `src/hooks/use-userjot.ts` - React hook for advanced control

**Hook Usage:**
```typescript
import { useUserJot } from '@/hooks/use-userjot';

function MyComponent() {
    const { isLoaded, show, hide, open, close, track } = useUserJot({
        projectId: 'your-project-id',
        autoInit: true
    });

    return (
        <button onClick={open}>
            Open Feedback
        </button>
    );
}
```

## Configuration

### Environment Variables

Set your UserJot project ID in `.env.local`:

```bash
NEXT_PUBLIC_USERJOT_PROJECT_ID=cmhfef2jb024s15n3zd3551vq
```

### Widget Options

```typescript
{
    widget: true,           // Enable/disable widget
    position: 'right',      // 'left' or 'right'
    theme: 'auto'          // 'light', 'dark', or 'auto'
}
```

## Features

### ✅ Automatic Integration
- **Global Availability**: Loads on all pages automatically via root layout
- **Zero Configuration**: No manual setup required per page
- **Smart Loading**: Handles script loading and initialization automatically
- **Environment Driven**: Enabled when `NEXT_PUBLIC_USERJOT_PROJECT_ID` is set

### ✅ React Hook Control
- Programmatic widget control
- State tracking (loaded, initialized, error)
- Custom event tracking
- Show/hide/open/close methods

### ✅ Development Tools
- Console logging in development mode
- Error handling and reporting
- State debugging

## Advanced Usage

### Custom Controls

Use the `UserJotControls` component for testing:

```typescript
import { UserJotControls } from '@/components/examples/userjot-controls';

// Add to any page for testing
<UserJotControls />
```

### Event Tracking

```typescript
const { track } = useUserJot();

// Track custom events
track('button_clicked', { button: 'signup' });
track('page_viewed', { page: '/dashboard' });
```

### Conditional Loading

```typescript
const { loadSDK, init } = useUserJot({ autoInit: false });

// Load SDK when needed
await loadSDK();

// Initialize with custom config
init({
    widget: true,
    position: 'left',
    theme: 'dark'
});
```

## Verification

### Quick Check
The UserJot widget should be visible on **every page** as a floating button in the bottom-right corner.

### Status Component
Add the status component to any page for debugging:

```typescript
import { UserJotStatus } from '@/components/userjot-status';

// Add to any page (development only)
<UserJotStatus />
```

### Console Verification
Check browser console for UserJot logs:
```
UserJot Provider - Project ID: Set
UserJot SDK v2 will be loaded
UserJot widget initialized successfully with config: {...}
```

## Troubleshooting

### Widget Not Appearing
1. Check project ID is set in environment variables
2. Verify console for loading errors
3. Ensure network access to `cdn.userjot.com`

### Development Debugging
- Check browser console for UserJot logs
- Use `UserJotControls` component for testing
- Verify script loading in Network tab

### Hook State
```typescript
const { isLoaded, isInitialized, error } = useUserJot();

console.log('UserJot State:', {
    isLoaded,        // SDK script loaded
    isInitialized,   // Widget initialized
    error           // Any errors
});
```

## Migration Notes

### From Previous Implementation
- Removed custom feedback widget
- Using official UserJot SDK v2
- Correct script URL: `https://cdn.userjot.com/sdk/v2/uj.js`
- Proper proxy pattern for queue management

### Benefits
- Official UserJot features and analytics
- Reliable service with proper support
- Advanced customization options
- Professional feedback collection