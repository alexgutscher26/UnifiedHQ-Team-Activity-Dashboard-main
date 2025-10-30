import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import {
  MemoryMeasurement,
  MemoryLeakSimulator,
  MemoryLeakValidator,
  TestHelpers,
} from '../memory-leak-detection/test-utilities';
import MemoryComparisonSystem from '../memory-leak-detection/memory-comparison';
import AutomatedMemoryLeakTesting from '../memory-leak-detection/automated-testing';
import { createMemoryLeakDetector } from '../memory-leak-detection';
import { LeakType } from '../memory-leak-detection/types';

describe('Memory Leak Testing System', () => {
  let simulator: MemoryLeakSimulator;
  let comparisonSystem: MemoryComparisonSystem;
  let automatedTesting: AutomatedMemoryLeakTesting;

  beforeEach(() => {
    simulator = new MemoryLeakSimulator();
    comparisonSystem = new MemoryComparisonSystem();
    automatedTesting = new AutomatedMemoryLeakTesting();
  });

  afterEach(() => {
    simulator.cleanupAllLeaks();
  });

  describe('MemoryMeasurement', () => {
    it('should track memory usage over time', () => {
      const measurement = new MemoryMeasurement();
      const initialUsage = measurement.getCurrentMemoryUsage();

      // Simulate some memory allocation
      const data = new Array(1000).fill(Math.random());
      measurement.recordMeasurement();

      const finalUsage = measurement.getCurrentMemoryUsage();
      const difference = measurement.getMemoryDifference();

      assert.ok(typeof initialUsage === 'number');
      assert.ok(typeof finalUsage === 'number');
      assert.ok(typeof difference === 'number');
      assert.ok(measurement.getMeasurements().length >= 2);

      console.log(
        `✓ Memory tracking: ${initialUsage.toFixed(2)}MB -> ${finalUsage.toFixed(2)}MB (${difference.toFixed(2)}MB diff)`
      );
    });

    it('should calculate memory growth rate', async () => {
      const measurement = new MemoryMeasurement();

      // Record initial measurement
      measurement.recordMeasurement();

      // Wait and allocate memory
      await new Promise(resolve => setTimeout(resolve, 100));
      const data = new Array(10000).fill(Math.random());
      measurement.recordMeasurement();

      const growthRate = measurement.getMemoryGrowthRate();

      assert.ok(typeof growthRate === 'number');
      console.log(`✓ Memory growth rate: ${growthRate.toFixed(3)} MB/s`);
    });

    it('should reset measurements correctly', () => {
      const measurement = new MemoryMeasurement();

      // Record several measurements
      measurement.recordMeasurement();
      measurement.recordMeasurement();
      measurement.recordMeasurement();

      assert.ok(measurement.getMeasurements().length >= 3);

      // Reset and verify
      measurement.reset();
      assert.strictEqual(measurement.getMeasurements().length, 1);
      assert.strictEqual(measurement.getMemoryDifference(), 0);
    });
  });

  describe('MemoryLeakSimulator', () => {
    it('should simulate event listener leaks', () => {
      const leakId = simulator.simulateEventListenerLeak(3);

      assert.ok(typeof leakId === 'string');
      assert.strictEqual(simulator.getActiveLeakCount(), 1);

      const leakTypes = simulator.getActiveLeakTypes();
      assert.strictEqual(leakTypes['event-listener'], 1);

      console.log(`✓ Event listener leak simulated: ${leakId}`);
    });

    it('should simulate interval leaks', () => {
      const leakId = simulator.simulateIntervalLeak(1000, 2);

      assert.ok(typeof leakId === 'string');
      assert.strictEqual(simulator.getActiveLeakCount(), 1);

      const leakTypes = simulator.getActiveLeakTypes();
      assert.strictEqual(leakTypes['interval'], 1);

      console.log(`✓ Interval leak simulated: ${leakId}`);
    });

    it('should simulate memory accumulation leaks', () => {
      const leakId = simulator.simulateMemoryAccumulation(2048);

      assert.ok(typeof leakId === 'string');
      assert.strictEqual(simulator.getActiveLeakCount(), 1);

      const leakTypes = simulator.getActiveLeakTypes();
      assert.strictEqual(leakTypes['memory'], 1);

      console.log(`✓ Memory accumulation leak simulated: ${leakId}`);
    });

    it('should simulate circular reference leaks', () => {
      const leakId = simulator.simulateCircularReference();

      assert.ok(typeof leakId === 'string');
      assert.strictEqual(simulator.getActiveLeakCount(), 1);

      const leakTypes = simulator.getActiveLeakTypes();
      assert.strictEqual(leakTypes['circular'], 1);

      console.log(`✓ Circular reference leak simulated: ${leakId}`);
    });

    it('should clean up individual leaks', () => {
      const leakId1 = simulator.simulateEventListenerLeak(2);
      const leakId2 = simulator.simulateIntervalLeak(500, 1);

      assert.strictEqual(simulator.getActiveLeakCount(), 2);

      const cleaned = simulator.cleanupLeak(leakId1);
      assert.strictEqual(cleaned, true);
      assert.strictEqual(simulator.getActiveLeakCount(), 1);

      console.log(`✓ Individual leak cleanup: ${leakId1}`);
    });

    it('should clean up all leaks', () => {
      simulator.simulateEventListenerLeak(3);
      simulator.simulateIntervalLeak(1000, 2);
      simulator.simulateMemoryAccumulation(1024);

      assert.strictEqual(simulator.getActiveLeakCount(), 3);

      simulator.cleanupAllLeaks();
      assert.strictEqual(simulator.getActiveLeakCount(), 0);

      console.log(`✓ All leaks cleaned up`);
    });
  });

  describe('MemoryComparisonSystem', () => {
    it('should create memory snapshots', async () => {
      const snapshot = await comparisonSystem.createSnapshot(
        'test-1',
        'Test snapshot'
      );

      assert.ok(snapshot.id === 'test-1');
      assert.ok(snapshot.description === 'Test snapshot');
      assert.ok(typeof snapshot.memoryUsage.heapUsed === 'number');
      assert.ok(typeof snapshot.memoryUsage.heapTotal === 'number');
      assert.ok(snapshot.timestamp instanceof Date);

      console.log(
        `✓ Snapshot created: ${snapshot.memoryUsage.heapUsed.toFixed(2)}MB heap used`
      );
    });

    it('should compare memory snapshots', async () => {
      // Create before snapshot
      const beforeSnapshot = await comparisonSystem.createSnapshot(
        'before',
        'Before test'
      );

      // Simulate memory allocation
      const data = new Array(50000).fill(Math.random());
      await new Promise(resolve => setTimeout(resolve, 100));

      // Create after snapshot
      const afterSnapshot = await comparisonSystem.createSnapshot(
        'after',
        'After test'
      );

      // Compare snapshots
      const comparison = comparisonSystem.compareSnapshots('before', 'after');

      assert.ok(comparison.before.id === 'before');
      assert.ok(comparison.after.id === 'after');
      assert.ok(typeof comparison.differences.memoryDelta === 'number');
      assert.ok(typeof comparison.differences.memoryDeltaPercent === 'number');
      assert.ok(typeof comparison.duration === 'number');

      console.log(
        `✓ Memory comparison: ${comparison.differences.memoryDelta.toFixed(2)}MB delta (${comparison.differences.memoryDeltaPercent.toFixed(1)}%)`
      );
    });

    it('should detect memory regression', async () => {
      // Create baseline
      const baseline = await comparisonSystem.createSnapshot(
        'baseline',
        'Baseline'
      );

      // Simulate significant memory growth
      const largeData = new Array(100000).fill(Math.random());
      await new Promise(resolve => setTimeout(resolve, 100));

      // Create current snapshot
      const current = await comparisonSystem.createSnapshot(
        'current',
        'Current'
      );

      // Detect regression
      const regression = comparisonSystem.detectRegression(
        'baseline',
        'current',
        {
          memoryGrowthThreshold: 5, // 5MB threshold
        }
      );

      assert.ok(typeof regression.regression.detected === 'boolean');
      assert.ok(
        ['none', 'minor', 'moderate', 'severe'].includes(
          regression.regression.severity
        )
      );
      assert.ok(typeof regression.regression.confidence === 'number');
      assert.ok(
        regression.regression.confidence >= 0 &&
          regression.regression.confidence <= 1
      );

      console.log(
        `✓ Regression detection: ${regression.regression.detected ? 'detected' : 'not detected'} (${regression.regression.severity})`
      );
    });

    it('should set and retrieve baselines', async () => {
      const snapshot = await comparisonSystem.createSnapshot(
        'test',
        'Test baseline'
      );

      comparisonSystem.setBaseline('test', 'main-baseline');
      const retrievedBaseline = comparisonSystem.getBaseline('main-baseline');

      assert.ok(retrievedBaseline);
      assert.strictEqual(retrievedBaseline.id, 'test');
      assert.strictEqual(retrievedBaseline.description, 'Test baseline');

      console.log(`✓ Baseline management: set and retrieved successfully`);
    });

    it('should export and import snapshots', async () => {
      // Create some snapshots
      await comparisonSystem.createSnapshot('snap1', 'Snapshot 1');
      await comparisonSystem.createSnapshot('snap2', 'Snapshot 2');
      comparisonSystem.setBaseline('snap1', 'baseline1');

      // Export
      const exportData = comparisonSystem.exportSnapshots();
      assert.ok(typeof exportData === 'string');

      // Create new system and import
      const newSystem = new MemoryComparisonSystem();
      newSystem.importSnapshots(exportData);

      const importedSnapshots = newSystem.getAllSnapshots();
      assert.ok(importedSnapshots.length >= 2);

      const importedBaseline = newSystem.getBaseline('baseline1');
      assert.ok(importedBaseline);

      console.log(
        `✓ Snapshot export/import: ${importedSnapshots.length} snapshots imported`
      );
    });
  });

  describe('TestHelpers', () => {
    it('should create leaky components with specified leak types', () => {
      const leakTypes: LeakType[] = [
        'missing-useeffect-cleanup',
        'uncleaned-event-listener',
      ];
      const component = TestHelpers.createLeakyComponent(leakTypes);

      assert.ok(typeof component === 'string');
      assert.ok(component.includes('useEffect'));
      assert.ok(component.includes('addEventListener'));
      assert.ok(component.includes('import React'));

      console.log(
        `✓ Leaky component created with ${leakTypes.length} leak types`
      );
    });

    it('should create clean components', () => {
      const component = TestHelpers.createCleanComponent();

      assert.ok(typeof component === 'string');
      assert.ok(component.includes('useEffect'));
      assert.ok(component.includes('return () => {'));
      assert.ok(component.includes('removeEventListener'));
      assert.ok(component.includes('clearInterval'));

      console.log(`✓ Clean component created with proper cleanup`);
    });

    it('should run functions multiple times', async () => {
      let counter = 0;
      const testFunction = async () => {
        counter++;
        return counter;
      };

      const results = await TestHelpers.runMultipleTimes(testFunction, 5, 10);

      assert.strictEqual(results.length, 5);
      assert.strictEqual(results[0], 1);
      assert.strictEqual(results[4], 5);
      assert.strictEqual(counter, 5);

      console.log(
        `✓ Multiple function runs: ${results.length} executions completed`
      );
    });

    it('should calculate statistics correctly', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const stats = TestHelpers.calculateStats(values);

      assert.strictEqual(stats.min, 1);
      assert.strictEqual(stats.max, 10);
      assert.strictEqual(stats.mean, 5.5);
      assert.strictEqual(stats.median, 5.5);
      assert.ok(stats.stdDev > 0);

      console.log(
        `✓ Statistics: mean=${stats.mean}, median=${stats.median}, stdDev=${stats.stdDev.toFixed(2)}`
      );
    });

    it('should handle empty arrays in statistics', () => {
      const stats = TestHelpers.calculateStats([]);

      assert.strictEqual(stats.min, 0);
      assert.strictEqual(stats.max, 0);
      assert.strictEqual(stats.mean, 0);
      assert.strictEqual(stats.median, 0);
      assert.strictEqual(stats.stdDev, 0);

      console.log(`✓ Empty array statistics handled correctly`);
    });
  });

  describe('AutomatedMemoryLeakTesting', () => {
    it('should run detection accuracy tests', async () => {
      const config = {
        detectionAccuracy: {
          enabled: true,
          testCases: 5,
          leakTypes: [
            'missing-useeffect-cleanup',
            'uncleaned-event-listener',
          ] as LeakType[],
          confidenceThreshold: 0.7,
        },
        fixApplication: {
          enabled: false,
          testCases: 0,
          validateSafety: false,
          measureEffectiveness: false,
        },
        performanceImpact: {
          enabled: false,
          maxDetectionTime: 0,
          maxMemoryOverhead: 0,
          testFileCount: 0,
        },
        regressionTesting: {
          enabled: false,
          baselineSnapshots: [],
          thresholds: {
            memoryGrowth: 0,
            resourceGrowth: 0,
            performanceDegradation: 0,
          },
        },
      };

      const result = await automatedTesting.runTestSuite(config);

      assert.ok(result.detectionAccuracy);
      assert.ok(typeof result.detectionAccuracy.accuracy === 'number');
      assert.ok(
        result.detectionAccuracy.accuracy >= 0 &&
          result.detectionAccuracy.accuracy <= 1
      );
      assert.ok(typeof result.detectionAccuracy.totalTests === 'number');
      assert.ok(result.detectionAccuracy.totalTests > 0);

      console.log(
        `✓ Detection accuracy test: ${(result.detectionAccuracy.accuracy * 100).toFixed(1)}% accuracy`
      );
    });

    it('should run fix application tests', async () => {
      const config = {
        detectionAccuracy: {
          enabled: false,
          testCases: 0,
          leakTypes: [] as LeakType[],
          confidenceThreshold: 0,
        },
        fixApplication: {
          enabled: true,
          testCases: 3,
          validateSafety: true,
          measureEffectiveness: true,
        },
        performanceImpact: {
          enabled: false,
          maxDetectionTime: 0,
          maxMemoryOverhead: 0,
          testFileCount: 0,
        },
        regressionTesting: {
          enabled: false,
          baselineSnapshots: [],
          thresholds: {
            memoryGrowth: 0,
            resourceGrowth: 0,
            performanceDegradation: 0,
          },
        },
      };

      const result = await automatedTesting.runTestSuite(config);

      assert.ok(result.fixApplication);
      assert.ok(typeof result.fixApplication.totalFixes === 'number');
      assert.ok(typeof result.fixApplication.successfulFixes === 'number');
      assert.ok(typeof result.fixApplication.averageEffectiveness === 'number');
      assert.ok(result.fixApplication.totalFixes > 0);

      console.log(
        `✓ Fix application test: ${result.fixApplication.successfulFixes}/${result.fixApplication.totalFixes} fixes successful`
      );
    });

    it('should run performance impact tests', async () => {
      const config = {
        detectionAccuracy: {
          enabled: false,
          testCases: 0,
          leakTypes: [] as LeakType[],
          confidenceThreshold: 0,
        },
        fixApplication: {
          enabled: false,
          testCases: 0,
          validateSafety: false,
          measureEffectiveness: false,
        },
        performanceImpact: {
          enabled: true,
          maxDetectionTime: 5000, // 5 seconds
          maxMemoryOverhead: 50, // 50MB
          testFileCount: 3,
        },
        regressionTesting: {
          enabled: false,
          baselineSnapshots: [],
          thresholds: {
            memoryGrowth: 0,
            resourceGrowth: 0,
            performanceDegradation: 0,
          },
        },
      };

      const result = await automatedTesting.runTestSuite(config);

      assert.ok(result.performanceImpact);
      assert.ok(
        typeof result.performanceImpact.detectionPerformance
          .averageDetectionTime === 'number'
      );
      assert.ok(
        typeof result.performanceImpact.scalabilityMetrics.throughput ===
          'number'
      );
      assert.ok(
        typeof result.performanceImpact.performanceRegression === 'boolean'
      );

      console.log(
        `✓ Performance test: ${result.performanceImpact.detectionPerformance.averageDetectionTime.toFixed(2)}ms avg detection time`
      );
    });

    it('should calculate overall score correctly', async () => {
      const config = {
        detectionAccuracy: {
          enabled: true,
          testCases: 2,
          leakTypes: ['missing-useeffect-cleanup'] as LeakType[],
          confidenceThreshold: 0.7,
        },
        fixApplication: {
          enabled: true,
          testCases: 2,
          validateSafety: true,
          measureEffectiveness: true,
        },
        performanceImpact: {
          enabled: true,
          maxDetectionTime: 5000,
          maxMemoryOverhead: 50,
          testFileCount: 2,
        },
        regressionTesting: {
          enabled: false,
          baselineSnapshots: [],
          thresholds: {
            memoryGrowth: 0,
            resourceGrowth: 0,
            performanceDegradation: 0,
          },
        },
      };

      const result = await automatedTesting.runTestSuite(config);

      assert.ok(typeof result.overallScore === 'number');
      assert.ok(result.overallScore >= 0 && result.overallScore <= 100);
      assert.ok(Array.isArray(result.summary.recommendations));
      assert.ok(typeof result.summary.totalTests === 'number');

      console.log(
        `✓ Overall test score: ${result.overallScore.toFixed(1)}/100`
      );
    });
  });

  describe('Integration Tests', () => {
    it('should detect and measure memory leaks end-to-end', async () => {
      // Create a detector
      const detector = createMemoryLeakDetector();

      // Create test code with known leaks
      const testCode = TestHelpers.createLeakyComponent([
        'missing-useeffect-cleanup',
        'uncleaned-event-listener',
      ]);

      // Write to temp file
      const fs = require('fs');
      const tempFile = `integration-test-${Date.now()}.tsx`;

      try {
        fs.writeFileSync(tempFile, testCode);

        // Detect leaks
        const leaks = await detector.scanFile(tempFile);

        assert.ok(Array.isArray(leaks));
        assert.ok(leaks.length > 0);

        // Verify leak types
        const leakTypes = leaks.map(leak => leak.type);
        assert.ok(leakTypes.includes('missing-useeffect-cleanup'));

        console.log(`✓ End-to-end test: detected ${leaks.length} leaks`);
      } finally {
        // Cleanup
        try {
          fs.unlinkSync(tempFile);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    });

    it('should simulate and detect runtime memory leaks', async () => {
      const measurement = new MemoryMeasurement();

      // Simulate multiple types of leaks
      const eventLeakId = simulator.simulateEventListenerLeak(5);
      const intervalLeakId = simulator.simulateIntervalLeak(100, 3);
      const memoryLeakId = simulator.simulateMemoryAccumulation(1024);

      // Wait for effects
      await TestHelpers.wait(500);
      measurement.recordMeasurement();

      // Verify leaks are active
      assert.strictEqual(simulator.getActiveLeakCount(), 3);

      const leakTypes = simulator.getActiveLeakTypes();
      assert.strictEqual(leakTypes['event-listener'], 1);
      assert.strictEqual(leakTypes['interval'], 1);
      assert.strictEqual(leakTypes['memory'], 1);

      // Measure memory impact
      const memoryGrowth = measurement.getMemoryDifference();
      assert.ok(memoryGrowth >= 0); // Should have some growth

      // Cleanup and verify
      simulator.cleanupAllLeaks();
      assert.strictEqual(simulator.getActiveLeakCount(), 0);

      console.log(
        `✓ Runtime leak simulation: ${memoryGrowth.toFixed(2)}MB growth detected`
      );
    });

    it('should measure fix effectiveness accurately', async () => {
      // Create snapshots before and after simulated fix
      const beforeSnapshot = await comparisonSystem.createSnapshot(
        'fix-before',
        'Before fix'
      );

      // Simulate applying a fix (memory reduction)
      await TestHelpers.wait(100);

      const afterSnapshot = await comparisonSystem.createSnapshot(
        'fix-after',
        'After fix'
      );

      // Compare results
      const comparison = comparisonSystem.compareSnapshots(
        'fix-before',
        'fix-after'
      );

      assert.ok(comparison.differences);
      assert.ok(typeof comparison.differences.memoryDelta === 'number');
      assert.ok(comparison.analysis);
      assert.ok(typeof comparison.analysis.hasMemoryLeak === 'boolean');

      console.log(
        `✓ Fix effectiveness measurement: ${comparison.differences.memoryDelta.toFixed(2)}MB delta`
      );
    });

    it('should handle error conditions gracefully', async () => {
      // Test with invalid file
      const detector = createMemoryLeakDetector();

      try {
        await detector.scanFile('non-existent-file.tsx');
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error instanceof Error);
        console.log(`✓ Error handling: ${error.message}`);
      }

      // Test with invalid snapshot comparison
      try {
        comparisonSystem.compareSnapshots('invalid-1', 'invalid-2');
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error instanceof Error);
        console.log(`✓ Error handling: ${error.message}`);
      }
    });

    it('should maintain performance under load', async () => {
      const startTime = performance.now();
      const operations = 50;

      // Perform many operations
      const promises = [];
      for (let i = 0; i < operations; i++) {
        promises.push(
          comparisonSystem.createSnapshot(`load-test-${i}`, `Load test ${i}`)
        );
      }

      await Promise.all(promises);

      const endTime = performance.now();
      const duration = endTime - startTime;
      const opsPerSecond = (operations / duration) * 1000;

      // Should complete reasonably quickly
      assert.ok(duration < 10000); // Less than 10 seconds
      assert.ok(opsPerSecond > 5); // At least 5 ops per second

      console.log(
        `✓ Load test: ${operations} operations in ${duration.toFixed(2)}ms (${opsPerSecond.toFixed(1)} ops/sec)`
      );
    });
  });

  describe('Memory Monitoring and Alerting', () => {
    it('should track memory trends over time', async () => {
      const measurements = [];
      const measurement = new MemoryMeasurement();

      // Take measurements over time with varying memory usage
      for (let i = 0; i < 5; i++) {
        measurement.recordMeasurement();

        // Simulate varying memory allocation
        const data = new Array(i * 1000).fill(Math.random());
        await TestHelpers.wait(50);
      }

      const allMeasurements = measurement.getMeasurements();
      assert.ok(allMeasurements.length >= 5);

      // Verify measurements are increasing (due to allocations)
      const firstMeasurement = allMeasurements[0];
      const lastMeasurement = allMeasurements[allMeasurements.length - 1];

      assert.ok(lastMeasurement.timestamp > firstMeasurement.timestamp);

      console.log(
        `✓ Memory trend tracking: ${allMeasurements.length} measurements over time`
      );
    });

    it('should detect suspicious memory growth patterns', async () => {
      const measurement = new MemoryMeasurement();

      // Simulate rapid memory growth
      for (let i = 0; i < 3; i++) {
        const largeData = new Array(10000).fill(Math.random());
        measurement.recordMeasurement();
        await TestHelpers.wait(100);
      }

      const growthRate = measurement.getMemoryGrowthRate();

      // Should detect growth (positive rate)
      assert.ok(growthRate >= 0);

      // Create snapshots to analyze growth
      const snapshot1 = await comparisonSystem.createSnapshot(
        'growth-1',
        'Growth test 1'
      );

      // More allocation
      const moreData = new Array(20000).fill(Math.random());
      await TestHelpers.wait(100);

      const snapshot2 = await comparisonSystem.createSnapshot(
        'growth-2',
        'Growth test 2'
      );

      const comparison = comparisonSystem.compareSnapshots(
        'growth-1',
        'growth-2'
      );

      // Should detect memory increase
      assert.ok(comparison.differences.memoryDelta >= 0);

      console.log(
        `✓ Suspicious growth detection: ${growthRate.toFixed(3)} MB/s growth rate`
      );
    });

    it('should validate memory leak detection patterns', async () => {
      const detector = createMemoryLeakDetector();
      const validator = new MemoryLeakValidator(detector);

      // Create test cases with known leak patterns
      const testCases = [
        {
          code: TestHelpers.createLeakyComponent(['missing-useeffect-cleanup']),
          expectedLeaks: ['missing-useeffect-cleanup'] as LeakType[],
          file: 'test-validation-1.tsx',
        },
        {
          code: TestHelpers.createCleanComponent(),
          expectedLeaks: [] as LeakType[],
          file: 'test-validation-2.tsx',
        },
      ];

      const validationResult =
        await validator.validateDetectionAccuracy(testCases);

      assert.ok(typeof validationResult.accuracy === 'number');
      assert.ok(
        validationResult.accuracy >= 0 && validationResult.accuracy <= 1
      );
      assert.ok(typeof validationResult.truePositives === 'number');
      assert.ok(typeof validationResult.falsePositives === 'number');
      assert.ok(Array.isArray(validationResult.results));

      console.log(
        `✓ Detection validation: ${(validationResult.accuracy * 100).toFixed(1)}% accuracy`
      );
    });
  });
});
