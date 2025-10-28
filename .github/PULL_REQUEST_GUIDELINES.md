# Pull Request Guidelines

## 🎯 Overview

This document outlines the guidelines and best practices for creating, reviewing, and merging pull requests in the UnifiedHQ project. Following these guidelines ensures code quality, maintainability, and smooth collaboration.

## 📝 Before Creating a PR

### 1. Branch Management
- **Branch naming**: Use descriptive names following the pattern:
  - `feature/description` (e.g., `feature/github-integration`)
  - `bugfix/description` (e.g., `bugfix/auth-redirect`)
  - `hotfix/description` (e.g., `hotfix/security-patch`)
  - `refactor/description` (e.g., `refactor/api-structure`)

- **Keep branches focused**: One feature/fix per branch
- **Keep branches up to date**: Regularly rebase with `main`
- **Clean up**: Delete branches after merging

### 2. Pre-submission Checklist
- [ ] Code compiles without errors
- [ ] All tests pass (`bun run test`)
- [ ] Linting passes (`bun run lint`)
- [ ] Formatting is correct (`bun run format:check`)
- [ ] Build succeeds (`bun run build`)
- [ ] No console.log statements left in code
- [ ] No TODO comments left in code
- [ ] Self-review completed

### 3. Commit Messages
Follow [Conventional Commits](https://www.conventionalcommits.org/) format:

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(github): add repository caching
fix(auth): resolve redirect loop issue
docs(api): update integration guide
refactor(ui): simplify component structure
```

## 🔍 PR Creation Process

### 1. Title and Description
- **Title**: Clear, descriptive, and follows conventional commits
- **Description**: Use the PR template completely
- **Link issues**: Use "Fixes #123" or "Closes #123" when applicable

### 2. Labels and Assignments
- **Labels**: Add appropriate labels (bug, feature, documentation, etc.)
- **Reviewers**: Assign relevant team members
- **Milestone**: Set if part of a larger initiative

### 3. Size Guidelines
- **Small PRs**: Preferred for faster review and easier debugging
- **Large PRs**: Break down into smaller, logical chunks
- **Maximum**: Aim for < 400 lines of changes per PR

## 🧪 Testing Requirements

### 1. Test Coverage
- **New features**: Must include tests
- **Bug fixes**: Must include regression tests
- **Refactoring**: Ensure existing tests still pass
- **Critical paths**: Always test authentication, data flow, and API endpoints

### 2. Testing Types
- **Unit tests**: For individual functions/components
- **Integration tests**: For API endpoints and database operations
- **E2E tests**: For critical user flows
- **Manual testing**: For UI changes and complex interactions

### 3. Test Environment
- **Local testing**: Always test locally first
- **Staging**: Test in staging environment for complex changes
- **Database**: Test with realistic data when applicable

## 🔍 Code Review Process

### 1. Review Timeline
- **Initial review**: Within 24 hours
- **Follow-up reviews**: Within 12 hours
- **Blocking issues**: Address immediately
- **Non-blocking issues**: Address in follow-up PR if minor

### 2. Review Focus Areas

#### Code Quality
- [ ] Code follows project style guidelines
- [ ] Functions are focused and single-purpose
- [ ] Error handling is comprehensive
- [ ] TypeScript types are properly defined
- [ ] No code duplication
- [ ] Performance considerations addressed

#### Project-Specific Rules
- [ ] **GitHub Integration**: Uses cached GitHub client (`@/lib/integrations/github-cached`)
- [ ] **Image Optimization**: Uses `OptimizedImage` component instead of standard `<img>`
- [ ] **Database Operations**: Efficient queries and proper error handling
- [ ] **Authentication**: Proper auth checks and user context
- [ ] **API Design**: RESTful endpoints with proper validation

#### Security
- [ ] No sensitive data exposed
- [ ] Input validation implemented
- [ ] Authentication/authorization handled properly
- [ ] No hardcoded secrets or credentials
- [ ] SQL injection prevention
- [ ] XSS prevention

#### Performance
- [ ] No performance regressions
- [ ] Database queries optimized
- [ ] Images optimized and lazy-loaded
- [ ] Memory leaks prevented
- [ ] GitHub API calls cached appropriately

### 3. Review Comments
- **Be constructive**: Focus on improvement, not criticism
- **Be specific**: Point to exact lines and suggest alternatives
- **Be respectful**: Maintain professional tone
- **Be thorough**: Check all aspects of the code

## ✅ Approval Process

### 1. Approval Requirements
- **Minimum reviewers**: 1 approval for small changes, 2 for significant changes
- **No blocking issues**: All review comments addressed
- **All checks pass**: CI/CD pipeline must be green
- **Up to date**: Branch must be current with main

### 2. Merge Strategy
- **Squash and merge**: For feature branches (preferred)
- **Rebase and merge**: For clean commit history
- **Merge commit**: For complex changes with multiple commits

### 3. Post-merge
- **Delete branch**: Clean up merged branches
- **Update documentation**: If needed
- **Deploy**: Follow deployment process
- **Monitor**: Watch for issues in production

## 🚫 Common Issues to Avoid

### 1. Code Issues
- ❌ Large, monolithic PRs
- ❌ Mixing unrelated changes
- ❌ Leaving console.log statements
- ❌ Incomplete error handling
- ❌ Missing TypeScript types
- ❌ Hardcoded values instead of constants

### 2. Process Issues
- ❌ Skipping the PR template
- ❌ Not linking related issues
- ❌ Requesting review without self-review
- ❌ Ignoring CI/CD failures
- ❌ Merging without approval

### 3. Project-Specific Issues
- ❌ Using non-cached GitHub API calls
- ❌ Using standard `<img>` instead of `OptimizedImage`
- ❌ Not following database caching patterns
- ❌ Missing authentication checks
- ❌ Inconsistent error handling patterns

## 🔧 Tools and Automation

### 1. Pre-commit Hooks
- **Linting**: ESLint runs automatically
- **Formatting**: Prettier formats code
- **Type checking**: TypeScript compilation check
- **Tests**: Unit tests run automatically

### 2. CI/CD Pipeline
- **Build check**: Ensures code compiles
- **Test suite**: Runs all tests
- **Linting**: Code style validation
- **Security scan**: Vulnerability detection
- **Performance check**: Bundle size analysis

### 3. Code Quality Tools
- **ESLint**: Code quality and style
- **Prettier**: Code formatting
- **TypeScript**: Type safety
- **Husky**: Git hooks
- **Lint-staged**: Pre-commit checks

## 📚 Resources

### Documentation
- [Conventional Commits](https://www.conventionalcommits.org/)
- [GitHub Flow](https://guides.github.com/introduction/flow/)
- [Code Review Best Practices](https://google.github.io/eng-practices/review/)

### Project-Specific
- [GitHub Caching Rules](docs/GITHUB_CACHING.md)
- [Image Optimization Guide](docs/IMAGE_OPTIMIZATION.md)
- [API Documentation](docs/API.md)

### Tools
- [ESLint Configuration](.eslintrc.json)
- [Prettier Configuration](.prettierrc)
- [TypeScript Configuration](tsconfig.json)

## 🤝 Getting Help

### Questions
- **Code questions**: Ask in PR comments
- **Process questions**: Ask in team chat
- **Technical issues**: Create an issue

### Escalation
- **Blocking issues**: Tag team leads
- **Urgent fixes**: Use hotfix process
- **Complex changes**: Schedule design review

---

## 📋 Quick Reference

### PR Checklist
- [ ] Branch name follows convention
- [ ] PR title is descriptive
- [ ] Description uses template
- [ ] Issues linked
- [ ] Tests added/updated
- [ ] Code reviewed by self
- [ ] All checks pass
- [ ] Ready for review

### Review Checklist
- [ ] Code quality checked
- [ ] Security reviewed
- [ ] Performance considered
- [ ] Tests adequate
- [ ] Documentation updated
- [ ] Project rules followed

**Remember: Good PRs make the codebase better for everyone! 🚀**
