/**
 * Core types and interfaces for memory leak detection system
 */

// Core leak types that can be detected
export type LeakType =
  | 'missing-useeffect-cleanup'
  | 'uncleaned-event-listener'
  | 'uncleaned-interval'
  | 'uncleaned-timeout'
  | 'uncleaned-subscription'
  | 'unclosed-eventsource'
  | 'unclosed-websocket'
  | 'memory-accumulation'
  | 'circular-reference';

// Severity levels for detected leaks
export type LeakSeverity = 'low' | 'medium' | 'high' | 'critical';

// Detection confidence levels
export type DetectionConfidence = number; // 0-1

// Leak report interface
export interface LeakReport {
  id: string;
  type: LeakType;
  severity: LeakSeverity;
  confidence: DetectionConfidence;
  file: string;
  line: number;
  column: number;
  description: string;
  suggestedFix?: string;
  codeSnippet: string;
  context: {
    functionName?: string;
    componentName?: string;
    hookName?: string;
    variableName?: string;
  };
  metadata: {
    detectedAt: Date;
    detectionMethod: 'static' | 'runtime';
    ruleId: string;
    category: string;
  };
}

// Project-wide leak report
export interface ProjectLeakReport {
  totalLeaks: number;
  leaksByType: Record<LeakType, number>;
  leaksBySeverity: Record<LeakSeverity, number>;
  files: string[];
  reports: LeakReport[];
  summary: {
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    fixableCount: number;
  };
  generatedAt: Date;
}

// Runtime leak detection report
export interface RuntimeLeakReport {
  memoryUsage: {
    current: number;
    peak: number;
    trend: 'stable' | 'growing' | 'declining';
  };
  activeResources: {
    eventListeners: number;
    intervals: number;
    timeouts: number;
    subscriptions: number;
    connections: number;
  };
  suspiciousPatterns: LeakReport[];
  recommendations: string[];
  timestamp: Date;
}

// Memory leak detector interface
export interface MemoryLeakDetector {
  scanFile(filePath: string): Promise<LeakReport[]>;
  scanProject(options?: ScanOptions): Promise<ProjectLeakReport>;
  analyzeRuntime(): Promise<RuntimeLeakReport>;
  validateFixes(fixes: Fix[]): Promise<ValidationResult>;
}

// Scan options for project-wide analysis
export interface ScanOptions {
  includePatterns?: string[];
  excludePatterns?: string[];
  severity?: LeakSeverity[];
  types?: LeakType[];
  maxFiles?: number;
  parallel?: boolean;
}

// Fix generation and application
export interface Fix {
  id: string;
  leakId: string;
  type: LeakType;
  file: string;
  line: number;
  column: number;
  originalCode: string;
  fixedCode: string;
  description: string;
  confidence: DetectionConfidence;
  requiresManualReview: boolean;
  category: 'automatic' | 'suggested' | 'manual';
  metadata: {
    generatedAt: Date;
    estimatedImpact: 'low' | 'medium' | 'high';
    riskLevel: 'safe' | 'moderate' | 'risky';
  };
}

// Fix validation result
export interface ValidationResult {
  valid: boolean;
  fixes: {
    applied: Fix[];
    failed: Fix[];
    skipped: Fix[];
  };
  errors: ValidationError[];
  warnings: string[];
  summary: {
    totalFixes: number;
    successfulFixes: number;
    failedFixes: number;
    skippedFixes: number;
  };
}

// Validation error details
export interface ValidationError {
  fixId: string;
  error: string;
  code: string;
  severity: 'error' | 'warning';
  suggestion?: string;
}

// Configuration interfaces
export interface MemoryLeakDetectionConfig {
  detection: DetectionConfig;
  fixes: FixConfig;
  monitoring: MonitoringConfig;
  prevention: PreventionConfig;
}

export interface DetectionConfig {
  enableStaticAnalysis: boolean;
  enableRuntimeDetection: boolean;
  scanPatterns: string[];
  excludePatterns: string[];
  severityThreshold: LeakSeverity;
  confidenceThreshold: DetectionConfidence;
  maxFileSize: number; // in bytes
  timeout: number; // in milliseconds
}

export interface FixConfig {
  autoApplyLowRisk: boolean;
  requireReviewForHighRisk: boolean;
  backupOriginalFiles: boolean;
  maxBatchSize: number;
  dryRun: boolean;
  preserveFormatting: boolean;
}

export interface MonitoringConfig {
  memoryThreshold: number; // in MB
  alertFrequency: number; // in minutes
  trackingInterval: number; // in milliseconds
  retentionPeriod: number; // in days
  enableRealTimeAlerts: boolean;
  enableTrendAnalysis: boolean;
}

export interface PreventionConfig {
  enableESLintRules: boolean;
  enablePreCommitHooks: boolean;
  enablePRValidation: boolean;
  strictMode: boolean;
  educationalMode: boolean;
}

// Error handling types
export interface DetectionError extends Error {
  code: string;
  file?: string;
  line?: number;
  severity: 'error' | 'warning';
  recoverable: boolean;
}

export interface FixError extends Error {
  code: string;
  fixId: string;
  file: string;
  originalError: Error;
  rollbackAvailable: boolean;
}

export interface MonitoringError extends Error {
  code: string;
  component: string;
  timestamp: Date;
  context: Record<string, any>;
}

// AST and code analysis types
export interface ASTNode {
  type: string;
  start: number;
  end: number;
  loc: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  [key: string]: any;
}

export interface CodePattern {
  id: string;
  name: string;
  description: string;
  pattern: RegExp | ((node: ASTNode) => boolean);
  severity: LeakSeverity;
  category: LeakType;
  fixTemplate?: string;
}

// Memory monitoring types
export interface MemoryMetrics {
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
  gcFrequency: number;
  memoryGrowthRate: number;
  suspiciousGrowth: boolean;
  timestamp: Date;
}

export interface MemoryTrend {
  timestamp: Date;
  memoryUsage: number;
  componentCount: number;
  eventListenerCount: number;
  intervalCount: number;
  trend: 'stable' | 'growing' | 'declining';
  growthRate: number;
}

// Resource tracking types
export interface ResourceTracker {
  trackEventListener(
    element: Element,
    event: string,
    handler: EventListener
  ): void;
  trackInterval(id: number): void;
  trackTimeout(id: number): void;
  trackSubscription(unsubscribe: () => void): void;
  trackConnection(connection: EventSource | WebSocket): void;
  getActiveResources(): ActiveResources;
  cleanup(): void;
}

export interface ActiveResources {
  eventListeners: Array<{
    element: Element;
    event: string;
    handler: EventListener;
    addedAt: Date;
  }>;
  intervals: Array<{
    id: number;
    addedAt: Date;
  }>;
  timeouts: Array<{
    id: number;
    addedAt: Date;
  }>;
  subscriptions: Array<{
    unsubscribe: () => void;
    addedAt: Date;
  }>;
  connections: Array<{
    connection: EventSource | WebSocket;
    type: 'EventSource' | 'WebSocket';
    addedAt: Date;
  }>;
}

// Statistics and reporting types
export interface LeakStatistics {
  totalLeaksDetected: number;
  leaksFixed: number;
  leaksByType: Record<LeakType, number>;
  leaksBySeverity: Record<LeakSeverity, number>;
  averageFixTime: number;
  preventedLeaks: number;
  falsePositives: number;
  detectionAccuracy: number;
  lastUpdated: Date;
}

export interface PerformanceImpact {
  detectionTime: number;
  memoryOverhead: number;
  cpuUsage: number;
  filesScanTime: Record<string, number>;
  totalScanTime: number;
}

// Plugin and extension types
export interface DetectionPlugin {
  name: string;
  version: string;
  patterns: CodePattern[];
  initialize(): void;
  cleanup(): void;
}

export interface FixPlugin {
  name: string;
  version: string;
  supportedTypes: LeakType[];
  generateFix(leak: LeakReport): Promise<Fix | null>;
}
