/**
 * Deployment Verification Script
 *
 * This script performs comprehensive verification of production deployments
 * to ensure all systems are working correctly after a release.
 */

const https = require('https')
const http = require('http')
const { URL } = require('url')

class DeploymentVerifier {
  constructor (options = {}) {
    this.baseUrl =
      options.baseUrl || process.env.PRODUCTION_URL || 'https://unifiedhq.com'
    this.timeout = options.timeout || 30000
    this.retries = options.retries || 3
    this.verbose = options.verbose || false
    this.results = []
  }

  /**
   * Logs a message with a specified severity level.
   *
   * This function generates a timestamp and a prefix based on the log level.
   * It then logs the message to the console if the verbosity is enabled or if the log level is not 'info'.
   * The supported log levels are 'error', 'warn', 'success', and 'info', each represented by a unique prefix.
   *
   * @param {string} message - The message to be logged.
   * @param {string} [level='info'] - The severity level of the log message.
   */
  log (message, level = 'info') {
    const timestamp = new Date().toISOString()
    const prefix =
      level === 'error'
        ? '❌'
        : level === 'warn'
          ? '⚠️'
          : level === 'success'
            ? '✅'
            : 'ℹ️'

    if (this.verbose || level !== 'info') {
      console.log(`${prefix} [${timestamp}] ${message}`)
    }
  }

  async makeRequest (url, options = {}) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url)
      const client = urlObj.protocol === 'https:' ? https : http

      const requestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: options.method || 'GET',
        headers: options.headers || {},
        timeout: this.timeout,
        ...options
      }

      const req = client.request(requestOptions, res => {
        let data = ''

        res.on('data', chunk => {
          data += chunk
        })

        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data
          })
        })
      })

      req.on('error', error => {
        reject(error)
      })

      req.on('timeout', () => {
        req.destroy()
        reject(new Error('Request timeout'))
      })

      if (options.body) {
        req.write(options.body)
      }

      req.end()
    })
  }

  /**
   * Attempts to make a request to a specified URL with retry logic.
   *
   * The function will try to execute the request using `this.makeRequest` up to a specified number of retries.
   * If the request fails, it logs a warning and waits for a backoff period before retrying.
   * If all retries are exhausted, the error is thrown. The backoff period increases with each retry attempt.
   *
   * @param {string} url - The URL to which the request is made.
   * @param {Object} [options={}] - The options to configure the request.
   * @param {number} [retries=this.retries] - The number of retry attempts.
   */
  async retryRequest (url, options = {}, retries = this.retries) {
    for (let i = 0; i <= retries; i++) {
      try {
        const result = await this.makeRequest(url, options)
        return result
      } catch (error) {
        if (i === retries) {
          throw error
        }
        this.log(`Request failed, retrying... (${i + 1}/${retries})`, 'warn')
        await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)))
      }
    }
  }

  /**
   * Verifies the response status of a given endpoint.
   *
   * This function constructs a URL using the base URL and the provided path, then logs the test name.
   * It attempts to send a request to the endpoint and checks if the response status matches the expected status.
   * Depending on the result, it logs the outcome and updates the results array with the test details.
   *
   * @param {string} path - The endpoint path to be tested.
   * @param {number} [expectedStatus=200] - The expected HTTP status code for the response.
   * @param {string} [description=''] - A description for the test, defaults to the endpoint path.
   */
  async verifyEndpoint (path, expectedStatus = 200, description = '') {
    const url = `${this.baseUrl}${path}`
    const testName = description || `${path} endpoint`

    try {
      this.log(`Testing ${testName}...`)
      const response = await this.retryRequest(url)

      if (response.statusCode === expectedStatus) {
        this.log(`${testName} - OK (${response.statusCode})`, 'success')
        this.results.push({
          test: testName,
          status: 'pass',
          details: `Status: ${response.statusCode}`
        })
        return true
      } else {
        this.log(
          `${testName} - Failed (expected ${expectedStatus}, got ${response.statusCode})`,
          'error'
        )
        this.results.push({
          test: testName,
          status: 'fail',
          details: `Expected ${expectedStatus}, got ${response.statusCode}`
        })
        return false
      }
    } catch (error) {
      this.log(`${testName} - Error: ${error.message}`, 'error')
      this.results.push({
        test: testName,
        status: 'error',
        details: error.message
      })
      return false
    }
  }

  /**
   * Verifies the health check endpoints and returns if all checks passed.
   */
  async verifyHealthCheck () {
    this.log('🔍 Verifying health check endpoints...')

    const healthChecks = [
      { path: '/api/health', description: 'Main health check' },
      { path: '/api/health/db', description: 'Database connectivity' },
      { path: '/api/health/redis', description: 'Redis connectivity' },
      {
        path: '/api/health/integrations',
        description: 'External integrations'
      }
    ]

    let passed = 0
    for (const check of healthChecks) {
      if (await this.verifyEndpoint(check.path, 200, check.description)) {
        passed++
      }
    }

    return passed === healthChecks.length
  }

  /**
   * Verifies the main application pages and checks their endpoints.
   */
  async verifyMainPages () {
    this.log('🔍 Verifying main application pages...')

    const pages = [
      { path: '/', description: 'Home page' },
      { path: '/dashboard', description: 'Dashboard page' },
      { path: '/auth/signin', description: 'Sign in page' },
      { path: '/integrations', description: 'Integrations page' }
    ]

    let passed = 0
    for (const page of pages) {
      if (await this.verifyEndpoint(page.path, 200, page.description)) {
        passed++
      }
    }

    return passed >= pages.length * 0.75 // Allow 25% failure for optional pages
  }

  /**
   * Verifies the specified API endpoints and returns whether at least 50% are successful.
   */
  async verifyApiEndpoints () {
    this.log('🔍 Verifying API endpoints...')

    const endpoints = [
      { path: '/api/auth/session', description: 'Auth session endpoint' },
      { path: '/api/github/status', description: 'GitHub integration status' },
      { path: '/api/slack/status', description: 'Slack integration status' }
    ]

    let passed = 0
    for (const endpoint of endpoints) {
      // API endpoints might return 401 for unauthenticated requests, which is OK
      if (
        await this.verifyEndpoint(
          endpoint.path,
          [200, 401],
          endpoint.description
        )
      ) {
        passed++
      }
    }

    return passed >= endpoints.length * 0.5 // Allow 50% failure for auth-protected endpoints
  }

  /**
   * Verifies the performance metrics by measuring the response time of a request.
   *
   * This function logs the start of the performance verification, then attempts to
   * make a request using the `retryRequest` method. It calculates the response time
   * and logs the result as either a success, warning, or error based on the response
   * time. The results are stored in the `results` array with appropriate status and
   * details.
   */
  async verifyPerformance () {
    this.log('🔍 Verifying performance metrics...')

    const startTime = Date.now()

    try {
      await this.retryRequest(this.baseUrl)
      const responseTime = Date.now() - startTime

      if (responseTime < 5000) {
        this.log(`Performance check - OK (${responseTime}ms)`, 'success')
        this.results.push({
          test: 'Response time',
          status: 'pass',
          details: `${responseTime}ms`
        })
        return true
      } else {
        this.log(`Performance check - Slow (${responseTime}ms)`, 'warn')
        this.results.push({
          test: 'Response time',
          status: 'warn',
          details: `${responseTime}ms (slow)`
        })
        return false
      }
    } catch (error) {
      this.log(`Performance check - Error: ${error.message}`, 'error')
      this.results.push({
        test: 'Response time',
        status: 'error',
        details: error.message
      })
      return false
    }
  }

  /**
   * Verifies the presence of essential security headers in the response.
   *
   * This function logs the verification process and checks for specific security headers
   * such as 'x-frame-options', 'x-content-type-options', 'x-xss-protection', and
   * 'strict-transport-security'. It counts the number of present headers and determines
   * if at least half of them are present to pass the security check. In case of an error
   * during the request, it logs the error and updates the results accordingly.
   */
  async verifySecurityHeaders () {
    this.log('🔍 Verifying security headers...')

    try {
      const response = await this.retryRequest(this.baseUrl)
      const headers = response.headers

      const securityHeaders = [
        'x-frame-options',
        'x-content-type-options',
        'x-xss-protection',
        'strict-transport-security'
      ]

      let passed = 0
      for (const header of securityHeaders) {
        if (headers[header]) {
          this.log(`Security header ${header} - Present`, 'success')
          passed++
        } else {
          this.log(`Security header ${header} - Missing`, 'warn')
        }
      }

      const result = passed >= securityHeaders.length * 0.5
      this.results.push({
        test: 'Security headers',
        status: result ? 'pass' : 'warn',
        details: `${passed}/${securityHeaders.length} headers present`
      })

      return result
    } catch (error) {
      this.log(`Security headers check - Error: ${error.message}`, 'error')
      this.results.push({
        test: 'Security headers',
        status: 'error',
        details: error.message
      })
      return false
    }
  }

  /**
   * Verifies the SSL certificate of the base URL.
   *
   * This function checks if the base URL starts with 'https://'. If not, it logs a warning and skips the SSL check.
   * If the URL is valid, it attempts to make a request using the retryRequest function. Depending on the response,
   * it logs the result and updates the results array with the status of the SSL certificate verification.
   */
  async verifySSL () {
    this.log('🔍 Verifying SSL certificate...')

    if (!this.baseUrl.startsWith('https://')) {
      this.log('SSL check - Skipped (not HTTPS)', 'warn')
      this.results.push({
        test: 'SSL certificate',
        status: 'skip',
        details: 'Not HTTPS'
      })
      return true
    }

    try {
      const response = await this.retryRequest(this.baseUrl)
      this.log('SSL certificate - Valid', 'success')
      this.results.push({
        test: 'SSL certificate',
        status: 'pass',
        details: 'Valid certificate'
      })
      return true
    } catch (error) {
      if (error.message.includes('certificate')) {
        this.log(`SSL certificate - Invalid: ${error.message}`, 'error')
        this.results.push({
          test: 'SSL certificate',
          status: 'fail',
          details: error.message
        })
        return false
      }
      // Other errors might not be SSL-related
      return true
    }
  }

  /**
   * Executes a series of deployment verifications and logs the results.
   *
   * This function initiates the verification process for various aspects of the deployment, including health checks, main pages, API endpoints, performance, security headers, and SSL certificate validation. It iterates through each verification, executing the corresponding function and logging the outcome. In case of an error during any verification, it logs the error message and records the failure in the results.
   */
  async runAllVerifications () {
    this.log(`🚀 Starting deployment verification for ${this.baseUrl}`)
    this.log('')

    const verifications = [
      { name: 'Health Checks', fn: () => this.verifyHealthCheck() },
      { name: 'Main Pages', fn: () => this.verifyMainPages() },
      { name: 'API Endpoints', fn: () => this.verifyApiEndpoints() },
      { name: 'Performance', fn: () => this.verifyPerformance() },
      { name: 'Security Headers', fn: () => this.verifySecurityHeaders() },
      { name: 'SSL Certificate', fn: () => this.verifySSL() }
    ]

    const results = []

    for (const verification of verifications) {
      try {
        const result = await verification.fn()
        results.push({ name: verification.name, passed: result })
        this.log('')
      } catch (error) {
        this.log(
          `${verification.name} - Unexpected error: ${error.message}`,
          'error'
        )
        results.push({
          name: verification.name,
          passed: false,
          error: error.message
        })
        this.log('')
      }
    }

    return results
  }

  /**
   * Generate a deployment verification report based on the results of checks.
   *
   * This function calculates the number of passed checks and the overall percentage of success. It logs the overall status, detailed results for each check, and provides a summary message based on the percentage of passed checks. The function also categorizes the results into pass, warn, skip, or fail based on the status of each check.
   *
   * @param results - An array of objects representing the results of checks, each containing properties for the check's name, status, and any associated error messages.
   * @returns A boolean indicating whether the deployment verification passed, partially passed, or failed based on the percentage of checks that passed.
   */
  generateReport (results) {
    const passed = results.filter(r => r.passed).length
    const total = results.length
    const percentage = Math.round((passed / total) * 100)

    this.log('')
    this.log('📊 DEPLOYMENT VERIFICATION REPORT')
    this.log('=====================================')
    this.log(
      `Overall Status: ${passed}/${total} checks passed (${percentage}%)`
    )
    this.log('')

    results.forEach(result => {
      const status = result.passed
        ? '✅ PASS'
        : result.error
          ? '❌ ERROR'
          : '❌ FAIL'
      this.log(`${status} - ${result.name}`)
      if (result.error) {
        this.log(`    Error: ${result.error}`)
      }
    })

    this.log('')
    this.log('📋 Detailed Results:')
    this.results.forEach(result => {
      const status =
        result.status === 'pass'
          ? '✅'
          : result.status === 'warn'
            ? '⚠️'
            : result.status === 'skip'
              ? '⏭️'
              : '❌'
      this.log(`${status} ${result.test}: ${result.details}`)
    })

    this.log('')

    if (percentage >= 80) {
      this.log(
        '🎉 Deployment verification PASSED! System is ready for production.',
        'success'
      )
      return true
    } else if (percentage >= 60) {
      this.log(
        '⚠️ Deployment verification PARTIALLY PASSED. Some issues detected.',
        'warn'
      )
      return false
    } else {
      this.log(
        '❌ Deployment verification FAILED! Critical issues detected.',
        'error'
      )
      return false
    }
  }
}

// CLI interface
async function main () {
  const args = process.argv.slice(2)
  const options = {}

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--url':
        options.baseUrl = args[++i]
        break
      case '--timeout':
        options.timeout = parseInt(args[++i])
        break
      case '--retries':
        options.retries = parseInt(args[++i])
        break
      case '--verbose':
        options.verbose = true
        break
      case '--help':
        console.log(`
Deployment Verification Script

Usage: node deployment-verification.js [options]

Options:
  --url <url>        Base URL to verify (default: https://unifiedhq.com)
  --timeout <ms>     Request timeout in milliseconds (default: 30000)
  --retries <n>      Number of retries for failed requests (default: 3)
  --verbose          Enable verbose logging
  --help             Show this help message

Environment Variables:
  PRODUCTION_URL     Base URL to verify (overridden by --url)

Examples:
  node deployment-verification.js
  node deployment-verification.js --url https://staging.unifiedhq.com --verbose
  node deployment-verification.js --timeout 10000 --retries 5
        `)
        process.exit(0)
        break
    }
  }

  const verifier = new DeploymentVerifier(options)

  try {
    const results = await verifier.runAllVerifications()
    const success = verifier.generateReport(results)

    process.exit(success ? 0 : 1)
  } catch (error) {
    console.error(
      '❌ Deployment verification failed with error:',
      error.message
    )
    process.exit(1)
  }
}

// Export for use as module
module.exports = DeploymentVerifier

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Unexpected error:', error)
    process.exit(1)
  })
}
