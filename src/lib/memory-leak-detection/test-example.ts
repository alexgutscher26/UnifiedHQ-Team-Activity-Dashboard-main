/**
 * Example usage and basic test of the memory leak detection system
 */

import { createMemoryLeakDetector, devScan } from './index';

// Example code with memory leaks for testing
const exampleCodeWithLeaks = `
import React, { useEffect, useState } from 'react';

function LeakyComponent() {
  const [data, setData] = useState(null);

  useEffect(() => {
    // Memory leak: addEventListener without cleanup
    window.addEventListener('resize', handleResize);
    
    // Memory leak: setInterval without cleanup
    const interval = setInterval(() => {
      console.log('Polling...');
    }, 1000);
    
    // Memory leak: EventSource without close
    const eventSource = new EventSource('/api/events');
    eventSource.onmessage = (event) => {
      setData(event.data);
    };
    
    // Memory leak: setTimeout in useEffect without cleanup
    setTimeout(() => {
      console.log('Delayed action');
    }, 5000);
    
    // Missing cleanup function - this useEffect will cause memory leaks
  }, []);

  const handleResize = () => {
    console.log('Window resized');
  };

  return <div>{data}</div>;
}

export default LeakyComponent;
`;

// Example of properly cleaned up code
const exampleCodeWithoutLeaks = `
import React, { useEffect, useState } from 'react';

function CleanComponent() {
  const [data, setData] = useState(null);

  useEffect(() => {
    const handleResize = () => {
      console.log('Window resized');
    };
    
    // Proper event listener with cleanup
    window.addEventListener('resize', handleResize);
    
    // Proper interval with cleanup
    const interval = setInterval(() => {
      console.log('Polling...');
    }, 1000);
    
    // Proper EventSource with cleanup
    const eventSource = new EventSource('/api/events');
    eventSource.onmessage = (event) => {
      setData(event.data);
    };
    
    // Proper timeout with cleanup
    const timeout = setTimeout(() => {
      console.log('Delayed action');
    }, 5000);
    
    // Proper cleanup function
    return () => {
      window.removeEventListener('resize', handleResize);
      clearInterval(interval);
      eventSource.close();
      clearTimeout(timeout);
    };
  }, []);

  return <div>{data}</div>;
}

export default CleanComponent;
`;

// Test function
export async function testMemoryLeakDetection() {
  console.log('Testing Memory Leak Detection System...\n');

  try {
    // Create detector
    const detector = createMemoryLeakDetector({
      detection: {
        enableStaticAnalysis: true,
        enableRuntimeDetection: false,
        severityThreshold: 'low',
        confidenceThreshold: 0.3,
        scanPatterns: ['**/*.{ts,tsx}'],
        excludePatterns: [],
        maxFileSize: 1024 * 1024,
        timeout: 10000,
      },
    });

    console.log('1. Testing code with memory leaks...');

    // Test the static analyzer directly with leaky code
    const { StaticCodeAnalyzer } = await import('./static-analyzer');
    const analyzer = new StaticCodeAnalyzer();

    const leakyReports = await analyzer.analyzeFile(
      'test-leaky.tsx',
      exampleCodeWithLeaks
    );
    console.log(`Found ${leakyReports.length} potential memory leaks:`);

    for (const report of leakyReports) {
      console.log(
        `  - ${report.severity.toUpperCase()}: ${report.description}`
      );
      console.log(`    Line ${report.line}: ${report.suggestedFix}`);
    }

    console.log('\n2. Testing code without memory leaks...');

    const cleanReports = await analyzer.analyzeFile(
      'test-clean.tsx',
      exampleCodeWithoutLeaks
    );
    console.log(`Found ${cleanReports.length} potential memory leaks`);

    if (cleanReports.length > 0) {
      for (const report of cleanReports) {
        console.log(
          `  - ${report.severity.toUpperCase()}: ${report.description}`
        );
      }
    } else {
      console.log('  No memory leaks detected - good!');
    }

    console.log('\n3. Testing timer detection...');

    const { TimerLeakDetector } = await import('./timer-detector');
    const timerDetector = new TimerLeakDetector();

    const timerReports = await timerDetector.analyzeTimerLeaks(
      'test-timers.tsx',
      exampleCodeWithLeaks
    );
    console.log(`Found ${timerReports.length} timer-related memory leaks:`);

    for (const report of timerReports) {
      console.log(
        `  - ${report.severity.toUpperCase()}: ${report.description}`
      );
      console.log(`    Fix: ${report.suggestedFix}`);
    }

    console.log('\n4. Testing configuration system...');

    const { getConfigManager } = await import('./config');
    const configManager = getConfigManager();

    const config = configManager.getConfig();
    console.log('Current configuration:');
    console.log(
      `  - Static analysis: ${config.detection.enableStaticAnalysis}`
    );
    console.log(
      `  - Runtime detection: ${config.detection.enableRuntimeDetection}`
    );
    console.log(
      `  - Severity threshold: ${config.detection.severityThreshold}`
    );
    console.log(
      `  - Confidence threshold: ${config.detection.confidenceThreshold}`
    );

    console.log(
      '\n✅ Memory leak detection system test completed successfully!'
    );

    return {
      leakyCodeIssues: leakyReports.length,
      cleanCodeIssues: cleanReports.length,
      timerIssues: timerReports.length,
      configLoaded: true,
    };
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testMemoryLeakDetection()
    .then(results => {
      console.log('\nTest Results:', results);
    })
    .catch(error => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}
