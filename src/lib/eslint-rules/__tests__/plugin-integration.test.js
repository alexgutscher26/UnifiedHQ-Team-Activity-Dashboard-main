/**
 * Integration tests for Memory Leak Prevention ESLint Plugin
 */

import { ESLint } from 'eslint';
import memoryLeakPreventionPlugin from '../index.js';

describe('Memory Leak Prevention Plugin Integration', () => {
  let eslint;

  beforeEach(() => {
    eslint = new ESLint({
      useEslintrc: false,
      baseConfig: {
        plugins: {
          'memory-leak-prevention': memoryLeakPreventionPlugin,
        },
        rules: {
          'memory-leak-prevention/require-useeffect-cleanup': 'error',
          'memory-leak-prevention/require-event-listener-cleanup': 'error',
          'memory-leak-prevention/require-timer-cleanup': 'error',
          'memory-leak-prevention/require-subscription-cleanup': 'error',
        },
        parserOptions: {
          ecmaVersion: 2022,
          sourceType: 'module',
          ecmaFeatures: {
            jsx: true,
          },
        },
      },
    });
  });

  test('plugin loads correctly', () => {
    expect(memoryLeakPreventionPlugin).toBeDefined();
    expect(memoryLeakPreventionPlugin.rules).toBeDefined();
    expect(memoryLeakPreventionPlugin.configs).toBeDefined();
  });

  test('plugin has all required rules', () => {
    const expectedRules = [
      'require-useeffect-cleanup',
      'require-event-listener-cleanup',
      'require-timer-cleanup',
      'require-subscription-cleanup',
    ];

    expectedRules.forEach(ruleName => {
      expect(memoryLeakPreventionPlugin.rules[ruleName]).toBeDefined();
    });
  });

  test('plugin has recommended configuration', () => {
    expect(memoryLeakPreventionPlugin.configs.recommended).toBeDefined();
    expect(memoryLeakPreventionPlugin.configs.recommended.rules).toBeDefined();
  });

  test('detects memory leak in useEffect', async () => {
    const code = `
      function MyComponent() {
        useEffect(() => {
          const handler = () => {};
          element.addEventListener('click', handler);
        }, []);
      }
    `;

    const results = await eslint.lintText(code, { filePath: 'test.js' });
    expect(results[0].messages).toHaveLength(2); // useEffect cleanup + event listener cleanup
    expect(results[0].messages[0].ruleId).toMatch(/memory-leak-prevention/);
  });

  test('detects timer leak in useEffect', async () => {
    const code = `
      function MyComponent() {
        useEffect(() => {
          const interval = setInterval(() => {}, 1000);
        }, []);
      }
    `;

    const results = await eslint.lintText(code, { filePath: 'test.js' });
    expect(results[0].messages).toHaveLength(2); // useEffect cleanup + timer cleanup
    expect(
      results[0].messages.some(
        msg => msg.ruleId === 'memory-leak-prevention/require-timer-cleanup'
      )
    ).toBe(true);
  });

  test('detects subscription leak in useEffect', async () => {
    const code = `
      function MyComponent() {
        useEffect(() => {
          const subscription = observable.subscribe();
        }, []);
      }
    `;

    const results = await eslint.lintText(code, { filePath: 'test.js' });
    expect(results[0].messages).toHaveLength(2); // useEffect cleanup + subscription cleanup
    expect(
      results[0].messages.some(
        msg =>
          msg.ruleId === 'memory-leak-prevention/require-subscription-cleanup'
      )
    ).toBe(true);
  });

  test('auto-fix functionality works', async () => {
    const code = `
      function MyComponent() {
        useEffect(() => {
          const interval = setInterval(() => {}, 1000);
        }, []);
      }
    `;

    const results = await eslint.lintText(code, { filePath: 'test.js' });
    const fixedResults = await ESLint.applyFixes(results);

    expect(fixedResults.output).toContain('return () => {');
    expect(fixedResults.output).toContain('clearInterval');
  });

  test('does not flag code outside React components', async () => {
    const code = `
      function regularFunction() {
        const interval = setInterval(() => {}, 1000);
        element.addEventListener('click', handler);
        const subscription = observable.subscribe();
      }
    `;

    const results = await eslint.lintText(code, { filePath: 'test.js' });
    expect(results[0].messages).toHaveLength(0);
  });

  test('does not flag code outside useEffect', async () => {
    const code = `
      function MyComponent() {
        const interval = setInterval(() => {}, 1000);
        element.addEventListener('click', handler);
        return <div>Hello</div>;
      }
    `;

    const results = await eslint.lintText(code, { filePath: 'test.js' });
    expect(results[0].messages).toHaveLength(0);
  });
});
