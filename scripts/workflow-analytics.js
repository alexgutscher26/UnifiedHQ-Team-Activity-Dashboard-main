/**
 * Workflow Analytics Script
 * Analyzes GitHub workflow performance data and generates insights
 * Complements the GitHub Actions workflow monitoring system
 */

import fs from 'fs'
import path from 'path'
import { Octokit } from '@octokit/rest'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

class WorkflowAnalytics {
  constructor (options = {}) {
    this.octokit = new Octokit({
      auth: options.token || process.env.GITHUB_TOKEN
    })
    this.owner = options.owner
    this.repo = options.repo
    this.metrics = {
      workflows: {},
      trends: {},
      alerts: [],
      recommendations: []
    }
  }

  /**
   * Collect workflow metrics for analysis.
   *
   * This function retrieves workflow runs from a specified repository for the last
   * given number of days. It calculates the start and end dates, fetches the workflow
   * runs using the Octokit API, and processes each run. After processing, it calculates
   * trends, generates alerts, and recommendations based on the collected metrics.
   *
   * @param {number} [days=30] - The number of days to look back for workflow runs.
   */
  async collectMetrics (days = 30) {
    console.log(`📊 Collecting workflow metrics for the last ${days} days...`)

    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    try {
      const workflowRuns =
        await this.octokit.rest.actions.listWorkflowRunsForRepo({
          owner: this.owner,
          repo: this.repo,
          created: `${startDate.toISOString().split('T')[0]}..${endDate.toISOString().split('T')[0]}`,
          per_page: 100
        })

      console.log(
        `Found ${workflowRuns.data.workflow_runs.length} workflow runs`
      )

      for (const run of workflowRuns.data.workflow_runs) {
        await this.processWorkflowRun(run)
      }

      this.calculateTrends()
      this.generateAlerts()
      this.generateRecommendations()

      return this.metrics
    } catch (error) {
      console.error('Error collecting metrics:', error.message)
      throw error
    }
  }

  /**
   * Process individual workflow run
   */
  async processWorkflowRun (run) {
    const workflowName = run.name
    const status = run.conclusion || run.status
    const duration =
      run.updated_at && run.created_at
        ? (new Date(run.updated_at) - new Date(run.created_at)) / 1000
        : 0

    if (!this.metrics.workflows[workflowName]) {
      this.metrics.workflows[workflowName] = {
        name: workflowName,
        totalRuns: 0,
        successfulRuns: 0,
        failedRuns: 0,
        cancelledRuns: 0,
        totalDuration: 0,
        runs: [],
        dailyStats: {}
      }
    }

    const workflow = this.metrics.workflows[workflowName]
    workflow.totalRuns++
    workflow.totalDuration += duration

    // Track daily statistics
    const runDate = run.created_at.split('T')[0]
    if (!workflow.dailyStats[runDate]) {
      workflow.dailyStats[runDate] = {
        total: 0,
        success: 0,
        failure: 0,
        cancelled: 0
      }
    }
    workflow.dailyStats[runDate].total++

    switch (status) {
      case 'success':
        workflow.successfulRuns++
        workflow.dailyStats[runDate].success++
        break
      case 'failure':
        workflow.failedRuns++
        workflow.dailyStats[runDate].failure++
        break
      case 'cancelled':
        workflow.cancelledRuns++
        workflow.dailyStats[runDate].cancelled++
        break
    }

    workflow.runs.push({
      id: run.id,
      status,
      duration,
      createdAt: run.created_at,
      branch: run.head_branch,
      sha: run.head_sha.substring(0, 7),
      actor: run.actor.login,
      event: run.event
    })
  }

  /**
   * Calculate performance trends
   */
  calculateTrends () {
    console.log('📈 Calculating performance trends...')

    for (const [workflowName, workflow] of Object.entries(
      this.metrics.workflows
    )) {
      // Calculate success rate
      workflow.successRate =
        workflow.totalRuns > 0
          ? (workflow.successfulRuns / workflow.totalRuns) * 100
          : 0

      // Calculate average duration
      workflow.averageDuration =
        workflow.totalRuns > 0
          ? workflow.totalDuration / workflow.totalRuns
          : 0

      // Calculate trend over time (last 7 days vs previous 7 days)
      const sortedDates = Object.keys(workflow.dailyStats).sort()
      if (sortedDates.length >= 14) {
        const midPoint = Math.floor(sortedDates.length / 2)
        const recentDates = sortedDates.slice(midPoint)
        const previousDates = sortedDates.slice(0, midPoint)

        const recentStats = this.aggregateStats(
          recentDates,
          workflow.dailyStats
        )
        const previousStats = this.aggregateStats(
          previousDates,
          workflow.dailyStats
        )

        workflow.trend = {
          successRateChange:
            recentStats.successRate - previousStats.successRate,
          durationChange:
            recentStats.averageDuration - previousStats.averageDuration,
          volumeChange: recentStats.totalRuns - previousStats.totalRuns
        }
      }

      // Identify patterns
      workflow.patterns = this.identifyPatterns(workflow)
    }
  }

  /**
   * Aggregate statistics for a date range
   */
  aggregateStats (dates, dailyStats) {
    let totalRuns = 0
    let successfulRuns = 0
    const totalDuration = 0

    for (const date of dates) {
      if (dailyStats[date]) {
        totalRuns += dailyStats[date].total
        successfulRuns += dailyStats[date].success
      }
    }

    return {
      totalRuns,
      successfulRuns,
      successRate: totalRuns > 0 ? (successfulRuns / totalRuns) * 100 : 0,
      averageDuration: totalDuration / totalRuns || 0
    }
  }

  /**
   * Identify patterns in workflow behavior.
   *
   * This function analyzes the runs of a workflow to detect time-based and branch-specific failure patterns. It calculates hourly and daily failure rates, identifying peak failure hours and branches with high failure rates. Recommendations are provided for addressing identified issues based on the analysis.
   *
   * @param workflow - An object containing the workflow runs to analyze.
   * @returns An array of identified patterns, including temporal and branch-specific failure insights.
   */
  identifyPatterns (workflow) {
    const patterns = []

    // Check for time-based patterns
    const hourlyStats = {}
    const dayOfWeekStats = {}

    for (const run of workflow.runs) {
      const date = new Date(run.createdAt)
      const hour = date.getHours()
      const dayOfWeek = date.getDay()

      if (!hourlyStats[hour]) hourlyStats[hour] = { total: 0, failures: 0 }
      if (!dayOfWeekStats[dayOfWeek]) {
        dayOfWeekStats[dayOfWeek] = { total: 0, failures: 0 }
      }

      hourlyStats[hour].total++
      dayOfWeekStats[dayOfWeek].total++

      if (run.status === 'failure') {
        hourlyStats[hour].failures++
        dayOfWeekStats[dayOfWeek].failures++
      }
    }

    // Find peak failure hours
    const peakFailureHour = Object.entries(hourlyStats)
      .filter(([hour, stats]) => stats.total >= 5) // Minimum sample size
      .reduce((max, [hour, stats]) => {
        const failureRate = stats.failures / stats.total
        return failureRate > (max.failureRate || 0)
          ? { hour, failureRate }
          : max
      }, {})

    if (peakFailureHour.failureRate > 0.3) {
      patterns.push({
        type: 'temporal',
        description: `High failure rate (${(peakFailureHour.failureRate * 100).toFixed(1)}%) at hour ${peakFailureHour.hour}`,
        recommendation:
          'Investigate time-specific issues or resource constraints'
      })
    }

    // Check for branch-specific patterns
    const branchStats = {}
    for (const run of workflow.runs) {
      if (!branchStats[run.branch]) {
        branchStats[run.branch] = { total: 0, failures: 0 }
      }
      branchStats[run.branch].total++
      if (run.status === 'failure') branchStats[run.branch].failures++
    }

    const problematicBranches = Object.entries(branchStats)
      .filter(
        ([branch, stats]) =>
          stats.total >= 3 && stats.failures / stats.total > 0.5
      )
      .map(([branch, stats]) => ({
        branch,
        failureRate: stats.failures / stats.total
      }))

    if (problematicBranches.length > 0) {
      patterns.push({
        type: 'branch',
        description: `High failure rates on branches: ${problematicBranches.map(b => `${b.branch} (${(b.failureRate * 100).toFixed(1)}%)`).join(', ')}`,
        recommendation:
          'Review branch-specific configurations or merge policies'
      })
    }

    return patterns
  }

  /**
   * Generate performance alerts.
   *
   * This function evaluates the success rates and performance trends of workflows to generate alerts based on predefined thresholds.
   * It checks for critical and warning success rates, performance degradation, and long average durations, pushing relevant alerts
   * into the metrics.alerts array with detailed messages, impacts, and recommended actions for each workflow.
   */
  generateAlerts () {
    console.log('🚨 Generating performance alerts...')

    for (const [workflowName, workflow] of Object.entries(
      this.metrics.workflows
    )) {
      // Critical success rate alert
      if (workflow.successRate < 80) {
        this.metrics.alerts.push({
          level: 'critical',
          workflow: workflowName,
          type: 'success_rate',
          message: `Critical: ${workflowName} success rate is ${workflow.successRate.toFixed(1)}% (below 80%)`,
          impact: 'High risk of deployment failures and development delays',
          action: 'Immediate investigation required'
        })
      }
      // Warning success rate alert
      else if (workflow.successRate < 90) {
        this.metrics.alerts.push({
          level: 'warning',
          workflow: workflowName,
          type: 'success_rate',
          message: `Warning: ${workflowName} success rate is ${workflow.successRate.toFixed(1)}% (below 90%)`,
          impact: 'Potential reliability issues',
          action: 'Review and optimize workflow'
        })
      }

      // Performance degradation alert
      if (workflow.trend && workflow.trend.successRateChange < -10) {
        this.metrics.alerts.push({
          level: 'warning',
          workflow: workflowName,
          type: 'degradation',
          message: `Performance degradation: ${workflowName} success rate dropped by ${Math.abs(workflow.trend.successRateChange).toFixed(1)}%`,
          impact: 'Declining workflow reliability',
          action: 'Investigate recent changes'
        })
      }

      // Duration alert
      if (workflow.averageDuration > 1800) {
        // 30 minutes
        this.metrics.alerts.push({
          level: 'info',
          workflow: workflowName,
          type: 'duration',
          message: `Long duration: ${workflowName} averages ${Math.floor(workflow.averageDuration / 60)} minutes`,
          impact: 'Slow feedback cycles',
          action: 'Consider optimization opportunities'
        })
      }
    }
  }

  /**
   * Generate optimization recommendations based on workflow metrics.
   *
   * This function evaluates all workflows to provide recommendations for improving overall reliability, optimizing slow workflows, and addressing identified failure patterns. It calculates the overall success rate and generates high-priority recommendations if the rate is below 95%. Additionally, it identifies slow workflows and patterns to suggest specific actions for improvement.
   *
   * @returns {void}
   */
  generateRecommendations () {
    console.log('💡 Generating optimization recommendations...')

    const allWorkflows = Object.values(this.metrics.workflows)

    // Overall recommendations
    const totalRuns = allWorkflows.reduce((sum, w) => sum + w.totalRuns, 0)
    const totalFailures = allWorkflows.reduce(
      (sum, w) => sum + w.failedRuns,
      0
    )
    const overallSuccessRate =
      totalRuns > 0 ? ((totalRuns - totalFailures) / totalRuns) * 100 : 0

    if (overallSuccessRate < 95) {
      this.metrics.recommendations.push({
        priority: 'high',
        category: 'reliability',
        title: 'Improve Overall Workflow Reliability',
        description: `Overall success rate is ${overallSuccessRate.toFixed(1)}%, below the 95% target`,
        actions: [
          'Identify and fix the most frequently failing workflows',
          'Implement better error handling and retry mechanisms',
          'Review and update workflow configurations',
          'Consider adding more comprehensive testing before workflow execution'
        ]
      })
    }

    // Workflow-specific recommendations
    const slowWorkflows = allWorkflows
      .filter(w => w.averageDuration > 600) // > 10 minutes
      .sort((a, b) => b.averageDuration - a.averageDuration)

    if (slowWorkflows.length > 0) {
      this.metrics.recommendations.push({
        priority: 'medium',
        category: 'performance',
        title: 'Optimize Slow Workflows',
        description: `${slowWorkflows.length} workflows have average durations over 10 minutes`,
        actions: [
          'Implement parallel job execution where possible',
          'Optimize caching strategies for dependencies and builds',
          'Review and remove unnecessary steps',
          'Consider using faster runners or optimized Docker images'
        ],
        workflows: slowWorkflows.slice(0, 5).map(w => ({
          name: w.name,
          duration: Math.floor(w.averageDuration / 60) + ' minutes'
        }))
      })
    }

    // Pattern-based recommendations
    const workflowsWithPatterns = allWorkflows.filter(
      w => w.patterns && w.patterns.length > 0
    )
    if (workflowsWithPatterns.length > 0) {
      this.metrics.recommendations.push({
        priority: 'medium',
        category: 'patterns',
        title: 'Address Identified Failure Patterns',
        description: 'Several workflows show concerning failure patterns',
        actions: [
          'Review time-based failure patterns for resource constraints',
          'Investigate branch-specific issues',
          'Consider implementing conditional workflow execution',
          'Review workflow triggers and dependencies'
        ],
        patterns: workflowsWithPatterns.flatMap(w => w.patterns)
      })
    }
  }

  /**
   * Generate comprehensive report
   */
  generateReport () {
    const report = {
      summary: this.generateSummary(),
      workflows: this.metrics.workflows,
      alerts: this.metrics.alerts,
      recommendations: this.metrics.recommendations,
      generatedAt: new Date().toISOString()
    }

    return report
  }

  /**
   * Generate executive summary.
   *
   * This function aggregates metrics from all workflows, calculating total runs, failures, and durations. It computes the overall success rate and average duration, while also counting alerts by level. Additionally, it identifies the top five failing workflows based on their failure rates.
   *
   * @returns An object containing the total number of workflows, total runs, overall success rate, total failures, average duration, total compute time, alert counts by level, and the top five failing workflows.
   */
  generateSummary () {
    const allWorkflows = Object.values(this.metrics.workflows)
    const totalRuns = allWorkflows.reduce((sum, w) => sum + w.totalRuns, 0)
    const totalFailures = allWorkflows.reduce(
      (sum, w) => sum + w.failedRuns,
      0
    )
    const totalDuration = allWorkflows.reduce(
      (sum, w) => sum + w.totalDuration,
      0
    )

    return {
      totalWorkflows: allWorkflows.length,
      totalRuns,
      overallSuccessRate:
        totalRuns > 0 ? ((totalRuns - totalFailures) / totalRuns) * 100 : 0,
      totalFailures,
      averageDuration: totalRuns > 0 ? totalDuration / totalRuns : 0,
      totalComputeTime: totalDuration,
      alertCounts: {
        critical: this.metrics.alerts.filter(a => a.level === 'critical')
          .length,
        warning: this.metrics.alerts.filter(a => a.level === 'warning').length,
        info: this.metrics.alerts.filter(a => a.level === 'info').length
      },
      topFailingWorkflows: allWorkflows
        .filter(w => w.failedRuns > 0)
        .sort((a, b) => b.failedRuns / b.totalRuns - a.failedRuns / a.totalRuns)
        .slice(0, 5)
        .map(w => ({
          name: w.name,
          failureRate: ((w.failedRuns / w.totalRuns) * 100).toFixed(1) + '%',
          failures: w.failedRuns,
          total: w.totalRuns
        }))
    }
  }

  /**
   * Save report to a specified file or generate a default filename.
   */
  saveReport (filename) {
    const report = this.generateReport()
    const timestamp = new Date().toISOString().split('T')[0]
    const reportFile = filename || `workflow-analytics-${timestamp}.json`
    const reportPath = path.join(process.cwd(), 'reports', reportFile)

    // Ensure reports directory exists
    const reportsDir = path.dirname(reportPath)
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true })
    }

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
    console.log(`📄 Analytics report saved to: ${reportPath}`)
    return reportPath
  }

  /**
   * Print a detailed summary of workflow analytics to the console.
   *
   * This function generates a summary using the generateSummary method and logs various metrics including total workflows, total runs, overall success rate, total failures, average duration, and total compute time. It also checks for alerts and top failing workflows, displaying them if present, along with key recommendations based on metrics.
   */
  printSummary () {
    const summary = this.generateSummary()

    console.log('\n📊 Workflow Analytics Summary')
    console.log('='.repeat(50))
    console.log(`Repository: ${this.owner}/${this.repo}`)
    console.log(`Total Workflows: ${summary.totalWorkflows}`)
    console.log(`Total Runs: ${summary.totalRuns}`)
    console.log(
      `Overall Success Rate: ${summary.overallSuccessRate.toFixed(1)}%`
    )
    console.log(`Total Failures: ${summary.totalFailures}`)
    console.log(
      `Average Duration: ${Math.floor(summary.averageDuration / 60)}m ${Math.floor(summary.averageDuration % 60)}s`
    )
    console.log(
      `Total Compute Time: ${Math.floor(summary.totalComputeTime / 3600)}h ${Math.floor((summary.totalComputeTime % 3600) / 60)}m`
    )

    if (summary.alertCounts.critical > 0 || summary.alertCounts.warning > 0) {
      console.log('\n🚨 Alerts')
      console.log('='.repeat(50))
      if (summary.alertCounts.critical > 0) {
        console.log(`🔴 Critical: ${summary.alertCounts.critical}`)
      }
      if (summary.alertCounts.warning > 0) {
        console.log(`🟡 Warning: ${summary.alertCounts.warning}`)
      }
      if (summary.alertCounts.info > 0) {
        console.log(`🔵 Info: ${summary.alertCounts.info}`)
      }
    }

    if (summary.topFailingWorkflows.length > 0) {
      console.log('\n❌ Top Failing Workflows')
      console.log('='.repeat(50))
      summary.topFailingWorkflows.forEach((workflow, index) => {
        console.log(
          `${index + 1}. ${workflow.name}: ${workflow.failureRate} (${workflow.failures}/${workflow.total})`
        )
      })
    }

    if (this.metrics.recommendations.length > 0) {
      console.log('\n💡 Key Recommendations')
      console.log('='.repeat(50))
      this.metrics.recommendations.slice(0, 3).forEach((rec, index) => {
        const priority =
          rec.priority === 'high'
            ? '🔴'
            : rec.priority === 'medium'
              ? '🟡'
              : '🟢'
        console.log(`${index + 1}. ${priority} ${rec.title}`)
        console.log(`   ${rec.description}`)
      })
    }
  }
}

// CLI interface
/**
 * Main function to execute the workflow analytics process.
 *
 * This function parses command line arguments to configure options for the analysis, including the GitHub token, repository details, days to analyze, and output file. It validates the required options and initializes the WorkflowAnalytics class to collect metrics, print a summary, and save the report. Errors during execution are caught and logged, terminating the process with an appropriate message.
 *
 * @param {string[]} args - Command line arguments passed to the script.
 * @returns {Promise<void>} A promise that resolves when the analysis is complete.
 * @throws Error If required options are missing or if an error occurs during analytics processing.
 */
async function main () {
  const args = process.argv.slice(2)
  const options = {}

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--token':
        options.token = args[++i]
        break
      case '--repo':
        const [owner, repo] = args[++i].split('/')
        options.owner = owner
        options.repo = repo
        break
      case '--days':
        options.days = parseInt(args[++i])
        break
      case '--output':
        options.output = args[++i]
        break
      case '--help':
        console.log(`
Usage: node workflow-analytics.js [options]

Options:
  --token <token>     GitHub personal access token (or set GITHUB_TOKEN env var)
  --repo <owner/repo> Repository to analyze (e.g., "owner/repo-name")
  --days <number>     Number of days to analyze (default: 30)
  --output <file>     Output file for the report (optional)
  --help              Show this help message

Examples:
  node workflow-analytics.js --repo "myorg/myrepo" --days 14
  node workflow-analytics.js --repo "myorg/myrepo" --output "custom-report.json"
        `)
        process.exit(0)
    }
  }

  // Validate required options
  if (!options.owner || !options.repo) {
    console.error('❌ Error: --repo option is required (format: owner/repo)')
    process.exit(1)
  }

  if (!options.token && !process.env.GITHUB_TOKEN) {
    console.error(
      '❌ Error: GitHub token is required (use --token or set GITHUB_TOKEN env var)'
    )
    process.exit(1)
  }

  try {
    const analytics = new WorkflowAnalytics(options)
    await analytics.collectMetrics(options.days || 30)

    analytics.printSummary()
    const reportPath = analytics.saveReport(options.output)

    console.log(`\n✅ Analysis complete! Report saved to: ${reportPath}`)
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

// Run CLI if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}

export default WorkflowAnalytics
