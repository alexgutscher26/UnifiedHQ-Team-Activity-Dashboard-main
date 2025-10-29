#!/usr/bin/env node

/**
 * Comprehensive Workflow Test Runner
 *
 * This script provides a unified interface for running all workflow tests,
 * validations, and requirements checks. It integrates all testing utilities
 * into a single comprehensive testing suite.
 */

import { execSync, spawn } from 'child_process'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { program } from 'commander'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

class WorkflowTestRunner {
  constructor () {
    this.scriptsDir = join(rootDir, 'scripts')
    this.reportsDir = join(rootDir, 'reports')
    this.testResults = {}
  }

  /**
   * Ensure the reports directory exists.
   */
  ensureReportsDir () {
    if (!existsSync(this.reportsDir)) {
      require('fs').mkdirSync(this.reportsDir, { recursive: true })
    }
  }

  /**
   * Run a script and capture output
   */
  async runScript (scriptName, args = [], options = {}) {
    const scriptPath = join(this.scriptsDir, scriptName)

    if (!existsSync(scriptPath)) {
      throw new Error(`Script not found: ${scriptPath}`)
    }

    console.log(`\n🚀 Running ${scriptName} ${args.join(' ')}`)
    console.log('─'.repeat(50))

    try {
      const result = execSync(`node "${scriptPath}" ${args.join(' ')}`, {
        cwd: rootDir,
        encoding: 'utf8',
        stdio: options.silent ? 'pipe' : 'inherit',
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      })

      return {
        success: true,
        output: result,
        error: null
      }
    } catch (error) {
      return {
        success: false,
        output: error.stdout || '',
        error: error.stderr || error.message
      }
    }
  }

  /**
   * Run workflow syntax validation
   */
  async runSyntaxValidation () {
    console.log('\n📋 Step 1: Workflow Syntax Validation')
    console.log('='.repeat(60))

    const result = await this.runScript(
      'workflow-validate.js',
      ['validate', '--all', '--json'],
      { silent: true }
    )

    if (result.success) {
      try {
        const validation = JSON.parse(result.output)
        this.testResults.syntaxValidation = validation

        console.log('✅ Syntax validation completed')
        console.log(`   Total workflows: ${validation.summary.total}`)
        console.log(`   Valid workflows: ${validation.summary.valid}`)
        console.log(`   Invalid workflows: ${validation.summary.invalid}`)

        return validation.summary.invalid === 0
      } catch (error) {
        console.error('❌ Failed to parse validation results:', error.message)
        return false
      }
    } else {
      console.error('❌ Syntax validation failed:', result.error)
      return false
    }
  }

  /**
   * Run requirements validation.
   *
   * This function executes a script to validate workflow requirements and logs the results. It first runs the 'workflow-requirements-validator.js' script with specific arguments. If the script executes successfully, it parses the JSON output to extract validation results and logs the pass rate and criteria. The function returns true if the pass rate meets or exceeds 80%, otherwise it returns false. In case of errors during parsing or script execution, appropriate error messages are logged.
   */
  async runRequirementsValidation () {
    console.log('\n📋 Step 2: Requirements Validation')
    console.log('='.repeat(60))

    const result = await this.runScript(
      'workflow-requirements-validator.js',
      ['validate', '--json'],
      { silent: true }
    )

    if (result.success) {
      try {
        const validation = JSON.parse(result.output)
        this.testResults.requirementsValidation = validation

        console.log('✅ Requirements validation completed')
        console.log(`   Pass rate: ${validation.summary.passRate}%`)
        console.log(
          `   Passed criteria: ${validation.summary.passedCriteria}/${validation.summary.totalCriteria}`
        )

        return validation.summary.passRate >= 80 // 80% pass rate threshold
      } catch (error) {
        console.error(
          '❌ Failed to parse requirements validation results:',
          error.message
        )
        return false
      }
    } else {
      console.error('❌ Requirements validation failed:', result.error)
      return false
    }
  }

  /**
   * Run workflow configuration tests.
   *
   * This function executes the workflow configuration tests by running a script named 'workflow-test.js' with specific arguments.
   * It processes the output, checking for success and parsing the JSON report to update the test results.
   * If the tests are successful, it logs the results, including the installation status and counts of total and valid workflows.
   * In case of errors during execution or parsing, appropriate error messages are logged.
   */
  async runConfigurationTests () {
    console.log('\n📋 Step 3: Workflow Configuration Tests')
    console.log('='.repeat(60))

    const result = await this.runScript(
      'workflow-test.js',
      ['report', '--json'],
      { silent: true }
    )

    if (result.success) {
      try {
        const report = JSON.parse(result.output)
        this.testResults.configurationTests = report

        console.log('✅ Configuration tests completed')
        console.log(`   Act installed: ${report.actInstalled ? '✅' : '❌'}`)
        console.log(`   Total workflows: ${report.summary.total}`)
        console.log(`   Valid workflows: ${report.summary.valid}`)

        return report.summary.invalid === 0
      } catch (error) {
        console.error(
          '❌ Failed to parse configuration test results:',
          error.message
        )
        return false
      }
    } else {
      console.error('❌ Configuration tests failed:', result.error)
      return false
    }
  }

  /**
   * Run local workflow tests with act (if available).
   *
   * This function checks if the act tool is installed and runs tests for either a specific workflow or a set of key workflows.
   * It collects the results of the tests, logs the outcomes, and updates the testResults object with the results of the local tests.
   *
   * @param workflowName - The name of the specific workflow to test. If not provided, key workflows will be tested.
   * @returns A boolean indicating whether all local tests passed.
   */
  async runLocalTests (workflowName = null) {
    console.log('\n📋 Step 4: Local Workflow Tests (act)')
    console.log('='.repeat(60))

    // Check if act is installed
    try {
      execSync('act --version', { stdio: 'pipe' })
    } catch (error) {
      console.log('⚠️  act tool not installed - skipping local tests')
      console.log('   Install act: https://github.com/nektos/act')
      this.testResults.localTests = {
        skipped: true,
        reason: 'act not installed'
      }
      return true // Don't fail the overall test suite
    }

    const testResults = []

    if (workflowName) {
      // Test specific workflow
      const result = await this.runScript(
        'workflow-test.js',
        ['test', workflowName, '--dry-run'],
        { silent: false }
      )
      testResults.push({
        workflow: workflowName,
        success: result.success,
        output: result.output,
        error: result.error
      })
    } else {
      // Test key workflows
      const keyWorkflows = ['ci.yml', 'security.yml', 'deploy-staging.yml']

      for (const workflow of keyWorkflows) {
        console.log(`\n🧪 Testing ${workflow}...`)
        const result = await this.runScript(
          'workflow-test.js',
          ['test', workflow, '--dry-run'],
          { silent: true }
        )
        testResults.push({
          workflow,
          success: result.success,
          output: result.output,
          error: result.error
        })

        if (result.success) {
          console.log(`   ✅ ${workflow} test passed`)
        } else {
          console.log(`   ❌ ${workflow} test failed`)
        }
      }
    }

    this.testResults.localTests = {
      results: testResults,
      totalTests: testResults.length,
      passedTests: testResults.filter(r => r.success).length
    }

    const allPassed = testResults.every(r => r.success)
    console.log(`\n${allPassed ? '✅' : '❌'} Local tests completed`)
    console.log(
      `   Passed: ${this.testResults.localTests.passedTests}/${this.testResults.localTests.totalTests}`
    )

    return allPassed
  }

  /**
   * Generate comprehensive test report.
   *
   * This function constructs a report summarizing the results of various test validations, including syntax, requirements, configuration, and local tests. It calculates the number of passed steps and determines overall success based on predefined criteria. Additionally, it generates recommendations based on the results of the tests to guide improvements.
   *
   * @returns An object containing the report with timestamp, summary of test results, and recommendations.
   */
  generateReport () {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalSteps: 4,
        passedSteps: 0,
        overallSuccess: false
      },
      results: this.testResults,
      recommendations: []
    }

    // Calculate passed steps
    if (this.testResults.syntaxValidation?.summary?.invalid === 0) {
      report.summary.passedSteps++
    }

    if (this.testResults.requirementsValidation?.summary?.passRate >= 80) {
      report.summary.passedSteps++
    }

    if (this.testResults.configurationTests?.summary?.invalid === 0) {
      report.summary.passedSteps++
    }

    if (
      this.testResults.localTests?.skipped ||
      this.testResults.localTests?.passedTests ===
        this.testResults.localTests?.totalTests
    ) {
      report.summary.passedSteps++
    }

    report.summary.overallSuccess =
      report.summary.passedSteps === report.summary.totalSteps

    // Generate recommendations
    if (this.testResults.syntaxValidation?.summary?.invalid > 0) {
      report.recommendations.push(
        'Fix workflow syntax errors before proceeding'
      )
    }

    if (this.testResults.requirementsValidation?.summary?.passRate < 80) {
      report.recommendations.push(
        'Improve workflow coverage to meet more requirements'
      )
    }

    if (!this.testResults.configurationTests?.actInstalled) {
      report.recommendations.push(
        'Install act tool for local workflow testing'
      )
    }

    if (
      this.testResults.localTests?.passedTests <
      this.testResults.localTests?.totalTests
    ) {
      report.recommendations.push('Fix failing local workflow tests')
    }

    return report
  }

  /**
   * Save report to a specified file.
   */
  saveReport (report, filename = 'comprehensive-workflow-test-report.json') {
    this.ensureReportsDir()
    const reportPath = join(this.reportsDir, filename)

    try {
      writeFileSync(reportPath, JSON.stringify(report, null, 2))
      console.log(`\n📊 Comprehensive report saved to: ${reportPath}`)
      return reportPath
    } catch (error) {
      console.error('❌ Failed to save report:', error.message)
      return null
    }
  }

  /**
   * Print summary results of the test report.
   *
   * This function logs the overall success of the test, the number of steps passed, and any recommendations.
   * It also provides detailed results for syntax validation, requirements validation, configuration tests,
   * and local tests, indicating their respective statuses based on the test results.
   *
   * @param report - The report object containing summary and test results.
   */
  printSummary (report) {
    console.log('\n🎯 Test Summary')
    console.log('='.repeat(60))
    console.log(
      `Overall result: ${report.summary.overallSuccess ? '✅ PASSED' : '❌ FAILED'}`
    )
    console.log(
      `Steps passed: ${report.summary.passedSteps}/${report.summary.totalSteps}`
    )

    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:')
      report.recommendations.forEach(rec => {
        console.log(`   • ${rec}`)
      })
    }

    console.log('\n📋 Detailed Results:')

    // Syntax validation
    const syntaxStatus =
      this.testResults.syntaxValidation?.summary?.invalid === 0 ? '✅' : '❌'
    console.log(`   ${syntaxStatus} Syntax Validation`)

    // Requirements validation
    const reqsStatus =
      this.testResults.requirementsValidation?.summary?.passRate >= 80
        ? '✅'
        : '❌'
    const reqsRate =
      this.testResults.requirementsValidation?.summary?.passRate || 0
    console.log(`   ${reqsStatus} Requirements Validation (${reqsRate}%)`)

    // Configuration tests
    const configStatus =
      this.testResults.configurationTests?.summary?.invalid === 0 ? '✅' : '❌'
    console.log(`   ${configStatus} Configuration Tests`)

    // Local tests
    let localStatus = '✅'
    if (this.testResults.localTests?.skipped) {
      localStatus = '⚠️ '
    } else if (
      this.testResults.localTests?.passedTests <
      this.testResults.localTests?.totalTests
    ) {
      localStatus = '❌'
    }
    console.log(
      `   ${localStatus} Local Tests ${this.testResults.localTests?.skipped ? '(skipped)' : ''}`
    )
  }

  /**
   * Run all tests in the comprehensive workflow testing suite.
   *
   * This function orchestrates the execution of various validation and testing steps, including syntax validation, requirements validation, configuration tests, and local tests if not skipped. It generates a report based on the results of these tests and saves it if specified in the options. In case of any errors during the testing process, it logs the error and returns false.
   *
   * @param options - An object containing options for the test execution, including whether to skip local tests and whether to save the report.
   * @returns A boolean indicating the overall success of the tests.
   */
  async runAllTests (options = {}) {
    console.log('🧪 Comprehensive Workflow Testing Suite')
    console.log('='.repeat(60))
    console.log(`Started: ${new Date().toISOString()}`)

    const results = {
      syntaxValidation: false,
      requirementsValidation: false,
      configurationTests: false,
      localTests: false
    }

    try {
      // Step 1: Syntax validation
      results.syntaxValidation = await this.runSyntaxValidation()

      // Step 2: Requirements validation
      results.requirementsValidation = await this.runRequirementsValidation()

      // Step 3: Configuration tests
      results.configurationTests = await this.runConfigurationTests()

      // Step 4: Local tests (if enabled)
      if (!options.skipLocal) {
        results.localTests = await this.runLocalTests(options.workflow)
      } else {
        console.log('\n📋 Step 4: Local Workflow Tests (skipped)')
        this.testResults.localTests = {
          skipped: true,
          reason: 'user requested skip'
        }
        results.localTests = true
      }

      // Generate and save report
      const report = this.generateReport()

      if (options.save !== false) {
        this.saveReport(report)
      }

      // Print summary
      this.printSummary(report)

      return report.summary.overallSuccess
    } catch (error) {
      console.error('\n❌ Test suite failed with error:', error.message)
      return false
    }
  }
}

// CLI Interface
program
  .name('workflow-test-runner')
  .description('Comprehensive workflow testing suite')
  .version('1.0.0')

program
  .command('test')
  .description('Run comprehensive workflow tests')
  .option('--skip-local', 'Skip local act tests')
  .option('--workflow <name>', 'Test specific workflow only')
  .option('--no-save', 'Do not save report to file')
  .action(async options => {
    const runner = new WorkflowTestRunner()
    const success = await runner.runAllTests(options)
    process.exit(success ? 0 : 1)
  })

program
  .command('syntax')
  .description('Run syntax validation only')
  .action(async () => {
    const runner = new WorkflowTestRunner()
    const success = await runner.runSyntaxValidation()
    process.exit(success ? 0 : 1)
  })

program
  .command('requirements')
  .description('Run requirements validation only')
  .action(async () => {
    const runner = new WorkflowTestRunner()
    const success = await runner.runRequirementsValidation()
    process.exit(success ? 0 : 1)
  })

program
  .command('local')
  .description('Run local tests only')
  .argument('[workflow]', 'Specific workflow to test')
  .action(async workflow => {
    const runner = new WorkflowTestRunner()
    const success = await runner.runLocalTests(workflow)
    process.exit(success ? 0 : 1)
  })

program
  .command('setup')
  .description('Setup testing environment')
  .action(async () => {
    console.log('🔧 Setting up workflow testing environment...')

    const runner = new WorkflowTestRunner()
    runner.ensureReportsDir()

    // Setup act configuration
    const setupResult = await runner.runScript('workflow-test.js', ['setup'])

    if (setupResult.success) {
      console.log('✅ Testing environment setup completed')
      console.log('\n📋 Next steps:')
      console.log('   1. Install act tool: https://github.com/nektos/act')
      console.log('   2. Run: bun run workflow:test-local')
      console.log(
        '   3. Run full test suite: node scripts/workflow-test-runner.js test'
      )
    } else {
      console.error('❌ Setup failed:', setupResult.error)
      process.exit(1)
    }
  })

// Handle no command
if (process.argv.length === 2) {
  program.help()
}

program.parse()
