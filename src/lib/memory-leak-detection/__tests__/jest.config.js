/**
 * Jest configuration for memory leak detection tests
 */

module.exports = {
  displayName: 'Memory Leak Detection',
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  moduleFileExtensions: ['ts', 'js'],
  testEnvironment: 'node',
  collectCoverageFrom: ['../**/*.ts', '!../**/*.d.ts', '!../**/__tests__/**'],
  coverageDirectory: '../../../coverage/memory-leak-detection',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/test-setup.ts'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/../../../$1'
  }
}
