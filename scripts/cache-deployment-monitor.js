/**
 * Cache Deployment Monitoring Script
 * Monitors cache system health and performance during and after deployment
 */

const fs = require('fs')
const path = require('path')

class CacheDeploymentMonitor {
  constructor (options = {}) {
    this.config = {
      healthEndpoint: options.healthEndpoint || '/api/health/cache',
      baseUrl:
        options.baseUrl ||
        process.env.NEXT_PUBLIC_APP_URL ||
        'http://localhost:3000',
      checkInterval: options.checkInterval || 30000, // 30 seconds
      maxChecks: options.maxChecks || 20, // 10 minutes of monitoring
      alertThresholds: {
        responseTime: options.responseTimeThreshold || 2000, // 2 seconds
        errorRate: options.errorRateThreshold || 5, // 5%
        unhealthyServices: options.unhealthyServicesThreshold || 1
      },
      ...options
    }

    this.checks = []
    this.alerts = []
    this.isRunning = false
  }

  /**
   * Start monitoring cache deployment.
   *
   * This function initiates the monitoring process for cache deployment by logging the monitoring details, including the endpoint and check interval. It enters a loop that performs health checks up to a maximum number of checks defined in the configuration. After each check, it analyzes the results, displays the current status, and waits for the specified interval before the next check. Once monitoring is complete, it generates and logs a final report.
   */
  async startMonitoring () {
    console.log('🚀 Starting cache deployment monitoring...')
    console.log(
      `📊 Monitoring endpoint: ${this.config.baseUrl}${this.config.healthEndpoint}`
    )
    console.log(`⏱️  Check interval: ${this.config.checkInterval / 1000}s`)
    console.log(`🔄 Max checks: ${this.config.maxChecks}`)
    console.log('')

    this.isRunning = true
    let checkCount = 0

    while (this.isRunning && checkCount < this.config.maxChecks) {
      checkCount++
      console.log(`🔍 Health check ${checkCount}/${this.config.maxChecks}...`)

      const checkResult = await this.performHealthCheck()
      this.checks.push(checkResult)

      // Analyze results and generate alerts
      this.analyzeResults(checkResult)

      // Display current status
      this.displayStatus(checkResult, checkCount)

      // Wait for next check (unless it's the last one)
      if (checkCount < this.config.maxChecks && this.isRunning) {
        await this.sleep(this.config.checkInterval)
      }
    }

    // Generate final report
    const report = this.generateReport()
    console.log('\n📋 Monitoring complete. Generating report...')

    return report
  }

  /**
   * Stop monitoring
   */
  stopMonitoring () {
    console.log('\n⏹️  Stopping monitoring...')
    this.isRunning = false
  }

  /**
   * Perform a single health check.
   *
   * This function initiates a health check by sending a GET request to the specified health endpoint.
   * It measures the response time and returns an object containing the timestamp, success status,
   * response time, HTTP status code, response data, and any error message if the request fails.
   * The function handles both successful and failed requests, ensuring that relevant information is captured.
   */
  async performHealthCheck () {
    const startTime = Date.now()

    try {
      const response = await fetch(
        `${this.config.baseUrl}${this.config.healthEndpoint}`,
        {
          method: 'GET',
          headers: {
            'User-Agent': 'UnifiedHQ-DeploymentMonitor/1.0'
          },
          timeout: 10000 // 10 second timeout
        }
      )

      const responseTime = Date.now() - startTime
      const data = await response.json()

      return {
        timestamp: new Date().toISOString(),
        success: true,
        responseTime,
        statusCode: response.status,
        data,
        error: null
      }
    } catch (error) {
      return {
        timestamp: new Date().toISOString(),
        success: false,
        responseTime: Date.now() - startTime,
        statusCode: null,
        data: null,
        error: error.message
      }
    }
  }

  /**
   * Analyze check results and generate alerts.
   *
   * This function evaluates the checkResult object for various conditions, including request success, response time, overall health status, and individual service health. Based on these evaluations, it generates alerts with appropriate severity levels and messages, which are then logged and stored in the alerts collection.
   *
   * @param checkResult - An object containing the results of the health check, including success status, response time, and health data.
   */
  analyzeResults (checkResult) {
    const alerts = []

    // Check if request failed
    if (!checkResult.success) {
      alerts.push({
        type: 'error',
        severity: 'high',
        message: `Health check failed: ${checkResult.error}`,
        timestamp: checkResult.timestamp
      })
    }

    // Check response time
    if (checkResult.responseTime > this.config.alertThresholds.responseTime) {
      alerts.push({
        type: 'performance',
        severity: 'medium',
        message: `Slow response time: ${checkResult.responseTime}ms (threshold: ${this.config.alertThresholds.responseTime}ms)`,
        timestamp: checkResult.timestamp
      })
    }

    // Check overall health status
    if (checkResult.data && checkResult.data.overall !== 'healthy') {
      alerts.push({
        type: 'health',
        severity: checkResult.data.overall === 'unhealthy' ? 'high' : 'medium',
        message: `System health is ${checkResult.data.overall}`,
        timestamp: checkResult.timestamp
      })
    }

    // Check individual service health
    if (checkResult.data && checkResult.data.checks) {
      const unhealthyServices = checkResult.data.checks.filter(
        c => c.status === 'unhealthy'
      )
      if (
        unhealthyServices.length >=
        this.config.alertThresholds.unhealthyServices
      ) {
        alerts.push({
          type: 'service',
          severity: 'high',
          message: `${unhealthyServices.length} unhealthy services: ${unhealthyServices.map(s => s.service).join(', ')}`,
          timestamp: checkResult.timestamp
        })
      }
    }

    // Add alerts to collection
    this.alerts.push(...alerts)

    // Display alerts immediately
    alerts.forEach(alert => {
      const icon =
        alert.severity === 'high'
          ? '🚨'
          : alert.severity === 'medium'
            ? '⚠️'
            : 'ℹ️'
      console.log(`   ${icon} ${alert.type.toUpperCase()}: ${alert.message}`)
    })
  }

  /**
   * Display current status.
   *
   * This function logs the current status based on the provided checkResult object.
   * It evaluates the success of the check and determines the overall status, response time,
   * and status icon to display. If the check is successful, it also logs a summary of
   * service health. In case of failure, it logs the error message.
   *
   * @param {Object} checkResult - The result of the health check containing success status, data, and response time.
   * @param {number} checkCount - The count of checks performed.
   */
  displayStatus (checkResult, checkCount) {
    if (checkResult.success) {
      const status = checkResult.data?.overall || 'unknown'
      const responseTime = checkResult.responseTime
      const statusIcon =
        status === 'healthy' ? '✅' : status === 'degraded' ? '⚠️' : '❌'

      console.log(`   ${statusIcon} Status: ${status} (${responseTime}ms)`)

      if (checkResult.data?.summary) {
        const { healthy, degraded, unhealthy, total } =
          checkResult.data.summary
        console.log(
          `   📊 Services: ${healthy} healthy, ${degraded} degraded, ${unhealthy} unhealthy (${total} total)`
        )
      }
    } else {
      console.log(`   ❌ Check failed: ${checkResult.error}`)
    }

    console.log('')
  }

  /**
   * Calculate the error rate from recent checks.
   */
  calculateErrorRate (recentChecks = 5) {
    const recent = this.checks.slice(-recentChecks)
    if (recent.length === 0) return 0

    const errors = recent.filter(check => !check.success).length
    return (errors / recent.length) * 100
  }

  /**
   * Calculates the average response time from the most recent checks.
   */
  calculateAverageResponseTime (recentChecks = 5) {
    const recent = this.checks.slice(-recentChecks)
    if (recent.length === 0) return 0

    const totalTime = recent.reduce(
      (sum, check) => sum + check.responseTime,
      0
    )
    return Math.round(totalTime / recent.length)
  }

  /**
   * Generate monitoring report.
   *
   * This function compiles a comprehensive monitoring report by calculating the total number of checks,
   * successful and failed checks, success rate, average response time, and recent error rate. It also
   * categorizes alerts by severity and includes the last 10 alerts. The report is then saved to a file
   * and a summary is displayed. The overall status is determined using the `determineOverallStatus` method.
   */
  generateReport () {
    const totalChecks = this.checks.length
    const successfulChecks = this.checks.filter(c => c.success).length
    const failedChecks = totalChecks - successfulChecks
    const successRate =
      totalChecks > 0 ? (successfulChecks / totalChecks) * 100 : 0

    const avgResponseTime = this.calculateAverageResponseTime(totalChecks)
    const recentErrorRate = this.calculateErrorRate(5)

    const alertsBySeverity = {
      high: this.alerts.filter(a => a.severity === 'high').length,
      medium: this.alerts.filter(a => a.severity === 'medium').length,
      low: this.alerts.filter(a => a.severity === 'low').length
    }

    const report = {
      summary: {
        monitoringDuration: totalChecks * (this.config.checkInterval / 1000),
        totalChecks,
        successfulChecks,
        failedChecks,
        successRate: Math.round(successRate * 100) / 100,
        avgResponseTime,
        recentErrorRate: Math.round(recentErrorRate * 100) / 100
      },
      alerts: {
        total: this.alerts.length,
        bySeverity: alertsBySeverity,
        recent: this.alerts.slice(-10) // Last 10 alerts
      },
      checks: this.checks,
      config: this.config,
      timestamp: new Date().toISOString(),
      status: this.determineOverallStatus()
    }

    // Save report to file
    this.saveReport(report)

    // Display summary
    this.displaySummary(report)

    return report
  }

  /**
   * Determine overall monitoring status.
   *
   * This function calculates the recent error rate and average response time over the last 5 entries.
   * It also counts the number of high severity alerts. Based on these metrics, it returns a status
   * of 'critical', 'warning', or 'healthy' depending on the defined thresholds and conditions.
   */
  determineOverallStatus () {
    const recentErrorRate = this.calculateErrorRate(5)
    const avgResponseTime = this.calculateAverageResponseTime(5)
    const highSeverityAlerts = this.alerts.filter(
      a => a.severity === 'high'
    ).length

    if (highSeverityAlerts > 0 || recentErrorRate > 20) {
      return 'critical'
    } else if (
      recentErrorRate > 5 ||
      avgResponseTime > this.config.alertThresholds.responseTime
    ) {
      return 'warning'
    } else {
      return 'healthy'
    }
  }

  /**
   * Saves the report to a JSON file in the reports directory.
   */
  saveReport (report) {
    const reportsDir = path.join(process.cwd(), 'reports')

    // Ensure reports directory exists
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true })
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const reportPath = path.join(
      reportsDir,
      `cache-deployment-monitor-${timestamp}.json`
    )

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
    console.log(`📄 Report saved to: ${reportPath}`)
  }

  /**
   * Display monitoring summary.
   *
   * This function logs a detailed summary of the monitoring report, including the duration, total checks, success rate, average response time, and recent error rate. It also displays the total number of alerts categorized by severity. The overall status is indicated with an appropriate icon based on the report's health status, and if the status is not healthy, it lists recent issues with their severity.
   *
   * @param {Object} report - The monitoring report containing summary and alerts information.
   */
  displaySummary (report) {
    console.log('\n📊 MONITORING SUMMARY')
    console.log('='.repeat(50))
    console.log(`Duration: ${report.summary.monitoringDuration}s`)
    console.log(`Total checks: ${report.summary.totalChecks}`)
    console.log(`Success rate: ${report.summary.successRate}%`)
    console.log(`Average response time: ${report.summary.avgResponseTime}ms`)
    console.log(`Recent error rate: ${report.summary.recentErrorRate}%`)
    console.log(`Total alerts: ${report.alerts.total}`)
    console.log(`  - High severity: ${report.alerts.bySeverity.high}`)
    console.log(`  - Medium severity: ${report.alerts.bySeverity.medium}`)
    console.log(`  - Low severity: ${report.alerts.bySeverity.low}`)

    const statusIcon =
      report.status === 'healthy'
        ? '✅'
        : report.status === 'warning'
          ? '⚠️'
          : '🚨'
    console.log(
      `\n${statusIcon} Overall Status: ${report.status.toUpperCase()}`
    )

    if (report.status !== 'healthy') {
      console.log('\n🔍 Recent Issues:')
      report.alerts.recent.forEach(alert => {
        const icon = alert.severity === 'high' ? '🚨' : '⚠️'
        console.log(`   ${icon} ${alert.message}`)
      })
    }
  }

  /**
   * Returns a promise that resolves after a specified number of milliseconds.
   */
  sleep (ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
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

    if (key && value) {
      switch (key) {
        case 'url':
          options.baseUrl = value
          break
        case 'interval':
          options.checkInterval = parseInt(value) * 1000
          break
        case 'max-checks':
          options.maxChecks = parseInt(value)
          break
        case 'response-time-threshold':
          options.responseTimeThreshold = parseInt(value)
          break
      }
    }
  }

  const monitor = new CacheDeploymentMonitor(options)

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    monitor.stopMonitoring()
    process.exit(0)
  })

  process.on('SIGTERM', () => {
    monitor.stopMonitoring()
    process.exit(0)
  })

  monitor.startMonitoring().catch(error => {
    console.error('❌ Monitoring failed:', error)
    process.exit(1)
  })
}

module.exports = CacheDeploymentMonitor
