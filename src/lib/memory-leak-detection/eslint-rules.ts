/**
 * ESLint rules for memory leak prevention
 */

import { ESLintUtils, TSESTree } from '@typescript-eslint/utils';

// Rule for detecting useEffect hooks without proper cleanup
export const useEffectCleanupRule = ESLintUtils.RuleCreator(
  name =>
    `https://github.com/your-org/eslint-plugin-memory-leak-detection/blob/main/docs/rules/${name}.md`
)({
  name: 'useeffect-cleanup',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require cleanup functions in useEffect hooks that add event listeners, intervals, or subscriptions',
    },
    fixable: 'code',
    schema: [
      {
        type: 'object',
        properties: {
          checkIntervals: { type: 'boolean' },
          checkTimeouts: { type: 'boolean' },
          checkEventListeners: { type: 'boolean' },
          checkSubscriptions: { type: 'boolean' },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      missingCleanup:
        'useEffect hook with side effects is missing a cleanup function',
      missingIntervalCleanup:
        'setInterval call in useEffect is missing clearInterval in cleanup',
      missingTimeoutCleanup:
        'setTimeout call in useEffect is missing clearTimeout in cleanup',
      missingEventListenerCleanup:
        'addEventListener call in useEffect is missing removeEventListener in cleanup',
      missingSubscriptionCleanup:
        'Subscription in useEffect is missing unsubscribe in cleanup',
    },
  },
  defaultOptions: [
    {
      checkIntervals: true,
      checkTimeouts: true,
      checkEventListeners: true,
      checkSubscriptions: true,
    },
  ],
  create(context, [options]) {
    const sourceCode = context.getSourceCode();

    function isUseEffectCall(node: TSESTree.CallExpression): boolean {
      return (
        node.callee.type === 'Identifier' && node.callee.name === 'useEffect'
      );
    }

    function hasCleanupFunction(
      effectCallback:
        | TSESTree.ArrowFunctionExpression
        | TSESTree.FunctionExpression
    ): boolean {
      if (effectCallback.body.type !== 'BlockStatement') {
        return false;
      }

      return effectCallback.body.body.some(
        statement =>
          statement.type === 'ReturnStatement' &&
          statement.argument?.type === 'ArrowFunctionExpression'
      );
    }

    function findSideEffects(
      effectCallback:
        | TSESTree.ArrowFunctionExpression
        | TSESTree.FunctionExpression
    ): Array<{
      type: 'interval' | 'timeout' | 'eventListener' | 'subscription';
      node: TSESTree.Node;
    }> {
      const sideEffects: Array<{
        type: 'interval' | 'timeout' | 'eventListener' | 'subscription';
        node: TSESTree.Node;
      }> = [];

      function visit(node: TSESTree.Node) {
        if (node.type === 'CallExpression') {
          // Check for setInterval/setTimeout
          if (
            node.callee.type === 'Identifier' &&
            ((options.checkIntervals && node.callee.name === 'setInterval') ||
              (options.checkTimeouts && node.callee.name === 'setTimeout'))
          ) {
            sideEffects.push({
              type: node.callee.name === 'setInterval' ? 'interval' : 'timeout',
              node,
            });
          }

          // Check for addEventListener
          if (
            options.checkEventListeners &&
            node.callee.type === 'MemberExpression' &&
            node.callee.property.type === 'Identifier' &&
            node.callee.property.name === 'addEventListener'
          ) {
            sideEffects.push({
              type: 'eventListener',
              node,
            });
          }

          // Check for subscriptions
          if (
            options.checkSubscriptions &&
            node.callee.type === 'MemberExpression' &&
            node.callee.property.type === 'Identifier' &&
            node.callee.property.name === 'subscribe'
          ) {
            sideEffects.push({
              type: 'subscription',
              node,
            });
          }
        }

        // Check for EventSource/WebSocket
        if (
          options.checkSubscriptions &&
          node.type === 'NewExpression' &&
          node.callee.type === 'Identifier' &&
          (node.callee.name === 'EventSource' ||
            node.callee.name === 'WebSocket')
        ) {
          sideEffects.push({
            type: 'subscription',
            node,
          });
        }

        // Recursively visit child nodes
        for (const key in node) {
          if (Object.prototype.hasOwnProperty.call(node, key)) {
            const child = (node as any)[key];
            if (Array.isArray(child)) {
              child.forEach(visit);
            } else if (child && typeof child === 'object' && child.type) {
              visit(child);
            }
          }
        }
      }

      if (effectCallback.body.type === 'BlockStatement') {
        effectCallback.body.body.forEach(visit);
      }

      return sideEffects;
    }

    function generateCleanupCode(
      sideEffects: Array<{
        type: 'interval' | 'timeout' | 'eventListener' | 'subscription';
        node: TSESTree.Node;
      }>
    ): string {
      const cleanupStatements: string[] = [];

      sideEffects.forEach(effect => {
        switch (effect.type) {
          case 'interval':
            cleanupStatements.push('clearInterval(interval);');
            break;
          case 'timeout':
            cleanupStatements.push('clearTimeout(timeout);');
            break;
          case 'eventListener':
            if (
              effect.node.type === 'CallExpression' &&
              effect.node.callee.type === 'MemberExpression'
            ) {
              const objectCode = sourceCode.getText(effect.node.callee.object);
              const eventType = effect.node.arguments[0]
                ? sourceCode.getText(effect.node.arguments[0])
                : "'event'";
              const listener = effect.node.arguments[1]
                ? sourceCode.getText(effect.node.arguments[1])
                : 'listener';
              cleanupStatements.push(
                `${objectCode}.removeEventListener(${eventType}, ${listener});`
              );
            }
            break;
          case 'subscription':
            cleanupStatements.push('subscription.unsubscribe();');
            break;
        }
      });

      return `return () => {\n    ${cleanupStatements.join('\n    ')}\n  };`;
    }

    return {
      CallExpression(node: TSESTree.CallExpression) {
        if (!isUseEffectCall(node) || node.arguments.length === 0) {
          return;
        }

        const effectCallback = node.arguments[0];
        if (
          effectCallback.type !== 'ArrowFunctionExpression' &&
          effectCallback.type !== 'FunctionExpression'
        ) {
          return;
        }

        const sideEffects = findSideEffects(effectCallback);
        if (sideEffects.length === 0) {
          return;
        }

        const hasCleanup = hasCleanupFunction(effectCallback);
        if (!hasCleanup) {
          context.report({
            node,
            messageId: 'missingCleanup',
            fix(fixer) {
              if (effectCallback.body.type !== 'BlockStatement') {
                return null;
              }

              const cleanupCode = generateCleanupCode(sideEffects);
              const lastStatement =
                effectCallback.body.body[effectCallback.body.body.length - 1];

              if (lastStatement) {
                return fixer.insertTextAfter(
                  lastStatement,
                  `\n  ${cleanupCode}`
                );
              } else {
                return fixer.insertTextAfter(
                  effectCallback.body.body[0] || effectCallback.body,
                  `\n  ${cleanupCode}`
                );
              }
            },
          });
        }
      },
    };
  },
});

// Rule for detecting event listeners without cleanup
export const eventListenerCleanupRule = ESLintUtils.RuleCreator(
  name =>
    `https://github.com/your-org/eslint-plugin-memory-leak-detection/blob/main/docs/rules/${name}.md`
)({
  name: 'event-listener-cleanup',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require removeEventListener for every addEventListener call',
    },
    fixable: 'code',
    schema: [],
    messages: {
      missingRemoveEventListener:
        'addEventListener call is missing corresponding removeEventListener',
    },
  },
  defaultOptions: [],
  create(context) {
    const eventListeners = new Map<string, TSESTree.CallExpression>();

    return {
      CallExpression(node: TSESTree.CallExpression) {
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.property.type === 'Identifier'
        ) {
          if (node.callee.property.name === 'addEventListener') {
            const key = context.getSourceCode().getText(node);
            eventListeners.set(key, node);
          } else if (node.callee.property.name === 'removeEventListener') {
            const addKey = context
              .getSourceCode()
              .getText(node)
              .replace('removeEventListener', 'addEventListener');
            eventListeners.delete(addKey);
          }
        }
      },
      'Program:exit'() {
        eventListeners.forEach(node => {
          context.report({
            node,
            messageId: 'missingRemoveEventListener',
          });
        });
      },
    };
  },
});

// Rule for detecting intervals/timeouts without cleanup
export const intervalTimeoutCleanupRule = ESLintUtils.RuleCreator(
  name =>
    `https://github.com/your-org/eslint-plugin-memory-leak-detection/blob/main/docs/rules/${name}.md`
)({
  name: 'interval-timeout-cleanup',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require clearInterval/clearTimeout for every setInterval/setTimeout call',
    },
    fixable: 'code',
    schema: [],
    messages: {
      missingClearInterval:
        'setInterval call is missing corresponding clearInterval',
      missingClearTimeout:
        'setTimeout call is missing corresponding clearTimeout',
    },
  },
  defaultOptions: [],
  create(context) {
    const intervals = new Set<TSESTree.CallExpression>();
    const timeouts = new Set<TSESTree.CallExpression>();

    return {
      CallExpression(node: TSESTree.CallExpression) {
        if (node.callee.type === 'Identifier') {
          if (node.callee.name === 'setInterval') {
            intervals.add(node);
          } else if (node.callee.name === 'setTimeout') {
            timeouts.add(node);
          } else if (node.callee.name === 'clearInterval') {
            // In a more sophisticated implementation, we would track variable assignments
            // For now, just assume any clearInterval clears one setInterval
            const firstInterval = intervals.values().next().value;
            if (firstInterval) {
              intervals.delete(firstInterval);
            }
          } else if (node.callee.name === 'clearTimeout') {
            const firstTimeout = timeouts.values().next().value;
            if (firstTimeout) {
              timeouts.delete(firstTimeout);
            }
          }
        }
      },
      'Program:exit'() {
        intervals.forEach(node => {
          context.report({
            node,
            messageId: 'missingClearInterval',
          });
        });
        timeouts.forEach(node => {
          context.report({
            node,
            messageId: 'missingClearTimeout',
          });
        });
      },
    };
  },
});

// Rule for detecting subscriptions without cleanup
export const subscriptionCleanupRule = ESLintUtils.RuleCreator(
  name =>
    `https://github.com/your-org/eslint-plugin-memory-leak-detection/blob/main/docs/rules/${name}.md`
)({
  name: 'subscription-cleanup',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require unsubscribe/close for subscriptions and connections',
    },
    fixable: 'code',
    schema: [],
    messages: {
      missingUnsubscribe: 'Subscription is missing unsubscribe call',
      missingClose: 'Connection is missing close call',
    },
  },
  defaultOptions: [],
  create(context) {
    const subscriptions = new Set<TSESTree.CallExpression>();
    const connections = new Set<TSESTree.NewExpression>();

    return {
      CallExpression(node: TSESTree.CallExpression) {
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.property.type === 'Identifier'
        ) {
          if (node.callee.property.name === 'subscribe') {
            subscriptions.add(node);
          } else if (node.callee.property.name === 'unsubscribe') {
            // Remove corresponding subscription
            const firstSubscription = subscriptions.values().next().value;
            if (firstSubscription) {
              subscriptions.delete(firstSubscription);
            }
          } else if (node.callee.property.name === 'close') {
            // Remove corresponding connection
            const firstConnection = connections.values().next().value;
            if (firstConnection) {
              connections.delete(firstConnection);
            }
          }
        }
      },
      NewExpression(node: TSESTree.NewExpression) {
        if (
          node.callee.type === 'Identifier' &&
          (node.callee.name === 'EventSource' ||
            node.callee.name === 'WebSocket')
        ) {
          connections.add(node);
        }
      },
      'Program:exit'() {
        subscriptions.forEach(node => {
          context.report({
            node,
            messageId: 'missingUnsubscribe',
          });
        });
        connections.forEach(node => {
          context.report({
            node,
            messageId: 'missingClose',
          });
        });
      },
    };
  },
});

// Export all rules
export const rules = {
  'useeffect-cleanup': useEffectCleanupRule,
  'event-listener-cleanup': eventListenerCleanupRule,
  'interval-timeout-cleanup': intervalTimeoutCleanupRule,
  'subscription-cleanup': subscriptionCleanupRule,
};

// ESLint plugin configuration
export const plugin = {
  meta: {
    name: 'memory-leak-detection',
    version: '1.0.0',
  },
  rules,
  configs: {
    recommended: {
      plugins: ['memory-leak-detection'],
      rules: {
        'memory-leak-detection/useeffect-cleanup': 'error',
        'memory-leak-detection/event-listener-cleanup': 'warn',
        'memory-leak-detection/interval-timeout-cleanup': 'error',
        'memory-leak-detection/subscription-cleanup': 'warn',
      },
    },
    strict: {
      plugins: ['memory-leak-detection'],
      rules: {
        'memory-leak-detection/useeffect-cleanup': 'error',
        'memory-leak-detection/event-listener-cleanup': 'error',
        'memory-leak-detection/interval-timeout-cleanup': 'error',
        'memory-leak-detection/subscription-cleanup': 'error',
      },
    },
  },
};

export default plugin;
