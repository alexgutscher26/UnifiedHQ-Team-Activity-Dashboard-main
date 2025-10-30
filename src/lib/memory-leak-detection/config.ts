/**
 * Configuration system for memory leak detection
 */

import { MemoryLeakDetectionConfig, LeakSeverity, LeakType } from './types';
import { promises as fs } from 'fs';
import * as path from 'path';

// Configuration file name
const CONFIG_FILE_NAME = 'memory-leak-detection.config.json';

// Default configurations for different environments
export const DEFAULT_CONFIGS = {
  development: {
    detection: {
      enableStaticAnalysis: true,
      enableRuntimeDetection: true,
      scanPatterns: ['src/**/*.{ts,tsx,js,jsx}'],
      excludePatterns: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/*.test.*',
        '**/*.spec.*',
        '**/*.d.ts',
      ],
      severityThreshold: 'low' as LeakSeverity,
      confidenceThreshold: 0.3,
      maxFileSize: 2 * 1024 * 1024, // 2MB
      timeout: 60000, // 60 seconds
    },
    fixes: {
      autoApplyLowRisk: false,
      requireReviewForHighRisk: true,
      backupOriginalFiles: true,
      maxBatchSize: 5,
      dryRun: true,
      preserveFormatting: true,
    },
    monitoring: {
      memoryThreshold: 150, // MB
      alertFrequency: 2, // minutes
      trackingInterval: 500, // milliseconds
      retentionPeriod: 3, // days
      enableRealTimeAlerts: true,
      enableTrendAnalysis: true,
    },
    prevention: {
      enableESLintRules: true,
      enablePreCommitHooks: false,
      enablePRValidation: false,
      strictMode: false,
      educationalMode: true,
    },
  } as MemoryLeakDetectionConfig,

  production: {
    detection: {
      enableStaticAnalysis: true,
      enableRuntimeDetection: false, // Disabled in production for performance
      scanPatterns: ['src/**/*.{ts,tsx,js,jsx}'],
      excludePatterns: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/*.test.*',
        '**/*.spec.*',
        '**/*.d.ts',
      ],
      severityThreshold: 'medium' as LeakSeverity,
      confidenceThreshold: 0.7,
      maxFileSize: 1024 * 1024, // 1MB
      timeout: 30000, // 30 seconds
    },
    fixes: {
      autoApplyLowRisk: false,
      requireReviewForHighRisk: true,
      backupOriginalFiles: true,
      maxBatchSize: 3,
      dryRun: true,
      preserveFormatting: true,
    },
    monitoring: {
      memoryThreshold: 200, // MB
      alertFrequency: 10, // minutes
      trackingInterval: 5000, // milliseconds
      retentionPeriod: 7, // days
      enableRealTimeAlerts: false,
      enableTrendAnalysis: false,
    },
    prevention: {
      enableESLintRules: true,
      enablePreCommitHooks: true,
      enablePRValidation: true,
      strictMode: true,
      educationalMode: false,
    },
  } as MemoryLeakDetectionConfig,

  testing: {
    detection: {
      enableStaticAnalysis: true,
      enableRuntimeDetection: true,
      scanPatterns: ['**/*.{ts,tsx,js,jsx}'],
      excludePatterns: ['**/node_modules/**'],
      severityThreshold: 'low' as LeakSeverity,
      confidenceThreshold: 0.1,
      maxFileSize: 512 * 1024, // 512KB
      timeout: 10000, // 10 seconds
    },
    fixes: {
      autoApplyLowRisk: true,
      requireReviewForHighRisk: false,
      backupOriginalFiles: false,
      maxBatchSize: 20,
      dryRun: false,
      preserveFormatting: false,
    },
    monitoring: {
      memoryThreshold: 50, // MB
      alertFrequency: 1, // minutes
      trackingInterval: 100, // milliseconds
      retentionPeriod: 1, // days
      enableRealTimeAlerts: true,
      enableTrendAnalysis: true,
    },
    prevention: {
      enableESLintRules: false,
      enablePreCommitHooks: false,
      enablePRValidation: false,
      strictMode: false,
      educationalMode: false,
    },
  } as MemoryLeakDetectionConfig,
};

// Configuration manager
export class ConfigManager {
  private config: MemoryLeakDetectionConfig;
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(process.cwd(), CONFIG_FILE_NAME);
    this.config = this.getDefaultConfig();
  }

  // Get default configuration based on environment
  private getDefaultConfig(): MemoryLeakDetectionConfig {
    const env = process.env.NODE_ENV || 'development';

    if (env === 'production') {
      return DEFAULT_CONFIGS.production;
    } else if (env === 'test') {
      return DEFAULT_CONFIGS.testing;
    } else {
      return DEFAULT_CONFIGS.development;
    }
  }

  // Load configuration from file
  async loadConfig(): Promise<MemoryLeakDetectionConfig> {
    try {
      const configExists = await this.configExists();

      if (configExists) {
        const configData = await fs.readFile(this.configPath, 'utf-8');
        const userConfig = JSON.parse(
          configData
        ) as Partial<MemoryLeakDetectionConfig>;

        // Merge with default config
        this.config = this.mergeConfigs(this.getDefaultConfig(), userConfig);
        console.log(`Loaded configuration from ${this.configPath}`);
      } else {
        console.log('No configuration file found, using defaults');
      }

      return this.config;
    } catch (error) {
      console.error('Error loading configuration:', error);
      console.log('Using default configuration');
      return this.config;
    }
  }

  // Save configuration to file
  async saveConfig(config?: Partial<MemoryLeakDetectionConfig>): Promise<void> {
    try {
      const configToSave = config
        ? this.mergeConfigs(this.config, config)
        : this.config;

      const configData = JSON.stringify(configToSave, null, 2);
      await fs.writeFile(this.configPath, configData, 'utf-8');

      this.config = configToSave;
      console.log(`Configuration saved to ${this.configPath}`);
    } catch (error) {
      console.error('Error saving configuration:', error);
      throw error;
    }
  }

  // Check if configuration file exists
  async configExists(): Promise<boolean> {
    try {
      await fs.access(this.configPath);
      return true;
    } catch {
      return false;
    }
  }

  // Create default configuration file
  async createDefaultConfig(): Promise<void> {
    const defaultConfig = this.getDefaultConfig();
    await this.saveConfig(defaultConfig);
  }

  // Merge configurations
  private mergeConfigs(
    baseConfig: MemoryLeakDetectionConfig,
    userConfig: Partial<MemoryLeakDetectionConfig>
  ): MemoryLeakDetectionConfig {
    return {
      detection: { ...baseConfig.detection, ...userConfig.detection },
      fixes: { ...baseConfig.fixes, ...userConfig.fixes },
      monitoring: { ...baseConfig.monitoring, ...userConfig.monitoring },
      prevention: { ...baseConfig.prevention, ...userConfig.prevention },
    };
  }

  // Get current configuration
  getConfig(): MemoryLeakDetectionConfig {
    return { ...this.config };
  }

  // Update configuration
  updateConfig(updates: Partial<MemoryLeakDetectionConfig>): void {
    this.config = this.mergeConfigs(this.config, updates);
  }

  // Validate configuration
  validateConfig(config: Partial<MemoryLeakDetectionConfig>): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Validate detection config
    if (config.detection) {
      const { detection } = config;

      if (detection.confidenceThreshold !== undefined) {
        if (
          detection.confidenceThreshold < 0 ||
          detection.confidenceThreshold > 1
        ) {
          errors.push('confidenceThreshold must be between 0 and 1');
        }
      }

      if (detection.maxFileSize !== undefined) {
        if (detection.maxFileSize <= 0) {
          errors.push('maxFileSize must be positive');
        }
      }

      if (detection.timeout !== undefined) {
        if (detection.timeout <= 0) {
          errors.push('timeout must be positive');
        }
      }
    }

    // Validate fixes config
    if (config.fixes) {
      const { fixes } = config;

      if (fixes.maxBatchSize !== undefined) {
        if (fixes.maxBatchSize <= 0) {
          errors.push('maxBatchSize must be positive');
        }
      }
    }

    // Validate monitoring config
    if (config.monitoring) {
      const { monitoring } = config;

      if (monitoring.memoryThreshold !== undefined) {
        if (monitoring.memoryThreshold <= 0) {
          errors.push('memoryThreshold must be positive');
        }
      }

      if (monitoring.alertFrequency !== undefined) {
        if (monitoring.alertFrequency <= 0) {
          errors.push('alertFrequency must be positive');
        }
      }

      if (monitoring.trackingInterval !== undefined) {
        if (monitoring.trackingInterval <= 0) {
          errors.push('trackingInterval must be positive');
        }
      }

      if (monitoring.retentionPeriod !== undefined) {
        if (monitoring.retentionPeriod <= 0) {
          errors.push('retentionPeriod must be positive');
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // Get configuration for specific leak types
  getLeakTypeConfig(leakType: LeakType): {
    enabled: boolean;
    severity: LeakSeverity;
    autoFix: boolean;
  } {
    const config = this.getConfig();

    // Default settings for each leak type
    const leakTypeDefaults: Record<
      LeakType,
      {
        enabled: boolean;
        severity: LeakSeverity;
        autoFix: boolean;
      }
    > = {
      'missing-useeffect-cleanup': {
        enabled: true,
        severity: 'high',
        autoFix: false,
      },
      'uncleaned-event-listener': {
        enabled: true,
        severity: 'medium',
        autoFix: false,
      },
      'uncleaned-interval': {
        enabled: true,
        severity: 'high',
        autoFix: false,
      },
      'uncleaned-timeout': {
        enabled: true,
        severity: 'medium',
        autoFix: false,
      },
      'uncleaned-subscription': {
        enabled: true,
        severity: 'high',
        autoFix: false,
      },
      'unclosed-eventsource': {
        enabled: true,
        severity: 'high',
        autoFix: false,
      },
      'unclosed-websocket': {
        enabled: true,
        severity: 'high',
        autoFix: false,
      },
      'memory-accumulation': {
        enabled: config.detection.enableRuntimeDetection,
        severity: 'critical',
        autoFix: false,
      },
      'circular-reference': {
        enabled: config.detection.enableRuntimeDetection,
        severity: 'high',
        autoFix: false,
      },
    };

    return leakTypeDefaults[leakType];
  }

  // Get severity threshold as number for comparison
  getSeverityThresholdNumber(): number {
    const severityMap: Record<LeakSeverity, number> = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 4,
    };

    return severityMap[this.config.detection.severityThreshold];
  }

  // Check if leak should be reported based on configuration
  shouldReportLeak(severity: LeakSeverity, confidence: number): boolean {
    const severityMap: Record<LeakSeverity, number> = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 4,
    };

    const leakSeverityNumber = severityMap[severity];
    const thresholdNumber = this.getSeverityThresholdNumber();

    return (
      leakSeverityNumber >= thresholdNumber &&
      confidence >= this.config.detection.confidenceThreshold
    );
  }

  // Export configuration as JSON string
  exportConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }

  // Import configuration from JSON string
  importConfig(configJson: string): void {
    try {
      const importedConfig = JSON.parse(
        configJson
      ) as Partial<MemoryLeakDetectionConfig>;
      const validation = this.validateConfig(importedConfig);

      if (!validation.valid) {
        throw new Error(
          `Invalid configuration: ${validation.errors.join(', ')}`
        );
      }

      this.config = this.mergeConfigs(this.getDefaultConfig(), importedConfig);
    } catch (error) {
      throw new Error(
        `Failed to import configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // Reset to default configuration
  resetToDefaults(): void {
    this.config = this.getDefaultConfig();
  }

  // Get configuration summary
  getConfigSummary(): {
    environment: string;
    staticAnalysisEnabled: boolean;
    runtimeDetectionEnabled: boolean;
    severityThreshold: LeakSeverity;
    confidenceThreshold: number;
    autoFixEnabled: boolean;
    eslintRulesEnabled: boolean;
  } {
    return {
      environment: process.env.NODE_ENV || 'development',
      staticAnalysisEnabled: this.config.detection.enableStaticAnalysis,
      runtimeDetectionEnabled: this.config.detection.enableRuntimeDetection,
      severityThreshold: this.config.detection.severityThreshold,
      confidenceThreshold: this.config.detection.confidenceThreshold,
      autoFixEnabled: this.config.fixes.autoApplyLowRisk,
      eslintRulesEnabled: this.config.prevention.enableESLintRules,
    };
  }
}

// Singleton instance
let configManager: ConfigManager | null = null;

// Get global configuration manager
export function getConfigManager(configPath?: string): ConfigManager {
  if (!configManager) {
    configManager = new ConfigManager(configPath);
  }
  return configManager;
}

// Initialize configuration
export async function initializeConfig(
  configPath?: string
): Promise<MemoryLeakDetectionConfig> {
  const manager = getConfigManager(configPath);
  return await manager.loadConfig();
}

// Create default configuration file
export async function createDefaultConfigFile(
  configPath?: string
): Promise<void> {
  const manager = getConfigManager(configPath);
  await manager.createDefaultConfig();
}

// Utility functions for common configuration tasks
export const configUtils = {
  // Enable/disable specific leak types
  toggleLeakType: (leakType: LeakType, enabled: boolean) => {
    const manager = getConfigManager();
    const config = manager.getConfig();

    // TODO: This would require extending the config structure to support per-type settings
    // For now, we'll just log the action
    console.log(
      `${enabled ? 'Enabled' : 'Disabled'} detection for ${leakType}`
    );
  },

  // Set severity threshold
  setSeverityThreshold: (threshold: LeakSeverity) => {
    const manager = getConfigManager();
    manager.updateConfig({
      detection: {
        ...manager.getConfig().detection,
        severityThreshold: threshold,
      },
    });
  },

  // Set confidence threshold
  setConfidenceThreshold: (threshold: number) => {
    if (threshold < 0 || threshold > 1) {
      throw new Error('Confidence threshold must be between 0 and 1');
    }

    const manager = getConfigManager();
    manager.updateConfig({
      detection: {
        ...manager.getConfig().detection,
        confidenceThreshold: threshold,
      },
    });
  },

  // Enable/disable auto-fix for low-risk issues
  toggleAutoFix: (enabled: boolean) => {
    const manager = getConfigManager();
    manager.updateConfig({
      fixes: {
        ...manager.getConfig().fixes,
        autoApplyLowRisk: enabled,
      },
    });
  },
};
