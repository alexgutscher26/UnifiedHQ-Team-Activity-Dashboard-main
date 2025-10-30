#!/usr/bin/env node

/**
 * GitHub Workflow Performance Optimization Utility
 *
 * This script analyzes and optimizes GitHub workflows for better performance
 * by implementing conditional execution, improved caching, and parallel job strategies.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { program } from 'commander'
import yaml from 'js-yaml'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')
const workflowsDir = join(rootDir, '.github', 'workflows')

class WorkflowOptimizer {
  constructor () {
    this.workflows = this.loadWorkflows()
    this.optimizations = this.initializeOptimizations()
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
   * Initialize optimization strategies
   */
  initializeOptimizations () {
    return {
      conditionalExecution: {
        name: 'Conditional Job Execution',
        description:
          'Add path-based conditional execution to skip unnecessary jobs',
        apply: this.addConditionalExecution.bind(this)
      },
      improvedCaching: {
        name: 'Improved Caching Strategy',
        description: 'Optimize caching for better performance and reliability',
        apply: this.improveCaching.bind(this)
      },
      parallelJobs: {
        name: 'Parallel Job Execution',
        description: 'Optimize job dependencies for maximum parallelization',
        apply: this.optimizeParallelJobs.bind(this)
      },
      concurrencyControl: {
        name: 'Concurrency Control',
        description: 'Add concurrency control to prevent duplicate runs',
        apply: this.addConcurrencyControl.bind(this)
      },
      matrixOptimization: {
        name: 'Matrix Strategy Optimization',
        description: 'Optimize matrix strategies for better resource usage',
        apply: this.optimizeMatrix.bind(this)
      }
    }
  }

  /**
   * Add conditional execution based on file changes
   */
  addConditionalExecution (workflow, workflowName) {
    const optimizations = []

    // Define path patterns for different workflow types
    const pathPatterns = {
      'ci.yml': {
        'src/**': 'Source code changes',
        'package.json': 'Dependencies changed',
        'bun.lockb': 'Lock file changed',
        'tsconfig.json': 'TypeScript config changed',
        'eslint.config.js': 'ESLint config changed',
        '.prettierrc': 'Prettier config changed'
      },
      'security.yml': {
        'src/**': 'Source code changes',
        'package.json': 'Dependencies changed',
        'bun.lockb': 'Lock file changed',
        '.github/workflows/**': 'Workflow changes'
      },
      'performance.yml': {
        'src/**': 'Source code changes',
        'package.json': 'Dependencies changed',
        'next.config.mjs': 'Next.js config changed',
        'tailwind.config.ts': 'Tailwind config changed'
      },
      'dependencies.yml': {
        'package.json': 'Dependencies changed',
        'bun.lockb': 'Lock file changed'
      }
    }

    const patterns = pathPatterns[workflowName]
    if (!patterns) return optimizations

    // Add path filters to workflow triggers
    if (workflow.on && (workflow.on.push || workflow.on.pull_request)) {
      const pathsFilter = Object.keys(patterns)

      if (workflow.on.push && !workflow.on.push.paths) {
        workflow.on.push.paths = pathsFilter
        optimizations.push(
          `Added path filters to push trigger: ${pathsFilter.join(', ')}`
        )
      }

      if (workflow.on.pull_request && !workflow.on.pull_request.paths) {
        workflow.on.pull_request.paths = pathsFilter
        optimizations.push(
          `Added path filters to pull_request trigger: ${pathsFilter.join(', ')}`
        )
      }
    }

    // Add conditional job execution
    if (workflow.jobs) {
      Object.entries(workflow.jobs).forEach(([jobName, job]) => {
        // Skip jobs that already have conditions
        if (job.if) return

        // Add conditions based on job type
        let condition = null

        if (jobName.includes('test') || jobName.includes('lint')) {
          condition =
            "contains(github.event.head_commit.modified, 'src/') || contains(github.event.head_commit.modified, 'package.json')"
        } else if (jobName.includes('build')) {
          condition =
            "contains(github.event.head_commit.modified, 'src/') || contains(github.event.head_commit.modified, 'package.json') || contains(github.event.head_commit.modified, 'next.config.mjs')"
        } else if (jobName.includes('security')) {
          condition =
            "contains(github.event.head_commit.modified, 'src/') || contains(github.event.head_commit.modified, 'package.json') || contains(github.event.head_commit.modified, '.github/')"
        }

        if (condition) {
          job.if = condition
          optimizations.push(`Added conditional execution to job '${jobName}'`)
        }
      })
    }

    return optimizations
  }

  /**
   * Improve caching strategies
   */
  improveCaching (workflow, workflowName) {
    const optimizations = []

    if (!workflow.jobs) return optimizations

    Object.entries(workflow.jobs).forEach(([jobName, job]) => {
      if (!job.steps) return

      let hasDependencyCache = false
      let hasNextCache = false
      let hasTypeScriptCache = false

      // Check existing caches
      job.steps.forEach(step => {
        if (step.uses?.includes('actions/cache')) {
          if (step.with?.path) {
            const paths = Array.isArray(step.with.path)
              ? step.with.path
              : [step.with.path]
            if (
              paths.some(p => p.includes('node_modules') || p.includes('bun'))
            ) {
              hasDependencyCache = true
            }
            if (paths.some(p => p.includes('.next'))) {
              hasNextCache = true
            }
            if (paths.some(p => p.includes('.tsbuildinfo'))) {
              hasTypeScriptCache = true
            }
          }
        }
      })

      // Add missing caches
      const cacheSteps = []

      // Dependency cache
      if (!hasDependencyCache && this.jobNeedsDependencies(job)) {
        cacheSteps.push({
          name: 'Cache dependencies',
          uses: 'actions/cache@v4',
          with: {
            path: ['node_modules', '~/.bun/install/cache'],
            key: "${{ runner.os }}-bun-${{ hashFiles('**/bun.lockb', '**/package.json') }}",
            'restore-keys': '${{ runner.os }}-bun-'
          }
        })
        optimizations.push(`Added dependency caching to job '${jobName}'`)
      }

      // Next.js cache
      if (!hasNextCache && this.jobBuildsNext(job)) {
        cacheSteps.push({
          name: 'Cache Next.js build',
          uses: 'actions/cache@v4',
          with: {
            path: ['.next/cache'],
            key: "${{ runner.os }}-nextjs-${{ hashFiles('**/bun.lockb') }}-${{ hashFiles('**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx') }}",
            'restore-keys': [
              "${{ runner.os }}-nextjs-${{ hashFiles('**/bun.lockb') }}-",
              '${{ runner.os }}-nextjs-'
            ]
          }
        })
        optimizations.push(`Added Next.js build caching to job '${jobName}'`)
      }

      // TypeScript cache
      if (!hasTypeScriptCache && this.jobUsesTypeScript(job)) {
        cacheSteps.push({
          name: 'Cache TypeScript build',
          uses: 'actions/cache@v4',
          with: {
            path: ['**/.tsbuildinfo'],
            key: "${{ runner.os }}-typescript-${{ hashFiles('**/tsconfig.json', '**/*.ts', '**/*.tsx') }}",
            'restore-keys': '${{ runner.os }}-typescript-'
          }
        })
        optimizations.push(`Added TypeScript caching to job '${jobName}'`)
      }

      // Insert cache steps after checkout
      if (cacheSteps.length > 0) {
        const checkoutIndex = job.steps.findIndex(step =>
          step.uses?.includes('actions/checkout')
        )

        if (checkoutIndex !== -1) {
          job.steps.splice(checkoutIndex + 1, 0, ...cacheSteps)
        }
      }
    })

    return optimizations
  }

  /**
   * Optimize parallel job execution
   */
  optimizeParallelJobs (workflow, workflowName) {
    const optimizations = []

    if (!workflow.jobs) return optimizations

    // Analyze job dependencies
    const jobDeps = {}
    const independentJobs = []

    Object.entries(workflow.jobs).forEach(([jobName, job]) => {
      if (job.needs) {
        jobDeps[jobName] = Array.isArray(job.needs) ? job.needs : [job.needs]
      } else {
        independentJobs.push(jobName)
      }
    })

    // Identify jobs that can run in parallel
    const parallelGroups = this.identifyParallelGroups(
      jobDeps,
      independentJobs
    )

    if (parallelGroups.length > 1) {
      optimizations.push(
        `Identified ${parallelGroups.length} parallel job groups: ${parallelGroups.map(g => g.join(', ')).join(' | ')}`
      )
    }

    // Optimize matrix strategies
    Object.entries(workflow.jobs).forEach(([jobName, job]) => {
      if (job.strategy?.matrix) {
        const matrixOptimizations = this.optimizeJobMatrix(
          job.strategy.matrix,
          jobName
        )
        optimizations.push(...matrixOptimizations)
      }
    })

    return optimizations
  }

  /**
   * Add concurrency control
   */
  addConcurrencyControl (workflow, workflowName) {
    const optimizations = []

    if (!workflow.concurrency) {
      workflow.concurrency = {
        group: '${{ github.workflow }}-${{ github.ref }}',
        'cancel-in-progress': true
      }
      optimizations.push('Added concurrency control to prevent duplicate runs')
    }

    return optimizations
  }

  /**
   * Optimize matrix strategies
   */
  optimizeMatrix (workflow, workflowName) {
    const optimizations = []

    if (!workflow.jobs) return optimizations

    Object.entries(workflow.jobs).forEach(([jobName, job]) => {
      if (job.strategy?.matrix) {
        const matrix = job.strategy.matrix

        // Optimize Node.js versions
        if (matrix['node-version']) {
          const versions = matrix['node-version']
          if (
            versions.includes('18.x') &&
            versions.includes('20.x') &&
            versions.length > 2
          ) {
            matrix['node-version'] = ['18.x', '20.x'] // Keep only LTS versions
            optimizations.push(
              `Optimized Node.js matrix for job '${jobName}' to LTS versions only`
            )
          }
        }

        // Add fail-fast strategy
        if (!job.strategy['fail-fast']) {
          job.strategy['fail-fast'] = false // Don't fail fast to see all results
          optimizations.push(`Added fail-fast strategy to job '${jobName}'`)
        }

        // Add max-parallel limit for large matrices
        const matrixSize = Object.values(matrix).reduce(
          (acc, val) => acc * (Array.isArray(val) ? val.length : 1),
          1
        )

        if (matrixSize > 6 && !job.strategy['max-parallel']) {
          job.strategy['max-parallel'] = 4
          optimizations.push(
            `Added max-parallel limit to job '${jobName}' (matrix size: ${matrixSize})`
          )
        }
      }
    })

    return optimizations
  }

  /**
   * Helper methods
   */
  jobNeedsDependencies (job) {
    return job.steps.some(
      step =>
        (step.run &&
          (step.run.includes('bun install') ||
            step.run.includes('npm install'))) ||
        step.uses?.includes('setup-bun')
    )
  }

  jobBuildsNext (job) {
    return job.steps.some(
      step =>
        step.run &&
        (step.run.includes('bun run build') || step.run.includes('next build'))
    )
  }

  jobUsesTypeScript (job) {
    return job.steps.some(
      step =>
        step.run &&
        (step.run.includes('tsc') || step.run.includes('type check'))
    )
  }

  identifyParallelGroups (jobDeps, independentJobs) {
    const groups = []
    const processed = new Set()

    // Independent jobs form the first group
    if (independentJobs.length > 0) {
      groups.push(independentJobs)
      independentJobs.forEach(job => processed.add(job))
    }

    // Group jobs by their dependency level
    let currentLevel = [...independentJobs]

    while (currentLevel.length > 0) {
      const nextLevel = []

      Object.entries(jobDeps).forEach(([jobName, deps]) => {
        if (!processed.has(jobName) && deps.every(dep => processed.has(dep))) {
          nextLevel.push(jobName)
        }
      })

      if (nextLevel.length > 0) {
        groups.push(nextLevel)
        nextLevel.forEach(job => processed.add(job))
        currentLevel = nextLevel
      } else {
        break
      }
    }

    return groups
  }

  optimizeJobMatrix (matrix, jobName) {
    const optimizations = []

    // Check for redundant combinations
    const keys = Object.keys(matrix)
    if (keys.length > 1) {
      const combinations = this.getMatrixCombinations(matrix)
      if (combinations.length > 8) {
        optimizations.push(
          `Job '${jobName}' has ${combinations.length} matrix combinations - consider reducing`
        )
      }
    }

    return optimizations
  }

  getMatrixCombinations (matrix) {
    const keys = Object.keys(matrix)
    const values = keys.map(key =>
      Array.isArray(matrix[key]) ? matrix[key] : [matrix[key]]
    )

    const combinations = []
    const generate = (current, index) => {
      if (index === keys.length) {
        combinations.push({ ...current })
        return
      }

      values[index].forEach(value => {
        current[keys[index]] = value
        generate(current, index + 1)
      })
    }

    generate({}, 0)
    return combinations
  }

  /**
   * Analyze workflow performance
   */
  analyzeWorkflow (workflowName) {
    const workflow = this.workflows[workflowName]
    if (!workflow) {
      console.error(`❌ Workflow not found: ${workflowName}`)
      return null
    }

    const analysis = {
      name: workflowName,
      title: workflow.content.name || 'Unnamed',
      issues: [],
      suggestions: [],
      metrics: {
        jobCount: 0,
        matrixSize: 0,
        hasCache: false,
        hasConcurrency: false,
        hasConditionals: false,
        parallelGroups: 0
      }
    }

    // Basic metrics
    if (workflow.content.jobs) {
      analysis.metrics.jobCount = Object.keys(workflow.content.jobs).length

      // Check for caching
      analysis.metrics.hasCache = Object.values(workflow.content.jobs).some(
        job => job.steps?.some(step => step.uses?.includes('actions/cache'))
      )

      // Check for conditionals
      analysis.metrics.hasConditionals = Object.values(
        workflow.content.jobs
      ).some(job => job.if)

      // Calculate matrix size
      Object.values(workflow.content.jobs).forEach(job => {
        if (job.strategy?.matrix) {
          const size = this.getMatrixCombinations(job.strategy.matrix).length
          analysis.metrics.matrixSize += size
        }
      })
    }

    // Check concurrency
    analysis.metrics.hasConcurrency = !!workflow.content.concurrency

    // Identify issues
    if (!analysis.metrics.hasCache && analysis.metrics.jobCount > 1) {
      analysis.issues.push(
        'No caching detected - workflows may be slower than necessary'
      )
    }

    if (!analysis.metrics.hasConcurrency) {
      analysis.issues.push('No concurrency control - may have duplicate runs')
    }

    if (analysis.metrics.matrixSize > 10) {
      analysis.issues.push(
        `Large matrix size (${analysis.metrics.matrixSize}) - may consume excessive resources`
      )
    }

    if (
      !analysis.metrics.hasConditionals &&
      workflow.content.on &&
      (workflow.content.on.push || workflow.content.on.pull_request)
    ) {
      analysis.issues.push(
        'No conditional execution - jobs run even when unnecessary'
      )
    }

    return analysis
  }

  /**
   * Apply optimizations to a workflow
   */
  optimizeWorkflow (workflowName, optimizationTypes = null) {
    const workflow = this.workflows[workflowName]
    if (!workflow) {
      console.error(`❌ Workflow not found: ${workflowName}`)
      return false
    }

    console.log(`\n🔧 Optimizing workflow: ${workflowName}`)

    const appliedOptimizations = []
    const optimizationsToApply =
      optimizationTypes || Object.keys(this.optimizations)

    optimizationsToApply.forEach(optType => {
      if (this.optimizations[optType]) {
        try {
          const results = this.optimizations[optType].apply(
            workflow.content,
            workflowName
          )
          if (results.length > 0) {
            appliedOptimizations.push({
              type: optType,
              name: this.optimizations[optType].name,
              results
            })
          }
        } catch (error) {
          console.error(`❌ Failed to apply ${optType}:`, error.message)
        }
      }
    })

    if (appliedOptimizations.length > 0) {
      // Save optimized workflow
      const optimizedYaml = yaml.dump(workflow.content, {
        indent: 2,
        lineWidth: 120,
        noRefs: true
      })

      try {
        writeFileSync(workflow.path, optimizedYaml)
        console.log(
          `✅ Applied ${appliedOptimizations.length} optimization(s) to ${workflowName}`
        )

        appliedOptimizations.forEach(opt => {
          console.log(`\n📈 ${opt.name}:`)
          opt.results.forEach(result => console.log(`   • ${result}`))
        })

        return true
      } catch (error) {
        console.error('❌ Failed to save optimized workflow:', error.message)
        return false
      }
    } else {
      console.log(`ℹ️  No optimizations needed for ${workflowName}`)
      return true
    }
  }

  /**
   * Optimize all workflows
   */
  optimizeAllWorkflows (optimizationTypes = null) {
    console.log('\n🚀 Optimizing all workflows...')
    console.log('='.repeat(50))

    let optimizedCount = 0
    let totalCount = 0

    Object.keys(this.workflows).forEach(workflowName => {
      totalCount++
      if (this.optimizeWorkflow(workflowName, optimizationTypes)) {
        optimizedCount++
      }
    })

    console.log('\n📊 Optimization Summary:')
    console.log(`   Total workflows: ${totalCount}`)
    console.log(`   Optimized workflows: ${optimizedCount}`)

    return optimizedCount === totalCount
  }

  /**
   * Generate optimization report
   */
  generateOptimizationReport () {
    const report = {
      timestamp: new Date().toISOString(),
      workflows: {},
      summary: {
        total: 0,
        needsOptimization: 0,
        optimized: 0
      }
    }

    Object.keys(this.workflows).forEach(workflowName => {
      const analysis = this.analyzeWorkflow(workflowName)
      if (analysis) {
        report.workflows[workflowName] = analysis
        report.summary.total++

        if (analysis.issues.length > 0) {
          report.summary.needsOptimization++
        }
      }
    })

    return report
  }
}

// CLI Interface
program
  .name('workflow-optimize')
  .description('GitHub Workflow Performance Optimization Utility')
  .version('1.0.0')

program
  .command('analyze')
  .description('Analyze workflow performance')
  .argument('[workflow]', 'Workflow filename to analyze')
  .option('--all', 'Analyze all workflows')
  .option('--json', 'Output as JSON')
  .action((workflow, options) => {
    const optimizer = new WorkflowOptimizer()

    if (options.all || !workflow) {
      const report = optimizer.generateOptimizationReport()

      if (options.json) {
        console.log(JSON.stringify(report, null, 2))
      } else {
        console.log('\n📊 Workflow Performance Analysis')
        console.log('='.repeat(50))

        Object.entries(report.workflows).forEach(([name, analysis]) => {
          console.log(`\n📄 ${name} (${analysis.title})`)
          console.log(
            `   Jobs: ${analysis.metrics.jobCount} | Matrix: ${analysis.metrics.matrixSize} | Cache: ${analysis.metrics.hasCache ? '✅' : '❌'} | Concurrency: ${analysis.metrics.hasConcurrency ? '✅' : '❌'}`
          )

          if (analysis.issues.length > 0) {
            console.log('   Issues:')
            analysis.issues.forEach(issue => console.log(`     • ${issue}`))
          }
        })

        console.log('\n📈 Summary:')
        console.log(`   Total workflows: ${report.summary.total}`)
        console.log(
          `   Need optimization: ${report.summary.needsOptimization}`
        )
      }
    } else {
      const analysis = optimizer.analyzeWorkflow(workflow)

      if (options.json) {
        console.log(JSON.stringify(analysis, null, 2))
      } else if (analysis) {
        console.log(`\n📄 ${analysis.name} (${analysis.title})`)
        console.log('─'.repeat(50))
        console.log(`Jobs: ${analysis.metrics.jobCount}`)
        console.log(`Matrix combinations: ${analysis.metrics.matrixSize}`)
        console.log(`Has caching: ${analysis.metrics.hasCache ? '✅' : '❌'}`)
        console.log(
          `Has concurrency control: ${analysis.metrics.hasConcurrency ? '✅' : '❌'}`
        )
        console.log(
          `Has conditionals: ${analysis.metrics.hasConditionals ? '✅' : '❌'}`
        )

        if (analysis.issues.length > 0) {
          console.log('\n⚠️  Issues:')
          analysis.issues.forEach(issue => console.log(`   • ${issue}`))
        }

        if (analysis.suggestions.length > 0) {
          console.log('\n💡 Suggestions:')
          analysis.suggestions.forEach(suggestion =>
            console.log(`   • ${suggestion}`)
          )
        }
      }
    }
  })

program
  .command('optimize')
  .description('Optimize workflow performance')
  .argument('[workflow]', 'Workflow filename to optimize')
  .option('--all', 'Optimize all workflows')
  .option(
    '--types <types>',
    'Optimization types (conditionalExecution,improvedCaching,parallelJobs,concurrencyControl,matrixOptimization)',
    'conditionalExecution,improvedCaching,parallelJobs,concurrencyControl,matrixOptimization'
  )
  .action((workflow, options) => {
    const optimizer = new WorkflowOptimizer()
    const types = options.types.split(',')

    if (options.all || !workflow) {
      optimizer.optimizeAllWorkflows(types)
    } else {
      optimizer.optimizeWorkflow(workflow, types)
    }
  })

program
  .command('report')
  .description('Generate optimization report')
  .option(
    '--output <file>',
    'Output file path',
    'workflow-optimization-report.json'
  )
  .option('--json', 'Output to console as JSON')
  .action(options => {
    const optimizer = new WorkflowOptimizer()
    const report = optimizer.generateOptimizationReport()

    if (options.json) {
      console.log(JSON.stringify(report, null, 2))
    } else {
      console.log('\n📊 Workflow Optimization Report')
      console.log('='.repeat(50))
      console.log(`Generated: ${report.timestamp}`)
      console.log(`Total workflows: ${report.summary.total}`)
      console.log(`Need optimization: ${report.summary.needsOptimization}`)

      if (report.summary.needsOptimization > 0) {
        console.log('\n⚠️  Workflows needing optimization:')
        Object.entries(report.workflows).forEach(([name, analysis]) => {
          if (analysis.issues.length > 0) {
            console.log(`\n   ${name}:`)
            analysis.issues.forEach(issue => console.log(`     • ${issue}`))
          }
        })
      }

      // Save report
      try {
        const reportsDir = join(rootDir, 'reports')
        if (!existsSync(reportsDir)) {
          require('fs').mkdirSync(reportsDir, { recursive: true })
        }

        const reportPath = join(reportsDir, options.output)
        writeFileSync(reportPath, JSON.stringify(report, null, 2))
        console.log(`\n📄 Report saved to: ${reportPath}`)
      } catch (error) {
        console.error('❌ Failed to save report:', error.message)
      }
    }
  })

// Handle no command
if (process.argv.length === 2) {
  program.help()
}

program.parse()
