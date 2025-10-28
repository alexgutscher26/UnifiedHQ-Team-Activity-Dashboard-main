#!/usr/bin/env node

/**
 * Code Review Tools
 * Automated tools for code review analysis and reporting
 * Cross-platform compatible (Windows & Unix)
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ReviewTools {
  constructor() {
    this.projectRoot = process.cwd();
    this.results = {
      issues: [],
      warnings: [],
      suggestions: [],
      metrics: {},
    };
    this.isWindows = process.platform === 'win32';
  }

  /**
   * Execute command with cross-platform compatibility
   */
  execCommand(command, options = {}) {
    try {
      return execSync(command, {
        encoding: 'utf8',
        shell: this.isWindows,
        ...options,
      });
    } catch (error) {
      return '';
    }
  }

  /**
   * Find files recursively (cross-platform)
   */
  findFiles(directory, extensions) {
    const files = [];

    function walkDir(dir) {
      try {
        const items = fs.readdirSync(dir);
        for (const item of items) {
          const fullPath = path.join(dir, item);
          const stat = fs.statSync(fullPath);

          if (
            stat.isDirectory() &&
            !item.startsWith('.') &&
            item !== 'node_modules'
          ) {
            walkDir(fullPath);
          } else if (stat.isFile()) {
            const ext = path.extname(item);
            if (extensions.includes(ext)) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    }

    walkDir(directory);
    return files;
  }

  /**
   * Search for pattern in files (cross-platform)
   */
  searchInFiles(files, pattern, excludePatterns = []) {
    const results = [];

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n');

        lines.forEach((line, index) => {
          if (pattern.test(line)) {
            // Check if line should be excluded
            const shouldExclude = excludePatterns.some(exclude =>
              exclude.test(line)
            );
            if (!shouldExclude) {
              results.push({
                file: file.replace(this.projectRoot + path.sep, ''),
                line: index + 1,
                content: line.trim(),
              });
            }
          }
        });
      } catch (error) {
        // Skip files we can't read
      }
    }

    return results;
  }

  /**
   * Analyze code quality issues
   */
  async analyzeCodeQuality() {
    console.log('🔍 Analyzing code quality...');

    // Check for console.log statements
    this.checkConsoleLogs();

    // Check for TODO comments
    this.checkTODOComments();

    // Check for hardcoded values
    this.checkHardcodedValues();

    // Check for unused imports
    this.checkUnusedImports();

    // Check for security issues
    this.checkSecurityIssues();

    // Check project-specific rules
    this.checkProjectRules();
  }

  /**
   * Check for console.log statements
   */
  checkConsoleLogs() {
    const files = this.findFiles(path.join(this.projectRoot, 'src'), [
      '.ts',
      '.tsx',
      '.js',
      '.jsx',
    ]);
    const results = this.searchInFiles(files, /console\.log/, [
      /\/\/ eslint-disable/,
    ]);

    results.forEach(result => {
      this.results.issues.push({
        type: 'console.log',
        message: 'Console.log statement found',
        file: result.file,
        line: result.line,
        severity: 'error',
      });
    });
  }

  /**
   * Check for TODO comments.
   *
   * This function searches through the source files for any lines containing TODO, FIXME, or HACK comments.
   * It uses cross-platform file searching to find and analyze comments in the specified file types.
   */
  checkTODOComments() {
    const files = this.findFiles(path.join(this.projectRoot, 'src'), [
      '.ts',
      '.tsx',
      '.js',
      '.jsx',
    ]);
    const results = this.searchInFiles(files, /TODO|FIXME|HACK/);

    results.forEach(result => {
      this.results.warnings.push({
        type: 'todo',
        message: 'TODO/FIXME comment found',
        file: result.file,
        line: result.line,
        severity: 'warning',
      });
    });
  }

  /**
   * Check for hardcoded values
   */
  checkHardcodedValues() {
    const files = this.findFiles(path.join(this.projectRoot, 'src'), [
      '.ts',
      '.tsx',
      '.js',
      '.jsx',
    ]);
    const results = this.searchInFiles(
      files,
      /localhost|127\.0\.0\.1|password|secret/,
      [/\/\/ eslint-disable/]
    );

    results.forEach(result => {
      this.results.warnings.push({
        type: 'hardcoded',
        message: 'Potential hardcoded value found',
        file: result.file,
        line: result.line,
        severity: 'warning',
      });
    });
  }

  /**
   * Check for unused imports
   */
  checkUnusedImports() {
    // Try to run ESLint if available (using modern config format)
    try {
      const eslintCommand = this.isWindows
        ? 'npx eslint --rule "no-unused-vars: error" --format compact src/'
        : 'npx eslint --rule "no-unused-vars: error" --format compact src/ 2>/dev/null';

      const result = this.execCommand(eslintCommand);
      if (result.trim()) {
        const lines = result.trim().split('\n');
        lines.forEach(line => {
          if (line.includes('no-unused-vars')) {
            const parts = line.split(':');
            if (parts.length >= 2) {
              this.results.warnings.push({
                type: 'unused-import',
                message: 'Unused import or variable',
                file: parts[0],
                line: parts[1],
                severity: 'warning',
              });
            }
          }
        });
      }
    } catch (error) {
      // ESLint not available or failed, skip this check
    }
  }

  /**
   * Check for security issues
   */
  checkSecurityIssues() {
    const files = this.findFiles(path.join(this.projectRoot, 'src'), [
      '.ts',
      '.tsx',
      '.js',
      '.jsx',
    ]);
    const results = this.searchInFiles(
      files,
      /eval|innerHTML|dangerouslySetInnerHTML/
    );

    results.forEach(result => {
      this.results.issues.push({
        type: 'security',
        message: 'Potential security issue found',
        file: result.file,
        line: result.line,
        severity: 'error',
      });
    });
  }

  /**
   * Check project-specific rules
   */
  checkProjectRules() {
    const files = this.findFiles(path.join(this.projectRoot, 'src'), [
      '.ts',
      '.tsx',
      '.js',
      '.jsx',
    ]);

    // Check GitHub integration usage
    const githubResults = this.searchInFiles(
      files,
      /@\/lib\/integrations\/github[^-]/
    );
    githubResults.forEach(result => {
      this.results.issues.push({
        type: 'github-integration',
        message:
          'Non-cached GitHub import found. Use @/lib/integrations/github-cached instead',
        file: result.file,
        line: result.line,
        severity: 'error',
      });
    });

    // Check image optimization usage
    const imageFiles = this.findFiles(path.join(this.projectRoot, 'src'), [
      '.tsx',
      '.jsx',
    ]);
    const imageResults = this.searchInFiles(imageFiles, /<img/);
    imageResults.forEach(result => {
      this.results.suggestions.push({
        type: 'image-optimization',
        message:
          'Consider using OptimizedImage component instead of standard img tag',
        file: result.file,
        line: result.line,
        severity: 'suggestion',
      });
    });
  }

  /**
   * Calculate code metrics
   */
  calculateMetrics() {
    console.log('📊 Calculating code metrics...');

    try {
      const files = this.findFiles(path.join(this.projectRoot, 'src'), [
        '.ts',
        '.tsx',
        '.js',
        '.jsx',
      ]);

      let totalLines = 0;
      let functionCount = 0;

      files.forEach(file => {
        try {
          const content = fs.readFileSync(file, 'utf8');
          const lines = content.split('\n');
          totalLines += lines.length;

          // Count functions and arrow functions
          lines.forEach(line => {
            if (
              /function\s+\w+|const\s+\w+\s*=\s*\(.*\)\s*=>|const\s+\w+\s*=\s*async\s*\(.*\)\s*=>/.test(
                line
              )
            ) {
              functionCount++;
            }
          });
        } catch (error) {
          // Skip files we can't read
        }
      });

      this.results.metrics = {
        files: files.length,
        lines: totalLines,
        functions: functionCount,
      };
    } catch (error) {
      console.error('Error calculating metrics:', error.message);
      this.results.metrics = {
        files: 0,
        lines: 0,
        functions: 0,
      };
    }
  }

  /**
   * Generate review report
   */
  generateReport() {
    console.log('📝 Generating review report...');

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalIssues: this.results.issues.length,
        totalWarnings: this.results.warnings.length,
        totalSuggestions: this.results.suggestions.length,
        metrics: this.results.metrics,
      },
      issues: this.results.issues,
      warnings: this.results.warnings,
      suggestions: this.results.suggestions,
    };

    // Save report to file
    const reportPath = path.join(this.projectRoot, 'review-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Generate markdown report
    const markdownReport = this.generateMarkdownReport(report);
    const markdownPath = path.join(this.projectRoot, 'review-report.md');
    fs.writeFileSync(markdownPath, markdownReport);

    console.log(`📄 Report saved to: ${reportPath}`);
    console.log(`📄 Markdown report saved to: ${markdownPath}`);

    return report;
  }

  /**
   * Generate markdown report
   */
  generateMarkdownReport(report) {
    let markdown = `# 🔍 Code Review Report\n\n`;
    markdown += `**Generated:** ${report.timestamp}\n\n`;

    markdown += `## 📊 Summary\n\n`;
    markdown += `- **Issues:** ${report.summary.totalIssues}\n`;
    markdown += `- **Warnings:** ${report.summary.totalWarnings}\n`;
    markdown += `- **Suggestions:** ${report.summary.totalSuggestions}\n\n`;

    markdown += `## 📈 Metrics\n\n`;
    markdown += `- **Files:** ${report.summary.metrics.files}\n`;
    markdown += `- **Lines:** ${report.summary.metrics.lines}\n`;
    markdown += `- **Functions:** ${report.summary.metrics.functions}\n\n`;

    if (report.issues.length > 0) {
      markdown += `## ❌ Issues\n\n`;
      report.issues.forEach(issue => {
        markdown += `- **${issue.type}** in \`${issue.file}:${issue.line}\`\n`;
        markdown += `  - ${issue.message}\n\n`;
      });
    }

    if (report.warnings.length > 0) {
      markdown += `## ⚠️ Warnings\n\n`;
      report.warnings.forEach(warning => {
        markdown += `- **${warning.type}** in \`${warning.file}:${warning.line}\`\n`;
        markdown += `  - ${warning.message}\n\n`;
      });
    }

    if (report.suggestions.length > 0) {
      markdown += `## 💡 Suggestions\n\n`;
      report.suggestions.forEach(suggestion => {
        markdown += `- **${suggestion.type}** in \`${suggestion.file}:${suggestion.line}\`\n`;
        markdown += `  - ${suggestion.message}\n\n`;
      });
    }

    return markdown;
  }

  /**
   * Run all analysis
   */
  async run() {
    console.log('🚀 Starting code review analysis...');

    await this.analyzeCodeQuality();
    this.calculateMetrics();
    const report = this.generateReport();

    console.log('✅ Analysis complete!');
    console.log(
      `📊 Found ${report.summary.totalIssues} issues, ${report.summary.totalWarnings} warnings, ${report.summary.totalSuggestions} suggestions`
    );

    return report;
  }
}

// Run if called directly
if (
  import.meta.url === `file://${process.argv[1]}` ||
  import.meta.url.endsWith('review-tools.js')
) {
  const reviewTools = new ReviewTools();
  reviewTools.run().catch(console.error);
}

export default ReviewTools;
