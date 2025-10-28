#!/usr/bin/env node

/**
 * Performance monitoring script for activity feeds
 * Monitors render times, memory usage, and user interactions
 */

const fs = require('fs');
const path = require('path');

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      renderTimes: [],
      memoryUsage: [],
      scrollEvents: [],
      userInteractions: [],
      errors: [],
    };
    this.startTime = Date.now();
  }

  /**
   * Record render time for a component
   */
  recordRenderTime(componentName, renderTime, itemCount) {
    const metric = {
      timestamp: Date.now(),
      component: componentName,
      renderTime,
      itemCount,
      memoryUsage: this.getMemoryUsage(),
    };

    this.metrics.renderTimes.push(metric);
    console.log(
      `📊 ${componentName}: ${renderTime.toFixed(2)}ms (${itemCount} items)`
    );
  }

  /**
   * Record memory usage
   */
  recordMemoryUsage() {
    const usage = this.getMemoryUsage();
    this.metrics.memoryUsage.push({
      timestamp: Date.now(),
      usage,
    });
    console.log(`🧠 Memory: ${usage.toFixed(2)}MB`);
  }

  /**
   * Record scroll performance
   */
  recordScrollEvent(scrollTime, scrollDistance) {
    const scrollEvent = {
      timestamp: Date.now(),
      scrollTime,
      scrollDistance,
    };

    this.metrics.scrollEvents.push(scrollEvent);

    // Track scroll jank (events that take >16ms)
    if (scrollTime > 16) {
      this.metrics.scrollJank = (this.metrics.scrollJank || 0) + 1;
    }

    console.log(`📜 Scroll: ${scrollTime.toFixed(2)}ms (${scrollDistance}px)`);
  }

  /**
   * Record user interaction
   */
  recordUserInteraction(action, duration) {
    this.metrics.userInteractions.push({
      timestamp: Date.now(),
      action,
      duration,
    });
  }

  /**
   * Record error
   */
  recordError(error, context) {
    this.metrics.errors.push({
      timestamp: Date.now(),
      error: error.message,
      context,
      stack: error.stack,
    });
    console.error(`❌ Error in ${context}:`, error.message);
  }

  /**
   * Get current memory usage
   */
  getMemoryUsage() {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed / 1024 / 1024; // MB
    }
    return 0;
  }

  /**
   * Generate performance report
   */
  generateReport() {
    const report = {
      summary: this.generateSummary(),
      details: this.metrics,
      recommendations: this.generateRecommendations(),
      timestamp: new Date().toISOString(),
    };

    return report;
  }

  /**
   * Generate performance summary
   */
  generateSummary() {
    const renderTimes = this.metrics.renderTimes.map(m => m.renderTime);
    const memoryUsages = this.metrics.memoryUsage.map(m => m.usage);
    const scrollTimes = this.metrics.scrollEvents.map(m => m.scrollTime);

    return {
      totalRenderTime: renderTimes.reduce((a, b) => a + b, 0),
      averageRenderTime:
        renderTimes.length > 0
          ? renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length
          : 0,
      maxRenderTime: Math.max(...renderTimes, 0),
      minRenderTime: Math.min(...renderTimes, Infinity),
      averageMemoryUsage:
        memoryUsages.length > 0
          ? memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length
          : 0,
      maxMemoryUsage: Math.max(...memoryUsages, 0),
      averageScrollTime:
        scrollTimes.length > 0
          ? scrollTimes.reduce((a, b) => a + b, 0) / scrollTimes.length
          : 0,
      maxScrollTime: Math.max(...scrollTimes, 0),
      scrollJank: this.metrics.scrollJank || 0,
      totalScrollEvents: this.metrics.scrollEvents.length,
      totalUserInteractions: this.metrics.userInteractions.length,
      totalErrors: this.metrics.errors.length,
      sessionDuration: Date.now() - this.startTime,
    };
  }

  /**
   * Generate performance recommendations
   */
  generateRecommendations() {
    const summary = this.generateSummary();
    const recommendations = [];

    if (summary.averageRenderTime > 100) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        issue: 'High render times detected',
        recommendation:
          'Consider implementing virtual scrolling or React.memo for large lists',
        impact: 'Poor user experience with slow rendering',
      });
    }

    if (summary.averageMemoryUsage > 100) {
      recommendations.push({
        type: 'memory',
        priority: 'high',
        issue: 'High memory usage detected',
        recommendation: 'Implement memory cleanup and optimize data structures',
        impact: 'Potential memory leaks and browser crashes',
      });
    }

    if (summary.averageScrollTime > 16) {
      recommendations.push({
        type: 'scroll',
        priority: 'medium',
        issue: 'Slow scroll performance',
        recommendation:
          'Implement scroll throttling and optimize scroll handlers',
        impact: 'Janky scrolling experience',
      });
    }

    if (summary.totalErrors > 0) {
      recommendations.push({
        type: 'stability',
        priority: 'high',
        issue: 'Errors detected during monitoring',
        recommendation:
          'Review error logs and implement proper error boundaries',
        impact: 'Application crashes and poor user experience',
      });
    }

    if (summary.totalUserInteractions > 1000) {
      recommendations.push({
        type: 'optimization',
        priority: 'low',
        issue: 'High user interaction volume',
        recommendation: 'Consider implementing interaction debouncing',
        impact: 'Potential performance impact from excessive event handling',
      });
    }

    return recommendations;
  }

  /**
   * Save report to file
   */
  saveReport(filename = 'performance-report.json') {
    const report = this.generateReport();
    const reportPath = path.join(process.cwd(), 'reports', filename);

    // Ensure reports directory exists
    const reportsDir = path.dirname(reportPath);
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Performance report saved to: ${reportPath}`);
    return reportPath;
  }

  /**
   * Print performance summary to console
   */
  printSummary() {
    const summary = this.generateSummary();
    const recommendations = this.generateRecommendations();

    console.log('\n📊 Performance Summary');
    console.log('='.repeat(50));
    console.log(
      `Session Duration: ${(summary.sessionDuration / 1000).toFixed(2)}s`
    );
    console.log(
      `Average Render Time: ${summary.averageRenderTime.toFixed(2)}ms`
    );
    console.log(`Max Render Time: ${summary.maxRenderTime.toFixed(2)}ms`);
    console.log(
      `Average Memory Usage: ${summary.averageMemoryUsage.toFixed(2)}MB`
    );
    console.log(`Max Memory Usage: ${summary.maxMemoryUsage.toFixed(2)}MB`);
    console.log(`Total Scroll Events: ${summary.totalScrollEvents}`);
    console.log(`Total User Interactions: ${summary.totalUserInteractions}`);
    console.log(`Total Errors: ${summary.totalErrors}`);

    if (recommendations.length > 0) {
      console.log('\n💡 Recommendations');
      console.log('='.repeat(50));
      recommendations.forEach((rec, index) => {
        const priority =
          rec.priority === 'high'
            ? '🔴'
            : rec.priority === 'medium'
              ? '🟡'
              : '🟢';
        console.log(`${index + 1}. ${priority} ${rec.issue}`);
        console.log(`   Recommendation: ${rec.recommendation}`);
        console.log(`   Impact: ${rec.impact}\n`);
      });
    }
  }
}

// CLI interface
if (require.main === module) {
  const monitor = new PerformanceMonitor();

  console.log('🚀 Starting performance monitoring...');
  console.log('Press Ctrl+C to stop and generate report\n');

  // Simulate some performance monitoring
  const simulateMonitoring = () => {
    // Simulate render times
    const renderTime = Math.random() * 200 + 10;
    const itemCount = Math.floor(Math.random() * 1000) + 10;
    monitor.recordRenderTime('ActivityFeed', renderTime, itemCount);

    // Simulate memory usage
    monitor.recordMemoryUsage();

    // Simulate scroll events
    if (Math.random() > 0.7) {
      const scrollTime = Math.random() * 20 + 5;
      monitor.recordScrollEvent(scrollTime, Math.random() * 100);
    }

    // Simulate user interactions
    if (Math.random() > 0.8) {
      const actions = ['click', 'scroll', 'search', 'filter'];
      const action = actions[Math.floor(Math.random() * actions.length)];
      monitor.recordUserInteraction(action, Math.random() * 100);
    }

    // Simulate errors
    if (Math.random() > 0.95) {
      const error = new Error('Simulated error for testing');
      monitor.recordError(error, 'ActivityFeed');
    }
  };

  // Run simulation every 2 seconds
  const interval = setInterval(simulateMonitoring, 2000);

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping performance monitoring...');
    clearInterval(interval);

    monitor.printSummary();
    monitor.saveReport();

    process.exit(0);
  });
}

module.exports = PerformanceMonitor;
