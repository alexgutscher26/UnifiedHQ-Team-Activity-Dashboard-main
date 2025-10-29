# GitHub Workflow Testing Guide

This guide covers how to test and validate GitHub workflows locally and in CI/CD environments.

## Overview

The workflow testing utilities provide comprehensive tools for:
- **Local Testing**: Run workflows locally using the `act` tool
- **Validation**: Check workflow syntax, security, and best practices
- **Performance Analysis**: Identify optimization opportunities
- **Dependency Management**: Track and validate action dependencies

## Prerequisites

### Required Tools

1. **Node.js & Bun**: For running the testing scripts
2. **act**: For local workflow execution
3. **Docker**: Required by act for running workflows

### Installing act

```bash
# macOS (using Homebrew)
brew install act

# Linux/macOS (using curl)
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Windows (using Chocolatey)
choco install act-cli

# Or download from: https://github.com/nektos/act/releases
```

### Setup

1. **Configure act**:
   ```bash
   # Copy the example environment file
   cp .env.local.example .env.local
   
   # Edit .env.local with your test values
   nano .env.local
   
   # Setup act configuration (already provided in .actrc)
   bun run workflow:test setup
   ```

2. **Install dependencies**:
   ```bash
   bun install
   ```

## Usage

### Performance Optimization

```bash
# Analyze workflow performance
bun run workflow:analyze

# Analyze specific workflow
bun run workflow:analyze ci.yml

# Optimize all workflows
bun run workflow:optimize-all

# Optimize specific workflow
bun run workflow:optimize ci.yml

# Apply specific optimizations
node scripts/workflow-optimize.js optimize ci.yml --types conditionalExecution,improvedCaching
```

### Listing Workflows

```bash
# List all available workflows
bun run workflow:test list

# Or use the script directly
node scripts/workflow-test.js list
```

### Validating Workflows

```bash
# Validate all workflows
bun run workflow:validate --all

# Validate specific workflow
bun run workflow:validate ci.yml

# Validate with specific categories
bun run workflow:validate --all --categories syntax,security

# Generate validation report
bun run workflow:validate report --output validation-report.json
```

### Testing Workflows Locally

```bash
# Test a workflow with default event (push)
bun run workflow:test ci.yml

# Test with specific event
bun run workflow:test ci.yml --event pull_request

# Dry run (validation only)
bun run workflow:test ci.yml --dry-run

# Verbose output for debugging
bun run workflow:test ci.yml --verbose

# Test with specific platform
bun run workflow:test ci.yml --platform ubuntu-20.04
```

### Generating Reports

```bash
# Generate comprehensive test report
bun run workflow:test report

# Generate JSON report
bun run workflow:test report --json

# Generate validation report
bun run workflow:validate report --output reports/validation.json
```

## Validation Categories

### Syntax Validation
- Required fields (name, on, jobs)
- Job structure validation
- Step configuration checks
- YAML syntax validation

### Security Validation
- Hardcoded secret detection
- Dangerous command patterns
- Proper secret usage
- Action security best practices

### Performance Validation
- Caching strategy analysis
- Concurrency control checks
- Matrix optimization suggestions
- Resource usage optimization

### Best Practices
- Action version pinning
- Step naming conventions
- Error handling patterns
- Documentation completeness

## Common Workflow Issues

### 1. Missing Cache Configuration

**Issue**: Workflows run slowly due to repeated dependency installation

**Solution**:
```yaml
- name: Cache dependencies
  uses: actions/cache@v4
  with:
    path: |
      node_modules
      ~/.bun/install/cache
    key: ${{ runner.os }}-bun-${{ hashFiles('**/bun.lockb') }}
```

### 2. No Concurrency Control

**Issue**: Multiple workflow runs for the same PR/branch

**Solution**:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

### 3. Hardcoded Secrets

**Issue**: Secrets exposed in workflow files

**Solution**:
```yaml
# ❌ Bad
env:
  API_KEY: "sk-1234567890abcdef"

# ✅ Good
env:
  API_KEY: ${{ secrets.API_KEY }}
```

### 4. Unpinned Action Versions

**Issue**: Using `@latest` or `@main` for actions

**Solution**:
```yaml
# ❌ Bad
- uses: actions/checkout@latest

# ✅ Good
- uses: actions/checkout@v4
```

## Local Testing Limitations

When testing workflows locally with act, be aware of:

1. **Limited GitHub Context**: Some GitHub-specific features may not work
2. **Docker Requirements**: All jobs run in Docker containers
3. **Secret Management**: Use `.env.local` for test secrets
4. **Network Access**: Limited external network access in containers
5. **Action Compatibility**: Some actions may not work in act environment

## Troubleshooting

### act Installation Issues

```bash
# Check act installation
act --version

# Test with simple workflow
act -l

# Debug with verbose output
act --verbose
```

### Docker Issues

```bash
# Check Docker installation
docker --version

# Pull required images
docker pull catthehacker/ubuntu:act-latest

# Clean up Docker resources
docker system prune
```

### Workflow Validation Errors

```bash
# Check YAML syntax
bun run workflow:validate ci.yml --categories syntax

# View detailed error information
bun run workflow:validate ci.yml --json
```

## Integration with CI/CD

### Pre-commit Hooks

Add workflow validation to pre-commit hooks:

```bash
# .git/hooks/pre-commit
#!/bin/bash
bun run workflow:validate --all
if [ $? -ne 0 ]; then
  echo "❌ Workflow validation failed"
  exit 1
fi
```

### GitHub Actions Integration

```yaml
# .github/workflows/workflow-validation.yml
name: Workflow Validation

on:
  pull_request:
    paths:
      - '.github/workflows/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun run workflow:validate --all
```

## Best Practices

1. **Regular Validation**: Run validation before committing workflow changes
2. **Local Testing**: Test critical workflows locally before pushing
3. **Documentation**: Keep workflow documentation up to date
4. **Security Review**: Regularly audit workflows for security issues
5. **Performance Monitoring**: Monitor workflow execution times and optimize
6. **Version Pinning**: Pin action versions for reproducibility
7. **Error Handling**: Implement proper error handling and notifications

## Advanced Usage

### Custom Validation Rules

Extend the validation system by modifying `scripts/workflow-validate.js`:

```javascript
// Add custom validation rule
this.validationRules.custom = [
  {
    name: 'Custom Rule',
    check: (workflow) => {
      // Your validation logic here
      return { issues: [], warnings: [] };
    }
  }
];
```

### Automated Testing

Set up automated workflow testing in your CI pipeline:

```yaml
- name: Test Workflows
  run: |
    for workflow in .github/workflows/*.yml; do
      echo "Testing $workflow"
      bun run workflow:test "$(basename "$workflow")" --dry-run
    done
```

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [act Documentation](https://github.com/nektos/act)
- [Workflow Syntax Reference](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [Security Best Practices](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)