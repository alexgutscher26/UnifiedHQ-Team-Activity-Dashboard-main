import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { createEventListenerFixGenerator } from '../event-listener-fix-generator';
import { LeakDetectionResult } from '../memory-leak-detection-patterns';

describe('EventListenerFixGenerator', () => {
  let generator: ReturnType<typeof createEventListenerFixGenerator>;
  const fileName = 'test-component.tsx';

  beforeEach(() => {
    // Reset generator for each test
  });

  describe('basic event listener cleanup', () => {
    it('should fix document event listener', () => {
      const sourceCode = `
function TestComponent() {
  const handleClick = () => console.log('clicked');
  document.addEventListener('click', handleClick);
  return <div>Test</div>;
}`;

      generator = createEventListenerFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'uncleaned-event-listener',
        severity: 'medium',
        file: fileName,
        line: 4,
        column: 3,
        description: 'Event listener without cleanup',
        codeSnippet: "document.addEventListener('click', handleClick)",
      };

      const result = generator.generateEventListenerCleanupFix(leak);

      assert.strictEqual(result.success, true);
      assert.ok(result.fix);
      assert.ok(result.fix.fixedCode.includes('document.removeEventListener'));
      assert.ok(result.fix.fixedCode.includes('useEffect'));
      assert.ok(result.fix.fixedCode.includes('return () => {'));
    });

    it('should fix window event listener', () => {
      const sourceCode = `
function TestComponent() {
  const handleResize = () => {};
  window.addEventListener('resize', handleResize);
  return <div>Test</div>;
}`;

      generator = createEventListenerFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'uncleaned-event-listener',
        severity: 'medium',
        file: fileName,
        line: 4,
        column: 3,
        description: 'Window event listener without cleanup',
        codeSnippet: "window.addEventListener('resize', handleResize)",
      };

      const result = generator.generateEventListenerCleanupFix(leak);

      assert.strictEqual(result.success, true);
      assert.ok(result.fix);
      assert.ok(result.fix.fixedCode.includes('window.removeEventListener'));
      assert.ok(result.fix.description.includes('window event'));
    });

    it('should handle event listeners with options', () => {
      const sourceCode = `
function TestComponent() {
  const handleScroll = () => {};
  element.addEventListener('scroll', handleScroll, { passive: true });
  return <div>Test</div>;
}`;

      generator = createEventListenerFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'uncleaned-event-listener',
        severity: 'medium',
        file: fileName,
        line: 4,
        column: 3,
        description: 'Event listener with options without cleanup',
        codeSnippet:
          "element.addEventListener('scroll', handleScroll, { passive: true })",
      };

      const result = generator.generateEventListenerCleanupFix(leak);

      assert.strictEqual(result.success, true);
      assert.ok(result.fix);
      assert.ok(result.fix.fixedCode.includes('{ passive: true }'));
      assert.ok(result.fix.fixedCode.includes('element.removeEventListener'));
    });
  });

  describe('media query event listeners', () => {
    it('should fix media query listener', () => {
      const sourceCode = `
function TestComponent() {
  const mediaQuery = window.matchMedia('(max-width: 768px)');
  const handleChange = () => {};
  mediaQuery.addEventListener('change', handleChange);
  return <div>Test</div>;
}`;

      generator = createEventListenerFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'uncleaned-event-listener',
        severity: 'medium',
        file: fileName,
        line: 5,
        column: 3,
        description: 'Media query listener without cleanup',
        codeSnippet: "mediaQuery.addEventListener('change', handleChange)",
      };

      const result = generator.generateEventListenerCleanupFix(leak);

      assert.strictEqual(result.success, true);
      assert.ok(result.fix);
      assert.ok(
        result.fix.fixedCode.includes('mediaQuery.removeEventListener')
      );
      assert.ok(result.fix.description.includes('media query'));
    });
  });

  describe('inline handler patterns', () => {
    it('should handle inline arrow function handlers', () => {
      const sourceCode = `
function TestComponent() {
  document.addEventListener('click', () => console.log('clicked'));
  return <div>Test</div>;
}`;

      generator = createEventListenerFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'uncleaned-event-listener',
        severity: 'medium',
        file: fileName,
        line: 3,
        column: 3,
        description: 'Inline event listener without cleanup',
        codeSnippet:
          "document.addEventListener('click', () => console.log('clicked'))",
      };

      const result = generator.generateEventListenerCleanupFix(leak);

      assert.strictEqual(result.success, true);
      assert.ok(result.fix);
      assert.strictEqual(result.fix.requiresManualReview, true);
      assert.ok(result.fix.confidence < 0.9); // Lower confidence for inline handlers
    });

    it('should handle inline function expression handlers', () => {
      const sourceCode = `
function TestComponent() {
  element.addEventListener('click', function(e) { 
    e.preventDefault(); 
  });
  return <div>Test</div>;
}`;

      generator = createEventListenerFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'uncleaned-event-listener',
        severity: 'medium',
        file: fileName,
        line: 3,
        column: 3,
        description: 'Inline function event listener without cleanup',
        codeSnippet:
          "element.addEventListener('click', function(e) { e.preventDefault(); })",
      };

      const result = generator.generateEventListenerCleanupFix(leak);

      assert.strictEqual(result.success, true);
      assert.ok(result.fix);
      assert.strictEqual(result.fix.requiresManualReview, true);
    });
  });

  describe('useEffect integration', () => {
    it('should add to existing useEffect cleanup', () => {
      const sourceCode = `
function TestComponent() {
  useEffect(() => {
    const handleClick = () => {};
    document.addEventListener('click', handleClick);
    
    return () => {
      // Existing cleanup
      console.log('cleanup');
    };
  }, []);
  
  return <div>Test</div>;
}`;

      generator = createEventListenerFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'uncleaned-event-listener',
        severity: 'medium',
        file: fileName,
        line: 5,
        column: 5,
        description: 'Event listener in useEffect without cleanup',
        codeSnippet: "document.addEventListener('click', handleClick)",
      };

      const result = generator.generateEventListenerCleanupFix(leak);

      assert.strictEqual(result.success, true);
      assert.ok(result.fix);
      assert.ok(result.fix.fixedCode.includes('Existing cleanup'));
      assert.ok(result.fix.fixedCode.includes('removeEventListener'));
    });

    it('should create cleanup function in useEffect without existing cleanup', () => {
      const sourceCode = `
function TestComponent() {
  useEffect(() => {
    const handleClick = () => {};
    document.addEventListener('click', handleClick);
  }, []);
  
  return <div>Test</div>;
}`;

      generator = createEventListenerFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'uncleaned-event-listener',
        severity: 'medium',
        file: fileName,
        line: 5,
        column: 5,
        description: 'Event listener in useEffect without cleanup',
        codeSnippet: "document.addEventListener('click', handleClick)",
      };

      const result = generator.generateEventListenerCleanupFix(leak);

      assert.strictEqual(result.success, true);
      assert.ok(result.fix);
      assert.ok(result.fix.fixedCode.includes('return () => {'));
      assert.ok(result.fix.fixedCode.includes('removeEventListener'));
    });
  });

  describe('React component detection', () => {
    it('should detect React component and wrap in useEffect', () => {
      const sourceCode = `
function TestComponent() {
  const handleClick = () => {};
  document.addEventListener('click', handleClick);
  
  return <div>Test Component</div>;
}`;

      generator = createEventListenerFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'uncleaned-event-listener',
        severity: 'medium',
        file: fileName,
        line: 4,
        column: 3,
        description: 'Event listener in React component without cleanup',
        codeSnippet: "document.addEventListener('click', handleClick)",
      };

      const result = generator.generateEventListenerCleanupFix(leak);

      assert.strictEqual(result.success, true);
      assert.ok(result.fix);
      assert.ok(result.fix.fixedCode.includes('useEffect(() => {'));
      assert.ok(result.fix.fixedCode.includes('}, []);'));
    });

    it('should handle arrow function components', () => {
      const sourceCode = `
const TestComponent = () => {
  const handleClick = () => {};
  document.addEventListener('click', handleClick);
  
  return <div>Test Component</div>;
};`;

      generator = createEventListenerFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'uncleaned-event-listener',
        severity: 'medium',
        file: fileName,
        line: 4,
        column: 3,
        description:
          'Event listener in arrow function component without cleanup',
        codeSnippet: "document.addEventListener('click', handleClick)",
      };

      const result = generator.generateEventListenerCleanupFix(leak);

      assert.strictEqual(result.success, true);
      assert.ok(result.fix);
      assert.ok(result.fix.fixedCode.includes('useEffect'));
    });
  });

  describe('confidence calculation', () => {
    it('should have high confidence for simple reference handlers', () => {
      const sourceCode = `
function TestComponent() {
  const handleClick = () => {};
  document.addEventListener('click', handleClick);
  return <div>Test</div>;
}`;

      generator = createEventListenerFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'uncleaned-event-listener',
        severity: 'medium',
        file: fileName,
        line: 4,
        column: 3,
        description: 'Simple event listener without cleanup',
        codeSnippet: "document.addEventListener('click', handleClick)",
      };

      const result = generator.generateEventListenerCleanupFix(leak);

      assert.strictEqual(result.success, true);
      assert.ok(result.fix);
      assert.ok(result.fix.confidence >= 0.9);
      assert.strictEqual(result.fix.requiresManualReview, false);
    });

    it('should have lower confidence for inline handlers', () => {
      const sourceCode = `
function TestComponent() {
  document.addEventListener('click', () => {
    // Complex inline handler
    doSomethingComplex();
    handleMultipleThings();
  });
  return <div>Test</div>;
}`;

      generator = createEventListenerFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'uncleaned-event-listener',
        severity: 'medium',
        file: fileName,
        line: 3,
        column: 3,
        description: 'Complex inline event listener without cleanup',
        codeSnippet: "document.addEventListener('click', () => { ... })",
      };

      const result = generator.generateEventListenerCleanupFix(leak);

      assert.strictEqual(result.success, true);
      assert.ok(result.fix);
      assert.ok(result.fix.confidence < 0.9);
      assert.strictEqual(result.fix.requiresManualReview, true);
    });
  });

  describe('error handling', () => {
    it('should handle missing addEventListener call', () => {
      const sourceCode = "function test() {}";
      generator = createEventListenerFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'uncleaned-event-listener',
        severity: 'medium',
        file: fileName,
        line: 1,
        column: 1,
        description: 'Invalid event listener',
        codeSnippet: 'function test() {}',
      };

      const result = generator.generateEventListenerCleanupFix(leak);

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
      assert.ok(result.error.includes('Could not find addEventListener call'));
    });

    it('should handle malformed addEventListener calls', () => {
      const sourceCode = `
function TestComponent() {
  document.addEventListener();
  return <div>Test</div>;
}`;

      generator = createEventListenerFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'uncleaned-event-listener',
        severity: 'medium',
        file: fileName,
        line: 3,
        column: 3,
        description: 'Malformed addEventListener call',
        codeSnippet: 'document.addEventListener()',
      };

      const result = generator.generateEventListenerCleanupFix(leak);

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
      assert.ok(
        result.error.includes('Could not analyze event listener pattern')
      );
    });

    it('should handle invalid node positions', () => {
      const sourceCode = "function test() {}";
      generator = createEventListenerFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'uncleaned-event-listener',
        severity: 'medium',
        file: fileName,
        line: 999,
        column: 999,
        description: 'Invalid position',
        codeSnippet: 'invalid',
      };

      const result = generator.generateEventListenerCleanupFix(leak);

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
    });
  });

  describe('code preservation', () => {
    it('should preserve existing code structure', () => {
      const sourceCode = `
import React from 'react';

function TestComponent({ onClick }) {
  const [state, setState] = React.useState(false);
  
  const handleClick = () => {
    setState(true);
    onClick?.();
  };
  
  document.addEventListener('click', handleClick);
  
  return (
    <div className="test-component">
      <button>Click me</button>
    </div>
  );
}

export default TestComponent;`;

      generator = createEventListenerFixGenerator(sourceCode, fileName);

      const leak: LeakDetectionResult = {
        type: 'uncleaned-event-listener',
        severity: 'medium',
        file: fileName,
        line: 12,
        column: 3,
        description: 'Event listener without cleanup',
        codeSnippet: "document.addEventListener('click', handleClick)",
      };

      const result = generator.generateEventListenerCleanupFix(leak);

      assert.strictEqual(result.success, true);
      assert.ok(result.fix);

      // Should preserve imports
      assert.ok(result.fix.fixedCode.includes('import React'));

      // Should preserve props
      assert.ok(result.fix.fixedCode.includes('{ onClick }'));

      // Should preserve state
      assert.ok(result.fix.fixedCode.includes('useState(false)'));

      // Should preserve JSX
      assert.ok(result.fix.fixedCode.includes('className="test-component"'));

      // Should preserve export
      assert.ok(result.fix.fixedCode.includes('export default'));

      // Should add cleanup
      assert.ok(result.fix.fixedCode.includes('removeEventListener'));
    });
  });
});
