/**
 * Memory usage comparison system for measuring fix effectiveness and regression detection
 */

import { performance } from 'perf_hooks';
import { MemoryMeasurement } from './test-utilities';
import { Fix, LeakReport, MemoryMetrics } from './types';

// Memory snapshot for comparison
export interface MemorySnapshot {
    id: string;
    timestamp: Date;
    description: string;
    memoryUsage: {
        heapUsed: number;
        heapTotal: number;
        external: number;
        arrayBuffers: number;
        rss: number;
    };
    performanceMetrics: {
        gcCount: number;
        gcDuration: number;
        cpuUsage: number;
    };
    resourceCounts: {
        eventListeners: number;
        intervals: number;
        timeouts: number;
        subscriptions: number;
        connections: number;
    };
    metadata: {
        nodeVersion: string;
        platform: string;
        arch: string;
        pid: number;
    };
}

// Comparison result between two snapshots
export interface MemoryComparisonResult {
    before: MemorySnapshot;
    after: MemorySnapshot;
    differences: {
        memoryDelta: number; // MB
        memoryDeltaPercent: number;
        heapGrowth: number; // MB
        externalGrowth: number; // MB
        resourceChanges: {
            eventListeners: number;
            intervals: number;
            timeouts: number;
            subscriptions: number;
            connections: number;
        };
        performanceImpact: {
            gcCountChange: number;
            gcDurationChange: number;
            cpuUsageChange: number;
        };
    };
    analysis: {
        hasMemoryLeak: boolean;
        leakSeverity: 'none' | 'minor' | 'moderate' | 'severe';
        regressionDetected: boolean;
        recommendations: string[];
    };
    duration: number; // milliseconds between snapshots
}

// Fix effectiveness measurement
export interface FixEffectivenessResult {
    fixId: string;
    fixType: string;
    beforeSnapshot: MemorySnapshot;
    afterSnapshot: MemorySnapshot;
    comparison: MemoryComparisonResult;
    effectiveness: {
        memoryReduction: number; // MB
        memoryReductionPercent: number;
        resourcesFreed: number;
        performanceImprovement: number;
        score: number; // 0-100
    };
    success: boolean;
    issues: string[];
}

// Regression detection result
export interface RegressionDetectionResult {
    baselineSnapshot: MemorySnapshot;
    currentSnapshot: MemorySnapshot;
    comparison: MemoryComparisonResult;
    regression: {
        detected: boolean;
        severity: 'none' | 'minor' | 'moderate' | 'severe';
        type: 'memory' | 'performance' | 'resources' | 'mixed';
        confidence: number; // 0-1
    };
    thresholds: {
        memoryGrowthThreshold: number; // MB
        resourceGrowthThreshold: number;
        performanceDegradationThreshold: number;
    };
    recommendations: string[];
}

export class MemoryComparisonSystem {
    private snapshots: Map<string, MemorySnapshot> = new Map();
    private baselines: Map<string, MemorySnapshot> = new Map();
    private gcStats = { count: 0, totalDuration: 0 };

    constructor() {
        // Monitor GC if available
        if (global.gc && process.env.NODE_ENV !== 'production') {
            this.setupGCMonitoring();
        }
    }

    /**
     * Create a memory snapshot
     */
    async createSnapshot(id: string, description: string): Promise<MemorySnapshot> {
        // Force GC before measurement for more accurate results
        if (global.gc) {
            global.gc();
            // Wait a bit for GC to complete
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        const memory = process.memoryUsage();
        const cpuUsage = process.cpuUsage();

        const snapshot: MemorySnapshot = {
            id,
            timestamp: new Date(),
            description,
            memoryUsage: {
                heapUsed: memory.heapUsed / 1024 / 1024, // Convert to MB
                heapTotal: memory.heapTotal / 1024 / 1024,
                external: memory.external / 1024 / 1024,
                arrayBuffers: memory.arrayBuffers / 1024 / 1024,
                rss: memory.rss / 1024 / 1024,
            },
            performanceMetrics: {
                gcCount: this.gcStats.count,
                gcDuration: this.gcStats.totalDuration,
                cpuUsage: (cpuUsage.user + cpuUsage.system) / 1000, // Convert to milliseconds
            },
            resourceCounts: await this.getResourceCounts(),
            metadata: {
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch,
                pid: process.pid,
            },
        };

        this.snapshots.set(id, snapshot);
        return snapshot;
    }

    /**
     * Compare two memory snapshots
     */
    compareSnapshots(beforeId: string, afterId: string): MemoryComparisonResult {
        const before = this.snapshots.get(beforeId);
        const after = this.snapshots.get(afterId);

        if (!before || !after) {
            throw new Error(`Snapshot not found: ${!before ? beforeId : afterId}`);
        }

        const memoryDelta = after.memoryUsage.heapUsed - before.memoryUsage.heapUsed;
        const memoryDeltaPercent = before.memoryUsage.heapUsed > 0
            ? (memoryDelta / before.memoryUsage.heapUsed) * 100
            : 0;

        const heapGrowth = after.memoryUsage.heapTotal - before.memoryUsage.heapTotal;
        const externalGrowth = after.memoryUsage.external - before.memoryUsage.external;

        const resourceChanges = {
            eventListeners: after.resourceCounts.eventListeners - before.resourceCounts.eventListeners,
            intervals: after.resourceCounts.intervals - before.resourceCounts.intervals,
            timeouts: after.resourceCounts.timeouts - before.resourceCounts.timeouts,
            subscriptions: after.resourceCounts.subscriptions - before.resourceCounts.subscriptions,
            connections: after.resourceCounts.connections - before.resourceCounts.connections,
        };

        const performanceImpact = {
            gcCountChange: after.performanceMetrics.gcCount - before.performanceMetrics.gcCount,
            gcDurationChange: after.performanceMetrics.gcDuration - before.performanceMetrics.gcDuration,
            cpuUsageChange: after.performanceMetrics.cpuUsage - before.performanceMetrics.cpuUsage,
        };

        // Analyze results
        const analysis = this.analyzeComparison(memoryDelta, resourceChanges, performanceImpact);

        const duration = after.timestamp.getTime() - before.timestamp.getTime();

        return {
            before,
            after,
            differences: {
                memoryDelta,
                memoryDeltaPercent,
                heapGrowth,
                externalGrowth,
                resourceChanges,
                performanceImpact,
            },
            analysis,
            duration,
        };
    }

    /**
     * Measure fix effectiveness
     */
    async measureFixEffectiveness(
        fix: Fix,
        testFunction: () => Promise<void>
    ): Promise<FixEffectivenessResult> {
        // Create before snapshot
        const beforeSnapshot = await this.createSnapshot(
            `fix-${fix.id}-before`,
            `Before applying fix: ${fix.description}`
        );

        // Apply fix and run test
        try {
            await testFunction();
        } catch (error) {
            console.warn('Test function failed:', error);
        }

        // Wait a bit for effects to settle
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Create after snapshot
        const afterSnapshot = await this.createSnapshot(
            `fix-${fix.id}-after`,
            `After applying fix: ${fix.description}`
        );

        // Compare snapshots
        const comparison = this.compareSnapshots(beforeSnapshot.id, afterSnapshot.id);

        // Calculate effectiveness metrics
        const memoryReduction = -comparison.differences.memoryDelta; // Negative delta means reduction
        const memoryReductionPercent = beforeSnapshot.memoryUsage.heapUsed > 0
            ? (memoryReduction / beforeSnapshot.memoryUsage.heapUsed) * 100
            : 0;

        const resourcesFreed = Object.values(comparison.differences.resourceChanges)
            .reduce((sum, change) => sum + Math.max(0, -change), 0); // Count reductions as freed

        const performanceImprovement = this.calculatePerformanceImprovement(comparison);

        // Calculate overall effectiveness score (0-100)
        const score = this.calculateEffectivenessScore(
            memoryReduction,
            memoryReductionPercent,
            resourcesFreed,
            performanceImprovement
        );

        const success = score > 50 && !comparison.analysis.regressionDetected;
        const issues = this.identifyFixIssues(comparison, fix);

        return {
            fixId: fix.id,
            fixType: fix.type,
            beforeSnapshot,
            afterSnapshot,
            comparison,
            effectiveness: {
                memoryReduction,
                memoryReductionPercent,
                resourcesFreed,
                performanceImprovement,
                score,
            },
            success,
            issues,
        };
    }

    /**
     * Detect memory usage regression
     */
    detectRegression(
        baselineId: string,
        currentId: string,
        thresholds?: {
            memoryGrowthThreshold?: number;
            resourceGrowthThreshold?: number;
            performanceDegradationThreshold?: number;
        }
    ): RegressionDetectionResult {
        const defaultThresholds = {
            memoryGrowthThreshold: 10, // MB
            resourceGrowthThreshold: 5, // count
            performanceDegradationThreshold: 20, // percent
        };

        const finalThresholds = { ...defaultThresholds, ...thresholds };

        const baselineSnapshot = this.snapshots.get(baselineId);
        const currentSnapshot = this.snapshots.get(currentId);

        if (!baselineSnapshot || !currentSnapshot) {
            throw new Error(`Snapshot not found: ${!baselineSnapshot ? baselineId : currentId}`);
        }

        const comparison = this.compareSnapshots(baselineId, currentId);

        // Detect regression
        const memoryRegression = comparison.differences.memoryDelta > finalThresholds.memoryGrowthThreshold;
        const resourceRegression = Object.values(comparison.differences.resourceChanges)
            .some(change => change > finalThresholds.resourceGrowthThreshold);
        const performanceRegression = comparison.differences.performanceImpact.cpuUsageChange >
            (baselineSnapshot.performanceMetrics.cpuUsage * finalThresholds.performanceDegradationThreshold / 100);

        const detected = memoryRegression || resourceRegression || performanceRegression;

        let type: 'memory' | 'performance' | 'resources' | 'mixed' = 'memory';
        let severity: 'none' | 'minor' | 'moderate' | 'severe' = 'none';

        if (detected) {
            const regressionTypes = [];
            if (memoryRegression) regressionTypes.push('memory');
            if (resourceRegression) regressionTypes.push('resources');
            if (performanceRegression) regressionTypes.push('performance');

            type = regressionTypes.length > 1 ? 'mixed' : regressionTypes[0] as any;

            // Determine severity
            if (comparison.differences.memoryDelta > finalThresholds.memoryGrowthThreshold * 3) {
                severity = 'severe';
            } else if (comparison.differences.memoryDelta > finalThresholds.memoryGrowthThreshold * 2) {
                severity = 'moderate';
            } else {
                severity = 'minor';
            }
        }

        // Calculate confidence based on measurement stability
        const confidence = this.calculateRegressionConfidence(comparison);

        const recommendations = this.generateRegressionRecommendations(comparison, type, severity);

        return {
            baselineSnapshot,
            currentSnapshot,
            comparison,
            regression: {
                detected,
                severity,
                type,
                confidence,
            },
            thresholds: finalThresholds,
            recommendations,
        };
    }

    /**
     * Set a baseline snapshot for regression detection
     */
    setBaseline(snapshotId: string, baselineName: string): void {
        const snapshot = this.snapshots.get(snapshotId);
        if (!snapshot) {
            throw new Error(`Snapshot not found: ${snapshotId}`);
        }
        this.baselines.set(baselineName, snapshot);
    }

    /**
     * Get a baseline snapshot
     */
    getBaseline(baselineName: string): MemorySnapshot | undefined {
        return this.baselines.get(baselineName);
    }

    /**
     * Clear old snapshots to prevent memory accumulation
     */
    clearOldSnapshots(maxAge: number = 24 * 60 * 60 * 1000): void {
        const cutoff = new Date(Date.now() - maxAge);

        for (const [id, snapshot] of this.snapshots.entries()) {
            if (snapshot.timestamp < cutoff) {
                this.snapshots.delete(id);
            }
        }
    }

    /**
     * Get all snapshots
     */
    getAllSnapshots(): MemorySnapshot[] {
        return Array.from(this.snapshots.values());
    }

    /**
     * Export snapshots for analysis
     */
    exportSnapshots(): string {
        const data = {
            snapshots: Array.from(this.snapshots.entries()),
            baselines: Array.from(this.baselines.entries()),
            exportedAt: new Date(),
        };
        return JSON.stringify(data, null, 2);
    }

    /**
     * Import snapshots from exported data
     */
    importSnapshots(data: string): void {
        try {
            const parsed = JSON.parse(data);

            if (parsed.snapshots) {
                for (const [id, snapshot] of parsed.snapshots) {
                    this.snapshots.set(id, snapshot);
                }
            }

            if (parsed.baselines) {
                for (const [name, baseline] of parsed.baselines) {
                    this.baselines.set(name, baseline);
                }
            }
        } catch (error) {
            throw new Error(`Failed to import snapshots: ${error.message}`);
        }
    }

    // Private helper methods

    private async getResourceCounts(): Promise<{
        eventListeners: number;
        intervals: number;
        timeouts: number;
        subscriptions: number;
        connections: number;
    }> {
        // In a real implementation, these would track actual resources
        // For now, return mock data that could be extended
        return {
            eventListeners: 0,
            intervals: 0,
            timeouts: 0,
            subscriptions: 0,
            connections: 0,
        };
    }

    private setupGCMonitoring(): void {
        // This would set up GC monitoring in a real implementation
        // For now, just initialize the stats
        this.gcStats = { count: 0, totalDuration: 0 };
    }

    private analyzeComparison(
        memoryDelta: number,
        resourceChanges: any,
        performanceImpact: any
    ): {
        hasMemoryLeak: boolean;
        leakSeverity: 'none' | 'minor' | 'moderate' | 'severe';
        regressionDetected: boolean;
        recommendations: string[];
    } {
        const hasMemoryLeak = memoryDelta > 5; // 5MB threshold
        const hasResourceLeak = Object.values(resourceChanges).some((change: any) => change > 0);
        const hasPerformanceRegression = performanceImpact.cpuUsageChange > 10;

        let leakSeverity: 'none' | 'minor' | 'moderate' | 'severe' = 'none';
        if (hasMemoryLeak) {
            if (memoryDelta > 50) leakSeverity = 'severe';
            else if (memoryDelta > 20) leakSeverity = 'moderate';
            else leakSeverity = 'minor';
        }

        const regressionDetected = hasMemoryLeak || hasResourceLeak || hasPerformanceRegression;

        const recommendations: string[] = [];
        if (hasMemoryLeak) {
            recommendations.push('Memory usage increased significantly. Check for memory leaks.');
        }
        if (hasResourceLeak) {
            recommendations.push('Resource count increased. Ensure proper cleanup of resources.');
        }
        if (hasPerformanceRegression) {
            recommendations.push('Performance degradation detected. Review recent changes.');
        }

        return {
            hasMemoryLeak,
            leakSeverity,
            regressionDetected,
            recommendations,
        };
    }

    private calculatePerformanceImprovement(comparison: MemoryComparisonResult): number {
        // Calculate performance improvement based on GC and CPU metrics
        const gcImprovement = comparison.differences.performanceImpact.gcDurationChange < 0 ? 10 : 0;
        const cpuImprovement = comparison.differences.performanceImpact.cpuUsageChange < 0 ? 10 : 0;
        return gcImprovement + cpuImprovement;
    }

    private calculateEffectivenessScore(
        memoryReduction: number,
        memoryReductionPercent: number,
        resourcesFreed: number,
        performanceImprovement: number
    ): number {
        let score = 0;

        // Memory reduction score (0-40 points)
        if (memoryReduction > 0) {
            score += Math.min(40, memoryReduction * 2);
        }

        // Memory reduction percentage score (0-30 points)
        if (memoryReductionPercent > 0) {
            score += Math.min(30, memoryReductionPercent);
        }

        // Resources freed score (0-20 points)
        score += Math.min(20, resourcesFreed * 4);

        // Performance improvement score (0-10 points)
        score += Math.min(10, performanceImprovement);

        return Math.min(100, Math.max(0, score));
    }

    private identifyFixIssues(comparison: MemoryComparisonResult, fix: Fix): string[] {
        const issues: string[] = [];

        if (comparison.differences.memoryDelta > 0) {
            issues.push('Memory usage increased after applying fix');
        }

        if (comparison.analysis.regressionDetected) {
            issues.push('Regression detected after applying fix');
        }

        if (Object.values(comparison.differences.resourceChanges).some(change => change > 0)) {
            issues.push('Resource count increased after applying fix');
        }

        return issues;
    }

    private calculateRegressionConfidence(comparison: MemoryComparisonResult): number {
        // Calculate confidence based on measurement consistency and magnitude
        let confidence = 0.5; // Base confidence

        // Higher confidence for larger changes
        if (Math.abs(comparison.differences.memoryDelta) > 10) {
            confidence += 0.2;
        }

        // Higher confidence for consistent resource changes
        const resourceChanges = Object.values(comparison.differences.resourceChanges);
        if (resourceChanges.every(change => change >= 0) || resourceChanges.every(change => change <= 0)) {
            confidence += 0.2;
        }

        // Lower confidence for very short duration measurements
        if (comparison.duration < 1000) {
            confidence -= 0.1;
        }

        return Math.min(1, Math.max(0, confidence));
    }

    private generateRegressionRecommendations(
        comparison: MemoryComparisonResult,
        type: string,
        severity: string
    ): string[] {
        const recommendations: string[] = [];

        if (type === 'memory' || type === 'mixed') {
            recommendations.push('Review recent code changes for memory leaks');
            recommendations.push('Check for uncleaned event listeners, intervals, or subscriptions');
        }

        if (type === 'resources' || type === 'mixed') {
            recommendations.push('Audit resource cleanup in component lifecycle methods');
            recommendations.push('Verify proper cleanup in useEffect hooks');
        }

        if (type === 'performance' || type === 'mixed') {
            recommendations.push('Profile CPU usage to identify performance bottlenecks');
            recommendations.push('Consider optimizing expensive operations');
        }

        if (severity === 'severe') {
            recommendations.push('Consider rolling back recent changes until issue is resolved');
        }

        return recommendations;
    }
}

// Export the main class and types
export default MemoryComparisonSystem;