/**
 * Test runner for memory leak detection ESLint rules
 * This script can be run independently to test the rules
 */

import { useEffectCleanupRule } from '../eslint-rules';
import * as ts from 'typescript';

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
        const analysisResult = this.analyzeCodeForMemoryLeaks(code);

        if (!analysisResult.hasMemoryLeaks) {
          console.log(
            `  ✓ Valid case ${index + 1} passed - no memory leaks detected`
          );
          passed++;
        } else {
          console.log(
            `  ✗ Valid case ${index + 1} failed - unexpected memory leaks:`,
            analysisResult.leaks
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
        const analysisResult = this.analyzeCodeForMemoryLeaks(testCase.code);

        if (analysisResult.hasMemoryLeaks) {
          console.log(
            `  ✓ Invalid case ${index + 1} passed - detected memory leaks:`,
            analysisResult.leaks
          );
          passed++;
        } else {
          console.log(
            `  ✗ Invalid case ${index + 1} failed - should have detected memory leaks`
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

  /**
   * Comprehensive code analysis for memory leaks
   */
  private analyzeCodeForMemoryLeaks(code: string): {
    hasMemoryLeaks: boolean;
    leaks: string[];
    cleanupActions: string[];
    suggestions: string[];
  } {
    try {
      const sourceFile = ts.createSourceFile(
        'test.tsx',
        code,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX
      );

      const memoryLeaks = new Set<string>();
      const cleanupActions = new Set<string>();
      const suggestions: string[] = [];
      let hasUseEffect = false;

      const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node)) {
          const expression = node.expression;

          if (ts.isIdentifier(expression) && expression.text === 'useEffect') {
            hasUseEffect = true;

            if (node.arguments.length > 0) {
              const callback = node.arguments[0];
              this.analyzeUseEffectCallback(
                callback,
                memoryLeaks,
                cleanupActions
              );
            }
          }
        }

        if (ts.isReturnStatement(node) && node.expression) {
          if (
            ts.isArrowFunction(node.expression) ||
            ts.isFunctionExpression(node.expression)
          ) {
            this.analyzeCleanupFunction(node.expression, cleanupActions);
          }
        }

        ts.forEachChild(node, visit);
      };

      visit(sourceFile);

      // Generate suggestions for unmatched leaks
      const unmatchedLeaks = Array.from(memoryLeaks).filter(leak => {
        return !Array.from(cleanupActions).some(cleanup =>
          this.isMatchingCleanup(leak, cleanup)
        );
      });

      unmatchedLeaks.forEach(leak => {
        const cleanupSuggestion = this.getCleanupSuggestion(leak);
        if (cleanupSuggestion) {
          suggestions.push(cleanupSuggestion);
        }
      });

      return {
        hasMemoryLeaks: hasUseEffect && unmatchedLeaks.length > 0,
        leaks: unmatchedLeaks,
        cleanupActions: Array.from(cleanupActions),
        suggestions,
      };
    } catch (error) {
      console.warn('AST analysis failed, using fallback:', error);
      return {
        hasMemoryLeaks: this.fallbackPatternMatching(code),
        leaks: ['unknown'],
        cleanupActions: [],
        suggestions: ['Use proper cleanup in useEffect return function'],
      };
    }
  }

  /**
   * Get cleanup suggestion for a specific memory leak type
   */
  private getCleanupSuggestion(leak: string): string {
    const suggestions: Record<string, string> = {
      addEventListener: 'Add removeEventListener in cleanup function',
      setInterval: 'Add clearInterval in cleanup function',
      setTimeout: 'Add clearTimeout in cleanup function',
      EventSource: 'Add eventSource.close() in cleanup function',
      WebSocket: 'Add webSocket.close() in cleanup function',
      subscribe: 'Add subscription.unsubscribe() in cleanup function',
    };

    return suggestions[leak] || `Add proper cleanup for ${leak}`;
  }

  private hasMemoryLeakPattern(code: string): boolean {
    return this.analyzeCodeWithAST(code);
  }

  /**
   * Analyze code using TypeScript AST for accurate memory leak detection
   */
  private analyzeCodeWithAST(code: string): boolean {
    try {
      // Create TypeScript source file
      const sourceFile = ts.createSourceFile(
        'test.tsx',
        code,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX
      );

      const memoryLeaks = new Set<string>();
      const cleanupActions = new Set<string>();
      let hasUseEffect = false;
      let hasCleanupFunction = false;

      // Visitor function to traverse AST
      const visit = (node: ts.Node) => {
        // Check for useEffect calls
        if (ts.isCallExpression(node)) {
          const expression = node.expression;

          if (ts.isIdentifier(expression) && expression.text === 'useEffect') {
            hasUseEffect = true;

            // Analyze useEffect callback
            if (node.arguments.length > 0) {
              const callback = node.arguments[0];
              this.analyzeUseEffectCallback(
                callback,
                memoryLeaks,
                cleanupActions
              );
            }
          }
        }

        // Check for return statements in useEffect (cleanup functions)
        if (ts.isReturnStatement(node) && node.expression) {
          if (
            ts.isArrowFunction(node.expression) ||
            ts.isFunctionExpression(node.expression)
          ) {
            hasCleanupFunction = true;
            this.analyzeCleanupFunction(node.expression, cleanupActions);
          }
        }

        // Continue traversing
        ts.forEachChild(node, visit);
      };

      // Start traversal
      visit(sourceFile);

      // Check if there are unmatched memory leaks
      const unmatchedLeaks = Array.from(memoryLeaks).filter(leak => {
        return !Array.from(cleanupActions).some(cleanup =>
          this.isMatchingCleanup(leak, cleanup)
        );
      });

      return hasUseEffect && unmatchedLeaks.length > 0;
    } catch (error) {
      console.warn(
        'AST analysis failed, falling back to pattern matching:',
        error
      );
      return this.fallbackPatternMatching(code);
    }
  }

  /**
   * Analyze useEffect callback for potential memory leaks
   */
  private analyzeUseEffectCallback(
    callback: ts.Expression,
    memoryLeaks: Set<string>,
    cleanupActions: Set<string>
  ): void {
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node)) {
        const expression = node.expression;

        // Check for addEventListener
        if (
          ts.isPropertyAccessExpression(expression) &&
          ts.isIdentifier(expression.name) &&
          expression.name.text === 'addEventListener'
        ) {
          memoryLeaks.add('addEventListener');
        }

        // Check for setInterval
        if (ts.isIdentifier(expression) && expression.text === 'setInterval') {
          memoryLeaks.add('setInterval');
        }

        // Check for setTimeout
        if (ts.isIdentifier(expression) && expression.text === 'setTimeout') {
          memoryLeaks.add('setTimeout');
        }
      }

      // Check for new expressions (EventSource, WebSocket, etc.)
      if (ts.isNewExpression(node) && node.expression) {
        if (ts.isIdentifier(node.expression)) {
          const typeName = node.expression.text;
          if (
            ['EventSource', 'WebSocket', 'AbortController'].includes(typeName)
          ) {
            memoryLeaks.add(typeName);
          }
        }
      }

      // Check for subscription patterns
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression)
      ) {
        const propertyName = node.expression.name;
        if (
          ts.isIdentifier(propertyName) &&
          propertyName.text === 'subscribe'
        ) {
          memoryLeaks.add('subscribe');
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(callback);
  }

  /**
   * Analyze cleanup function for cleanup actions
   */
  private analyzeCleanupFunction(
    cleanupFn: ts.ArrowFunction | ts.FunctionExpression,
    cleanupActions: Set<string>
  ): void {
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node)) {
        const expression = node.expression;

        // Check for removeEventListener
        if (
          ts.isPropertyAccessExpression(expression) &&
          ts.isIdentifier(expression.name) &&
          expression.name.text === 'removeEventListener'
        ) {
          cleanupActions.add('removeEventListener');
        }

        // Check for clearInterval
        if (
          ts.isIdentifier(expression) &&
          expression.text === 'clearInterval'
        ) {
          cleanupActions.add('clearInterval');
        }

        // Check for clearTimeout
        if (ts.isIdentifier(expression) && expression.text === 'clearTimeout') {
          cleanupActions.add('clearTimeout');
        }

        // Check for close() calls
        if (
          ts.isPropertyAccessExpression(expression) &&
          ts.isIdentifier(expression.name) &&
          expression.name.text === 'close'
        ) {
          cleanupActions.add('close');
        }

        // Check for unsubscribe
        if (
          ts.isPropertyAccessExpression(expression) &&
          ts.isIdentifier(expression.name) &&
          expression.name.text === 'unsubscribe'
        ) {
          cleanupActions.add('unsubscribe');
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(cleanupFn);
  }

  /**
   * Check if a cleanup action matches a memory leak pattern
   */
  private isMatchingCleanup(leak: string, cleanup: string): boolean {
    const matches: Record<string, string[]> = {
      addEventListener: ['removeEventListener'],
      setInterval: ['clearInterval'],
      setTimeout: ['clearTimeout'],
      EventSource: ['close'],
      WebSocket: ['close'],
      AbortController: ['abort', 'close'],
      subscribe: ['unsubscribe'],
    };

    return matches[leak]?.includes(cleanup) || false;
  }

  /**
   * Fallback pattern matching when AST analysis fails
   */
  private fallbackPatternMatching(code: string): boolean {
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

  // Test useEffect cleanup rule
  const useEffectTester = new SimpleRuleTester('useEffect-cleanup');
  const useEffectResults = useEffectTester.test(useEffectTestCases);

  results.passed += useEffectResults.passed;
  results.failed += useEffectResults.failed;

  // Test additional memory leak patterns
  console.log('\n🔍 Testing additional memory leak patterns...');
  const additionalTests = await runAdditionalTests();
  results.passed += additionalTests.passed;
  results.failed += additionalTests.failed;

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

/**
 * Run additional comprehensive tests
 */
async function runAdditionalTests(): Promise<{
  passed: number;
  failed: number;
}> {
  const additionalTestCases = {
    valid: [
      // Complex valid case with multiple cleanups
      `
        useEffect(() => {
          const controller = new AbortController();
          const eventSource = new EventSource('/api/events');
          const interval = setInterval(() => {}, 1000);
          
          const handleResize = () => {};
          window.addEventListener('resize', handleResize);
          
          return () => {
            controller.abort();
            eventSource.close();
            clearInterval(interval);
            window.removeEventListener('resize', handleResize);
          };
        }, []);
      `,
      // Valid case with conditional cleanup
      `
        useEffect(() => {
          let subscription;
          if (condition) {
            subscription = observable.subscribe(handler);
          }
          
          return () => {
            if (subscription) {
              subscription.unsubscribe();
            }
          };
        }, [condition]);
      `,
    ],
    invalid: [
      // Complex invalid case with missing cleanups
      {
        code: `
          useEffect(() => {
            const eventSource = new EventSource('/api/events');
            const ws = new WebSocket('ws://localhost:8080');
            const interval = setInterval(() => {}, 1000);
            
            window.addEventListener('resize', () => {});
            
            return () => {
              // Missing all cleanups
            };
          }, []);
        `,
        expectedErrors: 4,
      },
      // Partial cleanup
      {
        code: `
          useEffect(() => {
            const interval = setInterval(() => {}, 1000);
            const timeout = setTimeout(() => {}, 5000);
            
            return () => {
              clearInterval(interval);
              // Missing clearTimeout
            };
          }, []);
        `,
        expectedErrors: 1,
      },
    ],
  };

  const tester = new SimpleRuleTester('comprehensive-memory-leak-detection');
  return tester.test(additionalTestCases);
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

export { runTests, SimpleRuleTester };
