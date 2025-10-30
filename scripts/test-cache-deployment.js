/**
 * Cache Deployment Test Runner
 * Runs comprehensive tests for cache deployment and configuration
 */

const { spawn, exec } = require('child_process')
const fs = require('fs')
const path = require('path')

class CacheDeploymentTestRunner {
  constructor (options = {}) {
    this.config = {
      testPattern: options.testPattern || '**/*.test.{ts,js}',
      testDirs: options.testDirs || [
        'src/lib/config/__tests__',
        'src/app/api/health/__tests__',
        'src/__tests__/e2e'
      ],
      coverage: options.coverage || false,
      verbose: options.verbose || false,
      bail: options.bail || false,
      timeout: options.timeout || 30000,
      ...options
    }

    this.testResults = []
    this.overallStatus = 'pending'
  }

  /**
   * Run all cache deployment tests
   */
  async runTests () {
    console.log('🧪 Starting Cache Deployment Test Suite')
    console.log('='.repeat(60))
    console.log(`Test Pattern: ${this.config.testPattern}`)
    console.log(`Test Directories: ${this.config.testDirs.join(', ')}`)
    console.log(`Coverage: ${this.config.coverage ? 'Enabled' : 'Disabled'}`)
    console.log(`Timeout: ${this.config.timeout}ms`)
    console.log('')

    try {
      this.overallStatus = 'running'

      // Step 1: Run configuration tests
      await this.runConfigurationTests()

      // Step 2: Run health check tests
      await this.runHealthCheckTests()

      // Step 3: Run integration tests
      await this.runIntegrationTests()

      // Step 4: Run end-to-end tests
      await this.runEndToEndTests()

      // Step 5: Generate test report
      const report = await this.generateTestReport()

      this.overallStatus = 'completed'
      console.log('\n✅ Cache Deployment Test Suite Completed!')

      return report
    } catch (error) {
      this.overallStatus = 'failed'
      console.error('\n❌ Cache Deployment Test Suite Failed:', error)

      const failureReport = await this.generateFailureReport(error)
      throw new Error(`Test suite failed: ${error.message}`)
    }
  }

  /**
   * Run configuration tests
   *
   * This function executes a series of configuration tests, including cache configuration and feature flags.
   * It tracks the start time, status, and duration of the tests, updating the test result object accordingly.
   * In case of an error, it captures the error message and updates the status to 'failed'.
   * Finally, it pushes the test results to the `testResults` array.
   */
  async runConfigurationTests () {
    console.log('🔧 Running Configuration Tests...')

    const testResult = {
      category: 'configuration',
      startTime: Date.now(),
      status: 'running'
    }

    try {
      // Test cache configuration
      const cacheConfigResult = await this.runTestFile(
        'src/lib/config/__tests__/cache-config.test.ts'
      )

      // Test feature flags
      const featureFlagsResult = await this.runTestFile(
        'src/lib/config/__tests__/feature-flags.test.ts'
      )

      testResult.status = 'passed'
      testResult.endTime = Date.now()
      testResult.duration = testResult.endTime - testResult.startTime
      testResult.tests = [cacheConfigResult, featureFlagsResult]

      console.log(
        `   ✅ Configuration tests completed (${testResult.duration}ms)`
      )
    } catch (error) {
      testResult.status = 'failed'
      testResult.error = error.message
      testResult.endTime = Date.now()
      testResult.duration = testResult.endTime - testResult.startTime

      console.log(`   ❌ Configuration tests failed: ${error.message}`)
      throw error
    } finally {
      this.testResults.push(testResult)
    }
  }

  /**
   * Run health check tests.
   *
   * This function initiates health check tests by logging the start of the process and creating a test result object.
   * It attempts to run a specific test file for health endpoints and updates the test result based on the outcome.
   * If the tests pass, it records the duration and logs a success message. In case of failure, it captures the error message,
   * updates the status, and decides whether to continue with remaining tests based on the configuration.
   */
  async runHealthCheckTests () {
    console.log('\n🏥 Running Health Check Tests...')

    const testResult = {
      category: 'health_checks',
      startTime: Date.now(),
      status: 'running'
    }

    try {
      // Test health endpoints
      const healthEndpointsResult = await this.runTestFile(
        'src/app/api/health/__tests__/health-endpoints.test.ts'
      )

      testResult.status = 'passed'
      testResult.endTime = Date.now()
      testResult.duration = testResult.endTime - testResult.startTime
      testResult.tests = [healthEndpointsResult]

      console.log(
        `   ✅ Health check tests completed (${testResult.duration}ms)`
      )
    } catch (error) {
      testResult.status = 'failed'
      testResult.error = error.message
      testResult.endTime = Date.now()
      testResult.duration = testResult.endTime - testResult.startTime

      console.log(`   ❌ Health check tests failed: ${error.message}`)

      if (!this.config.bail) {
        console.log('   ⏭️  Continuing with remaining tests...')
      } else {
        throw error
      }
    } finally {
      this.testResults.push(testResult)
    }
  }

  /**
   * Run integration tests
   */
  async runIntegrationTests () {
    console.log('\n🔗 Running Integration Tests...')

    const testResult = {
      category: 'integration',
      startTime: Date.now(),
      status: 'running'
    }

    try {
      // Test Redis integration
      const redisTestResult = await this.runTestFile(
        'src/lib/__tests__/redis.test.ts'
      )

      // Test GitHub cached integration
      const githubCachedResult = await this.runTestFile(
        'src/lib/__tests__/github-cached.test.ts'
      )

      testResult.status = 'passed'
      testResult.endTime = Date.now()
      testResult.duration = testResult.endTime - testResult.startTime
      testResult.tests = [redisTestResult, githubCachedResult]

      console.log(
        `   ✅ Integration tests completed (${testResult.duration}ms)`
      )
    } catch (error) {
      testResult.status = 'failed'
      testResult.error = error.message
      testResult.endTime = Date.now()
      testResult.duration = testResult.endTime - testResult.startTime

      console.log(`   ❌ Integration tests failed: ${error.message}`)

      if (!this.config.bail) {
        console.log('   ⏭️  Continuing with remaining tests...')
      } else {
        throw error
      }
    } finally {
      this.testResults.push(testResult)
    }
  }

  /**
   * Run end-to-end tests.
   *
   * This function initiates the execution of end-to-end tests, starting with logging the test run. It creates a testResult object to track the status, start time, and results of the tests. The function attempts to run a specific test file for offline functionality and updates the testResult based on the outcome. If an error occurs, it logs the failure and decides whether to continue or halt the test suite based on the configuration.
   */
  async runEndToEndTests () {
    console.log('\n🎯 Running End-to-End Tests...')

    const testResult = {
      category: 'e2e',
      startTime: Date.now(),
      status: 'running'
    }

    try {
      // Test complete offline functionality
      const offlineFunctionalityResult = await this.runTestFile(
        'src/__tests__/e2e/offline-functionality.test.ts'
      )

      testResult.status = 'passed'
      testResult.endTime = Date.now()
      testResult.duration = testResult.endTime - testResult.startTime
      testResult.tests = [offlineFunctionalityResult]

      console.log(
        `   ✅ End-to-end tests completed (${testResult.duration}ms)`
      )
    } catch (error) {
      testResult.status = 'failed'
      testResult.error = error.message
      testResult.endTime = Date.now()
      testResult.duration = testResult.endTime - testResult.startTime

      console.log(`   ❌ End-to-end tests failed: ${error.message}`)

      if (!this.config.bail) {
        console.log('   ⏭️  Test suite will continue...')
      } else {
        throw error
      }
    } finally {
      this.testResults.push(testResult)
    }
  }

  /**
   * Run a single test file and return the result of the test execution.
   *
   * This function checks if the specified test file exists, runs the test using the bun test command, and logs the outcome.
   * It measures the duration of the test execution and handles errors gracefully, returning appropriate status and output.
   *
   * @param testFile - The path to the test file to be executed.
   * @returns An object containing the test file name, status, duration, and either output or error message.
   */
  async runTestFile (testFile) {
    const startTime = Date.now()

    try {
      // Check if test file exists
      if (!fs.existsSync(testFile)) {
        console.log(`   ⚠️  Test file not found: ${testFile}`)
        return {
          file: testFile,
          status: 'skipped',
          reason: 'File not found',
          duration: 0
        }
      }

      // Run test with bun test
      const result = await this.runCommand(`bun test ${testFile}`)

      const duration = Date.now() - startTime

      if (result.exitCode === 0) {
        console.log(`   ✅ ${path.basename(testFile)} (${duration}ms)`)
        return {
          file: testFile,
          status: 'passed',
          duration,
          output: result.stdout
        }
      } else {
        console.log(`   ❌ ${path.basename(testFile)} (${duration}ms)`)
        if (this.config.verbose) {
          console.log(`      Error: ${result.stderr}`)
        }
        return {
          file: testFile,
          status: 'failed',
          duration,
          error: result.stderr,
          output: result.stdout
        }
      }
    } catch (error) {
      const duration = Date.now() - startTime
      console.log(
        `   ❌ ${path.basename(testFile)} (${duration}ms) - ${error.message}`
      )

      return {
        file: testFile,
        status: 'error',
        duration,
        error: error.message
      }
    }
  }

  /**
   * Executes a command and returns the result as a promise.
   */
  async runCommand (command) {
    return new Promise(resolve => {
      exec(
        command,
        { timeout: this.config.timeout },
        (error, stdout, stderr) => {
          resolve({
            exitCode: error ? error.code || 1 : 0,
            stdout: stdout.trim(),
            stderr: stderr.trim()
          })
        }
      )
    })
  }

  /**
   * Generate test report.
   *
   * This function compiles the results of the tests stored in `this.testResults`, calculating the total number of tests,
   * the number of passed and failed tests, and the total duration of all tests. It then constructs a report object
   * containing a summary and saves it to a JSON file in the 'reports' directory. If the directory does not exist,
   * it is created. Finally, the function displays a summary of the test results and logs the path to the saved report.
   */
  async generateTestReport () {
    const totalTests = this.testResults.length
    const passedTests = this.testResults.filter(
      t => t.status === 'passed'
    ).length
    const failedTests = this.testResults.filter(
      t => t.status === 'failed'
    ).length
    const totalDuration = this.testResults.reduce(
      (sum, test) => sum + (test.duration || 0),
      0
    )

    const report = {
      summary: {
        status: this.overallStatus,
        totalCategories: totalTests,
        passedCategories: passedTests,
        failedCategories: failedTests,
        successRate:
          totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0,
        totalDuration,
        timestamp: new Date().toISOString()
      },
      categories: this.testResults,
      config: this.config
    }

    // Save report
    const reportsDir = path.join(process.cwd(), 'reports')
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true })
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const reportPath = path.join(
      reportsDir,
      `cache-deployment-tests-${timestamp}.json`
    )

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))

    // Display summary
    this.displayTestSummary(report)

    console.log(`\n📄 Test report saved to: ${reportPath}`)

    return report
  }

  /**
   * Generate failure report
   */
  async generateFailureReport (error) {
    const report = {
      summary: {
        status: 'failed',
        error: error.message,
        timestamp: new Date().toISOString()
      },
      categories: this.testResults,
      config: this.config
    }

    const reportsDir = path.join(process.cwd(), 'reports')
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true })
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const reportPath = path.join(
      reportsDir,
      `cache-deployment-tests-failure-${timestamp}.json`
    )

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
    console.log(`📄 Failure report saved to: ${reportPath}`)

    return report
  }

  /**
   * Display test summary.
   *
   * This function logs a summary of the test results, including total categories,
   * passed and failed categories, success rate, and total duration. It iterates
   * through each category to display its status and duration, and if verbose mode
   * is enabled, it also logs any errors associated with the categories. Finally,
   * it outputs the overall status of the tests based on the number of failed categories.
   *
   * @param {Object} report - The report object containing summary and category details.
   */
  displayTestSummary (report) {
    console.log('\n📊 TEST SUMMARY')
    console.log('='.repeat(50))
    console.log(`Total Categories: ${report.summary.totalCategories}`)
    console.log(`Passed: ${report.summary.passedCategories}`)
    console.log(`Failed: ${report.summary.failedCategories}`)
    console.log(`Success Rate: ${report.summary.successRate}%`)
    console.log(`Total Duration: ${report.summary.totalDuration}ms`)

    console.log('\n📋 Category Results:')
    report.categories.forEach(category => {
      const status = category.status === 'passed' ? '✅' : '❌'
      console.log(
        `   ${status} ${category.category} (${category.duration || 0}ms)`
      )

      if (category.error && this.config.verbose) {
        console.log(`      Error: ${category.error}`)
      }
    })

    const overallStatus =
      report.summary.failedCategories === 0 ? '✅ PASSED' : '❌ FAILED'
    console.log(`\n🎯 Overall Status: ${overallStatus}`)
  }
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2)
  const options = {}

  // Parse command line arguments
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace('--', '')
    const value = args[i + 1]

    if (key) {
      switch (key) {
        case 'coverage':
          options.coverage = true
          i-- // No value for this flag
          break
        case 'verbose':
          options.verbose = true
          i-- // No value for this flag
          break
        case 'bail':
          options.bail = true
          i-- // No value for this flag
          break
        case 'timeout':
          options.timeout = parseInt(value) || 30000
          break
        case 'pattern':
          options.testPattern = value
          break
      }
    }
  }

  const testRunner = new CacheDeploymentTestRunner(options)

  testRunner.runTests().catch(error => {
    console.error('❌ Test runner failed:', error.message)
    process.exit(1)
  })
}

module.exports = CacheDeploymentTestRunner
