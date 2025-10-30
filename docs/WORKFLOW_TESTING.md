# Workflow Testing Utilities

This document describes the comprehensive workflow testing utilities available for validating GitHub Actions workflows in the UnifiedHQ project.

## Overview

The workflow testing suite provides multiple layers of validation to ensure that all GitHub workflows meet the project requirements, follow best practices, and function correctly both locally and in the GitHub Actions environment.

## Testing Components

### 1. Workflow Test Runner (`workflow-test-runner.js`)

The main testing orchestrator that runs all validation steps in sequence.

**Features:**
- Comprehensive test suite execution
- Unified reporting across all test types
- Integration with all validation utilities
- Detailed pass/fail reporting with recommendations

**Usage:**
```bash
# Run complete test suite
bun run workflow:test-comprehensive

# Run specific test types
node scripts/workflow-test-runner.js syntax
node scripts/workflow-test-runner.js requirements
node scripts/workflow-test-runner.js local

# Setup testing environment
bun run workflow:test-setup
```

### 2. Requirements Validator (`workflow-requirements-validator.js`)

Validates workflows against all acceptance criteria defined in the requirements document.

**Features:**
- Validates all 6 requirements with 30+ acceptance criteria
- Checks for CI/CD pipeline compliance
- Security scanning validation
- Release management verification
- Dependency management checks
- Performance monitoring validation
- Code quality enforcement verification

**Usage:**
```bash
# Validate all requirements
bun run workflow:test-requirements

# Validate specific requirement
node scripts/workflow-requirements-validator.js requirement requirement1

# Save validation report
bun run workflow:validate-requirements
```

### 3. Workflow Validator (`workflow-validate.js`)

Performs syntax, security, performance, and best practices validation.

**Features:**
- YAML syntax validation
- Security vulnerability detection
- Performance optimization checks
- Best practices compliance
- Action version validation
- Dependency analysis

**Usage:**
```bash
# Validate all workflows
bun run workflow:validate-all

# Validate specific workflow
node scripts/workflow-validate.js validate ci.yml

# Generate comprehensive report
node scripts/workflow-validate.js report --save
```

### 4. Local Workflow Tester (`workflow-test.js`)

Tests workflows locally using the `act` tool for GitHub Actions simulation.

**Features:**
- Local workflow execution with act
- Dry-run testing capabilities
- Workflow listing and inspection
- Act configuration management
- Cross-platform testing support

**Usage:**
```bash
# List available workflows
node scripts/workflow-test.js list

# Test specific workflow locally
node scripts/workflow-test.js test ci.yml --dry-run

# Setup act configuration
node scripts/workflow-test.js setup
```

## Requirements Coverage

The testing suite validates compliance with all project requirements:

### Requirement 1: Automated CI/CD Pipelines
- ✅ PR creation triggers quality checks
- ✅ Main branch push triggers staging deployment
- ✅ Quality gates block merge until passing
- ✅ Production deployment requires manual approval
- ✅ CI pipeline provides clear status feedback

### Requirement 2: Automated Security Scanning
- ✅ Code push triggers security scanning
- ✅ Dependency updates trigger vulnerability checks
- ✅ Security vulnerabilities block merge
- ✅ Security reports generated
- ✅ Critical issues trigger notifications

### Requirement 3: Automated Release Management
- ✅ Release tags trigger automated release notes
- ✅ Release artifacts built and published
- ✅ Release creation triggers production deployment
- ✅ Semantic versioning based on commits
- ✅ Failed deployments trigger rollback

### Requirement 4: Automated Dependency Management
- ✅ Weekly dependency update checks
- ✅ Dependency updates create pull requests
- ✅ Security checks on dependency updates
- ✅ Clear failure reports for breaking updates
- ✅ Auto-merge non-breaking updates

### Requirement 5: Automated Performance Monitoring
- ✅ PR creation triggers performance benchmarks
- ✅ Performance degradation blocks merge
- ✅ Performance metrics tracked over time
- ✅ Performance improvements highlighted
- ✅ Performance reports for deployments

### Requirement 6: Automated Code Quality Enforcement
- ✅ Code formatting enforced with Prettier
- ✅ Code quality rules enforced with ESLint
- ✅ TypeScript strict mode compliance
- ✅ Quality failures provide detailed feedback
- ✅ All tests must pass before merge

## Installation and Setup

### Prerequisites

1. **Node.js and Bun**: Ensure you have Node.js and Bun installed
2. **act tool** (optional for local testing):
   ```bash
   # Install act for local workflow testing
   curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash
   ```

### Setup Process

1. **Initialize testing environment:**
   ```bash
   bun run workflow:test-setup
   ```

2. **Verify installation:**
   ```bash
   bun run workflow:test-syntax
   ```

3. **Run comprehensive tests:**
   ```bash
   bun run workflow:test-comprehensive
   ```

## Testing Workflow

### Daily Development
```bash
# Quick syntax check
bun run workflow:test-syntax

# Validate specific workflow after changes
node scripts/workflow-validate.js validate ci.yml
```

### Pre-commit Validation
```bash
# Run requirements validation
bun run workflow:test-requirements

# Run comprehensive test suite
bun run workflow:test-comprehensive
```

### Release Preparation
```bash
# Full validation with local testing
bun run workflow:test-comprehensive

# Generate detailed reports
node scripts/workflow-validate.js report --save
node scripts/workflow-requirements-validator.js validate --save
```

## Configuration Files

### `.actrc`
Configuration file for the act tool:
```
--platform ubuntu-latest=catthehacker/ubuntu:act-latest
--env-file .env.local
--artifact-server-path /tmp/artifacts
--reuse
```

### Environment Variables
Create `.env.local` for local testing:
```
GITHUB_TOKEN=your_github_token
NODE_ENV=test
```

## Reports and Output

### Report Locations
- `reports/workflow-validation-report.json` - Syntax and best practices validation
- `reports/requirements-validation-report.json` - Requirements compliance report
- `reports/comprehensive-workflow-test-report.json` - Complete test suite results

### Report Structure
```json
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "summary": {
    "totalTests": 4,
    "passedTests": 4,
    "overallSuccess": true,
    "passRate": 100
  },
  "results": {
    "syntaxValidation": { ... },
    "requirementsValidation": { ... },
    "configurationTests": { ... },
    "localTests": { ... }
  },
  "recommendations": []
}
```

## Troubleshooting

### Common Issues

1. **act tool not found**
   ```bash
   # Install act tool
   curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash
   ```

2. **Docker not running (for act)**
   ```bash
   # Start Docker service
   sudo systemctl start docker
   ```

3. **Permission errors**
   ```bash
   # Fix script permissions
   chmod +x scripts/workflow-*.js
   ```

4. **Missing dependencies**
   ```bash
   # Install all dependencies
   bun install
   ```

### Debug Mode

Enable verbose output for debugging:
```bash
# Verbose workflow testing
node scripts/workflow-test.js test ci.yml --verbose

# Debug requirements validation
node scripts/workflow-requirements-validator.js validate --json | jq '.'
```

## Integration with CI/CD

### GitHub Actions Integration
Add workflow testing to your CI pipeline:

```yaml
name: Workflow Validation
on: [push, pull_request]

jobs:
  validate-workflows:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run workflow:test-comprehensive --skip-local
```

### Pre-commit Hooks
Add to `.pre-commit-config.yaml`:
```yaml
repos:
  - repo: local
    hooks:
      - id: workflow-validation
        name: Validate GitHub Workflows
        entry: bun run workflow:test-syntax
        language: system
        files: '^\.github/workflows/.*\.ya?ml$'
```

## Best Practices

1. **Regular Testing**: Run workflow tests before committing changes
2. **Incremental Validation**: Test individual workflows during development
3. **Comprehensive Testing**: Run full test suite before releases
4. **Monitor Reports**: Review generated reports for optimization opportunities
5. **Keep Updated**: Regularly update testing utilities and dependencies

## Contributing

When adding new workflows or modifying existing ones:

1. Run syntax validation first
2. Ensure requirements compliance
3. Test locally with act (if possible)
4. Update documentation if needed
5. Run comprehensive test suite before PR

## Support

For issues with workflow testing utilities:

1. Check the troubleshooting section
2. Review generated reports for specific errors
3. Consult individual tool documentation
4. Create an issue with detailed error information