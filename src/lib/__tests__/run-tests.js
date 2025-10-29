
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const testFiles = [
  'memory-leak-fix-generator.test.ts',
  'event-listener-fix-generator.test.ts',
  'timer-cleanup-fix-generator.test.ts',
  'connection-cleanup-fix-generator.test.ts',
  'performance-monitor-integration.test.js',
];

console.log('🧪 Running Memory Leak Fix Generator Tests\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

async function runTest(testFile) {
  return new Promise(resolve => {
    console.log(`📝 Running ${testFile}...`);

    const testPath = join(__dirname, testFile);
    const child = spawn('node', ['--test', testPath], {
      stdio: 'pipe',
      cwd: process.cwd(),
    });

    let output = '';
    let errorOutput = '';

    child.stdout.on('data', data => {
      output += data.toString();
    });

    child.stderr.on('data', data => {
      errorOutput += data.toString();
    });

    child.on('close', code => {
      const lines = output.split('\n');
      const testResults = lines.filter(
        line =>
          line.includes('✓') ||
          line.includes('✗') ||
          line.includes('ok') ||
          line.includes('not ok')
      );

      let testsPassed = 0;
      let testsFailed = 0;

      // Parse test results
      testResults.forEach(line => {
        if (line.includes('✓') || line.includes('ok')) {
          testsPassed++;
        } else if (line.includes('✗') || line.includes('not ok')) {
          testsFailed++;
        }
      });

      // If no specific test results found, check exit code
      if (testsPassed === 0 && testsFailed === 0) {
        if (code === 0) {
          testsPassed = 1; // Assume at least one test passed
        } else {
          testsFailed = 1; // Assume at least one test failed
        }
      }

      totalTests += testsPassed + testsFailed;
      passedTests += testsPassed;
      failedTests += testsFailed;

      if (code === 0) {
        console.log(`  ✅ ${testFile}: ${testsPassed} tests passed`);
      } else {
        console.log(`  ❌ ${testFile}: ${testsFailed} tests failed`);
        if (errorOutput) {
          console.log(`     Error: ${errorOutput.trim()}`);
        }
      }

      resolve(code === 0);
    });
  });
}

async function runAllTests() {
  const results = [];

  for (const testFile of testFiles) {
    const result = await runTest(testFile);
    results.push(result);
  }

  console.log('\n📊 Test Summary:');
  console.log(`   Total Tests: ${totalTests}`);
  console.log(`   Passed: ${passedTests}`);
  console.log(`   Failed: ${failedTests}`);

  const allPassed = results.every(result => result);

  if (allPassed) {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('\n💥 Some tests failed!');
    process.exit(1);
  }
}

// Handle errors
process.on('unhandledRejection', error => {
  console.error('❌ Unhandled rejection:', error);
  process.exit(1);
});

process.on('uncaughtException', error => {
  console.error('❌ Uncaught exception:', error);
  process.exit(1);
});

// Run tests
runAllTests().catch(error => {
  console.error('❌ Test runner error:', error);
  process.exit(1);
});
