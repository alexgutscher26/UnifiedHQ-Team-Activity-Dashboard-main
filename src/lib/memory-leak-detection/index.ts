/**
 * Memory leak detection system - Main exports
 */

// Core types
export * from './types';

// Main detector
export { MemoryLeakDetectorImpl as MemoryLeakDetector } from './detector';

// Specialized analyzers
export { StaticCodeAnalyzer, SimpleASTParser } from './static-analyzer';
export { TimerLeakDetector } from './timer-detector';

// Configuration system
export {
  ConfigManager,
  getConfigManager,
  initializeConfig,
  createDefaultConfigFile,
  configUtils,
  DEFAULT_CONFIGS,
} from './config';

// Convenience factory function
export function createMemoryLeakDetector(
  config?: Partial<import('./types').MemoryLeakDetectionConfig>
) {
  const { MemoryLeakDetectorImpl } = require('./detector');
  return new MemoryLeakDetectorImpl(config);
}

// Quick start function for common use cases
export async function quickScan(options?: {
  files?: string[];
  severity?: import('./types').LeakSeverity;
  confidence?: number;
}) {
  const detector = createMemoryLeakDetector();

  if (options?.files) {
    // Scan specific files
    const reports = [];
    for (const file of options.files) {
      const fileReports = await detector.scanFile(file);
      reports.push(...fileReports);
    }
    return reports;
  } else {
    // Scan entire project
    const scanOptions = {
      severity: options?.severity ? [options.severity] : undefined,
    };

    const projectReport = await detector.scanProject(scanOptions);
    return projectReport.reports;
  }
}

// Runtime monitoring helper
export function startRuntimeMonitoring(options?: {
  interval?: number;
  memoryThreshold?: number;
  onLeak?: (report: import('./types').RuntimeLeakReport) => void;
}) {
  const detector = createMemoryLeakDetector();
  const interval = options?.interval || 5000;

  const monitor = setInterval(async () => {
    try {
      const runtimeReport = await detector.analyzeRuntime();

      // Check for memory threshold
      if (
        options?.memoryThreshold &&
        runtimeReport.memoryUsage.current > options.memoryThreshold
      ) {
        options.onLeak?.(runtimeReport);
      }

      // Check for suspicious patterns
      if (runtimeReport.suspiciousPatterns.length > 0) {
        options.onLeak?.(runtimeReport);
      }
    } catch (error) {
      console.error('Runtime monitoring error:', error);
    }
  }, interval);

  // Return cleanup function
  return () => {
    clearInterval(monitor);
    detector.cleanup();
  };
}

// Development helper for immediate feedback
export async function devScan(filePath?: string) {
  const detector = createMemoryLeakDetector({
    detection: {
      enableStaticAnalysis: true,
      enableRuntimeDetection: true,
      severityThreshold: 'low',
      confidenceThreshold: 0.3,
      scanPatterns: ['src/**/*.{ts,tsx,js,jsx}'],
      excludePatterns: ['**/*.test.*', '**/*.spec.*'],
      maxFileSize: 2 * 1024 * 1024,
      timeout: 30000,
    },
  });

  if (filePath) {
    const reports = await detector.scanFile(filePath);
    console.log(
      `Found ${reports.length} potential memory leaks in ${filePath}`
    );

    for (const report of reports) {
      console.log(`\n${report.severity.toUpperCase()}: ${report.description}`);
      console.log(`File: ${report.file}:${report.line}:${report.column}`);
      console.log(`Fix: ${report.suggestedFix}`);
      console.log(`Code: ${report.codeSnippet}`);
    }

    return reports;
  } else {
    const projectReport = await detector.scanProject();
    console.log("\nMemory Leak Scan Results:");
    console.log(`Total leaks found: ${projectReport.totalLeaks}`);
    console.log(`Critical: ${projectReport.summary.criticalCount}`);
    console.log(`High: ${projectReport.summary.highCount}`);
    console.log(`Medium: ${projectReport.summary.mediumCount}`);
    console.log(`Low: ${projectReport.summary.lowCount}`);
    console.log(`Fixable: ${projectReport.summary.fixableCount}`);

    // Show top 5 most critical issues
    const topIssues = projectReport.reports.slice(0, 5);
    if (topIssues.length > 0) {
      console.log(`\nTop ${topIssues.length} issues:`);
      for (const [index, report] of topIssues.entries()) {
        console.log(
          `${index + 1}. ${report.severity.toUpperCase()}: ${report.description}`
        );
        console.log(`   ${report.file}:${report.line}:${report.column}`);
      }
    }

    return projectReport;
  }
}

// CLI-friendly scan function
export async function cliScan(args: {
  files?: string[];
  output?: 'json' | 'table' | 'summary';
  severity?: string;
  confidence?: number;
  fix?: boolean;
}) {
  const detector = createMemoryLeakDetector();

  let reports;
  if (args.files && args.files.length > 0) {
    reports = [];
    for (const file of args.files) {
      const fileReports = await detector.scanFile(file);
      reports.push(...fileReports);
    }
  } else {
    const projectReport = await detector.scanProject();
    reports = projectReport.reports;
  }

  // Filter by severity if specified
  if (args.severity) {
    const severityFilter = args.severity as import('./types').LeakSeverity;
    reports = reports.filter(r => r.severity === severityFilter);
  }

  // Filter by confidence if specified
  if (args.confidence !== undefined) {
    reports = reports.filter(r => r.confidence >= args.confidence!);
  }

  // Output results
  switch (args.output) {
    case 'json':
      console.log(JSON.stringify(reports, null, 2));
      break;

    case 'table':
      console.table(
        reports.map(r => ({
          File: r.file,
          Line: r.line,
          Severity: r.severity,
          Type: r.type,
          Description: r.description.substring(0, 50) + '...',
        }))
      );
      break;

    case 'summary':
    default:
      const summary = {
        total: reports.length,
        critical: reports.filter(r => r.severity === 'critical').length,
        high: reports.filter(r => r.severity === 'high').length,
        medium: reports.filter(r => r.severity === 'medium').length,
        low: reports.filter(r => r.severity === 'low').length,
      };

      console.log('Memory Leak Detection Summary:');
      console.log(`Total issues: ${summary.total}`);
      console.log(`Critical: ${summary.critical}`);
      console.log(`High: ${summary.high}`);
      console.log(`Medium: ${summary.medium}`);
      console.log(`Low: ${summary.low}`);
      break;
  }

  return reports;
}

// Integration helpers
export const integrations = {
  // ESLint integration helper
  createESLintRule: (leakType: import('./types').LeakType) => {
    return {
      meta: {
        type: 'problem',
        docs: {
          description: `Detect ${leakType} memory leaks`,
          category: 'Possible Errors',
          recommended: true,
        },
        fixable: 'code',
        schema: [],
      },
      create: (context: any) => {
        // ESLint rule implementation would go here
        // This is a placeholder for the actual ESLint integration
        return {};
      },
    };
  },

  // Webpack plugin helper
  createWebpackPlugin: (options?: {
    failOnError?: boolean;
    severity?: import('./types').LeakSeverity;
  }) => {
    return {
      apply: (compiler: any) => {
        compiler.hooks.beforeCompile.tapAsync(
          'MemoryLeakDetection',
          async (params: any, callback: any) => {
            try {
              const detector = createMemoryLeakDetector();
              const report = await detector.scanProject();

              if (report.totalLeaks > 0) {
                const message = `Found ${report.totalLeaks} potential memory leaks`;

                if (options?.failOnError) {
                  callback(new Error(message));
                  return;
                } else {
                  console.warn(message);
                }
              }

              callback();
            } catch (error) {
              callback(error);
            }
          }
        );
      },
    };
  },

  // Jest integration helper
  createJestMatcher: () => {
    return {
      toHaveNoMemoryLeaks: async function (filePath: string) {
        const detector = createMemoryLeakDetector();
        const reports = await detector.scanFile(filePath);

        const pass = reports.length === 0;

        if (pass) {
          return {
            message: () =>
              `Expected ${filePath} to have memory leaks, but none were found`,
            pass: true,
          };
        } else {
          return {
            message: () =>
              `Expected ${filePath} to have no memory leaks, but found ${reports.length}:\n${reports
                .map(r => `  - ${r.description} at line ${r.line}`)
                .join('\n')}`,
            pass: false,
          };
        }
      },
    };
  },
};

// Version information
export const version = '1.0.0';

// Default export for convenience
export default {
  createDetector: createMemoryLeakDetector,
  quickScan,
  devScan,
  cliScan,
  startRuntimeMonitoring,
  integrations,
  version,
};
