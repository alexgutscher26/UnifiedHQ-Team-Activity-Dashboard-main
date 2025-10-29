/**
 * ESLint Plugin for Memory Leak Prevention
 * Custom ESLint plugin with rules to detect and auto-fix memory leaks
 */

import {
  requireUseEffectCleanup,
  requireEventListenerCleanup,
  requireTimerCleanup,
  requireSubscriptionCleanup
} from './memory-leak-prevention.js'

const plugin = {
  meta: {
    name: 'memory-leak-prevention',
    version: '1.0.0'
  },
  rules: {
    'require-useeffect-cleanup': requireUseEffectCleanup,
    'require-event-listener-cleanup': requireEventListenerCleanup,
    'require-timer-cleanup': requireTimerCleanup,
    'require-subscription-cleanup': requireSubscriptionCleanup
  },
  configs: {
    recommended: {
      plugins: ['memory-leak-prevention'],
      rules: {
        'memory-leak-prevention/require-useeffect-cleanup': 'error',
        'memory-leak-prevention/require-event-listener-cleanup': 'error',
        'memory-leak-prevention/require-timer-cleanup': 'error',
        'memory-leak-prevention/require-subscription-cleanup': 'error'
      }
    },
    strict: {
      plugins: ['memory-leak-prevention'],
      rules: {
        'memory-leak-prevention/require-useeffect-cleanup': 'error',
        'memory-leak-prevention/require-event-listener-cleanup': 'error',
        'memory-leak-prevention/require-timer-cleanup': 'error',
        'memory-leak-prevention/require-subscription-cleanup': 'error'
      }
    }
  }
}

export default plugin
