/**
 * Redis Setup and Deployment Script
 * Handles Redis configuration, connection testing, and initial setup
 */

const { createClient } = require('redis');
const fs = require('fs');
const path = require('path');

class RedisSetup {
  constructor() {
    this.config = {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      maxRetries: parseInt(process.env.REDIS_MAX_RETRIES) || 10,
      retryDelay: parseInt(process.env.REDIS_RETRY_DELAY) || 3000,
      connectionTimeout:
        parseInt(process.env.REDIS_CONNECTION_TIMEOUT) || 20000,
      commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT) || 15000,
    };

    this.client = null;
  }

  /**
   * Initialize Redis client.
   *
   * This function sets up a Redis client using the configuration provided in this.config.
   * It establishes connection parameters, including a reconnect strategy that limits retries.
   * The function also handles connection events, logging errors and connection status to the console.
   * Finally, it attempts to connect to the Redis server and returns a boolean indicating success or failure.
   */
  async initializeClient() {
    try {
      this.client = createClient({
        url: this.config.url,
        socket: {
          connectTimeout: this.config.connectionTimeout,
          lazyConnect: true,
          reconnectStrategy: retries => {
            if (retries > this.config.maxRetries) {
              console.error(
                `❌ Redis connection failed after ${this.config.maxRetries} retries`
              );
              return false;
            }
            return Math.min(retries * 100, this.config.retryDelay);
          },
        },
      });

      this.client.on('error', error => {
        console.error('❌ Redis client error:', error);
      });

      this.client.on('connect', () => {
        console.log('🔗 Redis client connected');
      });

      this.client.on('ready', () => {
        console.log('✅ Redis client ready');
      });

      await this.client.connect();
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Redis client:', error);
      return false;
    }
  }

  /**
   * Test Redis connection and basic operations.
   *
   * This function tests the connectivity to a Redis server by sending a ping command and verifying the response.
   * It also performs basic operations such as setting, getting, and deleting a key, as well as checking the TTL functionality.
   * If any operation fails, an error is thrown, and the function returns false; otherwise, it returns true.
   *
   * @returns {Promise<boolean>} A promise that resolves to true if all tests are successful, otherwise false.
   */
  async testConnection() {
    console.log('🧪 Testing Redis connection...');

    try {
      // Test basic connectivity
      const pong = await this.client.ping();
      if (pong !== 'PONG') {
        throw new Error('Invalid ping response');
      }
      console.log('✅ Redis ping successful');

      // Test basic operations
      const testKey = 'unifiedhq:test:connection';
      const testValue = JSON.stringify({ timestamp: Date.now(), test: true });

      await this.client.set(testKey, testValue, { EX: 60 });
      console.log('✅ Redis SET operation successful');

      const retrievedValue = await this.client.get(testKey);
      if (retrievedValue !== testValue) {
        throw new Error('Retrieved value does not match set value');
      }
      console.log('✅ Redis GET operation successful');

      await this.client.del(testKey);
      console.log('✅ Redis DEL operation successful');

      // Test TTL functionality
      const ttlKey = 'unifiedhq:test:ttl';
      await this.client.set(ttlKey, 'ttl-test', { EX: 5 });
      const ttl = await this.client.ttl(ttlKey);
      if (ttl <= 0 || ttl > 5) {
        throw new Error('TTL not working correctly');
      }
      console.log('✅ Redis TTL functionality working');

      await this.client.del(ttlKey);

      return true;
    } catch (error) {
      console.error('❌ Redis connection test failed:', error);
      return false;
    }
  }

  /**
   * Sets up the initial cache structure and configuration keys.
   *
   * This function creates namespace keys for various data types and sets up configuration data, including versioning, time-to-live (TTL) settings, and feature flags. It iterates over the configuration data and stores each key-value pair in the cache with a specified expiration time. If any errors occur during the setup process, they are logged, and the function returns false.
   */
  async setupCacheStructure() {
    console.log('🏗️  Setting up cache structure...');

    try {
      // Create namespace keys for different data types
      const namespaces = [
        'unifiedhq:user',
        'unifiedhq:github',
        'unifiedhq:slack',
        'unifiedhq:ai',
        'unifiedhq:api',
        'unifiedhq:session',
        'unifiedhq:config',
      ];

      // Set up configuration keys
      const configData = {
        'unifiedhq:config:version': JSON.stringify({
          version: '1.0.0',
          setupDate: new Date().toISOString(),
          environment: process.env.NODE_ENV || 'development',
        }),
        'unifiedhq:config:ttl': JSON.stringify({
          userSession: 24 * 60 * 60,
          githubData: 15 * 60,
          slackData: 5 * 60,
          aiSummary: 60 * 60,
          staticConfig: 24 * 60 * 60,
          apiResponse: 5 * 60,
        }),
        'unifiedhq:config:features': JSON.stringify({
          cacheEnabled: true,
          monitoringEnabled: true,
          setupComplete: true,
        }),
      };

      for (const [key, value] of Object.entries(configData)) {
        await this.client.set(key, value, { EX: 24 * 60 * 60 }); // 24 hours
      }

      console.log('✅ Cache structure setup complete');
      return true;
    } catch (error) {
      console.error('❌ Failed to setup cache structure:', error);
      return false;
    }
  }

  /**
   * Validate Redis configuration.
   *
   * This function checks the Redis server's information, including version, mode, memory usage, and connected clients.
   * It calculates the memory usage percentage and warns if it exceeds 80%. Additionally, it logs the last RDB save time if available.
   * The function returns true if validation is successful and false if an error occurs during the process.
   *
   * @returns {Promise<boolean>} A promise that resolves to true if the validation is successful, or false if it fails.
   */
  async validateConfiguration() {
    console.log('🔍 Validating Redis configuration...');

    try {
      // Check Redis info
      const info = await this.client.info();
      const lines = info.split('\r\n');
      const redisInfo = {};

      lines.forEach(line => {
        if (line.includes(':')) {
          const [key, value] = line.split(':');
          redisInfo[key] = value;
        }
      });

      console.log('📊 Redis Server Info:');
      console.log(`   Version: ${redisInfo.redis_version || 'Unknown'}`);
      console.log(`   Mode: ${redisInfo.redis_mode || 'Unknown'}`);
      console.log(`   Memory: ${redisInfo.used_memory_human || 'Unknown'}`);
      console.log(
        `   Connected clients: ${redisInfo.connected_clients || 'Unknown'}`
      );

      // Check memory usage
      const memoryUsage = parseInt(redisInfo.used_memory) || 0;
      const maxMemory = parseInt(redisInfo.maxmemory) || 0;

      if (maxMemory > 0) {
        const memoryPercentage = (memoryUsage / maxMemory) * 100;
        console.log(`   Memory usage: ${memoryPercentage.toFixed(2)}%`);

        if (memoryPercentage > 80) {
          console.warn('⚠️  Warning: Redis memory usage is above 80%');
        }
      }

      // Check persistence configuration
      if (redisInfo.rdb_last_save_time) {
        console.log(
          `   Last RDB save: ${new Date(parseInt(redisInfo.rdb_last_save_time) * 1000).toISOString()}`
        );
      }

      console.log('✅ Redis configuration validation complete');
      return true;
    } catch (error) {
      console.error('❌ Failed to validate Redis configuration:', error);
      return false;
    }
  }

  /**
   * Clean up test data and close connection
   */
  async cleanup() {
    try {
      if (this.client) {
        // Clean up any test keys
        const testKeys = await this.client.keys('unifiedhq:test:*');
        if (testKeys.length > 0) {
          await this.client.del(testKeys);
          console.log(`🧹 Cleaned up ${testKeys.length} test keys`);
        }

        await this.client.quit();
        console.log('👋 Redis connection closed');
      }
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
    }
  }

  /**
   * Generate deployment report.
   *
   * This function creates a deployment report containing the current timestamp,
   * environment, a sanitized Redis URL, the results of the deployment, and
   * the overall status based on the success of the results. It ensures that
   * the reports directory exists before saving the report as a JSON file and
   * logs the path where the report is saved.
   *
   * @param {Array} results - The results of the deployment, each containing a success status.
   */
  generateReport(results) {
    const report = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      redisUrl: this.config.url.replace(/\/\/.*@/, '//***@'), // Hide credentials
      results,
      status: results.every(r => r.success) ? 'SUCCESS' : 'FAILED',
    };

    const reportPath = path.join(
      process.cwd(),
      'reports',
      'redis-setup-report.json'
    );

    // Ensure reports directory exists
    const reportsDir = path.dirname(reportPath);
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Setup report saved to: ${reportPath}`);

    return report;
  }

  /**
   * Run complete Redis setup process
   */
  async run() {
    console.log('🚀 Starting Redis setup and deployment...\n');

    const results = [];
    let success = true;

    try {
      // Initialize client
      const initResult = await this.initializeClient();
      results.push({ step: 'initialize', success: initResult });
      if (!initResult) success = false;

      if (success) {
        // Test connection
        const testResult = await this.testConnection();
        results.push({ step: 'test_connection', success: testResult });
        if (!testResult) success = false;
      }

      if (success) {
        // Setup cache structure
        const setupResult = await this.setupCacheStructure();
        results.push({ step: 'setup_structure', success: setupResult });
        if (!setupResult) success = false;
      }

      if (success) {
        // Validate configuration
        const validateResult = await this.validateConfiguration();
        results.push({ step: 'validate_config', success: validateResult });
        if (!validateResult) success = false;
      }
    } catch (error) {
      console.error('❌ Unexpected error during setup:', error);
      results.push({
        step: 'unexpected_error',
        success: false,
        error: error.message,
      });
      success = false;
    } finally {
      await this.cleanup();
    }

    // Generate report
    const report = this.generateReport(results);

    console.log('\n📋 Setup Summary:');
    results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`   ${status} ${result.step}`);
    });

    console.log(`\n🎯 Overall Status: ${success ? '✅ SUCCESS' : '❌ FAILED'}`);

    if (!success) {
      process.exit(1);
    }

    return report;
  }
}

// CLI execution
if (require.main === module) {
  const setup = new RedisSetup();
  setup.run().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = RedisSetup;
