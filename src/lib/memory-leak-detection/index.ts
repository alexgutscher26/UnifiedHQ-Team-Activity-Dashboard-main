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


// Import the detector class for internal use
import { MemoryLeakDetectorImpl } from './detector';

/**
 * Creates a new memory leak detector instance with optional configuration.
 * 
 * This factory function provides a convenient way to create a detector instance
 * without directly importing the implementation class. The detector can be
 * configured with custom settings for detection, fixes, monitoring, and prevention.
 * 
 * @param config - Optional partial configuration to override defaults
 * @returns A new MemoryLeakDetector instance
 * 
 * @example
 * ```typescript
 * // Create with default configuration
 * const detector = createMemoryLeakDetector();
 * 
 * // Create with custom configuration
 * const detector = createMemoryLeakDetector({
 *   detection: {
 *     severityThreshold: 'high',
 *     confidenceThreshold: 0.8
 *   }
 * });
 * ```
 */
export function createMemoryLeakDetector(
  config?: Partial<import('./types').MemoryLeakDetectionConfig>
) {
  return new MemoryLeakDetectorImpl(config);
}

/**
 * Performs a quick memory leak scan with minimal configuration.
 * 
 * This function provides a simple interface for scanning either specific files
 * or the entire project. It's designed for quick checks and integrations where
 * you need immediate results without complex setup.
 * 
 * @param options - Optional scan configuration
 * @param options.files - Specific files to scan (if omitted, scans entire project)
 * @param options.severity - Minimum severity level to report
 * @param options.confidence - Minimum confidence threshold (0-1)
 * @returns Promise resolving to array of leak reports
 * 
 * @example
 * ```typescript
 * // Scan entire project
 * const leaks = await quickScan();
 * 
 * // Scan specific files with high confidence
 * const leaks = await quickScan({
 *   files: ['src/components/MyComponent.tsx'],
 *   confidence: 0.8
 * });
 * 
 * // Only show critical issues
 * const criticalLeaks = await quickScan({
 *   severity: 'critical'
 * });
 * ```
 */
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

/**
 * Starts continuous runtime memory leak monitoring.
 * 
 * This function sets up a monitoring system that periodically checks for memory
 * leaks during application runtime. It can detect memory threshold breaches and
 * suspicious patterns, calling the provided callback when issues are found.
 * 
 * @param options - Optional monitoring configuration
 * @param options.interval - Monitoring interval in milliseconds (default: 5000)
 * @param options.memoryThreshold - Memory usage threshold in MB to trigger alerts
 * @param options.onLeak - Callback function called when leaks are detected
 * @returns Cleanup function to stop monitoring
 * 
 * @example
 * ```typescript
 * // Basic monitoring
 * const stopMonitoring = startRuntimeMonitoring();
 * 
 * // Custom monitoring with alerts
 * const stopMonitoring = startRuntimeMonitoring({
 *   interval: 2000,
 *   memoryThreshold: 100,
 *   onLeak: (report) => {
 *     console.warn('Memory leak detected:', report);
 *     // Send alert to monitoring service
 *   }
 * });
 * 
 * // Stop monitoring when done
 * stopMonitoring();
 * ```
 */
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
        options?.onLeak?.(runtimeReport);
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

/**
 * Performs a development-friendly scan with detailed console output.
 * 
 * This function is optimized for development workflows, providing immediate
 * feedback with detailed console logging. It uses relaxed thresholds to catch
 * potential issues early and provides actionable suggestions for fixes.
 * 
 * @param filePath - Optional specific file to scan (if omitted, scans entire project)
 * @returns Promise resolving to leak reports or project report
 * 
 * @example
 * ```typescript
 * // Scan entire project with dev-friendly output
 * await devScan();
 * 
 * // Scan specific file
 * await devScan('src/components/MyComponent.tsx');
 * ```
 */
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
    console.log('\nMemory Leak Scan Results:');
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

/**
 * Performs a CLI-optimized scan with configurable output formats.
 * 
 * This function is designed for command-line interfaces and CI/CD pipelines.
 * It supports multiple output formats and filtering options, making it suitable
 * for automated workflows and scripting.
 * 
 * @param args - CLI scan configuration
 * @param args.files - Specific files to scan (if omitted, scans entire project)
 * @param args.output - Output format: 'json', 'table', or 'summary' (default: 'summary')
 * @param args.severity - Filter by severity level
 * @param args.confidence - Minimum confidence threshold (0-1)
 * @param args.fix - Whether to apply automatic fixes (not implemented yet)
 * @returns Promise resolving to filtered leak reports
 * 
 * @example
 * ```typescript
 * // Basic CLI scan with summary output
 * await cliScan({ output: 'summary' });
 * 
 * // JSON output for CI/CD integration
 * await cliScan({ 
 *   output: 'json',
 *   severity: 'high',
 *   confidence: 0.8
 * });
 * 
 * // Table format for human-readable output
 * await cliScan({ 
 *   files: ['src/**/*.tsx'],
  * output: 'table'
    * });
 * ```
 */
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
      console.log(`Total issues: ${ summary.total } `);
      console.log(`Critical: ${ summary.critical } `);
      console.log(`High: ${ summary.high } `);
      console.log(`Medium: ${ summary.medium } `);
      console.log(`Low: ${ summary.low } `);
      break;
  }

  return reports;
}

/**
 * Integration helpers for popular development tools.
 * 
 * This object provides factory functions for integrating memory leak detection
 * with common development tools like ESLint, Webpack, and Jest. These integrations
 * allow you to incorporate leak detection into your existing development workflow.
 */
export const integrations = {
  /**
   * Creates an ESLint rule for detecting specific memory leak types.
   * 
   * @param leakType - The type of memory leak to detect
   * @returns ESLint rule configuration object
   * 
   * @example
   * ```typescript
  * const rule = integrations.createESLintRule('uncleaned-event-listener');
   * // Add to your ESLint configuration
   * ```
   */
  createESLintRule: (leakType: import('./types').LeakType) => {
    return {
      meta: {
        type: 'problem',
        docs: {
          description: `Detect ${ leakType } memory leaks`,
          category: 'Possible Errors',
          recommended: true,
        },
        fixable: 'code',
        schema: [],
      },
      create: (_context: any) => {
        // ESLint rule implementation would go here
        // This is a placeholder for the actual ESLint integration
        return {};
      },
    };
  },

  /**
   * Creates a Webpack plugin for build-time memory leak detection.
   * 
   * @param options - Plugin configuration options
   * @param options.failOnError - Whether to fail the build when leaks are found
   * @param options.severity - Minimum severity level to report
   * @returns Webpack plugin object
   * 
   * @example
   * ```typescript
  * const plugin = integrations.createWebpackPlugin({
    *   failOnError: true,
    *   severity: 'high'
   * });
   * // Add to your Webpack configuration
   * ```
   */
  createWebpackPlugin: (options?: {
    failOnError?: boolean;
    severity?: import('./types').LeakSeverity;
  }) => {
    return {
      apply: (compiler: any) => {
        compiler.hooks.beforeCompile.tapAsync(
          'MemoryLeakDetection',
          async (_params: any, callback: any) => {
            try {
              const detector = createMemoryLeakDetector();
              const report = await detector.scanProject();

              if (report.totalLeaks > 0) {
                const message = `Found ${ report.totalLeaks } potential memory leaks`;

                if (options?.failOnError) {
                  callback(new Error(message));
                  return;
                } else {
                  console.warn(message);
                }
              }

              callback(null);
            } catch (error) {
              callback(error);
            }
          }
        );
      },
    };
  },

  /**
   * Creates Jest matchers for testing memory leak prevention.
   * 
   * @returns Object containing Jest matcher functions
   * 
   * @example
   * ```typescript
  * const matchers = integrations.createJestMatcher();
   * expect.extend(matchers);
   * 
   * // In your tests
   * await expect('src/MyComponent.tsx').toHaveNoMemoryLeaks();
   * ```
   */
  createJestMatcher: () => {
    return {
      toHaveNoMemoryLeaks: async function (filePath: string) {
        const detector = createMemoryLeakDetector();
        const reports = await detector.scanFile(filePath);

        const pass = reports.length === 0;

        if (pass) {
          return {
            message: () =>
              `Expected ${ filePath } to have memory leaks, but none were found`,
            pass: true,
          };
        } else {
          return {
            message: () =>
              `Expected ${ filePath } to have no memory leaks, but found ${ reports.length }: \n${
  reports
    .map(r => `  - ${r.description} at line ${r.line}`)
    .join('\n')
} `,
            pass: false,
          };
        }
      },
    };
  },
};

/**
 * Version information for the memory leak detection system.
 */
export const version = '1.0.0';

/**
 * Default export providing convenient access to all main functions.
 * 
 * This object provides a single import point for the most commonly used
 * functions in the memory leak detection system.
 * 
 * @example
 * ```typescript
  * import memoryLeakDetection from '@/lib/memory-leak-detection';
 * 
 * // Create detector
 * const detector = memoryLeakDetection.createDetector();
 * 
 * // Quick scan
 * const leaks = await memoryLeakDetection.quickScan();
 * 
 * // Development scan
 * await memoryLeakDetection.devScan();
 * ```
 */
export default {
  createDetector: createMemoryLeakDetector,
  quickScan,
  devScan,
  cliScan,
  startRuntimeMonitoring,
  integrations,
  version,
};
