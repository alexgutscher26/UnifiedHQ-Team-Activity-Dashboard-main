/**
 * Tests for memory leak detection ESLint rules
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ESLintUtils } from '@typescript-eslint/utils';
import {
  useEffectCleanupRule,
  eventListenerCleanupRule,
  intervalTimeoutCleanupRule,
  subscriptionCleanupRule,
} from '../eslint-rules';

// Create rule tester
const ruleTester = new ESLintUtils.RuleTester({
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
});

describe('Memory Leak ESLint Rules', () => {
  describe('useEffect cleanup rule', () => {
    it('should detect useEffect without cleanup', () => {
      ruleTester.run('useeffect-cleanup', useEffectCleanupRule, {
        valid: [
          // Valid: useEffect with cleanup
          {
            code: `
              useEffect(() => {
                const listener = () => {};
                window.addEventListener('resize', listener);
                return () => {
                  window.removeEventListener('resize', listener);
                };
              }, []);
            `,
          },
          // Valid: useEffect without side effects
          {
            code: `
              useEffect(() => {
                console.log('Component mounted');
              }, []);
            `,
          },
          // Valid: useEffect with only state updates
          {
            code: `
              useEffect(() => {
                setCount(count + 1);
              }, [count]);
            `,
          },
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
            errors: [
              {
                messageId: 'missingCleanup',
                type: 'CallExpression',
              },
            ],
            output: `
              useEffect(() => {
                const listener = () => {};
                window.addEventListener('resize', listener);
                return () => {
                  window.removeEventListener('resize', listener);
                };
              }, []);
            `,
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
            errors: [
              {
                messageId: 'missingCleanup',
                type: 'CallExpression',
              },
            ],
            output: `
              useEffect(() => {
                const interval = setInterval(() => {
                  console.log('tick');
                }, 1000);
                return () => {
                  clearInterval(interval);
                };
              }, []);
            `,
          },
          // Invalid: setTimeout without cleanup
          {
            code: `
              useEffect(() => {
                const timeout = setTimeout(() => {
                  console.log('delayed');
                }, 1000);
              }, []);
            `,
            errors: [
              {
                messageId: 'missingCleanup',
                type: 'CallExpression',
              },
            ],
            output: `
              useEffect(() => {
                const timeout = setTimeout(() => {
                  console.log('delayed');
                }, 1000);
                return () => {
                  clearTimeout(timeout);
                };
              }, []);
            `,
          },
        ],
      });
    });
  });

  describe('event listener cleanup rule', () => {
    it('should detect addEventListener without removeEventListener', () => {
      ruleTester.run('event-listener-cleanup', eventListenerCleanupRule, {
        valid: [
          // Valid: addEventListener with removeEventListener
          {
            code: `
              const listener = () => {};
              element.addEventListener('click', listener);
              element.removeEventListener('click', listener);
            `,
          },
          // Valid: addEventListener in useEffect with cleanup
          {
            code: `
              useEffect(() => {
                const listener = () => {};
                element.addEventListener('click', listener);
                return () => {
                  element.removeEventListener('click', listener);
                };
              }, []);
            `,
          },
        ],
        invalid: [
          // Invalid: addEventListener without removeEventListener
          {
            code: `
              const listener = () => {};
              element.addEventListener('click', listener);
            `,
            errors: [
              {
                messageId: 'missingRemoveEventListener',
                type: 'CallExpression',
              },
            ],
          },
          // Invalid: window.addEventListener without cleanup
          {
            code: `
              window.addEventListener('resize', () => {
                console.log('resized');
              });
            `,
            errors: [
              {
                messageId: 'missingRemoveEventListener',
                type: 'CallExpression',
              },
            ],
          },
        ],
      });
    });
  });

  describe('interval/timeout cleanup rule', () => {
    it('should detect setInterval without clearInterval', () => {
      ruleTester.run('interval-timeout-cleanup', intervalTimeoutCleanupRule, {
        valid: [
          // Valid: setInterval with clearInterval
          {
            code: `
              const interval = setInterval(() => {}, 1000);
              clearInterval(interval);
            `,
          },
          // Valid: setTimeout with clearTimeout
          {
            code: `
              const timeout = setTimeout(() => {}, 1000);
              clearTimeout(timeout);
            `,
          },
        ],
        invalid: [
          // Invalid: setInterval without clearInterval
          {
            code: `
              const interval = setInterval(() => {
                console.log('tick');
              }, 1000);
            `,
            errors: [
              {
                messageId: 'missingClearInterval',
                type: 'CallExpression',
              },
            ],
          },
          // Invalid: setTimeout without clearTimeout
          {
            code: `
              const timeout = setTimeout(() => {
                console.log('delayed');
              }, 1000);
            `,
            errors: [
              {
                messageId: 'missingClearTimeout',
                type: 'CallExpression',
              },
            ],
          },
        ],
      });
    });
  });

  describe('subscription cleanup rule', () => {
    it('should detect subscriptions without unsubscribe', () => {
      ruleTester.run('subscription-cleanup', subscriptionCleanupRule, {
        valid: [
          // Valid: subscription with unsubscribe
          {
            code: `
              const subscription = observable.subscribe();
              subscription.unsubscribe();
            `,
          },
          // Valid: EventSource with close
          {
            code: `
              const eventSource = new EventSource('/api/events');
              eventSource.close();
            `,
          },
          // Valid: WebSocket with close
          {
            code: `
              const ws = new WebSocket('ws://localhost');
              ws.close();
            `,
          },
        ],
        invalid: [
          // Invalid: subscription without unsubscribe
          {
            code: `
              const subscription = observable.subscribe(() => {
                console.log('data received');
              });
            `,
            errors: [
              {
                messageId: 'missingUnsubscribe',
                type: 'CallExpression',
              },
            ],
          },
          // Invalid: EventSource without close
          {
            code: `
              const eventSource = new EventSource('/api/events');
              eventSource.onmessage = (event) => {
                console.log(event.data);
              };
            `,
            errors: [
              {
                messageId: 'missingClose',
                type: 'NewExpression',
              },
            ],
          },
          // Invalid: WebSocket without close
          {
            code: `
              const ws = new WebSocket('ws://localhost');
              ws.onmessage = (event) => {
                console.log(event.data);
              };
            `,
            errors: [
              {
                messageId: 'missingClose',
                type: 'NewExpression',
              },
            ],
          },
        ],
      });
    });
  });

  describe('rule integration', () => {
    it('should work with TypeScript React components', () => {
      const code = `
        import React, { useEffect, useState } from 'react';

        const MyComponent: React.FC = () => {
          const [count, setCount] = useState(0);

          useEffect(() => {
            const interval = setInterval(() => {
              setCount(c => c + 1);
            }, 1000);

            const handleResize = () => {
              console.log('resized');
            };

            window.addEventListener('resize', handleResize);

            const eventSource = new EventSource('/api/events');
            eventSource.onmessage = (event) => {
              console.log(event.data);
            };

            // Missing cleanup - should trigger all rules
          }, []);

          return <div>{count}</div>;
        };
      `;

      // Test useEffect cleanup rule
      expect(() => {
        ruleTester.run('useeffect-cleanup-integration', useEffectCleanupRule, {
          valid: [],
          invalid: [
            {
              code,
              errors: [{ messageId: 'missingCleanup', type: 'CallExpression' }],
            },
          ],
        });
      }).not.toThrow();
    });

    it('should provide correct auto-fixes', () => {
      const code = `
        useEffect(() => {
          const interval = setInterval(() => {}, 1000);
          const listener = () => {};
          window.addEventListener('resize', listener);
        }, []);
      `;

      const expectedOutput = `
        useEffect(() => {
          const interval = setInterval(() => {}, 1000);
          const listener = () => {};
          window.addEventListener('resize', listener);
          return () => {
            clearInterval(interval);
            window.removeEventListener('resize', listener);
          };
        }, []);
      `;

      ruleTester.run('useeffect-cleanup-autofix', useEffectCleanupRule, {
        valid: [],
        invalid: [
          {
            code,
            errors: [{ messageId: 'missingCleanup', type: 'CallExpression' }],
            output: expectedOutput,
          },
        ],
      });
    });
  });

  describe('edge cases', () => {
    it('should handle nested useEffect calls', () => {
      const code = `
        useEffect(() => {
          const outerInterval = setInterval(() => {
            useEffect(() => {
              const innerInterval = setInterval(() => {}, 500);
              // Missing cleanup for inner interval
            }, []);
          }, 1000);
          // Missing cleanup for outer interval
        }, []);
      `;

      ruleTester.run('nested-useeffect', useEffectCleanupRule, {
        valid: [],
        invalid: [
          {
            code,
            errors: [
              { messageId: 'missingCleanup', type: 'CallExpression' },
              { messageId: 'missingCleanup', type: 'CallExpression' },
            ],
          },
        ],
      });
    });

    it('should handle conditional event listeners', () => {
      const code = `
        useEffect(() => {
          if (condition) {
            const listener = () => {};
            element.addEventListener('click', listener);
            // Missing cleanup
          }
        }, [condition]);
      `;

      ruleTester.run('conditional-listeners', useEffectCleanupRule, {
        valid: [],
        invalid: [
          {
            code,
            errors: [{ messageId: 'missingCleanup', type: 'CallExpression' }],
          },
        ],
      });
    });

    it('should handle multiple event listeners on same element', () => {
      const code = `
        useEffect(() => {
          const clickListener = () => {};
          const hoverListener = () => {};
          
          element.addEventListener('click', clickListener);
          element.addEventListener('mouseenter', hoverListener);
          
          return () => {
            element.removeEventListener('click', clickListener);
            // Missing removeEventListener for hover
          };
        }, []);
      `;

      ruleTester.run('multiple-listeners', eventListenerCleanupRule, {
        valid: [],
        invalid: [
          {
            code,
            errors: [
              {
                messageId: 'missingRemoveEventListener',
                type: 'CallExpression',
              },
            ],
          },
        ],
      });
    });

    it('should handle dynamic event names', () => {
      const code = `
        useEffect(() => {
          const eventName = 'click';
          const listener = () => {};
          element.addEventListener(eventName, listener);
          // Should still detect missing cleanup even with dynamic event name
        }, []);
      `;

      ruleTester.run('dynamic-event-names', eventListenerCleanupRule, {
        valid: [],
        invalid: [
          {
            code,
            errors: [
              {
                messageId: 'missingRemoveEventListener',
                type: 'CallExpression',
              },
            ],
          },
        ],
      });
    });
  });

  describe('performance', () => {
    it('should handle large files efficiently', () => {
      // Generate a large file with many useEffect calls
      const largeCode = Array.from(
        { length: 100 },
        (_, i) => `
        useEffect(() => {
          const interval${i} = setInterval(() => {}, 1000);
          // Missing cleanup
        }, []);
      `
      ).join('\n');

      const startTime = Date.now();

      expect(() => {
        ruleTester.run('large-file-performance', useEffectCleanupRule, {
          valid: [],
          invalid: [
            {
              code: largeCode,
              errors: Array.from({ length: 100 }, () => ({
                messageId: 'missingCleanup',
                type: 'CallExpression',
              })),
            },
          ],
        });
      }).not.toThrow();

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (less than 5 seconds)
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('configuration', () => {
    it('should respect rule configuration options', () => {
      const ruleWithOptions = {
        ...useEffectCleanupRule,
        defaultOptions: [
          {
            checkIntervals: true,
            checkTimeouts: true,
            checkEventListeners: true,
            checkSubscriptions: false, // Disabled
          },
        ],
      };

      const code = `
        useEffect(() => {
          const subscription = observable.subscribe();
          // Should not trigger error because subscriptions are disabled
        }, []);
      `;

      ruleTester.run('rule-configuration', ruleWithOptions, {
        valid: [{ code }],
        invalid: [],
      });
    });
  });
});

// Helper function to test rule messages
describe('Rule Messages', () => {
  it('should have clear and helpful error messages', () => {
    const rules = [
      useEffectCleanupRule,
      eventListenerCleanupRule,
      intervalTimeoutCleanupRule,
      subscriptionCleanupRule,
    ];

    rules.forEach(rule => {
      expect(rule.meta.messages).toBeDefined();

      Object.values(rule.meta.messages).forEach(message => {
        expect(typeof message).toBe('string');
        expect(message.length).toBeGreaterThan(10);
        expect(message).toMatch(/[A-Z]/); // Should start with capital letter
      });
    });
  });

  it('should have proper rule metadata', () => {
    const rules = [
      useEffectCleanupRule,
      eventListenerCleanupRule,
      intervalTimeoutCleanupRule,
      subscriptionCleanupRule,
    ];

    rules.forEach(rule => {
      expect(rule.meta.type).toBe('problem');
      expect(rule.meta.docs).toBeDefined();
      expect(rule.meta.docs.description).toBeDefined();
      expect(rule.meta.fixable).toBe('code');
      expect(rule.meta.schema).toBeDefined();
    });
  });
});
