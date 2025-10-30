/**
 * Comprehensive Workflow Test Runner
 *
 * This script provides a unified interface for running all workflow tests,
 * validations, and requirements checks. It integrates all testing utilities
 * into a single comprehensive testing suite.
 */

import { execSync, spawn } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { program } from 'commander';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

class WorkflowTestRunner {
  constructor() {
    this.scriptsDir = join(rootDir, 'scripts');
    this.reportsDir = join(rootDir, 'reports');
    this.testResults = {};
  }

  /**
   * Ensure reports directory exists
   */
  ensureReportsDir() {
    if (!existsSync(this.reportsDir)) {
      require('fs').mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  /**
   * Run a script and capture output.
   *
   * This function constructs the full path of the script using the provided scriptName and the scriptsDir.
   * It checks if the script exists, throwing an error if not. Upon execution, it logs the script name and
   * arguments, then attempts to run the script using execSync. The output and any errors are captured and
   * returned in a structured format, indicating success or failure.
   *
   * @param {string} scriptName - The name of the script to run.
   * @param {Array} [args=[]] - The arguments to pass to the script.
   * @param {Object} [options={}] - Options for script execution, including silent mode.
   */
  async runScript(scriptName, args = [], options = {}) {
    const scriptPath = join(this.scriptsDir, scriptName);

    if (!existsSync(scriptPath)) {
      throw new Error(`Script not found: ${scriptPath}`);
    }

    console.log(`\n🚀 Running ${scriptName} ${args.join(' ')}`);
    console.log('─'.repeat(50));

    try {
      const result = execSync(`node "${scriptPath}" ${args.join(' ')}`, {
        cwd: rootDir,
        encoding: 'utf8',
        stdio: options.silent ? 'pipe' : 'inherit',
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
      });

      return {
        success: true,
        output: result,
        error: null,
      };
    } catch (error) {
      return {
        success: false,
        output: error.stdout || '',
        error: error.stderr || error.message,
      };
    }
  }

  /**
   * Run workflow syntax validation.
   *
   * This function initiates the syntax validation process for workflows by executing the 'workflow-validate.js' script with specific arguments. It logs the results of the validation, including the total, valid, and invalid workflows. If the validation is successful, it updates the testResults with the validation data; otherwise, it logs an error message. The function handles JSON parsing of the validation output and returns a boolean indicating whether there are any invalid workflows.
   */
  async runSyntaxValidation() {
    console.log('\n📋 Step 1: Workflow Syntax Validation');
    console.log('='.repeat(60));

    const result = await this.runScript(
      'workflow-validate.js',
      ['validate', '--all', '--json'],
      { silent: true }
    );

    if (result.success) {
      try {
        const validation = JSON.parse(result.output);
        this.testResults.syntaxValidation = validation;

        console.log('✅ Syntax validation completed');
        console.log(`   Total workflows: ${validation.summary.total}`);
        console.log(`   Valid workflows: ${validation.summary.valid}`);
        console.log(`   Invalid workflows: ${validation.summary.invalid}`);

        return validation.summary.invalid === 0;
      } catch (error) {
        console.error('❌ Failed to parse validation results:', error.message);
        return false;
      }
    } else {
      console.error('❌ Syntax validation failed:', result.error);
      return false;
    }
  }

  /**
   * Run requirements validation.
   *
   * This function executes a script to validate workflow requirements and logs the results. It first runs the 'workflow-requirements-validator.js' script with specific arguments. If the script executes successfully, it parses the JSON output and updates the testResults with the validation data. The function checks if the pass rate meets a threshold of 80% and logs relevant information about the validation process.
   */
  async runRequirementsValidation() {
    console.log('\n📋 Step 2: Requirements Validation');
    console.log('='.repeat(60));

    const result = await this.runScript(
      'workflow-requirements-validator.js',
      ['validate', '--json'],
      { silent: true }
    );

    if (result.success) {
      try {
        const validation = JSON.parse(result.output);
        this.testResults.requirementsValidation = validation;

        console.log('✅ Requirements validation completed');
        console.log(`   Pass rate: ${validation.summary.passRate}%`);
        console.log(
          `   Passed criteria: ${validation.summary.passedCriteria}/${validation.summary.totalCriteria}`
        );

        return validation.summary.passRate >= 80; // 80% pass rate threshold
      } catch (error) {
        console.error(
          '❌ Failed to parse requirements validation results:',
          error.message
        );
        return false;
      }
    } else {
      console.error('❌ Requirements validation failed:', result.error);
      return false;
    }
  }

  /**
   * Run workflow configuration tests.
   *
   * This function executes the workflow configuration tests by running a script named 'workflow-test.js' with specific arguments.
   * It processes the results, logging the status of the tests and storing the configuration test results.
   * If the tests are successful, it checks the validity of the workflows and returns a boolean indicating if there are any invalid workflows.
   * In case of errors during execution or parsing, appropriate error messages are logged.
   */
  async runConfigurationTests() {
    console.log('\n📋 Step 3: Workflow Configuration Tests');
    console.log('='.repeat(60));

    const result = await this.runScript(
      'workflow-test.js',
      ['report', '--json'],
      { silent: true }
    );

    if (result.success) {
      try {
        const report = JSON.parse(result.output);
        this.testResults.configurationTests = report;

        console.log('✅ Configuration tests completed');
        console.log(`   Act installed: ${report.actInstalled ? '✅' : '❌'}`);
        console.log(`   Total workflows: ${report.summary.total}`);
        console.log(`   Valid workflows: ${report.summary.valid}`);

        return report.summary.invalid === 0;
      } catch (error) {
        console.error(
          '❌ Failed to parse configuration test results:',
          error.message
        );
        return false;
      }
    } else {
      console.error('❌ Configuration tests failed:', result.error);
      return false;
    }
  }

  /**
   * Run local workflow tests with act (if available)
   */
  async runLocalTests(workflowName = null) {
    console.log('\n📋 Step 4: Local Workflow Tests (act)');
    console.log('='.repeat(60));

    // Check if act is installed
    try {
      execSync('act --version', { stdio: 'pipe' });
    } catch (error) {
      console.log('⚠️  act tool not installed - skipping local tests');
      console.log('   Install act: https://github.com/nektos/act');
      this.testResults.localTests = {
        skipped: true,
        reason: 'act not installed',
      };
      return true; // Don't fail the overall test suite
    }

    const testResults = [];

    if (workflowName) {
      // Test specific workflow
      const result = await this.runScript(
        'workflow-test.js',
        ['test', workflowName, '--dry-run'],
        { silent: false }
      );
      testResults.push({
        workflow: workflowName,
        success: result.success,
        output: result.output,
        error: result.error,
      });
    } else {
      // Test key workflows
      const keyWorkflows = ['ci.yml', 'security.yml', 'deploy-staging.yml'];

      for (const workflow of keyWorkflows) {
        console.log(`\n🧪 Testing ${workflow}...`);
        const result = await this.runScript(
          'workflow-test.js',
          ['test', workflow, '--dry-run'],
          { silent: true }
        );
        testResults.push({
          workflow,
          success: result.success,
          output: result.output,
          error: result.error,
        });

        if (result.success) {
          console.log(`   ✅ ${workflow} test passed`);
        } else {
          console.log(`   ❌ ${workflow} test failed`);
        }
      }
    }

    this.testResults.localTests = {
      results: testResults,
      totalTests: testResults.length,
      passedTests: testResults.filter(r => r.success).length,
    };

    const allPassed = testResults.every(r => r.success);
    console.log(`\n${allPassed ? '✅' : '❌'} Local tests completed`);
    console.log(
      `   Passed: ${this.testResults.localTests.passedTests}/${this.testResults.localTests.totalTests}`
    );

    return allPassed;
  }

  /**
   * Generate comprehensive test report.
   *
   * This function constructs a detailed report based on the results of various test validations. It calculates the number of passed steps by evaluating the results of syntax validation, requirements validation, configuration tests, and local tests. Additionally, it generates recommendations based on the outcomes of these tests to guide improvements.
   *
   * @returns An object containing the report with a timestamp, summary of test results, and recommendations for improvements.
   */
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalSteps: 4,
        passedSteps: 0,
        overallSuccess: false,
      },
      results: this.testResults,
      recommendations: [],
    };

    // Calculate passed steps
    if (this.testResults.syntaxValidation?.summary?.invalid === 0) {
      report.summary.passedSteps++;
    }

    if (this.testResults.requirementsValidation?.summary?.passRate >= 80) {
      report.summary.passedSteps++;
    }

    if (this.testResults.configurationTests?.summary?.invalid === 0) {
      report.summary.passedSteps++;
    }

    if (
      this.testResults.localTests?.skipped ||
      this.testResults.localTests?.passedTests ===
        this.testResults.localTests?.totalTests
    ) {
      report.summary.passedSteps++;
    }

    report.summary.overallSuccess =
      report.summary.passedSteps === report.summary.totalSteps;

    // Generate recommendations
    if (this.testResults.syntaxValidation?.summary?.invalid > 0) {
      report.recommendations.push(
        'Fix workflow syntax errors before proceeding'
      );
    }

    if (this.testResults.requirementsValidation?.summary?.passRate < 80) {
      report.recommendations.push(
        'Improve workflow coverage to meet more requirements'
      );
    }

    if (!this.testResults.configurationTests?.actInstalled) {
      report.recommendations.push(
        'Install act tool for local workflow testing'
      );
    }

    if (
      this.testResults.localTests?.passedTests <
      this.testResults.localTests?.totalTests
    ) {
      report.recommendations.push('Fix failing local workflow tests');
    }

    return report;
  }

  /**
   * Saves a report to a specified file.
   */
  saveReport(report, filename = 'comprehensive-workflow-test-report.json') {
    this.ensureReportsDir();
    const reportPath = join(this.reportsDir, filename);

    try {
      writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`\n📊 Comprehensive report saved to: ${reportPath}`);
      return reportPath;
    } catch (error) {
      console.error('❌ Failed to save report:', error.message);
      return null;
    }
  }

  /**
   * Print summary results of the test report.
   *
   * This function logs a detailed summary of the test results, including overall success, steps passed, and recommendations if available. It also evaluates and displays the status of syntax validation, requirements validation, configuration tests, and local tests, providing visual indicators for each status.
   *
   * @param report - The test report object containing summary and test results.
   */
  printSummary(report) {
    console.log('\n🎯 Test Summary');
    console.log('='.repeat(60));
    console.log(
      `Overall result: ${report.summary.overallSuccess ? '✅ PASSED' : '❌ FAILED'}`
    );
    console.log(
      `Steps passed: ${report.summary.passedSteps}/${report.summary.totalSteps}`
    );

    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach(rec => {
        console.log(`   • ${rec}`);
      });
    }

    console.log('\n📋 Detailed Results:');

    // Syntax validation
    const syntaxStatus =
      this.testResults.syntaxValidation?.summary?.invalid === 0 ? '✅' : '❌';
    console.log(`   ${syntaxStatus} Syntax Validation`);

    // Requirements validation
    const reqsStatus =
      this.testResults.requirementsValidation?.summary?.passRate >= 80
        ? '✅'
        : '❌';
    const reqsRate =
      this.testResults.requirementsValidation?.summary?.passRate || 0;
    console.log(`   ${reqsStatus} Requirements Validation (${reqsRate}%)`);

    // Configuration tests
    const configStatus =
      this.testResults.configurationTests?.summary?.invalid === 0 ? '✅' : '❌';
    console.log(`   ${configStatus} Configuration Tests`);

    // Local tests
    let localStatus = '✅';
    if (this.testResults.localTests?.skipped) {
      localStatus = '⚠️ ';
    } else if (
      this.testResults.localTests?.passedTests <
      this.testResults.localTests?.totalTests
    ) {
      localStatus = '❌';
    }
    console.log(
      `   ${localStatus} Local Tests ${this.testResults.localTests?.skipped ? '(skipped)' : ''}`
    );
  }

  /**
   * Run all tests
   */
  async runAllTests(options = {}) {
    console.log('🧪 Comprehensive Workflow Testing Suite');
    console.log('='.repeat(60));
    console.log(`Started: ${new Date().toISOString()}`);

    const results = {
      syntaxValidation: false,
      requirementsValidation: false,
      configurationTests: false,
      localTests: false,
    };

    try {
      // Step 1: Syntax validation
      results.syntaxValidation = await this.runSyntaxValidation();

      // Step 2: Requirements validation
      results.requirementsValidation = await this.runRequirementsValidation();

      // Step 3: Configuration tests
      results.configurationTests = await this.runConfigurationTests();

      // Step 4: Local tests (if enabled)
      if (!options.skipLocal) {
        results.localTests = await this.runLocalTests(options.workflow);
      } else {
        console.log('\n📋 Step 4: Local Workflow Tests (skipped)');
        this.testResults.localTests = {
          skipped: true,
          reason: 'user requested skip',
        };
        results.localTests = true;
      }

      // Generate and save report
      const report = this.generateReport();

      if (options.save !== false) {
        this.saveReport(report);
      }

      // Print summary
      this.printSummary(report);

      return report.summary.overallSuccess;
    } catch (error) {
      console.error('\n❌ Test suite failed with error:', error.message);
      return false;
    }
  }
}

// CLI Interface
program
  .name('workflow-test-runner')
  .description('Comprehensive workflow testing suite')
  .version('1.0.0');

program
  .command('test')
  .description('Run comprehensive workflow tests')
  .option('--skip-local', 'Skip local act tests')
  .option('--workflow <name>', 'Test specific workflow only')
  .option('--no-save', 'Do not save report to file')
  .action(async options => {
    const runner = new WorkflowTestRunner();
    const success = await runner.runAllTests(options);
    process.exit(success ? 0 : 1);
  });

program
  .command('syntax')
  .description('Run syntax validation only')
  .action(async () => {
    const runner = new WorkflowTestRunner();
    const success = await runner.runSyntaxValidation();
    process.exit(success ? 0 : 1);
  });

program
  .command('requirements')
  .description('Run requirements validation only')
  .action(async () => {
    const runner = new WorkflowTestRunner();
    const success = await runner.runRequirementsValidation();
    process.exit(success ? 0 : 1);
  });

program
  .command('local')
  .description('Run local tests only')
  .argument('[workflow]', 'Specific workflow to test')
  .action(async workflow => {
    const runner = new WorkflowTestRunner();
    const success = await runner.runLocalTests(workflow);
    process.exit(success ? 0 : 1);
  });

program
  .command('setup')
  .description('Setup testing environment')
  .action(async () => {
    console.log('🔧 Setting up workflow testing environment...');

    const runner = new WorkflowTestRunner();
    runner.ensureReportsDir();

    // Setup act configuration
    const setupResult = await runner.runScript('workflow-test.js', ['setup']);

    if (setupResult.success) {
      console.log('✅ Testing environment setup completed');
      console.log('\n📋 Next steps:');
      console.log('   1. Install act tool: https://github.com/nektos/act');
      console.log('   2. Run: bun run workflow:test-local');
      console.log(
        '   3. Run full test suite: node scripts/workflow-test-runner.js test'
      );
    } else {
      console.error('❌ Setup failed:', setupResult.error);
      process.exit(1);
    }
  });

// Handle no command
if (process.argv.length === 2) {
  program.help();
}

program.parse();
