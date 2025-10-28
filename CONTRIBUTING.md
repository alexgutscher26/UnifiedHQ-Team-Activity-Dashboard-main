# Contributing to UnifiedHQ

Thank you for your interest in contributing to UnifiedHQ! This document provides guidelines and information for contributors.

## 🎯 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Coding Standards](#coding-standards)
- [Git Workflow](#git-workflow)
- [Pull Request Process](#pull-request-process)
- [Issue Guidelines](#issue-guidelines)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)
- [Release Process](#release-process)

## 📜 Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for all contributors. Please:

- Be respectful and constructive
- Focus on what's best for the community
- Show empathy towards other community members
- Accept constructive criticism gracefully
- Help create a positive environment

### Unacceptable Behavior

- Harassment, trolling, or personal attacks
- Discriminatory language or behavior
- Spam or off-topic discussions
- Sharing private information without permission

## 🚀 Getting Started

### Prerequisites

- **Node.js**: Version 18.17.0 or higher
- **Package Manager**: npm, yarn, or pnpm
- **Git**: Latest version
- **Database**: PostgreSQL (for local development)
- **Redis**: For caching (optional for local development)

### First Time Setup

1. **Fork the repository**
   ```bash
   # Fork on GitHub, then clone your fork
   git clone https://github.com/your-username/unifiedhq.git
   cd unifiedhq
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

4. **Set up the database**
   ```bash
   npx prisma generate
   npx prisma db push
   npx prisma db seed
   ```

5. **Start the development server**
   ```bash
   bun run dev
   # or
   yarn dev
   # or
   pnpm dev
   ```

## 🏗️ Development Setup

### Environment Configuration

Create a `.env.local` file with the following variables:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/unifiedhq"

# Authentication
BETTER_AUTH_SECRET="your-secret-key"
BETTER_AUTH_URL="http://localhost:3000"

# GitHub Integration
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"

# Redis (optional)
REDIS_URL="redis://localhost:6379"

# Sentry (optional)
SENTRY_DSN="your-sentry-dsn"

# AI Summary (OpenRouter)
OPENROUTER_API_KEY="your-openrouter-api-key"
```

### Available Scripts

```bash
# Development
bun run dev          # Start development server
bun run build        # Build for production
bun run start        # Start production server

# Code Quality
bun run lint         # Run ESLint
bun run format       # Format code with Prettier
bun run format:check # Check code formatting

# Database
npx prisma generate  # Generate Prisma client
npx prisma db push   # Push schema changes
npx prisma studio    # Open Prisma Studio
```

## 📁 Project Structure

```
src/
├── app/                 # Next.js app directory
│   ├── api/            # API routes
│   ├── auth/           # Authentication pages
│   ├── dashboard/      # Dashboard pages
│   └── globals.css     # Global styles
├── components/         # React components
│   ├── ui/            # Reusable UI components
│   └── ...            # Feature-specific components
├── lib/               # Utility libraries
│   ├── integrations/  # Third-party integrations
│   └── ...            # Other utilities
├── hooks/             # Custom React hooks
├── contexts/          # React contexts
└── styles/            # Additional styles
```

### Key Directories

- **`/src/app`**: Next.js 13+ app router pages and API routes
- **`/src/components`**: Reusable React components
- **`/src/lib`**: Utility functions and configurations
- **`/src/hooks`**: Custom React hooks
- **`/prisma`**: Database schema and migrations
- **`/docs`**: Project documentation

## 📝 Coding Standards

### TypeScript Guidelines

- **Strict mode**: Always use strict TypeScript
- **Type definitions**: Define types for all functions and variables
- **Interfaces**: Use interfaces for object shapes
- **Enums**: Use enums for constants
- **Generics**: Use generics for reusable components

```typescript
// ✅ Good
interface User {
  id: string;
  name: string;
  email: string;
}

function createUser(userData: Omit<User, 'id'>): User {
  return {
    id: generateId(),
    ...userData,
  };
}

// ❌ Bad
function createUser(userData: any): any {
  return userData;
}
```

### React Guidelines

- **Functional components**: Use functional components with hooks
- **Props interface**: Define interfaces for component props
- **Custom hooks**: Extract reusable logic into custom hooks
- **Error boundaries**: Use error boundaries for error handling

```typescript
// ✅ Good
interface ButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export function Button({ children, onClick, variant = 'primary' }: ButtonProps) {
  return (
    <button
      className={`btn btn-${variant}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
```

### Project-Specific Rules

#### GitHub Integration
- **Always use cached client**: Use `@/lib/integrations/github-cached`
- **Never use direct Octokit**: Avoid `@/lib/integrations/github` directly
- **Cache management**: Use `GitHubCacheManager` for cache operations

```typescript
// ✅ Good
import { fetchGithubActivity } from '@/lib/integrations/github-cached';

// ❌ Bad
import { fetchGithubActivity } from '@/lib/integrations/github';
```

#### Image Optimization
- **Use OptimizedImage**: Always use `OptimizedImage` component
- **Quality levels**: Use appropriate quality levels (hero, card, thumbnail, avatar)
- **Responsive images**: Provide width, height, and sizes props

```typescript
// ✅ Good
<OptimizedImage
  src="/path/to/image.jpg"
  alt="Description"
  width={800}
  height={600}
  quality="card"
  priority={false}
/>

// ❌ Bad
<img src="/path/to/image.jpg" alt="Description" />
```

### Code Style

- **ESLint**: Follow ESLint configuration
- **Prettier**: Use Prettier for code formatting
- **Naming**: Use descriptive names for variables and functions
- **Comments**: Add comments for complex logic
- **Imports**: Organize imports (external, internal, relative)

```typescript
// ✅ Good - Organized imports
import React from 'react';
import { NextPage } from 'next';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { User } from '@/types/user';
```

## 🔄 Git Workflow

### Branch Naming

- **Feature**: `feature/description` (e.g., `feature/github-integration`)
- **Bugfix**: `bugfix/description` (e.g., `bugfix/auth-redirect`)
- **Hotfix**: `hotfix/description` (e.g., `hotfix/security-patch`)
- **Refactor**: `refactor/description` (e.g., `refactor/api-structure`)

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
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

### Workflow Steps

1. **Create branch** from `main`
2. **Make changes** with descriptive commits
3. **Push branch** to your fork
4. **Create PR** using the template
5. **Address feedback** from reviewers
6. **Merge** after approval

## 🔍 Pull Request Process

### Before Creating a PR

- [ ] Code compiles without errors
- [ ] All tests pass
- [ ] Linting passes
- [ ] Formatting is correct
- [ ] Self-review completed
- [ ] Branch is up to date with main

### PR Requirements

- **Template**: Use the PR template completely
- **Description**: Clear description of changes
- **Issues**: Link related issues
- **Tests**: Include tests for new features
- **Documentation**: Update docs if needed

### Review Process

- **Reviewers**: Assign appropriate reviewers
- **Labels**: Add relevant labels
- **Milestone**: Set if part of larger initiative
- **Timeline**: Respond to feedback within 24 hours

## 🐛 Issue Guidelines

### Bug Reports

- **Template**: Use the bug report template
- **Reproduction**: Provide clear steps to reproduce
- **Environment**: Include environment details
- **Screenshots**: Add screenshots if helpful
- **Logs**: Include relevant error logs

### Feature Requests

- **Template**: Use the feature request template
- **Problem**: Clearly describe the problem
- **Solution**: Propose a solution
- **Impact**: Explain the impact
- **Mockups**: Include mockups if applicable

### Questions

- **Template**: Use the question template
- **Context**: Provide sufficient context
- **Research**: Show what you've already tried
- **Specific**: Ask specific questions

## 🧪 Testing Guidelines

### Test Types

- **Unit tests**: Test individual functions/components
- **Integration tests**: Test API endpoints and database operations
- **E2E tests**: Test critical user flows
- **Manual testing**: Test UI changes and complex interactions

### Test Requirements

- **New features**: Must include tests
- **Bug fixes**: Must include regression tests
- **Critical paths**: Always test authentication, data flow, and API endpoints
- **Coverage**: Aim for high test coverage

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
bun run test:watch

# Run tests with coverage
bun run test:coverage

# Run specific test file
npm test -- --testPathPattern=Button.test.tsx
```

## 📚 Documentation

### Code Documentation

- **JSDoc**: Use JSDoc for functions and classes
- **Comments**: Add comments for complex logic
- **README**: Update README for new features
- **API docs**: Document API endpoints

```typescript
/**
 * Fetches GitHub activity for a user with caching
 * @param userId - The user ID
 * @param options - Fetch options
 * @returns Promise<GitHubActivity[]>
 */
export async function fetchGithubActivity(
  userId: string,
  options?: FetchOptions
): Promise<GitHubActivity[]> {
  // Implementation
}
```

### Documentation Updates

- **New features**: Update relevant documentation
- **API changes**: Update API documentation
- **Configuration**: Update configuration guides
- **Deployment**: Update deployment instructions

## 🚀 Release Process

### Versioning

We use [Semantic Versioning](https://semver.org/):

- **Major**: Breaking changes
- **Minor**: New features (backward compatible)
- **Patch**: Bug fixes (backward compatible)

### Release Steps

1. **Update version** in `package.json`
2. **Update changelog** with new features/fixes
3. **Create release** on GitHub
4. **Deploy** to production
5. **Monitor** for issues

## 🤝 Getting Help

### Resources

- **Documentation**: Check `/docs` folder
- **Issues**: Search existing issues
- **Discussions**: Use GitHub Discussions
- **Code review**: Ask in PR comments

### Contact

- **Maintainers**: Tag @maintainers for urgent issues
- **Community**: Use GitHub Discussions for general questions
- **Security**: Email security@unifiedhq.com for security issues

## 🎉 Recognition

### Contributors

We recognize contributors in:
- **README**: List of contributors
- **Releases**: Mention in release notes
- **Community**: Highlight in discussions

### Types of Contributions

- **Code**: Bug fixes, features, refactoring
- **Documentation**: Guides, tutorials, examples
- **Testing**: Test cases, bug reports
- **Community**: Help, discussions, feedback

---

## 📋 Quick Start Checklist

### For New Contributors

- [ ] Read this contributing guide
- [ ] Set up development environment
- [ ] Find a good first issue
- [ ] Create a branch
- [ ] Make changes
- [ ] Write tests
- [ ] Create PR
- [ ] Address feedback
- [ ] Celebrate! 🎉

### For Maintainers

- [ ] Review PRs promptly
- [ ] Provide constructive feedback
- [ ] Help new contributors
- [ ] Maintain code quality
- [ ] Keep documentation updated

**Thank you for contributing to UnifiedHQ! 🚀**
