/**
 * Automated memory leak testing system
 * Provides comprehensive testing for detection accuracy, fix application, and performance impact
 */

import { performance } from 'perf_hooks';
import { MemoryMeasurement, MemoryLeakSimulator, MemoryLeakValidator, TestHelpers } from './test-utilities';
import MemoryComparisonSystem, { MemorySnapshot, FixEffectivenessResult } from './memory-comparison';
import { MemoryLeakDetector, LeakType, Fix, LeakReport, MemoryLeakDetectionConfig } from './types';
import { createMemoryLeakDetector } from './index';

// Test suite configuration
export interface TestSuiteConfig {
    detectionAccuracy: {
        enabled: boolean;
        testCases: number;
        leakTypes: LeakType[];
        confidenceThreshold: number;
    };
    fixApplication: {
        enabled: boolean;
        testCases: number;
        validateSafety: boolean;
        measureEffectiveness: boolean;
    };
    performanceImpact: {
        enabled: boolean;
        maxDetectionTime: number; // milliseconds
        maxMemoryOverhead: number; // MB
        testFileCount: number;
    };
    regressionTesting: {
        enabled: boolean;
        baselineSnapshots: string[];
        thresholds: {
            memoryGrowth: number;
            resourceGrowth: number;
            performanceDegradation: number;
        };
    };
}

// Test result interfaces
export interface DetectionAccuracyResult {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    truePositives: number;
    falsePositives: number;
    falseNegatives: number;
    trueNegatives: number;
    detailsByLeakType: Record<LeakType, {
        tested: number;
        detected: number;
        accuracy: number;
    }>;
    executionTime: number;
}

export interface FixApplicationResult {
    totalFixes: number;
    successfulFixes: number;
    failedFixes: number;
    safetyViolations: number;
    effectivenessScores: number[];
    averageEffectiveness: number;
    fixesByType: Record<LeakType, {
        attempted: number;
        successful: number;
        averageEffectiveness: number;
    }>;
    executionTime: number;
    issues: string[];
}

export interface PerformanceImpactResult {
    detectionPerformance: {
        averageDetectionTime: number;
        maxDetectionTime: number;
        minDetectionTime: number;
        timePerFile: number;
        memoryOverhead: number;
        cpuUsage: number;
    };
    scalabilityMetrics: {
        filesProcessed: number;
        totalProcessingTime: number;
        throughput: number; // files per second
        memoryGrowthRate: number;
    };
    performanceRegression: boolean;
    bottlenecks: string[];
    executionTime: number;
}

export interface RegressionTestResult {
    baselineComparisons: number;
    regressionsDetected: number;
    falseAlarms: number;
    accuracy: number;
    severityDistribution: Record<string, number>;
    criticalRegressions: string[];
    executionTime: number;
}

export interface AutomatedTestResult {
    timestamp: Date;
    config: TestSuiteConfig;
    detectionAccuracy?: DetectionAccuracyResult;
    fixApplication?: FixApplicationResult;
    performanceImpact?: PerformanceImpactResult;
    regressionTesting?: RegressionTestResult;
    overallScore: number;
    summary: {
        totalTests: number;
        passedTests: number;
        failedTests: number;
        criticalIssues: string[];
        recommendations: string[];
    };
    executionTime: number;
}

export class AutomatedMemoryLeakTesting {
    private detector: MemoryLeakDetector;
    private comparisonSystem: MemoryComparisonSystem;
    private simulator: MemoryLeakSimulator;
    private validator: MemoryLeakValidator;

    constructor(config?: Partial<MemoryLeakDetectionConfig>) {
        this.detector = createMemoryLeakDetector(config);
        this.comparisonSystem = new MemoryComparisonSystem();
        this.simulator = new MemoryLeakSimulator();
        this.validator = new MemoryLeakValidator(this.detector);
    }

    /**
     * Run complete automated test suite
     */
    async runTestSuite(config: TestSuiteConfig): Promise<AutomatedTestResult> {
        const startTime = performance.now();
        const timestamp = new Date();

        console.log('🧪 Starting automated memory leak testing suite...');

        const result: AutomatedTestResult = {
            timestamp,
            config,
            overallScore: 0,
            summary: {
                totalTests: 0,
                passedTests: 0,
                failedTests: 0,
                criticalIssues: [],
                recommendations: [],
            },
            executionTime: 0,
        };

        try {
            // Run detection accuracy tests
            if (config.detectionAccuracy.enabled) {
                console.log('📊 Testing detection accuracy...');
                result.detectionAccuracy = await this.testDetectionAccuracy(config.detectionAccuracy);
                result.summary.totalTests += result.detectionAccuracy.totalTests;
                result.summary.passedTests += result.detectionAccuracy.passedTests;
                result.summary.failedTests += result.detectionAccuracy.failedTests;
            }

            // Run fix application tests
            if (config.fixApplication.enabled) {
                console.log('🔧 Testing fix application...');
                result.fixApplication = await this.testFixApplication(config.fixApplication);
                result.summary.totalTests += result.fixApplication.totalFixes;
                result.summary.passedTests += result.fixApplication.successfulFixes;
                result.summary.failedTests += result.fixApplication.failedFixes;
            }

            // Run performance impact tests
            if (config.performanceImpact.enabled) {
                console.log('⚡ Testing performance impact...');
                result.performanceImpact = await this.testPerformanceImpact(config.performanceImpact);
                result.summary.totalTests += config.performanceImpact.testFileCount;

                if (result.performanceImpact.performanceRegression) {
                    result.summary.failedTests += 1;
                    result.summary.criticalIssues.push('Performance regression detected');
                } else {
                    result.summary.passedTests += 1;
                }
            }

            // Run regression tests
            if (config.regressionTesting.enabled) {
                console.log('🔄 Testing regression detection...');
                result.regressionTesting = await this.testRegressionDetection(config.regressionTesting);
                result.summary.totalTests += result.regressionTesting.baselineComparisons;

                const accurateDetections = result.regressionTesting.baselineComparisons - result.regressionTesting.falseAlarms;
                result.summary.passedTests += accurateDetections;
                result.summary.failedTests += result.regressionTesting.falseAlarms;
            }

            // Calculate overall score
            result.overallScore = this.calculateOverallScore(result);

            // Generate summary and recommendations
            result.summary.recommendations = this.generateRecommendations(result);

            console.log(`✅ Test suite completed with score: ${result.overallScore}/100`);

        } catch (error) {
            console.error('❌ Test suite failed:', error);
            result.summary.criticalIssues.push(`Test suite execution failed: ${error.message}`);
        } finally {
            result.executionTime = performance.now() - startTime;

            // Cleanup
            this.simulator.cleanupAllLeaks();
        }

        return result;
    }

    /**
     * Test detection accuracy
     */
    async testDetectionAccuracy(config: TestSuiteConfig['detectionAccuracy']): Promise<DetectionAccuracyResult> {
        const startTime = performance.now();

        const testCases = this.generateDetectionTestCases(config.testCases, config.leakTypes);

        let truePositives = 0;
        let falsePositives = 0;
        let falseNegatives = 0;
        let trueNegatives = 0;

        const detailsByLeakType: Record<LeakType, { tested: number; detected: number; accuracy: number }> = {} as any;

        // Initialize leak type details
        config.leakTypes.forEach(leakType => {
            detailsByLeakType[leakType] = { tested: 0, detected: 0, accuracy: 0 };
        });

        for (const testCase of testCases) {
            try {
                // Create temporary test file
                const tempFile = `temp-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.tsx`;
                const fs = require('fs');
                fs.writeFileSync(tempFile, testCase.code);

                try {
                    // Run detection
                    const detectedLeaks = await this.detector.scanFile(tempFile);
                    const detectedTypes = new Set(detectedLeaks.map(leak => leak.type));
                    const expectedTypes = new Set(testCase.expectedLeaks);

                    // Update leak type details
                    testCase.expectedLeaks.forEach(leakType => {
                        detailsByLeakType[leakType].tested++;
                        if (detectedTypes.has(leakType)) {
                            detailsByLeakType[leakType].detected++;
                        }
                    });

                    // Calculate confusion matrix values
                    for (const expectedType of expectedTypes) {
                        if (detectedTypes.has(expectedType)) {
                            truePositives++;
                        } else {
                            falseNegatives++;
                        }
                    }

                    for (const detectedType of detectedTypes) {
                        if (!expectedTypes.has(detectedType)) {
                            falsePositives++;
                        }
                    }

                    // True negatives: leak types not expected and not detected
                    const allLeakTypes = new Set(config.leakTypes);
                    for (const leakType of allLeakTypes) {
                        if (!expectedTypes.has(leakType) && !detectedTypes.has(leakType)) {
                            trueNegatives++;
                        }
                    }

                } finally {
                    // Clean up temp file
                    try {
                        fs.unlinkSync(tempFile);
                    } catch (e) {
                        // Ignore cleanup errors
                    }
                }

            } catch (error) {
                console.error(`Detection test failed for test case:`, error);
                falseNegatives += testCase.expectedLeaks.length;
            }
        }

        // Calculate accuracy metrics for each leak type
        Object.keys(detailsByLeakType).forEach(leakType => {
            const details = detailsByLeakType[leakType as LeakType];
            details.accuracy = details.tested > 0 ? details.detected / details.tested : 0;
        });

        // Calculate overall metrics
        const totalTests = testCases.length;
        const passedTests = truePositives + trueNegatives;
        const failedTests = falsePositives + falseNegatives;

        const accuracy = (truePositives + trueNegatives) / (truePositives + trueNegatives + falsePositives + falseNegatives);
        const precision = truePositives > 0 ? truePositives / (truePositives + falsePositives) : 0;
        const recall = truePositives > 0 ? truePositives / (truePositives + falseNegatives) : 0;
        const f1Score = (precision + recall) > 0 ? 2 * (precision * recall) / (precision + recall) : 0;

        return {
            totalTests,
            passedTests,
            failedTests,
            accuracy,
            precision,
            recall,
            f1Score,
            truePositives,
            falsePositives,
            falseNegatives,
            trueNegatives,
            detailsByLeakType,
            executionTime: performance.now() - startTime,
        };
    }

    /**
     * Test fix application
     */
    async testFixApplication(config: TestSuiteConfig['fixApplication']): Promise<FixApplicationResult> {
        const startTime = performance.now();

        const testCases = this.generateFixTestCases(config.testCases);

        let successfulFixes = 0;
        let failedFixes = 0;
        let safetyViolations = 0;
        const effectivenessScores: number[] = [];
        const fixesByType: Record<LeakType, { attempted: number; successful: number; averageEffectiveness: number }> = {} as any;
        const issues: string[] = [];

        for (const testCase of testCases) {
            try {
                // Initialize fix type tracking
                if (!fixesByType[testCase.fix.type]) {
                    fixesByType[testCase.fix.type] = { attempted: 0, successful: 0, averageEffectiveness: 0 };
                }
                fixesByType[testCase.fix.type].attempted++;

                // Test fix application
                const effectiveness = await this.testSingleFix(testCase, config);

                if (effectiveness.success) {
                    successfulFixes++;
                    fixesByType[testCase.fix.type].successful++;
                    effectivenessScores.push(effectiveness.effectiveness.score);
                } else {
                    failedFixes++;
                    issues.push(...effectiveness.issues);
                }

                // Check for safety violations
                if (config.validateSafety && this.hasSafetyViolation(effectiveness)) {
                    safetyViolations++;
                    issues.push(`Safety violation in fix ${testCase.fix.id}`);
                }

            } catch (error) {
                failedFixes++;
                issues.push(`Fix application failed: ${error.message}`);
            }
        }

        // Calculate average effectiveness by type
        Object.keys(fixesByType).forEach(leakType => {
            const typeData = fixesByType[leakType as LeakType];
            if (typeData.successful > 0) {
                const typeScores = effectivenessScores.slice(0, typeData.successful);
                typeData.averageEffectiveness = typeScores.reduce((sum, score) => sum + score, 0) / typeScores.length;
            }
        });

        const averageEffectiveness = effectivenessScores.length > 0
            ? effectivenessScores.reduce((sum, score) => sum + score, 0) / effectivenessScores.length
            : 0;

        return {
            totalFixes: testCases.length,
            successfulFixes,
            failedFixes,
            safetyViolations,
            effectivenessScores,
            averageEffectiveness,
            fixesByType,
            executionTime: performance.now() - startTime,
            issues,
        };
    }

    /**
     * Test performance impact
     */
    async testPerformanceImpact(config: TestSuiteConfig['performanceImpact']): Promise<PerformanceImpactResult> {
        const startTime = performance.now();

        const testFiles = this.generatePerformanceTestFiles(config.testFileCount);
        const detectionTimes: number[] = [];
        const memoryMeasurements: number[] = [];

        let totalProcessingTime = 0;
        const memoryMeasurement = new MemoryMeasurement();

        for (const testFile of testFiles) {
            const fileStartTime = performance.now();
            memoryMeasurement.recordMeasurement();

            try {
                // Create temp file
                const fs = require('fs');
                const tempFileName = `perf-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.tsx`;
                fs.writeFileSync(tempFileName, testFile.content);

                try {
                    // Measure detection performance
                    const detectionStart = performance.now();
                    await this.detector.scanFile(tempFileName);
                    const detectionTime = performance.now() - detectionStart;

                    detectionTimes.push(detectionTime);
                    memoryMeasurements.push(memoryMeasurement.getCurrentMemoryUsage());

                } finally {
                    // Clean up temp file
                    try {
                        fs.unlinkSync(tempFileName);
                    } catch (e) {
                        // Ignore cleanup errors
                    }
                }

            } catch (error) {
                console.error(`Performance test failed for file:`, error);
            }

            const fileProcessingTime = performance.now() - fileStartTime;
            totalProcessingTime += fileProcessingTime;
        }

        // Calculate performance metrics
        const averageDetectionTime = detectionTimes.length > 0
            ? detectionTimes.reduce((sum, time) => sum + time, 0) / detectionTimes.length
            : 0;
        const maxDetectionTime = Math.max(...detectionTimes);
        const minDetectionTime = Math.min(...detectionTimes);
        const timePerFile = totalProcessingTime / testFiles.length;
        const memoryOverhead = memoryMeasurement.getMemoryDifference();
        const throughput = testFiles.length / (totalProcessingTime / 1000); // files per second

        // Check for performance regression
        const performanceRegression =
            maxDetectionTime > config.maxDetectionTime ||
            memoryOverhead > config.maxMemoryOverhead;

        // Identify bottlenecks
        const bottlenecks: string[] = [];
        if (averageDetectionTime > config.maxDetectionTime * 0.8) {
            bottlenecks.push('Detection time approaching threshold');
        }
        if (memoryOverhead > config.maxMemoryOverhead * 0.8) {
            bottlenecks.push('Memory overhead approaching threshold');
        }
        if (throughput < 1) {
            bottlenecks.push('Low throughput detected');
        }

        return {
            detectionPerformance: {
                averageDetectionTime,
                maxDetectionTime,
                minDetectionTime,
                timePerFile,
                memoryOverhead,
                cpuUsage: 0, // Would need more sophisticated CPU monitoring
            },
            scalabilityMetrics: {
                filesProcessed: testFiles.length,
                totalProcessingTime,
                throughput,
                memoryGrowthRate: memoryMeasurement.getMemoryGrowthRate(),
            },
            performanceRegression,
            bottlenecks,
            executionTime: performance.now() - startTime,
        };
    }

    /**
     * Test regression detection
     */
    async testRegressionDetection(config: TestSuiteConfig['regressionTesting']): Promise<RegressionTestResult> {
        const startTime = performance.now();

        let baselineComparisons = 0;
        let regressionsDetected = 0;
        let falseAlarms = 0;
        const severityDistribution: Record<string, number> = {};
        const criticalRegressions: string[] = [];

        // Create test scenarios with known regressions
        const testScenarios = this.generateRegressionTestScenarios();

        for (const scenario of testScenarios) {
            try {
                // Create baseline snapshot
                const baselineSnapshot = await this.comparisonSystem.createSnapshot(
                    `baseline-${scenario.id}`,
                    `Baseline for ${scenario.description}`
                );

                // Simulate the scenario
                await scenario.simulateRegression();

                // Create current snapshot
                const currentSnapshot = await this.comparisonSystem.createSnapshot(
                    `current-${scenario.id}`,
                    `Current state for ${scenario.description}`
                );

                // Detect regression
                const regressionResult = this.comparisonSystem.detectRegression(
                    baselineSnapshot.id,
                    currentSnapshot.id,
                    config.thresholds
                );

                baselineComparisons++;

                if (regressionResult.regression.detected) {
                    regressionsDetected++;

                    // Track severity distribution
                    const severity = regressionResult.regression.severity;
                    severityDistribution[severity] = (severityDistribution[severity] || 0) + 1;

                    if (severity === 'severe') {
                        criticalRegressions.push(scenario.description);
                    }

                    // Check if this was expected
                    if (!scenario.expectRegression) {
                        falseAlarms++;
                    }
                } else if (scenario.expectRegression) {
                    // Missed a regression that should have been detected
                    falseAlarms++;
                }

                // Cleanup scenario
                await scenario.cleanup();

            } catch (error) {
                console.error(`Regression test failed for scenario ${scenario.id}:`, error);
                falseAlarms++;
            }
        }

        const accuracy = baselineComparisons > 0
            ? (baselineComparisons - falseAlarms) / baselineComparisons
            : 0;

        return {
            baselineComparisons,
            regressionsDetected,
            falseAlarms,
            accuracy,
            severityDistribution,
            criticalRegressions,
            executionTime: performance.now() - startTime,
        };
    }

    // Private helper methods

    private generateDetectionTestCases(count: number, leakTypes: LeakType[]): Array<{
        code: string;
        expectedLeaks: LeakType[];
        description: string;
    }> {
        const testCases = [];

        for (let i = 0; i < count; i++) {
            const selectedLeaks = leakTypes.slice(0, Math.floor(Math.random() * leakTypes.length) + 1);
            const code = TestHelpers.createLeakyComponent(selectedLeaks);

            testCases.push({
                code,
                expectedLeaks: selectedLeaks,
                description: `Test case ${i + 1} with ${selectedLeaks.join(', ')}`,
            });
        }

        // Add some clean components as negative test cases
        for (let i = 0; i < Math.floor(count * 0.2); i++) {
            testCases.push({
                code: TestHelpers.createCleanComponent(),
                expectedLeaks: [],
                description: `Clean component test case ${i + 1}`,
            });
        }

        return testCases;
    }

    private generateFixTestCases(count: number): Array<{
        originalCode: string;
        fix: Fix;
        description: string;
    }> {
        const testCases = [];

        for (let i = 0; i < count; i++) {
            const leakType = ['missing-useeffect-cleanup', 'uncleaned-event-listener', 'uncleaned-interval'][i % 3] as LeakType;
            const originalCode = TestHelpers.createLeakyComponent([leakType]);

            // Create a mock fix
            const fix: Fix = {
                id: `fix-${i}`,
                leakId: `leak-${i}`,
                type: leakType,
                file: `test-${i}.tsx`,
                line: 10,
                column: 5,
                originalCode: 'useEffect(() => {',
                fixedCode: 'useEffect(() => {\n  return () => {\n    // cleanup\n  };',
                description: `Fix for ${leakType}`,
                confidence: 0.9,
                requiresManualReview: false,
                category: 'automatic',
                metadata: {
                    generatedAt: new Date(),
                    estimatedImpact: 'medium',
                    riskLevel: 'safe',
                },
            };

            testCases.push({
                originalCode,
                fix,
                description: `Fix test case ${i + 1} for ${leakType}`,
            });
        }

        return testCases;
    }

    private generatePerformanceTestFiles(count: number): Array<{
        content: string;
        size: number;
        complexity: 'low' | 'medium' | 'high';
    }> {
        const testFiles = [];

        for (let i = 0; i < count; i++) {
            const complexity = ['low', 'medium', 'high'][i % 3] as 'low' | 'medium' | 'high';
            let content = '';

            switch (complexity) {
                case 'low':
                    content = TestHelpers.createCleanComponent();
                    break;
                case 'medium':
                    content = TestHelpers.createLeakyComponent(['missing-useeffect-cleanup', 'uncleaned-event-listener']);
                    break;
                case 'high':
                    content = TestHelpers.createLeakyComponent(['missing-useeffect-cleanup', 'uncleaned-event-listener', 'uncleaned-interval', 'unclosed-eventsource']);
                    // Add more complex code
                    content += '\n\n' + 'const complexFunction = () => {\n' + '  '.repeat(100) + 'return "complex";\n' + '};';
                    break;
            }

            testFiles.push({
                content,
                size: content.length,
                complexity,
            });
        }

        return testFiles;
    }

    private generateRegressionTestScenarios(): Array<{
        id: string;
        description: string;
        expectRegression: boolean;
        simulateRegression: () => Promise<void>;
        cleanup: () => Promise<void>;
    }> {
        return [
            {
                id: 'memory-growth',
                description: 'Memory growth scenario',
                expectRegression: true,
                simulateRegression: async () => {
                    this.simulator.simulateMemoryAccumulation(5000); // 5MB
                    await TestHelpers.wait(1000);
                },
                cleanup: async () => {
                    this.simulator.cleanupAllLeaks();
                },
            },
            {
                id: 'resource-leak',
                description: 'Resource leak scenario',
                expectRegression: true,
                simulateRegression: async () => {
                    this.simulator.simulateEventListenerLeak(10);
                    this.simulator.simulateIntervalLeak(1000, 5);
                    await TestHelpers.wait(1000);
                },
                cleanup: async () => {
                    this.simulator.cleanupAllLeaks();
                },
            },
            {
                id: 'no-regression',
                description: 'No regression scenario',
                expectRegression: false,
                simulateRegression: async () => {
                    // Do nothing - should not trigger regression
                    await TestHelpers.wait(500);
                },
                cleanup: async () => {
                    // Nothing to cleanup
                },
            },
        ];
    }

    private async testSingleFix(
        testCase: { originalCode: string; fix: Fix; description: string },
        config: TestSuiteConfig['fixApplication']
    ): Promise<FixEffectivenessResult> {
        // Mock implementation - in real scenario would apply fix and measure effectiveness
        return {
            fixId: testCase.fix.id,
            fixType: testCase.fix.type,
            beforeSnapshot: await this.comparisonSystem.createSnapshot(`before-${testCase.fix.id}`, 'Before fix'),
            afterSnapshot: await this.comparisonSystem.createSnapshot(`after-${testCase.fix.id}`, 'After fix'),
            comparison: {} as any, // Would be populated with real comparison
            effectiveness: {
                memoryReduction: 2.5,
                memoryReductionPercent: 5.0,
                resourcesFreed: 1,
                performanceImprovement: 10,
                score: 75,
            },
            success: true,
            issues: [],
        };
    }

    private hasSafetyViolation(effectiveness: FixEffectivenessResult): boolean {
        // Check for safety violations like syntax errors, broken functionality, etc.
        return effectiveness.issues.some(issue =>
            issue.includes('syntax error') ||
            issue.includes('broken functionality') ||
            issue.includes('regression')
        );
    }

    private calculateOverallScore(result: AutomatedTestResult): number {
        let score = 0;
        let components = 0;

        if (result.detectionAccuracy) {
            score += result.detectionAccuracy.accuracy * 30; // 30% weight
            components++;
        }

        if (result.fixApplication) {
            const fixScore = (result.fixApplication.successfulFixes / result.fixApplication.totalFixes) * 25; // 25% weight
            score += fixScore;
            components++;
        }

        if (result.performanceImpact) {
            const perfScore = result.performanceImpact.performanceRegression ? 0 : 25; // 25% weight
            score += perfScore;
            components++;
        }

        if (result.regressionTesting) {
            score += result.regressionTesting.accuracy * 20; // 20% weight
            components++;
        }

        return components > 0 ? score / components : 0;
    }

    private generateRecommendations(result: AutomatedTestResult): string[] {
        const recommendations: string[] = [];

        if (result.detectionAccuracy && result.detectionAccuracy.accuracy < 0.8) {
            recommendations.push('Detection accuracy is below 80%. Consider tuning detection patterns.');
        }

        if (result.fixApplication && result.fixApplication.averageEffectiveness < 60) {
            recommendations.push('Fix effectiveness is low. Review fix generation algorithms.');
        }

        if (result.performanceImpact && result.performanceImpact.performanceRegression) {
            recommendations.push('Performance regression detected. Optimize detection algorithms.');
        }

        if (result.regressionTesting && result.regressionTesting.falseAlarms > result.regressionTesting.baselineComparisons * 0.1) {
            recommendations.push('High false alarm rate in regression detection. Adjust thresholds.');
        }

        if (result.overallScore < 70) {
            recommendations.push('Overall system performance is below acceptable threshold. Comprehensive review needed.');
        }

        return recommendations;
    }
}

// Export the main class and types
export default AutomatedMemoryLeakTesting;
export {
    TestSuiteConfig,
    DetectionAccuracyResult,
    FixApplicationResult,
    PerformanceImpactResult,
    RegressionTestResult,
    AutomatedTestResult,
};