import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { createMemoryLeakFixGenerator } from '../memory-leak-fix-generator';
import { LeakDetectionResult } from '../memory-leak-detection-patterns';

describe('MemoryLeakFixGenerator', () => {
  let generator: ReturnType<typeof createMemoryLeakFixGenerator>;
  const fileName = 'test-component.tsx';

  beforeEach(() => {
    // Reset generator for each test
  });

  describe('useEffect cleanup fix generation', () => {
    it('should add cleanup function to useEffect with event listener', () => {
      const sourceCode = `
import React, { useEffect } from 'react';

function TestComponent() {
  useEffect(() => {
    const handleClick = () => console.log('clicked');
    document.addEventListener('click', handleClick);
  }, []);

  return <div>Test</div>;
}`;

      generator = createMemoryLeakFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'missing-useeffect-cleanup',
        severity: 'high',
        file: fileName,
        line: 5,
        column: 3,
        description: 'useEffect contains subscriptions but no cleanup function',
        codeSnippet: 'useEffect(() => { ... }, [])',
      };

      const result = generator.generateFix(leak);

      assert.strictEqual(result.success, true);
      assert.ok(result.fix);
      assert.strictEqual(result.fix.type, 'missing-useeffect-cleanup');
      assert.ok(result.fix.fixedCode.includes('return () => {'));
      assert.ok(result.fix.fixedCode.includes('removeEventListener'));
      assert.strictEqual(result.fix.confidence, 0.9);
    });

    it('should handle useEffect with multiple cleanup items', () => {
      const sourceCode = `
import React, { useEffect } from 'react';

function TestComponent() {
  useEffect(() => {
    const eventSource = new EventSource('/api/events');
    const interval = setInterval(() => {}, 1000);
    const handleResize = () => {};
    window.addEventListener('resize', handleResize);
  }, []);

  return <div>Test</div>;
}`;

      generator = createMemoryLeakFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'missing-useeffect-cleanup',
        severity: 'high',
        file: fileName,
        line: 5,
        column: 3,
        description:
          'useEffect contains multiple subscriptions but no cleanup function',
        codeSnippet: 'useEffect(() => { ... }, [])',
      };

      const result = generator.generateFix(leak);

      assert.strictEqual(result.success, true);
      assert.ok(result.fix);
      assert.ok(result.fix.fixedCode.includes('eventSource.close()'));
      assert.ok(result.fix.fixedCode.includes('clearInterval'));
      assert.ok(result.fix.fixedCode.includes('removeEventListener'));
    });

    it('should handle useEffect with expression body', () => {
      const sourceCode = `
import React, { useEffect } from 'react';

function TestComponent() {
  useEffect(() => document.addEventListener('click', () => {}), []);
  return <div>Test</div>;
}`;

      generator = createMemoryLeakFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'missing-useeffect-cleanup',
        severity: 'high',
        file: fileName,
        line: 5,
        column: 3,
        description: 'useEffect with expression body needs cleanup',
        codeSnippet: 'useEffect(() => document.addEventListener(...), [])',
      };

      const result = generator.generateFix(leak);

      assert.strictEqual(result.success, true);
      assert.ok(result.fix);
      assert.ok(result.fix.fixedCode.includes('{'));
      assert.ok(result.fix.fixedCode.includes('return () => {'));
    });
  });

  describe('event listener cleanup fix generation', () => {
    it('should add removeEventListener for addEventListener', () => {
      const sourceCode = `
function TestComponent() {
  const handleClick = () => console.log('clicked');
  document.addEventListener('click', handleClick);
  return <div>Test</div>;
}`;

      generator = createMemoryLeakFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'uncleaned-event-listener',
        severity: 'medium',
        file: fileName,
        line: 4,
        column: 3,
        description: 'Event listener without cleanup',
        codeSnippet: "document.addEventListener('click', handleClick)",
      };

      const result = generator.generateFix(leak);

      assert.strictEqual(result.success, true);
      assert.ok(result.fix);
      assert.ok(result.fix.fixedCode.includes('removeEventListener'));
      assert.ok(result.fix.fixedCode.includes('useEffect'));
      assert.strictEqual(result.fix.confidence, 0.95);
    });

    it('should handle window event listeners', () => {
      const sourceCode = `
function TestComponent() {
  const handleResize = () => {};
  window.addEventListener('resize', handleResize);
  return <div>Test</div>;
}`;

      generator = createMemoryLeakFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'uncleaned-event-listener',
        severity: 'medium',
        file: fileName,
        line: 4,
        column: 3,
        description: 'Window event listener without cleanup',
        codeSnippet: "window.addEventListener('resize', handleResize)",
      };

      const result = generator.generateFix(leak);

      assert.strictEqual(result.success, true);
      assert.ok(result.fix);
      assert.ok(result.fix.fixedCode.includes('window.removeEventListener'));
    });

    it('should handle event listeners with options', () => {
      const sourceCode = `
function TestComponent() {
  const handleClick = () => {};
  element.addEventListener('click', handleClick, { passive: true });
  return <div>Test</div>;
}`;

      generator = createMemoryLeakFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'uncleaned-event-listener',
        severity: 'medium',
        file: fileName,
        line: 4,
        column: 3,
        description: 'Event listener with options without cleanup',
        codeSnippet:
          "element.addEventListener('click', handleClick, { passive: true })",
      };

      const result = generator.generateFix(leak);

      assert.strictEqual(result.success, true);
      assert.ok(result.fix);
      assert.ok(result.fix.fixedCode.includes('{ passive: true }'));
    });
  });

  describe('timer cleanup fix generation', () => {
    it('should add clearInterval for setInterval', () => {
      const sourceCode = `
function TestComponent() {
  const intervalId = setInterval(() => {
    console.log('tick');
  }, 1000);
  return <div>Test</div>;
}`;

      generator = createMemoryLeakFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'uncleaned-interval',
        severity: 'high',
        file: fileName,
        line: 3,
        column: 21,
        description: 'setInterval without cleanup',
        codeSnippet: 'setInterval(() => { console.log("tick"); }, 1000)',
      };

      const result = generator.generateFix(leak);

      assert.strictEqual(result.success, true);
      assert.ok(result.fix);
      assert.ok(result.fix.fixedCode.includes('clearInterval'));
      assert.ok(result.fix.fixedCode.includes('intervalId'));
      assert.strictEqual(result.fix.confidence, 0.95);
    });

    it('should add clearTimeout for setTimeout', () => {
      const sourceCode = `
function TestComponent() {
  const timeoutId = setTimeout(() => {
    console.log('delayed');
  }, 5000);
  return <div>Test</div>;
}`;

      generator = createMemoryLeakFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'uncleaned-timeout',
        severity: 'medium',
        file: fileName,
        line: 3,
        column: 21,
        description: 'setTimeout without cleanup',
        codeSnippet: 'setTimeout(() => { console.log("delayed"); }, 5000)',
      };

      const result = generator.generateFix(leak);

      assert.strictEqual(result.success, true);
      assert.ok(result.fix);
      assert.ok(result.fix.fixedCode.includes('clearTimeout'));
      assert.ok(result.fix.fixedCode.includes('timeoutId'));
    });

    it('should create variable assignment for unassigned timer', () => {
      const sourceCode = `
function TestComponent() {
  setInterval(() => console.log('tick'), 1000);
  return <div>Test</div>;
}`;

      generator = createMemoryLeakFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'uncleaned-interval',
        severity: 'high',
        file: fileName,
        line: 3,
        column: 3,
        description: 'Unassigned setInterval without cleanup',
        codeSnippet: 'setInterval(() => console.log("tick"), 1000)',
      };

      const result = generator.generateFix(leak);

      assert.strictEqual(result.success, true);
      assert.ok(result.fix);
      assert.ok(result.fix.fixedCode.includes('const intervalId'));
      assert.ok(result.fix.fixedCode.includes('clearInterval(intervalId)'));
      assert.strictEqual(result.fix.requiresManualReview, true);
    });
  });

  describe('EventSource cleanup fix generation', () => {
    it('should add close() call for EventSource', () => {
      const sourceCode = `
function TestComponent() {
  const eventSource = new EventSource('/api/events');
  return <div>Test</div>;
}`;

      generator = createMemoryLeakFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'unclosed-eventsource',
        severity: 'high',
        file: fileName,
        line: 3,
        column: 23,
        description: 'EventSource without cleanup',
        codeSnippet: "new EventSource('/api/events')",
      };

      const result = generator.generateFix(leak);

      assert.strictEqual(result.success, true);
      assert.ok(result.fix);
      assert.ok(result.fix.fixedCode.includes('eventSource.close()'));
      assert.strictEqual(result.fix.confidence, 0.9);
    });

    it('should handle EventSource without variable assignment', () => {
      const sourceCode = `
function TestComponent() {
  new EventSource('/api/events');
  return <div>Test</div>;
}`;

      generator = createMemoryLeakFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'unclosed-eventsource',
        severity: 'high',
        file: fileName,
        line: 3,
        column: 3,
        description: 'Unassigned EventSource without cleanup',
        codeSnippet: "new EventSource('/api/events')",
      };

      const result = generator.generateFix(leak);

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
      assert.ok(result.error.includes('must be assigned to a variable'));
    });
  });

  describe('WebSocket cleanup fix generation', () => {
    it('should add close() call for WebSocket', () => {
      const sourceCode = `
function TestComponent() {
  const ws = new WebSocket('ws://localhost:8080');
  return <div>Test</div>;
}`;

      generator = createMemoryLeakFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'unclosed-websocket',
        severity: 'high',
        file: fileName,
        line: 3,
        column: 14,
        description: 'WebSocket without cleanup',
        codeSnippet: "new WebSocket('ws://localhost:8080')",
      };

      const result = generator.generateFix(leak);

      assert.strictEqual(result.success, true);
      assert.ok(result.fix);
      assert.ok(result.fix.fixedCode.includes('ws.close()'));
      assert.ok(result.fix.fixedCode.includes('WebSocket.OPEN'));
      assert.ok(result.fix.fixedCode.includes('WebSocket.CONNECTING'));
    });
  });

  describe('subscription cleanup fix generation', () => {
    it('should add unsubscribe call for assigned subscription', () => {
      const sourceCode = `
function TestComponent() {
  const unsubscribe = manager.subscribe(callback);
  return <div>Test</div>;
}`;

      generator = createMemoryLeakFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'uncleaned-subscription',
        severity: 'medium',
        file: fileName,
        line: 3,
        column: 23,
        description: 'Subscription without cleanup',
        codeSnippet: 'manager.subscribe(callback)',
      };

      const result = generator.generateFix(leak);

      assert.strictEqual(result.success, true);
      assert.ok(result.fix);
      assert.ok(result.fix.fixedCode.includes('unsubscribe()'));
      assert.strictEqual(result.fix.confidence, 0.85);
    });

    it('should create variable assignment for unassigned subscription', () => {
      const sourceCode = `
function TestComponent() {
  manager.subscribe(callback);
  return <div>Test</div>;
}`;

      generator = createMemoryLeakFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'uncleaned-subscription',
        severity: 'medium',
        file: fileName,
        line: 3,
        column: 3,
        description: 'Unassigned subscription without cleanup',
        codeSnippet: 'manager.subscribe(callback)',
      };

      const result = generator.generateFix(leak);

      assert.strictEqual(result.success, true);
      assert.ok(result.fix);
      assert.ok(result.fix.fixedCode.includes('const unsubscribe'));
      assert.ok(result.fix.fixedCode.includes('unsubscribe()'));
      assert.strictEqual(result.fix.requiresManualReview, true);
    });
  });

  describe('error handling', () => {
    it('should handle unsupported leak types', () => {
      const sourceCode = "function test() {}";
      generator = createMemoryLeakFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'unsupported-type' as any,
        severity: 'low',
        file: fileName,
        line: 1,
        column: 1,
        description: 'Unsupported leak type',
        codeSnippet: 'function test() {}',
      };

      const result = generator.generateFix(leak);

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
      assert.ok(result.error.includes('Unsupported leak type'));
    });

    it('should handle invalid node positions', () => {
      const sourceCode = "function test() {}";
      generator = createMemoryLeakFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'missing-useeffect-cleanup',
        severity: 'high',
        file: fileName,
        line: 999,
        column: 999,
        description: 'Invalid position',
        codeSnippet: 'invalid',
      };

      const result = generator.generateFix(leak);

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
    });

    it('should handle malformed source code', () => {
      const sourceCode = "function test( { invalid syntax";
      generator = createMemoryLeakFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'missing-useeffect-cleanup',
        severity: 'high',
        file: fileName,
        line: 1,
        column: 1,
        description: 'Malformed code',
        codeSnippet: 'function test(',
      };

      const result = generator.generateFix(leak);

      // Should handle gracefully even with syntax errors
      assert.strictEqual(result.success, false);
      assert.ok(result.error);
    });
  });

  describe('code transformation safety', () => {
    it('should preserve existing code structure', () => {
      const sourceCode = `
import React, { useEffect } from 'react';

function TestComponent() {
  const [count, setCount] = React.useState(0);
  
  useEffect(() => {
    const handleClick = () => setCount(c => c + 1);
    document.addEventListener('click', handleClick);
  }, []);

  return <div>Count: {count}</div>;
}`;

      generator = createMemoryLeakFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'missing-useeffect-cleanup',
        severity: 'high',
        file: fileName,
        line: 7,
        column: 3,
        description: 'useEffect needs cleanup',
        codeSnippet: 'useEffect(() => { ... }, [])',
      };

      const result = generator.generateFix(leak);

      assert.strictEqual(result.success, true);
      assert.ok(result.fix);

      // Should preserve imports
      assert.ok(result.fix.fixedCode.includes('import React'));

      // Should preserve state
      assert.ok(result.fix.fixedCode.includes('useState(0)'));

      // Should preserve return statement
      assert.ok(result.fix.fixedCode.includes('Count: {count}'));

      // Should add cleanup
      assert.ok(result.fix.fixedCode.includes('removeEventListener'));
    });

    it('should not break existing functionality', () => {
      const sourceCode = `
function TestComponent() {
  useEffect(() => {
    const timer = setInterval(() => {
      console.log('existing functionality');
    }, 1000);
    
    // Existing comment
    doSomethingImportant();
  }, []);

  return <div>Test</div>;
}`;

      generator = createMemoryLeakFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'missing-useeffect-cleanup',
        severity: 'high',
        file: fileName,
        line: 3,
        column: 3,
        description: 'useEffect needs cleanup',
        codeSnippet: 'useEffect(() => { ... }, [])',
      };

      const result = generator.generateFix(leak);

      assert.strictEqual(result.success, true);
      assert.ok(result.fix);

      // Should preserve existing functionality
      assert.ok(result.fix.fixedCode.includes('existing functionality'));
      assert.ok(result.fix.fixedCode.includes('Existing comment'));
      assert.ok(result.fix.fixedCode.includes('doSomethingImportant()'));

      // Should add cleanup
      assert.ok(result.fix.fixedCode.includes('clearInterval'));
    });
  });
});
