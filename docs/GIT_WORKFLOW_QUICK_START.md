# Git Workflow Quick Start Guide

## 🚀 Quick Commands

### Branch Management
```bash
# Create a new feature branch
bun run branch:create feature my-awesome-feature

# List all branches
bun run branch:list

# Switch to a branch
bun run branch:switch feature/my-awesome-feature

# Validate branch naming
bun run branch:validate feature/my-awesome-feature

# Create pull request
bun run branch:pr feature/my-awesome-feature develop

# Clean up merged branches
bun run branch:cleanup

# Check branch health
bun run branch:health
```

### Release Management
```bash
# Bump version (patch/minor/major)
bun run release:bump patch

# Create release branch
bun run release:create v1.0.0

# Generate changelog
bun run release:changelog v1.0.0

# Generate release notes
bun run release:notes v1.0.0

# Complete release process
bun run release:complete v1.0.0 patch
```

### Hotfix Management
```bash
# Create hotfix branch
bun run hotfix:create "fix critical auth bug" critical

# Validate hotfix
bun run hotfix:validate hotfix/critical-fix-auth-bug-2024-01-15T10-30-00

# Create hotfix PR
bun run hotfix:pr hotfix/critical-fix-auth-bug-2024-01-15T10-30-00 "fix critical auth bug" critical

# Deploy hotfix
bun run hotfix:deploy hotfix/critical-fix-auth-bug-2024-01-15T10-30-00

# Complete hotfix process
bun run hotfix:complete "fix critical auth bug" critical

# List active hotfixes
bun run hotfix:list
```

## 📋 Common Workflows

### 1. Feature Development
```bash
# 1. Create feature branch
bun run branch:create feature github-integration

# 2. Make your changes and commit
git add .
git commit -m "feat(github): add repository caching"

# 3. Push and create PR
git push origin feature/github-integration
bun run branch:pr feature/github-integration develop

# 4. After merge, clean up
bun run branch:cleanup
```

### 2. Bug Fix
```bash
# 1. Create bugfix branch
bun run branch:create bugfix auth-redirect-loop

# 2. Fix the bug and commit
git add .
git commit -m "fix(auth): resolve redirect loop issue"

# 3. Push and create PR
git push origin bugfix/auth-redirect-loop
bun run branch:pr bugfix/auth-redirect-loop develop
```

### 3. Emergency Hotfix
```bash
# 1. Create hotfix branch
bun run hotfix:create "fix critical security vulnerability" critical

# 2. Implement fix and commit
git add .
git commit -m "hotfix(security): patch critical vulnerability"

# 3. Validate and deploy
bun run hotfix:validate hotfix/critical-fix-security-vulnerability-2024-01-15T10-30-00
bun run hotfix:deploy hotfix/critical-fix-security-vulnerability-2024-01-15T10-30-00
```

### 4. Release Process
```bash
# 1. Bump version
bun run release:bump minor

# 2. Create release branch
bun run release:create v1.1.0

# 3. Generate changelog and notes
bun run release:changelog v1.1.0
bun run release:notes v1.1.0

# 4. Complete release
bun run release:complete v1.1.0 minor
```

## 🌳 Branch Types

| Type | Pattern | Purpose | Base Branch |
|------|---------|---------|-------------|
| `feature` | `feature/description` | New features | `develop` |
| `bugfix` | `bugfix/description` | Bug fixes | `develop` |
| `hotfix` | `hotfix/description` | Critical fixes | `main` |
| `release` | `release/v1.0.0` | Release prep | `develop` |
| `docs` | `docs/description` | Documentation | `develop` |

## 🔒 Branch Protection

### Main Branch
- ✅ Requires 2 reviewers
- ✅ Requires status checks to pass
- ✅ No direct pushes
- ✅ Dismiss stale reviews

### Develop Branch
- ✅ Requires 1 reviewer
- ✅ Requires status checks to pass
- ✅ No direct pushes
- ✅ Dismiss stale reviews

### Release Branches
- ✅ Requires 2 reviewers (release managers)
- ✅ Requires status checks to pass
- ✅ No direct pushes
- ✅ Dismiss stale reviews

## 📊 Branch Health Monitoring

The system automatically monitors:
- ✅ Branch age (warns if > 2 weeks)
- ✅ Merge conflicts
- ✅ Outdated branches
- ✅ Large PRs (> 1000 lines)
- ✅ Hotfix urgency

## 🚨 Emergency Procedures

### Critical Bug in Production
1. **Create hotfix**: `bun run hotfix:create "description" critical`
2. **Implement fix**: Make minimal, focused changes
3. **Validate**: `bun run hotfix:validate <branch>`
4. **Deploy**: `bun run hotfix:deploy <branch>`
5. **Monitor**: Watch for issues
6. **Cleanup**: `bun run hotfix:cleanup <branch>`

### Rollback Procedure
1. **Identify commit**: Find the problematic commit hash
2. **Rollback**: `bun run hotfix:rollback <commit-hash>`
3. **Deploy**: Push rollback to production
4. **Monitor**: Verify system stability
5. **Investigate**: Root cause analysis

## 📈 Metrics and Monitoring

### Key Metrics Tracked
- **Branch Age**: Average time branches exist
- **Merge Time**: Time from PR creation to merge
- **Review Time**: Time for code review completion
- **Release Frequency**: How often releases are made
- **Hotfix Frequency**: Number of emergency fixes

### Automated Alerts
- 🚨 Critical hotfix created
- ⚠️ Large PR detected
- 🔍 Branch health issues
- 📊 Release metrics
- 🧹 Cleanup reminders

## 🛠️ Configuration

### Branch Naming Rules
- Use kebab-case (lowercase with hyphens)
- Be descriptive but concise
- Include issue number if applicable
- Follow type/description pattern

### Commit Message Format
```
type(scope): description

[optional body]

[optional footer]
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`

### PR Requirements
- Use appropriate template
- Link related issues
- Include tests for new features
- Update documentation if needed
- Pass all CI checks

## 🔧 Troubleshooting

### Common Issues

#### Branch Name Validation Failed
```bash
# Check naming convention
bun run branch:validate feature/my-feature

# Use proper format: type/description
bun run branch:create feature my-feature
```

#### Merge Conflicts
```bash
# Update branch with latest changes
git checkout develop
git pull origin develop
git checkout feature/my-feature
git rebase develop

# Resolve conflicts and continue
git add .
git rebase --continue
```

#### Hotfix Validation Failed
```bash
# Check hotfix validation
bun run hotfix:validate hotfix/my-hotfix

# Fix issues and retry
bun run hotfix:validate hotfix/my-hotfix
```

#### Release Process Failed
```bash
# Check release status
bun run release:create v1.0.0

# Fix issues and retry
bun run release:complete v1.0.0 patch
```

### Getting Help

1. **Check logs**: Look at GitHub Actions logs
2. **Validate manually**: Use validation commands
3. **Check documentation**: Read the full Git branching strategy
4. **Ask team**: Contact maintainers for help

## 📚 Additional Resources

- [Full Git Branching Strategy](GIT_BRANCHING_STRATEGY.md)
- [Pull Request Guidelines](../.github/PULL_REQUEST_GUIDELINES.md)
- [Contributing Guide](../CONTRIBUTING.md)
- [GitHub Actions Workflows](../.github/workflows/)

---

**Need help?** Check the full documentation or ask the development team!
