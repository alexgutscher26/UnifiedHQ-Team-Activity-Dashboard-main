/**
 * Test setup for memory leak detection tests
 */

import '@testing-library/jest-dom';

// Mock console methods to reduce noise in tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeEach(() => {
  // Reset console mocks before each test
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterEach(() => {
  // Restore console methods after each test
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Global test utilities
global.testUtils = {
  // Helper to create mock AST nodes for testing
  createMockASTNode: (type: string, properties: Record<string, any> = {}) => ({
    type,
    ...properties,
  }),

  // Helper to create mock ESLint context
  createMockESLintContext: (options: Record<string, any> = {}) => ({
    report: jest.fn(),
    getSourceCode: jest.fn(() => ({
      getText: jest.fn(),
      getTokens: jest.fn(() => []),
    })),
    options: [options],
    ...options,
  }),

  // Helper to create mock file content
  createMockFileContent: (content: string) => ({
    content,
    ast: null, // Would be populated by actual parser
    filePath: '/mock/file.tsx',
  }),
};

// Extend Jest matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveMemoryLeak(): R;
      toHaveCleanup(): R;
    }
  }

  var testUtils: {
    createMockASTNode: (type: string, properties?: Record<string, any>) => any;
    createMockESLintContext: (options?: Record<string, any>) => any;
    createMockFileContent: (content: string) => any;
  };
}

// Custom Jest matchers for memory leak testing
expect.extend({
  toHaveMemoryLeak(received: any) {
    const hasLeak = received?.type && received.severity;

    if (hasLeak) {
      return {
        message: () =>
          `Expected not to have memory leak, but found: ${received.description}`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected to have memory leak, but none found`,
        pass: false,
      };
    }
  },

  toHaveCleanup(received: string) {
    const hasCleanup =
      received.includes('return () => {') ||
      received.includes('removeEventListener') ||
      received.includes('clearInterval') ||
      received.includes('clearTimeout') ||
      received.includes('unsubscribe') ||
      received.includes('close()');

    if (hasCleanup) {
      return {
        message: () => `Expected not to have cleanup, but cleanup found`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected to have cleanup, but no cleanup found`,
        pass: false,
      };
    }
  },
});
