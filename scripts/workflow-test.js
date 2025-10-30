#!/usr/bin/env node

/**
 * GitHub Workflow Testing Utility
 *
 * This script provides utilities for testing GitHub workflows locally using act
 * and validating workflow configurations.
 */

import { execSync, spawn } from 'child_process'
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { program } from 'commander'
import yaml from 'js-yaml'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')
const workflowsDir = join(rootDir, '.github', 'workflows')

class WorkflowTester {
  constructor () {
    this.actInstalled = this.checkActInstallation()
    this.workflows = this.loadWorkflows()
  }

  /**
   * Check if act tool is installed
   */
  checkActInstallation () {
    try {
      execSync('act --version', { stdio: 'pipe' })
      return true
    } catch (error) {
      console.warn(
        '⚠️  act tool not found. Install it for local workflow testing:'
      )
      console.warn(
        '   curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash'
      )
      console.warn('   or visit: https://github.com/nektos/act')
      return false
    }
  }

  /**
   * Load all workflow files
   */
  loadWorkflows () {
    const workflows = {}

    if (!existsSync(workflowsDir)) {
      console.error('❌ Workflows directory not found:', workflowsDir)
      return workflows
    }

    const files = readdirSync(workflowsDir).filter(
      file => file.endsWith('.yml') || file.endsWith('.yaml')
    )

    for (const file of files) {
      try {
        const filePath = join(workflowsDir, file)
        const content = readFileSync(filePath, 'utf8')
        const workflow = yaml.load(content)
        workflows[file] = {
          path: filePath,
          content: workflow,
          raw: content
        }
      } catch (error) {
        console.error(`❌ Failed to load workflow ${file}:`, error.message)
      }
    }

    return workflows
  }

  /**
   * List all available workflows
   */
  listWorkflows () {
    console.log('\n📋 Available Workflows:')
    console.log('='.repeat(50))

    Object.entries(this.workflows).forEach(([filename, workflow]) => {
      const name = workflow.content.name || 'Unnamed'
      const triggers = Object.keys(workflow.content.on || {}).join(', ')
      const jobs = Object.keys(workflow.content.jobs || {}).length

      console.log(`\n📄 ${filename}`)
      console.log(`   Name: ${name}`)
      console.log(`   Triggers: ${triggers}`)
      console.log(`   Jobs: ${jobs}`)
    })

    console.log('\n')
  }

  /**
   * Test a specific workflow locally using act
   */
  async testWorkflow (workflowName, event = 'push', options = {}) {
    if (!this.actInstalled) {
      console.error('❌ Cannot test workflow: act tool not installed')
      return false
    }

    const workflow = this.workflows[workflowName]
    if (!workflow) {
      console.error(`❌ Workflow not found: ${workflowName}`)
      return false
    }

    console.log(`\n🧪 Testing workflow: ${workflowName}`)
    console.log(`   Event: ${event}`)
    console.log(`   File: ${workflow.path}`)

    const actArgs = [
      event,
      '--workflows',
      workflowsDir,
      '--workflow',
      workflowName
    ]

    // Add dry-run option for validation
    if (options.dryRun) {
      actArgs.push('--dryrun')
    }

    // Add verbose output
    if (options.verbose) {
      actArgs.push('--verbose')
    }

    // Add platform specification
    if (options.platform) {
      actArgs.push('--platform', options.platform)
    }

    try {
      console.log(`\n🚀 Running: act ${actArgs.join(' ')}`)

      const child = spawn('act', actArgs, {
        cwd: rootDir,
        stdio: 'inherit'
      })

      return new Promise(resolve => {
        child.on('close', code => {
          if (code === 0) {
            console.log('\n✅ Workflow test completed successfully')
            resolve(true)
          } else {
            console.log(`\n❌ Workflow test failed with code ${code}`)
            resolve(false)
          }
        })
      })
    } catch (error) {
      console.error('❌ Failed to run workflow test:', error.message)
      return false
    }
  }

  /**
   * Validate workflow syntax and structure
   */
  validateWorkflow (workflowName) {
    const workflow = this.workflows[workflowName]
    if (!workflow) {
      console.error(`❌ Workflow not found: ${workflowName}`)
      return false
    }

    console.log(`\n🔍 Validating workflow: ${workflowName}`)

    const issues = []
    const warnings = []
    const content = workflow.content

    // Check required fields
    if (!content.name) {
      issues.push('Missing workflow name')
    }

    if (!content.on) {
      issues.push('Missing trigger events (on)')
    }

    if (!content.jobs || Object.keys(content.jobs).length === 0) {
      issues.push('No jobs defined')
    }

    // Validate jobs
    if (content.jobs) {
      Object.entries(content.jobs).forEach(([jobName, job]) => {
        if (!job['runs-on']) {
          issues.push(`Job '${jobName}' missing runs-on`)
        }

        if (!job.steps || job.steps.length === 0) {
          issues.push(`Job '${jobName}' has no steps`)
        }

        // Check for common issues
        if (job.steps) {
          job.steps.forEach((step, index) => {
            if (!step.name && !step.uses && !step.run) {
              issues.push(
                `Job '${jobName}' step ${index + 1} has no name, uses, or run`
              )
            }

            // Check for potential security issues
            if (
              step.run?.includes('curl') &&
              step.run.includes('sudo')
            ) {
              warnings.push(
                `Job '${jobName}' step ${index + 1} uses curl with sudo - potential security risk`
              )
            }
          })
        }
      })
    }

    // Check for performance optimizations
    if (content.jobs) {
      const hasCache = Object.values(content.jobs).some(
        job =>
          job.steps?.some(
            step => step.uses?.includes('actions/cache')
          )
      )

      if (!hasCache) {
        warnings.push(
          'No caching detected - consider adding dependency caching for better performance'
        )
      }

      const hasConcurrency = !!content.concurrency
      if (!hasConcurrency) {
        warnings.push(
          'No concurrency control - consider adding to prevent duplicate runs'
        )
      }
    }

    // Report results
    if (issues.length === 0) {
      console.log('✅ Workflow validation passed')
    } else {
      console.log('❌ Workflow validation failed:')
      issues.forEach(issue => console.log(`   • ${issue}`))
    }

    if (warnings.length > 0) {
      console.log('⚠️  Warnings:')
      warnings.forEach(warning => console.log(`   • ${warning}`))
    }

    return issues.length === 0
  }

  /**
   * Validate all workflows
   */
  validateAllWorkflows () {
    console.log('\n🔍 Validating all workflows...')
    console.log('='.repeat(50))

    let totalWorkflows = 0
    let validWorkflows = 0

    Object.keys(this.workflows).forEach(workflowName => {
      totalWorkflows++
      if (this.validateWorkflow(workflowName)) {
        validWorkflows++
      }
      console.log('') // Add spacing
    })

    console.log('\n📊 Validation Summary:')
    console.log(`   Total workflows: ${totalWorkflows}`)
    console.log(`   Valid workflows: ${validWorkflows}`)
    console.log(`   Failed workflows: ${totalWorkflows - validWorkflows}`)

    return validWorkflows === totalWorkflows
  }

  /**
   * Generate workflow test report
   */
  generateTestReport () {
    const report = {
      timestamp: new Date().toISOString(),
      actInstalled: this.actInstalled,
      workflows: {},
      summary: {
        total: 0,
        valid: 0,
        invalid: 0
      }
    }

    Object.entries(this.workflows).forEach(([filename, workflow]) => {
      report.summary.total++

      const validation = this.validateWorkflowSilent(filename)
      if (validation.valid) {
        report.summary.valid++
      } else {
        report.summary.invalid++
      }

      report.workflows[filename] = {
        name: workflow.content.name || 'Unnamed',
        triggers: Object.keys(workflow.content.on || {}),
        jobs: Object.keys(workflow.content.jobs || {}),
        validation
      }
    })

    return report
  }

  /**
   * Validate workflow without console output
   */
  validateWorkflowSilent (workflowName) {
    const workflow = this.workflows[workflowName]
    if (!workflow) {
      return { valid: false, issues: ['Workflow not found'], warnings: [] }
    }

    const issues = []
    const warnings = []
    const content = workflow.content

    // Same validation logic as validateWorkflow but without console output
    if (!content.name) issues.push('Missing workflow name')
    if (!content.on) issues.push('Missing trigger events (on)')
    if (!content.jobs || Object.keys(content.jobs).length === 0) {
      issues.push('No jobs defined')
    }

    return {
      valid: issues.length === 0,
      issues,
      warnings
    }
  }

  /**
   * Create act configuration file
   */
  createActConfig () {
    const actrcPath = join(rootDir, '.actrc')
    const config = [
      '# Act configuration for local workflow testing',
      '--platform ubuntu-latest=catthehacker/ubuntu:act-latest',
      '--platform ubuntu-20.04=catthehacker/ubuntu:act-20.04',
      '--platform ubuntu-18.04=catthehacker/ubuntu:act-18.04',
      '--artifact-server-path /tmp/artifacts',
      '--env-file .env.local'
    ].join('\n')

    try {
      require('fs').writeFileSync(actrcPath, config)
      console.log(`✅ Created act configuration: ${actrcPath}`)
      return true
    } catch (error) {
      console.error('❌ Failed to create act configuration:', error.message)
      return false
    }
  }
}

// CLI Interface
program
  .name('workflow-test')
  .description('GitHub Workflow Testing Utility')
  .version('1.0.0')

program
  .command('list')
  .description('List all available workflows')
  .action(() => {
    const tester = new WorkflowTester()
    tester.listWorkflows()
  })

program
  .command('validate')
  .description('Validate workflow syntax and structure')
  .argument('[workflow]', 'Workflow filename to validate')
  .option('--all', 'Validate all workflows')
  .action((workflow, options) => {
    const tester = new WorkflowTester()

    if (options.all || !workflow) {
      tester.validateAllWorkflows()
    } else {
      tester.validateWorkflow(workflow)
    }
  })

program
  .command('test')
  .description('Test workflow locally using act')
  .argument('<workflow>', 'Workflow filename to test')
  .option('--event <event>', 'Event to trigger', 'push')
  .option('--dry-run', 'Perform dry run only')
  .option('--verbose', 'Verbose output')
  .option('--platform <platform>', 'Platform to use')
  .action(async (workflow, options) => {
    const tester = new WorkflowTester()
    await tester.testWorkflow(workflow, options.event, options)
  })

program
  .command('report')
  .description('Generate workflow test report')
  .option('--json', 'Output as JSON')
  .action(options => {
    const tester = new WorkflowTester()
    const report = tester.generateTestReport()

    if (options.json) {
      console.log(JSON.stringify(report, null, 2))
    } else {
      console.log('\n📊 Workflow Test Report')
      console.log('='.repeat(50))
      console.log(`Generated: ${report.timestamp}`)
      console.log(`Act installed: ${report.actInstalled ? '✅' : '❌'}`)
      console.log(`Total workflows: ${report.summary.total}`)
      console.log(`Valid workflows: ${report.summary.valid}`)
      console.log(`Invalid workflows: ${report.summary.invalid}`)

      if (report.summary.invalid > 0) {
        console.log('\n❌ Invalid workflows:')
        Object.entries(report.workflows).forEach(([filename, workflow]) => {
          if (!workflow.validation.valid) {
            console.log(
              `   ${filename}: ${workflow.validation.issues.join(', ')}`
            )
          }
        })
      }
    }
  })

program
  .command('setup')
  .description('Setup act configuration for local testing')
  .action(() => {
    const tester = new WorkflowTester()
    tester.createActConfig()
  })

// Handle no command
if (process.argv.length === 2) {
  program.help()
}

program.parse()
