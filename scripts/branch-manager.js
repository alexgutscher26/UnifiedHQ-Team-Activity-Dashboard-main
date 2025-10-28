/**
 * Branch Manager
 * Automated branch management and workflow enforcement
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const yaml = require('js-yaml');

class BranchManager {
  constructor() {
    this.projectRoot = process.cwd();
    this.config = this.loadConfig();
  }

  /**
   * Load branch management configuration
   */
  loadConfig() {
    const configPath = path.join(
      this.projectRoot,
      '.github',
      'branch-config.yml'
    );
    if (fs.existsSync(configPath)) {
      try {
        const fileContents = fs.readFileSync(configPath, 'utf8');
        const config = yaml.load(fileContents);

        // Validate and merge with defaults
        return this.mergeWithDefaults(config);
      } catch (error) {
        console.warn(
          `⚠️  Warning: Failed to parse YAML config at ${configPath}:`,
          error.message
        );
        console.warn('   Falling back to default configuration.');
        return this.getDefaultConfig();
      }
    }
    return this.getDefaultConfig();
  }

  /**
   * Merge user config with defaults, ensuring all required fields exist
   */
  mergeWithDefaults(userConfig) {
    const defaults = this.getDefaultConfig();

    return {
      branches: { ...defaults.branches, ...(userConfig.branches || {}) },
      naming: { ...defaults.naming, ...(userConfig.naming || {}) },
      workflows: { ...defaults.workflows, ...(userConfig.workflows || {}) },
      // Add any additional config sections
      ...userConfig,
    };
  }

  /**
   * Returns the default configuration object.
   */
  getDefaultConfig() {
    return {
      branches: {
        main: { protected: true, required_reviews: 2 },
        develop: { protected: true, required_reviews: 1 },
        release: { protected: true, required_reviews: 2 },
      },
      naming: {
        feature: 'feature/',
        bugfix: 'bugfix/',
        hotfix: 'hotfix/',
        release: 'release/',
        docs: 'docs/',
      },
      workflows: {
        auto_cleanup: true,
        enforce_naming: true,
        require_approval: true,
      },
    };
  }

  /**
   * Create a new branch with proper naming.
   *
   * This function validates the branch type against the configuration, generates a branch name, checks for existing branches, and attempts to switch to the specified base branch while pulling the latest changes. If the base branch is not found, it defaults to the 'main' branch. Finally, it creates the new branch and logs relevant information. If any errors occur during the process, they are caught and logged.
   *
   * @param type - The type of the branch to create.
   * @param description - A description for the new branch.
   * @param baseBranch - The base branch to switch to before creating the new branch (defaults to 'develop').
   * @returns The name of the created branch or null if an error occurred.
   */
  createBranch(type, description, baseBranch = 'develop') {
    console.log(`🌿 Creating ${type} branch: ${description}`);

    try {
      // Validate branch type
      if (!this.config.naming[type]) {
        throw new Error(`Invalid branch type: ${type}`);
      }

      // Generate branch name
      const branchName = this.generateBranchName(type, description);

      // Check if branch already exists
      if (this.branchExists(branchName)) {
        throw new Error(`Branch ${branchName} already exists`);
      }

      // Switch to base branch and pull latest
      try {
        execSync(`git checkout ${baseBranch}`, { stdio: 'pipe' });
        execSync(`git pull origin ${baseBranch}`, { stdio: 'pipe' });
      } catch (error) {
        if (baseBranch === 'develop') {
          console.log('⚠️ develop branch not found, using main instead');
          execSync('git checkout main', { stdio: 'pipe' });
          execSync('git pull origin main', { stdio: 'pipe' });
        } else {
          throw error;
        }
      }

      // Create new branch
      execSync(`git checkout -b ${branchName}`, { stdio: 'pipe' });

      console.log(`✅ Created branch: ${branchName}`);
      console.log(`📋 Base branch: ${baseBranch}`);
      console.log(`🔗 Push with: git push origin ${branchName}`);

      return branchName;
    } catch (error) {
      console.error(`❌ Error creating branch: ${error.message}`);
      return null;
    }
  }

  /**
   * Generate a proper branch name based on type and description.
   */
  generateBranchName(type, description) {
    const prefix = this.config.naming[type];
    const cleanDescription = description
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .trim();

    return `${prefix}${cleanDescription}`;
  }

  /**
   * Check if a Git branch exists.
   */
  branchExists(branchName) {
    try {
      execSync(`git show-ref --verify --quiet refs/heads/${branchName}`, {
        stdio: 'pipe',
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * List all branches with status.
   *
   * This function retrieves and displays the status of local and remote Git branches. It first fetches local branches and filters out any empty entries. Then, it retrieves remote branches while excluding the 'HEAD' reference. The current branch is identified, and each branch is displayed with its corresponding status and type. The function also handles errors during execution and logs an appropriate message.
   */
  listBranches() {
    console.log('🌿 Branch Status:');

    try {
      // Get local branches
      const localBranches = execSync('git branch --format="%(refname:short)"', {
        encoding: 'utf8',
      })
        .trim()
        .split('\n')
        .filter(b => b);

      // Get remote branches
      const remoteBranches = execSync(
        'git branch -r --format="%(refname:short)"',
        {
          encoding: 'utf8',
        }
      )
        .trim()
        .split('\n')
        .filter(b => b && !b.includes('HEAD'));

      // Get current branch
      const currentBranch = execSync('git branch --show-current', {
        encoding: 'utf8',
      }).trim();

      console.log('\n📋 Local Branches:');
      localBranches.forEach(branch => {
        const status = branch === currentBranch ? '👈 current' : '';
        const type = this.getBranchType(branch);
        const icon = this.getBranchIcon(type);
        console.log(`  ${icon} ${branch} ${status}`);
      });

      console.log('\n🌐 Remote Branches:');
      remoteBranches.forEach(branch => {
        const type = this.getBranchType(branch);
        const icon = this.getBranchIcon(type);
        console.log(`  ${icon} ${branch}`);
      });

      return {
        local: localBranches,
        remote: remoteBranches,
        current: currentBranch,
      };
    } catch (error) {
      console.error(`❌ Error listing branches: ${error.message}`);
      return null;
    }
  }

  /**
   * Get branch type from name based on configured prefixes.
   */
  getBranchType(branchName) {
    for (const [type, prefix] of Object.entries(this.config.naming)) {
      if (branchName.startsWith(prefix)) {
        return type;
      }
    }
    return 'unknown';
  }

  /**
   * Get the corresponding branch icon based on the type.
   */
  getBranchIcon(type) {
    const icons = {
      feature: '✨',
      bugfix: '🐛',
      hotfix: '🚨',
      release: '🚀',
      docs: '📚',
      main: '🏠',
      develop: '🔧',
      unknown: '❓',
    };
    return icons[type] || icons.unknown;
  }

  /**
   * Clean up merged branches.
   *
   * This function identifies and deletes local and remote branches that have been merged into the main branch, excluding the main and develop branches. It first retrieves the list of merged branches, logs the branches found, and attempts to delete each local branch. It then retrieves the remote branches and attempts to delete them as well, logging any errors encountered during the deletion process.
   *
   * @throws Error If an error occurs during the execution of git commands.
   */
  cleanupMergedBranches() {
    console.log('🧹 Cleaning up merged branches...');

    try {
      // Get merged branches (excluding main and develop)
      const allMergedBranches = execSync('git branch --merged main', {
        encoding: 'utf8',
      })
        .trim()
        .split('\n')
        .map(b => b.replace(/^\s*\*?\s*/, '').trim())
        .filter(b => b && b !== 'main' && b !== 'develop');

      if (allMergedBranches.length === 0) {
        console.log('✅ No merged branches to clean up');
        return;
      }

      console.log(`🗑️ Found ${allMergedBranches.length} merged branches:`);
      allMergedBranches.forEach(branch => {
        console.log(`  - ${branch}`);
      });

      // Delete local branches
      allMergedBranches.forEach(branch => {
        try {
          execSync(`git branch -d ${branch}`, { stdio: 'pipe' });
          console.log(`✅ Deleted local branch: ${branch}`);
        } catch (error) {
          console.log(`⚠️ Could not delete ${branch}: ${error.message}`);
        }
      });

      // Delete remote branches
      const allRemoteBranches = execSync('git branch -r --merged main', {
        encoding: 'utf8',
      })
        .trim()
        .split('\n')
        .map(b => b.replace(/^\s*origin\//, '').trim())
        .filter(b => b && b !== 'main' && b !== 'develop');

      allRemoteBranches.forEach(branch => {
        try {
          execSync(`git push origin --delete ${branch}`, { stdio: 'pipe' });
          console.log(`✅ Deleted remote branch: ${branch}`);
        } catch (error) {
          console.log(`⚠️ Could not delete remote ${branch}: ${error.message}`);
        }
      });

      console.log('✅ Cleanup completed');
    } catch (error) {
      console.error(`❌ Error during cleanup: ${error.message}`);
    }
  }

  /**
   * Validate branch naming convention.
   *
   * This function checks if the provided branchName adheres to the specified naming conventions.
   * It verifies that the branch name starts with a valid type defined in the configuration,
   * checks the length constraints, and ensures that it contains only allowed characters (lowercase letters, numbers, and hyphens).
   * If any of these conditions are not met, it logs an appropriate error message and returns false; otherwise, it confirms the validity of the branch name.
   *
   * @param {string} branchName - The name of the branch to validate.
   */
  validateBranchName(branchName) {
    console.log(`🔍 Validating branch name: ${branchName}`);

    const validTypes = Object.keys(this.config.naming);
    const typePattern = new RegExp(`^(${validTypes.join('|')})/`);

    if (!typePattern.test(branchName)) {
      console.log(
        `❌ Invalid branch name. Must start with: ${validTypes.join(', ')}`
      );
      return false;
    }

    if (branchName.length < 5) {
      console.log('❌ Branch name too short');
      return false;
    }

    if (branchName.length > 50) {
      console.log('❌ Branch name too long');
      return false;
    }

    if (!/^[a-z0-9/-]+$/.test(branchName)) {
      console.log(
        '❌ Branch name contains invalid characters. Use lowercase, numbers, hyphens only'
      );
      return false;
    }

    console.log('✅ Branch name is valid');
    return true;
  }

  /**
   * Get branch information
   */
  getBranchInfo(branchName) {
    try {
      const info = {
        name: branchName,
        type: this.getBranchType(branchName),
        exists: this.branchExists(branchName),
        lastCommit: null,
        ahead: 0,
        behind: 0,
        status: 'unknown',
      };

      if (info.exists) {
        // Get last commit
        try {
          info.lastCommit = execSync(
            `git log -1 --format="%h %s" ${branchName}`,
            {
              encoding: 'utf8',
            }
          ).trim();
        } catch (error) {
          // Branch might not have commits
        }

        // Get ahead/behind status
        try {
          const status = execSync(
            `git rev-list --left-right --count origin/main...${branchName}`,
            {
              encoding: 'utf8',
            }
          ).trim();
          const [behind, ahead] = status.split('\t').map(Number);
          info.ahead = ahead;
          info.behind = behind;
        } catch (error) {
          // Branch might not be tracked
        }

        // Determine status
        if (info.ahead > 0 && info.behind > 0) {
          info.status = 'diverged';
        } else if (info.ahead > 0) {
          info.status = 'ahead';
        } else if (info.behind > 0) {
          info.status = 'behind';
        } else {
          info.status = 'up-to-date';
        }
      }

      return info;
    } catch (error) {
      console.error(`❌ Error getting branch info: ${error.message}`);
      return null;
    }
  }

  /**
   * Switch to branch with safety checks.
   *
   * This function attempts to switch to a specified branch after performing several safety checks.
   * It first verifies if the branch exists using the branchExists method. Then, it checks for any uncommitted changes
   * by executing a git status command. If there are uncommitted changes, it logs a warning and returns false.
   * If all checks pass, it switches to the branch and pulls the latest changes from the remote repository.
   *
   * @param {string} branchName - The name of the branch to switch to.
   */
  switchToBranch(branchName) {
    console.log(`🔄 Switching to branch: ${branchName}`);

    try {
      // Check if branch exists
      if (!this.branchExists(branchName)) {
        throw new Error(`Branch ${branchName} does not exist`);
      }

      // Check for uncommitted changes
      const status = execSync('git status --porcelain', {
        encoding: 'utf8',
      }).trim();
      if (status) {
        console.log(
          '⚠️ You have uncommitted changes. Please commit or stash them first.'
        );
        console.log('Uncommitted files:');
        console.log(status);
        return false;
      }

      // Switch to branch
      execSync(`git checkout ${branchName}`, { stdio: 'pipe' });
      execSync(`git pull origin ${branchName}`, { stdio: 'pipe' });

      console.log(`✅ Switched to ${branchName}`);
      return true;
    } catch (error) {
      console.error(`❌ Error switching to branch: ${error.message}`);
      return false;
    }
  }

  /**
   * Merge branch with proper workflow.
   *
   * This function merges the specified sourceBranch into the targetBranch using the specified mergeType.
   * It first validates the existence of both branches, then switches to the target branch, pulls the latest changes,
   * and performs the merge operation. If the mergeType is 'squash', it commits the changes with a message.
   * Finally, it pushes the merged changes to the remote repository and logs the success or error message.
   *
   * @param {string} sourceBranch - The name of the source branch to merge from.
   * @param {string} [targetBranch='develop'] - The name of the target branch to merge into.
   * @param {string} [mergeType='squash'] - The type of merge to perform ('squash' or regular).
   */
  mergeBranch(sourceBranch, targetBranch = 'develop', mergeType = 'squash') {
    console.log(`🔀 Merging ${sourceBranch} into ${targetBranch}`);

    try {
      // Validate branches exist
      if (!this.branchExists(sourceBranch)) {
        throw new Error(`Source branch ${sourceBranch} does not exist`);
      }

      if (!this.branchExists(targetBranch)) {
        throw new Error(`Target branch ${targetBranch} does not exist`);
      }

      // Switch to target branch
      execSync(`git checkout ${targetBranch}`, { stdio: 'pipe' });
      execSync(`git pull origin ${targetBranch}`, { stdio: 'pipe' });

      // Perform merge
      if (mergeType === 'squash') {
        execSync(`git merge --squash ${sourceBranch}`, { stdio: 'pipe' });
        execSync(`git commit -m "Merge ${sourceBranch} into ${targetBranch}"`, {
          stdio: 'pipe',
        });
      } else {
        execSync(`git merge ${sourceBranch}`, { stdio: 'pipe' });
      }

      // Push changes
      execSync(`git push origin ${targetBranch}`, { stdio: 'pipe' });

      console.log(
        `✅ Successfully merged ${sourceBranch} into ${targetBranch}`
      );
      return true;
    } catch (error) {
      console.error(`❌ Error merging branch: ${error.message}`);
      return false;
    }
  }

  /**
   * Create pull request
   *
   * This function creates a pull request from the specified source branch to the target branch.
   * It first attempts to push the source branch to the remote repository. If the title or body
   * of the pull request is not provided, it generates them based on the branch type and other
   * relevant information. Finally, it executes a command to create the pull request using the
   * GitHub CLI and logs the outcome.
   *
   * @param {string} sourceBranch - The name of the source branch to create the pull request from.
   * @param {string} [targetBranch='develop'] - The name of the target branch to create the pull request to.
   * @param {string} [title=''] - The title of the pull request.
   * @param {string} [body=''] - The body content of the pull request.
   */
  createPullRequest(
    sourceBranch,
    targetBranch = 'develop',
    title = '',
    body = ''
  ) {
    console.log(`📝 Creating pull request: ${sourceBranch} → ${targetBranch}`);

    try {
      // Push branch if not already pushed
      execSync(`git push origin ${sourceBranch}`, { stdio: 'pipe' });

      // Generate PR title if not provided
      if (!title) {
        const type = this.getBranchType(sourceBranch);
        const description = sourceBranch.replace(this.config.naming[type], '');
        title = `${type}: ${description}`;
      }

      // Generate PR body if not provided
      if (!body) {
        body = this.generatePRBody(sourceBranch, targetBranch);
      }

      // Create PR using GitHub CLI
      const prCommand = `gh pr create --title "${title}" --body "${body}" --base ${targetBranch} --head ${sourceBranch}`;
      execSync(prCommand, { stdio: 'pipe' });

      console.log('✅ Pull request created successfully');
      return true;
    } catch (error) {
      console.error(`❌ Error creating pull request: ${error.message}`);
      return false;
    }
  }

  /**
   * Generate PR body template.
   */
  generatePRBody(sourceBranch, targetBranch) {
    const type = this.getBranchType(sourceBranch);
    const description = sourceBranch.replace(this.config.naming[type], '');

    return `## Description
${description}

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tests pass locally
- [ ] Manual testing completed
- [ ] No breaking changes

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated (if needed)
- [ ] No console.log statements left in code`;
  }

  /**
   * Run branch health check.
   *
   * This function checks the health of branches in a repository by verifying if any branches are behind the main branch or if there are unmerged branches. It collects issues found during the checks and logs the results. If any issues are detected, they are reported; otherwise, a success message is logged. The function returns an object indicating the health status and any issues found.
   *
   * @returns An object containing a boolean `healthy` indicating if the branches are in good condition and an array of `issues` found during the check.
   */
  runHealthCheck() {
    console.log('🏥 Running branch health check...');

    const issues = [];

    try {
      // Check for old branches
      const branches = this.listBranches();
      if (branches && branches.local) {
        branches.local.forEach(branch => {
          if (branch === 'main' || branch === 'develop') return;

          const info = this.getBranchInfo(branch);
          if (info && info.status === 'behind') {
            issues.push(`Branch ${branch} is behind main`);
          }
        });
      }

      // Check for unmerged branches
      const unmergedBranches = execSync('git branch --no-merged main', {
        encoding: 'utf8',
      })
        .trim()
        .split('\n')
        .map(b => b.replace(/^\s*\*?\s*/, '').trim())
        .filter(b => b && b !== 'main' && b !== 'develop');

      if (unmergedBranches.length > 0) {
        issues.push(`Found ${unmergedBranches.length} unmerged branches`);
      }

      // Report issues
      if (issues.length === 0) {
        console.log('✅ Branch health check passed');
      } else {
        console.log('⚠️ Branch health check found issues:');
        issues.forEach(issue => console.log(`  - ${issue}`));
      }

      return { healthy: issues.length === 0, issues };
    } catch (error) {
      console.error(`❌ Error during health check: ${error.message}`);
      return { healthy: false, issues: [error.message] };
    }
  }

  /**
   * Show current configuration.
   *
   * This function displays the current configuration for the Branch Manager, including the source of the configuration file, branch settings, naming conventions, workflow settings, additional settings, and integrations. It checks for the existence of the configuration file and logs the appropriate message. The function iterates over various configuration sections, formatting and displaying the relevant information for each.
   */
  showConfig() {
    console.log('⚙️  Branch Manager Configuration\n');

    console.log('📁 Config Source:');
    const configPath = path.join(
      this.projectRoot,
      '.github',
      'branch-config.yml'
    );
    if (fs.existsSync(configPath)) {
      console.log(`   ✅ Using: ${configPath}`);
    } else {
      console.log(
        `   ⚠️  Using: Default configuration (${configPath} not found)`
      );
    }

    console.log('\n🌿 Branch Settings:');
    Object.entries(this.config.branches).forEach(([name, settings]) => {
      const protectedIcon = settings.protected ? '🔒' : '🔓';
      const reviews = settings.required_reviews || 0;
      console.log(
        `   ${protectedIcon} ${name}: ${reviews} review${reviews !== 1 ? 's' : ''} required`
      );
    });

    console.log('\n🏷️  Naming Conventions:');
    Object.entries(this.config.naming).forEach(([type, prefix]) => {
      console.log(`   ${type}: ${prefix}`);
    });

    console.log('\n⚡ Workflow Settings:');
    Object.entries(this.config.workflows).forEach(([setting, enabled]) => {
      const icon = enabled ? '✅' : '❌';
      console.log(`   ${icon} ${setting.replace(/_/g, ' ')}`);
    });

    // Show additional settings if they exist
    if (this.config.settings) {
      console.log('\n🔧 Additional Settings:');
      Object.entries(this.config.settings).forEach(([key, value]) => {
        console.log(`   ${key}: ${value}`);
      });
    }

    if (this.config.integrations) {
      console.log('\n🔌 Integrations:');
      Object.entries(this.config.integrations).forEach(
        ([service, settings]) => {
          console.log(`   ${service}:`);
          Object.entries(settings).forEach(([key, value]) => {
            const icon = value ? '✅' : '❌';
            console.log(`     ${icon} ${key.replace(/_/g, ' ')}`);
          });
        }
      );
    }
  }

  /**
   * Show help information for the Branch Manager Git Workflow Automation.
   */
  showHelp() {
    console.log(`
🌿 Branch Manager - Git Workflow Automation

Usage: node scripts/branch-manager.js <command> [options]

Commands:
  create <type> <description> [base]  Create a new branch
  list                               List all branches
  cleanup                           Clean up merged branches
  validate <name>                   Validate branch naming
  info <name>                       Show branch information
  switch <name>                     Switch to branch
  merge <source> [target] [type]    Merge branch
  pr <source> [target] [title]      Create pull request
  health                            Run health check
  config                            Show current configuration
  help                              Show this help

Examples:
  node scripts/branch-manager.js create feature github-integration
  node scripts/branch-manager.js create bugfix auth-redirect-loop
  node scripts/branch-manager.js create hotfix security-patch main
  node scripts/branch-manager.js list
  node scripts/branch-manager.js cleanup
  node scripts/branch-manager.js validate feature/my-feature
  node scripts/branch-manager.js info feature/my-feature
  node scripts/branch-manager.js switch feature/my-feature
  node scripts/branch-manager.js merge feature/my-feature develop
  node scripts/branch-manager.js pr feature/my-feature develop
  node scripts/branch-manager.js health

Branch Types:
  feature    - New features (from develop)
  bugfix     - Bug fixes (from develop)
  hotfix     - Critical fixes (from main)
  release    - Release preparation (from develop)
  docs       - Documentation (from develop)
`);
  }
}

// CLI Interface
if (require.main === module) {
  const command = process.argv[2];
  const args = process.argv.slice(3);

  const manager = new BranchManager();

  switch (command) {
    case 'create':
      if (args.length < 2) {
        console.error('Usage: create <type> <description> [base]');
        process.exit(1);
      }
      manager.createBranch(args[0], args[1], args[2]);
      break;

    case 'list':
      manager.listBranches();
      break;

    case 'cleanup':
      manager.cleanupMergedBranches();
      break;

    case 'validate':
      if (args.length < 1) {
        console.error('Usage: validate <name>');
        process.exit(1);
      }
      manager.validateBranchName(args[0]);
      break;

    case 'info':
      if (args.length < 1) {
        console.error('Usage: info <name>');
        process.exit(1);
      }
      console.log(JSON.stringify(manager.getBranchInfo(args[0]), null, 2));
      break;

    case 'switch':
      if (args.length < 1) {
        console.error('Usage: switch <name>');
        process.exit(1);
      }
      manager.switchToBranch(args[0]);
      break;

    case 'merge':
      if (args.length < 1) {
        console.error('Usage: merge <source> [target] [type]');
        process.exit(1);
      }
      manager.mergeBranch(args[0], args[1], args[2]);
      break;

    case 'pr':
      if (args.length < 1) {
        console.error('Usage: pr <source> [target] [title]');
        process.exit(1);
      }
      manager.createPullRequest(args[0], args[1], args[2]);
      break;

    case 'health':
      manager.runHealthCheck();
      break;

    case 'config':
      manager.showConfig();
      break;

    case 'help':
    default:
      manager.showHelp();
      break;
  }
}

module.exports = BranchManager;
