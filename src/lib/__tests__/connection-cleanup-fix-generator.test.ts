import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { createConnectionCleanupFixGenerator } from '../connection-cleanup-fix-generator';
import { LeakDetectionResult } from '../memory-leak-detection-patterns';

describe('ConnectionCleanupFixGenerator', () => {
  let generator: ReturnType<typeof createConnectionCleanupFixGenerator>;
  const fileName = 'test-component.tsx';

  beforeEach(() => {
    // Reset generator for each test
  });

  describe('EventSource cleanup', () => {
    it('should add close() call for assigned EventSource', () => {
      const sourceCode = `
function TestComponent() {
  const eventSource = new EventSource('/api/events');
  return <div>Test</div>;
}`;

      generator = createConnectionCleanupFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'unclosed-eventsource',
        severity: 'high',
        file: fileName,
        line: 3,
        column: 23,
        description: 'EventSource without cleanup',
        codeSnippet: "new EventSource('/api/events')",
      };

      const result = generator.generateConnectionCleanupFix(leak);

      assert.strictEqual(result.success, true);
      assert.ok(result.fix);
      assert.ok(result.fix.fixedCode.includes('eventSource.close()'));
      assert.ok(result.fix.fixedCode.includes('EventSource.CLOSED'));
      assert.ok(result.fix.fixedCode.includes('useEffect'));
      assert.strictEqual(result.fix.confidence, 0.9);
    });

    it('should create variable assignment for unassigned EventSource', () => {
      const sourceCode = `
function TestComponent() {
  new EventSource('/api/events');
  return <div>Test</div>;
}`;

      generator = createConnectionCleanupFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'unclosed-eventsource',
        severity: 'high',
        file: fileName,
        line: 3,
        column: 3,
        description: 'Unassigned EventSource without cleanup',
        codeSnippet: "new EventSource('/api/events')",
      };

      const result = generator.generateConnectionCleanupFix(leak);

      assert.strictEqual(result.success, true);
      assert.ok(result.fix);
      assert.ok(result.fix.fixedCode.includes('const eventSource'));
      assert.ok(result.fix.fixedCode.includes('eventSource.close()'));
      assert.strictEqual(result.fix.requiresManualReview, true);
    });

    it('should handle EventSource in useEffect', () => {
      const sourceCode = `
function TestComponent() {
  useEffect(() => {
    const eventSource = new EventSource('/api/events');
  }, []);
  
  return <div>Test</div>;
}`;

      generator = createConnectionCleanupFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'unclosed-eventsource',
        severity: 'high',
        file: fileName,
        line: 4,
        column: 25,
        description: 'EventSource in useEffect without cleanup',
        codeSnippet: "new EventSource('/api/events')",
      };

      const result = generator.generateConnectionCleanupFix(leak);

      assert.strictEqual(result.success, true);
      assert.ok(result.fix);
      assert.ok(result.fix.fixedCode.includes('return () => {'));
      assert.ok(result.fix.fixedCode.includes('eventSource.close()'));
    });
  });

  describe('WebSocket cleanup', () => {
    it('should add close() call for assigned WebSocket', () => {
      const sourceCode = `
function TestComponent() {
  const ws = new WebSocket('ws://localhost:8080');
  return <div>Test</div>;
}`;

      generator = createConnectionCleanupFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'unclosed-websocket',
        severity: 'high',
        file: fileName,
        line: 3,
        column: 14,
        description: 'WebSocket without cleanup',
        codeSnippet: "new WebSocket('ws://localhost:8080')",
      };

      const result = generator.generateConnectionCleanupFix(leak);

      assert.strictEqual(result.success, true);
      assert.ok(result.fix);
      assert.ok(result.fix.fixedCode.includes('ws.close()'));
      assert.ok(result.fix.fixedCode.includes('WebSocket.OPEN'));
      assert.ok(result.fix.fixedCode.includes('WebSocket.CONNECTING'));
    });

    it('should create variable assignment for unassigned WebSocket', () => {
      const sourceCode = `
function TestComponent() {
  new WebSocket('ws://localhost:8080');
  return <div>Test</div>;
}`;

      generator = createConnectionCleanupFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'unclosed-websocket',
        severity: 'high',
        file: fileName,
        line: 3,
        column: 3,
        description: 'Unassigned WebSocket without cleanup',
        codeSnippet: "new WebSocket('ws://localhost:8080')",
      };

      const result = generator.generateConnectionCleanupFix(leak);

      assert.strictEqual(result.success, true);
      assert.ok(result.fix);
      assert.ok(result.fix.fixedCode.includes('const webSocket'));
      assert.ok(result.fix.fixedCode.includes('webSocket.close()'));
    });

    it('should handle WebSocket with protocols', () => {
      const sourceCode = `
function TestComponent() {
  const ws = new WebSocket('ws://localhost:8080', ['protocol1', 'protocol2']);
  return <div>Test</div>;
}`;

      generator = createConnectionCleanupFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'unclosed-websocket',
        severity: 'high',
        file: fileName,
        line: 3,
        column: 14,
        description: 'WebSocket with protocols without cleanup',
        codeSnippet:
          "new WebSocket('ws://localhost:8080', ['protocol1', 'protocol2'])",
      };

      const result = generator.generateConnectionCleanupFix(leak);

      assert.strictEqual(result.success, true);
      assert.ok(result.fix);
      assert.ok(result.fix.fixedCode.includes('ws.close()'));
    });
  });

  describe('subscription cleanup', () => {
    it('should add unsubscribe call for assigned subscription', () => {
      const sourceCode = `
function TestComponent() {
  const unsubscribe = manager.subscribe(callback);
  return <div>Test</div>;
}`;

      generator = createConnectionCleanupFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'uncleaned-subscription',
        severity: 'medium',
        file: fileName,
        line: 3,
        column: 23,
        description: 'Subscription without cleanup',
        codeSnippet: 'manager.subscribe(callback)',
      };

      const result = generator.generateConnectionCleanupFix(leak);

      assert.strictEqual(result.success, true);
      assert.ok(result.fix);
      assert.ok(result.fix.fixedCode.includes('unsubscribe()'));
      assert.ok(result.fix.fixedCode.includes('useEffect'));
    });

    it('should create variable assignment for unassigned subscription', () => {
      const sourceCode = `
function TestComponent() {
  manager.subscribe(callback);
  return <div>Test</div>;
}`;

      generator = createConnectionCleanupFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'uncleaned-subscription',
        severity: 'medium',
        file: fileName,
        line: 3,
        column: 3,
        description: 'Unassigned subscription without cleanup',
        codeSnippet: 'manager.subscribe(callback)',
      };

      const result = generator.generateConnectionCleanupFix(leak);

      assert.strictEqual(result.success, true);
      assert.ok(result.fix);
      assert.ok(result.fix.fixedCode.includes('const unsubscribe'));
      assert.ok(result.fix.fixedCode.includes('unsubscribe()'));
      assert.strictEqual(result.fix.requiresManualReview, true);
    });

    it('should handle different subscription methods', () => {
      const sourceCode = `
function TestComponent() {
  const unsubscribe = eventEmitter.on('event', handler);
  return <div>Test</div>;
}`;

      generator = createConnectionCleanupFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'uncleaned-subscription',
        severity: 'medium',
        file: fileName,
        line: 3,
        column: 23,
        description: 'Event emitter subscription without cleanup',
        codeSnippet: "eventEmitter.on('event', handler)",
      };

      const result = generator.generateConnectionCleanupFix(leak);

      assert.strictEqual(result.success, true);
      assert.ok(result.fix);
      assert.ok(result.fix.fixedCode.includes('unsubscribe()'));
    });
  });

  describe('useEffect integration', () => {
    it('should add to existing useEffect cleanup', () => {
      const sourceCode = `
function TestComponent() {
  useEffect(() => {
    const eventSource = new EventSource('/api/events');
    
    return () => {
      console.log('existing cleanup');
    };
  }, []);
  
  return <div>Test</div>;
}`;

      generator = createConnectionCleanupFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'unclosed-eventsource',
        severity: 'high',
        file: fileName,
        line: 4,
        column: 25,
        description: 'EventSource in useEffect with existing cleanup',
        codeSnippet: "new EventSource('/api/events')",
      };

      const result = generator.generateConnectionCleanupFix(leak);

      assert.strictEqual(result.success, true);
      assert.ok(result.fix);
      assert.ok(result.fix.fixedCode.includes('existing cleanup'));
      assert.ok(result.fix.fixedCode.includes('eventSource.close()'));
    });

    it('should create cleanup function in useEffect without existing cleanup', () => {
      const sourceCode = `
function TestComponent() {
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8080');
  }, []);
  
  return <div>Test</div>;
}`;

      generator = createConnectionCleanupFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'unclosed-websocket',
        severity: 'high',
        file: fileName,
        line: 4,
        column: 16,
        description: 'WebSocket in useEffect without cleanup',
        codeSnippet: "new WebSocket('ws://localhost:8080')",
      };

      const result = generator.generateConnectionCleanupFix(leak);

      assert.strictEqual(result.success, true);
      assert.ok(result.fix);
      assert.ok(result.fix.fixedCode.includes('return () => {'));
      assert.ok(result.fix.fixedCode.includes('ws.close()'));
    });
  });

  describe('React component detection', () => {
    it('should wrap connection in useEffect for React components', () => {
      const sourceCode = `
function TestComponent() {
  const eventSource = new EventSource('/api/events');
  
  return <div>Test Component</div>;
}`;

      generator = createConnectionCleanupFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'unclosed-eventsource',
        severity: 'high',
        file: fileName,
        line: 3,
        column: 23,
        description: 'EventSource in React component without cleanup',
        codeSnippet: "new EventSource('/api/events')",
      };

      const result = generator.generateConnectionCleanupFix(leak);

      assert.strictEqual(result.success, true);
      assert.ok(result.fix);
      assert.ok(result.fix.fixedCode.includes('useEffect(() => {'));
      assert.ok(result.fix.fixedCode.includes('}, []);'));
    });

    it('should handle arrow function components', () => {
      const sourceCode = `
const TestComponent = () => {
  const ws = new WebSocket('ws://localhost:8080');
  
  return <div>Test Component</div>;
};`;

      generator = createConnectionCleanupFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'unclosed-websocket',
        severity: 'high',
        file: fileName,
        line: 3,
        column: 14,
        description: 'WebSocket in arrow function component without cleanup',
        codeSnippet: "new WebSocket('ws://localhost:8080')",
      };

      const result = generator.generateConnectionCleanupFix(leak);

      assert.strictEqual(result.success, true);
      assert.ok(result.fix);
      assert.ok(result.fix.fixedCode.includes('useEffect'));
    });
  });

  describe('non-React contexts', () => {
    it('should add cleanup comment for non-React functions', () => {
      const sourceCode = `
function regularFunction() {
  const eventSource = new EventSource('/api/events');
  
  return eventSource;
}`;

      generator = createConnectionCleanupFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'unclosed-eventsource',
        severity: 'high',
        file: fileName,
        line: 3,
        column: 23,
        description: 'EventSource in regular function without cleanup',
        codeSnippet: "new EventSource('/api/events')",
      };

      const result = generator.generateConnectionCleanupFix(leak);

      assert.strictEqual(result.success, true);
      assert.ok(result.fix);
      assert.ok(result.fix.fixedCode.includes('TODO'));
      assert.ok(result.fix.fixedCode.includes('eventSource.close()'));
      assert.ok(result.fix.confidence < 0.9); // Lower confidence for non-React contexts
    });
  });

  describe('confidence calculation', () => {
    it('should have high confidence for assigned connections in React components', () => {
      const sourceCode = `
function TestComponent() {
  const eventSource = new EventSource('/api/events');
  return <div>Test</div>;
}`;

      generator = createConnectionCleanupFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'unclosed-eventsource',
        severity: 'high',
        file: fileName,
        line: 3,
        column: 23,
        description: 'Assigned EventSource in React component',
        codeSnippet: "new EventSource('/api/events')",
      };

      const result = generator.generateConnectionCleanupFix(leak);

      assert.strictEqual(result.success, true);
      assert.ok(result.fix);
      assert.strictEqual(result.fix.confidence, 0.9);
      assert.strictEqual(result.fix.requiresManualReview, false);
    });

    it('should have lower confidence for unassigned connections', () => {
      const sourceCode = `
function TestComponent() {
  new EventSource('/api/events');
  return <div>Test</div>;
}`;

      generator = createConnectionCleanupFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'unclosed-eventsource',
        severity: 'high',
        file: fileName,
        line: 3,
        column: 3,
        description: 'Unassigned EventSource',
        codeSnippet: "new EventSource('/api/events')",
      };

      const result = generator.generateConnectionCleanupFix(leak);

      assert.strictEqual(result.success, true);
      assert.ok(result.fix);
      assert.ok(result.fix.confidence < 0.9);
      assert.strictEqual(result.fix.requiresManualReview, true);
    });

    it('should have lower confidence for subscription patterns', () => {
      const sourceCode = `
function TestComponent() {
  const unsubscribe = manager.subscribe(callback);
  return <div>Test</div>;
}`;

      generator = createConnectionCleanupFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'uncleaned-subscription',
        severity: 'medium',
        file: fileName,
        line: 3,
        column: 23,
        description: 'Subscription pattern',
        codeSnippet: 'manager.subscribe(callback)',
      };

      const result = generator.generateConnectionCleanupFix(leak);

      assert.strictEqual(result.success, true);
      assert.ok(result.fix);
      assert.ok(result.fix.confidence < 0.9); // Subscriptions are more complex
      assert.strictEqual(result.fix.requiresManualReview, true);
    });
  });

  describe('error handling', () => {
    it('should handle missing connection node', () => {
      const sourceCode = "function test() {}";
      generator = createConnectionCleanupFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'unclosed-eventsource',
        severity: 'high',
        file: fileName,
        line: 1,
        column: 1,
        description: 'Invalid connection',
        codeSnippet: 'function test() {}',
      };

      const result = generator.generateConnectionCleanupFix(leak);

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
      assert.ok(result.error.includes('Could not find connection node'));
    });

    it('should handle unsupported connection types', () => {
      const sourceCode = `
function TestComponent() {
  const connection = new SomeOtherConnection();
  return <div>Test</div>;
}`;

      generator = createConnectionCleanupFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'unclosed-eventsource',
        severity: 'high',
        file: fileName,
        line: 3,
        column: 22,
        description: 'Unsupported connection type',
        codeSnippet: 'new SomeOtherConnection()',
      };

      const result = generator.generateConnectionCleanupFix(leak);

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
      assert.ok(result.error.includes('Could not analyze connection pattern'));
    });

    it('should handle invalid node positions', () => {
      const sourceCode = "function test() {}";
      generator = createConnectionCleanupFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'unclosed-eventsource',
        severity: 'high',
        file: fileName,
        line: 999,
        column: 999,
        description: 'Invalid position',
        codeSnippet: 'invalid',
      };

      const result = generator.generateConnectionCleanupFix(leak);

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
    });
  });

  describe('code preservation', () => {
    it('should preserve existing code structure', () => {
      const sourceCode = `
import React, { useState, useEffect } from 'react';

function TestComponent({ url }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  
  const eventSource = new EventSource(url);
  
  eventSource.onmessage = (event) => {
    setData(JSON.parse(event.data));
  };
  
  eventSource.onerror = (event) => {
    setError('Connection error');
  };
  
  return (
    <div className="data-stream">
      {error && <div className="error">{error}</div>}
      {data && <div className="data">{JSON.stringify(data)}</div>}
    </div>
  );
}

export default TestComponent;`;

      generator = createConnectionCleanupFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'unclosed-eventsource',
        severity: 'high',
        file: fileName,
        line: 8,
        column: 23,
        description: 'EventSource without cleanup',
        codeSnippet: 'new EventSource(url)',
      };

      const result = generator.generateConnectionCleanupFix(leak);

      assert.strictEqual(result.success, true);
      assert.ok(result.fix);

      // Should preserve imports
      assert.ok(result.fix.fixedCode.includes('import React'));

      // Should preserve props
      assert.ok(result.fix.fixedCode.includes('{ url }'));

      // Should preserve state
      assert.ok(result.fix.fixedCode.includes('useState(null)'));

      // Should preserve event handlers
      assert.ok(result.fix.fixedCode.includes('onmessage'));
      assert.ok(result.fix.fixedCode.includes('onerror'));

      // Should preserve JSX
      assert.ok(result.fix.fixedCode.includes('className="data-stream"'));

      // Should preserve export
      assert.ok(result.fix.fixedCode.includes('export default'));

      // Should add cleanup
      assert.ok(result.fix.fixedCode.includes('eventSource.close()'));
    });
  });
});
