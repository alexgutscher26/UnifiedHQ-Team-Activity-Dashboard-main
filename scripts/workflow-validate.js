/**
 * GitHub Workflow Validation Utility
 *
 * This script provides comprehensive validation for GitHub workflow configurations,
 * checking for syntax, security, performance, and best practices.
 */

import { readFileSync, readdirSync, existsSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { program } from 'commander'
import yaml from 'js-yaml'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')
const workflowsDir = join(rootDir, '.github', 'workflows')

class WorkflowValidator {
  constructor () {
    this.workflows = this.loadWorkflows()
    this.validationRules = this.initializeValidationRules()
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
   * Initialize validation rules
   */
  initializeValidationRules () {
    return {
      syntax: [
        {
          name: 'Required Fields',
          check: workflow => {
            const issues = []
            if (!workflow.name) issues.push('Missing workflow name')
            if (!workflow.on) issues.push('Missing trigger events (on)')
            if (!workflow.jobs) issues.push('Missing jobs definition')
            return issues
          }
        },
        {
          name: 'Job Structure',
          check: workflow => {
            const issues = []
            if (workflow.jobs) {
              Object.entries(workflow.jobs).forEach(([jobName, job]) => {
                if (!job['runs-on']) {
                  issues.push(`Job '${jobName}' missing runs-on`)
                }
                if (!job.steps || job.steps.length === 0) {
                  issues.push(`Job '${jobName}' has no steps`)
                }
              })
            }
            return issues
          }
        }
      ],
      security: [
        {
          name: 'Secret Usage',
          check: workflow => {
            const issues = []
            const warnings = []
            const content = JSON.stringify(workflow)

            // Check for hardcoded secrets
            const secretPatterns = [
              /password\s*[:=]\s*['"][^'"]+['"]/gi,
              /token\s*[:=]\s*['"][^'"]+['"]/gi,
              /key\s*[:=]\s*['"][^'"]+['"]/gi,
              /secret\s*[:=]\s*['"][^'"]+['"]/gi
            ]

            secretPatterns.forEach(pattern => {
              if (pattern.test(content)) {
                issues.push('Potential hardcoded secret detected')
              }
            })

            // Check for proper secret usage
            if (
              content.includes('secrets.') &&
              !content.includes('${{ secrets.')
            ) {
              warnings.push(
                'Secrets should be accessed using ${{ secrets.SECRET_NAME }} syntax'
              )
            }

            return { issues, warnings }
          }
        },
        {
          name: 'Dangerous Commands',
          check: workflow => {
            const issues = []
            const warnings = []

            if (workflow.jobs) {
              Object.entries(workflow.jobs).forEach(([jobName, job]) => {
                if (job.steps) {
                  job.steps.forEach((step, index) => {
                    if (step.run) {
                      // Check for dangerous patterns
                      if (
                        step.run.includes('curl') &&
                        step.run.includes('sudo')
                      ) {
                        warnings.push(
                          `Job '${jobName}' step ${index + 1}: curl with sudo is risky`
                        )
                      }
                      if (step.run.includes('rm -rf')) {
                        warnings.push(
                          `Job '${jobName}' step ${index + 1}: rm -rf detected`
                        )
                      }
                      if (step.run.includes('eval')) {
                        issues.push(
                          `Job '${jobName}' step ${index + 1}: eval usage is dangerous`
                        )
                      }
                    }
                  })
                }
              })
            }

            return { issues, warnings }
          }
        }
      ],
      performance: [
        {
          name: 'Caching Strategy',
          check: workflow => {
            const warnings = []

            if (workflow.jobs) {
              const hasCache = Object.values(workflow.jobs).some(job =>
                job.steps?.some(step => step.uses?.includes('actions/cache'))
              )

              if (!hasCache) {
                warnings.push(
                  'No caching detected - consider adding dependency caching'
                )
              }
            }

            return { issues: [], warnings }
          }
        },
        {
          name: 'Concurrency Control',
          check: workflow => {
            const warnings = []

            if (!workflow.concurrency) {
              warnings.push(
                'No concurrency control - consider adding to prevent duplicate runs'
              )
            }

            return { issues: [], warnings }
          }
        },
        {
          name: 'Matrix Strategy',
          check: workflow => {
            const suggestions = []

            if (workflow.jobs) {
              Object.entries(workflow.jobs).forEach(([jobName, job]) => {
                if (job.strategy?.matrix) {
                  const matrixSize = Object.values(job.strategy.matrix).reduce(
                    (acc, val) => acc * (Array.isArray(val) ? val.length : 1),
                    1
                  )

                  if (matrixSize > 10) {
                    suggestions.push(
                      `Job '${jobName}' has large matrix (${matrixSize} combinations) - consider optimization`
                    )
                  }
                }
              })
            }

            return { issues: [], warnings: suggestions }
          }
        }
      ],
      bestPractices: [
        {
          name: 'Action Versions',
          check: workflow => {
            const warnings = []

            if (workflow.jobs) {
              Object.values(workflow.jobs).forEach(job => {
                if (job.steps) {
                  job.steps.forEach(step => {
                    if (step.uses) {
                      // Check for latest tag usage
                      if (step.uses.includes('@latest')) {
                        warnings.push(
                          `Action '${step.uses}' uses @latest - consider pinning to specific version`
                        )
                      }
                      // Check for major version pinning
                      if (step.uses.match(/@v\d+$/)) {
                        // This is actually good practice, no warning
                      }
                    }
                  })
                }
              })
            }

            return { issues: [], warnings }
          }
        },
        {
          name: 'Step Names',
          check: workflow => {
            const warnings = []

            if (workflow.jobs) {
              Object.entries(workflow.jobs).forEach(([jobName, job]) => {
                if (job.steps) {
                  job.steps.forEach((step, index) => {
                    if (!step.name && (step.uses || step.run)) {
                      warnings.push(
                        `Job '${jobName}' step ${index + 1} missing descriptive name`
                      )
                    }
                  })
                }
              })
            }

            return { issues: [], warnings }
          }
        }
      ]
    }
  }

  /**
   * Validate a single workflow
   */
  validateWorkflow (workflowName, options = {}) {
    const workflow = this.workflows[workflowName]
    if (!workflow) {
      return {
        valid: false,
        errors: ['Workflow not found'],
        warnings: [],
        suggestions: []
      }
    }

    const result = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: []
    }

    const categories = options.categories || [
      'syntax',
      'security',
      'performance',
      'bestPractices'
    ]

    categories.forEach(category => {
      if (this.validationRules[category]) {
        this.validationRules[category].forEach(rule => {
          try {
            const ruleResult = rule.check(workflow.content)

            if (Array.isArray(ruleResult)) {
              // Simple array of issues
              result.errors.push(...ruleResult)
            } else if (ruleResult.issues || ruleResult.warnings) {
              // Object with issues and warnings
              if (ruleResult.issues) result.errors.push(...ruleResult.issues)
              if (ruleResult.warnings) {
                result.warnings.push(...ruleResult.warnings)
              }
            }
          } catch (error) {
            result.warnings.push(
              `Validation rule '${rule.name}' failed: ${error.message}`
            )
          }
        })
      }
    })

    result.valid = result.errors.length === 0
    return result
  }

  /**
   * Validate all workflows
   */
  validateAllWorkflows (options = {}) {
    const results = {}
    let totalValid = 0
    let totalInvalid = 0

    Object.keys(this.workflows).forEach(workflowName => {
      const result = this.validateWorkflow(workflowName, options)
      results[workflowName] = result

      if (result.valid) {
        totalValid++
      } else {
        totalInvalid++
      }
    })

    return {
      results,
      summary: {
        total: Object.keys(this.workflows).length,
        valid: totalValid,
        invalid: totalInvalid
      }
    }
  }

  /**
   * Generate validation report
   */
  generateReport (options = {}) {
    const validation = this.validateAllWorkflows(options)

    const report = {
      timestamp: new Date().toISOString(),
      summary: validation.summary,
      workflows: {}
    }

    Object.entries(validation.results).forEach(([workflowName, result]) => {
      const workflow = this.workflows[workflowName]
      report.workflows[workflowName] = {
        name: workflow.content.name || 'Unnamed',
        path: workflow.path,
        valid: result.valid,
        errors: result.errors,
        warnings: result.warnings,
        suggestions: result.suggestions,
        metadata: {
          triggers: Object.keys(workflow.content.on || {}),
          jobs: Object.keys(workflow.content.jobs || {}),
          jobCount: Object.keys(workflow.content.jobs || {}).length
        }
      }
    })

    return report
  }

  /**
   * Print validation results to console
   */
  printResults (workflowName, result) {
    const workflow = this.workflows[workflowName]
    const name = workflow?.content?.name || 'Unnamed'

    console.log(`\n📄 ${workflowName} (${name})`)
    console.log('─'.repeat(50))

    if (result.valid) {
      console.log('✅ Validation passed')
    } else {
      console.log('❌ Validation failed')
      result.errors.forEach(error => {
        console.log(`   • ${error}`)
      })
    }

    if (result.warnings.length > 0) {
      console.log('⚠️  Warnings:')
      result.warnings.forEach(warning => {
        console.log(`   • ${warning}`)
      })
    }

    if (result.suggestions && result.suggestions.length > 0) {
      console.log('💡 Suggestions:')
      result.suggestions.forEach(suggestion => {
        console.log(`   • ${suggestion}`)
      })
    }
  }

  /**
   * Save report to file
   */
  saveReport (report, filename = 'workflow-validation-report.json') {
    try {
      const reportPath = join(rootDir, 'reports', filename)

      // Ensure reports directory exists
      const reportsDir = join(rootDir, 'reports')
      if (!existsSync(reportsDir)) {
        require('fs').mkdirSync(reportsDir, { recursive: true })
      }

      writeFileSync(reportPath, JSON.stringify(report, null, 2))
      console.log(`\n📊 Report saved to: ${reportPath}`)
      return reportPath
    } catch (error) {
      console.error('❌ Failed to save report:', error.message)
      return null
    }
  }

  /**
   * Check workflow dependencies
   */
  checkDependencies () {
    const dependencies = new Set()
    const issues = []

    Object.entries(this.workflows).forEach(([workflowName, workflow]) => {
      if (workflow.content.jobs) {
        Object.values(workflow.content.jobs).forEach(job => {
          if (job.steps) {
            job.steps.forEach(step => {
              if (step.uses) {
                const action = step.uses.split('@')[0]
                dependencies.add(action)
              }
            })
          }
        })
      }
    })

    return {
      dependencies: Array.from(dependencies),
      issues
    }
  }
}

// CLI Interface
program
  .name('workflow-validate')
  .description('GitHub Workflow Validation Utility')
  .version('1.0.0')

program
  .command('validate')
  .description('Validate workflow configurations')
  .argument('[workflow]', 'Workflow filename to validate')
  .option('--all', 'Validate all workflows')
  .option(
    '--categories <categories>',
    'Validation categories (syntax,security,performance,bestPractices)',
    'syntax,security,performance,bestPractices'
  )
  .option('--json', 'Output as JSON')
  .option('--save', 'Save report to file')
  .action((workflow, options) => {
    const validator = new WorkflowValidator()
    const categories = options.categories.split(',')

    if (options.all || !workflow) {
      const validation = validator.validateAllWorkflows({ categories })

      if (options.json) {
        console.log(JSON.stringify(validation, null, 2))
      } else {
        console.log('\n🔍 Workflow Validation Results')
        console.log('='.repeat(50))

        Object.entries(validation.results).forEach(([workflowName, result]) => {
          validator.printResults(workflowName, result)
        })

        console.log('\n📊 Summary:')
        console.log(`   Total workflows: ${validation.summary.total}`)
        console.log(`   Valid workflows: ${validation.summary.valid}`)
        console.log(`   Invalid workflows: ${validation.summary.invalid}`)
      }

      if (options.save) {
        const report = validator.generateReport({ categories })
        validator.saveReport(report)
      }
    } else {
      const result = validator.validateWorkflow(workflow, { categories })

      if (options.json) {
        console.log(JSON.stringify(result, null, 2))
      } else {
        validator.printResults(workflow, result)
      }
    }
  })

program
  .command('report')
  .description('Generate comprehensive validation report')
  .option(
    '--categories <categories>',
    'Validation categories',
    'syntax,security,performance,bestPractices'
  )
  .option(
    '--output <file>',
    'Output file path',
    'workflow-validation-report.json'
  )
  .option('--json', 'Output to console as JSON')
  .action(options => {
    const validator = new WorkflowValidator()
    const categories = options.categories.split(',')
    const report = validator.generateReport({ categories })

    if (options.json) {
      console.log(JSON.stringify(report, null, 2))
    } else {
      console.log('\n📊 Workflow Validation Report')
      console.log('='.repeat(50))
      console.log(`Generated: ${report.timestamp}`)
      console.log(`Total workflows: ${report.summary.total}`)
      console.log(`Valid workflows: ${report.summary.valid}`)
      console.log(`Invalid workflows: ${report.summary.invalid}`)

      if (report.summary.invalid > 0) {
        console.log('\n❌ Invalid workflows:')
        Object.entries(report.workflows).forEach(([filename, workflow]) => {
          if (!workflow.valid) {
            console.log(`\n   ${filename}:`)
            workflow.errors.forEach(error => console.log(`     • ${error}`))
          }
        })
      }

      validator.saveReport(report, options.output)
    }
  })

program
  .command('dependencies')
  .description('Check workflow action dependencies')
  .action(() => {
    const validator = new WorkflowValidator()
    const deps = validator.checkDependencies()

    console.log('\n📦 Workflow Dependencies')
    console.log('='.repeat(50))
    console.log(`Found ${deps.dependencies.length} unique actions:`)

    deps.dependencies.sort().forEach(dep => {
      console.log(`   • ${dep}`)
    })

    if (deps.issues.length > 0) {
      console.log('\n⚠️  Issues:')
      deps.issues.forEach(issue => console.log(`   • ${issue}`))
    }
  })

// Handle no command
if (process.argv.length === 2) {
  program.help()
}

program.parse()
