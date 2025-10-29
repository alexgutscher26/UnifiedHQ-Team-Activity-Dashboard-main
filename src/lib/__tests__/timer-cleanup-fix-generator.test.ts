import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { createTimerCleanupFixGenerator } from '../timer-cleanup-fix-generator';
import { LeakDetectionResult } from '../memory-leak-detection-patterns';

describe('TimerCleanupFixGenerator', () => {
    let generator: ReturnType<typeof createTimerCleanupFixGenerator>;
    const fileName = 'test-component.tsx';

    beforeEach(() => {
        // Reset generator for each test
    });

    describe('setInterval cleanup', () => {
        it('should add clearInterval for assigned setInterval', () => {
            const sourceCode = `
function TestComponent() {
  const intervalId = setInterval(() => {
    console.log('tick');
  }, 1000);
  return <div>Test</div>;
}`;

            generator = createTimerCleanupFixGenerator(sourceCode, fileName);

            const leak: LeakDetectionResult = {
                type: 'uncleaned-interval',
                severity: 'high',
                file: fileName,
                line: 3,
                column: 21,
                description: 'setInterval without cleanup',
                codeSnippet: 'setInterval(() => { console.log("tick"); }, 1000)'
            };

            const result = generator.generateTimerCleanupFix(leak);

            assert.strictEqual(result.success, true);
            assert.ok(result.fix);
            assert.ok(result.fix.fixedCode.includes('clearInterval'));
            assert.ok(result.fix.fixedCode.includes('intervalId'));
            assert.ok(result.fix.fixedCode.includes('useEffect'));
            assert.strictEqual(result.fix.confidence, 0.95);
        });

        it('should create variable assignment for unassigned setInterval', () => {
            const sourceCode = `
function TestComponent() {
  setInterval(() => console.log('tick'), 1000);
  return <div>Test</div>;
}`;

            generator = createTimerCleanupFixGenerator(sourceCode, fileName);

            const leak: LeakDetectionResult = {
                type: 'uncleaned-interval',
                severity: 'high',
                file: fileName,
                line: 3,
                column: 3,
                description: 'Unassigned setInterval without cleanup',
                codeSnippet: 'setInterval(() => console.log("tick"), 1000)'
            };

            const result = generator.generateTimerCleanupFix(leak);

            assert.strictEqual(result.success, true);
            assert.ok(result.fix);
            assert.ok(result.fix.fixedCode.includes('const intervalId'));
            assert.ok(result.fix.fixedCode.includes('clearInterval(intervalId)'));
            assert.strictEqual(result.fix.requiresManualReview, true);
        });
    });

    describe('setTimeout cleanup', () => {
        it('should add clearTimeout for assigned setTimeout', () => {
            const sourceCode = `
function TestComponent() {
  const timeoutId = setTimeout(() => {
    console.log('delayed');
  }, 5000);
  return <div>Test</div>;
}`;

            generator = createTimerCleanupFixGenerator(sourceCode, fileName);

            const leak: LeakDetectionResult = {
                type: 'uncleaned-timeout',
                severity: 'medium',
                file: fileName,
                line: 3,
                column: 21,
                description: 'setTimeout without cleanup',
                codeSnippet: 'setTimeout(() => { console.log("delayed"); }, 5000)'
            };

            const result = generator.generateTimerCleanupFix(leak);

            assert.strictEqual(result.success, true);
            assert.ok(result.fix);
            assert.ok(result.fix.fixedCode.includes('clearTimeout'));
            assert.ok(result.fix.fixedCode.includes('timeoutId'));
            assert.strictEqual(result.fix.confidence, 0.95);
        });

        it('should create variable assignment for unassigned setTimeout', () => {
            const sourceCode = `
function TestComponent() {
  setTimeout(() => console.log('delayed'), 5000);
  return <div>Test</div>;
}`;

            generator = createTimerCleanupFixGenerator(sourceCode, fileName);

            const leak: LeakDetectionResult = {
                type: 'uncleaned-timeout',
                severity: 'medium',
                file: fileName,
                line: 3,
                column: 3,
                description: 'Unassigned setTimeout without cleanup',
                codeSnippet: 'setTimeout(() => console.log("delayed"), 5000)'
            };

            const result = generator.generateTimerCleanupFix(leak);

            assert.strictEqual(result.success, true);
            assert.ok(result.fix);
            assert.ok(result.fix.fixedCode.includes('const timeoutId'));
            assert.ok(result.fix.fixedCode.includes('clearTimeout(timeoutId)'));
        });
    });

    describe('useEffect integration', () => {
        it('should add to existing useEffect cleanup', () => {
            const sourceCode = `
function TestComponent() {
  useEffect(() => {
    const intervalId = setInterval(() => {
      console.log('tick');
    }, 1000);
    
    return () => {
      console.log('existing cleanup');
    };
  }, []);
  
  return <div>Test</div>;
}`;

            generator = createTimerCleanupFixGenerator(sourceCode, fileName);

            const leak: LeakDetectionResult = {
                type: 'uncleaned-interval',
                severity: 'high',
                file: fileName,
                line: 4,
                column: 23,
                description: 'setInterval in useEffect without cleanup',
                codeSnippet: 'setInterval(() => { console.log("tick"); }, 1000)'
            };

            const result = generator.generateTimerCleanupFix(leak);

            assert.strictEqual(result.success, true);
            assert.ok(result.fix);
            assert.ok(result.fix.fixedCode.includes('existing cleanup'));
            assert.ok(result.fix.fixedCode.includes('clearInterval(intervalId)'));
        });

        it('should create cleanup function in useEffect without existing cleanup', () => {
            const sourceCode = `
function TestComponent() {
  useEffect(() => {
    const intervalId = setInterval(() => {
      console.log('tick');
    }, 1000);
  }, []);
  
  return <div>Test</div>;
}`;

            generator = createTimerCleanupFixGenerator(sourceCode, fileName);

            const leak: LeakDetectionResult = {
                type: 'uncleaned-interval',
                severity: 'high',
                file: fileName,
                line: 4,
                column: 23,
                description: 'setInterval in useEffect without cleanup',
                codeSnippet: 'setInterval(() => { console.log("tick"); }, 1000)'
            };

            const result = generator.generateTimerCleanupFix(leak);

            assert.strictEqual(result.success, true);
            assert.ok(result.fix);
            assert.ok(result.fix.fixedCode.includes('return () => {'));
            assert.ok(result.fix.fixedCode.includes('clearInterval(intervalId)'));
        });
    });

    describe('React component detection', () => {
        it('should wrap timer in useEffect for React components', () => {
            const sourceCode = `
function TestComponent() {
  const intervalId = setInterval(() => {
    console.log('tick');
  }, 1000);
  
  return <div>Test Component</div>;
}`;

            generator = createTimerCleanupFixGenerator(sourceCode, fileName);

            const leak: LeakDetectionResult = {
                type: 'uncleaned-interval',
                severity: 'high',
                file: fileName,
                line: 3,
                column: 21,
                description: 'setInterval in React component without cleanup',
                codeSnippet: 'setInterval(() => { console.log("tick"); }, 1000)'
            };

            const result = generator.generateTimerCleanupFix(leak);

            assert.strictEqual(result.success, true);
            assert.ok(result.fix);
            assert.ok(result.fix.fixedCode.includes('useEffect(() => {'));
            assert.ok(result.fix.fixedCode.includes('}, []);'));
            assert.ok(result.fix.fixedCode.includes('clearInterval'));
        });

        it('should handle arrow function components', () => {
            const sourceCode = `
const TestComponent = () => {
  const timeoutId = setTimeout(() => {
    console.log('delayed');
  }, 5000);
  
  return <div>Test Component</div>;
};`;

            generator = createTimerCleanupFixGenerator(sourceCode, fileName);

            const leak: LeakDetectionResult = {
                type: 'uncleaned-timeout',
                severity: 'medium',
                file: fileName,
                line: 3,
                column: 21,
                description: 'setTimeout in arrow function component without cleanup',
                codeSnippet: 'setTimeout(() => { console.log("delayed"); }, 5000)'
            };

            const result = generator.generateTimerCleanupFix(leak);

            assert.strictEqual(result.success, true);
            assert.ok(result.fix);
            assert.ok(result.fix.fixedCode.includes('useEffect'));
            assert.ok(result.fix.fixedCode.includes('clearTimeout'));
        });
    });

    describe('non-React contexts', () => {
        it('should add cleanup comment for non-React functions', () => {
            const sourceCode = `
function regularFunction() {
  const intervalId = setInterval(() => {
    console.log('tick');
  }, 1000);
  
  return intervalId;
}`;

            generator = createTimerCleanupFixGenerator(sourceCode, fileName);

            const leak: LeakDetectionResult = {
                type: 'uncleaned-interval',
                severity: 'high',
                file: fileName,
                line: 3,
                column: 21,
                description: 'setInterval in regular function without cleanup',
                codeSnippet: 'setInterval(() => { console.log("tick"); }, 1000)'
            };

            const result = generator.generateTimerCleanupFix(leak);

            assert.strictEqual(result.success, true);
            assert.ok(result.fix);
            assert.ok(result.fix.fixedCode.includes('clearInterval(intervalId)'));
            assert.ok(result.fix.confidence < 0.9); // Lower confidence for non-React contexts
        });
    });

    describe('complex callback patterns', () => {
        it('should handle complex callback functions', () => {
            const sourceCode = `
function TestComponent() {
  const intervalId = setInterval(() => {
    // Complex callback with multiple operations
    const data = fetchData();
    processData(data);
    updateUI(data);
    logActivity('interval-tick');
  }, 1000);
  
  return <div>Test</div>;
}`;

            generator = createTimerCleanupFixGenerator(sourceCode, fileName);

            const leak: LeakDetectionResult = {
                type: 'uncleaned-interval',
                severity: 'high',
                file: fileName,
                line: 3,
                column: 21,
                description: 'setInterval with complex callback without cleanup',
                codeSnippet: 'setInterval(() => { /* complex callback */ }, 1000)'
            };

            const result = generator.generateTimerCleanupFix(leak);

            assert.strictEqual(result.success, true);
            assert.ok(result.fix);
            assert.ok(result.fix.fixedCode.includes('clearInterval'));
            assert.strictEqual(result.fix.requiresManualReview, true); // Complex callbacks need review
        });

        it('should handle named function callbacks', () => {
            const sourceCode = `
function TestComponent() {
  function tickHandler() {
    console.log('tick');
  }
  
  const intervalId = setInterval(tickHandler, 1000);
  
  return <div>Test</div>;
}`;

            generator = createTimerCleanupFixGenerator(sourceCode, fileName);

            const leak: LeakDetectionResult = {
                type: 'uncleaned-interval',
                severity: 'high',
                file: fileName,
                line: 7,
                column: 21,
                description: 'setInterval with named function callback without cleanup',
                codeSnippet: 'setInterval(tickHandler, 1000)'
            };

            const result = generator.generateTimerCleanupFix(leak);

            assert.strictEqual(result.success, true);
            assert.ok(result.fix);
            assert.ok(result.fix.fixedCode.includes('clearInterval'));
            assert.strictEqual(result.fix.requiresManualReview, false); // Simple named functions are safe
        });
    });

    describe('variable name generation', () => {
        it('should generate appropriate variable names for intervals', () => {
            const sourceCode = `
function TestComponent() {
  setInterval(() => console.log('tick'), 1000);
  return <div>Test</div>;
}`;

            generator = createTimerCleanupFixGenerator(sourceCode, fileName);

            const leak: LeakDetectionResult = {
                type: 'uncleaned-interval',
                severity: 'high',
                file: fileName,
                line: 3,
                column: 3,
                description: 'Unassigned setInterval',
                codeSnippet: 'setInterval(() => console.log("tick"), 1000)'
            };

            const result = generator.generateTimerCleanupFix(leak);

            assert.strictEqual(result.success, true);
            assert.ok(result.fix);
            assert.ok(result.fix.fixedCode.includes('intervalId'));
            assert.ok(result.fix.fixedCode.includes('clearInterval(intervalId)'));
        });

        it('should generate appropriate variable names for timeouts', () => {
            const sourceCode = `
function TestComponent() {
  setTimeout(() => console.log('delayed'), 5000);
  return <div>Test</div>;
}`;

            generator = createTimerCleanupFixGenerator(sourceCode, fileName);

            const leak: LeakDetectionResult = {
                type: 'uncleaned-timeout',
                severity: 'medium',
                file: fileName,
                line: 3,
                column: 3,
                description: 'Unassigned setTimeout',
                codeSnippet: 'setTimeout(() => console.log("delayed"), 5000)'
            };

            const result = generator.generateTimerCleanupFix(leak);

            assert.strictEqual(result.success, true);
            assert.ok(result.fix);
            assert.ok(result.fix.fixedCode.includes('timeoutId'));
            assert.ok(result.fix.fixedCode.includes('clearTimeout(timeoutId)'));
        });
    });

    describe('confidence calculation', () => {
        it('should have high confidence for assigned timers in React components', () => {
            const sourceCode = `
function TestComponent() {
  const intervalId = setInterval(() => console.log('tick'), 1000);
  return <div>Test</div>;
}`;

            generator = createTimerCleanupFixGenerator(sourceCode, fileName);

            const leak: LeakDetectionResult = {
                type: 'uncleaned-interval',
                severity: 'high',
                file: fileName,
                line: 3,
                column: 21,
                description: 'Assigned setInterval in React component',
                codeSnippet: 'setInterval(() => console.log("tick"), 1000)'
            };

            const result = generator.generateTimerCleanupFix(leak);

            assert.strictEqual(result.success, true);
            assert.ok(result.fix);
            assert.strictEqual(result.fix.confidence, 0.95);
            assert.strictEqual(result.fix.requiresManualReview, false);
        });

        it('should have lower confidence for unassigned timers', () => {
            const sourceCode = `
function TestComponent() {
  setInterval(() => console.log('tick'), 1000);
  return <div>Test</div>;
}`;

            generator = createTimerCleanupFixGenerator(sourceCode, fileName);

            const leak: LeakDetectionResult = {
                type: 'uncleaned-interval',
                severity: 'high',
                file: fileName,
                line: 3,
                column: 3,
                description: 'Unassigned setInterval',
                codeSnippet: 'setInterval(() => console.log("tick"), 1000)'
            };

            const result = generator.generateTimerCleanupFix(leak);

            assert.strictEqual(result.success, true);
            assert.ok(result.fix);
            assert.ok(result.fix.confidence < 0.95);
            assert.strictEqual(result.fix.requiresManualReview, true);
        });

        it('should have lower confidence for non-React contexts', () => {
            const sourceCode = `
function regularFunction() {
  const intervalId = setInterval(() => console.log('tick'), 1000);
  return intervalId;
}`;

            generator = createTimerCleanupFixGenerator(sourceCode, fileName);

            const leak: LeakDetectionResult = {
                type: 'uncleaned-interval',
                severity: 'high',
                file: fileName,
                line: 3,
                column: 21,
                description: 'setInterval in regular function',
                codeSnippet: 'setInterval(() => console.log("tick"), 1000)'
            };

            const result = generator.generateTimerCleanupFix(leak);

            assert.strictEqual(result.success, true);
            assert.ok(result.fix);
            assert.ok(result.fix.confidence < 0.9);
            assert.strictEqual(result.fix.requiresManualReview, true);
        });
    });

    describe('error handling', () => {
        it('should handle missing timer call', () => {
            const sourceCode = `function test() {}`;
            generator = createTimerCleanupFixGenerator(sourceCode, fileName);

            const leak: LeakDetectionResult = {
                type: 'uncleaned-interval',
                severity: 'high',
                file: fileName,
                line: 1,
                column: 1,
                description: 'Invalid timer',
                codeSnippet: 'function test() {}'
            };

            const result = generator.generateTimerCleanupFix(leak);

            assert.strictEqual(result.success, false);
            assert.ok(result.error);
            assert.ok(result.error.includes('Could not find timer call'));
        });

        it('should handle invalid timer functions', () => {
            const sourceCode = `
function TestComponent() {
  invalidTimer(() => {}, 1000);
  return <div>Test</div>;
}`;

            generator = createTimerCleanupFixGenerator(sourceCode, fileName);

            const leak: LeakDetectionResult = {
                type: 'uncleaned-interval',
                severity: 'high',
                file: fileName,
                line: 3,
                column: 3,
                description: 'Invalid timer function',
                codeSnippet: 'invalidTimer(() => {}, 1000)'
            };

            const result = generator.generateTimerCleanupFix(leak);

            assert.strictEqual(result.success, false);
            assert.ok(result.error);
            assert.ok(result.error.includes('Could not analyze timer pattern'));
        });

        it('should handle invalid node positions', () => {
            const sourceCode = `function test() {}`;
            generator = createTimerCleanupFixGenerator(sourceCode, fileName);

            const leak: LeakDetectionResult = {
                type: 'uncleaned-interval',
                severity: 'high',
                file: fileName,
                line: 999,
                column: 999,
                description: 'Invalid position',
                codeSnippet: 'invalid'
            };

            const result = generator.generateTimerCleanupFix(leak);

            assert.strictEqual(result.success, false);
            assert.ok(result.error);
        });
    });

    describe('code preservation', () => {
        it('should preserve existing code structure', () => {
            const sourceCode = `
import React, { useState } from 'react';

function TestComponent({ interval = 1000 }) {
  const [count, setCount] = useState(0);
  
  const intervalId = setInterval(() => {
    setCount(prev => prev + 1);
  }, interval);
  
  return (
    <div className="counter">
      <p>Count: {count}</p>
      <button onClick={() => setCount(0)}>Reset</button>
    </div>
  );
}

export default TestComponent;`;

            generator = createTimerCleanupFixGenerator(sourceCode, fileName);

            const leak: LeakDetectionResult = {
                type: 'uncleaned-interval',
                severity: 'high',
                file: fileName,
                line: 7,
                column: 21,
                description: 'setInterval without cleanup',
                codeSnippet: 'setInterval(() => { setCount(prev => prev + 1); }, interval)'
            };

            const result = generator.generateTimerCleanupFix(leak);

            assert.strictEqual(result.success, true);
            assert.ok(result.fix);

            // Should preserve imports
            assert.ok(result.fix.fixedCode.includes('import React'));

            // Should preserve props
            assert.ok(result.fix.fixedCode.includes('{ interval = 1000 }'));

            // Should preserve state
            assert.ok(result.fix.fixedCode.includes('useState(0)'));

            // Should preserve JSX
            assert.ok(result.fix.fixedCode.includes('className="counter"'));

            // Should preserve export
            assert.ok(result.fix.fixedCode.includes('export default'));

            // Should add cleanup
            assert.ok(result.fix.fixedCode.includes('clearInterval'));
        });
    });
});