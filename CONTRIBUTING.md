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

- **Node.js**: Version 18.17.0 or higher (LTS recommended)
- **Bun**: Primary package manager (v1.0.0+) - [Install Bun](https://bun.sh/docs/installation)
- **Git**: Latest version with SSH keys configured
- **Database**: PostgreSQL 14+ (for local development)
- **Redis**: For caching (optional for local development, required for production features)
- **IDE**: VS Code with recommended extensions (see `.vscode/extensions.json`)

### Recommended Tools

- **Docker**: For consistent development environment
- **GitHub CLI**: For easier PR management (`gh` command)
- **Prisma Studio**: Database GUI (included with Prisma)
- **Postman/Insomnia**: For API testing

### First Time Setup

1. **Fork the repository**
   ```bash
   # Fork on GitHub, then clone your fork
   git clone https://github.com/your-username/unifiedhq.git
   cd unifiedhq
   ```

2. **Install dependencies**
   ```bash
   bun install
   # Alternative package managers (not recommended)
   # npm install
   # yarn install
   # pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

4. **Set up the database**
   ```bash
   # Generate Prisma client
   bun prisma generate
   
   # Push schema to database
   bun prisma db push
   
   # Seed database with sample data
   bun prisma db seed
   
   # Optional: Open Prisma Studio
   bun prisma studio
   ```

5. **Start the development server**
   ```bash
   bun dev
   ```
   
   The application will be available at `http://localhost:3000`

6. **Verify setup**
   ```bash
   # Check if all services are running
   bun run health-check
   
   # Run tests to ensure everything works
   bun test
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

# Slack Integration (optional)
SLACK_CLIENT_ID="your-slack-client-id"
SLACK_CLIENT_SECRET="your-slack-client-secret"
SLACK_BOT_TOKEN="xoxb-your-bot-token"

# Development flags
NODE_ENV="development"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### Available Scripts

```bash
# Development
bun dev              # Start development server
bun build            # Build for production
bun start            # Start production server
bun preview          # Preview production build locally

# Code Quality
bun lint             # Run ESLint
bun lint:fix         # Fix ESLint issues automatically
bun format           # Format code with Prettier
bun format:check     # Check code formatting
bun type-check       # Run TypeScript type checking

# Testing
bun test             # Run all tests
bun test:watch       # Run tests in watch mode
bun test:coverage    # Run tests with coverage report
bun test:e2e         # Run end-to-end tests

# Database
bun prisma generate  # Generate Prisma client
bun prisma db push   # Push schema changes
bun prisma db pull   # Pull schema from database
bun prisma studio    # Open Prisma Studio
bun prisma migrate   # Run database migrations

# Utilities
bun health-check     # Check system health
bun clean            # Clean build artifacts
bun deps:update      # Update dependencies
bun security:audit   # Run security audit
```

## 📁 Project Structure

```
├── .github/            # GitHub workflows and templates
├── .kiro/             # Kiro IDE configuration and steering
├── docs/              # Project documentation
├── prisma/            # Database schema and migrations
├── public/            # Static assets
├── scripts/           # Build and utility scripts
├── src/
│   ├── app/           # Next.js 15 app directory
│   │   ├── api/       # API routes (REST endpoints)
│   │   ├── auth/      # Authentication pages
│   │   ├── dashboard/ # Main dashboard pages
│   │   ├── integrations/ # Integration setup pages
│   │   ├── settings/  # User settings pages
│   │   └── globals.css # Global styles
│   ├── components/    # React components
│   │   ├── ui/        # shadcn/ui components (New York variant)
│   │   ├── forms/     # Form components
│   │   ├── charts/    # Chart and visualization components
│   │   └── ...        # Feature-specific components
│   ├── lib/           # Utility libraries
│   │   ├── integrations/ # Third-party API integrations
│   │   ├── auth.ts    # Better Auth configuration
│   │   ├── db.ts      # Database utilities
│   │   └── utils.ts   # General utilities
│   ├── hooks/         # Custom React hooks
│   ├── contexts/      # React contexts and providers
│   ├── types/         # TypeScript type definitions
│   ├── generated/     # Generated code (Prisma client)
│   └── middleware.ts  # Next.js middleware
├── .env.example       # Environment variables template
├── tailwind.config.ts # Tailwind CSS configuration
├── next.config.mjs    # Next.js configuration
└── package.json       # Dependencies and scripts
```

### Key Directories

- **`/src/app`**: Next.js 15 app router with file-based routing
- **`/src/components`**: Reusable React components with TypeScript
- **`/src/lib`**: Utility functions, configurations, and integrations
- **`/src/hooks`**: Custom React hooks for shared logic
- **`/src/contexts`**: React Context providers for global state
- **`/src/types`**: TypeScript type definitions and interfaces
- **`/prisma`**: Database schema, migrations, and seed data
- **`/docs`**: Comprehensive project documentation
- **`/.kiro`**: Kiro IDE steering rules and configuration
- **`/scripts`**: Automation scripts for development and deployment

### Architecture Patterns

- **App Router**: Next.js 15 with React Server Components
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Better Auth with OAuth 2.0
- **Styling**: Tailwind CSS 4.1 with shadcn/ui components
- **State Management**: React Context + Custom hooks
- **API Design**: RESTful endpoints with TypeScript validation

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

#### Integration Guidelines

**GitHub Integration**
- **Always use cached client**: Use `@/lib/integrations/github-cached`
- **Never use direct Octokit**: Avoid `@/lib/integrations/github` directly
- **Cache management**: Use `GitHubCacheManager` for cache operations
- **Rate limiting**: Respect GitHub API rate limits with exponential backoff

```typescript
// ✅ Good
import { fetchGithubActivity } from '@/lib/integrations/github-cached';

// ❌ Bad
import { fetchGithubActivity } from '@/lib/integrations/github';
```

**Slack Integration**
- **Use Bot API**: Prefer Bot API over Web API when possible
- **Channel permissions**: Always check channel permissions before operations
- **Message formatting**: Use Slack's Block Kit for rich messages

**AI Integration**
- **Data privacy**: Never send sensitive user data to AI services
- **Rate limiting**: Implement proper rate limiting for AI API calls
- **Error handling**: Gracefully handle AI service failures

#### Performance Guidelines

**Image Optimization**
- **Use Next.js Image**: Always use `next/image` component
- **Quality levels**: Use appropriate quality levels (hero: 90, card: 80, thumbnail: 70, avatar: 60)
- **Responsive images**: Provide width, height, and sizes props
- **Format optimization**: Prefer WebP/AVIF formats with fallbacks

```typescript
// ✅ Good
import Image from 'next/image';

<Image
  src="/path/to/image.jpg"
  alt="Description"
  width={800}
  height={600}
  quality={80}
  priority={false}
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
/>

// ❌ Bad
<img src="/path/to/image.jpg" alt="Description" />
```

**Memory Management**
- **Use memory leak prevention**: Import and use `useMemoryLeakPrevention` hook
- **Clean up subscriptions**: Always clean up event listeners and subscriptions
- **Optimize re-renders**: Use `useMemo` and `useCallback` appropriately

```typescript
// ✅ Good
import { useMemoryLeakPrevention } from '@/lib/memory-leak-prevention';

export function MyComponent() {
  useMemoryLeakPrevention('MyComponent');
  
  useEffect(() => {
    const handler = () => {};
    window.addEventListener('resize', handler);
    
    return () => {
      window.removeEventListener('resize', handler);
    };
  }, []);
}
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

- **Unit tests**: Test individual functions/components using Jest and React Testing Library
- **Integration tests**: Test API endpoints and database operations with test database
- **E2E tests**: Test critical user flows using Playwright
- **Component tests**: Test React components in isolation
- **API tests**: Test REST endpoints with proper mocking
- **Performance tests**: Test for memory leaks and performance regressions

### Test Requirements

- **New features**: Must include comprehensive tests (unit + integration)
- **Bug fixes**: Must include regression tests to prevent reoccurrence
- **Critical paths**: Always test authentication, data flow, API endpoints, and integrations
- **Coverage**: Maintain >80% test coverage for new code
- **Performance**: Include performance tests for data-heavy operations
- **Accessibility**: Test components for accessibility compliance

### Testing Best Practices

- **Test behavior, not implementation**: Focus on what the code does, not how
- **Use descriptive test names**: Tests should read like specifications
- **Mock external dependencies**: Use proper mocking for APIs and services
- **Test error scenarios**: Include tests for error handling and edge cases
- **Keep tests isolated**: Each test should be independent and repeatable

### Running Tests

```bash
# Run all tests
bun test

# Run tests in watch mode
bun test:watch

# Run tests with coverage
bun test:coverage

# Run E2E tests
bun test:e2e

# Run specific test file
bun test Button.test.tsx

# Run tests for specific component
bun test --testPathPattern=components/ui

# Run tests with debugging
bun test --verbose --no-coverage

# Performance and memory leak tests
bun test:performance
bun test:memory-leaks
```

### Test File Structure

```
src/
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   └── __tests__/
│   │       └── Button.test.tsx
├── lib/
│   ├── utils.ts
│   └── __tests__/
│       └── utils.test.ts
└── app/
    └── api/
        ├── auth/
        │   ├── route.ts
        │   └── route.test.ts
```

## �  Debugging & Troubleshooting

### Common Issues

**Database Connection Issues**
```bash
# Reset database
bun prisma db push --force-reset
bun prisma db seed

# Check database connection
bun prisma db pull
```

**Authentication Issues**
```bash
# Clear auth cache
rm -rf .next/cache
bun dev

# Check auth configuration
bun run debug:auth
```

**Build Issues**
```bash
# Clean build cache
bun clean
rm -rf .next node_modules/.cache

# Reinstall dependencies
rm -rf node_modules bun.lockb
bun install
```

**Integration Issues**
```bash
# Test GitHub integration
bun run debug:github

# Test Slack integration  
bun run debug:slack

# Check API health
curl http://localhost:3000/api/health
```

### Debug Tools

- **Next.js DevTools**: Built-in debugging for React components
- **Prisma Studio**: Visual database editor (`bun prisma studio`)
- **Network Tab**: Monitor API calls and responses
- **React DevTools**: Browser extension for React debugging
- **Sentry**: Error tracking and performance monitoring

### Logging

```typescript
// Use structured logging
import { logger } from '@/lib/logger';

logger.info('User action', { userId, action: 'login' });
logger.error('API error', { error, endpoint: '/api/users' });
logger.debug('Debug info', { data });
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

## � SecurityP Guidelines

### Security Best Practices

**Input Validation**
- Always validate and sanitize user inputs
- Use Zod schemas for API endpoint validation
- Implement proper SQL injection prevention
- Sanitize data before displaying in UI

```typescript
// ✅ Good
import { z } from 'zod';

const userSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
});

export async function POST(request: Request) {
  const body = await request.json();
  const validatedData = userSchema.parse(body);
  // Use validatedData safely
}
```

**Authentication & Authorization**
- Never store sensitive data in localStorage
- Use secure HTTP-only cookies for sessions
- Implement proper RBAC (Role-Based Access Control)
- Always verify user permissions before operations

**API Security**
- Implement rate limiting on all endpoints
- Use CORS properly for cross-origin requests
- Never expose internal error details to clients
- Log security events for monitoring

**Data Protection**
- Encrypt sensitive data at rest
- Use HTTPS for all communications
- Implement proper session management
- Follow GDPR guidelines for user data

### Security Checklist

Before submitting a PR with security implications:

- [ ] Input validation implemented
- [ ] Authentication checks in place
- [ ] Authorization verified
- [ ] No sensitive data in logs
- [ ] Rate limiting considered
- [ ] Error handling doesn't leak information
- [ ] Dependencies are up to date
- [ ] Security tests included

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

## ⚡ Performance Guidelines

### Performance Best Practices

**React Performance**
- Use `React.memo` for expensive components
- Implement proper `useMemo` and `useCallback` usage
- Avoid unnecessary re-renders with proper dependency arrays
- Use React Suspense for code splitting

```typescript
// ✅ Good
const ExpensiveComponent = React.memo(({ data }: Props) => {
  const processedData = useMemo(() => {
    return expensiveCalculation(data);
  }, [data]);

  return <div>{processedData}</div>;
});
```

**Database Performance**
- Use database indexes for frequently queried fields
- Implement proper pagination for large datasets
- Use database transactions for related operations
- Monitor query performance with Prisma metrics

**API Performance**
- Implement caching strategies (Redis, in-memory)
- Use proper HTTP caching headers
- Implement request batching where appropriate
- Monitor API response times

**Bundle Performance**
- Use dynamic imports for code splitting
- Optimize images and assets
- Minimize bundle size with tree shaking
- Use CDN for static assets

### Performance Monitoring

```typescript
// Monitor component performance
import { usePerformanceMonitor } from '@/hooks/use-performance-monitor';

export function MyComponent() {
  const { measureRender } = usePerformanceMonitor('MyComponent');
  
  useEffect(() => {
    const startTime = performance.now();
    // Expensive operation
    measureRender(performance.now() - startTime);
  }, []);
}
```

### Performance Checklist

- [ ] Components are properly memoized
- [ ] Database queries are optimized
- [ ] Images are optimized and properly sized
- [ ] Bundle size is within acceptable limits
- [ ] API responses are cached appropriately
- [ ] Memory leaks are prevented
- [ ] Performance metrics are monitored

## 🤝 Getting Help

### Resources

- **Documentation**: Check `/docs` folder
- **Issues**: Search existing issues
- **Discussions**: Use GitHub Discussions
- **Code review**: Ask in PR comments

### Contact & Support

**For Contributors:**
- **General Questions**: Use GitHub Discussions
- **Bug Reports**: Create an issue with the bug template
- **Feature Requests**: Create an issue with the feature template
- **Code Review**: Comment on PRs or tag reviewers

**For Maintainers:**
- **Urgent Issues**: Tag @maintainers in issues
- **Security Issues**: Email security@unifiedhq.com
- **Infrastructure**: Tag @infrastructure-team
- **Releases**: Tag @release-team

**Community Channels:**
- **Discord**: [Join our Discord](https://discord.gg/unifiedhq) (coming soon)
- **Twitter**: [@UnifiedHQ](https://twitter.com/unifiedhq) for updates
- **Blog**: [blog.unifiedhq.com](https://blog.unifiedhq.com) for announcements

**Response Times:**
- **Critical bugs**: 24 hours
- **General issues**: 72 hours
- **Feature requests**: 1 week
- **Documentation**: 48 hours

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

**Setup Phase:**
- [ ] Read this contributing guide completely
- [ ] Set up development environment with all prerequisites
- [ ] Install recommended VS Code extensions
- [ ] Configure Git with SSH keys
- [ ] Join community channels (Discord, GitHub Discussions)

**First Contribution:**
- [ ] Find a good first issue (labeled `good-first-issue`)
- [ ] Comment on the issue to claim it
- [ ] Create a feature branch with proper naming
- [ ] Make changes following coding standards
- [ ] Write comprehensive tests
- [ ] Update documentation if needed
- [ ] Run all checks locally (`bun lint`, `bun test`, `bun type-check`)
- [ ] Create PR using the template
- [ ] Address reviewer feedback promptly
- [ ] Celebrate your contribution! 🎉

**Ongoing Contributions:**
- [ ] Stay updated with project changes
- [ ] Participate in discussions and code reviews
- [ ] Help other contributors
- [ ] Suggest improvements and new features

### For Maintainers

**Daily Tasks:**
- [ ] Review PRs within 24-48 hours
- [ ] Provide constructive and helpful feedback
- [ ] Help new contributors get started
- [ ] Monitor issue queue and triage new issues
- [ ] Respond to community questions

**Weekly Tasks:**
- [ ] Update dependencies and security patches
- [ ] Review and update documentation
- [ ] Plan upcoming features and releases
- [ ] Monitor performance and error metrics
- [ ] Conduct code quality reviews

**Monthly Tasks:**
- [ ] Review and update contributing guidelines
- [ ] Analyze contributor feedback and improve processes
- [ ] Plan community events and initiatives
- [ ] Review security and performance metrics
- [ ] Update project roadmap

**Thank you for contributing to UnifiedHQ! 🚀**
