#!/usr/bin/env node

/**
 * Release Manager
 * Automated release process management
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

class ReleaseManager {
  constructor () {
    this.projectRoot = process.cwd()
    this.config = this.loadConfig()
  }

  /**
   * Load release configuration
   */
  loadConfig () {
    const configPath = path.join(
      this.projectRoot,
      '.github',
      'release-config.yml'
    )
    if (fs.existsSync(configPath)) {
      // In a real implementation, you'd use a YAML parser
      return {
        versioning: 'semantic',
        changelog: 'CHANGELOG.md',
        release_notes: 'RELEASE_NOTES.md',
        auto_bump: true,
        create_tag: true,
        environments: {
          staging: 'develop',
          production: 'main'
        }
      }
    }
    return this.getDefaultConfig()
  }

  /**
   * Get default configuration
   */
  getDefaultConfig () {
    return {
      versioning: 'semantic',
      changelog: 'CHANGELOG.md',
      release_notes: 'RELEASE_NOTES.md',
      auto_bump: true,
      create_tag: true,
      environments: {
        staging: 'develop',
        production: 'main'
      }
    }
  }

  /**
   * Get current version from package.json
   */
  getCurrentVersion () {
    try {
      const packagePath = path.join(this.projectRoot, 'package.json')
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
      return packageJson.version
    } catch (error) {
      console.error(`❌ Error reading version: ${error.message}`)
      return null
    }
  }

  /**
   * Bump version number
   */
  bumpVersion (type = 'patch') {
    console.log(`📈 Bumping version (${type})...`)

    try {
      const currentVersion = this.getCurrentVersion()
      if (!currentVersion) {
        throw new Error('Could not read current version')
      }

      const newVersion = this.calculateNewVersion(currentVersion, type)
      console.log(`📦 ${currentVersion} → ${newVersion}`)

      // Update package.json
      const packagePath = path.join(this.projectRoot, 'package.json')
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
      packageJson.version = newVersion
      fs.writeFileSync(
        packagePath,
        JSON.stringify(packageJson, null, 2) + '\n'
      )

      console.log(`✅ Updated package.json to version ${newVersion}`)
      return newVersion
    } catch (error) {
      console.error(`❌ Error bumping version: ${error.message}`)
      return null
    }
  }

  /**
   * Calculate new version based on type
   */
  calculateNewVersion (currentVersion, type) {
    const [major, minor, patch] = currentVersion.split('.').map(Number)

    switch (type) {
      case 'major':
        return `${major + 1}.0.0`
      case 'minor':
        return `${major}.${minor + 1}.0`
      case 'patch':
        return `${major}.${minor}.${patch + 1}`
      case 'prerelease':
        return `${major}.${minor}.${patch}-rc.1`
      default:
        throw new Error(`Invalid version type: ${type}`)
    }
  }

  /**
   * Create release branch
   */
  createReleaseBranch (version) {
    console.log(`🚀 Creating release branch for v${version}...`)

    try {
      const branchName = `release/v${version}`

      // Check if branch already exists
      if (this.branchExists(branchName)) {
        throw new Error(`Release branch ${branchName} already exists`)
      }

      // Switch to develop (or main if develop doesn't exist) and pull latest
      try {
        execSync('git checkout develop', { stdio: 'pipe' })
        execSync('git pull origin develop', { stdio: 'pipe' })
      } catch (error) {
        console.log('⚠️ develop branch not found, using main instead')
        execSync('git checkout main', { stdio: 'pipe' })
        execSync('git pull origin main', { stdio: 'pipe' })
      }

      // Create release branch
      execSync(`git checkout -b ${branchName}`, { stdio: 'pipe' })
      execSync(`git push origin ${branchName}`, { stdio: 'pipe' })

      console.log(`✅ Created release branch: ${branchName}`)
      return branchName
    } catch (error) {
      console.error(`❌ Error creating release branch: ${error.message}`)
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
   * Generate changelog
   */
  generateChangelog (version, fromVersion = null) {
    console.log(`📝 Generating changelog for v${version}...`)

    try {
      const changelogPath = path.join(this.projectRoot, this.config.changelog)
      let changelog = ''

      // Read existing changelog
      if (fs.existsSync(changelogPath)) {
        changelog = fs.readFileSync(changelogPath, 'utf8')
      }

      // Get commits since last version
      const commits = this.getCommitsSinceVersion(fromVersion)
      const changes = this.categorizeChanges(commits)

      // Generate new changelog entry
      const newEntry = this.formatChangelogEntry(version, changes)

      // Insert new entry at the beginning
      const lines = changelog.split('\n')
      const insertIndex = lines.findIndex(line => line.startsWith('## ')) || 0
      lines.splice(insertIndex, 0, newEntry)

      // Write updated changelog
      fs.writeFileSync(changelogPath, lines.join('\n'))

      console.log(`✅ Updated changelog for v${version}`)
      return true
    } catch (error) {
      console.error(`❌ Error generating changelog: ${error.message}`)
      return false
    }
  }

  /**
   * Get commits since last version
   */
  getCommitsSinceVersion (fromVersion) {
    try {
      const range = fromVersion ? `${fromVersion}..HEAD` : 'HEAD'
      const commits = execSync(`git log --oneline ${range}`, {
        encoding: 'utf8'
      })
        .trim()
        .split('\n')
        .filter(c => c)
        .map(commit => {
          const [hash, ...messageParts] = commit.split(' ')
          return {
            hash,
            message: messageParts.join(' ')
          }
        })

      return commits
    } catch (error) {
      console.error(`❌ Error getting commits: ${error.message}`)
      return []
    }
  }

  /**
   * Categorize changes by type
   */
  categorizeChanges (commits) {
    const changes = {
      features: [],
      fixes: [],
      breaking: [],
      docs: [],
      refactor: [],
      other: []
    }

    commits.forEach(commit => {
      const message = commit.message.toLowerCase()
      const hash = commit.hash
      const fullMessage = commit.message

      if (message.startsWith('feat:') || message.startsWith('feature:')) {
        changes.features.push({ hash, message: fullMessage })
      } else if (message.startsWith('fix:') || message.startsWith('bugfix:')) {
        changes.fixes.push({ hash, message: fullMessage })
      } else if (
        message.includes('breaking change') ||
        message.startsWith('feat!:')
      ) {
        changes.breaking.push({ hash, message: fullMessage })
      } else if (message.startsWith('docs:') || message.startsWith('doc:')) {
        changes.docs.push({ hash, message: fullMessage })
      } else if (message.startsWith('refactor:')) {
        changes.refactor.push({ hash, message: fullMessage })
      } else {
        changes.other.push({ hash, message: fullMessage })
      }
    })

    return changes
  }

  /**
   * Format changelog entry
   */
  formatChangelogEntry (version, changes) {
    const date = new Date().toISOString().split('T')[0]
    let entry = `## [${version}] - ${date}\n\n`

    if (changes.breaking.length > 0) {
      entry += '### ⚠️ Breaking Changes\n'
      changes.breaking.forEach(change => {
        entry += `- ${change.message}\n`
      })
      entry += '\n'
    }

    if (changes.features.length > 0) {
      entry += '### ✨ New Features\n'
      changes.features.forEach(change => {
        entry += `- ${change.message}\n`
      })
      entry += '\n'
    }

    if (changes.fixes.length > 0) {
      entry += '### 🐛 Bug Fixes\n'
      changes.fixes.forEach(change => {
        entry += `- ${change.message}\n`
      })
      entry += '\n'
    }

    if (changes.refactor.length > 0) {
      entry += '### 🔧 Refactoring\n'
      changes.refactor.forEach(change => {
        entry += `- ${change.message}\n`
      })
      entry += '\n'
    }

    if (changes.docs.length > 0) {
      entry += '### 📚 Documentation\n'
      changes.docs.forEach(change => {
        entry += `- ${change.message}\n`
      })
      entry += '\n'
    }

    if (changes.other.length > 0) {
      entry += '### 🔄 Other Changes\n'
      changes.other.forEach(change => {
        entry += `- ${change.message}\n`
      })
      entry += '\n'
    }

    return entry
  }

  /**
   * Generate release notes
   */
  generateReleaseNotes (version) {
    console.log(`📋 Generating release notes for v${version}...`)

    try {
      const changelogPath = path.join(this.projectRoot, this.config.changelog)
      const releaseNotesPath = path.join(
        this.projectRoot,
        this.config.release_notes
      )

      if (!fs.existsSync(changelogPath)) {
        throw new Error('Changelog not found')
      }

      // Read changelog and extract version entry
      const changelog = fs.readFileSync(changelogPath, 'utf8')
      const versionEntry = this.extractVersionEntry(changelog, version)

      if (!versionEntry) {
        throw new Error(`Version ${version} not found in changelog`)
      }

      // Generate release notes
      const releaseNotes = this.formatReleaseNotes(version, versionEntry)

      // Write release notes
      fs.writeFileSync(releaseNotesPath, releaseNotes)

      console.log(`✅ Generated release notes for v${version}`)
      return true
    } catch (error) {
      console.error(`❌ Error generating release notes: ${error.message}`)
      return false
    }
  }

  /**
   * Extract version entry from changelog
   */
  extractVersionEntry (changelog, version) {
    const lines = changelog.split('\n')
    const versionIndex = lines.findIndex(line => line.includes(`[${version}]`))

    if (versionIndex === -1) {
      return null
    }

    const nextVersionIndex = lines.findIndex(
      (line, index) => index > versionIndex && line.startsWith('## [')
    )

    const endIndex = nextVersionIndex === -1 ? lines.length : nextVersionIndex
    return lines.slice(versionIndex, endIndex).join('\n')
  }

  /**
   * Format release notes
   */
  formatReleaseNotes (version, changelogEntry) {
    const date = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })

    return `# Release v${version} - ${date}

${changelogEntry}

## Installation

\`\`\`bash
npm install
\`\`\`

## Upgrade Instructions

1. Pull the latest changes
2. Install dependencies: \`npm install\`
3. Run database migrations (if any)
4. Restart the application

## Rollback Instructions

If you need to rollback to the previous version:

1. Checkout the previous tag: \`git checkout v${this.getPreviousVersion(version)}\`
2. Install dependencies: \`npm install\`
3. Run database migrations (if any)
4. Restart the application

## Support

For issues or questions, please:
- Check the [documentation](docs/)
- Open an issue on GitHub
- Contact the development team

---
Generated on ${new Date().toISOString()}
`
  }

  /**
   * Get previous version
   */
  getPreviousVersion (currentVersion) {
    const [major, minor, patch] = currentVersion.split('.').map(Number)
    if (patch > 0) {
      return `${major}.${minor}.${patch - 1}`
    } else if (minor > 0) {
      return `${major}.${minor - 1}.0`
    } else {
      return `${major - 1}.0.0`
    }
  }

  /**
   * Create release tag
   */
  createReleaseTag (version, message = '') {
    console.log(`🏷️ Creating release tag v${version}...`)

    try {
      const tagName = `v${version}`
      const tagMessage = message || `Release v${version}`

      // Create and push tag
      execSync(`git tag -a ${tagName} -m "${tagMessage}"`, { stdio: 'pipe' })
      execSync(`git push origin ${tagName}`, { stdio: 'pipe' })

      console.log(`✅ Created and pushed tag: ${tagName}`)
      return tagName
    } catch (error) {
      console.error(`❌ Error creating tag: ${error.message}`)
      return null
    }
  }

  /**
   * Merge release to main
   */
  mergeReleaseToMain (releaseBranch, version) {
    console.log(`🔀 Merging release ${releaseBranch} to main...`)

    try {
      // Switch to main and pull latest
      execSync('git checkout main', { stdio: 'pipe' })
      execSync('git pull origin main', { stdio: 'pipe' })

      // Merge release branch
      execSync(`git merge --no-ff ${releaseBranch} -m "Release v${version}"`, {
        stdio: 'pipe'
      })

      // Push to main
      execSync('git push origin main', { stdio: 'pipe' })

      console.log(`✅ Merged ${releaseBranch} to main`)
      return true
    } catch (error) {
      console.error(`❌ Error merging to main: ${error.message}`)
      return false
    }
  }

  /**
   * Merge release back to develop
   */
  mergeReleaseToDevelop (releaseBranch, version) {
    console.log(`🔀 Merging release ${releaseBranch} back to develop...`)

    try {
      // Switch to develop and pull latest
      execSync('git checkout develop', { stdio: 'pipe' })
      execSync('git pull origin develop', { stdio: 'pipe' })

      // Merge release branch
      execSync(
        `git merge --no-ff ${releaseBranch} -m "Merge release v${version} back to develop"`,
        {
          stdio: 'pipe'
        }
      )

      // Push to develop
      execSync('git push origin develop', { stdio: 'pipe' })

      console.log(`✅ Merged ${releaseBranch} back to develop`)
      return true
    } catch (error) {
      console.error(`❌ Error merging to develop: ${error.message}`)
      return false
    }
  }

  /**
   * Clean up release branch
   */
  cleanupReleaseBranch (releaseBranch) {
    console.log(`🧹 Cleaning up release branch ${releaseBranch}...`)

    try {
      // Switch to main
      execSync('git checkout main', { stdio: 'pipe' })

      // Delete local branch
      execSync(`git branch -d ${releaseBranch}`, { stdio: 'pipe' })

      // Delete remote branch
      execSync(`git push origin --delete ${releaseBranch}`, { stdio: 'pipe' })

      console.log(`✅ Cleaned up release branch: ${releaseBranch}`)
      return true
    } catch (error) {
      console.error(`❌ Error cleaning up release branch: ${error.message}`)
      return false
    }
  }

  /**
   * Complete release process
   */
  async completeRelease (version, type = 'patch', options = {}) {
    console.log(`🚀 Starting release process for v${version}...`)

    try {
      const steps = []

      // Step 1: Bump version
      console.log('\n📈 Step 1: Bumping version...')
      const newVersion = this.bumpVersion(type)
      if (!newVersion) {
        throw new Error('Failed to bump version')
      }
      steps.push('Version bumped')

      // Step 2: Create release branch
      console.log('\n🌿 Step 2: Creating release branch...')
      const releaseBranch = this.createReleaseBranch(newVersion)
      if (!releaseBranch) {
        throw new Error('Failed to create release branch')
      }
      steps.push('Release branch created')

      // Step 3: Generate changelog
      console.log('\n📝 Step 3: Generating changelog...')
      const changelogGenerated = this.generateChangelog(newVersion)
      if (!changelogGenerated) {
        throw new Error('Failed to generate changelog')
      }
      steps.push('Changelog generated')

      // Step 4: Generate release notes
      console.log('\n📋 Step 4: Generating release notes...')
      const releaseNotesGenerated = this.generateReleaseNotes(newVersion)
      if (!releaseNotesGenerated) {
        throw new Error('Failed to generate release notes')
      }
      steps.push('Release notes generated')

      // Step 5: Commit changes
      console.log('\n💾 Step 5: Committing changes...')
      execSync('git add .', { stdio: 'pipe' })
      execSync(`git commit -m "chore: prepare release v${newVersion}"`, {
        stdio: 'pipe'
      })
      execSync(`git push origin ${releaseBranch}`, { stdio: 'pipe' })
      steps.push('Changes committed')

      // Step 6: Create tag
      console.log('\n🏷️ Step 6: Creating release tag...')
      const tagCreated = this.createReleaseTag(newVersion)
      if (!tagCreated) {
        throw new Error('Failed to create release tag')
      }
      steps.push('Release tag created')

      // Step 7: Merge to main
      console.log('\n🔀 Step 7: Merging to main...')
      const mergedToMain = this.mergeReleaseToMain(releaseBranch, newVersion)
      if (!mergedToMain) {
        throw new Error('Failed to merge to main')
      }
      steps.push('Merged to main')

      // Step 8: Merge back to develop
      console.log('\n🔀 Step 8: Merging back to develop...')
      const mergedToDevelop = this.mergeReleaseToDevelop(
        releaseBranch,
        newVersion
      )
      if (!mergedToDevelop) {
        throw new Error('Failed to merge back to develop')
      }
      steps.push('Merged back to develop')

      // Step 9: Cleanup
      console.log('\n🧹 Step 9: Cleaning up...')
      const cleanedUp = this.cleanupReleaseBranch(releaseBranch)
      if (!cleanedUp) {
        console.log('⚠️ Warning: Failed to clean up release branch')
      }
      steps.push('Cleanup completed')

      console.log('\n✅ Release process completed successfully!')
      console.log(`📦 Version: ${newVersion}`)
      console.log(`🏷️ Tag: ${tagCreated}`)
      console.log('\n📋 Completed steps:')
      steps.forEach((step, index) => {
        console.log(`  ${index + 1}. ${step}`)
      })

      return {
        success: true,
        version: newVersion,
        tag: tagCreated,
        steps
      }
    } catch (error) {
      console.error(`❌ Release process failed: ${error.message}`)
      return {
        success: false,
        error: error.message,
        steps: steps || []
      }
    }
  }

  /**
   * Show help information
   */
  showHelp () {
    console.log(`
🚀 Release Manager - Automated Release Process

Usage: node scripts/release-manager.js <command> [options]

Commands:
  bump <type>                    Bump version (major|minor|patch|prerelease)
  create <version>               Create release branch
  changelog <version> [from]     Generate changelog
  notes <version>                Generate release notes
  tag <version> [message]        Create release tag
  merge-main <branch> <version>  Merge release to main
  merge-develop <branch> <version> Merge release back to develop
  cleanup <branch>               Clean up release branch
  release <version> <type>       Complete release process
  help                          Show this help

Examples:
  node scripts/release-manager.js bump patch
  node scripts/release-manager.js create v1.0.0
  node scripts/release-manager.js changelog v1.0.0
  node scripts/release-manager.js notes v1.0.0
  node scripts/release-manager.js tag v1.0.0 "Release v1.0.0"
  node scripts/release-manager.js release v1.0.0 patch

Version Types:
  major      - Breaking changes (1.0.0 → 2.0.0)
  minor      - New features (1.0.0 → 1.1.0)
  patch      - Bug fixes (1.0.0 → 1.0.1)
  prerelease - Pre-release (1.0.0 → 1.0.0-rc.1)
`)
  }
}

// CLI Interface
if (require.main === module) {
  const command = process.argv[2]
  const args = process.argv.slice(3)

  const manager = new ReleaseManager()

  switch (command) {
    case 'bump':
      if (args.length < 1) {
        console.error('Usage: bump <type>')
        process.exit(1)
      }
      manager.bumpVersion(args[0])
      break

    case 'create':
      if (args.length < 1) {
        console.error('Usage: create <version>')
        process.exit(1)
      }
      manager.createReleaseBranch(args[0])
      break

    case 'changelog':
      if (args.length < 1) {
        console.error('Usage: changelog <version> [from]')
        process.exit(1)
      }
      manager.generateChangelog(args[0], args[1])
      break

    case 'notes':
      if (args.length < 1) {
        console.error('Usage: notes <version>')
        process.exit(1)
      }
      manager.generateReleaseNotes(args[0])
      break

    case 'tag':
      if (args.length < 1) {
        console.error('Usage: tag <version> [message]')
        process.exit(1)
      }
      manager.createReleaseTag(args[0], args[1])
      break

    case 'merge-main':
      if (args.length < 2) {
        console.error('Usage: merge-main <branch> <version>')
        process.exit(1)
      }
      manager.mergeReleaseToMain(args[0], args[1])
      break

    case 'merge-develop':
      if (args.length < 2) {
        console.error('Usage: merge-develop <branch> <version>')
        process.exit(1)
      }
      manager.mergeReleaseToDevelop(args[0], args[1])
      break

    case 'cleanup':
      if (args.length < 1) {
        console.error('Usage: cleanup <branch>')
        process.exit(1)
      }
      manager.cleanupReleaseBranch(args[0])
      break

    case 'release':
      if (args.length < 2) {
        console.error('Usage: release <version> <type>')
        process.exit(1)
      }
      manager.completeRelease(args[0], args[1])
      break

    case 'help':
    default:
      manager.showHelp()
      break
  }
}

module.exports = ReleaseManager
