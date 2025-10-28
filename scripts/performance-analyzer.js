#!/usr/bin/env node

/**
 * Performance analyzer script for activity feeds
 * Analyzes performance data and generates reports
 */

const fs = require('fs')
const path = require('path')

class PerformanceAnalyzer {
  constructor () {
    this.reportsDir = path.join(process.cwd(), 'reports')
    this.analysisResults = {
      summary: {},
      trends: {},
      recommendations: [],
      alerts: []
    }
  }

  /**
   * Load performance reports from files
   */
  loadReports () {
    if (!fs.existsSync(this.reportsDir)) {
      console.log('📁 No reports directory found. Run perf:monitor first.')
      return []
    }

    const files = fs
      .readdirSync(this.reportsDir)
      .filter(file => file.endsWith('.json'))
      .sort()

    const reports = files.map(file => {
      const filePath = path.join(this.reportsDir, file)
      const content = fs.readFileSync(filePath, 'utf8')
      return JSON.parse(content)
    })

    console.log(`📊 Loaded ${reports.length} performance reports`)
    return reports
  }

  /**
   * Analyze performance trends
   */
  analyzeTrends (reports) {
    if (reports.length < 2) {
      console.log('⚠️ Need at least 2 reports to analyze trends')
      return {}
    }

    const trends = {
      renderTime: this.calculateTrend(reports, 'summary.averageRenderTime'),
      memoryUsage: this.calculateTrend(reports, 'summary.averageMemoryUsage'),
      fps: this.calculateTrend(reports, 'summary.fps'),
      scrollPerformance: this.calculateTrend(
        reports,
        'summary.averageScrollTime'
      )
    }

    return trends
  }

  /**
   * Calculate trend for a specific metric
   */
  calculateTrend (reports, metricPath) {
    const values = reports.map(report => {
      const keys = metricPath.split('.')
      let value = report
      for (const key of keys) {
        value = value[key]
      }
      return value || 0
    })

    if (values.length < 2) return { direction: 'stable', change: 0 }

    const first = values[0]
    const last = values[values.length - 1]
    const change = ((last - first) / first) * 100

    let direction = 'stable'
    if (change > 5) direction = 'improving'
    else if (change < -5) direction = 'degrading'

    return {
      direction,
      change: Math.abs(change),
      first,
      last,
      values
    }
  }

  /**
   * Generate performance summary
   */
  generateSummary (reports) {
    if (reports.length === 0) {
      return { message: 'No performance data available' }
    }

    const latestReport = reports[reports.length - 1]
    const summary = latestReport.summary

    return {
      totalReports: reports.length,
      sessionDuration: summary.sessionDuration,
      averageRenderTime: summary.averageRenderTime,
      maxRenderTime: summary.maxRenderTime,
      averageMemoryUsage: summary.averageMemoryUsage,
      maxMemoryUsage: summary.maxMemoryUsage,
      totalScrollEvents: summary.totalScrollEvents,
      totalUserInteractions: summary.totalUserInteractions,
      totalErrors: summary.totalErrors,
      performanceGrade: this.calculatePerformanceGrade(summary)
    }
  }

  /**
   * Calculate overall performance grade
   */
  calculatePerformanceGrade (summary) {
    let score = 100

    // Deduct points for poor performance
    if (summary.averageRenderTime > 100) score -= 30
    else if (summary.averageRenderTime > 50) score -= 15

    if (summary.averageMemoryUsage > 200) score -= 30
    else if (summary.averageMemoryUsage > 100) score -= 15

    if (summary.totalErrors > 10) score -= 20
    else if (summary.totalErrors > 0) score -= 10

    if (summary.averageScrollTime > 20) score -= 20
    else if (summary.averageScrollTime > 16) score -= 10

    // Grade assignment
    if (score >= 90) return { grade: 'A', description: 'Excellent' }
    if (score >= 80) return { grade: 'B', description: 'Good' }
    if (score >= 70) return { grade: 'C', description: 'Fair' }
    if (score >= 60) return { grade: 'D', description: 'Poor' }
    return { grade: 'F', description: 'Critical' }
  }

  /**
   * Generate recommendations based on analysis
   */
  generateRecommendations (reports, trends) {
    const recommendations = []
    const latestReport = reports[reports.length - 1]
    const summary = latestReport.summary

    // Render time recommendations
    if (summary.averageRenderTime > 100) {
      recommendations.push({
        category: 'Performance',
        priority: 'High',
        issue: 'High average render time',
        recommendation:
          'Implement virtual scrolling and React.memo optimization',
        impact: 'Poor user experience with slow rendering',
        estimatedImprovement: '60-90% reduction in render time'
      })
    }

    // Memory usage recommendations
    if (summary.averageMemoryUsage > 150) {
      recommendations.push({
        category: 'Memory',
        priority: 'High',
        issue: 'High memory usage',
        recommendation: 'Implement memory cleanup and optimize data structures',
        impact: 'Potential browser crashes and poor performance',
        estimatedImprovement: '40-70% reduction in memory usage'
      })
    }

    // Error recommendations
    if (summary.totalErrors > 0) {
      recommendations.push({
        category: 'Stability',
        priority: 'High',
        issue: 'Errors detected during monitoring',
        recommendation:
          'Review error logs and implement proper error boundaries',
        impact: 'Application crashes and poor user experience',
        estimatedImprovement: 'Eliminate runtime errors'
      })
    }

    // Scroll performance recommendations
    if (summary.averageScrollTime > 16) {
      recommendations.push({
        category: 'UX',
        priority: 'Medium',
        issue: 'Slow scroll performance',
        recommendation:
          'Implement scroll throttling and optimize scroll handlers',
        impact: 'Janky scrolling experience',
        estimatedImprovement: 'Smooth 60fps scrolling'
      })
    }

    // Trend-based recommendations (only if trends exist)
    if (
      trends &&
      trends.renderTime &&
      trends.renderTime.direction === 'degrading'
    ) {
      recommendations.push({
        category: 'Performance',
        priority: 'Medium',
        issue: 'Render time is getting worse',
        recommendation:
          'Investigate recent changes that may have impacted performance',
        impact: 'Performance degradation over time',
        estimatedImprovement: 'Stabilize performance trends'
      })
    }

    if (
      trends &&
      trends.memoryUsage &&
      trends.memoryUsage.direction === 'degrading'
    ) {
      recommendations.push({
        category: 'Memory',
        priority: 'High',
        issue: 'Memory usage is increasing',
        recommendation: 'Check for memory leaks and optimize data handling',
        impact: 'Potential memory leaks',
        estimatedImprovement: 'Stable memory usage'
      })
    }

    return recommendations
  }

  /**
   * Generate performance alerts
   */
  generateAlerts (summary) {
    const alerts = []

    if (summary.averageRenderTime > 200) {
      alerts.push({
        type: 'critical',
        message: 'Critical render time detected',
        metric: 'Render Time',
        value: `${summary.averageRenderTime.toFixed(2)}ms`,
        threshold: '200ms'
      })
    }

    if (summary.averageMemoryUsage > 300) {
      alerts.push({
        type: 'critical',
        message: 'Critical memory usage detected',
        metric: 'Memory Usage',
        value: `${summary.averageMemoryUsage.toFixed(2)}MB`,
        threshold: '300MB'
      })
    }

    if (summary.totalErrors > 5) {
      alerts.push({
        type: 'warning',
        message: 'Multiple errors detected',
        metric: 'Error Count',
        value: summary.totalErrors,
        threshold: '5 errors'
      })
    }

    return alerts
  }

  /**
   * Generate comprehensive analysis report
   */
  generateAnalysisReport (reports) {
    const trends = this.analyzeTrends(reports)
    const summary = this.generateSummary(reports)
    const recommendations = this.generateRecommendations(reports, trends)
    const alerts = this.generateAlerts(summary)

    const analysisReport = {
      timestamp: new Date().toISOString(),
      summary,
      trends,
      recommendations,
      alerts,
      reportCount: reports.length,
      analysisPeriod: {
        start: reports[0]?.timestamp,
        end: reports[reports.length - 1]?.timestamp
      }
    }

    return analysisReport
  }

  /**
   * Print analysis results to console
   */
  printAnalysis (analysisReport) {
    console.log('\n📊 Performance Analysis Report')
    console.log('='.repeat(60))

    // Summary
    console.log('\n📈 Summary')
    console.log('-'.repeat(30))
    console.log(
      `Performance Grade: ${analysisReport.summary.performanceGrade.grade} (${analysisReport.summary.performanceGrade.description})`
    )
    console.log(
      `Average Render Time: ${analysisReport.summary.averageRenderTime.toFixed(2)}ms`
    )
    console.log(
      `Average Memory Usage: ${analysisReport.summary.averageMemoryUsage.toFixed(2)}MB`
    )
    console.log(`Total Errors: ${analysisReport.summary.totalErrors}`)
    console.log(
      `Session Duration: ${(analysisReport.summary.sessionDuration / 1000).toFixed(2)}s`
    )

    // Trends
    console.log('\n📊 Trends')
    console.log('-'.repeat(30))
    Object.entries(analysisReport.trends).forEach(([metric, trend]) => {
      const icon =
        trend.direction === 'improving'
          ? '📈'
          : trend.direction === 'degrading'
            ? '📉'
            : '➡️'
      console.log(
        `${icon} ${metric}: ${trend.direction} (${trend.change.toFixed(1)}% change)`
      )
    })

    // Alerts
    if (analysisReport.alerts.length > 0) {
      console.log('\n🚨 Alerts')
      console.log('-'.repeat(30))
      analysisReport.alerts.forEach(alert => {
        const icon = alert.type === 'critical' ? '🔴' : '🟡'
        console.log(`${icon} ${alert.message}`)
        console.log(
          `   ${alert.metric}: ${alert.value} (threshold: ${alert.threshold})`
        )
      })
    }

    // Recommendations
    if (analysisReport.recommendations.length > 0) {
      console.log('\n💡 Recommendations')
      console.log('-'.repeat(30))
      analysisReport.recommendations.forEach((rec, index) => {
        const priority =
          rec.priority === 'High'
            ? '🔴'
            : rec.priority === 'Medium'
              ? '🟡'
              : '🟢'
        console.log(`${index + 1}. ${priority} ${rec.issue}`)
        console.log(`   Recommendation: ${rec.recommendation}`)
        console.log(`   Impact: ${rec.impact}`)
        console.log(`   Expected Improvement: ${rec.estimatedImprovement}\n`)
      })
    }

    // Performance Score
    const score = this.calculateOverallScore(analysisReport)
    console.log('\n🎯 Overall Performance Score')
    console.log('-'.repeat(30))
    console.log(`Score: ${score}/100`)
    console.log(`Grade: ${analysisReport.summary.performanceGrade.grade}`)
    console.log(
      `Status: ${analysisReport.summary.performanceGrade.description}`
    )
  }

  /**
   * Calculate overall performance score
   */
  calculateOverallScore (analysisReport) {
    let score = 100

    // Deduct based on metrics
    if (analysisReport.summary.averageRenderTime > 100) score -= 30
    else if (analysisReport.summary.averageRenderTime > 50) score -= 15

    if (analysisReport.summary.averageMemoryUsage > 200) score -= 30
    else if (analysisReport.summary.averageMemoryUsage > 100) score -= 15

    if (analysisReport.summary.totalErrors > 5) score -= 20
    else if (analysisReport.summary.totalErrors > 0) score -= 10

    // Deduct based on trends
    Object.values(analysisReport.trends).forEach(trend => {
      if (trend.direction === 'degrading') score -= 5
    })

    // Deduct based on alerts
    analysisReport.alerts.forEach(alert => {
      if (alert.type === 'critical') score -= 10
      else if (alert.type === 'warning') score -= 5
    })

    return Math.max(0, score)
  }

  /**
   * Save analysis report to file
   */
  saveAnalysisReport (analysisReport) {
    const filename = `performance-analysis-${Date.now()}.json`
    const filepath = path.join(this.reportsDir, filename)

    // Ensure reports directory exists
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true })
    }

    fs.writeFileSync(filepath, JSON.stringify(analysisReport, null, 2))
    console.log(`\n📄 Analysis report saved to: ${filepath}`)
    return filepath
  }

  /**
   * Run complete analysis
   */
  async runAnalysis () {
    console.log('🔍 Starting performance analysis...\n')

    try {
      const reports = this.loadReports()

      if (reports.length === 0) {
        console.log(
          '❌ No performance reports found. Run "bun run perf:monitor" first.'
        )
        return
      }

      const analysisReport = this.generateAnalysisReport(reports)
      this.printAnalysis(analysisReport)
      this.saveAnalysisReport(analysisReport)

      console.log('\n✅ Performance analysis completed successfully!')
    } catch (error) {
      console.error('❌ Error during performance analysis:', error.message)
      process.exit(1)
    }
  }
}

// CLI interface
if (require.main === module) {
  const analyzer = new PerformanceAnalyzer()
  analyzer.runAnalysis()
}

module.exports = PerformanceAnalyzer
