#!/usr/bin/env node

/**
 * Performance comparison script for activity feeds
 * Compares performance between different implementations or versions
 */

const fs = require('fs')
const path = require('path')

class PerformanceComparison {
  constructor () {
    this.reportsDir = path.join(process.cwd(), 'reports')
    this.comparisonResults = {
      baseline: null,
      comparison: null,
      improvements: {},
      regressions: {},
      summary: {}
    }
  }

  /**
   * Load performance reports
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
   * Compare two performance reports
   */
  compareReports (baselineReport, comparisonReport) {
    const baseline = baselineReport.summary
    const comparison = comparisonReport.summary

    const comparisonResults = {
      renderTime: this.compareMetric(
        baseline.averageRenderTime,
        comparison.averageRenderTime,
        'lower'
      ),
      memoryUsage: this.compareMetric(
        baseline.averageMemoryUsage,
        comparison.averageMemoryUsage,
        'lower'
      ),
      maxRenderTime: this.compareMetric(
        baseline.maxRenderTime,
        comparison.maxRenderTime,
        'lower'
      ),
      maxMemoryUsage: this.compareMetric(
        baseline.maxMemoryUsage,
        comparison.maxMemoryUsage,
        'lower'
      ),
      totalErrors: this.compareMetric(
        baseline.totalErrors,
        comparison.totalErrors,
        'lower'
      ),
      scrollPerformance: this.compareMetric(
        baseline.averageScrollTime,
        comparison.averageScrollTime,
        'lower'
      ),
      userInteractions: this.compareMetric(
        baseline.totalUserInteractions,
        comparison.totalUserInteractions,
        'higher'
      )
    }

    return comparisonResults
  }

  /**
   * Compare individual metrics
   */
  compareMetric (baselineValue, comparisonValue, betterDirection) {
    if (baselineValue === 0 && comparisonValue === 0) {
      return { change: 0, percentage: 0, direction: 'stable' }
    }

    if (baselineValue === 0) {
      return { change: comparisonValue, percentage: 100, direction: 'new' }
    }

    const change = comparisonValue - baselineValue
    const percentage = (change / baselineValue) * 100

    let direction = 'stable'
    if (betterDirection === 'lower') {
      if (change < -5) direction = 'improved'
      else if (change > 5) direction = 'regressed'
    } else if (betterDirection === 'higher') {
      if (change > 5) direction = 'improved'
      else if (change < -5) direction = 'regressed'
    }

    return {
      change,
      percentage: Math.abs(percentage),
      direction,
      baseline: baselineValue,
      comparison: comparisonValue
    }
  }

  /**
   * Generate comparison summary
   */
  generateComparisonSummary (comparison) {
    const improvements = Object.entries(comparison).filter(
      ([_, metric]) => metric.direction === 'improved'
    ).length

    const regressions = Object.entries(comparison).filter(
      ([_, metric]) => metric.direction === 'regressed'
    ).length

    const stable = Object.entries(comparison).filter(
      ([_, metric]) => metric.direction === 'stable'
    ).length

    const overallScore = this.calculateOverallScore(comparison)

    return {
      improvements,
      regressions,
      stable,
      overallScore,
      totalMetrics: Object.keys(comparison).length
    }
  }

  /**
   * Calculate overall performance score
   */
  calculateOverallScore (comparison) {
    let score = 0
    const weights = {
      renderTime: 0.25,
      memoryUsage: 0.25,
      maxRenderTime: 0.15,
      maxMemoryUsage: 0.15,
      totalErrors: 0.1,
      scrollPerformance: 0.05,
      userInteractions: 0.05
    }

    Object.entries(comparison).forEach(([metric, data]) => {
      const weight = weights[metric] || 0.05

      if (data.direction === 'improved') {
        score += weight * 100
      } else if (data.direction === 'stable') {
        score += weight * 50
      } else if (data.direction === 'regressed') {
        score += weight * 0
      }
    })

    return Math.round(score)
  }

  /**
   * Generate recommendations based on comparison
   */
  generateRecommendations (comparison) {
    const recommendations = []

    Object.entries(comparison).forEach(([metric, data]) => {
      if (data.direction === 'regressed') {
        recommendations.push({
          metric,
          issue: `${metric} has regressed`,
          improvement: `${data.percentage.toFixed(1)}% worse`,
          recommendation: this.getRecommendationForMetric(metric),
          priority: data.percentage > 20 ? 'High' : 'Medium'
        })
      } else if (data.direction === 'improved') {
        recommendations.push({
          metric,
          issue: `${metric} has improved`,
          improvement: `${data.percentage.toFixed(1)}% better`,
          recommendation: `Continue current optimization strategies for ${metric}`,
          priority: 'Low'
        })
      }
    })

    return recommendations
  }

  /**
   * Get specific recommendations for metrics
   */
  getRecommendationForMetric (metric) {
    const recommendations = {
      renderTime:
        'Implement virtual scrolling, React.memo, and optimize component rendering',
      memoryUsage:
        'Add memory cleanup, optimize data structures, and implement proper garbage collection',
      maxRenderTime:
        'Optimize expensive operations and implement performance monitoring',
      maxMemoryUsage: 'Check for memory leaks and optimize data handling',
      totalErrors:
        'Review error logs, implement error boundaries, and improve error handling',
      scrollPerformance:
        'Implement scroll throttling and optimize scroll event handlers',
      userInteractions:
        'Optimize event handling and reduce unnecessary re-renders'
    }

    return recommendations[metric] || 'Review and optimize this metric'
  }

  /**
   * Print comparison results
   */
  printComparison (
    baselineReport,
    comparisonReport,
    comparison,
    summary,
    recommendations
  ) {
    console.log('\n📊 Performance Comparison Report')
    console.log('='.repeat(60))

    // Header
    console.log('\n📈 Comparison Overview')
    console.log('-'.repeat(30))
    console.log(`Baseline: ${baselineReport.timestamp}`)
    console.log(`Comparison: ${comparisonReport.timestamp}`)
    console.log(`Overall Score: ${summary.overallScore}/100`)
    console.log(`Improvements: ${summary.improvements}`)
    console.log(`Regressions: ${summary.regressions}`)
    console.log(`Stable: ${summary.stable}`)

    // Detailed metrics
    console.log('\n📊 Detailed Metrics')
    console.log('-'.repeat(30))
    Object.entries(comparison).forEach(([metric, data]) => {
      const icon =
        data.direction === 'improved'
          ? '✅'
          : data.direction === 'regressed'
            ? '❌'
            : '➡️'
      const change =
        data.change > 0 ? `+${data.change.toFixed(2)}` : data.change.toFixed(2)

      console.log(`${icon} ${metric}:`)
      console.log(`   Baseline: ${(data.baseline || 0).toFixed(2)}`)
      console.log(`   Comparison: ${(data.comparison || 0).toFixed(2)}`)
      console.log(`   Change: ${change} (${data.percentage.toFixed(1)}%)`)
      console.log(`   Direction: ${data.direction}\n`)
    })

    // Recommendations
    if (recommendations.length > 0) {
      console.log('\n💡 Recommendations')
      console.log('-'.repeat(30))
      recommendations.forEach((rec, index) => {
        const priority =
          rec.priority === 'High'
            ? '🔴'
            : rec.priority === 'Medium'
              ? '🟡'
              : '🟢'
        console.log(`${index + 1}. ${priority} ${rec.issue}`)
        console.log(`   Improvement: ${rec.improvement}`)
        console.log(`   Recommendation: ${rec.recommendation}\n`)
      })
    }

    // Performance grade
    const grade = this.getPerformanceGrade(summary.overallScore)
    console.log('\n🎯 Performance Grade')
    console.log('-'.repeat(30))
    console.log(`Grade: ${grade.grade} (${grade.description})`)
    console.log(`Score: ${summary.overallScore}/100`)
  }

  /**
   * Get performance grade based on score
   */
  getPerformanceGrade (score) {
    if (score >= 90) {
      return { grade: 'A+', description: 'Excellent improvement' }
    }
    if (score >= 80) return { grade: 'A', description: 'Great improvement' }
    if (score >= 70) return { grade: 'B', description: 'Good improvement' }
    if (score >= 60) return { grade: 'C', description: 'Moderate improvement' }
    if (score >= 50) return { grade: 'D', description: 'Minimal improvement' }
    return { grade: 'F', description: 'No improvement or regression' }
  }

  /**
   * Save comparison report
   */
  saveComparisonReport (
    baselineReport,
    comparisonReport,
    comparison,
    summary,
    recommendations
  ) {
    const comparisonReportData = {
      timestamp: new Date().toISOString(),
      baseline: {
        timestamp: baselineReport.timestamp,
        summary: baselineReport.summary
      },
      comparison: {
        timestamp: comparisonReport.timestamp,
        summary: comparisonReport.summary
      },
      comparison,
      summary,
      recommendations
    }

    const filename = `performance-comparison-${Date.now()}.json`
    const filepath = path.join(this.reportsDir, filename)

    // Ensure reports directory exists
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true })
    }

    fs.writeFileSync(filepath, JSON.stringify(comparisonReportData, null, 2))
    console.log(`\n📄 Comparison report saved to: ${filepath}`)
    return filepath
  }

  /**
   * Run comparison between latest two reports
   */
  async runComparison () {
    console.log('🔍 Starting performance comparison...\n')

    try {
      const reports = this.loadReports()

      if (reports.length < 2) {
        console.log(
          '❌ Need at least 2 performance reports to compare. Run "bun run perf:monitor" multiple times.'
        )
        return
      }

      // Use the last two reports for comparison
      const baselineReport = reports[reports.length - 2]
      const comparisonReport = reports[reports.length - 1]

      const comparison = this.compareReports(baselineReport, comparisonReport)
      const summary = this.generateComparisonSummary(comparison)
      const recommendations = this.generateRecommendations(comparison)

      this.printComparison(
        baselineReport,
        comparisonReport,
        comparison,
        summary,
        recommendations
      )
      this.saveComparisonReport(
        baselineReport,
        comparisonReport,
        comparison,
        summary,
        recommendations
      )

      console.log('\n✅ Performance comparison completed successfully!')
    } catch (error) {
      console.error('❌ Error during performance comparison:', error.message)
      process.exit(1)
    }
  }

  /**
   * Compare specific reports by filename
   */
  async compareSpecificReports (baselineFile, comparisonFile) {
    console.log('🔍 Starting specific performance comparison...\n')

    try {
      const baselinePath = path.join(this.reportsDir, baselineFile)
      const comparisonPath = path.join(this.reportsDir, comparisonFile)

      if (!fs.existsSync(baselinePath) || !fs.existsSync(comparisonPath)) {
        console.log('❌ One or both report files not found.')
        return
      }

      const baselineReport = JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
      const comparisonReport = JSON.parse(
        fs.readFileSync(comparisonPath, 'utf8')
      )

      const comparison = this.compareReports(baselineReport, comparisonReport)
      const summary = this.generateComparisonSummary(comparison)
      const recommendations = this.generateRecommendations(comparison)

      this.printComparison(
        baselineReport,
        comparisonReport,
        comparison,
        summary,
        recommendations
      )
      this.saveComparisonReport(
        baselineReport,
        comparisonReport,
        comparison,
        summary,
        recommendations
      )

      console.log(
        '\n✅ Specific performance comparison completed successfully!'
      )
    } catch (error) {
      console.error(
        '❌ Error during specific performance comparison:',
        error.message
      )
      process.exit(1)
    }
  }
}

// CLI interface
if (require.main === module) {
  const comparator = new PerformanceComparison()

  const args = process.argv.slice(2)

  if (args.length === 2) {
    // Compare specific files
    comparator.compareSpecificReports(args[0], args[1])
  } else {
    // Compare latest two reports
    comparator.runComparison()
  }
}

module.exports = PerformanceComparison
