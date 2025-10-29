/**
 * Tests for Memory Leak Prevention ESLint Rules
 */

import { RuleTester } from 'eslint'
import {
  requireUseEffectCleanup,
  requireEventListenerCleanup,
  requireTimerCleanup,
  requireSubscriptionCleanup
} from '../memory-leak-prevention.js'

const ruleTester = new RuleTester({
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true
    }
  }
})

describe('Memory Leak Prevention ESLint Rules', () => {
  describe('require-useeffect-cleanup', () => {
    ruleTester.run('require-useeffect-cleanup', requireUseEffectCleanup, {
      valid: [
        // useEffect with proper cleanup
        {
          code: `
            function MyComponent() {
              useEffect(() => {
                const handler = () => {};
                element.addEventListener('click', handler);
                return () => {
                  element.removeEventListener('click', handler);
                };
              }, []);
            }
          `
        },
        // useEffect without risky patterns
        {
          code: `
            function MyComponent() {
              useEffect(() => {
                console.log('mounted');
              }, []);
            }
          `
        },
        // Non-React function
        {
          code: `
            function regularFunction() {
              useEffect(() => {
                element.addEventListener('click', handler);
              }, []);
            }
          `
        }
      ],
      invalid: [
        // useEffect with addEventListener but no cleanup
        {
          code: `
            function MyComponent() {
              useEffect(() => {
                const handler = () => {};
                element.addEventListener('click', handler);
              }, []);
            }
          `,
          errors: [{ messageId: 'missingCleanup' }],
          output: `
            function MyComponent() {
              useEffect(() => {
                const handler = () => {};
                element.addEventListener('click', handler);
    return () => {
    // Remove event listeners
    // element.removeEventListener('event', handler);
    };
              }, []);
            }
          `
        },
        // useEffect with setInterval but no cleanup
        {
          code: `
            function MyComponent() {
              useEffect(() => {
                const interval = setInterval(() => {}, 1000);
              }, []);
            }
          `,
          errors: [{ messageId: 'missingCleanup' }],
          output: `
            function MyComponent() {
              useEffect(() => {
                const interval = setInterval(() => {}, 1000);
    return () => {
    // Clear interval
    // clearInterval(intervalId);
    };
              }, []);
            }
          `
        }
      ]
    })
  })

  describe('require-event-listener-cleanup', () => {
    ruleTester.run(
      'require-event-listener-cleanup',
      requireEventListenerCleanup,
      {
        valid: [
          // addEventListener outside React component
          {
            code: `
            function regularFunction() {
              element.addEventListener('click', handler);
            }
          `
          },
          // addEventListener outside useEffect
          {
            code: `
            function MyComponent() {
              element.addEventListener('click', handler);
            }
          `
          }
        ],
        invalid: [
          // addEventListener in React component useEffect
          {
            code: `
            function MyComponent() {
              useEffect(() => {
                const handler = () => {};
                element.addEventListener('click', handler);
              }, []);
            }
          `,
            errors: [{ messageId: 'missingRemoveListener' }]
          },
          // MediaQueryList.addListener in React component useEffect
          {
            code: `
            function MyComponent() {
              useEffect(() => {
                const handler = () => {};
                const mq = window.matchMedia('(max-width: 768px)');
                mq.addListener(handler);
              }, []);
            }
          `,
            errors: [{ messageId: 'missingMediaQueryCleanup' }]
          }
        ]
      }
    )
  })

  describe('require-timer-cleanup', () => {
    ruleTester.run('require-timer-cleanup', requireTimerCleanup, {
      valid: [
        // setInterval outside React component
        {
          code: `
            function regularFunction() {
              const interval = setInterval(() => {}, 1000);
            }
          `
        },
        // setTimeout not assigned to variable (fire-and-forget)
        {
          code: `
            function MyComponent() {
              useEffect(() => {
                setTimeout(() => {}, 1000);
              }, []);
            }
          `
        }
      ],
      invalid: [
        // setInterval in React component useEffect
        {
          code: `
            function MyComponent() {
              useEffect(() => {
                const interval = setInterval(() => {}, 1000);
              }, []);
            }
          `,
          errors: [{ messageId: 'missingClearInterval' }]
        },
        // setTimeout assigned to variable in React component useEffect
        {
          code: `
            function MyComponent() {
              useEffect(() => {
                const timeout = setTimeout(() => {}, 1000);
              }, []);
            }
          `,
          errors: [{ messageId: 'missingClearTimeout' }]
        }
      ]
    })
  })

  describe('require-subscription-cleanup', () => {
    ruleTester.run('require-subscription-cleanup', requireSubscriptionCleanup, {
      valid: [
        // Subscription outside React component
        {
          code: `
            function regularFunction() {
              const sub = observable.subscribe();
            }
          `
        },
        // EventSource outside useEffect
        {
          code: `
            function MyComponent() {
              const eventSource = new EventSource('/api/events');
            }
          `
        }
      ],
      invalid: [
        // Subscription in React component useEffect
        {
          code: `
            function MyComponent() {
              useEffect(() => {
                const subscription = observable.subscribe();
              }, []);
            }
          `,
          errors: [{ messageId: 'missingUnsubscribe' }]
        },
        // EventSource in React component useEffect
        {
          code: `
            function MyComponent() {
              useEffect(() => {
                const eventSource = new EventSource('/api/events');
              }, []);
            }
          `,
          errors: [{ messageId: 'missingEventSourceClose' }]
        },
        // WebSocket in React component useEffect
        {
          code: `
            function MyComponent() {
              useEffect(() => {
                const ws = new WebSocket('ws://localhost:8080');
              }, []);
            }
          `,
          errors: [{ messageId: 'missingWebSocketClose' }]
        },
        // IntersectionObserver in React component useEffect
        {
          code: `
            function MyComponent() {
              useEffect(() => {
                const observer = new IntersectionObserver(() => {});
              }, []);
            }
          `,
          errors: [{ messageId: 'missingObserverDisconnect' }]
        }
      ]
    })
  })
})
