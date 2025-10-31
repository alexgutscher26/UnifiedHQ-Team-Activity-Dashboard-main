/**
 * Memory Leak Detection CLI Tool
 *
 * Command-line interface for running memory leak detection and applying fixes
 * Integrates with the existing memory leak detection system
 */

import { program } from 'commander';
import { promises as fs } from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);

// Import memory leak detection system
const { createMemoryLeakDetector, cliScan, quickScan } = await import(
  '../src/lib/memory-leak-detection/index.ts'
);

// CLI version
const CLI_VERSION = '1.0.0';

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Utility functions
/**
 * Wraps the given text in color codes.
 */
function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

/**
 * Logs a success message to the console in green.
 */
function logSuccess(message) {
  console.log(colorize(`✓ ${message}`, 'green'));
}

function logError(message) {
  console.error(colorize(`✗ ${message}`, 'red'));
}

/**
 * Logs a warning message to the console.
 */
function logWarning(message) {
  console.warn(colorize(`⚠ ${message}`, 'yellow'));
}

/**
 * Logs an informational message to the console in blue.
 */
function logInfo(message) {
  console.log(colorize(`ℹ ${message}`, 'blue'));
}

// Format leak report for display
/**
 * Formats a leak report into a string representation.
 */
function formatLeakReport(report) {
  const severityColor = {
    critical: 'red',
    high: 'red',
    medium: 'yellow',
    low: 'cyan',
  };

  return [
    colorize(
      `${report.severity.toUpperCase()}`,
      severityColor[report.severity]
    ),
    colorize(`${report.type}`, 'bright'),
    `${report.file}:${report.line}:${report.column}`,
    report.description,
  ].join(' | ');
}

// Generate detailed report
/**
 * Generate a detailed report of memory leak detection results.
 *
 * This function processes an array of reports, logging a summary of the total issues categorized by severity levels.
 * It also groups the issues by file, displaying each report along with any suggested fixes.
 * If no reports are provided, a success message is logged indicating no memory leaks were detected.
 *
 * @param reports - An array of report objects containing memory leak details.
 */
function generateDetailedReport(reports) {
  if (reports.length === 0) {
    logSuccess('No memory leaks detected!');
    return;
  }

  console.log(colorize('\n📊 Memory Leak Detection Report', 'bright'));
  console.log('='.repeat(50));

  // Summary
  const summary = {
    total: reports.length,
    critical: reports.filter(r => r.severity === 'critical').length,
    high: reports.filter(r => r.severity === 'high').length,
    medium: reports.filter(r => r.severity === 'medium').length,
    low: reports.filter(r => r.severity === 'low').length,
    fixable: reports.filter(r => r.suggestedFix).length,
  };

  console.log(`\n${colorize('Summary:', 'bright')}`);
  console.log(`Total issues: ${colorize(summary.total, 'bright')}`);
  console.log(`Critical: ${colorize(summary.critical, 'red')}`);
  console.log(`High: ${colorize(summary.high, 'red')}`);
  console.log(`Medium: ${colorize(summary.medium, 'yellow')}`);
  console.log(`Low: ${colorize(summary.low, 'cyan')}`);
  console.log(`Fixable: ${colorize(summary.fixable, 'green')}`);

  // Group by file
  const byFile = {};
  reports.forEach(report => {
    if (!byFile[report.file]) {
      byFile[report.file] = [];
    }
    byFile[report.file].push(report);
  });

  console.log(`\n${colorize('Issues by file:', 'bright')}`);
  Object.entries(byFile).forEach(([file, fileReports]) => {
    console.log(`\n${colorize(file, 'cyan')} (${fileReports.length} issues)`);
    fileReports.forEach((report, index) => {
      console.log(`  ${index + 1}. ${formatLeakReport(report)}`);
      if (report.suggestedFix) {
        console.log(`     ${colorize('Fix:', 'green')} ${report.suggestedFix}`);
      }
    });
  });
}

// Save report to file
async function saveReport(reports, format, outputPath) {
  try {
    let content;

    switch (format) {
      case 'json':
        content = JSON.stringify(reports, null, 2);
        break;

      case 'csv':
        const headers = [
          'File',
          'Line',
          'Column',
          'Severity',
          'Type',
          'Description',
          'Fix',
        ];
        const rows = reports.map(r => [
          r.file,
          r.line,
          r.column,
          r.severity,
          r.type,
          r.description.replace(/,/g, ';'),
          r.suggestedFix || '',
        ]);
        content = [headers, ...rows].map(row => row.join(',')).join('\n');
        break;

      case 'html':
        content = generateHTMLReport(reports);
        break;

      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    await fs.writeFile(outputPath, content, 'utf-8');
    logSuccess(`Report saved to ${outputPath}`);
  } catch (error) {
    logError(`Failed to save report: ${error.message}`);
  }
}

// Generate HTML report
/**
 * Generates an HTML report for memory leak detection issues.
 *
 * This function takes an array of report objects, calculates the total number of issues and categorizes them by severity (critical, high, medium, low).
 * It then constructs an HTML document that includes a summary of the issues and a detailed table listing each report's file, line, severity, type, description, and suggested fix.
 *
 * @param {Array} reports - An array of report objects containing details about memory leak issues.
 */
function generateHTMLReport(reports) {
  const summary = {
    total: reports.length,
    critical: reports.filter(r => r.severity === 'critical').length,
    high: reports.filter(r => r.severity === 'high').length,
    medium: reports.filter(r => r.severity === 'medium').length,
    low: reports.filter(r => r.severity === 'low').length,
  };

  return `
<!DOCTYPE html>
<html>
<head>
    <title>Memory Leak Detection Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .critical { color: #d32f2f; }
        .high { color: #f57c00; }
        .medium { color: #fbc02d; }
        .low { color: #388e3c; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; }
        .fix { font-style: italic; color: #666; }
    </style>
</head>
<body>
    <h1>Memory Leak Detection Report</h1>
    <div class="summary">
        <h2>Summary</h2>
        <p>Total issues: <strong>${summary.total}</strong></p>
        <p>Critical: <span class="critical">${summary.critical}</span></p>
        <p>High: <span class="high">${summary.high}</span></p>
        <p>Medium: <span class="medium">${summary.medium}</span></p>
        <p>Low: <span class="low">${summary.low}</span></p>
        <p>Generated: ${new Date().toLocaleString()}</p>
    </div>
    
    <h2>Issues</h2>
    <table>
        <thead>
            <tr>
                <th>File</th>
                <th>Line</th>
                <th>Severity</th>
                <th>Type</th>
                <th>Description</th>
                <th>Suggested Fix</th>
            </tr>
        </thead>
        <tbody>
            ${reports
              .map(
                r => `
                <tr>
                    <td>${r.file}</td>
                    <td>${r.line}</td>
                    <td class="${r.severity}">${r.severity}</td>
                    <td>${r.type}</td>
                    <td>${r.description}</td>
                    <td class="fix">${r.suggestedFix || 'Manual review required'}</td>
                </tr>
            `
              )
              .join('')}
        </tbody>
    </table>
</body>
</html>
  `;
}

// Apply fixes automatically
/**
 * Applies suggested fixes to reports based on provided options.
 *
 * This function filters the reports to identify those that have suggested fixes and do not require manual review.
 * If no fixable reports are found, a warning is logged. If the dryRun option is enabled, it displays the fixes
 * that would be applied without making any changes. Otherwise, it logs a warning indicating that the actual
 * fix application is not yet implemented.
 *
 * @param {Array} reports - The list of reports to process for suggested fixes.
 * @param {Object} [options={}] - Options to customize the behavior of the function.
 * @param {boolean} [options.dryRun=false] - If true, performs a dry run without applying fixes.
 * @param {boolean} [options.backup=true] - If true, creates a backup before applying fixes.
 * @param {boolean} [options.interactive=false] - If true, enables interactive mode for user input.
 */
async function applyFixes(reports, options = {}) {
  const { dryRun = false, backup = true, interactive = false } = options;

  const fixableReports = reports.filter(
    r => r.suggestedFix && !r.requiresManualReview
  );

  if (fixableReports.length === 0) {
    logWarning('No automatically fixable issues found');
    return;
  }

  logInfo(`Found ${fixableReports.length} automatically fixable issues`);

  if (dryRun) {
    console.log(
      colorize('\n🔍 Dry run - showing fixes that would be applied:', 'bright')
    );
    fixableReports.forEach((report, index) => {
      console.log(`\n${index + 1}. ${report.file}:${report.line}`);
      console.log(`   Issue: ${report.description}`);
      console.log(`   Fix: ${colorize(report.suggestedFix, 'green')}`);
    });
    return;
  }

  // TODO: Implement actual fix application
  // This would integrate with the fix generation system
  logWarning('Automatic fix application is not yet implemented');
  logInfo('Use the detection results to manually apply fixes');
}

// CLI Commands

// Scan command
program
  .command('scan')
  .description('Scan files or project for memory leaks')
  .option('-f, --files <files...>', 'specific files to scan')
  .option(
    '-o, --output <format>',
    'output format (json|table|summary|html|csv)',
    'summary'
  )
  .option(
    '-s, --severity <level>',
    'minimum severity level (low|medium|high|critical)',
    'low'
  )
  .option(
    '-c, --confidence <number>',
    'minimum confidence threshold (0-1)',
    '0.5'
  )
  .option('--save <path>', 'save report to file')
  .option('--detailed', 'show detailed report')
  .action(async options => {
    try {
      logInfo('Starting memory leak detection...');

      const confidence = parseFloat(options.confidence);
      if (isNaN(confidence) || confidence < 0 || confidence > 1) {
        logError('Confidence must be a number between 0 and 1');
        process.exit(1);
      }

      const reports = await cliScan({
        files: options.files,
        output: options.detailed ? 'detailed' : options.output,
        severity: options.severity,
        confidence,
      });

      if (options.detailed || options.output === 'summary') {
        generateDetailedReport(reports);
      }

      if (options.save) {
        const format = path.extname(options.save).slice(1) || 'json';
        await saveReport(reports, format, options.save);
      }

      // Exit with error code if critical issues found
      const criticalIssues = reports.filter(
        r => r.severity === 'critical'
      ).length;
      if (criticalIssues > 0) {
        logError(`Found ${criticalIssues} critical memory leak issues`);
        process.exit(1);
      }
    } catch (error) {
      logError(`Scan failed: ${error.message}`);
      process.exit(1);
    }
  });

// Fix command
program
  .command('fix')
  .description('Apply automatic fixes for detected memory leaks')
  .option('-f, --files <files...>', 'specific files to fix')
  .option('--dry-run', 'show fixes without applying them')
  .option('--no-backup', 'skip creating backup files')
  .option('-i, --interactive', 'prompt before applying each fix')
  .action(async options => {
    try {
      logInfo('Scanning for fixable memory leaks...');

      const reports = await quickScan({
        files: options.files,
        severity: 'medium', // Only fix medium+ severity issues
      });

      await applyFixes(reports, {
        dryRun: options.dryRun,
        backup: options.backup,
        interactive: options.interactive,
      });
    } catch (error) {
      logError(`Fix failed: ${error.message}`);
      process.exit(1);
    }
  });

// Monitor command
program
  .command('monitor')
  .description('Start real-time memory leak monitoring')
  .option('-i, --interval <ms>', 'monitoring interval in milliseconds', '5000')
  .option('-t, --threshold <mb>', 'memory threshold in MB', '100')
  .option(
    '--duration <seconds>',
    'monitoring duration in seconds (0 for infinite)',
    '0'
  )
  .action(async options => {
    try {
      const interval = parseInt(options.interval);
      const threshold = parseInt(options.threshold);
      const duration = parseInt(options.duration);

      logInfo(
        `Starting memory leak monitoring (interval: ${interval}ms, threshold: ${threshold}MB)`
      );

      const { startRuntimeMonitoring } = await import(
        '../src/lib/memory-leak-detection/index.ts'
      );

      const cleanup = startRuntimeMonitoring({
        interval,
        memoryThreshold: threshold,
        onLeak: report => {
          logWarning(
            `Memory leak detected! Current usage: ${report.memoryUsage.current.toFixed(1)}MB`
          );
          if (report.suspiciousPatterns.length > 0) {
            console.log(
              `Suspicious patterns: ${report.suspiciousPatterns.length}`
            );
            report.suspiciousPatterns.forEach(pattern => {
              console.log(`  - ${pattern.description}`);
            });
          }
        },
      });

      // Handle graceful shutdown
      process.on('SIGINT', () => {
        logInfo('Stopping monitoring...');
        cleanup();
        process.exit(0);
      });

      // Auto-stop after duration if specified
      if (duration > 0) {
        setTimeout(() => {
          logInfo('Monitoring duration completed');
          cleanup();
          process.exit(0);
        }, duration * 1000);
      }

      // Keep process alive
      if (duration === 0) {
        logInfo('Monitoring started. Press Ctrl+C to stop.');
        await new Promise(() => {
          // Intentionally empty - keeps process alive indefinitely
          // Process will be terminated by SIGINT handler
        });
      }
    } catch (error) {
      logError(`Monitor failed: ${error.message}`);
      process.exit(1);
    }
  });

// Report command
program
  .command('report')
  .description('Generate comprehensive memory leak report')
  .option('-o, --output <path>', 'output file path', 'memory-leak-report.html')
  .option('-f, --format <format>', 'report format (html|json|csv)', 'html')
  .option('--include-fixes', 'include suggested fixes in report')
  .action(async options => {
    try {
      logInfo('Generating comprehensive memory leak report...');

      const detector = createMemoryLeakDetector();
      const projectReport = await detector.scanProject();

      const reportData = {
        ...projectReport,
        generatedAt: new Date().toISOString(),
        includeFixes: options.includeFixes,
      };

      await saveReport(projectReport.reports, options.format, options.output);

      logSuccess(`Comprehensive report generated: ${options.output}`);
      logInfo(`Total issues: ${projectReport.totalLeaks}`);
      logInfo(`Files scanned: ${projectReport.files.length}`);
    } catch (error) {
      logError(`Report generation failed: ${error.message}`);
      process.exit(1);
    }
  });

// Config command
program
  .command('config')
  .description('Manage memory leak detection configuration')
  .option('--init', 'create default configuration file')
  .option('--show', 'show current configuration')
  .option('--set <key=value>', 'set configuration value')
  .action(async options => {
    try {
      const { ConfigManager, createDefaultConfigFile } = await import(
        '../src/lib/memory-leak-detection/config.ts'
      );

      if (options.init) {
        await createDefaultConfigFile();
        logSuccess(
          'Default configuration file created: memory-leak-config.json'
        );
        return;
      }

      if (options.show) {
        const configManager = new ConfigManager();
        const config = configManager.getConfig();
        console.log(JSON.stringify(config, null, 2));
        return;
      }

      if (options.set) {
        const [key, value] = options.set.split('=');
        if (!key || value === undefined) {
          logError('Invalid format. Use: --set key=value');
          process.exit(1);
        }

        // TODO: Implement config setting
        logInfo(`Setting ${key} = ${value}`);
        logWarning('Configuration setting is not yet implemented');
        return;
      }

      logError('No action specified. Use --init, --show, or --set');
      process.exit(1);
    } catch (error) {
      logError(`Config command failed: ${error.message}`);
      process.exit(1);
    }
  });

// Stats command
program
  .command('stats')
  .description('Show memory leak detection statistics')
  .option('--reset', 'reset statistics')
  .action(async options => {
    try {
      if (options.reset) {
        logInfo('Statistics reset (not yet implemented)');
        return;
      }

      // TODO: Implement statistics tracking
      logInfo('Memory Leak Detection Statistics:');
      console.log('  Total scans: N/A');
      console.log('  Issues found: N/A');
      console.log('  Issues fixed: N/A');
      console.log('  Last scan: N/A');
      logWarning('Statistics tracking is not yet implemented');
    } catch (error) {
      logError(`Stats command failed: ${error.message}`);
      process.exit(1);
    }
  });

// Main program setup
program
  .name('memory-leak-cli')
  .description('Memory Leak Detection and Fixing CLI Tool')
  .version(CLI_VERSION);

// Global error handling
process.on('unhandledRejection', (reason, promise) => {
  logError(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
  process.exit(1);
});

process.on('uncaughtException', error => {
  logError(`Uncaught Exception: ${error.message}`);
  process.exit(1);
});

// Parse command line arguments
program.parse();
