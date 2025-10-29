/**
 * Memory leak test utilities for validation and testing
 * Provides tools for measuring memory usage, simulating leaks, and validating detection
 */

import { performance } from 'perf_hooks';
import {
  LeakReport,
  LeakType,
  MemoryMetrics,
  MemoryTrend,
  ActiveResources,
  MemoryLeakDetector,
  Fix,
  ValidationResult,
} from './types';

// Memory measurement utilities
export class MemoryMeasurement {
  private startTime: number;
  private startMemory: NodeJS.MemoryUsage;
  private measurements: Array<{
    timestamp: number;
    memory: NodeJS.MemoryUsage;
    heapUsed: number;
  }> = [];

  constructor() {
    this.startTime = performance.now();
    this.startMemory = process.memoryUsage();
    this.recordMeasurement();
  }

  /**
   * Records the current memory usage.
   */
  recordMeasurement(): void {
    const memory = process.memoryUsage();
    this.measurements.push({
      timestamp: performance.now(),
      memory,
      heapUsed: memory.heapUsed / 1024 / 1024, // Convert to MB
    });
  }

  /**
   * Get current memory usage in MB.
   */
  getCurrentMemoryUsage(): number {
    const memory = process.memoryUsage();
    return memory.heapUsed / 1024 / 1024;
  }

  /**
   * Get memory usage difference in megabytes from the start.
   */
  getMemoryDifference(): number {
    const current = process.memoryUsage();
    return (current.heapUsed - this.startMemory.heapUsed) / 1024 / 1024;
  }

  /**
   * Get memory growth rate (MB per second)
   */
  getMemoryGrowthRate(): number {
    if (this.measurements.length < 2) return 0;

    const first = this.measurements[0];
    const last = this.measurements[this.measurements.length - 1];
    const timeDiff = (last.timestamp - first.timestamp) / 1000; // Convert to seconds
    const memoryDiff = last.heapUsed - first.heapUsed;

    return timeDiff > 0 ? memoryDiff / timeDiff : 0;
  }

  /**
   * Retrieves all measurements.
   */
  getMeasurements(): Array<{
    timestamp: number;
    memory: NodeJS.MemoryUsage;
    heapUsed: number;
  }> {
    return [...this.measurements];
  }

  /**
   * Resets measurements and records a new measurement.
   */
  reset(): void {
    this.startTime = performance.now();
    this.startMemory = process.memoryUsage();
    this.measurements = [];
    this.recordMeasurement();
  }

  /**
   * Forces garbage collection if available.
   */
  forceGC(): void {
    if (global.gc) {
      global.gc();
    } else {
      console.warn(
        'Garbage collection not available. Run with --expose-gc flag.'
      );
    }
  }
}

// Memory leak simulation utilities
export class MemoryLeakSimulator {
  private activeLeaks: Map<string, any> = new Map();
  private leakCounter = 0;

  /**
   * Simulate event listener leak.
   */
  simulateEventListenerLeak(count = 1): string {
    const leakId = `event-listener-${++this.leakCounter}`;
    const listeners: Array<() => void> = [];

    for (let i = 0; i < count; i++) {
      const handler = () => console.log(`Handler ${i}`);
      // Simulate adding event listener without cleanup
      if (typeof window !== 'undefined') {
        window.addEventListener('click', handler);
      } else {
        // Node.js environment - simulate with EventEmitter
        const EventEmitter = require('events');
        const emitter = new EventEmitter();
        emitter.on('test', handler);
        listeners.push(() => emitter.removeListener('test', handler));
      }
    }

    this.activeLeaks.set(leakId, { type: 'event-listener', listeners });
    return leakId;
  }

  /**
   * Simulate interval leak by creating multiple intervals that accumulate memory.
   */
  simulateIntervalLeak(intervalMs = 1000, count = 1): string {
    const leakId = `interval-${++this.leakCounter}`;
    const intervals: NodeJS.Timeout[] = [];

    for (let i = 0; i < count; i++) {
      const interval = setInterval(() => {
        // Simulate some work that could cause memory accumulation
        const data = new Array(1000).fill(Math.random());
        // Intentionally don't clean up the data
      }, intervalMs);
      intervals.push(interval);
    }

    this.activeLeaks.set(leakId, { type: 'interval', intervals });
    return leakId;
  }

  /**
   * Simulate a timeout leak by creating multiple timeouts.
   */
  simulateTimeoutLeak(timeoutMs = 5000, count = 1): string {
    const leakId = `timeout-${++this.leakCounter}`;
    const timeouts: NodeJS.Timeout[] = [];

    for (let i = 0; i < count; i++) {
      const timeout = setTimeout(() => {
        // Simulate work that might not complete properly
        const data = new Array(10000).fill(Math.random());
        // Intentionally keep reference
        this.activeLeaks.set(`${leakId}-data-${i}`, data);
      }, timeoutMs);
      timeouts.push(timeout);
    }

    this.activeLeaks.set(leakId, { type: 'timeout', timeouts });
    return leakId;
  }

  /**
   * Simulate subscription leak.
   */
  simulateSubscriptionLeak(count = 1): string {
    const leakId = `subscription-${++this.leakCounter}`;
    const subscriptions: Array<() => void> = [];

    for (let i = 0; i < count; i++) {
      // Simulate subscription that accumulates data
      const data: any[] = [];
      const unsubscribe = () => {
        data.length = 0; // Clear data
      };

      // Simulate periodic data accumulation
      const interval = setInterval(() => {
        data.push(new Array(1000).fill(Math.random()));
      }, 100);

      subscriptions.push(() => {
        clearInterval(interval);
        unsubscribe();
      });
    }

    this.activeLeaks.set(leakId, { type: 'subscription', subscriptions });
    return leakId;
  }

  /**
   * Simulate a memory accumulation leak and return its identifier.
   */
  simulateMemoryAccumulation(sizeKB = 1024): string {
    const leakId = `memory-${++this.leakCounter}`;
    const data = new Array(sizeKB * 1024).fill(Math.random());

    this.activeLeaks.set(leakId, { type: 'memory', data });
    return leakId;
  }

  /**
   * Simulates a circular reference leak and returns a unique leak identifier.
   */
  simulateCircularReference(): string {
    const leakId = `circular-${++this.leakCounter}`;

    const objA: any = { name: 'A' };
    const objB: any = { name: 'B' };

    // Create circular reference
    objA.ref = objB;
    objB.ref = objA;

    // Add some data to make it more realistic
    objA.data = new Array(1000).fill(Math.random());
    objB.data = new Array(1000).fill(Math.random());

    this.activeLeaks.set(leakId, { type: 'circular', objects: [objA, objB] });
    return leakId;
  }

  /**
   * Clean up a specific leak identified by its ID.
   *
   * The function retrieves the leak from activeLeaks using the provided leakId. Depending on the type of leak, it performs various cleanup operations such as removing event listeners, clearing intervals and timeouts, unsubscribing from subscriptions, and breaking circular references. After cleanup, the leak is removed from activeLeaks. If an error occurs during the process, it logs the error and returns false.
   *
   * @param leakId - The identifier of the leak to be cleaned up.
   * @returns A boolean indicating whether the cleanup was successful.
   */
  cleanupLeak(leakId: string): boolean {
    const leak = this.activeLeaks.get(leakId);
    if (!leak) return false;

    try {
      switch (leak.type) {
        case 'event-listener':
          leak.listeners?.forEach((cleanup: () => void) => cleanup());
          break;
        case 'interval':
          leak.intervals?.forEach((interval: NodeJS.Timeout) =>
            clearInterval(interval)
          );
          break;
        case 'timeout':
          leak.timeouts?.forEach((timeout: NodeJS.Timeout) =>
            clearTimeout(timeout)
          );
          break;
        case 'subscription':
          leak.subscriptions?.forEach((unsubscribe: () => void) =>
            unsubscribe()
          );
          break;
        case 'memory':
          // Data will be garbage collected
          break;
        case 'circular':
          // Break circular references
          leak.objects?.forEach((obj: any) => {
            if (obj.ref) obj.ref = null;
          });
          break;
      }

      this.activeLeaks.delete(leakId);
      return true;
    } catch (error) {
      console.error(`Error cleaning up leak ${leakId}:`, error);
      return false;
    }
  }

  /**
   * Cleans up all active leaks.
   */
  cleanupAllLeaks(): void {
    const leakIds = Array.from(this.activeLeaks.keys());
    leakIds.forEach(id => this.cleanupLeak(id));
  }

  /**
   * Get count of active leaks
   */
  getActiveLeakCount(): number {
    return this.activeLeaks.size;
  }

  /**
   * Retrieves the count of active leak types.
   */
  getActiveLeakTypes(): Record<string, number> {
    const types: Record<string, number> = {};

    for (const leak of this.activeLeaks.values()) {
      types[leak.type] = (types[leak.type] || 0) + 1;
    }

    return types;
  }
}

// Memory leak detection validation utilities
export class MemoryLeakValidator {
  private detector: MemoryLeakDetector;

  constructor(detector: MemoryLeakDetector) {
    this.detector = detector;
  }

  /**
   * Validate detection accuracy against known leaks.
   *
   * This function processes an array of test cases, writing each test case's code to a temporary file, and then uses a detector to scan the file for leaks. It calculates true positives, false positives, and false negatives based on the expected and detected leaks, accumulating results for each test case. Finally, it computes the overall accuracy and returns the metrics along with the detailed results.
   *
   * @param testCases - An array of test cases, each containing the code, expected leaks, and file name.
   * @returns An object containing accuracy metrics, including true positives, false positives, false negatives, and detailed results for each test case.
   */
  async validateDetectionAccuracy(
    testCases: Array<{
      code: string;
      expectedLeaks: LeakType[];
      file: string;
    }>
  ): Promise<{
    accuracy: number;
    truePositives: number;
    falsePositives: number;
    falseNegatives: number;
    results: Array<{
      file: string;
      expected: LeakType[];
      detected: LeakType[];
      correct: boolean;
    }>;
  }> {
    const results = [];
    let truePositives = 0;
    let falsePositives = 0;
    let falseNegatives = 0;

    for (const testCase of testCases) {
      // Write test file temporarily
      const fs = require('fs');
      const path = require('path');
      const tempFile = path.join(process.cwd(), testCase.file);

      try {
        fs.writeFileSync(tempFile, testCase.code);

        // Detect leaks
        const detectedLeaks = await this.detector.scanFile(tempFile);
        const detectedTypes = detectedLeaks.map(leak => leak.type);

        // Calculate accuracy metrics
        const expectedSet = new Set(testCase.expectedLeaks);
        const detectedSet = new Set(detectedTypes);

        // True positives: correctly detected leaks
        const tp = testCase.expectedLeaks.filter(type =>
          detectedSet.has(type)
        ).length;

        // False positives: detected but not expected
        const fp = detectedTypes.filter(type => !expectedSet.has(type)).length;

        // False negatives: expected but not detected
        const fn = testCase.expectedLeaks.filter(
          type => !detectedSet.has(type)
        ).length;

        truePositives += tp;
        falsePositives += fp;
        falseNegatives += fn;

        results.push({
          file: testCase.file,
          expected: testCase.expectedLeaks,
          detected: detectedTypes,
          correct: fp === 0 && fn === 0,
        });
      } finally {
        // Clean up temp file
        try {
          fs.unlinkSync(tempFile);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    }

    const totalPredictions = truePositives + falsePositives;
    const totalActual = truePositives + falseNegatives;
    const accuracy = totalActual > 0 ? truePositives / totalActual : 0;

    return {
      accuracy,
      truePositives,
      falsePositives,
      falseNegatives,
      results,
    };
  }

  /**
   * Validate the effectiveness of code fixes by scanning for leaks.
   *
   * This function writes the original code to a temporary file, scans for leaks, applies the provided fixes,
   * and then scans the fixed code for remaining leaks. It calculates the effectiveness of the fixes
   * based on the number of leaks fixed and checks for any new issues introduced. Finally, it cleans up
   * the temporary files created during the process.
   *
   * @param originalCode - The original code as a string to be validated.
   * @param fixes - An array of Fix objects containing original and fixed code snippets.
   * @param fileName - The name of the file being processed, used for temporary file creation.
   * @returns A promise that resolves to an object containing the number of fixes applied,
   *          remaining leaks, new issues introduced, and the effectiveness ratio.
   */
  async validateFixEffectiveness(
    originalCode: string,
    fixes: Fix[],
    fileName: string
  ): Promise<{
    fixesApplied: number;
    leaksRemaining: number;
    newIssues: number;
    effectiveness: number;
  }> {
    const fs = require('fs');
    const path = require('path');

    // Create temp files
    const originalFile = path.join(process.cwd(), `temp-original-${fileName}`);
    const fixedFile = path.join(process.cwd(), `temp-fixed-${fileName}`);

    try {
      // Write original file and scan
      fs.writeFileSync(originalFile, originalCode);
      const originalLeaks = await this.detector.scanFile(originalFile);

      // Apply fixes and create fixed version
      let fixedCode = originalCode;
      let appliedFixes = 0;

      for (const fix of fixes) {
        if (fixedCode.includes(fix.originalCode)) {
          fixedCode = fixedCode.replace(fix.originalCode, fix.fixedCode);
          appliedFixes++;
        }
      }

      // Write fixed file and scan
      fs.writeFileSync(fixedFile, fixedCode);
      const remainingLeaks = await this.detector.scanFile(fixedFile);

      // Calculate effectiveness
      const originalLeakCount = originalLeaks.length;
      const remainingLeakCount = remainingLeaks.length;
      const leaksFixed = Math.max(0, originalLeakCount - remainingLeakCount);
      const effectiveness =
        originalLeakCount > 0 ? leaksFixed / originalLeakCount : 1;

      // Check for new issues introduced by fixes
      const originalLeakTypes = new Set(
        originalLeaks.map(l => `${l.type}:${l.line}`)
      );
      const newIssues = remainingLeaks.filter(
        leak => !originalLeakTypes.has(`${leak.type}:${leak.line}`)
      ).length;

      return {
        fixesApplied: appliedFixes,
        leaksRemaining: remainingLeakCount,
        newIssues,
        effectiveness,
      };
    } finally {
      // Clean up temp files
      [originalFile, fixedFile].forEach(file => {
        try {
          fs.unlinkSync(file);
        } catch (e) {
          // Ignore cleanup errors
        }
      });
    }
  }

  /**
   * Validate runtime detection accuracy
   */
  async validateRuntimeDetection(
    simulator: MemoryLeakSimulator,
    testDuration = 5000
  ): Promise<{
    leaksSimulated: number;
    leaksDetected: number;
    detectionRate: number;
    falseAlarms: number;
  }> {
    const startTime = Date.now();
    let detectedLeaks = 0;
    let falseAlarms = 0;

    // Simulate various types of leaks
    const simulatedLeaks = [
      simulator.simulateEventListenerLeak(3),
      simulator.simulateIntervalLeak(500, 2),
      simulator.simulateMemoryAccumulation(2048),
      simulator.simulateCircularReference(),
    ];

    // Monitor for detection
    const monitorInterval = setInterval(async () => {
      try {
        const runtimeReport = await this.detector.analyzeRuntime();

        if (runtimeReport.suspiciousPatterns.length > 0) {
          detectedLeaks += runtimeReport.suspiciousPatterns.length;
        }

        // Check for false alarms (detection when no leaks should be present)
        if (
          simulator.getActiveLeakCount() === 0 &&
          runtimeReport.suspiciousPatterns.length > 0
        ) {
          falseAlarms += runtimeReport.suspiciousPatterns.length;
        }
      } catch (error) {
        console.error('Runtime detection validation error:', error);
      }
    }, 1000);

    // Wait for test duration
    await new Promise(resolve => setTimeout(resolve, testDuration));

    // Clean up
    clearInterval(monitorInterval);
    simulator.cleanupAllLeaks();

    const detectionRate =
      simulatedLeaks.length > 0 ? detectedLeaks / simulatedLeaks.length : 0;

    return {
      leaksSimulated: simulatedLeaks.length,
      leaksDetected: detectedLeaks,
      detectionRate,
      falseAlarms,
    };
  }
}

// Test helper utilities
export class TestHelpers {
  /**
   * Create a test component with known memory leaks.
   *
   * This function generates a React component that demonstrates various types of memory leaks based on the provided leakTypes.
   * It constructs the component body by adding specific leak patterns, such as missing cleanup for useEffect, uncleaned event listeners,
   * and unclosed resources. The final component is returned as a string, ready for export.
   *
   * @param leakTypes - An array of LeakType indicating the types of memory leaks to include in the component.
   * @returns A string representation of the LeakyComponent with the specified memory leaks.
   */
  static createLeakyComponent(leakTypes: LeakType[]): string {
    const imports = `import React, { useEffect, useState } from 'react';`;

    let componentBody = `
function LeakyComponent() {
  const [count, setCount] = useState(0);
`;

    leakTypes.forEach(leakType => {
      switch (leakType) {
        case 'missing-useeffect-cleanup':
          componentBody += `
  useEffect(() => {
    const handleClick = () => setCount(c => c + 1);
    document.addEventListener('click', handleClick);
    // Missing cleanup
  }, []);
`;
          break;

        case 'uncleaned-event-listener':
          componentBody += `
  const handleResize = () => console.log('resize');
  window.addEventListener('resize', handleResize);
`;
          break;

        case 'uncleaned-interval':
          componentBody += `
  const intervalId = setInterval(() => {
    console.log('tick');
  }, 1000);
  // Missing clearInterval
`;
          break;

        case 'uncleaned-timeout':
          componentBody += `
  const timeoutId = setTimeout(() => {
    console.log('delayed');
  }, 5000);
  // Missing clearTimeout
`;
          break;

        case 'unclosed-eventsource':
          componentBody += `
  const eventSource = new EventSource('/api/events');
  // Missing eventSource.close()
`;
          break;

        case 'unclosed-websocket':
          componentBody += `
  const ws = new WebSocket('ws://localhost:8080');
  // Missing ws.close()
`;
          break;

        case 'uncleaned-subscription':
          componentBody += `
  const unsubscribe = someManager.subscribe(callback);
  // Missing unsubscribe call
`;
          break;
      }
    });

    componentBody += `
  return <div>Count: {count}</div>;
}

export default LeakyComponent;
`;

    return imports + componentBody;
  }

  /**
   * Create a test component with proper cleanup
   */
  static createCleanComponent(): string {
    return `
import React, { useEffect, useState } from 'react';

function CleanComponent() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const handleClick = () => setCount(c => c + 1);
    const handleResize = () => console.log('resize');
    
    document.addEventListener('click', handleClick);
    window.addEventListener('resize', handleResize);
    
    const intervalId = setInterval(() => {
      console.log('tick');
    }, 1000);
    
    const eventSource = new EventSource('/api/events');
    
    // Proper cleanup
    return () => {
      document.removeEventListener('click', handleClick);
      window.removeEventListener('resize', handleResize);
      clearInterval(intervalId);
      eventSource.close();
    };
  }, []);

  return <div>Count: {count}</div>;
}

export default CleanComponent;
`;
  }

  /**
   * Wait for a specified duration.
   */
  static async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Run a function multiple times and collect results.
   *
   * This method executes the provided asynchronous function `fn` a specified number of times,
   * optionally introducing a delay between each execution. The results of each execution are
   * collected in an array and returned. If a delay is specified, it will only be applied
   * after the first execution.
   *
   * @param fn - The asynchronous function to be executed.
   * @param times - The number of times to execute the function.
   * @param delayMs - The delay in milliseconds between executions (default is 0).
   */
  static async runMultipleTimes<T>(
    fn: () => Promise<T>,
    times: number,
    delayMs = 0
  ): Promise<T[]> {
    const results: T[] = [];

    for (let i = 0; i < times; i++) {
      if (delayMs > 0 && i > 0) {
        await this.wait(delayMs);
      }
      results.push(await fn());
    }

    return results;
  }

  /**
   * Calculate statistics from an array of numbers.
   *
   * This function computes the minimum, maximum, mean, median, and standard deviation of the provided array of numbers.
   * It first checks if the array is empty and returns default values if so. Then, it sorts the array to determine the min, max, and median values.
   * The mean is calculated using the reduce method, and the standard deviation is derived from the variance of the values.
   *
   * @param values - An array of numbers for which statistics are to be calculated.
   */
  static calculateStats(values: number[]): {
    min: number;
    max: number;
    mean: number;
    median: number;
    stdDev: number;
  } {
    if (values.length === 0) {
      return { min: 0, max: 0, mean: 0, median: 0, stdDev: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const median =
      sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)];

    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      values.length;
    const stdDev = Math.sqrt(variance);

    return { min, max, mean, median, stdDev };
  }
}

// Export all utilities
export {
  MemoryMeasurement,
  MemoryLeakSimulator,
  MemoryLeakValidator,
  TestHelpers,
};

// Default export with all utilities
export default {
  MemoryMeasurement,
  MemoryLeakSimulator,
  MemoryLeakValidator,
  TestHelpers,
};
