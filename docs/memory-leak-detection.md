# Memory Leak Detection System

UnifiedHQ includes a comprehensive memory leak detection system that uses TypeScript AST analysis to identify potential memory leaks in React components and hooks.

## Features

- **AST-based Analysis**: Uses TypeScript compiler API for accurate code analysis
- **React Hook Support**: Specialized analysis for `useEffect` and other hooks
- **Multiple Leak Types**: Detects various memory leak patterns
- **Detailed Reports**: Provides line-by-line analysis with suggestions
- **CLI Tools**: Command-line interface for project-wide analysis
- **Scoring System**: 0-100 score based on memory safety

## Detected Memory Leak Patterns

### Event Listeners
```typescript
// ❌ Memory Leak
useEffect(() => {
  const handleResize = () => {};
  window.addEventListener('resize', handleResize);
  // Missing cleanup!
}, []);

// ✅ Proper Cleanup
useEffect(() => {
  const handleResize = () => {};
  window.addEventListener('resize', handleResize);
  
  return () => {
    window.removeEventListener('resize', handleResize);
  };
}, []);
```

### Intervals and Timeouts
```typescript
// ❌ Memory Leak
useEffect(() => {
  const interval = setInterval(() => {
    console.log('tick');
  }, 1000);
  // Missing cleanup!
}, []);

// ✅ Proper Cleanup
useEffect(() => {
  const interval = setInterval(() => {
    console.log('tick');
  }, 1000);
  
  return () => {
    clearInterval(interval);
  };
}, []);
```

### EventSource and WebSocket
```typescript
// ❌ Memory Leak
useEffect(() => {
  const eventSource = new EventSource('/api/events');
  const ws = new WebSocket('ws://localhost:8080');
  // Missing cleanup!
}, []);

// ✅ Proper Cleanup
useEffect(() => {
  const eventSource = new EventSource('/api/events');
  const ws = new WebSocket('ws://localhost:8080');
  
  return () => {
    eventSource.close();
    ws.close();
  };
}, []);
```

### Subscriptions
```typescript
// ❌ Memory Leak
useEffect(() => {
  const subscription = observable.subscribe(handler);
  // Missing cleanup!
}, []);

// ✅ Proper Cleanup
useEffect(() => {
  const subscription = observable.subscribe(handler);
  
  return () => {
    subscription.unsubscribe();
  };
}, []);
```

### AbortController
```typescript
// ❌ Memory Leak
useEffect(() => {
  const controller = new AbortController();
  fetch('/api/data', { signal: controller.signal });
  // Missing cleanup!
}, []);

// ✅ Proper Cleanup
useEffect(() => {
  const controller = new AbortController();
  fetch('/api/data', { signal: controller.signal });
  
  return () => {
    controller.abort();
  };
}, []);
```

## CLI Usage

### Test the Detection System
```bash
npm run memory-leak:test
```

### Analyze Entire Project
```bash
npm run memory-leak:analyze
```

### Analyze Specific File
```bash
npx tsx src/lib/memory-leak-detection/cli.ts src/components/MyComponent.tsx
```

### Run Tests Only
```bash
npm run memory-leak:check
```

## Programmatic Usage

### Basic Analysis
```typescript
import { analyzeCodeForMemoryLeaks } from '@/lib/memory-leak-detection/code-analyzer';

const code = `
  useEffect(() => {
    window.addEventListener('resize', handler);
  }, []);
`;

const analysis = analyzeCodeForMemoryLeaks(code);
console.log(analysis.hasMemoryLeaks); // true
console.log(analysis.score); // 75
console.log(analysis.suggestions); // Array of suggestions
```

### Detailed Analysis
```typescript
import { CodeAnalyzer, generateMemoryLeakReport } from '@/lib/memory-leak-detection/code-analyzer';

const analyzer = new CodeAnalyzer();
const analysis = analyzer.analyzeCode(code, 'MyComponent.tsx');
const report = generateMemoryLeakReport(analysis);

console.log(report);
```

## Analysis Results

### MemoryLeakAnalysis Interface
```typescript
interface MemoryLeakAnalysis {
  hasMemoryLeaks: boolean;
  leaks: MemoryLeak[];
  cleanupActions: CleanupAction[];
  suggestions: string[];
  score: number; // 0-100, higher is better
}

interface MemoryLeak {
  type: string;
  line: number;
  column: number;
  description: string;
  severity: 'error' | 'warning' | 'info';
  suggestedFix: string;
}
```

### Sample Report
```
🔍 Memory Leak Analysis Report
========================================
Score: 75/100
Status: ❌ Issues Found

🚨 Memory Leaks Detected:
1. Event listener added without cleanup (Line 3)
   Fix: Add removeEventListener in cleanup function

✅ Cleanup Actions Found:
1. Interval cleanup (Line 8)

💡 Suggestions:
• Add removeEventListener in cleanup function
• Consider using AbortController for fetch requests
```

## Scoring System

The memory safety score is calculated based on:

- **Base Score**: 100 points
- **Error Deduction**: -25 points per error-level memory leak
- **Warning Deduction**: -10 points per warning-level memory leak
- **Cleanup Bonus**: +5 points per cleanup action found

### Score Ranges
- **90-100**: Excellent memory safety
- **75-89**: Good with minor issues
- **50-74**: Moderate issues, needs attention
- **25-49**: Significant memory leak risks
- **0-24**: Critical memory leak issues

## Integration with Development Workflow

### Pre-commit Hook
Add to `.husky/pre-commit`:
```bash
#!/bin/sh
npm run memory-leak:analyze
```

### CI/CD Integration
Add to GitHub Actions:
```yaml
- name: Memory Leak Detection
  run: npm run memory-leak:analyze
```

### ESLint Integration
The system can be integrated with ESLint for real-time detection:
```javascript
// .eslintrc.js
module.exports = {
  plugins: ['memory-leak-detection'],
  rules: {
    'memory-leak-detection/useeffect-cleanup': 'error',
  },
};
```

## Configuration

### Custom Analysis Rules
```typescript
const analyzer = new CodeAnalyzer();

// Analyze with custom severity levels
const analysis = analyzer.analyzeCode(code, {
  strictMode: true,
  ignoreWarnings: false,
  customPatterns: [
    {
      pattern: 'customSubscribe',
      cleanup: 'customUnsubscribe',
      severity: 'error',
    },
  ],
});
```

### Project-wide Configuration
Create `.memory-leak-config.json`:
```json
{
  "ignoreFiles": ["**/*.test.tsx", "**/node_modules/**"],
  "strictMode": true,
  "minimumScore": 80,
  "customPatterns": [
    {
      "leak": "customAPI.connect",
      "cleanup": "customAPI.disconnect"
    }
  ]
}
```

## Best Practices

### 1. Always Use Cleanup Functions
```typescript
useEffect(() => {
  // Setup code here
  
  return () => {
    // Cleanup code here
  };
}, []);
```

### 2. Use AbortController for Fetch Requests
```typescript
useEffect(() => {
  const controller = new AbortController();
  
  fetch('/api/data', { signal: controller.signal })
    .then(response => response.json())
    .then(data => setData(data));
  
  return () => {
    controller.abort();
  };
}, []);
```

### 3. Store References for Cleanup
```typescript
useEffect(() => {
  const handleResize = () => setWidth(window.innerWidth);
  const interval = setInterval(updateTime, 1000);
  
  window.addEventListener('resize', handleResize);
  
  return () => {
    window.removeEventListener('resize', handleResize);
    clearInterval(interval);
  };
}, []);
```

### 4. Use Custom Hooks for Complex Cleanup
```typescript
function useEventListener(event: string, handler: () => void) {
  useEffect(() => {
    window.addEventListener(event, handler);
    return () => window.removeEventListener(event, handler);
  }, [event, handler]);
}
```

## Troubleshooting

### Common Issues

1. **False Positives**
   - The analyzer might flag legitimate patterns
   - Use comments to document intentional behavior
   - Configure custom rules for project-specific patterns

2. **TypeScript Compilation Errors**
   - Ensure code is syntactically valid
   - The analyzer requires valid TypeScript/TSX syntax

3. **Performance with Large Projects**
   - Use file filtering to focus on specific directories
   - Run analysis on changed files only in CI

### Debug Mode
```bash
DEBUG=true npm run memory-leak:analyze
```

This enables detailed logging of the AST analysis process.

## Contributing

To add new memory leak detection patterns:

1. Update `CodeAnalyzer` class with new detection methods
2. Add corresponding cleanup detection
3. Update test cases in `run-tests.ts`
4. Add documentation and examples

The system is designed to be extensible and can be enhanced to detect additional memory leak patterns specific to your application's needs.