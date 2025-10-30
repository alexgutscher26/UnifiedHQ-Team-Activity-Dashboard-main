import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';
import memoryLeakPreventionPlugin from './src/lib/eslint-rules/index.js';

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
})

export default [
  // Base JavaScript recommended rules
  js.configs.recommended,

  // Next.js configuration
  ...compat.extends('next/core-web-vitals'),

  // Prettier configuration
  prettierConfig,

  // Global rules
  {
    plugins: {
      prettier: prettierPlugin,
      'memory-leak-prevention': memoryLeakPreventionPlugin,
    },
    rules: {
      'prettier/prettier': 'error',
      // Additional project-specific rules
      'no-console': 'warn',
      'no-unused-vars': 'warn',
      'prefer-const': 'error',
      'no-var': 'error',
      // Memory leak prevention rules
      'memory-leak-prevention/require-useeffect-cleanup': 'error',
      'memory-leak-prevention/require-event-listener-cleanup': 'error',
      'memory-leak-prevention/require-timer-cleanup': 'error',
      'memory-leak-prevention/require-subscription-cleanup': 'error',
    },
  },

  // Ignore patterns
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'dist/**',
      '*.config.js',
      '*.config.mjs',
      'prisma/generated/**',
      'src/generated/**'
    ]
  }
]
