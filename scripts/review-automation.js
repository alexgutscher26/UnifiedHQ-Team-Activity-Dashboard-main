#!/usr/bin/env node

/**
 * Review Automation
 * Automates various aspects of the code review process
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

class ReviewAutomation {
  constructor () {
    this.projectRoot = process.cwd()
    this.config = this.loadConfig()
  }

  /**
   * Load review configuration
   */
  loadConfig () {
    const configPath = path.join(
      this.projectRoot,
      '.github',
      'review-config.yml'
    )
    if (fs.existsSync(configPath)) {
      // In a real implementation, you'd use a YAML parser
      return {
        review_bot: { enabled: true },
        file_reviewers: {},
        auto_labels: { enabled: true },
        automation: { auto_assign: { enabled: true } }
      }
    }
    return {}
  }

  /**
   * Auto-assign reviewers based on changed files
   */
  async autoAssignReviewers (prNumber) {
    console.log(`🔍 Auto-assigning reviewers for PR #${prNumber}...`)

    try {
      // Get changed files
      const changedFiles = execSync('git diff --name-only HEAD~1 HEAD', {
        encoding: 'utf8'
      })
      const files = changedFiles
        .trim()
        .split('\n')
        .filter(f => f)

      const reviewers = new Set()
      const teamReviewers = new Set()

      // Assign reviewers based on file patterns
      for (const file of files) {
        if (file.startsWith('src/lib/integrations/')) {
          teamReviewers.add('@backend-team')
          teamReviewers.add('@integrations-team')
        } else if (file.startsWith('src/components/')) {
          teamReviewers.add('@frontend-team')
          teamReviewers.add('@ui-team')
        } else if (file.startsWith('src/app/api/')) {
          teamReviewers.add('@backend-team')
          teamReviewers.add('@api-team')
        } else if (file.startsWith('prisma/')) {
          teamReviewers.add('@backend-team')
          teamReviewers.add('@database-team')
        } else if (file.startsWith('docs/')) {
          teamReviewers.add('@documentation-team')
        } else if (file.startsWith('.github/')) {
          teamReviewers.add('@devops-team')
          teamReviewers.add('@maintainers')
        }
      }

      // Check for critical files
      const criticalFiles = [
        'src/lib/auth.ts',
        'src/lib/integrations/github.ts',
        'src/app/api/auth/',
        'prisma/schema.prisma'
      ]

      const hasCriticalFiles = files.some(file =>
        criticalFiles.some(critical => file.includes(critical))
      )

      if (hasCriticalFiles) {
        teamReviewers.add('@security-team')
      }

      console.log(
        `📋 Assigned reviewers: ${Array.from(teamReviewers).join(', ')}`
      )
      return Array.from(teamReviewers)
    } catch (error) {
      console.error('Error auto-assigning reviewers:', error.message)
      return []
    }
  }

  /**
   * Auto-label PR based on content
   */
  async autoLabelPR (prNumber) {
    console.log(`🏷️ Auto-labeling PR #${prNumber}...`)

    try {
      const labels = new Set()

      // Get PR title and description
      const prInfo = execSync(`gh pr view ${prNumber} --json title,body`, {
        encoding: 'utf8'
      })
      const pr = JSON.parse(prInfo)

      // Label based on title
      const title = pr.title.toLowerCase()
      if (title.includes('fix') || title.includes('bug')) {
        labels.add('bug-fix')
      } else if (title.includes('feat') || title.includes('feature')) {
        labels.add('feature')
      } else if (title.includes('refactor')) {
        labels.add('refactor')
      } else if (title.includes('docs')) {
        labels.add('documentation')
      }

      // Label based on changed files
      const changedFiles = execSync('git diff --name-only HEAD~1 HEAD', {
        encoding: 'utf8'
      })
      const files = changedFiles
        .trim()
        .split('\n')
        .filter(f => f)

      if (files.some(f => f.startsWith('src/components/'))) {
        labels.add('frontend')
      }
      if (files.some(f => f.startsWith('src/app/api/'))) {
        labels.add('backend')
      }
      if (files.some(f => f.startsWith('src/lib/integrations/'))) {
        labels.add('integrations')
      }
      if (files.some(f => f.startsWith('prisma/'))) {
        labels.add('database')
      }
      if (files.some(f => f.startsWith('docs/'))) {
        labels.add('documentation')
      }
      if (files.some(f => f.startsWith('.github/'))) {
        labels.add('devops')
      }

      // Label based on size
      const totalChanges = files.reduce((sum, file) => {
        try {
          const changes = execSync(
            `git diff --numstat HEAD~1 HEAD -- ${file}`,
            { encoding: 'utf8' }
          )
          const match = changes.match(/(\d+)\s+(\d+)/)
          if (match) {
            return sum + parseInt(match[1]) + parseInt(match[2])
          }
        } catch (error) {
          // File might be new or deleted
        }
        return sum
      }, 0)

      if (totalChanges > 500) {
        labels.add('large-pr')
      } else if (totalChanges > 100) {
        labels.add('medium-pr')
      } else {
        labels.add('small-pr')
      }

      console.log(`🏷️ Labels: ${Array.from(labels).join(', ')}`)
      return Array.from(labels)
    } catch (error) {
      console.error('Error auto-labeling PR:', error.message)
      return []
    }
  }

  /**
   * Generate review checklist
   */
  generateReviewChecklist (prNumber) {
    console.log(`📋 Generating review checklist for PR #${prNumber}...`)

    const checklist = {
      code_quality: [
        'Code follows project style guidelines',
        'Self-review completed',
        'Code is properly commented',
        'No console.log statements left in code',
        'No TODO comments left in code',
        'Error handling is implemented',
        'TypeScript types are properly defined',
        'No unused imports or variables'
      ],
      performance: [
        'No performance regressions introduced',
        'Database queries are optimized',
        'Images are optimized (using OptimizedImage component)',
        'GitHub API calls use caching where appropriate',
        'Memory leaks prevented'
      ],
      security: [
        'No sensitive data exposed',
        'Input validation implemented',
        'Authentication/authorization handled properly',
        'No hardcoded secrets'
      ],
      project_specific: [
        'GitHub integration follows caching rules',
        'Image optimization uses proper components',
        'Error handling is comprehensive',
        'TypeScript types are correct',
        'Database operations are efficient',
        'UI/UX is consistent with design system'
      ]
    }

    return checklist
  }

  /**
   * Check PR readiness
   */
  async checkPRReadiness (prNumber) {
    console.log(`✅ Checking PR readiness for #${prNumber}...`)

    const checks = {
      build: false,
      tests: false,
      lint: false,
      format: false,
      types: false
    }

    try {
      // Check build
      try {
        execSync('bun run build', { stdio: 'pipe' })
        checks.build = true
      } catch (error) {
        console.log('❌ Build failed')
      }

      // Check linting
      try {
        execSync('bun run lint', { stdio: 'pipe' })
        checks.lint = true
      } catch (error) {
        console.log('❌ Linting failed')
      }

      // Check formatting
      try {
        execSync('bun run format:check', { stdio: 'pipe' })
        checks.format = true
      } catch (error) {
        console.log('❌ Formatting check failed')
      }

      // Check TypeScript
      try {
        execSync('npx tsc --noEmit', { stdio: 'pipe' })
        checks.types = true
      } catch (error) {
        console.log('❌ TypeScript check failed')
      }

      // Check tests (if available)
      try {
        execSync('npm test', { stdio: 'pipe' })
        checks.tests = true
      } catch (error) {
        console.log('⚠️ Tests not available or failed')
      }
    } catch (error) {
      console.error('Error checking PR readiness:', error.message)
    }

    const allPassed = Object.values(checks).every(check => check)
    console.log(`📊 PR readiness: ${allPassed ? '✅ Ready' : '❌ Not ready'}`)

    return { checks, ready: allPassed }
  }

  /**
   * Generate review summary
   */
  generateReviewSummary (prNumber, reviewData) {
    console.log(`📝 Generating review summary for PR #${prNumber}...`)

    const summary = {
      pr_number: prNumber,
      timestamp: new Date().toISOString(),
      readiness: reviewData.readiness,
      reviewers: reviewData.reviewers || [],
      labels: reviewData.labels || [],
      checklist: reviewData.checklist || {},
      recommendations: []
    }

    // Add recommendations based on checks
    if (!reviewData.readiness.checks.build) {
      summary.recommendations.push('Fix build errors before requesting review')
    }
    if (!reviewData.readiness.checks.lint) {
      summary.recommendations.push('Fix linting errors')
    }
    if (!reviewData.readiness.checks.format) {
      summary.recommendations.push('Fix formatting issues')
    }
    if (!reviewData.readiness.checks.types) {
      summary.recommendations.push('Fix TypeScript errors')
    }

    return summary
  }

  /**
   * Run automation for a PR
   */
  async runForPR (prNumber) {
    console.log(`🚀 Running automation for PR #${prNumber}...`)

    try {
      // Auto-assign reviewers
      const reviewers = await this.autoAssignReviewers(prNumber)

      // Auto-label PR
      const labels = await this.autoLabelPR(prNumber)

      // Check PR readiness
      const readiness = await this.checkPRReadiness(prNumber)

      // Generate checklist
      const checklist = this.generateReviewChecklist(prNumber)

      // Generate summary
      const summary = this.generateReviewSummary(prNumber, {
        readiness,
        reviewers,
        labels,
        checklist
      })

      // Save summary
      const summaryPath = path.join(
        this.projectRoot,
        `pr-${prNumber}-summary.json`
      )
      fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2))

      console.log(`✅ Automation complete for PR #${prNumber}`)
      console.log(`📄 Summary saved to: ${summaryPath}`)

      return summary
    } catch (error) {
      console.error('Error running automation:', error.message)
      return null
    }
  }
}

// Run if called directly
if (require.main === module) {
  const prNumber = process.argv[2]
  if (!prNumber) {
    console.error('Please provide a PR number')
    process.exit(1)
  }

  const automation = new ReviewAutomation()
  automation.runForPR(prNumber).catch(console.error)
}

module.exports = ReviewAutomation
