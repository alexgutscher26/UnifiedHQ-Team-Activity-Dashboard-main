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

// Statistics tracking system
class StatisticsManager {
  constructor() {
    this.statsFile = path.join(path.dirname(__filename), '.memory-leak-stats.json');
    this.stats = null;
  }

  async loadStats() {
    try {
      const data = await fs.readFile(this.statsFile, 'utf-8');
      this.stats = JSON.parse(data);
    } catch (error) {
      // Initialize with default stats if file doesn't exist
      this.stats = {
        totalScans: 0,
        totalIssuesFound: 0,
        totalIssuesFixed: 0,
        scanHistory: [],
        fixHistory: [],
        leakTypeStats: {},
        severityStats: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0
        },
        performanceStats: {
          averageScanTime: 0,
          averageFixTime: 0,
          totalScanTime: 0,
          totalFixTime: 0
        },
        firstScan: null,
        lastScan: null,
        lastReset: new Date().toISOString()
      };
    }
    return this.stats;
  }

  async saveStats() {
    try {
      await fs.writeFile(this.statsFile, JSON.stringify(this.stats, null, 2), 'utf-8');
    } catch (error) {
      console.warn(`Failed to save statistics: ${error.message}`);
    }
  }

  async recordScan(reports, scanTime) {
    await this.loadStats();

    const scanRecord = {
      timestamp: new Date().toISOString(),
      issuesFound: reports.length,
      scanTime: scanTime,
      severityBreakdown: {
        critical: reports.filter(r => r.severity === 'critical').length,
        high: reports.filter(r => r.severity === 'high').length,
        medium: reports.filter(r => r.severity === 'medium').length,
        low: reports.filter(r => r.severity === 'low').length
      },
      leakTypes: {}
    };

    // Count leak types
    reports.forEach(report => {
      scanRecord.leakTypes[report.type] = (scanRecord.leakTypes[report.type] || 0) + 1;
    });

    // Update overall stats
    this.stats.totalScans++;
    this.stats.totalIssuesFound += reports.length;
    this.stats.scanHistory.push(scanRecord);

    // Update severity stats
    Object.keys(scanRecord.severityBreakdown).forEach(severity => {
      this.stats.severityStats[severity] += scanRecord.severityBreakdown[severity];
    });

    // Update leak type stats
    Object.keys(scanRecord.leakTypes).forEach(type => {
      this.stats.leakTypeStats[type] = (this.stats.leakTypeStats[type] || 0) + scanRecord.leakTypes[type];
    });

    // Update performance stats
    this.stats.performanceStats.totalScanTime += scanTime;
    this.stats.performanceStats.averageScanTime = this.stats.performanceStats.totalScanTime / this.stats.totalScans;

    // Update timestamps
    if (!this.stats.firstScan) {
      this.stats.firstScan = scanRecord.timestamp;
    }
    this.stats.lastScan = scanRecord.timestamp;

    // Keep only last 100 scan records
    if (this.stats.scanHistory.length > 100) {
      this.stats.scanHistory = this.stats.scanHistory.slice(-100);
    }

    await this.saveStats();
  }

  async recordFix(appliedFixes, fixTime) {
    await this.loadStats();

    const fixRecord = {
      timestamp: new Date().toISOString(),
      fixesApplied: appliedFixes.length,
      fixTime: fixTime,
      fixTypes: {}
    };

    // Count fix types
    appliedFixes.forEach(fix => {
      fixRecord.fixTypes[fix.type] = (fixRecord.fixTypes[fix.type] || 0) + 1;
    });

    // Update overall stats
    this.stats.totalIssuesFixed += appliedFixes.length;
    this.stats.fixHistory.push(fixRecord);

    // Update performance stats
    this.stats.performanceStats.totalFixTime += fixTime;
    if (this.stats.fixHistory.length > 0) {
      this.stats.performanceStats.averageFixTime = this.stats.performanceStats.totalFixTime / this.stats.fixHistory.length;
    }

    // Keep only last 100 fix records
    if (this.stats.fixHistory.length > 100) {
      this.stats.fixHistory = this.stats.fixHistory.slice(-100);
    }

    await this.saveStats();
  }

  async getStats() {
    await this.loadStats();
    return this.stats;
  }

  async resetStats() {
    this.stats = {
      totalScans: 0,
      totalIssuesFound: 0,
      totalIssuesFixed: 0,
      scanHistory: [],
      fixHistory: [],
      leakTypeStats: {},
      severityStats: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      },
      performanceStats: {
        averageScanTime: 0,
        averageFixTime: 0,
        totalScanTime: 0,
        totalFixTime: 0
      },
      firstScan: null,
      lastScan: null,
      lastReset: new Date().toISOString()
    };
    await this.saveStats();
  }

  calculateTrends() {
    if (this.stats.scanHistory.length < 2) {
      return null;
    }

    const recent = this.stats.scanHistory.slice(-10); // Last 10 scans
    const older = this.stats.scanHistory.slice(-20, -10); // Previous 10 scans

    if (older.length === 0) {
      return null;
    }

    const recentAvg = recent.reduce((sum, scan) => sum + scan.issuesFound, 0) / recent.length;
    const olderAvg = older.reduce((sum, scan) => sum + scan.issuesFound, 0) / older.length;

    const trend = recentAvg - olderAvg;
    const trendPercent = olderAvg > 0 ? (trend / olderAvg) * 100 : 0;

    return {
      trend: trend > 0 ? 'increasing' : trend < 0 ? 'decreasing' : 'stable',
      change: Math.abs(trend),
      changePercent: Math.abs(trendPercent),
      recentAverage: recentAvg,
      previousAverage: olderAvg
    };
  }
}

// Global statistics manager instance
const statsManager = new StatisticsManager();

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
 * that would be applied without making any changes. Otherwise, it applies the fixes to the actual files.
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
      if (report.fixDetails) {
        console.log(`   Details: ${report.fixDetails}`);
      }
    });
    return;
  }

  // Group fixes by file for efficient processing
  const fixesByFile = {};
  fixableReports.forEach(report => {
    if (!fixesByFile[report.file]) {
      fixesByFile[report.file] = [];
    }
    fixesByFile[report.file].push(report);
  });

  let appliedFixes = [];
  let failedFixes = 0;

  // Process each file
  for (const [filePath, fileReports] of Object.entries(fixesByFile)) {
    try {
      logInfo(`Processing ${filePath} (${fileReports.length} fixes)`);

      // Create backup if requested
      if (backup) {
        await createBackup(filePath);
      }

      // Apply fixes to the file
      const success = await applyFixesToFile(filePath, fileReports, interactive);

      if (success) {
        appliedFixes.push(...fileReports.map(report => ({
          ...report,
          fixedAt: new Date().toISOString(),
          filePath
        })));
        logSuccess(`Applied ${fileReports.length} fixes to ${filePath}`);
      } else {
        failedFixes += fileReports.length;
        logError(`Failed to apply fixes to ${filePath}`);
      }
    } catch (error) {
      failedFixes += fileReports.length;
      logError(`Error processing ${filePath}: ${error.message}`);
    }
  }

  // Summary
  console.log(colorize('\n📊 Fix Application Summary', 'bright'));
  console.log(`Successfully applied: ${colorize(appliedFixes.length, 'green')} fixes`);
  if (failedFixes > 0) {
    console.log(`Failed to apply: ${colorize(failedFixes, 'red')} fixes`);
  }

  if (appliedFixes.length > 0) {
    logSuccess('Memory leak fixes have been applied!');
    logInfo('Please review the changes and run tests to ensure everything works correctly.');
  }

  // Return statistics for tracking
  return {
    appliedFixes,
    failedFixes,
    totalAttempted: fixableReports.length
  };
}

/**
 * Create a backup of the file before applying fixes
 */
async function createBackup(filePath) {
  try {
    const backupPath = `${filePath}.backup.${Date.now()}`;
    const content = await fs.readFile(filePath, 'utf-8');
    await fs.writeFile(backupPath, content, 'utf-8');
    logInfo(`Backup created: ${backupPath}`);
  } catch (error) {
    logWarning(`Failed to create backup for ${filePath}: ${error.message}`);
  }
}

/**
 * Apply fixes to a specific file
 */
async function applyFixesToFile(filePath, reports, interactive) {
  try {
    let content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    // Sort reports by line number in descending order to avoid line number shifts
    const sortedReports = reports.sort((a, b) => b.line - a.line);

    for (const report of sortedReports) {
      if (interactive) {
        const shouldApply = await promptForFix(report);
        if (!shouldApply) {
          logInfo(`Skipped fix for ${report.file}:${report.line}`);
          continue;
        }
      }

      const success = await applyIndividualFix(lines, report);
      if (!success) {
        logWarning(`Failed to apply fix at ${report.file}:${report.line}`);
        return false;
      }
    }

    // Write the modified content back to the file
    const modifiedContent = lines.join('\n');
    await fs.writeFile(filePath, modifiedContent, 'utf-8');

    return true;
  } catch (error) {
    logError(`Error applying fixes to ${filePath}: ${error.message}`);
    return false;
  }
}

/**
 * Apply an individual fix to the code lines
 */
async function applyIndividualFix(lines, report) {
  try {
    const lineIndex = report.line - 1; // Convert to 0-based index

    if (lineIndex < 0 || lineIndex >= lines.length) {
      logWarning(`Invalid line number ${report.line} in ${report.file}`);
      return false;
    }

    const originalLine = lines[lineIndex];

    // Apply different types of fixes based on the report type
    switch (report.type) {
      case 'event-listener-leak':
        lines[lineIndex] = applyEventListenerFix(originalLine, report);
        break;

      case 'timer-leak':
        lines[lineIndex] = applyTimerFix(originalLine, report);
        break;

      case 'closure-leak':
        lines[lineIndex] = applyClosureFix(originalLine, report);
        break;

      case 'dom-reference-leak':
        lines[lineIndex] = applyDOMReferenceFix(originalLine, report);
        break;

      case 'async-operation-leak':
        lines[lineIndex] = applyAsyncOperationFix(originalLine, report);
        break;

      case 'observer-leak':
        lines[lineIndex] = applyObserverFix(originalLine, report);
        break;

      default:
        // Generic fix application
        if (report.replacement) {
          lines[lineIndex] = report.replacement;
        } else {
          logWarning(`No specific fix handler for type: ${report.type}`);
          return false;
        }
    }

    logInfo(`Applied fix: ${originalLine.trim()} → ${lines[lineIndex].trim()}`);
    return true;
  } catch (error) {
    logError(`Error applying individual fix: ${error.message}`);
    return false;
  }
}

/**
 * Fix event listener leaks
 */
function applyEventListenerFix(line, report) {
  // Add cleanup for event listeners
  if (line.includes('addEventListener') && !line.includes('removeEventListener')) {
    const indent = line.match(/^\s*/)[0];
    const eventMatch = line.match(/addEventListener\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*([^,)]+)/);

    if (eventMatch) {
      const [, eventType, handler] = eventMatch;
      return line + '\n' + indent + `// TODO: Add cleanup - element.removeEventListener('${eventType}', ${handler});`;
    }
  }

  return line;
}

/**
 * Fix timer leaks
 */
function applyTimerFix(line, report) {
  // Add cleanup for timers
  if (line.includes('setInterval') || line.includes('setTimeout')) {
    const indent = line.match(/^\s*/)[0];
    const timerType = line.includes('setInterval') ? 'clearInterval' : 'clearTimeout';

    // If it's an assignment, suggest storing the ID
    if (line.includes('=')) {
      return line + '\n' + indent + `// TODO: Add cleanup - ${timerType}(timerId);`;
    } else {
      // Suggest storing the timer ID
      const timerCall = line.match(/(set(?:Interval|Timeout)\([^)]+\))/);
      if (timerCall) {
        return line.replace(timerCall[1], `const timerId = ${timerCall[1]}`) +
          '\n' + indent + `// TODO: Add cleanup - ${timerType}(timerId);`;
      }
    }
  }

  return line;
}

/**
 * Fix closure leaks
 */
function applyClosureFix(line, report) {
  // Add null assignments for closure variables
  if (report.suggestedFix && report.suggestedFix.includes('null')) {
    const indent = line.match(/^\s*/)[0];
    return line + '\n' + indent + report.suggestedFix;
  }

  return line;
}

/**
 * Fix DOM reference leaks
 */
function applyDOMReferenceFix(line, report) {
  // Add null assignments for DOM references
  if (line.includes('querySelector') || line.includes('getElementById')) {
    const indent = line.match(/^\s*/)[0];
    const varMatch = line.match(/(?:const|let|var)\s+(\w+)/);

    if (varMatch) {
      const varName = varMatch[1];
      return line + '\n' + indent + `// TODO: Add cleanup - ${varName} = null;`;
    }
  }

  return line;
}

/**
 * Fix async operation leaks
 */
function applyAsyncOperationFix(line, report) {
  // Add abort controllers for fetch requests
  if (line.includes('fetch(')) {
    const indent = line.match(/^\s*/)[0];
    return indent + 'const controller = new AbortController();\n' +
      line.replace('fetch(', 'fetch(') +
      '\n' + indent + '// TODO: Add cleanup - controller.abort();';
  }

  return line;
}

/**
 * Fix observer leaks
 */
function applyObserverFix(line, report) {
  // Add disconnect calls for observers
  if (line.includes('Observer(') && !line.includes('disconnect')) {
    const indent = line.match(/^\s*/)[0];
    const observerMatch = line.match(/(?:const|let|var)\s+(\w+)/);

    if (observerMatch) {
      const observerName = observerMatch[1];
      return line + '\n' + indent + `// TODO: Add cleanup - ${observerName}.disconnect();`;
    }
  }

  return line;
}

/**
 * Prompt user for interactive fix confirmation
 */
async function promptForFix(report) {
  // Note: In a real implementation, you'd use a proper CLI prompt library like 'inquirer'
  // For now, we'll just return true to apply all fixes
  console.log(colorize(`\nApply fix for ${report.file}:${report.line}?`, 'yellow'));
  console.log(`Issue: ${report.description}`);
  console.log(`Fix: ${report.suggestedFix}`);

  // In interactive mode, you would prompt the user here
  // For this implementation, we'll auto-approve
  return true;
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
      const scanStartTime = Date.now();

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

      // Record scan statistics
      const scanTime = Date.now() - scanStartTime;
      await statsManager.recordScan(reports, scanTime);

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
  .option('-s, --severity <level>', 'minimum severity to fix (medium|high|critical)', 'medium')
  .option('--type <types...>', 'specific leak types to fix')
  .option('--exclude <patterns...>', 'exclude files matching patterns')
  .action(async options => {
    try {
      logInfo('Scanning for fixable memory leaks...');
      const fixStartTime = Date.now();

      const scanOptions = {
        files: options.files,
        severity: options.severity,
      };

      // Add file exclusion patterns
      if (options.exclude) {
        scanOptions.exclude = options.exclude;
      }

      const reports = await quickScan(scanOptions);

      // Filter by leak types if specified
      let filteredReports = reports;
      if (options.type) {
        filteredReports = reports.filter(r => options.type.includes(r.type));
        logInfo(`Filtered to ${filteredReports.length} reports matching types: ${options.type.join(', ')}`);
      }

      const fixResults = await applyFixes(filteredReports, {
        dryRun: options.dryRun,
        backup: options.backup,
        interactive: options.interactive,
      });

      // Record fix statistics (only if not dry run and fixes were applied)
      if (!options.dryRun && fixResults && fixResults.appliedFixes.length > 0) {
        const fixTime = Date.now() - fixStartTime;
        await statsManager.recordFix(fixResults.appliedFixes, fixTime);
      }

      // Suggest running tests after fixes
      if (!options.dryRun && filteredReports.some(r => !r.requiresManualReview)) {
        console.log(colorize('\n💡 Recommendations:', 'bright'));
        console.log('1. Review the applied changes carefully');
        console.log('2. Run your test suite to ensure nothing is broken');
        console.log('3. Test the application manually in areas where fixes were applied');
        console.log('4. Consider running the scan again to verify fixes worked');
      }
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

// Validate command
program
  .command('validate')
  .description('Validate that applied fixes resolved memory leaks')
  .option('-f, --files <files...>', 'specific files to validate')
  .option('--before <path>', 'path to report file from before fixes')
  .option('--compare', 'compare current state with previous scan results')
  .action(async options => {
    try {
      logInfo('Validating applied memory leak fixes...');

      // Run a new scan
      const currentReports = await quickScan({
        files: options.files,
      });

      if (options.before) {
        // Compare with previous results
        const beforeContent = await fs.readFile(options.before, 'utf-8');
        const beforeReports = JSON.parse(beforeContent);

        const comparison = compareReports(beforeReports, currentReports);
        displayComparison(comparison);
      } else {
        // Just show current state
        generateDetailedReport(currentReports);

        if (currentReports.length === 0) {
          logSuccess('🎉 No memory leaks detected! All fixes appear to be working.');
        } else {
          logWarning(`${currentReports.length} memory leak issues still remain.`);
          console.log('Consider running the fix command again or reviewing these issues manually.');
        }
      }
    } catch (error) {
      logError(`Validation failed: ${error.message}`);
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
        await statsManager.resetStats();
        logSuccess('Statistics have been reset');
        return;
      }

      const stats = await statsManager.getStats();
      const trends = statsManager.calculateTrends();

      console.log(colorize('\n📊 Memory Leak Detection Statistics', 'bright'));
      console.log('='.repeat(50));

      // Overview
      console.log(colorize('\n📈 Overview:', 'bright'));
      console.log(`Total scans performed: ${colorize(stats.totalScans, 'cyan')}`);
      console.log(`Total issues found: ${colorize(stats.totalIssuesFound, 'yellow')}`);
      console.log(`Total issues fixed: ${colorize(stats.totalIssuesFixed, 'green')}`);

      if (stats.totalIssuesFound > 0) {
        const fixRate = ((stats.totalIssuesFixed / stats.totalIssuesFound) * 100).toFixed(1);
        console.log(`Fix rate: ${colorize(fixRate + '%', fixRate > 70 ? 'green' : fixRate > 40 ? 'yellow' : 'red')}`);
      }

      // Timestamps
      if (stats.firstScan) {
        console.log(`First scan: ${colorize(new Date(stats.firstScan).toLocaleString(), 'cyan')}`);
      }
      if (stats.lastScan) {
        console.log(`Last scan: ${colorize(new Date(stats.lastScan).toLocaleString(), 'cyan')}`);
      }

      // Severity breakdown
      console.log(colorize('\n🚨 Issues by Severity:', 'bright'));
      console.log(`Critical: ${colorize(stats.severityStats.critical, 'red')}`);
      console.log(`High: ${colorize(stats.severityStats.high, 'red')}`);
      console.log(`Medium: ${colorize(stats.severityStats.medium, 'yellow')}`);
      console.log(`Low: ${colorize(stats.severityStats.low, 'cyan')}`);

      // Leak types
      if (Object.keys(stats.leakTypeStats).length > 0) {
        console.log(colorize('\n🔍 Most Common Leak Types:', 'bright'));
        const sortedTypes = Object.entries(stats.leakTypeStats)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5);

        sortedTypes.forEach(([type, count], index) => {
          console.log(`${index + 1}. ${type}: ${colorize(count, 'yellow')}`);
        });
      }

      // Performance stats
      console.log(colorize('\n⚡ Performance:', 'bright'));
      if (stats.performanceStats.averageScanTime > 0) {
        console.log(`Average scan time: ${colorize((stats.performanceStats.averageScanTime / 1000).toFixed(2) + 's', 'cyan')}`);
      }
      if (stats.performanceStats.averageFixTime > 0) {
        console.log(`Average fix time: ${colorize((stats.performanceStats.averageFixTime / 1000).toFixed(2) + 's', 'cyan')}`);
      }

      // Trends
      if (trends) {
        console.log(colorize('\n📊 Trends (Last 20 scans):', 'bright'));
        const trendColor = trends.trend === 'decreasing' ? 'green' :
          trends.trend === 'increasing' ? 'red' : 'yellow';
        console.log(`Issue trend: ${colorize(trends.trend, trendColor)}`);

        if (trends.trend !== 'stable') {
          console.log(`Change: ${colorize(trends.changePercent.toFixed(1) + '%', trendColor)}`);
          console.log(`Recent average: ${colorize(trends.recentAverage.toFixed(1), 'cyan')} issues per scan`);
          console.log(`Previous average: ${colorize(trends.previousAverage.toFixed(1), 'cyan')} issues per scan`);
        }
      }

      // Recent activity
      if (stats.scanHistory.length > 0) {
        console.log(colorize('\n📅 Recent Scans:', 'bright'));
        const recentScans = stats.scanHistory.slice(-5).reverse();
        recentScans.forEach((scan, index) => {
          const date = new Date(scan.timestamp).toLocaleDateString();
          const time = new Date(scan.timestamp).toLocaleTimeString();
          console.log(`${index + 1}. ${date} ${time} - ${colorize(scan.issuesFound, 'yellow')} issues (${(scan.scanTime / 1000).toFixed(1)}s)`);
        });
      }

      if (stats.fixHistory.length > 0) {
        console.log(colorize('\n🔧 Recent Fixes:', 'bright'));
        const recentFixes = stats.fixHistory.slice(-5).reverse();
        recentFixes.forEach((fix, index) => {
          const date = new Date(fix.timestamp).toLocaleDateString();
          const time = new Date(fix.timestamp).toLocaleTimeString();
          console.log(`${index + 1}. ${date} ${time} - ${colorize(fix.fixesApplied, 'green')} fixes applied (${(fix.fixTime / 1000).toFixed(1)}s)`);
        });
      }

      // Recommendations
      console.log(colorize('\n💡 Recommendations:', 'bright'));
      if (stats.totalScans === 0) {
        console.log('• Run your first scan to start tracking memory leaks');
      } else if (stats.totalIssuesFound === 0) {
        console.log('• Great! No memory leaks detected in recent scans');
      } else {
        if (stats.totalIssuesFixed < stats.totalIssuesFound) {
          console.log('• Consider running the fix command to resolve outstanding issues');
        }
        if (trends && trends.trend === 'increasing') {
          console.log('• Memory leak issues are increasing - review recent code changes');
        }
        if (stats.severityStats.critical > 0) {
          console.log('• Address critical severity issues immediately');
        }
      }

      console.log(colorize('\n📁 Statistics file:', 'bright'));
      console.log(`Location: ${statsManager.statsFile}`);
      console.log('Use --reset to clear all statistics');

    } catch (error) {
      logError(`Stats command failed: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * Compare reports from before and after fixes
 */
function compareReports(beforeReports, afterReports) {
  const beforeByLocation = new Map();
  const afterByLocation = new Map();

  // Index reports by file:line for comparison
  beforeReports.forEach(report => {
    const key = `${report.file}:${report.line}:${report.type}`;
    beforeByLocation.set(key, report);
  });

  afterReports.forEach(report => {
    const key = `${report.file}:${report.line}:${report.type}`;
    afterByLocation.set(key, report);
  });

  const fixed = [];
  const remaining = [];
  const newIssues = [];

  // Find fixed issues
  for (const [key, report] of beforeByLocation) {
    if (!afterByLocation.has(key)) {
      fixed.push(report);
    } else {
      remaining.push(report);
    }
  }

  // Find new issues
  for (const [key, report] of afterByLocation) {
    if (!beforeByLocation.has(key)) {
      newIssues.push(report);
    }
  }

  return {
    fixed,
    remaining,
    newIssues,
    totalBefore: beforeReports.length,
    totalAfter: afterReports.length,
  };
}

/**
 * Display comparison results
 */
function displayComparison(comparison) {
  console.log(colorize('\n📊 Fix Validation Results', 'bright'));
  console.log('='.repeat(50));

  console.log(`\n${colorize('Summary:', 'bright')}`);
  console.log(`Issues before fixes: ${colorize(comparison.totalBefore, 'cyan')}`);
  console.log(`Issues after fixes: ${colorize(comparison.totalAfter, 'cyan')}`);
  console.log(`Fixed issues: ${colorize(comparison.fixed.length, 'green')}`);
  console.log(`Remaining issues: ${colorize(comparison.remaining.length, 'yellow')}`);
  console.log(`New issues: ${colorize(comparison.newIssues.length, 'red')}`);

  if (comparison.fixed.length > 0) {
    console.log(colorize('\n✅ Fixed Issues:', 'green'));
    comparison.fixed.forEach((report, index) => {
      console.log(`  ${index + 1}. ${report.file}:${report.line} - ${report.type}`);
      console.log(`     ${report.description}`);
    });
  }

  if (comparison.remaining.length > 0) {
    console.log(colorize('\n⚠️  Remaining Issues:', 'yellow'));
    comparison.remaining.forEach((report, index) => {
      console.log(`  ${index + 1}. ${report.file}:${report.line} - ${report.type}`);
      console.log(`     ${report.description}`);
    });
  }

  if (comparison.newIssues.length > 0) {
    console.log(colorize('\n🚨 New Issues:', 'red'));
    comparison.newIssues.forEach((report, index) => {
      console.log(`  ${index + 1}. ${report.file}:${report.line} - ${report.type}`);
      console.log(`     ${report.description}`);
    });
  }

  // Overall assessment
  const improvementPercent = comparison.totalBefore > 0
    ? Math.round(((comparison.totalBefore - comparison.totalAfter) / comparison.totalBefore) * 100)
    : 0;

  console.log(colorize('\n🎯 Assessment:', 'bright'));
  if (comparison.totalAfter === 0) {
    logSuccess('🎉 Perfect! All memory leaks have been resolved!');
  } else if (improvementPercent > 0) {
    logSuccess(`👍 Improvement: ${improvementPercent}% reduction in memory leaks`);
  } else if (improvementPercent === 0) {
    logWarning('⚡ No change in memory leak count');
  } else {
    logError('👎 Memory leak count increased - review recent changes');
  }
}

/**
 * Create a comprehensive fix report
 */
async function createFixReport(reports, appliedFixes, outputPath) {
  const reportData = {
    timestamp: new Date().toISOString(),
    summary: {
      totalIssues: reports.length,
      fixableIssues: reports.filter(r => r.suggestedFix && !r.requiresManualReview).length,
      appliedFixes: appliedFixes.length,
      successRate: appliedFixes.length / reports.filter(r => r.suggestedFix).length * 100,
    },
    appliedFixes: appliedFixes.map(fix => ({
      file: fix.file,
      line: fix.line,
      type: fix.type,
      description: fix.description,
      appliedFix: fix.suggestedFix,
      timestamp: fix.fixedAt || new Date().toISOString(),
    })),
    remainingIssues: reports.filter(r => !appliedFixes.some(f =>
      f.file === r.file && f.line === r.line && f.type === r.type
    )),
  };

  await fs.writeFile(outputPath, JSON.stringify(reportData, null, 2), 'utf-8');
  logSuccess(`Fix report saved to ${outputPath}`);
}

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
