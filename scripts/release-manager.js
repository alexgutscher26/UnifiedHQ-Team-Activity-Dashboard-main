/**
 * Release Manager
 * Automated release process management
 */

import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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
      try {
        // For now, return a comprehensive config based on the YAML file
        // In production, you'd use js-yaml to parse the actual file
        return {
          versioning: {
            strategy: 'semantic',
            auto_bump: true,
            bump_files: ['package.json', 'README.md']
          },
          changelog: {
            file: 'CHANGELOG.md',
            format: 'keep-a-changelog'
          },
          release_notes: {
            file: 'RELEASE_NOTES.md'
          },
          branches: {
            main: 'main',
            develop: 'develop',
            release_prefix: 'release/',
            hotfix_prefix: 'hotfix/'
          },
          environments: {
            staging: {
              branch: 'develop',
              auto_deploy: true,
              url: 'https://staging.unifiedhq.com'
            },
            production: {
              branch: 'main',
              auto_deploy: false,
              url: 'https://unifiedhq.com'
            }
          },
          artifacts: {
            build_dir: '.next',
            include: ['.next/', 'public/', 'package.json', 'bun.lock'],
            exclude: ['node_modules/', '.git/', '.env*', '*.log']
          }
        }
      } catch (error) {
        console.warn(`⚠️ Error loading config: ${error.message}`)
        return this.getDefaultConfig()
      }
    }
    return this.getDefaultConfig()
  }

  /**
   * Get default configuration
   */
  getDefaultConfig () {
    return {
      versioning: {
        strategy: 'semantic',
        auto_bump: true,
        bump_files: ['package.json']
      },
      changelog: {
        file: 'CHANGELOG.md',
        format: 'keep-a-changelog'
      },
      release_notes: {
        file: 'RELEASE_NOTES.md'
      },
      branches: {
        main: 'main',
        develop: 'develop',
        release_prefix: 'release/',
        hotfix_prefix: 'hotfix/'
      },
      environments: {
        staging: {
          branch: 'develop',
          auto_deploy: true
        },
        production: {
          branch: 'main',
          auto_deploy: false
        }
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
   * Determine version bump type from conventional commits
   */
  determineVersionBumpFromCommits (fromVersion = null) {
    console.log(
      '🔍 Analyzing conventional commits to determine version bump...'
    )

    try {
      const commits = this.getCommitsSinceVersion(fromVersion)
      let hasBreaking = false
      let hasFeature = false
      let hasFix = false

      commits.forEach(commit => {
        const message = commit.message.toLowerCase()

        // Check for breaking changes
        if (
          message.includes('breaking change') ||
          message.includes('!:') ||
          message.match(
            /^(feat|fix|refactor|perf|style|test|docs|build|ci|chore)!:/
          )
        ) {
          hasBreaking = true
        }

        // Check for features
        if (message.startsWith('feat:') || message.startsWith('feature:')) {
          hasFeature = true
        }

        // Check for fixes
        if (message.startsWith('fix:') || message.startsWith('bugfix:')) {
          hasFix = true
        }
      })

      // Determine version bump based on conventional commit analysis
      if (hasBreaking) {
        console.log('📈 Breaking changes detected → MAJOR version bump')
        return 'major'
      } else if (hasFeature) {
        console.log('✨ New features detected → MINOR version bump')
        return 'minor'
      } else if (hasFix) {
        console.log('🐛 Bug fixes detected → PATCH version bump')
        return 'patch'
      } else {
        console.log('🔄 Other changes detected → PATCH version bump')
        return 'patch'
      }
    } catch (error) {
      console.error(`❌ Error analyzing commits: ${error.message}`)
      console.log('📈 Defaulting to PATCH version bump')
      return 'patch'
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
   * Categorize changes by type using conventional commits
   */
  categorizeChanges (commits) {
    const changes = {
      features: [],
      fixes: [],
      breaking: [],
      docs: [],
      refactor: [],
      performance: [],
      style: [],
      test: [],
      build: [],
      ci: [],
      chore: [],
      other: []
    }

    commits.forEach(commit => {
      const message = commit.message
      const messageLower = message.toLowerCase()
      const hash = commit.hash

      // Parse conventional commit format: type(scope): description
      const conventionalMatch = message.match(/^(\w+)(\(.+\))?(!)?:\s*(.+)$/)

      if (conventionalMatch) {
        const [, type, scope, breaking, description] = conventionalMatch
        const typeLower = type.toLowerCase()
        const fullMessage = message
        const cleanMessage = breaking
          ? `${type}${scope || ''}!: ${description}`
          : `${type}${scope || ''}: ${description}`

        // Check for breaking changes (! suffix or BREAKING CHANGE in body)
        if (breaking || messageLower.includes('breaking change')) {
          changes.breaking.push({
            hash,
            message: fullMessage,
            type: typeLower,
            description: cleanMessage
          })
          return
        }

        // Categorize by conventional commit type
        switch (typeLower) {
          case 'feat':
          case 'feature':
            changes.features.push({
              hash,
              message: fullMessage,
              type: typeLower,
              description: cleanMessage
            })
            break
          case 'fix':
          case 'bugfix':
            changes.fixes.push({
              hash,
              message: fullMessage,
              type: typeLower,
              description: cleanMessage
            })
            break
          case 'docs':
          case 'doc':
            changes.docs.push({
              hash,
              message: fullMessage,
              type: typeLower,
              description: cleanMessage
            })
            break
          case 'refactor':
            changes.refactor.push({
              hash,
              message: fullMessage,
              type: typeLower,
              description: cleanMessage
            })
            break
          case 'perf':
          case 'performance':
            changes.performance.push({
              hash,
              message: fullMessage,
              type: typeLower,
              description: cleanMessage
            })
            break
          case 'style':
            changes.style.push({
              hash,
              message: fullMessage,
              type: typeLower,
              description: cleanMessage
            })
            break
          case 'test':
            changes.test.push({
              hash,
              message: fullMessage,
              type: typeLower,
              description: cleanMessage
            })
            break
          case 'build':
            changes.build.push({
              hash,
              message: fullMessage,
              type: typeLower,
              description: cleanMessage
            })
            break
          case 'ci':
            changes.ci.push({
              hash,
              message: fullMessage,
              type: typeLower,
              description: cleanMessage
            })
            break
          case 'chore':
            changes.chore.push({
              hash,
              message: fullMessage,
              type: typeLower,
              description: cleanMessage
            })
            break
          default:
            changes.other.push({
              hash,
              message: fullMessage,
              type: typeLower,
              description: cleanMessage
            })
            break
        }
      } else {
        // Fallback for non-conventional commits
        if (
          messageLower.includes('breaking change') ||
          messageLower.includes('breaking:')
        ) {
          changes.breaking.push({
            hash,
            message,
            type: 'unknown',
            description: message
          })
        } else if (
          messageLower.includes('feat') ||
          messageLower.includes('feature')
        ) {
          changes.features.push({
            hash,
            message,
            type: 'unknown',
            description: message
          })
        } else if (
          messageLower.includes('fix') ||
          messageLower.includes('bug')
        ) {
          changes.fixes.push({
            hash,
            message,
            type: 'unknown',
            description: message
          })
        } else if (messageLower.includes('doc')) {
          changes.docs.push({
            hash,
            message,
            type: 'unknown',
            description: message
          })
        } else {
          changes.other.push({
            hash,
            message,
            type: 'unknown',
            description: message
          })
        }
      }
    })

    return changes
  }

  /**
   * Format changelog entry with conventional commit formatting
   */
  formatChangelogEntry (version, changes) {
    const date = new Date().toISOString().split('T')[0]
    let entry = `## [${version}] - ${date}\n\n`

    // Breaking changes first (highest priority)
    if (changes.breaking.length > 0) {
      entry += '### ⚠️ Breaking Changes\n'
      changes.breaking.forEach(change => {
        const description = change.description || change.message
        entry += `- ${description} ([${change.hash}](../../commit/${change.hash}))\n`
      })
      entry += '\n'
    }

    // New features
    if (changes.features.length > 0) {
      entry += '### ✨ New Features\n'
      changes.features.forEach(change => {
        const description = change.description || change.message
        entry += `- ${description} ([${change.hash}](../../commit/${change.hash}))\n`
      })
      entry += '\n'
    }

    // Bug fixes
    if (changes.fixes.length > 0) {
      entry += '### 🐛 Bug Fixes\n'
      changes.fixes.forEach(change => {
        const description = change.description || change.message
        entry += `- ${description} ([${change.hash}](../../commit/${change.hash}))\n`
      })
      entry += '\n'
    }

    // Performance improvements
    if (changes.performance.length > 0) {
      entry += '### ⚡ Performance Improvements\n'
      changes.performance.forEach(change => {
        const description = change.description || change.message
        entry += `- ${description} ([${change.hash}](../../commit/${change.hash}))\n`
      })
      entry += '\n'
    }

    // Refactoring
    if (changes.refactor.length > 0) {
      entry += '### 🔧 Code Refactoring\n'
      changes.refactor.forEach(change => {
        const description = change.description || change.message
        entry += `- ${description} ([${change.hash}](../../commit/${change.hash}))\n`
      })
      entry += '\n'
    }

    // Documentation
    if (changes.docs.length > 0) {
      entry += '### 📚 Documentation\n'
      changes.docs.forEach(change => {
        const description = change.description || change.message
        entry += `- ${description} ([${change.hash}](../../commit/${change.hash}))\n`
      })
      entry += '\n'
    }

    // Tests
    if (changes.test.length > 0) {
      entry += '### 🧪 Tests\n'
      changes.test.forEach(change => {
        const description = change.description || change.message
        entry += `- ${description} ([${change.hash}](../../commit/${change.hash}))\n`
      })
      entry += '\n'
    }

    // Build system
    if (changes.build.length > 0) {
      entry += '### 🏗️ Build System\n'
      changes.build.forEach(change => {
        const description = change.description || change.message
        entry += `- ${description} ([${change.hash}](../../commit/${change.hash}))\n`
      })
      entry += '\n'
    }

    // CI/CD
    if (changes.ci.length > 0) {
      entry += '### 👷 Continuous Integration\n'
      changes.ci.forEach(change => {
        const description = change.description || change.message
        entry += `- ${description} ([${change.hash}](../../commit/${change.hash}))\n`
      })
      entry += '\n'
    }

    // Styling
    if (changes.style.length > 0) {
      entry += '### 💄 Styles\n'
      changes.style.forEach(change => {
        const description = change.description || change.message
        entry += `- ${description} ([${change.hash}](../../commit/${change.hash}))\n`
      })
      entry += '\n'
    }

    // Chores and maintenance
    if (changes.chore.length > 0) {
      entry += '### 🔄 Chores\n'
      changes.chore.forEach(change => {
        const description = change.description || change.message
        entry += `- ${description} ([${change.hash}](../../commit/${change.hash}))\n`
      })
      entry += '\n'
    }

    // Other changes
    if (changes.other.length > 0) {
      entry += '### 🔄 Other Changes\n'
      changes.other.forEach(change => {
        const description = change.description || change.message
        entry += `- ${description} ([${change.hash}](../../commit/${change.hash}))\n`
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
      const changelogPath = path.join(
        this.projectRoot,
        this.config.changelog.file
      )
      const releaseNotesPath = path.join(
        this.projectRoot,
        this.config.release_notes.file
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
   * Generate GitHub-compatible release notes
   */
  generateGitHubReleaseNotes (version, fromVersion = null) {
    console.log(`📋 Generating GitHub release notes for v${version}...`)

    try {
      // Get commits since last version
      const commits = this.getCommitsSinceVersion(fromVersion)
      const changes = this.categorizeChanges(commits)

      // Generate GitHub-style release notes
      const releaseNotes = this.formatGitHubReleaseNotes(version, changes)

      return releaseNotes
    } catch (error) {
      console.error(
        `❌ Error generating GitHub release notes: ${error.message}`
      )
      return null
    }
  }

  /**
   * Format GitHub release notes with conventional commit formatting
   */
  formatGitHubReleaseNotes (version, changes) {
    const date = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })

    let notes = `## What's Changed in v${version}\n\n`

    // Breaking changes (highest priority)
    if (changes.breaking.length > 0) {
      notes += '### ⚠️ Breaking Changes\n'
      changes.breaking.forEach(change => {
        const description = change.description || change.message
        notes += `- ${description} ([${change.hash}](../../commit/${change.hash}))\n`
      })
      notes += '\n'
    }

    // New features
    if (changes.features.length > 0) {
      notes += '### ✨ New Features\n'
      changes.features.forEach(change => {
        const description = change.description || change.message
        notes += `- ${description} ([${change.hash}](../../commit/${change.hash}))\n`
      })
      notes += '\n'
    }

    // Bug fixes
    if (changes.fixes.length > 0) {
      notes += '### 🐛 Bug Fixes\n'
      changes.fixes.forEach(change => {
        const description = change.description || change.message
        notes += `- ${description} ([${change.hash}](../../commit/${change.hash}))\n`
      })
      notes += '\n'
    }

    // Performance improvements
    if (changes.performance.length > 0) {
      notes += '### ⚡ Performance Improvements\n'
      changes.performance.forEach(change => {
        const description = change.description || change.message
        notes += `- ${description} ([${change.hash}](../../commit/${change.hash}))\n`
      })
      notes += '\n'
    }

    // Code refactoring
    if (changes.refactor.length > 0) {
      notes += '### 🔧 Code Refactoring\n'
      changes.refactor.forEach(change => {
        const description = change.description || change.message
        notes += `- ${description} ([${change.hash}](../../commit/${change.hash}))\n`
      })
      notes += '\n'
    }

    // Documentation
    if (changes.docs.length > 0) {
      notes += '### 📚 Documentation\n'
      changes.docs.forEach(change => {
        const description = change.description || change.message
        notes += `- ${description} ([${change.hash}](../../commit/${change.hash}))\n`
      })
      notes += '\n'
    }

    // Tests
    if (changes.test.length > 0) {
      notes += '### 🧪 Tests\n'
      changes.test.forEach(change => {
        const description = change.description || change.message
        notes += `- ${description} ([${change.hash}](../../commit/${change.hash}))\n`
      })
      notes += '\n'
    }

    // Build system changes
    if (changes.build.length > 0) {
      notes += '### 🏗️ Build System\n'
      changes.build.forEach(change => {
        const description = change.description || change.message
        notes += `- ${description} ([${change.hash}](../../commit/${change.hash}))\n`
      })
      notes += '\n'
    }

    // CI/CD changes
    if (changes.ci.length > 0) {
      notes += '### 👷 Continuous Integration\n'
      changes.ci.forEach(change => {
        const description = change.description || change.message
        notes += `- ${description} ([${change.hash}](../../commit/${change.hash}))\n`
      })
      notes += '\n'
    }

    // Style changes
    if (changes.style.length > 0) {
      notes += '### 💄 Styles\n'
      changes.style.forEach(change => {
        const description = change.description || change.message
        notes += `- ${description} ([${change.hash}](../../commit/${change.hash}))\n`
      })
      notes += '\n'
    }

    // Chores and maintenance
    if (changes.chore.length > 0) {
      notes += '### 🔄 Chores\n'
      changes.chore.forEach(change => {
        const description = change.description || change.message
        notes += `- ${description} ([${change.hash}](../../commit/${change.hash}))\n`
      })
      notes += '\n'
    }

    // Other changes
    if (changes.other.length > 0) {
      notes += '### 🔄 Other Changes\n'
      changes.other.forEach(change => {
        const description = change.description || change.message
        notes += `- ${description} ([${change.hash}](../../commit/${change.hash}))\n`
      })
      notes += '\n'
    }

    // Add installation instructions
    notes += '## 🚀 Installation\n\n'
    notes += '```bash\n'
    notes += '# Using Bun (recommended)\n'
    notes += 'bun install\n'
    notes += 'bun run build\n'
    notes += 'bun start\n\n'
    notes += '# Using Docker\n'
    notes += `docker pull ghcr.io/${this.getRepositoryName()}:${version}\n`
    notes += `docker run -p 3000:3000 ghcr.io/${this.getRepositoryName()}:${version}\n`
    notes += '```\n\n'

    // Add upgrade instructions
    notes += '## 📈 Upgrade Instructions\n\n'
    notes += '1. Pull the latest changes: `git pull origin main`\n'
    notes += '2. Install dependencies: `bun install`\n'
    notes += '3. Run database migrations: `bunx prisma migrate deploy`\n'
    notes += '4. Build the application: `bun run build`\n'
    notes += '5. Restart the application: `bun start`\n\n'

    // Add support information
    notes += '## 🆘 Support\n\n'
    notes += '- 📖 [Documentation](./docs/)\n'
    notes += '- 🐛 [Report Issues](../../issues)\n'
    notes += '- 💬 [Discussions](../../discussions)\n\n'

    const previousVersion = this.getPreviousVersion(version)
    notes += `**Full Changelog**: https://github.com/${this.getRepositoryName()}/compare/v${previousVersion}...v${version}`

    return notes
  }

  /**
   * Get repository name from git remote
   */
  getRepositoryName () {
    try {
      const remoteUrl = execSync('git config --get remote.origin.url', {
        encoding: 'utf8'
      }).trim()

      // Extract repository name from various URL formats
      const match = remoteUrl.match(/github\.com[:/](.+?)(?:\.git)?$/)
      return match ? match[1] : 'owner/repo'
    } catch (error) {
      return 'owner/repo'
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
🚀 Release Manager - Automated Release Process with Conventional Commits

Usage: node scripts/release-manager.js <command> [options]

Commands:
  bump <type|auto>               Bump version (major|minor|patch|prerelease|auto)
  create <version>               Create release branch
  changelog <version> [from]     Generate changelog from conventional commits
  notes <version> [--github] [--from=<version>]  Generate release notes
  tag <version> [message]        Create release tag
  merge-main <branch> <version>  Merge release to main
  merge-develop <branch> <version> Merge release back to develop
  cleanup <branch>               Clean up release branch
  release <version> <type>       Complete release process
  help                          Show this help

Examples:
  # Automatic version bump based on conventional commits
  node scripts/release-manager.js bump auto
  
  # Manual version bump
  node scripts/release-manager.js bump patch
  
  # Generate GitHub-style release notes
  node scripts/release-manager.js notes v1.0.0 --github --from=v0.9.0
  
  # Generate changelog from conventional commits
  node scripts/release-manager.js changelog v1.0.0 v0.9.0
  
  # Complete release process
  node scripts/release-manager.js release v1.0.0 auto

Version Types:
  major      - Breaking changes (1.0.0 → 2.0.0)
  minor      - New features (1.0.0 → 1.1.0)
  patch      - Bug fixes (1.0.0 → 1.0.1)
  prerelease - Pre-release (1.0.0 → 1.0.0-rc.1)
  auto       - Automatically determined from conventional commits

Conventional Commit Types Supported:
  feat:      - New features (minor version bump)
  fix:       - Bug fixes (patch version bump)
  feat!:     - Breaking changes (major version bump)
  fix!:      - Breaking bug fixes (major version bump)
  docs:      - Documentation changes
  style:     - Code style changes
  refactor:  - Code refactoring
  perf:      - Performance improvements
  test:      - Test changes
  build:     - Build system changes
  ci:        - CI/CD changes
  chore:     - Maintenance tasks

Breaking Change Detection:
  - Commits with '!' suffix (e.g., feat!: breaking change)
  - Commits containing 'BREAKING CHANGE' in the body
  - Any commit type with '!' (e.g., fix!:, refactor!:)
`)
  }
}

// CLI Interface
if (process.argv[1] && process.argv[1].endsWith('release-manager.js')) {
  const command = process.argv[2]
  const args = process.argv.slice(3)

  const manager = new ReleaseManager()

  switch (command) {
    case 'bump':
      if (args.length < 1) {
        console.error('Usage: bump <type|auto> [--from=<previous_version>]')
        process.exit(1)
      }

      const bumpType = args[0]
      const bumpFromArg = args.find(arg => arg.startsWith('--from='))
      const bumpFromVersion = bumpFromArg ? bumpFromArg.split('=')[1] : null

      if (bumpType === 'auto') {
        const determinedType =
          manager.determineVersionBumpFromCommits(bumpFromVersion)
        manager.bumpVersion(determinedType)
      } else {
        manager.bumpVersion(bumpType)
      }
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
        console.error(
          'Usage: notes <version> [--github] [--from=<previous_version>]'
        )
        process.exit(1)
      }

      const version = args[0]
      const isGitHub = args.includes('--github')
      const fromArg = args.find(arg => arg.startsWith('--from='))
      const fromVersion = fromArg ? fromArg.split('=')[1] : null

      if (isGitHub) {
        const commits = manager.getCommitsSinceVersion(fromVersion)
        const changes = manager.categorizeChanges(commits)
        const notes = manager.formatGitHubReleaseNotes(version, changes)
        if (notes) {
          console.log(notes)
        }
      } else {
        manager.generateReleaseNotes(version)
      }
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

export default ReleaseManager
