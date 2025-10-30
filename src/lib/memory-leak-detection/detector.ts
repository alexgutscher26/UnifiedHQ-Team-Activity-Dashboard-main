/**
 * Main memory leak detector implementation
 */

import {
  MemoryLeakDetector,
  LeakReport,
  ProjectLeakReport,
  RuntimeLeakReport,
  ScanOptions,
  Fix,
  ValidationResult,
  MemoryLeakDetectionConfig,
  DetectionConfig,
  LeakType,
  LeakSeverity,
} from './types';
import { StaticCodeAnalyzer } from './static-analyzer';
import { TimerLeakDetector } from './timer-detector';
import { promises as fs } from 'fs';
import * as path from 'path';

// Default configuration
const DEFAULT_CONFIG: MemoryLeakDetectionConfig = {
  detection: {
    enableStaticAnalysis: true,
    enableRuntimeDetection: true,
    scanPatterns: ['**/*.{ts,tsx,js,jsx}'],
    excludePatterns: [
      '**/node_modules/**',
      '**/dist/**',
      '**/*.test.*',
      '**/*.spec.*',
    ],
    severityThreshold: 'low',
    confidenceThreshold: 0.5,
    maxFileSize: 1024 * 1024, // 1MB
    timeout: 30000, // 30 seconds
  },
  fixes: {
    autoApplyLowRisk: false,
    requireReviewForHighRisk: true,
    backupOriginalFiles: true,
    maxBatchSize: 10,
    dryRun: true,
    preserveFormatting: true,
  },
  monitoring: {
    memoryThreshold: 100, // MB
    alertFrequency: 5, // minutes
    trackingInterval: 1000, // milliseconds
    retentionPeriod: 7, // days
    enableRealTimeAlerts: true,
    enableTrendAnalysis: true,
  },
  prevention: {
    enableESLintRules: true,
    enablePreCommitHooks: false,
    enablePRValidation: false,
    strictMode: false,
    educationalMode: true,
  },
};

// Main memory leak detector implementation
export class MemoryLeakDetectorImpl implements MemoryLeakDetector {
  private config: MemoryLeakDetectionConfig;
  private staticAnalyzer: StaticCodeAnalyzer;
  private timerDetector: TimerLeakDetector;
  private scanCache: Map<string, { reports: LeakReport[]; timestamp: Date }>;

  constructor(config?: Partial<MemoryLeakDetectionConfig>) {
    this.config = this.mergeConfig(DEFAULT_CONFIG, config || {});
    this.staticAnalyzer = new StaticCodeAnalyzer();
    this.timerDetector = new TimerLeakDetector();
    this.scanCache = new Map();
  }

  // Merge configuration with defaults
  private mergeConfig(
    defaultConfig: MemoryLeakDetectionConfig,
    userConfig: Partial<MemoryLeakDetectionConfig>
  ): MemoryLeakDetectionConfig {
    return {
      detection: { ...defaultConfig.detection, ...userConfig.detection },
      fixes: { ...defaultConfig.fixes, ...userConfig.fixes },
      monitoring: { ...defaultConfig.monitoring, ...userConfig.monitoring },
      prevention: { ...defaultConfig.prevention, ...userConfig.prevention },
    };
  }

  // Scan a single file for memory leaks
  async scanFile(filePath: string): Promise<LeakReport[]> {
    try {
      // Check cache first
      const cached = this.scanCache.get(filePath);
      if (cached && this.isCacheValid(cached.timestamp)) {
        return cached.reports;
      }

      // Check file size
      const stats = await fs.stat(filePath);
      if (stats.size > this.config.detection.maxFileSize) {
        console.warn(`Skipping large file: ${filePath} (${stats.size} bytes)`);
        return [];
      }

      // Read file content
      const code = await fs.readFile(filePath, 'utf-8');
      const reports: LeakReport[] = [];

      // Static analysis
      if (this.config.detection.enableStaticAnalysis) {
        const staticReports = await this.staticAnalyzer.analyzeFile(
          filePath,
          code
        );
        reports.push(...staticReports);
      }

      // Timer-specific analysis
      const timerReports = await this.timerDetector.analyzeTimerLeaks(
        filePath,
        code
      );
      reports.push(...timerReports);

      // Filter by confidence threshold
      const filteredReports = this.staticAnalyzer.filterByConfidence(
        reports,
        this.config.detection.confidenceThreshold
      );

      // Filter by severity threshold
      const finalReports = this.filterBySeverity(
        filteredReports,
        this.config.detection.severityThreshold
      );

      // Cache results
      this.scanCache.set(filePath, {
        reports: finalReports,
        timestamp: new Date(),
      });

      return finalReports;
    } catch (error) {
      console.error(`Error scanning file ${filePath}:`, error);
      return [];
    }
  }

  // Scan entire project for memory leaks
  async scanProject(options?: ScanOptions): Promise<ProjectLeakReport> {
    const scanOptions = this.mergeScanOptions(options);
    const startTime = Date.now();

    try {
      // Find files to scan
      const files = await this.findFilesToScan(scanOptions);
      console.log(`Found ${files.length} files to scan`);

      // Scan files
      const allReports: LeakReport[] = [];
      const scannedFiles: string[] = [];

      if (scanOptions.parallel) {
        // Parallel scanning
        const scanPromises = files.map(async file => {
          const reports = await this.scanFile(file);
          return { file, reports };
        });

        const results = await Promise.all(scanPromises);
        for (const result of results) {
          allReports.push(...result.reports);
          if (result.reports.length > 0) {
            scannedFiles.push(result.file);
          }
        }
      } else {
        // Sequential scanning
        for (const file of files) {
          const reports = await this.scanFile(file);
          allReports.push(...reports);
          if (reports.length > 0) {
            scannedFiles.push(file);
          }
        }
      }

      // Generate project report
      const report = this.generateProjectReport(allReports, scannedFiles);

      console.log(`Scan completed in ${Date.now() - startTime}ms`);
      console.log(`Found ${report.totalLeaks} potential memory leaks`);

      return report;
    } catch (error) {
      console.error('Error scanning project:', error);
      throw error;
    }
  }

  // Analyze runtime for memory leaks
  async analyzeRuntime(): Promise<RuntimeLeakReport> {
    if (!this.config.detection.enableRuntimeDetection) {
      throw new Error('Runtime detection is disabled');
    }

    try {
      // Get memory metrics
      const memoryUsage = this.getMemoryUsage();

      // Get active resources
      const activeResources = {
        eventListeners: 0, // Would be tracked by runtime monitor
        intervals: this.timerDetector.getActiveTimers().filter(t => 'id' in t)
          .length,
        timeouts: this.timerDetector.getActiveTimers().filter(t => 'id' in t)
          .length,
        subscriptions: 0, // Would be tracked by runtime monitor
        connections: 0, // Would be tracked by runtime monitor
      };

      // Detect suspicious patterns
      const suspiciousPatterns: LeakReport[] = [];

      // Check for long-running timers
      const longRunningTimers = this.timerDetector.detectLongRunningTimers();
      for (const timer of longRunningTimers) {
        suspiciousPatterns.push({
          id: `runtime-timer-${timer.id}`,
          type:
            timer.type === 'interval'
              ? 'uncleaned-interval'
              : 'uncleaned-timeout',
          severity: 'high',
          confidence: 0.8,
          file: 'runtime',
          line: 0,
          column: 0,
          description: `Long-running ${timer.type} detected (${Math.round(timer.runningTime / 1000)}s)`,
          suggestedFix: `Clear the ${timer.type} when no longer needed`,
          codeSnippet: `${timer.type} ID: ${timer.id}`,
          context: {
            timerId: timer.id,
            runningTime: timer.runningTime,
            context: timer.context,
          },
          metadata: {
            detectedAt: new Date(),
            detectionMethod: 'runtime',
            ruleId: 'runtime-long-timer',
            category: 'runtime-leak',
          },
        });
      }

      // Generate recommendations
      const recommendations = this.generateRuntimeRecommendations(
        memoryUsage,
        activeResources,
        suspiciousPatterns
      );

      return {
        memoryUsage,
        activeResources,
        suspiciousPatterns,
        recommendations,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Error analyzing runtime:', error);
      throw error;
    }
  }

  // Validate fixes before applying
  async validateFixes(fixes: Fix[]): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      fixes: {
        applied: [],
        failed: [],
        skipped: [],
      },
      errors: [],
      warnings: [],
      summary: {
        totalFixes: fixes.length,
        successfulFixes: 0,
        failedFixes: 0,
        skippedFixes: 0,
      },
    };

    for (const fix of fixes) {
      try {
        // Validate fix syntax
        if (!this.validateFixSyntax(fix)) {
          result.errors.push({
            fixId: fix.id,
            error: 'Invalid fix syntax',
            code: 'INVALID_SYNTAX',
            severity: 'error',
          });
          result.fixes.failed.push(fix);
          continue;
        }

        // Check if fix requires manual review
        if (
          fix.requiresManualReview &&
          !this.config.fixes.requireReviewForHighRisk
        ) {
          result.warnings.push(
            `Fix ${fix.id} requires manual review but auto-review is disabled`
          );
          result.fixes.skipped.push(fix);
          continue;
        }

        // Validate file exists
        try {
          await fs.access(fix.file);
        } catch {
          result.errors.push({
            fixId: fix.id,
            error: `File not found: ${fix.file}`,
            code: 'FILE_NOT_FOUND',
            severity: 'error',
          });
          result.fixes.failed.push(fix);
          continue;
        }

        result.fixes.applied.push(fix);
      } catch (error) {
        result.errors.push({
          fixId: fix.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          code: 'VALIDATION_ERROR',
          severity: 'error',
        });
        result.fixes.failed.push(fix);
      }
    }

    // Update summary
    result.summary.successfulFixes = result.fixes.applied.length;
    result.summary.failedFixes = result.fixes.failed.length;
    result.summary.skippedFixes = result.fixes.skipped.length;
    result.valid = result.errors.length === 0;

    return result;
  }

  // Helper methods

  private isCacheValid(timestamp: Date): boolean {
    const cacheAge = Date.now() - timestamp.getTime();
    return cacheAge < 5 * 60 * 1000; // 5 minutes
  }

  private filterBySeverity(
    reports: LeakReport[],
    threshold: LeakSeverity
  ): LeakReport[] {
    const severityOrder: LeakSeverity[] = ['low', 'medium', 'high', 'critical'];
    const thresholdIndex = severityOrder.indexOf(threshold);

    return reports.filter(report => {
      const reportIndex = severityOrder.indexOf(report.severity);
      return reportIndex >= thresholdIndex;
    });
  }

  private mergeScanOptions(options?: ScanOptions): Required<ScanOptions> {
    return {
      includePatterns:
        options?.includePatterns || this.config.detection.scanPatterns,
      excludePatterns:
        options?.excludePatterns || this.config.detection.excludePatterns,
      severity: options?.severity || ['low', 'medium', 'high', 'critical'],
      types: options?.types || [
        'missing-useeffect-cleanup',
        'uncleaned-event-listener',
        'uncleaned-interval',
        'uncleaned-timeout',
        'uncleaned-subscription',
        'unclosed-eventsource',
        'unclosed-websocket',
      ],
      maxFiles: options?.maxFiles || 1000,
      parallel: options?.parallel ?? true,
    };
  }

  private async findFilesToScan(
    options: Required<ScanOptions>
  ): Promise<string[]> {
    // Simple file finding implementation
    // In a real implementation, you'd use a proper glob library
    const files: string[] = [];

    const scanDir = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            // Check exclude patterns
            const shouldExclude = options.excludePatterns.some(pattern =>
              fullPath.includes(pattern.replace('**/', '').replace('/**', ''))
            );

            if (!shouldExclude) {
              await scanDir(fullPath);
            }
          } else if (entry.isFile()) {
            // Check include patterns
            const shouldInclude = options.includePatterns.some(pattern => {
              const ext = pattern.split('.').pop();
              return fullPath.endsWith(`.${ext}`);
            });

            if (shouldInclude) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        console.error(`Error scanning directory ${dir}:`, error);
      }
    };

    await scanDir(process.cwd());
    return files.slice(0, options.maxFiles);
  }

  private generateProjectReport(
    reports: LeakReport[],
    files: string[]
  ): ProjectLeakReport {
    const leaksByType: Record<LeakType, number> = {} as Record<
      LeakType,
      number
    >;
    const leaksBySeverity: Record<LeakSeverity, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    let fixableCount = 0;

    for (const report of reports) {
      // Count by type
      leaksByType[report.type] = (leaksByType[report.type] || 0) + 1;

      // Count by severity
      leaksBySeverity[report.severity]++;

      // Count fixable
      if (report.suggestedFix) {
        fixableCount++;
      }
    }

    return {
      totalLeaks: reports.length,
      leaksByType,
      leaksBySeverity,
      files,
      reports: this.staticAnalyzer.sortReports(reports),
      summary: {
        criticalCount: leaksBySeverity.critical,
        highCount: leaksBySeverity.high,
        mediumCount: leaksBySeverity.medium,
        lowCount: leaksBySeverity.low,
        fixableCount,
      },
      generatedAt: new Date(),
    };
  }

  private getMemoryUsage(): RuntimeLeakReport['memoryUsage'] {
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const memory = (performance as any).memory;
      const current = memory.usedJSHeapSize / 1024 / 1024; // MB
      const peak = memory.totalJSHeapSize / 1024 / 1024; // MB

      return {
        current,
        peak,
        trend: 'stable', // Would be calculated from historical data
      };
    }

    return {
      current: 0,
      peak: 0,
      trend: 'stable',
    };
  }

  private generateRuntimeRecommendations(
    memoryUsage: RuntimeLeakReport['memoryUsage'],
    activeResources: RuntimeLeakReport['activeResources'],
    suspiciousPatterns: LeakReport[]
  ): string[] {
    const recommendations: string[] = [];

    if (memoryUsage.current > this.config.monitoring.memoryThreshold) {
      recommendations.push(
        `Memory usage is high (${memoryUsage.current.toFixed(1)}MB). Consider investigating memory leaks.`
      );
    }

    if (activeResources.intervals > 5) {
      recommendations.push(
        `High number of active intervals (${activeResources.intervals}). Ensure they are properly cleaned up.`
      );
    }

    if (activeResources.timeouts > 10) {
      recommendations.push(
        `High number of active timeouts (${activeResources.timeouts}). Consider if all are necessary.`
      );
    }

    if (suspiciousPatterns.length > 0) {
      recommendations.push(
        `Found ${suspiciousPatterns.length} suspicious patterns that may indicate memory leaks.`
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('No immediate memory leak concerns detected.');
    }

    return recommendations;
  }

  private validateFixSyntax(fix: Fix): boolean {
    // Basic syntax validation
    try {
      // Check if the fixed code is valid JavaScript/TypeScript
      // This is a simplified check - in practice, you'd use a proper parser
      const hasBalancedBraces = this.hasBalancedBraces(fix.fixedCode);
      const hasValidSyntax =
        !fix.fixedCode.includes('undefined') ||
        fix.fixedCode.includes('// TODO');

      return hasBalancedBraces && hasValidSyntax;
    } catch {
      return false;
    }
  }

  private hasBalancedBraces(code: string): boolean {
    let braceCount = 0;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < code.length; i++) {
      const char = code[i];

      if (!inString) {
        if (char === '"' || char === "'" || char === '`') {
          inString = true;
          stringChar = char;
        } else if (char === '{') {
          braceCount++;
        } else if (char === '}') {
          braceCount--;
        }
      } else {
        if (char === stringChar && code[i - 1] !== '\\') {
          inString = false;
          stringChar = '';
        }
      }
    }

    return braceCount === 0;
  }

  // Configuration methods
  updateConfig(newConfig: Partial<MemoryLeakDetectionConfig>): void {
    this.config = this.mergeConfig(this.config, newConfig);
  }

  getConfig(): MemoryLeakDetectionConfig {
    return { ...this.config };
  }

  // Cleanup
  cleanup(): void {
    this.timerDetector.cleanup();
    this.scanCache.clear();
  }
}
