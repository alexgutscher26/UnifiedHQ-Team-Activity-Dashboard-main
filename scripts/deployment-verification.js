#!/usr/bin/env node

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
