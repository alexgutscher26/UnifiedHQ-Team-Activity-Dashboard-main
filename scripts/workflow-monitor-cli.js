/**
 * Workflow Monitor CLI
 * Command-line interface for workflow monitoring and reporting
 * Integrates all workflow monitoring tools and utilities
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

import WorkflowAnalytics from './workflow-analytics.js';
import WorkflowDashboard from './workflow-dashboard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class WorkflowMonitorCLI {
  constructor() {
    this.configPath = path.join(__dirname, 'workflow-config.json');
    this.config = this.loadConfig();
    this.reportsDir = path.join(process.cwd(), 'reports');
    this.ensureReportsDir();
  }

  /**
   * Load configuration from a specified path.
   *
   * This function checks if a configuration file exists at the given path. If it does, the file is read and parsed as JSON. In case of an error during this process, a warning is logged, and default configuration values are returned. The default configuration includes monitoring settings and thresholds for success rate and duration.
   */
  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        return JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
      }
    } catch (error) {
      console.warn('⚠️ Warning: Could not load config file, using defaults');
    }

    return {
      monitoring: { enabled: true },
      thresholds: {
        success_rate: { critical: 80, warning: 90, target: 95 },
        duration: { warning: 600, critical: 1800 },
      },
    };
  }

  /**
   * Ensure reports directory exists
   */
  ensureReportsDir() {
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  /**
   * Run workflow analytics
   */
  async runAnalytics(options = {}) {
    console.log('🔍 Running workflow analytics...');

    const analytics = new WorkflowAnalytics({
      token: options.token || process.env.GITHUB_TOKEN,
      owner: options.owner,
      repo: options.repo,
    });

    try {
      await analytics.collectMetrics(options.days || 30);
      analytics.printSummary();

      const timestamp = new Date().toISOString().split('T')[0];
      const reportPath = analytics.saveReport(
        `workflow-analytics-${timestamp}.json`
      );

      return reportPath;
    } catch (error) {
      console.error('❌ Analytics failed:', error.message);
      throw error;
    }
  }

  /**
   * Generates a dashboard from the specified input file and saves it to the output file.
   */
  generateDashboard(inputFile, outputFile) {
    console.log('📊 Generating dashboard...');

    const dashboard = new WorkflowDashboard();

    if (!dashboard.loadData(inputFile)) {
      throw new Error('Failed to load data for dashboard');
    }

    const timestamp = new Date().toISOString().split('T')[0];
    const output =
      outputFile ||
      path.join(this.reportsDir, `workflow-dashboard-${timestamp}.html`);

    dashboard.saveDashboard(output);
    return output;
  }

  /**
   * Run complete monitoring cycle
   */
  async runComplete(options = {}) {
    console.log('🚀 Running complete workflow monitoring cycle...');

    try {
      // Step 1: Run analytics
      const analyticsReport = await this.runAnalytics(options);

      // Step 2: Generate dashboard
      const dashboardPath = this.generateDashboard(analyticsReport);

      // Step 3: Generate summary
      const summary = this.generateSummary(analyticsReport);

      console.log('\n✅ Monitoring cycle complete!');
      console.log(`📊 Analytics Report: ${analyticsReport}`);
      console.log(`📈 Dashboard: ${dashboardPath}`);
      console.log(`📋 Summary: ${summary.message}`);

      return {
        analytics: analyticsReport,
        dashboard: dashboardPath,
        summary,
      };
    } catch (error) {
      console.error('❌ Monitoring cycle failed:', error.message);
      throw error;
    }
  }

  /**
   * Generate executive summary from an analytics report.
   *
   * This function reads an analytics report from the specified path, parses the JSON data, and constructs a summary object.
   * It retrieves the overall status and generates a status message based on the summary data. The returned object includes
   * metrics such as total runs, success rate, total failures, and counts of critical and warning alerts.
   *
   * @param analyticsReportPath - The file path to the analytics report in JSON format.
   * @returns An object containing the overall status, status message, and relevant metrics.
   */
  generateSummary(analyticsReportPath) {
    const data = JSON.parse(fs.readFileSync(analyticsReportPath, 'utf8'));
    const summary = data.summary || {};

    const status = this.getOverallStatus(summary);
    const message = this.generateStatusMessage(summary, status);

    return {
      status,
      message,
      metrics: {
        totalRuns: summary.totalRuns || 0,
        successRate: summary.overallSuccessRate || 0,
        failures: summary.totalFailures || 0,
        alerts: {
          critical:
            data.alerts?.filter(a => a.level === 'critical').length || 0,
          warning: data.alerts?.filter(a => a.level === 'warning').length || 0,
        },
      },
    };
  }

  /**
   * Determine the overall status based on the success rate.
   *
   * This function evaluates the overall success rate from the provided summary and compares it against defined critical and warning thresholds.
   * It returns 'critical' if the success rate is below the critical threshold, 'warning' if it is below the warning threshold, and 'healthy' otherwise.
   *
   * @param summary - An object containing the overall success rate.
   * @returns A string indicating the overall status: 'critical', 'warning', or 'healthy'.
   */
  getOverallStatus(summary) {
    const successRate = summary.overallSuccessRate || 0;
    const criticalThreshold =
      this.config.thresholds?.success_rate?.critical || 80;
    const warningThreshold =
      this.config.thresholds?.success_rate?.warning || 90;

    if (successRate < criticalThreshold) {
      return 'critical';
    } else if (successRate < warningThreshold) {
      return 'warning';
    } else {
      return 'healthy';
    }
  }

  /**
   * Generate status message
   */
  generateStatusMessage(summary, status) {
    const successRate = (summary.overallSuccessRate || 0).toFixed(1);
    const totalRuns = summary.totalRuns || 0;
    const failures = summary.totalFailures || 0;

    const statusEmoji = {
      healthy: '✅',
      warning: '⚠️',
      critical: '🚨',
    };

    return `${statusEmoji[status]} Workflow Health: ${status.toUpperCase()} | Success Rate: ${successRate}% | Runs: ${totalRuns} | Failures: ${failures}`;
  }

  /**
   * Check workflow health
   */
  async checkHealth(options = {}) {
    console.log('🏥 Checking workflow health...');

    try {
      const analyticsReport = await this.runAnalytics(options);
      const summary = this.generateSummary(analyticsReport);

      console.log(`\n${summary.message}`);

      if (summary.status === 'critical') {
        console.log('\n🚨 CRITICAL ISSUES DETECTED:');
        console.log('- Immediate attention required');
        console.log('- Review failing workflows');
        console.log('- Check recent changes');
        process.exit(1);
      } else if (summary.status === 'warning') {
        console.log('\n⚠️ WARNING: Performance issues detected');
        console.log('- Monitor closely');
        console.log('- Consider optimization');
        process.exit(2);
      } else {
        console.log('\n✅ All workflows are healthy');
        process.exit(0);
      }
    } catch (error) {
      console.error('❌ Health check failed:', error.message);
      process.exit(3);
    }
  }

  /**
   * List recent reports.
   *
   * This function retrieves and displays the most recent workflow reports from the specified directory.
   * It filters the files to include only those that start with 'workflow-' and end with either '.json' or '.html',
   * sorts them in reverse order, and limits the output to the latest 10 reports. If no reports are found,
   * a message is logged to prompt the user to run analytics first. Any errors encountered during the process
   * are caught and logged to the console.
   */
  listReports() {
    console.log('📋 Recent workflow reports:');

    try {
      const files = fs
        .readdirSync(this.reportsDir)
        .filter(
          file =>
            file.startsWith('workflow-') &&
            (file.endsWith('.json') || file.endsWith('.html'))
        )
        .sort()
        .reverse()
        .slice(0, 10);

      if (files.length === 0) {
        console.log('No reports found. Run analytics first.');
        return;
      }

      files.forEach((file, index) => {
        const filePath = path.join(this.reportsDir, file);
        const stats = fs.statSync(filePath);
        const type = file.endsWith('.json') ? '📊 Analytics' : '📈 Dashboard';
        const size = (stats.size / 1024).toFixed(1) + 'KB';

        console.log(
          `${index + 1}. ${type} - ${file} (${size}) - ${stats.mtime.toLocaleDateString()}`
        );
      });
    } catch (error) {
      console.error('❌ Error listing reports:', error.message);
    }
  }

  /**
   * Clean old reports
   */
  cleanReports(days = 30) {
    console.log(`🧹 Cleaning reports older than ${days} days...`);

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const files = fs.readdirSync(this.reportsDir);
      let cleaned = 0;

      files.forEach(file => {
        const filePath = path.join(this.reportsDir, file);
        const stats = fs.statSync(filePath);

        if (stats.mtime < cutoffDate) {
          fs.unlinkSync(filePath);
          cleaned++;
          console.log(`🗑️ Deleted: ${file}`);
        }
      });

      console.log(`✅ Cleaned ${cleaned} old reports`);
    } catch (error) {
      console.error('❌ Error cleaning reports:', error.message);
    }
  }

  /**
   * Displays the current configuration.
   */
  showConfig() {
    console.log('⚙️ Current configuration:');
    console.log(JSON.stringify(this.config, null, 2));
  }

  /**
   * Update configuration
   *
   * This function updates a nested configuration object based on a provided key and value.
   * It splits the key by dots to navigate through the object structure, creating any necessary
   * intermediate objects. The value is attempted to be parsed as JSON; if that fails, it falls
   * back to using the value as a string. Finally, the updated configuration is written to a file.
   *
   * @param {string} key - The key representing the configuration path to update.
   * @param {string} value - The new value to set at the specified configuration path.
   */
  updateConfig(key, value) {
    console.log(`⚙️ Updating configuration: ${key} = ${value}`);

    try {
      // Simple dot notation support
      const keys = key.split('.');
      let current = this.config;

      // Prevent prototype pollution: block dangerous keys in property path
      const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
      for (let i = 0; i < keys.length - 1; i++) {
        if (dangerousKeys.includes(keys[i])) {
          throw new Error(
            `Prototype pollution attempt blocked: "${keys[i]}" is not allowed in configuration keys`
          );
        }
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }
      // Prevent prototype pollution: block dangerous keys for final value assignment
      const lastKey = keys[keys.length - 1];
      if (dangerousKeys.includes(lastKey)) {
        throw new Error(
          `Prototype pollution attempt blocked: "${lastKey}" is not allowed in configuration keys`
        );
      }

      // Try to parse value as JSON, fallback to string
      try {
        current[lastKey] = JSON.parse(value);
      } catch {
        current[lastKey] = value;
      }

      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
      console.log('✅ Configuration updated');
    } catch (error) {
      console.error('❌ Error updating configuration:', error.message);
    }
  }

  /**
   * Show help information for the Workflow Monitor CLI.
   */
  showHelp() {
    console.log(`
🔧 Workflow Monitor CLI

Usage: node workflow-monitor-cli.js <command> [options]

Commands:
  analytics [options]     Run workflow analytics
  dashboard <input>       Generate dashboard from analytics data
  complete [options]      Run complete monitoring cycle (analytics + dashboard)
  health [options]        Check workflow health status
  list                    List recent reports
  clean [days]            Clean old reports (default: 30 days)
  config                  Show current configuration
  config-set <key> <val>  Update configuration value
  help                    Show this help message

Analytics Options:
  --repo <owner/repo>     Repository to analyze (required)
  --token <token>         GitHub token (or set GITHUB_TOKEN env var)
  --days <number>         Number of days to analyze (default: 30)
  --output <file>         Output file for analytics report

Dashboard Options:
  --output <file>         Output file for dashboard HTML

Examples:
  node workflow-monitor-cli.js analytics --repo "myorg/myrepo" --days 14
  node workflow-monitor-cli.js complete --repo "myorg/myrepo"
  node workflow-monitor-cli.js health --repo "myorg/myrepo"
  node workflow-monitor-cli.js dashboard analytics-report.json
  node workflow-monitor-cli.js config-set monitoring.enabled true
  node workflow-monitor-cli.js clean 7

Environment Variables:
  GITHUB_TOKEN           GitHub personal access token
  WORKFLOW_MONITOR_CONFIG Path to custom config file
    `);
  }
}

// CLI entry point
/**
 * Main entry point for the WorkflowMonitorCLI application.
 *
 * This function processes command-line arguments to execute various commands related to workflow monitoring.
 * It handles options for repository details, authentication tokens, and output specifications.
 * Depending on the command provided, it invokes corresponding methods on the WorkflowMonitorCLI instance,
 * ensuring required options are validated and errors are handled appropriately.
 *
 * @param {string[]} args - The command-line arguments passed to the application.
 * @returns {Promise<void>} A promise that resolves when the command execution is complete.
 * @throws {Error} If an unknown command is provided or required options are missing.
 */
async function main() {
  const cli = new WorkflowMonitorCLI();
  const args = process.argv.slice(2);

  if (args.length === 0) {
    cli.showHelp();
    return;
  }

  const command = args[0];
  const options = {};

  // Parse options
  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case '--repo':
        const [owner, repo] = args[++i].split('/');
        options.owner = owner;
        options.repo = repo;
        break;
      case '--token':
        options.token = args[++i];
        break;
      case '--days':
        options.days = parseInt(args[++i]);
        break;
      case '--output':
        options.output = args[++i];
        break;
    }
  }

  try {
    switch (command) {
      case 'analytics':
        if (!options.owner || !options.repo) {
          console.error('❌ Error: --repo option is required');
          process.exit(1);
        }
        await cli.runAnalytics(options);
        break;

      case 'dashboard':
        const inputFile = args[1];
        if (!inputFile) {
          console.error('❌ Error: Input file is required');
          process.exit(1);
        }
        cli.generateDashboard(inputFile, options.output);
        break;

      case 'complete':
        if (!options.owner || !options.repo) {
          console.error('❌ Error: --repo option is required');
          process.exit(1);
        }
        await cli.runComplete(options);
        break;

      case 'health':
        if (!options.owner || !options.repo) {
          console.error('❌ Error: --repo option is required');
          process.exit(1);
        }
        await cli.checkHealth(options);
        break;

      case 'list':
        cli.listReports();
        break;

      case 'clean':
        const days = args[1] ? parseInt(args[1]) : 30;
        cli.cleanReports(days);
        break;

      case 'config':
        cli.showConfig();
        break;

      case 'config-set':
        if (args.length < 3) {
          console.error('❌ Error: config-set requires key and value');
          process.exit(1);
        }
        cli.updateConfig(args[1], args[2]);
        break;

      case 'help':
        cli.showHelp();
        break;

      default:
        console.error(`❌ Unknown command: ${command}`);
        cli.showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Command failed:', error.message);
    process.exit(1);
  }
}

// Run CLI
const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, '/') || '');
if (isMainModule) {
  main().catch(console.error);
}

export default WorkflowMonitorCLI;
