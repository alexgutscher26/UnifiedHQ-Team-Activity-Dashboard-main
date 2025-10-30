/**
 * Client-side memory leak detection API
 * This module provides browser-safe functions for the memory leak dashboard
 */

import type {
  LeakReport,
  RuntimeLeakReport,
  ProjectLeakReport,
  LeakSeverity,
  LeakType,
} from './types';

// Client-side memory leak detector interface
export interface ClientMemoryLeakDetector {
  scanProject(): Promise<ProjectLeakReport>;
  analyzeRuntime(): Promise<RuntimeLeakReport>;
  cleanup(): void;
}

// TODO: Mock implementation for client-side (in a real app, this would call APIs)
class ClientMemoryLeakDetectorImpl implements ClientMemoryLeakDetector {
  private isCleanedUp = false;

  scanProject(): Promise<ProjectLeakReport> {
    if (this.isCleanedUp) {
      return Promise.reject(new Error('Detector has been cleaned up'));
    }

    // TODO: In a real implementation, this would call a server API
    // For now, return mock data to prevent build errors
    return Promise.resolve({
      totalLeaks: 0,
      files: [],
      reports: [],
      summary: {
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
        fixableCount: 0,
      },
      leaksByType: {
        'missing-useeffect-cleanup': 0,
        'uncleaned-event-listener': 0,
        'uncleaned-interval': 0,
        'uncleaned-timeout': 0,
        'uncleaned-subscription': 0,
        'unclosed-eventsource': 0,
        'unclosed-websocket': 0,
        'memory-accumulation': 0,
        'circular-reference': 0,
      },
      leaksBySeverity: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      },
      generatedAt: new Date(),
    });
  }

  analyzeRuntime(): Promise<RuntimeLeakReport> {
    if (this.isCleanedUp) {
      return Promise.reject(new Error('Detector has been cleaned up'));
    }

    // Get basic memory info if available
    const memoryInfo = (performance as any).memory || {
      usedJSHeapSize: 0,
      totalJSHeapSize: 0,
      jsHeapSizeLimit: 0,
    };

    return Promise.resolve({
      memoryUsage: {
        current: memoryInfo.usedJSHeapSize || 0,
        peak: memoryInfo.totalJSHeapSize || 0,
        trend: 'stable' as const,
      },
      activeResources: {
        eventListeners: 0,
        intervals: 0,
        timeouts: 0,
        subscriptions: 0,
        connections: 0,
      },
      suspiciousPatterns: [],
      recommendations: [],
      timestamp: new Date(),
    });
  }

  cleanup(): void {
    this.isCleanedUp = true;
  }
}

// Factory function for creating client-side detector
export function createClientMemoryLeakDetector(): ClientMemoryLeakDetector {
  return new ClientMemoryLeakDetectorImpl();
}

// Client-safe runtime monitoring
export function startClientRuntimeMonitoring(options?: {
  interval?: number;
  memoryThreshold?: number;
  onLeak?: (report: RuntimeLeakReport) => void;
}): () => void {
  const detector = createClientMemoryLeakDetector();
  const interval = options?.interval || 5000;

  const monitor = setInterval(async () => {
    try {
      const runtimeReport = await detector.analyzeRuntime();

      // Check for memory threshold
      if (
        options?.memoryThreshold &&
        runtimeReport.memoryUsage.current >
          options.memoryThreshold * 1024 * 1024 // Convert MB to bytes
      ) {
        options?.onLeak?.(runtimeReport);
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

// Client-side memory utilities
export const clientMemoryUtils = {
  // Get current memory usage (if available)
  getCurrentMemoryUsage(): number {
    const memoryInfo = (performance as any).memory;
    return memoryInfo?.usedJSHeapSize || 0;
  },

  // Check if memory API is available
  isMemoryAPIAvailable(): boolean {
    return typeof (performance as any).memory !== 'undefined';
  },

  // Format memory usage for display
  formatMemoryUsage(bytes: number): string {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  },

  // Get memory trend based on history
  getMemoryTrend(history: number[]): 'growing' | 'declining' | 'stable' {
    if (history.length < 2) return 'stable';

    const recent = history.slice(-3);
    const older = history.slice(-6, -3);

    if (recent.length === 0 || older.length === 0) return 'stable';

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

    const threshold = 0.1; // 10% change threshold
    const change = (recentAvg - olderAvg) / olderAvg;

    if (change > threshold) return 'growing';
    if (change < -threshold) return 'declining';
    return 'stable';
  },
};

// Export types for convenience
export type {
  LeakReport,
  RuntimeLeakReport,
  ProjectLeakReport,
  LeakSeverity,
  LeakType,
};
