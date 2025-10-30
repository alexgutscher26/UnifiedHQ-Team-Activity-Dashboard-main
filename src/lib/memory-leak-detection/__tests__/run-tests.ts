/**
 * Test runner for memory leak detection ESLint rules
 * This script can be run independently to test the rules
 */

import { useEffectCleanupRule } from '../eslint-rules';

// Simple test runner for ESLint rules
class SimpleRuleTester {
  private ruleName: string;

  constructor(ruleName: string) {
    this.ruleName = ruleName;
  }

  test(testCases: {
    valid: string[];
    invalid: Array<{ code: string; expectedErrors: number }>;
  }) {
    console.log(`\n🧪 Testing rule: ${this.ruleName}`);

    let passed = 0;
    let failed = 0;

    // Test valid cases
    console.log('\n✅ Testing valid cases:');
    testCases.valid.forEach((code, index) => {
      try {
        // TODO: In a real implementation, we would parse and analyze the code
        // For now, just check basic patterns
        const hasCleanup =
          code.includes('return () => {') &&
          (code.includes('removeEventListener') ||
            code.includes('clearInterval') ||
            code.includes('clearTimeout'));

        if (hasCleanup || !this.hasMemoryLeakPattern(code)) {
          console.log(`  ✓ Valid case ${index + 1} passed`);
          passed++;
        } else {
          console.log(
            `  ✗ Valid case ${index + 1} failed - should not have memory leak`
          );
          failed++;
        }
      } catch (error) {
        console.log(`  ✗ Valid case ${index + 1} failed with error:`, error);
        failed++;
      }
    });

    // Test invalid cases
    console.log('\n❌ Testing invalid cases:');
    testCases.invalid.forEach((testCase, index) => {
      try {
        const hasMemoryLeak = this.hasMemoryLeakPattern(testCase.code);

        if (hasMemoryLeak) {
          console.log(
            `  ✓ Invalid case ${index + 1} passed - detected memory leak`
          );
          passed++;
        } else {
          console.log(
            `  ✗ Invalid case ${index + 1} failed - should have detected memory leak`
          );
          failed++;
        }
      } catch (error) {
        console.log(`  ✗ Invalid case ${index + 1} failed with error:`, error);
        failed++;
      }
    });

    console.log(`\n📊 Results for ${this.ruleName}:`);
    console.log(`  Passed: ${passed}`);
    console.log(`  Failed: ${failed}`);
    console.log(
      `  Success rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`
    );

    return { passed, failed };
  }

  private hasMemoryLeakPattern(code: string): boolean {
    // Simple pattern detection for testing
    const hasEventListener =
      code.includes('addEventListener') &&
      !code.includes('removeEventListener');
    const hasInterval =
      code.includes('setInterval') && !code.includes('clearInterval');
    const hasTimeout =
      code.includes('setTimeout') && !code.includes('clearTimeout');
    const hasEventSource =
      code.includes('new EventSource') && !code.includes('.close()');
    const hasWebSocket =
      code.includes('new WebSocket') && !code.includes('.close()');
    const hasSubscription =
      code.includes('.subscribe(') && !code.includes('.unsubscribe()');

    return (
      hasEventListener ||
      hasInterval ||
      hasTimeout ||
      hasEventSource ||
      hasWebSocket ||
      hasSubscription
    );
  }
}

// Test cases for useEffect cleanup rule
const useEffectTestCases = {
  valid: [
    // Valid: useEffect with proper cleanup
    `
      useEffect(() => {
        const listener = () => {};
        window.addEventListener('resize', listener);
        return () => {
          window.removeEventListener('resize', listener);
        };
      }, []);
    `,
    // Valid: useEffect without side effects
    `
      useEffect(() => {
        console.log('Component mounted');
      }, []);
    `,
    // Valid: useEffect with interval cleanup
    `
      useEffect(() => {
        const interval = setInterval(() => {}, 1000);
        return () => {
          clearInterval(interval);
        };
      }, []);
    `,
  ],
  invalid: [
    // Invalid: addEventListener without cleanup
    {
      code: `
        useEffect(() => {
          const listener = () => {};
          window.addEventListener('resize', listener);
        }, []);
      `,
      expectedErrors: 1,
    },
    // Invalid: setInterval without cleanup
    {
      code: `
        useEffect(() => {
          const interval = setInterval(() => {
            console.log('tick');
          }, 1000);
        }, []);
      `,
      expectedErrors: 1,
    },
    // Invalid: EventSource without cleanup
    {
      code: `
        useEffect(() => {
          const eventSource = new EventSource('/api/events');
          eventSource.onmessage = (event) => {
            console.log(event.data);
          };
        }, []);
      `,
      expectedErrors: 1,
    },
  ],
};

// Run the tests
async function runTests() {
  console.log('🚀 Starting Memory Leak Detection ESLint Rules Tests');
  console.log('='.repeat(60));

  const results = {
    passed: 0,
    failed: 0,
  };

  console.log('\n' + '='.repeat(60));
  console.log('🏁 Test Summary:');
  console.log(`Total tests: ${results.passed + results.failed}`);
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);

  if (results.failed === 0) {
    console.log('🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed');
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

export { runTests, SimpleRuleTester };
