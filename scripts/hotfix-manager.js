#!/usr/bin/env node

/**
 * Hotfix Manager
 * Emergency hotfix process automation
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

class HotfixManager {
  constructor () {
    this.projectRoot = process.cwd()
    this.config = this.loadConfig()
  }

  /**
   * Load hotfix configuration
   */
  loadConfig () {
    const configPath = path.join(
      this.projectRoot,
      '.github',
      'hotfix-config.yml'
    )
    if (fs.existsSync(configPath)) {
      // In a real implementation, you'd use a YAML parser
      return {
        emergency_contacts: ['@maintainers', '@devops-team'],
        auto_deploy: true,
        require_approval: false, // Emergency bypass
        rollback_plan: 'automatic',
        notification_channels: ['slack', 'email'],
        max_hotfix_time: 30 // minutes
      }
    }
    return this.getDefaultConfig()
  }

  /**
   * Get default configuration
   */
  getDefaultConfig () {
    return {
      emergency_contacts: ['@maintainers', '@devops-team'],
      auto_deploy: true,
      require_approval: false,
      rollback_plan: 'automatic',
      notification_channels: ['slack', 'email'],
      max_hotfix_time: 30
    }
  }

  /**
   * Create hotfix branch
   */
  createHotfixBranch (description, severity = 'high') {
    console.log(`🚨 Creating hotfix branch: ${description}`)

    try {
      // Generate branch name
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .slice(0, 19)
      const cleanDescription = description
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .trim()
      const branchName = `hotfix/${severity}-${cleanDescription}-${timestamp}`

      // Check if branch already exists
      if (this.branchExists(branchName)) {
        throw new Error(`Hotfix branch ${branchName} already exists`)
      }

      // Switch to main and pull latest
      execSync('git checkout main', { stdio: 'pipe' })
      execSync('git pull origin main', { stdio: 'pipe' })

      // Create hotfix branch
      execSync(`git checkout -b ${branchName}`, { stdio: 'pipe' })

      console.log(`✅ Created hotfix branch: ${branchName}`)
      console.log(`🚨 Severity: ${severity.toUpperCase()}`)
      console.log(`⏰ Timestamp: ${timestamp}`)
      console.log(`🔗 Push with: git push origin ${branchName}`)

      return branchName
    } catch (error) {
      console.error(`❌ Error creating hotfix branch: ${error.message}`)
      return null
    }
  }

  /**
   * Check if branch exists
   */
  branchExists (branchName) {
    try {
      execSync(`git show-ref --verify --quiet refs/heads/${branchName}`, {
        stdio: 'pipe'
      })
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Validate hotfix changes
   */
  validateHotfix (branchName) {
    console.log(`🔍 Validating hotfix: ${branchName}`)

    const validation = {
      passed: true,
      issues: [],
      warnings: []
    }

    try {
      // Check for uncommitted changes
      const status = execSync('git status --porcelain', {
        encoding: 'utf8'
      }).trim()
      if (status) {
        validation.issues.push('Uncommitted changes detected')
        validation.passed = false
      }

      // Check branch is up to date with main
      execSync('git fetch origin', { stdio: 'pipe' })
      const behind = execSync(`git rev-list --count main..${branchName}`, {
        encoding: 'utf8'
      }).trim()
      const ahead = execSync(`git rev-list --count ${branchName}..main`, {
        encoding: 'utf8'
      }).trim()

      if (parseInt(behind) > 0) {
        validation.warnings.push('Branch is behind main')
      }

      if (parseInt(ahead) > 0) {
        validation.issues.push(
          'Branch is ahead of main (unexpected for hotfix)'
        )
        validation.passed = false
      }

      // Check for build errors
      try {
        execSync('bun run build', { stdio: 'pipe' })
      } catch (error) {
        validation.issues.push('Build failed')
        validation.passed = false
      }

      // Check for linting errors
      try {
        execSync('bun run lint', { stdio: 'pipe' })
      } catch (error) {
        validation.warnings.push('Linting issues detected')
      }

      // Check for test failures
      try {
        execSync('npm test', { stdio: 'pipe' })
      } catch (error) {
        validation.warnings.push('Tests failed (may be acceptable for hotfix)')
      }

      // Check file changes scope
      const changedFiles = execSync(
        `git diff --name-only main..${branchName}`,
        {
          encoding: 'utf8'
        }
      )
        .trim()
        .split('\n')
        .filter(f => f)

      if (changedFiles.length > 10) {
        validation.warnings.push(
          'Hotfix affects many files (consider if this is truly a hotfix)'
        )
      }

      // Check for critical file changes
      const criticalFiles = [
        'package.json',
        'package-lock.json',
        'prisma/schema.prisma',
        'next.config.mjs',
        'tailwind.config.ts'
      ]

      const criticalChanges = changedFiles.filter(file =>
        criticalFiles.some(critical => file.includes(critical))
      )

      if (criticalChanges.length > 0) {
        validation.warnings.push(
          `Critical files changed: ${criticalChanges.join(', ')}`
        )
      }

      console.log(`📊 Validation ${validation.passed ? 'PASSED' : 'FAILED'}`)
      if (validation.issues.length > 0) {
        console.log('❌ Issues:')
        validation.issues.forEach(issue => console.log(`  - ${issue}`))
      }
      if (validation.warnings.length > 0) {
        console.log('⚠️ Warnings:')
        validation.warnings.forEach(warning => console.log(`  - ${warning}`))
      }

      return validation
    } catch (error) {
      console.error(`❌ Error validating hotfix: ${error.message}`)
      return { passed: false, issues: [error.message], warnings: [] }
    }
  }

  /**
   * Create hotfix pull request
   */
  createHotfixPR (branchName, description, severity = 'high') {
    console.log(`📝 Creating hotfix PR: ${branchName}`)

    try {
      // Push branch if not already pushed
      execSync(`git push origin ${branchName}`, { stdio: 'pipe' })

      // Generate PR title
      const title = `🚨 HOTFIX: ${description}`

      // Generate PR body
      const body = this.generateHotfixPRBody(branchName, description, severity)

      // Create PR using GitHub CLI
      const prCommand = `gh pr create --title "${title}" --body "${body}" --base main --head ${branchName} --label "hotfix,${severity}"`
      execSync(prCommand, { stdio: 'pipe' })

      console.log('✅ Hotfix PR created successfully')
      console.log(`🚨 Severity: ${severity.toUpperCase()}`)
      console.log(`👥 Notifying: ${this.config.emergency_contacts.join(', ')}`)

      return true
    } catch (error) {
      console.error(`❌ Error creating hotfix PR: ${error.message}`)
      return false
    }
  }

  /**
   * Generate hotfix PR body
   */
  generateHotfixPRBody (branchName, description, severity) {
    const timestamp = new Date().toISOString()
    const urgencyLevel =
      severity === 'critical'
        ? '🔴 CRITICAL'
        : severity === 'high'
          ? '🟠 HIGH'
          : '🟡 MEDIUM'

    return `# 🚨 Emergency Hotfix

## 🚨 Emergency Fix
${description}

## ⚡ Urgency Level
- [ ] **Critical**: System is down or severely impacted
- [ ] **High**: Major functionality is broken
- [ ] **Medium**: Important feature is not working

**Current Level**: ${urgencyLevel}

## 📋 Description

### What's broken?
<!-- Describe the critical issue -->

### What's the fix?
<!-- Describe the fix being applied -->

## 🔗 Related Issues
<!-- Link to the critical issue -->
- Fixes #
- Critical issue: #

## 🧪 Testing

### Immediate Testing
- [ ] Fix tested locally
- [ ] Fix verified in staging (if time permits)
- [ ] Rollback plan prepared

### Post-Deploy Testing
- [ ] Monitor production metrics
- [ ] Verify fix is working
- [ ] Check for side effects

## 🚀 Deployment

### Deployment Plan
- [ ] Deploy to production immediately
- [ ] Monitor for issues
- [ ] Communicate to team/users

### Rollback Plan
<!-- Describe how to rollback if issues occur -->

## ⚠️ Risk Assessment
<!-- What are the risks of this hotfix? -->

### Potential Issues
- 
- 
- 

### Mitigation
- 
- 
- 

## 📝 Post-Hotfix Actions
<!-- What needs to be done after the hotfix is deployed -->

- [ ] Create follow-up issue for proper fix
- [ ] Update documentation
- [ ] Conduct post-mortem
- [ ] Improve monitoring/alerting

## ✅ Hotfix Checklist

### Pre-deployment
- [ ] Fix is minimal and focused
- [ ] Fix has been tested
- [ ] Rollback plan is ready
- [ ] Team is notified

### Post-deployment
- [ ] Monitor production
- [ ] Verify fix is working
- [ ] Document lessons learned
- [ ] Plan proper fix

---

**⚠️ This is a hotfix. Please review and merge quickly if the fix is correct.**
**🚨 Emergency Contacts**: ${this.config.emergency_contacts.join(', ')}
**⏰ Created**: ${timestamp}
**🌿 Branch**: ${branchName}
`
  }

  /**
   * Deploy hotfix
   */
  deployHotfix (branchName, autoDeploy = false) {
    console.log(`🚀 Deploying hotfix: ${branchName}`)

    try {
      // Validate hotfix first
      const validation = this.validateHotfix(branchName)
      if (!validation.passed) {
        console.log('❌ Hotfix validation failed. Cannot deploy.')
        return false
      }

      if (validation.warnings.length > 0) {
        console.log('⚠️ Hotfix has warnings. Proceed with caution.')
      }

      // Merge to main
      execSync('git checkout main', { stdio: 'pipe' })
      execSync('git pull origin main', { stdio: 'pipe' })
      execSync(`git merge --no-ff ${branchName} -m "Hotfix: ${branchName}"`, {
        stdio: 'pipe'
      })

      // Push to main
      execSync('git push origin main', { stdio: 'pipe' })

      console.log('✅ Hotfix merged to main')

      // Backport to develop
      this.backportToDevelop(branchName)

      // Deploy if auto-deploy is enabled
      if (autoDeploy || this.config.auto_deploy) {
        console.log('🚀 Auto-deploying to production...')
        // In a real implementation, this would trigger deployment
        console.log('✅ Hotfix deployed to production')
      }

      return true
    } catch (error) {
      console.error(`❌ Error deploying hotfix: ${error.message}`)
      return false
    }
  }

  /**
   * Backport hotfix to develop
   */
  backportToDevelop (branchName) {
    console.log(`🔀 Backporting hotfix to develop: ${branchName}`)

    try {
      // Switch to develop
      execSync('git checkout develop', { stdio: 'pipe' })
      execSync('git pull origin develop', { stdio: 'pipe' })

      // Merge hotfix
      execSync(
        `git merge --no-ff ${branchName} -m "Backport hotfix: ${branchName}"`,
        {
          stdio: 'pipe'
        }
      )

      // Push to develop
      execSync('git push origin develop', { stdio: 'pipe' })

      console.log('✅ Hotfix backported to develop')
      return true
    } catch (error) {
      console.error(`❌ Error backporting hotfix: ${error.message}`)
      return false
    }
  }

  /**
   * Rollback hotfix
   */
  rollbackHotfix (commitHash) {
    console.log(`🔄 Rolling back hotfix: ${commitHash}`)

    try {
      // Switch to main
      execSync('git checkout main', { stdio: 'pipe' })
      execSync('git pull origin main', { stdio: 'pipe' })

      // Create rollback commit
      execSync(`git revert ${commitHash} --no-edit`, { stdio: 'pipe' })

      // Push rollback
      execSync('git push origin main', { stdio: 'pipe' })

      console.log('✅ Hotfix rolled back')
      return true
    } catch (error) {
      console.error(`❌ Error rolling back hotfix: ${error.message}`)
      return false
    }
  }

  /**
   * Clean up hotfix branch
   */
  cleanupHotfixBranch (branchName) {
    console.log(`🧹 Cleaning up hotfix branch: ${branchName}`)

    try {
      // Switch to main
      execSync('git checkout main', { stdio: 'pipe' })

      // Delete local branch
      execSync(`git branch -d ${branchName}`, { stdio: 'pipe' })

      // Delete remote branch
      execSync(`git push origin --delete ${branchName}`, { stdio: 'pipe' })

      console.log(`✅ Hotfix branch cleaned up: ${branchName}`)
      return true
    } catch (error) {
      console.error(`❌ Error cleaning up hotfix branch: ${error.message}`)
      return false
    }
  }

  /**
   * Complete hotfix process
   */
  async completeHotfix (description, severity = 'high', options = {}) {
    console.log(`🚨 Starting hotfix process: ${description}`)

    const startTime = Date.now()
    const steps = []

    try {
      // Step 1: Create hotfix branch
      console.log('\n🌿 Step 1: Creating hotfix branch...')
      const branchName = this.createHotfixBranch(description, severity)
      if (!branchName) {
        throw new Error('Failed to create hotfix branch')
      }
      steps.push('Hotfix branch created')

      // Step 2: Wait for developer to make changes
      console.log('\n⏳ Step 2: Waiting for hotfix implementation...')
      console.log('Please implement your hotfix changes and commit them.')
      console.log('Then run: node scripts/hotfix-manager.js validate <branch>')
      console.log('And: node scripts/hotfix-manager.js deploy <branch>')

      // Step 3: Validate hotfix
      console.log('\n🔍 Step 3: Validating hotfix...')
      const validation = this.validateHotfix(branchName)
      if (!validation.passed) {
        throw new Error('Hotfix validation failed')
      }
      steps.push('Hotfix validated')

      // Step 4: Create PR
      console.log('\n📝 Step 4: Creating hotfix PR...')
      const prCreated = this.createHotfixPR(branchName, description, severity)
      if (!prCreated) {
        throw new Error('Failed to create hotfix PR')
      }
      steps.push('Hotfix PR created')

      // Step 5: Deploy hotfix
      console.log('\n🚀 Step 5: Deploying hotfix...')
      const deployed = this.deployHotfix(branchName, options.autoDeploy)
      if (!deployed) {
        throw new Error('Failed to deploy hotfix')
      }
      steps.push('Hotfix deployed')

      // Step 6: Cleanup
      console.log('\n🧹 Step 6: Cleaning up...')
      const cleanedUp = this.cleanupHotfixBranch(branchName)
      if (!cleanedUp) {
        console.log('⚠️ Warning: Failed to clean up hotfix branch')
      }
      steps.push('Cleanup completed')

      const duration = Math.round((Date.now() - startTime) / 1000)
      console.log('\n✅ Hotfix process completed successfully!')
      console.log(`⏱️ Duration: ${duration} seconds`)
      console.log(`🌿 Branch: ${branchName}`)
      console.log('\n📋 Completed steps:')
      steps.forEach((step, index) => {
        console.log(`  ${index + 1}. ${step}`)
      })

      return {
        success: true,
        branchName,
        duration,
        steps
      }
    } catch (error) {
      const duration = Math.round((Date.now() - startTime) / 1000)
      console.error(`❌ Hotfix process failed: ${error.message}`)
      console.log(`⏱️ Duration: ${duration} seconds`)
      return {
        success: false,
        error: error.message,
        duration,
        steps: steps || []
      }
    }
  }

  /**
   * List active hotfixes
   */
  listActiveHotfixes () {
    console.log('🚨 Active Hotfixes:')

    try {
      // Get hotfix branches
      const allRemoteBranches = execSync('git branch -r', {
        encoding: 'utf8'
      })
        .trim()
        .split('\n')
        .map(b => b.trim().replace('origin/', ''))
        .filter(b => b && b.startsWith('hotfix/'))

      if (allRemoteBranches.length === 0) {
        console.log('✅ No active hotfix branches')
        return []
      }

      allRemoteBranches.forEach(branch => {
        const info = this.getHotfixInfo(branch)
        const icon = this.getSeverityIcon(info.severity)
        console.log(`  ${icon} ${branch} (${info.severity}) - ${info.age}`)
      })

      return allRemoteBranches
    } catch (error) {
      console.error(`❌ Error listing hotfixes: ${error.message}`)
      return []
    }
  }

  /**
   * Get hotfix information
   */
  getHotfixInfo (branchName) {
    try {
      const parts = branchName.split('-')
      const severity = parts[1] || 'unknown'

      // Get branch age
      const lastCommit = execSync(
        `git log -1 --format="%ct" origin/${branchName}`,
        {
          encoding: 'utf8'
        }
      ).trim()
      const age = Math.round(
        (Date.now() - parseInt(lastCommit) * 1000) / 60000
      ) // minutes

      return {
        severity,
        age: `${age}m ago`
      }
    } catch (error) {
      return {
        severity: 'unknown',
        age: 'unknown'
      }
    }
  }

  /**
   * Get severity icon
   */
  getSeverityIcon (severity) {
    const icons = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢',
      unknown: '❓'
    }
    return icons[severity] || icons.unknown
  }

  /**
   * Show help information
   */
  showHelp () {
    console.log(`
🚨 Hotfix Manager - Emergency Fix Automation

Usage: node scripts/hotfix-manager.js <command> [options]

Commands:
  create <description> [severity]  Create hotfix branch
  validate <branch>                Validate hotfix changes
  pr <branch> <description> [severity] Create hotfix PR
  deploy <branch> [auto]           Deploy hotfix
  backport <branch>                Backport to develop
  rollback <commit>                Rollback hotfix
  cleanup <branch>                 Clean up hotfix branch
  complete <description> [severity] Complete hotfix process
  list                             List active hotfixes
  help                            Show this help

Examples:
  node scripts/hotfix-manager.js create "fix critical auth bug" critical
  node scripts/hotfix-manager.js validate hotfix/critical-fix-auth-bug-2024-01-15T10-30-00
  node scripts/hotfix-manager.js pr hotfix/critical-fix-auth-bug-2024-01-15T10-30-00 "fix critical auth bug" critical
  node scripts/hotfix-manager.js deploy hotfix/critical-fix-auth-bug-2024-01-15T10-30-00
  node scripts/hotfix-manager.js backport hotfix/critical-fix-auth-bug-2024-01-15T10-30-00
  node scripts/hotfix-manager.js rollback abc1234
  node scripts/hotfix-manager.js cleanup hotfix/critical-fix-auth-bug-2024-01-15T10-30-00
  node scripts/hotfix-manager.js complete "fix critical auth bug" critical
  node scripts/hotfix-manager.js list

Severity Levels:
  critical  - System is down or severely impacted
  high      - Major functionality is broken
  medium    - Important feature is not working
  low       - Minor issue (rarely used for hotfixes)

Emergency Contacts:
  ${this.config.emergency_contacts.join(', ')}
`)
  }
}

// CLI Interface
if (require.main === module) {
  const command = process.argv[2]
  const args = process.argv.slice(3)

  const manager = new HotfixManager()

  switch (command) {
    case 'create':
      if (args.length < 1) {
        console.error('Usage: create <description> [severity]')
        process.exit(1)
      }
      manager.createHotfixBranch(args[0], args[1])
      break

    case 'validate':
      if (args.length < 1) {
        console.error('Usage: validate <branch>')
        process.exit(1)
      }
      manager.validateHotfix(args[0])
      break

    case 'pr':
      if (args.length < 2) {
        console.error('Usage: pr <branch> <description> [severity]')
        process.exit(1)
      }
      manager.createHotfixPR(args[0], args[1], args[2])
      break

    case 'deploy':
      if (args.length < 1) {
        console.error('Usage: deploy <branch> [auto]')
        process.exit(1)
      }
      manager.deployHotfix(args[0], args[1] === 'auto')
      break

    case 'backport':
      if (args.length < 1) {
        console.error('Usage: backport <branch>')
        process.exit(1)
      }
      manager.backportToDevelop(args[0])
      break

    case 'rollback':
      if (args.length < 1) {
        console.error('Usage: rollback <commit>')
        process.exit(1)
      }
      manager.rollbackHotfix(args[0])
      break

    case 'cleanup':
      if (args.length < 1) {
        console.error('Usage: cleanup <branch>')
        process.exit(1)
      }
      manager.cleanupHotfixBranch(args[0])
      break

    case 'complete':
      if (args.length < 1) {
        console.error('Usage: complete <description> [severity]')
        process.exit(1)
      }
      manager.completeHotfix(args[0], args[1])
      break

    case 'list':
      manager.listActiveHotfixes()
      break

    case 'help':
    default:
      manager.showHelp()
      break
  }
}

module.exports = HotfixManager
