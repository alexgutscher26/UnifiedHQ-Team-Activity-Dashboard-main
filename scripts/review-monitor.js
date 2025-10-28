#!/usr/bin/env node

/**
 * Review Monitor
 * Monitors code review metrics and generates reports
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class ReviewMonitor {
  constructor() {
    this.projectRoot = process.cwd();
    this.metrics = {
      prs: [],
      reviews: [],
      reviewers: new Map(),
      timeline: [],
    };
  }

  /**
   * Analyze PR data
   */
  async analyzePRs() {
    console.log('📊 Analyzing PR data...');

    try {
      // Get PR data from git log
      const prData = execSync(
        'git log --oneline --grep="Merge pull request" --since="30 days ago"',
        { encoding: 'utf8' }
      );
      const prs = prData
        .trim()
        .split('\n')
        .filter(line => line);

      this.metrics.prs = prs
        .map(pr => {
          const match = pr.match(/Merge pull request #(\d+)/);
          return match ? parseInt(match[1]) : null;
        })
        .filter(id => id);

      console.log(
        `Found ${this.metrics.prs.length} merged PRs in the last 30 days`
      );
    } catch (error) {
      console.error('Error analyzing PRs:', error.message);
    }
  }

  /**
   * Calculate review metrics
   */
  calculateMetrics() {
    console.log('📈 Calculating review metrics...');

    const now = new Date();
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Calculate basic metrics
    const weeklyPRs = this.metrics.prs.filter(pr => {
      // This is a simplified calculation - in a real scenario, you'd get actual PR dates
      return true; // Placeholder
    });

    const monthlyPRs = this.metrics.prs;

    this.metrics.summary = {
      weekly: {
        prs: weeklyPRs.length,
        reviews: 0, // Would need actual review data
        avgReviewTime: 0,
      },
      monthly: {
        prs: monthlyPRs.length,
        reviews: 0,
        avgReviewTime: 0,
      },
      total: {
        prs: this.metrics.prs.length,
        reviews: 0,
        avgReviewTime: 0,
      },
    };
  }

  /**
   * Generate review report
   */
  generateReport() {
    console.log('📝 Generating review report...');

    const report = {
      timestamp: new Date().toISOString(),
      metrics: this.metrics.summary,
      recommendations: this.generateRecommendations(),
      trends: this.analyzeTrends(),
    };

    // Save report
    const reportPath = path.join(this.projectRoot, 'review-metrics.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Generate markdown report
    const markdownReport = this.generateMarkdownReport(report);
    const markdownPath = path.join(this.projectRoot, 'review-metrics.md');
    fs.writeFileSync(markdownPath, markdownReport);

    console.log(`📄 Metrics saved to: ${reportPath}`);
    console.log(`📄 Markdown report saved to: ${markdownPath}`);

    return report;
  }

  /**
   * Generate recommendations
   */
  generateRecommendations() {
    const recommendations = [];

    // Review time recommendations
    if (this.metrics.summary.weekly.avgReviewTime > 2) {
      recommendations.push({
        type: 'review_time',
        priority: 'high',
        message:
          'Average review time is high. Consider assigning more reviewers or reducing PR size.',
        action: 'Assign additional reviewers or break down large PRs',
      });
    }

    // PR volume recommendations
    if (this.metrics.summary.weekly.prs > 20) {
      recommendations.push({
        type: 'pr_volume',
        priority: 'medium',
        message:
          'High PR volume detected. Consider implementing PR size limits.',
        action: 'Set up PR size monitoring and limits',
      });
    }

    // Reviewer distribution recommendations
    if (this.metrics.reviewers.size < 3) {
      recommendations.push({
        type: 'reviewer_distribution',
        priority: 'medium',
        message:
          'Limited number of active reviewers. Consider training more team members.',
        action: 'Identify and train additional reviewers',
      });
    }

    return recommendations;
  }

  /**
   * Analyze trends
   */
  analyzeTrends() {
    // This would analyze historical data to identify trends
    // For now, return placeholder data
    return {
      pr_volume: 'stable',
      review_time: 'improving',
      reviewer_activity: 'consistent',
    };
  }

  /**
   * Generate markdown report
   */
  generateMarkdownReport(report) {
    let markdown = `# 📊 Review Metrics Report\n\n`;
    markdown += `**Generated:** ${report.timestamp}\n\n`;

    markdown += `## 📈 Summary\n\n`;
    markdown += `### Weekly Metrics\n`;
    markdown += `- **PRs:** ${report.metrics.weekly.prs}\n`;
    markdown += `- **Reviews:** ${report.metrics.weekly.reviews}\n`;
    markdown += `- **Avg Review Time:** ${report.metrics.weekly.avgReviewTime} days\n\n`;

    markdown += `### Monthly Metrics\n`;
    markdown += `- **PRs:** ${report.metrics.monthly.prs}\n`;
    markdown += `- **Reviews:** ${report.metrics.monthly.reviews}\n`;
    markdown += `- **Avg Review Time:** ${report.metrics.monthly.avgReviewTime} days\n\n`;

    if (report.recommendations.length > 0) {
      markdown += `## 💡 Recommendations\n\n`;
      report.recommendations.forEach(rec => {
        const priority =
          rec.priority === 'high'
            ? '🔴'
            : rec.priority === 'medium'
              ? '🟡'
              : '🟢';
        markdown += `### ${priority} ${rec.type}\n`;
        markdown += `**Message:** ${rec.message}\n\n`;
        markdown += `**Action:** ${rec.action}\n\n`;
      });
    }

    markdown += `## 📊 Trends\n\n`;
    markdown += `- **PR Volume:** ${report.trends.pr_volume}\n`;
    markdown += `- **Review Time:** ${report.trends.review_time}\n`;
    markdown += `- **Reviewer Activity:** ${report.trends.reviewer_activity}\n\n`;

    return markdown;
  }

  /**
   * Run monitoring
   */
  async run() {
    console.log('🚀 Starting review monitoring...');

    await this.analyzePRs();
    this.calculateMetrics();
    const report = this.generateReport();

    console.log('✅ Monitoring complete!');
    console.log(
      `📊 Generated report with ${report.recommendations.length} recommendations`
    );

    return report;
  }
}

// Run if called directly
if (require.main === module) {
  const monitor = new ReviewMonitor();
  monitor.run().catch(console.error);
}

module.exports = ReviewMonitor;
