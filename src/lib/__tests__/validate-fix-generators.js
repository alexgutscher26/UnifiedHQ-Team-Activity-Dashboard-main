// Simple validation script for fix generators
import { createMemoryLeakFixGenerator } from '../memory-leak-fix-generator.js'

console.log('🧪 Validating Memory Leak Fix Generators\n')

// Test data
const testCases = [
  {
    name: 'useEffect cleanup',
    sourceCode: `
import React, { useEffect } from 'react';

function TestComponent() {
  useEffect(() => {
    const handleClick = () => console.log('clicked');
    document.addEventListener('click', handleClick);
  }, []);

  return <div>Test</div>;
}`,
    leak: {
      type: 'missing-useeffect-cleanup',
      severity: 'high',
      file: 'test.tsx',
      line: 5,
      column: 3,
      description: 'useEffect contains subscriptions but no cleanup function',
      codeSnippet: 'useEffect(() => { ... }, [])'
    }
  },
  {
    name: 'Event listener cleanup',
    sourceCode: `
function TestComponent() {
  const handleClick = () => console.log('clicked');
  document.addEventListener('click', handleClick);
  return <div>Test</div>;
}`,
    leak: {
      type: 'uncleaned-event-listener',
      severity: 'medium',
      file: 'test.tsx',
      line: 4,
      column: 3,
      description: 'Event listener without cleanup',
      codeSnippet: "document.addEventListener('click', handleClick)"
    }
  },
  {
    name: 'Timer cleanup',
    sourceCode: `
function TestComponent() {
  const intervalId = setInterval(() => {
    console.log('tick');
  }, 1000);
  return <div>Test</div>;
}`,
    leak: {
      type: 'uncleaned-interval',
      severity: 'high',
      file: 'test.tsx',
      line: 3,
      column: 21,
      description: 'setInterval without cleanup',
      codeSnippet: 'setInterval(() => { console.log("tick"); }, 1000)'
    }
  },
  {
    name: 'EventSource cleanup',
    sourceCode: `
function TestComponent() {
  const eventSource = new EventSource('/api/events');
  return <div>Test</div>;
}`,
    leak: {
      type: 'unclosed-eventsource',
      severity: 'high',
      file: 'test.tsx',
      line: 3,
      column: 23,
      description: 'EventSource without cleanup',
      codeSnippet: "new EventSource('/api/events')"
    }
  }
]

let passed = 0
let failed = 0

function validateTestCase (testCase) {
  try {
    console.log(`📝 Testing ${testCase.name}...`)

    const generator = createMemoryLeakFixGenerator(
      testCase.sourceCode,
      testCase.leak.file
    )
    const result = generator.generateFix(testCase.leak)

    if (result.success && result.fix) {
      console.log(`  ✅ ${testCase.name}: Fix generated successfully`)
      console.log(`     Description: ${result.fix.description}`)
      console.log(`     Confidence: ${result.fix.confidence}`)
      console.log(`     Requires Review: ${result.fix.requiresManualReview}`)
      passed++
      return true
    } else {
      console.log(`  ❌ ${testCase.name}: Failed to generate fix`)
      console.log(`     Error: ${result.error || 'Unknown error'}`)
      failed++
      return false
    }
  } catch (error) {
    console.log(`  ❌ ${testCase.name}: Exception thrown`)
    console.log(`     Error: ${error.message}`)
    failed++
    return false
  }
}

// Run validation
console.log('Running validation tests...\n')

for (const testCase of testCases) {
  validateTestCase(testCase)
  console.log('') // Empty line for readability
}

console.log('📊 Validation Summary:')
console.log(`   Total Tests: ${testCases.length}`)
console.log(`   Passed: ${passed}`)
console.log(`   Failed: ${failed}`)

if (failed === 0) {
  console.log('\n🎉 All validations passed!')
  process.exit(0)
} else {
  console.log('\n💥 Some validations failed!')
  process.exit(1)
}
