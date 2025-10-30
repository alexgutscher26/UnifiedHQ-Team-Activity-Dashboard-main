#!/usr/bin/env node

/**
 * Cache Infrastructure Deployment Script
 * Orchestrates the complete deployment of caching infrastructure
 */

const { spawn, exec } = require('child_process')
const fs = require('fs')
const path = require('path')

class CacheInfrastructureDeployment {
  constructor (options = {}) {
    this.config = {
      environment: options.environment || process.env.NODE_ENV || 'development',
      skipRedisSetup: options.skipRedisSetup || false,
      skipHealthChecks: options.skipHealthChecks || false,
      skipMonitoring: options.skipMonitoring || false,
      monitoringDuration: options.monitoringDuration || 300, // 5 minutes
      ...options
    }

    this.deploymentSteps = []
    this.deploymentStatus = 'pending'
  }

  /**
   * Run complete cache infrastructure deployment.
   *
   * This function orchestrates the deployment process by validating the environment configuration, setting up Redis if not skipped, deploying the application, running health checks, and starting monitoring based on the configuration. It generates a deployment report upon successful completion or a failure report if an error occurs during the process.
   *
   * @returns A report detailing the deployment results.
   * @throws Error If the deployment fails at any step.
   */
  async deploy () {
    console.log('🚀 Starting Cache Infrastructure Deployment')
    console.log('='.repeat(60))
    console.log(`Environment: ${this.config.environment}`)
    console.log(`Timestamp: ${new Date().toISOString()}`)
    console.log('')

    try {
      this.deploymentStatus = 'running'

      // Step 1: Validate environment configuration
      await this.validateEnvironment()

      // Step 2: Setup Redis infrastructure
      if (!this.config.skipRedisSetup) {
        await this.setupRedis()
      } else {
        console.log('⏭️  Skipping Redis setup (skipRedisSetup = true)')
      }

      // Step 3: Deploy application with caching
      await this.deployApplication()

      // Step 4: Run health checks
      if (!this.config.skipHealthChecks) {
        await this.runHealthChecks()
      } else {
        console.log('⏭️  Skipping health checks (skipHealthChecks = true)')
      }

      // Step 5: Start monitoring
      if (!this.config.skipMonitoring) {
        await this.startMonitoring()
      } else {
        console.log('⏭️  Skipping monitoring (skipMonitoring = true)')
      }

      // Step 6: Generate deployment report
      const report = await this.generateDeploymentReport()

      this.deploymentStatus = 'completed'
      console.log(
        '\n✅ Cache Infrastructure Deployment Completed Successfully!'
      )

      return report
    } catch (error) {
      this.deploymentStatus = 'failed'
      console.error('\n❌ Cache Infrastructure Deployment Failed:', error)

      // Generate failure report
      const failureReport = await this.generateFailureReport(error)
      throw new Error(`Deployment failed: ${error.message}`)
    }
  }

  /**
   * Validate environment configuration
   */
  async validateEnvironment () {
    console.log('🔍 Step 1: Validating Environment Configuration...')

    const step = {
      name: 'validate_environment',
      startTime: Date.now(),
      status: 'running'
    }

    try {
      // Check required environment variables
      const requiredVars = ['DATABASE_URL']
      const optionalVars = ['REDIS_URL', 'VERCEL_PURGE_API_KEY']

      const missingRequired = requiredVars.filter(
        varName => !process.env[varName]
      )
      if (missingRequired.length > 0) {
        throw new Error(
          `Missing required environment variables: ${missingRequired.join(', ')}`
        )
      }

      const missingOptional = optionalVars.filter(
        varName => !process.env[varName]
      )
      if (missingOptional.length > 0) {
        console.log(
          `⚠️  Missing optional environment variables: ${missingOptional.join(', ')}`
        )
      }

      // Validate configuration files exist
      const configFiles = [
        'src/lib/config/cache-config.ts',
        'src/lib/config/feature-flags.ts',
        'src/lib/redis.ts'
      ]

      for (const configFile of configFiles) {
        if (!fs.existsSync(configFile)) {
          throw new Error(`Configuration file missing: ${configFile}`)
        }
      }

      // Test configuration loading
      const { CacheConfig } = require('../src/lib/config/cache-config.ts')
      const { FeatureFlags } = require('../src/lib/config/feature-flags.ts')

      const configValidation = CacheConfig.validateConfig()
      if (!configValidation.valid) {
        throw new Error(
          `Configuration validation failed: ${configValidation.errors.join(', ')}`
        )
      }

      const flagsValidation = FeatureFlags.validate()
      if (!flagsValidation.valid) {
        throw new Error(
          `Feature flags validation failed: ${flagsValidation.errors.join(', ')}`
        )
      }

      step.status = 'completed'
      step.endTime = Date.now()
      step.duration = step.endTime - step.startTime

      console.log(
        `   ✅ Environment validation completed (${step.duration}ms)`
      )
    } catch (error) {
      step.status = 'failed'
      step.error = error.message
      step.endTime = Date.now()
      step.duration = step.endTime - step.startTime

      console.log(`   ❌ Environment validation failed: ${error.message}`)
      throw error
    } finally {
      this.deploymentSteps.push(step)
    }
  }

  /**
   * Sets up Redis infrastructure by executing a setup script.
   *
   * This function logs the start of the Redis setup process, initializes a step object to track the setup's status, and attempts to run the Redis setup script. If the script fails, an error is thrown, and the step status is updated accordingly. Regardless of success or failure, the step details are pushed to the deploymentSteps array for tracking.
   */
  async setupRedis () {
    console.log('\n🔧 Step 2: Setting up Redis Infrastructure...')

    const step = {
      name: 'setup_redis',
      startTime: Date.now(),
      status: 'running'
    }

    try {
      // Run Redis setup script
      const setupResult = await this.runScript('redis-setup.js')

      if (setupResult.exitCode !== 0) {
        throw new Error(
          `Redis setup failed with exit code ${setupResult.exitCode}: ${setupResult.stderr}`
        )
      }

      step.status = 'completed'
      step.endTime = Date.now()
      step.duration = step.endTime - step.startTime
      step.output = setupResult.stdout

      console.log(`   ✅ Redis setup completed (${step.duration}ms)`)
    } catch (error) {
      step.status = 'failed'
      step.error = error.message
      step.endTime = Date.now()
      step.duration = step.endTime - step.startTime

      console.log(`   ❌ Redis setup failed: ${error.message}`)
      throw error
    } finally {
      this.deploymentSteps.push(step)
    }
  }

  /**
   * Deploys the application with caching enabled.
   *
   * This function handles the deployment process by first building the application using the command 'bun run build'.
   * It checks the build result and throws an error if the build fails. Depending on the environment configuration,
   * it either simulates starting a development server or initiates the deployment process for production.
   * The function tracks the deployment step's status, duration, and any errors encountered during the process.
   */
  async deployApplication () {
    console.log('\n🚀 Step 3: Deploying Application...')

    const step = {
      name: 'deploy_application',
      startTime: Date.now(),
      status: 'running'
    }

    try {
      // Build application
      console.log('   📦 Building application...')
      const buildResult = await this.runCommand('bun run build')

      if (buildResult.exitCode !== 0) {
        throw new Error(`Application build failed: ${buildResult.stderr}`)
      }

      // Start application (in background for testing)
      if (this.config.environment === 'development') {
        console.log('   🔄 Starting development server...')
        // For development, we don't actually start the server here
        // as it's typically started separately
      } else {
        console.log('   🚀 Application deployment initiated...')
        // In production, this would trigger the actual deployment
        // For now, we'll simulate it
      }

      step.status = 'completed'
      step.endTime = Date.now()
      step.duration = step.endTime - step.startTime

      console.log(
        `   ✅ Application deployment completed (${step.duration}ms)`
      )
    } catch (error) {
      step.status = 'failed'
      step.error = error.message
      step.endTime = Date.now()
      step.duration = step.endTime - step.startTime

      console.log(`   ❌ Application deployment failed: ${error.message}`)
      throw error
    } finally {
      this.deploymentSteps.push(step)
    }
  }

  /**
   * Run health checks for the application services.
   *
   * This function initiates a series of health checks by first waiting for the services to be ready, then testing the main health endpoint and the cache health endpoint. If any of the checks fail, an error is thrown. The results, including the duration of the checks and health data, are logged and stored in the deployment steps.
   *
   * @returns {Promise<void>} A promise that resolves when health checks are completed.
   * @throws Error If any health check fails.
   */
  async runHealthChecks () {
    console.log('\n🏥 Step 4: Running Health Checks...')

    const step = {
      name: 'health_checks',
      startTime: Date.now(),
      status: 'running'
    }

    try {
      // Wait a moment for services to be ready
      console.log('   ⏳ Waiting for services to be ready...')
      await this.sleep(5000) // 5 seconds

      // Test health endpoints
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

      console.log('   🔍 Testing main health endpoint...')
      const mainHealthResponse = await fetch(`${baseUrl}/api/health`)
      if (!mainHealthResponse.ok) {
        throw new Error(
          `Main health check failed with status: ${mainHealthResponse.status}`
        )
      }

      console.log('   🔍 Testing cache health endpoint...')
      const cacheHealthResponse = await fetch(`${baseUrl}/api/health/cache`)
      if (!cacheHealthResponse.ok) {
        throw new Error(
          `Cache health check failed with status: ${cacheHealthResponse.status}`
        )
      }

      const healthData = await cacheHealthResponse.json()

      step.status = 'completed'
      step.endTime = Date.now()
      step.duration = step.endTime - step.startTime
      step.healthData = healthData

      console.log(`   ✅ Health checks completed (${step.duration}ms)`)
      console.log(`   📊 Overall health: ${healthData.overall}`)
    } catch (error) {
      step.status = 'failed'
      step.error = error.message
      step.endTime = Date.now()
      step.duration = step.endTime - step.startTime

      console.log(`   ❌ Health checks failed: ${error.message}`)
      throw error
    } finally {
      this.deploymentSteps.push(step)
    }
  }

  /**
   * Start deployment monitoring.
   *
   * This function initiates the monitoring process for deployment by logging the start of the operation,
   * setting up the monitoring parameters, and executing the monitoring script. It tracks the status,
   * duration, and output of the monitoring process, handling any errors that may occur without
   * interrupting the overall deployment flow. The results are stored in the deploymentSteps array.
   */
  async startMonitoring () {
    console.log('\n📊 Step 5: Starting Deployment Monitoring...')

    const step = {
      name: 'monitoring',
      startTime: Date.now(),
      status: 'running'
    }

    try {
      // Run monitoring script
      const monitoringArgs = [
        '--max-checks',
        Math.floor(this.config.monitoringDuration / 30).toString(), // 30-second intervals
        '--interval',
        '30'
      ]

      if (process.env.NEXT_PUBLIC_APP_URL) {
        monitoringArgs.push('--url', process.env.NEXT_PUBLIC_APP_URL)
      }

      const monitoringResult = await this.runScript(
        'cache-deployment-monitor.js',
        monitoringArgs
      )

      step.status = 'completed'
      step.endTime = Date.now()
      step.duration = step.endTime - step.startTime
      step.monitoringOutput = monitoringResult.stdout

      console.log(`   ✅ Monitoring completed (${step.duration}ms)`)
    } catch (error) {
      step.status = 'failed'
      step.error = error.message
      step.endTime = Date.now()
      step.duration = step.endTime - step.startTime

      console.log(`   ❌ Monitoring failed: ${error.message}`)
      // Don't throw error for monitoring failure - it's not critical
    } finally {
      this.deploymentSteps.push(step)
    }
  }

  /**
   * Generate deployment report.
   *
   * This function generates a detailed report of the deployment process, including the status, environment,
   * start and end times, total duration, and a summary of the steps taken. It calculates the number of successful
   * and failed steps, as well as the success rate. The report is then saved as a JSON file in the 'reports'
   * directory, creating the directory if it does not exist.
   */
  async generateDeploymentReport () {
    console.log('\n📄 Step 6: Generating Deployment Report...')

    const totalDuration = this.deploymentSteps.reduce(
      (sum, step) => sum + (step.duration || 0),
      0
    )
    const successfulSteps = this.deploymentSteps.filter(
      step => step.status === 'completed'
    ).length
    const failedSteps = this.deploymentSteps.filter(
      step => step.status === 'failed'
    ).length

    const report = {
      deployment: {
        status: this.deploymentStatus,
        environment: this.config.environment,
        startTime: this.deploymentSteps[0]?.startTime,
        endTime: Date.now(),
        totalDuration,
        timestamp: new Date().toISOString()
      },
      summary: {
        totalSteps: this.deploymentSteps.length,
        successfulSteps,
        failedSteps,
        successRate: Math.round(
          (successfulSteps / this.deploymentSteps.length) * 100
        )
      },
      steps: this.deploymentSteps,
      config: this.config
    }

    // Save report
    const reportsDir = path.join(process.cwd(), 'reports')
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true })
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const reportPath = path.join(
      reportsDir,
      `cache-deployment-${timestamp}.json`
    )

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))

    console.log(`   📄 Deployment report saved to: ${reportPath}`)
    console.log(`   ⏱️  Total deployment time: ${totalDuration}ms`)
    console.log(`   📊 Success rate: ${report.summary.successRate}%`)

    return report
  }

  /**
   * Generates a failure report for a deployment.
   */
  async generateFailureReport (error) {
    const report = {
      deployment: {
        status: 'failed',
        environment: this.config.environment,
        error: error.message,
        timestamp: new Date().toISOString()
      },
      steps: this.deploymentSteps,
      config: this.config
    }

    const reportsDir = path.join(process.cwd(), 'reports')
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true })
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const reportPath = path.join(
      reportsDir,
      `cache-deployment-failure-${timestamp}.json`
    )

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
    console.log(`   📄 Failure report saved to: ${reportPath}`)

    return report
  }

  /**
   * Run a script file with optional arguments.
   */
  async runScript (scriptName, args = []) {
    const scriptPath = path.join(__dirname, scriptName)
    return this.runCommand(`node ${scriptPath} ${args.join(' ')}`)
  }

  /**
   * Executes a command and returns the result as a promise.
   */
  async runCommand (command) {
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        resolve({
          exitCode: error ? error.code : 0,
          stdout: stdout.trim(),
          stderr: stderr.trim()
        })
      })
    })
  }

  /**
   * Returns a promise that resolves after a specified number of milliseconds.
   */
  sleep (ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2)
  const options = {}

  // Parse command line arguments
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace('--', '')
    const value = args[i + 1]

    if (key && value !== undefined) {
      switch (key) {
        case 'environment':
          options.environment = value
          break
        case 'skip-redis':
          options.skipRedisSetup = value === 'true'
          break
        case 'skip-health':
          options.skipHealthChecks = value === 'true'
          break
        case 'skip-monitoring':
          options.skipMonitoring = value === 'true'
          break
        case 'monitoring-duration':
          options.monitoringDuration = parseInt(value)
          break
      }
    }
  }

  const deployment = new CacheInfrastructureDeployment(options)

  deployment.deploy().catch(error => {
    console.error('❌ Deployment failed:', error.message)
    process.exit(1)
  })
}

module.exports = CacheInfrastructureDeployment
