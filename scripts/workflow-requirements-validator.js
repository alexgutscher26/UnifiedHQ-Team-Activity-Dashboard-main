/**
 * GitHub Workflow Requirements Validator
 *
 * This script validates that all GitHub workflows meet the specific requirements
 * defined in the requirements document. It performs comprehensive validation
 * against all acceptance criteria.
 */

import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { program } from 'commander'
import yaml from 'js-yaml'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')
const workflowsDir = join(rootDir, '.github', 'workflows')

class RequirementsValidator {
  constructor () {
    this.workflows = this.loadWorkflows()
    this.requirements = this.initializeRequirements()
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
   * Initialize requirements validation rules
   */
  initializeRequirements () {
    return {
      requirement1: {
        name: 'Automated CI/CD Pipelines',
        criteria: [
          {
            id: '1.1',
            description:
              'PR creation triggers quality checks (linting, type checking, testing)',
            validate: workflows => {
              const ciWorkflows = Object.values(workflows).filter(
                w =>
                  w.content.on?.pull_request && this.hasQualityChecks(w.content)
              )
              return {
                passed: ciWorkflows.length > 0,
                details: `Found ${ciWorkflows.length} workflows with PR quality checks`,
                workflows: ciWorkflows.map(w =>
                  Object.keys(workflows).find(k => workflows[k] === w)
                )
              }
            }
          },
          {
            id: '1.2',
            description: 'Main branch push triggers staging deployment',
            validate: workflows => {
              const deployWorkflows = Object.values(workflows).filter(
                w =>
                  w.content.on?.push?.branches?.includes('main') &&
                  this.hasDeploymentSteps(w.content, 'staging')
              )
              return {
                passed: deployWorkflows.length > 0,
                details: `Found ${deployWorkflows.length} workflows with staging deployment`,
                workflows: deployWorkflows.map(w =>
                  Object.keys(workflows).find(k => workflows[k] === w)
                )
              }
            }
          },
          {
            id: '1.3',
            description: 'Quality gates must pass before merge',
            validate: workflows => {
              const hasRequiredChecks = Object.values(workflows).some(
                w =>
                  w.content.on?.pull_request &&
                  this.hasRequiredStatusChecks(w.content)
              )
              return {
                passed: hasRequiredChecks,
                details: hasRequiredChecks
                  ? 'Quality gates configured'
                  : 'No quality gates found',
                workflows: []
              }
            }
          },
          {
            id: '1.4',
            description: 'Production deployment requires manual approval',
            validate: workflows => {
              const prodWorkflows = Object.values(workflows).filter(
                w =>
                  this.hasDeploymentSteps(w.content, 'production') &&
                  this.hasManualApproval(w.content)
              )
              return {
                passed: prodWorkflows.length > 0,
                details: `Found ${prodWorkflows.length} workflows with manual production approval`,
                workflows: prodWorkflows.map(w =>
                  Object.keys(workflows).find(k => workflows[k] === w)
                )
              }
            }
          },
          {
            id: '1.5',
            description: 'CI pipeline provides clear status feedback',
            validate: workflows => {
              const hasStatusFeedback = Object.values(workflows).some(w =>
                this.hasStatusFeedback(w.content)
              )
              return {
                passed: hasStatusFeedback,
                details: hasStatusFeedback
                  ? 'Status feedback configured'
                  : 'No status feedback found',
                workflows: []
              }
            }
          }
        ]
      },
      requirement2: {
        name: 'Automated Security Scanning',
        criteria: [
          {
            id: '2.1',
            description: 'Code push triggers security vulnerability scanning',
            validate: workflows => {
              const securityWorkflows = Object.values(workflows).filter(
                w =>
                  (w.content.on?.push || w.content.on?.pull_request) &&
                  this.hasSecurityScanning(w.content)
              )
              return {
                passed: securityWorkflows.length > 0,
                details: `Found ${securityWorkflows.length} workflows with security scanning`,
                workflows: securityWorkflows.map(w =>
                  Object.keys(workflows).find(k => workflows[k] === w)
                )
              }
            }
          },
          {
            id: '2.2',
            description: 'Dependency updates trigger vulnerability checks',
            validate: workflows => {
              const depWorkflows = Object.values(workflows).filter(w =>
                this.hasDependencyScanning(w.content)
              )
              return {
                passed: depWorkflows.length > 0,
                details: `Found ${depWorkflows.length} workflows with dependency scanning`,
                workflows: depWorkflows.map(w =>
                  Object.keys(workflows).find(k => workflows[k] === w)
                )
              }
            }
          },
          {
            id: '2.3',
            description: 'Security vulnerabilities block merge',
            validate: workflows => {
              const hasBlockingChecks = Object.values(workflows).some(w =>
                this.hasBlockingSecurityChecks(w.content)
              )
              return {
                passed: hasBlockingChecks,
                details: hasBlockingChecks
                  ? 'Blocking security checks configured'
                  : 'No blocking security checks found',
                workflows: []
              }
            }
          },
          {
            id: '2.4',
            description: 'Security scanner generates reports',
            validate: workflows => {
              const hasReporting = Object.values(workflows).some(w =>
                this.hasSecurityReporting(w.content)
              )
              return {
                passed: hasReporting,
                details: hasReporting
                  ? 'Security reporting configured'
                  : 'No security reporting found',
                workflows: []
              }
            }
          },
          {
            id: '2.5',
            description: 'Critical security issues trigger notifications',
            validate: workflows => {
              const hasNotifications = Object.values(workflows).some(w =>
                this.hasSecurityNotifications(w.content)
              )
              return {
                passed: hasNotifications,
                details: hasNotifications
                  ? 'Security notifications configured'
                  : 'No security notifications found',
                workflows: []
              }
            }
          }
        ]
      },
      requirement3: {
        name: 'Automated Release Management',
        criteria: [
          {
            id: '3.1',
            description:
              'Release tag creation triggers automated release notes',
            validate: workflows => {
              const releaseWorkflows = Object.values(workflows).filter(
                w =>
                  w.content.on?.release &&
                  this.hasReleaseNotesGeneration(w.content)
              )
              return {
                passed: releaseWorkflows.length > 0,
                details: `Found ${releaseWorkflows.length} workflows with release notes generation`,
                workflows: releaseWorkflows.map(w =>
                  Object.keys(workflows).find(k => workflows[k] === w)
                )
              }
            }
          },
          {
            id: '3.2',
            description: 'Release manager builds and publishes artifacts',
            validate: workflows => {
              const artifactWorkflows = Object.values(workflows).filter(w =>
                this.hasArtifactBuilding(w.content)
              )
              return {
                passed: artifactWorkflows.length > 0,
                details: `Found ${artifactWorkflows.length} workflows with artifact building`,
                workflows: artifactWorkflows.map(w =>
                  Object.keys(workflows).find(k => workflows[k] === w)
                )
              }
            }
          },
          {
            id: '3.3',
            description: 'Release creation triggers production deployment',
            validate: workflows => {
              const prodDeployWorkflows = Object.values(workflows).filter(
                w =>
                  w.content.on?.release &&
                  this.hasDeploymentSteps(w.content, 'production')
              )
              return {
                passed: prodDeployWorkflows.length > 0,
                details: `Found ${prodDeployWorkflows.length} workflows with release-triggered production deployment`,
                workflows: prodDeployWorkflows.map(w =>
                  Object.keys(workflows).find(k => workflows[k] === w)
                )
              }
            }
          },
          {
            id: '3.4',
            description: 'Semantic versioning based on commit messages',
            validate: workflows => {
              const hasSemanticVersioning = Object.values(workflows).some(w =>
                this.hasSemanticVersioning(w.content)
              )
              return {
                passed: hasSemanticVersioning,
                details: hasSemanticVersioning
                  ? 'Semantic versioning configured'
                  : 'No semantic versioning found',
                workflows: []
              }
            }
          },
          {
            id: '3.5',
            description: 'Failed deployment triggers automatic rollback',
            validate: workflows => {
              const hasRollback = Object.values(workflows).some(w =>
                this.hasRollbackCapability(w.content)
              )
              return {
                passed: hasRollback,
                details: hasRollback
                  ? 'Rollback capability configured'
                  : 'No rollback capability found',
                workflows: []
              }
            }
          }
        ]
      },
      requirement4: {
        name: 'Automated Dependency Management',
        criteria: [
          {
            id: '4.1',
            description: 'Weekly automatic dependency update checks',
            validate: workflows => {
              const weeklyDepWorkflows = Object.values(workflows).filter(
                w =>
                  w.content.on?.schedule && this.hasDependencyUpdates(w.content)
              )
              return {
                passed: weeklyDepWorkflows.length > 0,
                details: `Found ${weeklyDepWorkflows.length} workflows with scheduled dependency updates`,
                workflows: weeklyDepWorkflows.map(w =>
                  Object.keys(workflows).find(k => workflows[k] === w)
                )
              }
            }
          },
          {
            id: '4.2',
            description: 'Dependency updates create pull requests',
            validate: workflows => {
              const hasPRCreation = Object.values(workflows).some(w =>
                this.hasPRCreationForDependencies(w.content)
              )
              return {
                passed: hasPRCreation,
                details: hasPRCreation
                  ? 'Dependency PR creation configured'
                  : 'No dependency PR creation found',
                workflows: []
              }
            }
          },
          {
            id: '4.3',
            description: 'Security checks on dependency updates',
            validate: workflows => {
              const hasDepSecurity = Object.values(workflows).some(w =>
                this.hasDependencySecurityChecks(w.content)
              )
              return {
                passed: hasDepSecurity,
                details: hasDepSecurity
                  ? 'Dependency security checks configured'
                  : 'No dependency security checks found',
                workflows: []
              }
            }
          },
          {
            id: '4.4',
            description:
              'Clear failure reports for breaking dependency updates',
            validate: workflows => {
              const hasFailureReporting = Object.values(workflows).some(w =>
                this.hasFailureReporting(w.content)
              )
              return {
                passed: hasFailureReporting,
                details: hasFailureReporting
                  ? 'Failure reporting configured'
                  : 'No failure reporting found',
                workflows: []
              }
            }
          },
          {
            id: '4.5',
            description: 'Auto-merge non-breaking dependency updates',
            validate: workflows => {
              const hasAutoMerge = Object.values(workflows).some(w =>
                this.hasAutoMergeCapability(w.content)
              )
              return {
                passed: hasAutoMerge,
                details: hasAutoMerge
                  ? 'Auto-merge capability configured'
                  : 'No auto-merge capability found',
                workflows: []
              }
            }
          }
        ]
      },
      requirement5: {
        name: 'Automated Performance Monitoring',
        criteria: [
          {
            id: '5.1',
            description: 'PR creation triggers performance benchmarks',
            validate: workflows => {
              const perfWorkflows = Object.values(workflows).filter(
                w =>
                  w.content.on?.pull_request &&
                  this.hasPerformanceTesting(w.content)
              )
              return {
                passed: perfWorkflows.length > 0,
                details: `Found ${perfWorkflows.length} workflows with performance testing`,
                workflows: perfWorkflows.map(w =>
                  Object.keys(workflows).find(k => workflows[k] === w)
                )
              }
            }
          },
          {
            id: '5.2',
            description: 'Performance degradation blocks merge and notifies',
            validate: workflows => {
              const hasThresholds = Object.values(workflows).some(w =>
                this.hasPerformanceThresholds(w.content)
              )
              return {
                passed: hasThresholds,
                details: hasThresholds
                  ? 'Performance thresholds configured'
                  : 'No performance thresholds found',
                workflows: []
              }
            }
          },
          {
            id: '5.3',
            description: 'Performance metrics tracked over time',
            validate: workflows => {
              const hasTracking = Object.values(workflows).some(w =>
                this.hasPerformanceTracking(w.content)
              )
              return {
                passed: hasTracking,
                details: hasTracking
                  ? 'Performance tracking configured'
                  : 'No performance tracking found',
                workflows: []
              }
            }
          },
          {
            id: '5.4',
            description: 'Performance improvements highlighted in PR comments',
            validate: workflows => {
              const hasComments = Object.values(workflows).some(w =>
                this.hasPerformanceComments(w.content)
              )
              return {
                passed: hasComments,
                details: hasComments
                  ? 'Performance comments configured'
                  : 'No performance comments found',
                workflows: []
              }
            }
          },
          {
            id: '5.5',
            description: 'Performance reports generated for deployments',
            validate: workflows => {
              const hasReports = Object.values(workflows).some(w =>
                this.hasPerformanceReports(w.content)
              )
              return {
                passed: hasReports,
                details: hasReports
                  ? 'Performance reports configured'
                  : 'No performance reports found',
                workflows: []
              }
            }
          }
        ]
      },
      requirement6: {
        name: 'Automated Code Quality Enforcement',
        criteria: [
          {
            id: '6.1',
            description: 'Code formatting enforced with Prettier',
            validate: workflows => {
              const hasPrettier = Object.values(workflows).some(w =>
                this.hasPrettierCheck(w.content)
              )
              return {
                passed: hasPrettier,
                details: hasPrettier
                  ? 'Prettier checks configured'
                  : 'No Prettier checks found',
                workflows: []
              }
            }
          },
          {
            id: '6.2',
            description: 'Code quality rules enforced with ESLint',
            validate: workflows => {
              const hasESLint = Object.values(workflows).some(w =>
                this.hasESLintCheck(w.content)
              )
              return {
                passed: hasESLint,
                details: hasESLint
                  ? 'ESLint checks configured'
                  : 'No ESLint checks found',
                workflows: []
              }
            }
          },
          {
            id: '6.3',
            description: 'TypeScript strict mode compliance enforced',
            validate: workflows => {
              const hasTypeScript = Object.values(workflows).some(w =>
                this.hasTypeScriptCheck(w.content)
              )
              return {
                passed: hasTypeScript,
                details: hasTypeScript
                  ? 'TypeScript checks configured'
                  : 'No TypeScript checks found',
                workflows: []
              }
            }
          },
          {
            id: '6.4',
            description: 'Quality check failures provide detailed feedback',
            validate: workflows => {
              const hasFeedback = Object.values(workflows).some(w =>
                this.hasDetailedFeedback(w.content)
              )
              return {
                passed: hasFeedback,
                details: hasFeedback
                  ? 'Detailed feedback configured'
                  : 'No detailed feedback found',
                workflows: []
              }
            }
          },
          {
            id: '6.5',
            description: 'All tests must pass before merge',
            validate: workflows => {
              const hasTestRequirement = Object.values(workflows).some(w =>
                this.hasTestRequirement(w.content)
              )
              return {
                passed: hasTestRequirement,
                details: hasTestRequirement
                  ? 'Test requirements configured'
                  : 'No test requirements found',
                workflows: []
              }
            }
          }
        ]
      }
    }
  }

  // Helper methods for validation checks
  hasQualityChecks (workflow) {
    const content = JSON.stringify(workflow).toLowerCase()
    return (
      content.includes('lint') ||
      content.includes('test') ||
      content.includes('prettier') ||
      content.includes('eslint')
    )
  }

  hasDeploymentSteps (workflow, environment) {
    const content = JSON.stringify(workflow).toLowerCase()
    return content.includes('deploy') && content.includes(environment)
  }

  hasManualApproval (workflow) {
    const content = JSON.stringify(workflow)
    return (
      content.includes('environment') ||
      content.includes('approval') ||
      content.includes('manual')
    )
  }

  hasRequiredStatusChecks (workflow) {
    return workflow.jobs && Object.keys(workflow.jobs).length > 0
  }

  hasStatusFeedback (workflow) {
    const content = JSON.stringify(workflow)
    return (
      content.includes('status') ||
      content.includes('comment') ||
      content.includes('notification')
    )
  }

  hasSecurityScanning (workflow) {
    const content = JSON.stringify(workflow).toLowerCase()
    return (
      content.includes('codeql') ||
      content.includes('security') ||
      content.includes('vulnerability') ||
      content.includes('sast')
    )
  }

  hasDependencyScanning (workflow) {
    const content = JSON.stringify(workflow).toLowerCase()
    return (
      content.includes('dependency') ||
      content.includes('dependabot') ||
      content.includes('audit')
    )
  }

  hasBlockingSecurityChecks (workflow) {
    return (
      workflow.jobs &&
      Object.values(workflow.jobs).some(
        job =>
          job.steps &&
          job.steps.some(
            step => step.name && step.name.toLowerCase().includes('security')
          )
      )
    )
  }

  hasSecurityReporting (workflow) {
    const content = JSON.stringify(workflow)
    return (
      content.includes('report') ||
      content.includes('sarif') ||
      content.includes('security-events')
    )
  }

  hasSecurityNotifications (workflow) {
    const content = JSON.stringify(workflow)
    return (
      content.includes('slack') ||
      content.includes('notification') ||
      content.includes('alert')
    )
  }

  hasReleaseNotesGeneration (workflow) {
    const content = JSON.stringify(workflow)
    return (
      content.includes('release') &&
      (content.includes('notes') || content.includes('changelog'))
    )
  }

  hasArtifactBuilding (workflow) {
    const content = JSON.stringify(workflow)
    return (
      content.includes('artifact') ||
      content.includes('build') ||
      content.includes('publish')
    )
  }

  hasSemanticVersioning (workflow) {
    const content = JSON.stringify(workflow)
    return (
      content.includes('semantic') ||
      content.includes('version') ||
      content.includes('conventional')
    )
  }

  hasRollbackCapability (workflow) {
    const content = JSON.stringify(workflow)
    return content.includes('rollback') || content.includes('revert')
  }

  hasDependencyUpdates (workflow) {
    const content = JSON.stringify(workflow)
    return (
      content.includes('dependency') &&
      (content.includes('update') || content.includes('upgrade'))
    )
  }

  hasPRCreationForDependencies (workflow) {
    const content = JSON.stringify(workflow)
    return (
      content.includes('pull') &&
      content.includes('request') &&
      content.includes('dependency')
    )
  }

  hasDependencySecurityChecks (workflow) {
    const content = JSON.stringify(workflow)
    return content.includes('dependency') && content.includes('security')
  }

  hasFailureReporting (workflow) {
    const content = JSON.stringify(workflow)
    return content.includes('fail') && content.includes('report')
  }

  hasAutoMergeCapability (workflow) {
    const content = JSON.stringify(workflow)
    return content.includes('auto') && content.includes('merge')
  }

  hasPerformanceTesting (workflow) {
    const content = JSON.stringify(workflow).toLowerCase()
    return (
      content.includes('performance') ||
      content.includes('lighthouse') ||
      content.includes('benchmark')
    )
  }

  hasPerformanceThresholds (workflow) {
    const content = JSON.stringify(workflow)
    return (
      content.includes('threshold') ||
      (content.includes('performance') && content.includes('check'))
    )
  }

  hasPerformanceTracking (workflow) {
    const content = JSON.stringify(workflow)
    return (
      content.includes('performance') &&
      (content.includes('track') || content.includes('monitor'))
    )
  }

  hasPerformanceComments (workflow) {
    const content = JSON.stringify(workflow)
    return content.includes('performance') && content.includes('comment')
  }

  hasPerformanceReports (workflow) {
    const content = JSON.stringify(workflow)
    return content.includes('performance') && content.includes('report')
  }

  hasPrettierCheck (workflow) {
    const content = JSON.stringify(workflow)
    return content.includes('prettier') || content.includes('format')
  }

  hasESLintCheck (workflow) {
    const content = JSON.stringify(workflow)
    return content.includes('eslint') || content.includes('lint')
  }

  hasTypeScriptCheck (workflow) {
    const content = JSON.stringify(workflow)
    return (
      content.includes('typescript') ||
      content.includes('tsc') ||
      content.includes('type-check')
    )
  }

  hasDetailedFeedback (workflow) {
    const content = JSON.stringify(workflow)
    return (
      content.includes('comment') ||
      content.includes('feedback') ||
      content.includes('annotation')
    )
  }

  hasTestRequirement (workflow) {
    const content = JSON.stringify(workflow)
    return (
      content.includes('test') &&
      (content.includes('run') ||
        content.includes('jest') ||
        content.includes('vitest'))
    )
  }

  /**
   * Validate all requirements
   */
  validateAllRequirements () {
    const results = {}
    let totalCriteria = 0
    let passedCriteria = 0

    Object.entries(this.requirements).forEach(([reqId, requirement]) => {
      const reqResults = {
        name: requirement.name,
        criteria: {},
        passed: 0,
        total: requirement.criteria.length
      }

      requirement.criteria.forEach(criterion => {
        totalCriteria++
        const result = criterion.validate(this.workflows)
        reqResults.criteria[criterion.id] = {
          description: criterion.description,
          ...result
        }

        if (result.passed) {
          passedCriteria++
          reqResults.passed++
        }
      })

      results[reqId] = reqResults
    })

    return {
      requirements: results,
      summary: {
        totalRequirements: Object.keys(this.requirements).length,
        totalCriteria,
        passedCriteria,
        passRate: Math.round((passedCriteria / totalCriteria) * 100)
      }
    }
  }

  /**
   * Generate comprehensive requirements validation report
   */
  generateReport () {
    const validation = this.validateAllRequirements()

    return {
      timestamp: new Date().toISOString(),
      summary: validation.summary,
      requirements: validation.requirements,
      workflows: Object.keys(this.workflows),
      workflowCount: Object.keys(this.workflows).length
    }
  }

  /**
   * Print validation results to console
   */
  printResults (validation) {
    console.log('\n🔍 Requirements Validation Report')
    console.log('='.repeat(60))
    console.log(`Generated: ${new Date().toISOString()}`)
    console.log(`Workflows analyzed: ${Object.keys(this.workflows).length}`)
    console.log(
      `Pass rate: ${validation.summary.passRate}% (${validation.summary.passedCriteria}/${validation.summary.totalCriteria})`
    )

    Object.entries(validation.requirements).forEach(([reqId, requirement]) => {
      const passRate = Math.round(
        (requirement.passed / requirement.total) * 100
      )
      const status = requirement.passed === requirement.total ? '✅' : '❌'

      console.log(
        `\n${status} ${requirement.name} (${requirement.passed}/${requirement.total} - ${passRate}%)`
      )

      Object.entries(requirement.criteria).forEach(
        ([criterionId, criterion]) => {
          const criterionStatus = criterion.passed ? '✅' : '❌'
          console.log(
            `   ${criterionStatus} ${criterionId}: ${criterion.description}`
          )

          if (criterion.details) {
            console.log(`      ${criterion.details}`)
          }

          if (criterion.workflows && criterion.workflows.length > 0) {
            console.log(`      Workflows: ${criterion.workflows.join(', ')}`)
          }
        }
      )
    })

    if (validation.summary.passedCriteria < validation.summary.totalCriteria) {
      console.log(
        '\n⚠️  Some requirements are not fully met. Review the failed criteria above.'
      )
    } else {
      console.log('\n🎉 All requirements are satisfied!')
    }
  }
}

// CLI Interface
program
  .name('workflow-requirements-validator')
  .description('Validate GitHub workflows against requirements')
  .version('1.0.0')

program
  .command('validate')
  .description('Validate all workflows against requirements')
  .option('--json', 'Output as JSON')
  .option('--save', 'Save report to file')
  .action(options => {
    const validator = new RequirementsValidator()
    const validation = validator.validateAllRequirements()

    if (options.json) {
      console.log(JSON.stringify(validation, null, 2))
    } else {
      validator.printResults(validation)
    }

    if (options.save) {
      const report = validator.generateReport()
      const reportPath = join(
        rootDir,
        'reports',
        'requirements-validation-report.json'
      )

      // Ensure reports directory exists
      const reportsDir = join(rootDir, 'reports')
      if (!existsSync(reportsDir)) {
        require('fs').mkdirSync(reportsDir, { recursive: true })
      }

      require('fs').writeFileSync(reportPath, JSON.stringify(report, null, 2))
      console.log(`\n📊 Report saved to: ${reportPath}`)
    }
  })

program
  .command('requirement')
  .description('Validate specific requirement')
  .argument('<id>', 'Requirement ID (e.g., requirement1, requirement2)')
  .action(id => {
    const validator = new RequirementsValidator()

    if (!validator.requirements[id]) {
      console.error(`❌ Requirement '${id}' not found`)
      console.log(
        'Available requirements:',
        Object.keys(validator.requirements).join(', ')
      )
      return
    }

    const requirement = validator.requirements[id]
    console.log(`\n🔍 Validating ${requirement.name}`)
    console.log('='.repeat(50))

    requirement.criteria.forEach(criterion => {
      const result = criterion.validate(validator.workflows)
      const status = result.passed ? '✅' : '❌'

      console.log(`${status} ${criterion.id}: ${criterion.description}`)
      if (result.details) {
        console.log(`   ${result.details}`)
      }
      if (result.workflows && result.workflows.length > 0) {
        console.log(`   Workflows: ${result.workflows.join(', ')}`)
      }
    })
  })

// Handle no command
if (process.argv.length === 2) {
  program.help()
}

program.parse()
