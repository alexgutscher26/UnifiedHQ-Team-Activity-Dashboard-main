# GitHub Workflow Performance Optimization Guide

This guide covers strategies and tools for optimizing GitHub workflow performance, reducing execution time, and improving resource efficiency.

## Overview

Workflow performance optimization focuses on:
- **Conditional Execution**: Run jobs only when necessary
- **Improved Caching**: Reduce redundant work across runs
- **Parallel Job Execution**: Maximize concurrency
- **Resource Optimization**: Efficient use of GitHub Actions resources
- **Matrix Optimization**: Optimize test matrices for speed and coverage

## Performance Optimization Strategies

### 1. Conditional Job Execution

#### Path-Based Filtering

Add path filters to workflow triggers to run only when relevant files change:

```yaml
on:
  push:
    branches: [main, develop]
    paths:
      - 'src/**'
      - 'package.json'
      - 'bun.lockb'
  pull_request:
    branches: [main, develop]
    paths:
      - 'src/**'
      - 'package.json'
      - 'bun.lockb'
```

#### Job-Level Conditionals

Add conditions to individual jobs:

```yaml
jobs:
  test:
    if: contains(github.event.head_commit.modified, 'src/') || contains(github.event.head_commit.modified, 'package.json')
    runs-on: ubuntu-latest
    steps:
      # ... test steps
```

#### Advanced Conditionals

Use GitHub's built-in functions for more complex conditions:

```yaml
jobs:
  security-scan:
    if: |
      github.event_name == 'push' ||
      (github.event_name == 'pull_request' && 
       (contains(github.event.pull_request.changed_files, 'src/') ||
        contains(github.event.pull_request.changed_files, 'package.json')))
```

### 2. Improved Caching Strategies

#### Multi-Level Dependency Caching

```yaml
- name: Cache dependencies
  uses: actions/cache@v4
  with:
    path: |
      node_modules
      ~/.bun/install/cache
    key: ${{ runner.os }}-bun-${{ hashFiles('**/bun.lockb', '**/package.json') }}
    restore-keys: |
      ${{ runner.os }}-bun-${{ hashFiles('**/bun.lockb') }}-
      ${{ runner.os }}-bun-
```

#### Build Artifact Caching

```yaml
- name: Cache Next.js build
  uses: actions/cache@v4
  with:
    path: |
      .next/cache
    key: ${{ runner.os }}-nextjs-${{ hashFiles('**/bun.lockb') }}-${{ hashFiles('**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx') }}
    restore-keys: |
      ${{ runner.os }}-nextjs-${{ hashFiles('**/bun.lockb') }}-
      ${{ runner.os }}-nextjs-
```

#### TypeScript Build Caching

```yaml
- name: Cache TypeScript build
  uses: actions/cache@v4
  with:
    path: |
      **/.tsbuildinfo
    key: ${{ runner.os }}-typescript-${{ hashFiles('**/tsconfig.json', '**/*.ts', '**/*.tsx') }}
    restore-keys: |
      ${{ runner.os }}-typescript-
```

### 3. Concurrency Control

Prevent duplicate workflow runs and resource waste:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

For different concurrency strategies:

```yaml
# Per workflow and branch
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

# Per workflow globally (for deployment workflows)
concurrency:
  group: ${{ github.workflow }}
  cancel-in-progress: false

# Per PR (for PR-specific workflows)
concurrency:
  group: pr-${{ github.event.number }}
  cancel-in-progress: true
```

### 4. Parallel Job Optimization

#### Independent Job Execution

Structure jobs to run in parallel when possible:

```yaml
jobs:
  # These jobs can run in parallel
  lint:
    runs-on: ubuntu-latest
    # ... lint steps
  
  test:
    runs-on: ubuntu-latest
    # ... test steps
  
  security-scan:
    runs-on: ubuntu-latest
    # ... security steps
  
  # This job depends on the above
  build:
    needs: [lint, test, security-scan]
    runs-on: ubuntu-latest
    # ... build steps
```

#### Matrix Strategy Optimization

Optimize matrix configurations for speed:

```yaml
strategy:
  fail-fast: false  # See all results
  max-parallel: 4   # Limit concurrent jobs
  matrix:
    node-version: [18.x, 20.x]  # Only LTS versions
    os: [ubuntu-latest]         # Single OS for speed
```

### 5. Resource Optimization

#### Efficient Runner Selection

Choose appropriate runners for different job types:

```yaml
jobs:
  # Lightweight jobs
  lint:
    runs-on: ubuntu-latest
  
  # CPU-intensive jobs
  build:
    runs-on: ubuntu-latest
  
  # Memory-intensive jobs (if needed)
  performance-test:
    runs-on: ubuntu-latest
```

#### Job Timeout Configuration

Set appropriate timeouts to prevent hanging jobs:

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 15  # Prevent hanging tests
    steps:
      # ... test steps
```

## Using the Optimization Tools

### Analyzing Workflow Performance

```bash
# Analyze single workflow
bun run workflow:analyze ci.yml

# Analyze all workflows
bun run workflow:analyze

# Generate detailed report
node scripts/workflow-optimize.js report --output optimization-report.json
```

### Applying Optimizations

```bash
# Optimize single workflow
bun run workflow:optimize ci.yml

# Optimize all workflows
bun run workflow:optimize-all

# Apply specific optimizations
node scripts/workflow-optimize.js optimize ci.yml --types conditionalExecution,improvedCaching
```

### Available Optimization Types

1. **conditionalExecution**: Add path-based and conditional job execution
2. **improvedCaching**: Optimize caching strategies for dependencies and builds
3. **parallelJobs**: Optimize job dependencies for maximum parallelization
4. **concurrencyControl**: Add concurrency control to prevent duplicate runs
5. **matrixOptimization**: Optimize matrix strategies for better resource usage

## Performance Monitoring

### Workflow Metrics to Track

1. **Execution Time**: Total workflow duration
2. **Job Duration**: Individual job execution times
3. **Queue Time**: Time waiting for available runners
4. **Cache Hit Rate**: Percentage of successful cache restores
5. **Resource Usage**: CPU and memory consumption
6. **Success Rate**: Percentage of successful workflow runs

### Setting Up Performance Monitoring

```yaml
# Add to workflow for performance tracking
- name: Track performance
  run: |
    echo "workflow-start-time=$(date +%s)" >> $GITHUB_ENV
    
# At the end of workflow
- name: Report performance
  if: always()
  run: |
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - workflow-start-time))
    echo "Workflow duration: ${DURATION}s"
    
    # Send to monitoring system
    curl -X POST "${{ secrets.MONITORING_WEBHOOK }}" \
      -H "Content-Type: application/json" \
      -d "{\"workflow\": \"${{ github.workflow }}\", \"duration\": $DURATION, \"status\": \"${{ job.status }}\"}"
```

## Best Practices

### 1. Cache Strategy Best Practices

- **Layer caches**: Use multiple cache levels (dependencies, builds, etc.)
- **Appropriate keys**: Include relevant file hashes in cache keys
- **Fallback keys**: Provide restore-keys for partial cache hits
- **Cache size limits**: Be mindful of GitHub's cache size limits (10GB per repository)

### 2. Job Organization Best Practices

- **Minimize dependencies**: Reduce job interdependencies where possible
- **Fail fast**: Use `fail-fast: true` for critical path jobs
- **Timeout appropriately**: Set reasonable timeouts for all jobs
- **Resource allocation**: Match runner resources to job requirements

### 3. Matrix Strategy Best Practices

- **Limit combinations**: Avoid excessive matrix combinations
- **Prioritize coverage**: Focus on important version/OS combinations
- **Use includes/excludes**: Fine-tune matrix combinations
- **Parallel limits**: Set `max-parallel` for large matrices

### 4. Conditional Execution Best Practices

- **Path filtering**: Use path filters at the workflow level when possible
- **Job conditions**: Add job-level conditions for fine-grained control
- **Event-based logic**: Use different logic for different GitHub events
- **Documentation**: Document conditional logic clearly

## Common Performance Issues

### 1. Slow Dependency Installation

**Problem**: Repeated dependency installation in every job

**Solution**:
```yaml
- name: Cache dependencies
  uses: actions/cache@v4
  with:
    path: |
      node_modules
      ~/.bun/install/cache
    key: ${{ runner.os }}-deps-${{ hashFiles('**/bun.lockb') }}
```

### 2. Redundant Job Execution

**Problem**: Jobs running when no relevant files changed

**Solution**:
```yaml
on:
  push:
    paths:
      - 'src/**'
      - 'package.json'
```

### 3. Sequential Job Execution

**Problem**: Jobs running sequentially when they could be parallel

**Solution**:
```yaml
jobs:
  job1:
    # No needs dependency
  job2:
    # No needs dependency
  job3:
    needs: [job1, job2]  # Only depends on completion of both
```

### 4. Large Matrix Combinations

**Problem**: Excessive matrix combinations consuming resources

**Solution**:
```yaml
strategy:
  matrix:
    node-version: [18.x, 20.x]  # Reduced from many versions
    # Remove unnecessary OS combinations
  max-parallel: 2  # Limit concurrent jobs
```

### 5. Missing Concurrency Control

**Problem**: Multiple workflow runs for the same PR/branch

**Solution**:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

## Advanced Optimization Techniques

### 1. Dynamic Job Generation

Use matrix strategies to dynamically generate jobs:

```yaml
jobs:
  generate-matrix:
    runs-on: ubuntu-latest
    outputs:
      matrix: ${{ steps.set-matrix.outputs.matrix }}
    steps:
      - id: set-matrix
        run: |
          # Generate matrix based on changed files
          echo "matrix={\"include\":[{\"path\":\"src/\",\"test\":\"unit\"},{\"path\":\"api/\",\"test\":\"integration\"}]}" >> $GITHUB_OUTPUT
  
  test:
    needs: generate-matrix
    strategy:
      matrix: ${{ fromJson(needs.generate-matrix.outputs.matrix) }}
    runs-on: ubuntu-latest
    steps:
      - run: echo "Testing ${{ matrix.path }} with ${{ matrix.test }}"
```

### 2. Conditional Matrix Expansion

Expand matrix based on conditions:

```yaml
strategy:
  matrix:
    node-version: [20.x]
    include:
      # Only test multiple versions on main branch
      - ${{ github.ref == 'refs/heads/main' && fromJson('{"node-version": "18.x"}') || fromJson('{}') }}
```

### 3. Workflow Composition

Break large workflows into smaller, reusable workflows:

```yaml
# .github/workflows/ci.yml
jobs:
  test:
    uses: ./.github/workflows/test.yml
  
  build:
    uses: ./.github/workflows/build.yml
    needs: test
```

## Monitoring and Alerting

### Performance Alerts

Set up alerts for performance degradation:

```yaml
- name: Check performance threshold
  run: |
    if [ $DURATION -gt 600 ]; then  # 10 minutes
      echo "::warning::Workflow exceeded performance threshold"
      # Send alert to monitoring system
    fi
```

### Regular Performance Reviews

1. **Weekly reviews**: Check workflow performance metrics
2. **Trend analysis**: Monitor performance trends over time
3. **Optimization opportunities**: Identify new optimization opportunities
4. **Resource usage**: Monitor GitHub Actions usage and costs

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Workflow Syntax Reference](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [Caching Dependencies](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows)
- [Using Concurrency](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#concurrency)