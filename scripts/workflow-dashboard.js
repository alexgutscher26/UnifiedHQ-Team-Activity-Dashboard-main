#!/usr/bin/env node

/**
 * Workflow Dashboard Generator
 * Creates HTML dashboard for workflow monitoring data
 * Integrates with GitHub Actions workflow monitoring system
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

class WorkflowDashboard {
  constructor () {
    this.data = null
    this.template = this.getHTMLTemplate()
  }

  /**
   * Load workflow metrics data
   */
  loadData (dataPath) {
    try {
      const rawData = fs.readFileSync(dataPath, 'utf8')
      this.data = JSON.parse(rawData)
      console.log(`📊 Loaded workflow data from: ${dataPath}`)
      return true
    } catch (error) {
      console.error(`❌ Error loading data from ${dataPath}:`, error.message)
      return false
    }
  }

  /**
   * Generate HTML dashboard
   */
  generateDashboard () {
    if (!this.data) {
      throw new Error('No data loaded. Call loadData() first.')
    }

    const html = this.template
      .replace('{{TITLE}}', this.generateTitle())
      .replace('{{SUMMARY_CARDS}}', this.generateSummaryCards())
      .replace('{{WORKFLOW_TABLE}}', this.generateWorkflowTable())
      .replace('{{CHARTS_DATA}}', this.generateChartsData())
      .replace('{{ALERTS_SECTION}}', this.generateAlertsSection())
      .replace(
        '{{RECOMMENDATIONS_SECTION}}',
        this.generateRecommendationsSection()
      )
      .replace('{{TRENDS_SECTION}}', this.generateTrendsSection())

    return html
  }

  /**
   * Generate dashboard title
   */
  generateTitle () {
    if (this.data.repository) {
      return `Workflow Dashboard - ${this.data.repository}`
    }
    return 'Workflow Monitoring Dashboard'
  }

  /**
   * Generate summary cards HTML
   */
  generateSummaryCards () {
    const summary = this.data.summary || {}

    return `
      <div class="summary-cards">
        <div class="card">
          <div class="card-header">
            <h3>Total Runs</h3>
            <span class="icon">🏃</span>
          </div>
          <div class="card-value">${summary.total_runs || 0}</div>
          <div class="card-subtitle">Workflow executions</div>
        </div>
        
        <div class="card ${this.getSuccessRateClass(summary.success_rate)}">
          <div class="card-header">
            <h3>Success Rate</h3>
            <span class="icon">✅</span>
          </div>
          <div class="card-value">${parseFloat(summary.success_rate || 0).toFixed(1)}%</div>
          <div class="card-subtitle">${summary.successful_runs || 0} successful</div>
        </div>
        
        <div class="card ${summary.failed_runs > 0 ? 'warning' : ''}">
          <div class="card-header">
            <h3>Failed Runs</h3>
            <span class="icon">❌</span>
          </div>
          <div class="card-value">${summary.failed_runs || 0}</div>
          <div class="card-subtitle">Failures detected</div>
        </div>
        
        <div class="card">
          <div class="card-header">
            <h3>Avg Duration</h3>
            <span class="icon">⏱️</span>
          </div>
          <div class="card-value">${this.formatDuration(summary.average_duration || 0)}</div>
          <div class="card-subtitle">Per workflow run</div>
        </div>
        
        <div class="card">
          <div class="card-header">
            <h3>Total Compute</h3>
            <span class="icon">💻</span>
          </div>
          <div class="card-value">${this.formatDuration(summary.total_duration || 0, true)}</div>
          <div class="card-subtitle">Compute time used</div>
        </div>
      </div>
    `
  }

  /**
   * Generate workflow table HTML
   */
  generateWorkflowTable () {
    const workflows = this.data.workflows || {}

    let tableRows = ''
    for (const [name, workflow] of Object.entries(workflows)) {
      const successRate = parseFloat(workflow.success_rate || 0)
      const statusIcon =
        successRate >= 95 ? '✅' : successRate >= 80 ? '⚠️' : '❌'
      const statusClass =
        successRate >= 95 ? 'success' : successRate >= 80 ? 'warning' : 'error'

      tableRows += `
        <tr class="${statusClass}">
          <td>
            <div class="workflow-name">
              <span class="status-icon">${statusIcon}</span>
              ${name}
            </div>
          </td>
          <td>${workflow.total_runs || 0}</td>
          <td>
            <div class="success-rate">
              <span class="rate-value">${successRate.toFixed(1)}%</span>
              <div class="rate-bar">
                <div class="rate-fill" style="width: ${successRate}%"></div>
              </div>
            </div>
          </td>
          <td>${workflow.failed_runs || 0}</td>
          <td>${this.formatDuration(workflow.average_duration || 0)}</td>
          <td>
            <div class="trend ${this.getTrendClass(workflow.trend)}">
              ${this.getTrendIcon(workflow.trend)}
              ${this.getTrendText(workflow.trend)}
            </div>
          </td>
        </tr>
      `
    }

    return `
      <div class="workflow-table-container">
        <table class="workflow-table">
          <thead>
            <tr>
              <th>Workflow</th>
              <th>Runs</th>
              <th>Success Rate</th>
              <th>Failures</th>
              <th>Avg Duration</th>
              <th>Trend</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>
    `
  }

  /**
   * Generate charts data for JavaScript
   */
  generateChartsData () {
    const workflows = this.data.workflows || {}
    const trends = this.data.trends || {}

    // Success rate chart data
    const successRateData = Object.entries(workflows).map(
      ([name, workflow]) => ({
        name: name.length > 20 ? name.substring(0, 20) + '...' : name,
        value: parseFloat(workflow.success_rate || 0)
      })
    )

    // Duration chart data
    const durationData = Object.entries(workflows).map(([name, workflow]) => ({
      name: name.length > 20 ? name.substring(0, 20) + '...' : name,
      value: parseFloat(workflow.average_duration || 0) / 60 // Convert to minutes
    }))

    // Daily trends data
    const dailyTrends = trends.daily_runs || {}
    const dailyTrendsData = Object.entries(dailyTrends)
      .map(([date, stats]) => ({
        date,
        total: stats.total || 0,
        success: stats.success || 0,
        failure: stats.failure || 0
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date))

    return `
      const chartsData = {
        successRate: ${JSON.stringify(successRateData)},
        duration: ${JSON.stringify(durationData)},
        dailyTrends: ${JSON.stringify(dailyTrendsData)}
      };
    `
  }

  /**
   * Generate alerts section HTML
   */
  generateAlertsSection () {
    const alerts = this.data.alerts || []

    if (alerts.length === 0) {
      return `
        <div class="alerts-section">
          <h2>🟢 No Active Alerts</h2>
          <p>All workflows are performing within acceptable parameters.</p>
        </div>
      `
    }

    let alertsHTML = '<div class="alerts-section"><h2>🚨 Active Alerts</h2>'

    const criticalAlerts = alerts.filter(a => a.level === 'critical')
    const warningAlerts = alerts.filter(a => a.level === 'warning')
    const infoAlerts = alerts.filter(a => a.level === 'info')

    if (criticalAlerts.length > 0) {
      alertsHTML +=
        '<div class="alert-group critical"><h3>🔴 Critical Alerts</h3>'
      criticalAlerts.forEach(alert => {
        alertsHTML += `
          <div class="alert critical">
            <div class="alert-header">
              <strong>${alert.workflow || 'System'}</strong>
              <span class="alert-type">${alert.type}</span>
            </div>
            <div class="alert-message">${alert.message}</div>
            <div class="alert-action">Action: ${alert.action}</div>
          </div>
        `
      })
      alertsHTML += '</div>'
    }

    if (warningAlerts.length > 0) {
      alertsHTML +=
        '<div class="alert-group warning"><h3>🟡 Warning Alerts</h3>'
      warningAlerts.forEach(alert => {
        alertsHTML += `
          <div class="alert warning">
            <div class="alert-header">
              <strong>${alert.workflow || 'System'}</strong>
              <span class="alert-type">${alert.type}</span>
            </div>
            <div class="alert-message">${alert.message}</div>
            <div class="alert-action">Action: ${alert.action}</div>
          </div>
        `
      })
      alertsHTML += '</div>'
    }

    if (infoAlerts.length > 0) {
      alertsHTML += '<div class="alert-group info"><h3>🔵 Info Alerts</h3>'
      infoAlerts.forEach(alert => {
        alertsHTML += `
          <div class="alert info">
            <div class="alert-header">
              <strong>${alert.workflow || 'System'}</strong>
              <span class="alert-type">${alert.type}</span>
            </div>
            <div class="alert-message">${alert.message}</div>
            <div class="alert-action">Action: ${alert.action}</div>
          </div>
        `
      })
      alertsHTML += '</div>'
    }

    alertsHTML += '</div>'
    return alertsHTML
  }

  /**
   * Generate recommendations section HTML
   */
  generateRecommendationsSection () {
    const recommendations = this.data.recommendations || []

    if (recommendations.length === 0) {
      return `
        <div class="recommendations-section">
          <h2>💡 No Recommendations</h2>
          <p>Your workflows are optimized and performing well.</p>
        </div>
      `
    }

    let recHTML =
      '<div class="recommendations-section"><h2>💡 Optimization Recommendations</h2>'

    recommendations.forEach((rec, index) => {
      const priorityIcon =
        rec.priority === 'high'
          ? '🔴'
          : rec.priority === 'medium'
            ? '🟡'
            : '🟢'

      recHTML += `
        <div class="recommendation ${rec.priority}">
          <div class="rec-header">
            <span class="priority-icon">${priorityIcon}</span>
            <h3>${rec.title}</h3>
            <span class="category">${rec.category}</span>
          </div>
          <div class="rec-description">${rec.description}</div>
          <div class="rec-actions">
            <h4>Recommended Actions:</h4>
            <ul>
              ${rec.actions.map(action => `<li>${action}</li>`).join('')}
            </ul>
          </div>
          ${
            rec.workflows
              ? `
            <div class="rec-workflows">
              <h4>Affected Workflows:</h4>
              <ul>
                ${rec.workflows.map(w => `<li>${w.name} - ${w.duration || w.failureRate || ''}</li>`).join('')}
              </ul>
            </div>
          `
              : ''
          }
        </div>
      `
    })

    recHTML += '</div>'
    return recHTML
  }

  /**
   * Generate trends section HTML
   */
  generateTrendsSection () {
    return `
      <div class="trends-section">
        <h2>📈 Performance Trends</h2>
        <div class="charts-container">
          <div class="chart-container">
            <h3>Success Rate by Workflow</h3>
            <canvas id="successRateChart"></canvas>
          </div>
          <div class="chart-container">
            <h3>Average Duration by Workflow</h3>
            <canvas id="durationChart"></canvas>
          </div>
          <div class="chart-container full-width">
            <h3>Daily Activity Trends</h3>
            <canvas id="dailyTrendsChart"></canvas>
          </div>
        </div>
      </div>
    `
  }

  /**
   * Helper methods
   */
  getSuccessRateClass (rate) {
    const successRate = parseFloat(rate || 0)
    if (successRate >= 95) return 'success'
    if (successRate >= 80) return 'warning'
    return 'error'
  }

  formatDuration (seconds, long = false) {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)

    if (long && hours > 0) {
      return `${hours}h ${minutes}m`
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`
    } else {
      return `${secs}s`
    }
  }

  getTrendClass (trend) {
    if (!trend) return ''
    if (trend.successRateChange > 5) return 'positive'
    if (trend.successRateChange < -5) return 'negative'
    return 'neutral'
  }

  getTrendIcon (trend) {
    if (!trend) return '➖'
    if (trend.successRateChange > 5) return '📈'
    if (trend.successRateChange < -5) return '📉'
    return '➖'
  }

  getTrendText (trend) {
    if (!trend) return 'No trend data'
    const change = Math.abs(trend.successRateChange).toFixed(1)
    if (trend.successRateChange > 5) return `+${change}%`
    if (trend.successRateChange < -5) return `-${change}%`
    return 'Stable'
  }

  /**
   * HTML template for the dashboard
   */
  getHTMLTemplate () {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{TITLE}}</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f7fa;
            color: #333;
            line-height: 1.6;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 30px;
            text-align: center;
        }

        .header h1 {
            color: #2c3e50;
            font-size: 2.5em;
            margin-bottom: 10px;
        }

        .header .subtitle {
            color: #7f8c8d;
            font-size: 1.1em;
        }

        .summary-cards {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .card {
            background: white;
            padding: 25px;
            border-radius: 12px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            border-left: 4px solid #3498db;
        }

        .card.success {
            border-left-color: #27ae60;
        }

        .card.warning {
            border-left-color: #f39c12;
        }

        .card.error {
            border-left-color: #e74c3c;
        }

        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }

        .card-header h3 {
            color: #2c3e50;
            font-size: 1.1em;
        }

        .card-header .icon {
            font-size: 1.5em;
        }

        .card-value {
            font-size: 2.5em;
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 5px;
        }

        .card-subtitle {
            color: #7f8c8d;
            font-size: 0.9em;
        }

        .section {
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 30px;
        }

        .section h2 {
            color: #2c3e50;
            margin-bottom: 20px;
            font-size: 1.8em;
        }

        .workflow-table-container {
            overflow-x: auto;
        }

        .workflow-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }

        .workflow-table th,
        .workflow-table td {
            padding: 15px;
            text-align: left;
            border-bottom: 1px solid #ecf0f1;
        }

        .workflow-table th {
            background: #f8f9fa;
            font-weight: 600;
            color: #2c3e50;
        }

        .workflow-table tr:hover {
            background: #f8f9fa;
        }

        .workflow-name {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .status-icon {
            font-size: 1.2em;
        }

        .success-rate {
            display: flex;
            flex-direction: column;
            gap: 5px;
        }

        .rate-bar {
            width: 100px;
            height: 6px;
            background: #ecf0f1;
            border-radius: 3px;
            overflow: hidden;
        }

        .rate-fill {
            height: 100%;
            background: #27ae60;
            transition: width 0.3s ease;
        }

        .trend {
            display: flex;
            align-items: center;
            gap: 5px;
            font-size: 0.9em;
        }

        .trend.positive {
            color: #27ae60;
        }

        .trend.negative {
            color: #e74c3c;
        }

        .trend.neutral {
            color: #7f8c8d;
        }

        .alerts-section,
        .recommendations-section,
        .trends-section {
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 30px;
        }

        .alert {
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 15px;
        }

        .alert.critical {
            background: #fdf2f2;
            border-color: #e74c3c;
        }

        .alert.warning {
            background: #fefbf3;
            border-color: #f39c12;
        }

        .alert.info {
            background: #f0f8ff;
            border-color: #3498db;
        }

        .alert-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }

        .alert-type {
            background: #ecf0f1;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8em;
            text-transform: uppercase;
        }

        .alert-message {
            margin-bottom: 10px;
            font-weight: 500;
        }

        .alert-action {
            color: #7f8c8d;
            font-size: 0.9em;
        }

        .recommendation {
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 25px;
            margin-bottom: 20px;
        }

        .recommendation.high {
            border-left: 4px solid #e74c3c;
        }

        .recommendation.medium {
            border-left: 4px solid #f39c12;
        }

        .recommendation.low {
            border-left: 4px solid #27ae60;
        }

        .rec-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 15px;
        }

        .rec-header h3 {
            flex: 1;
            color: #2c3e50;
        }

        .category {
            background: #ecf0f1;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8em;
            text-transform: uppercase;
        }

        .rec-description {
            margin-bottom: 15px;
            color: #555;
        }

        .rec-actions ul,
        .rec-workflows ul {
            margin-left: 20px;
            margin-top: 5px;
        }

        .rec-actions li,
        .rec-workflows li {
            margin-bottom: 5px;
        }

        .charts-container {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-top: 20px;
        }

        .chart-container {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
        }

        .chart-container.full-width {
            grid-column: 1 / -1;
        }

        .chart-container h3 {
            margin-bottom: 15px;
            color: #2c3e50;
            text-align: center;
        }

        .footer {
            text-align: center;
            padding: 20px;
            color: #7f8c8d;
            font-size: 0.9em;
        }

        @media (max-width: 768px) {
            .charts-container {
                grid-template-columns: 1fr;
            }
            
            .summary-cards {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{{TITLE}}</h1>
            <div class="subtitle">Generated on ${new Date().toLocaleString()}</div>
        </div>

        {{SUMMARY_CARDS}}

        <div class="section">
            <h2>📊 Workflow Performance</h2>
            {{WORKFLOW_TABLE}}
        </div>

        {{ALERTS_SECTION}}

        {{RECOMMENDATIONS_SECTION}}

        {{TRENDS_SECTION}}

        <div class="footer">
            <p>Generated by UnifiedHQ Workflow Monitoring System</p>
        </div>
    </div>

    <script>
        {{CHARTS_DATA}}

        // Initialize charts
        document.addEventListener('DOMContentLoaded', function() {
            // Success Rate Chart
            const successRateCtx = document.getElementById('successRateChart');
            if (successRateCtx && chartsData.successRate.length > 0) {
                new Chart(successRateCtx, {
                    type: 'bar',
                    data: {
                        labels: chartsData.successRate.map(d => d.name),
                        datasets: [{
                            label: 'Success Rate (%)',
                            data: chartsData.successRate.map(d => d.value),
                            backgroundColor: chartsData.successRate.map(d => 
                                d.value >= 95 ? '#27ae60' : d.value >= 80 ? '#f39c12' : '#e74c3c'
                            ),
                            borderRadius: 4
                        }]
                    },
                    options: {
                        responsive: true,
                        scales: {
                            y: {
                                beginAtZero: true,
                                max: 100
                            }
                        },
                        plugins: {
                            legend: {
                                display: false
                            }
                        }
                    }
                });
            }

            // Duration Chart
            const durationCtx = document.getElementById('durationChart');
            if (durationCtx && chartsData.duration.length > 0) {
                new Chart(durationCtx, {
                    type: 'bar',
                    data: {
                        labels: chartsData.duration.map(d => d.name),
                        datasets: [{
                            label: 'Duration (minutes)',
                            data: chartsData.duration.map(d => d.value),
                            backgroundColor: '#3498db',
                            borderRadius: 4
                        }]
                    },
                    options: {
                        responsive: true,
                        scales: {
                            y: {
                                beginAtZero: true
                            }
                        },
                        plugins: {
                            legend: {
                                display: false
                            }
                        }
                    }
                });
            }

            // Daily Trends Chart
            const dailyTrendsCtx = document.getElementById('dailyTrendsChart');
            if (dailyTrendsCtx && chartsData.dailyTrends.length > 0) {
                new Chart(dailyTrendsCtx, {
                    type: 'line',
                    data: {
                        labels: chartsData.dailyTrends.map(d => d.date),
                        datasets: [
                            {
                                label: 'Total Runs',
                                data: chartsData.dailyTrends.map(d => d.total),
                                borderColor: '#3498db',
                                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                                fill: true
                            },
                            {
                                label: 'Successful Runs',
                                data: chartsData.dailyTrends.map(d => d.success),
                                borderColor: '#27ae60',
                                backgroundColor: 'rgba(39, 174, 96, 0.1)',
                                fill: true
                            },
                            {
                                label: 'Failed Runs',
                                data: chartsData.dailyTrends.map(d => d.failure),
                                borderColor: '#e74c3c',
                                backgroundColor: 'rgba(231, 76, 60, 0.1)',
                                fill: true
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        scales: {
                            y: {
                                beginAtZero: true
                            }
                        },
                        interaction: {
                            intersect: false,
                            mode: 'index'
                        }
                    }
                });
            }
        });
    </script>
</body>
</html>
    `
  }

  /**
   * Save dashboard to file
   */
  saveDashboard (outputPath) {
    const html = this.generateDashboard()
    fs.writeFileSync(outputPath, html)
    console.log(`📄 Dashboard saved to: ${outputPath}`)
    return outputPath
  }
}

// CLI interface
async function main () {
  const args = process.argv.slice(2)
  let inputFile = null
  let outputFile = null

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--input':
        inputFile = args[++i]
        break
      case '--output':
        outputFile = args[++i]
        break
      case '--help':
        console.log(`
Usage: node workflow-dashboard.js [options]

Options:
  --input <file>      Input JSON file with workflow metrics data
  --output <file>     Output HTML file for the dashboard (default: workflow-dashboard.html)
  --help              Show this help message

Examples:
  node workflow-dashboard.js --input workflow-metrics.json
  node workflow-dashboard.js --input data.json --output custom-dashboard.html
        `)
        process.exit(0)
    }
  }

  // Validate required options
  if (!inputFile) {
    console.error('❌ Error: --input option is required')
    process.exit(1)
  }

  if (!fs.existsSync(inputFile)) {
    console.error(`❌ Error: Input file ${inputFile} does not exist`)
    process.exit(1)
  }

  const dashboard = new WorkflowDashboard()

  if (!dashboard.loadData(inputFile)) {
    process.exit(1)
  }

  const output = outputFile || 'workflow-dashboard.html'
  dashboard.saveDashboard(output)

  console.log('✅ Dashboard generated successfully!')
  console.log(`📂 Open ${output} in your browser to view the dashboard`)
}

// Run CLI if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}

export default WorkflowDashboard
