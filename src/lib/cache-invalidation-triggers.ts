import { CacheInvalidationService } from './cache-invalidation-service';

/**
 * Cache invalidation triggers and relationship management
 * Handles automatic cache invalidation based on data relationships and events
 */

export interface InvalidationTrigger {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  conditions: {
    eventType: string;
    dataType: string;
    filters?: Record<string, any>;
  };
  actions: {
    invalidationType:
      | 'user'
      | 'github'
      | 'slack'
      | 'ai'
      | 'api'
      | 'smart'
      | 'realtime';
    scope: 'user' | 'team' | 'global';
    context?: Record<string, any>;
  }[];
}

/**
 * Predefined invalidation triggers for common scenarios
 */
export const DEFAULT_TRIGGERS: InvalidationTrigger[] = [
  {
    id: 'github-push-trigger',
    name: 'GitHub Push Event',
    description: 'Invalidate cache when code is pushed to repository',
    enabled: true,
    conditions: {
      eventType: 'github.push',
      dataType: 'repository',
    },
    actions: [
      {
        invalidationType: 'smart',
        scope: 'user',
        context: { changeType: 'github' },
      },
    ],
  },
  {
    id: 'slack-message-trigger',
    name: 'Slack Message Event',
    description: 'Invalidate cache when new messages are posted',
    enabled: true,
    conditions: {
      eventType: 'slack.message',
      dataType: 'channel',
    },
    actions: [
      {
        invalidationType: 'realtime',
        scope: 'user',
        context: { updateType: 'message' },
      },
    ],
  },
  {
    id: 'ai-summary-regeneration',
    name: 'AI Summary Regeneration',
    description: 'Invalidate AI summary cache when regeneration is requested',
    enabled: true,
    conditions: {
      eventType: 'ai.summary.regenerate',
      dataType: 'summary',
    },
    actions: [
      {
        invalidationType: 'ai',
        scope: 'user',
      },
    ],
  },
  {
    id: 'user-settings-change',
    name: 'User Settings Change',
    description: 'Invalidate user cache when settings are modified',
    enabled: true,
    conditions: {
      eventType: 'user.settings.update',
      dataType: 'user',
    },
    actions: [
      {
        invalidationType: 'user',
        scope: 'user',
      },
    ],
  },
  {
    id: 'integration-disconnect',
    name: 'Integration Disconnection',
    description: 'Invalidate integration cache when user disconnects service',
    enabled: true,
    conditions: {
      eventType: 'integration.disconnect',
      dataType: 'integration',
    },
    actions: [
      {
        invalidationType: 'smart',
        scope: 'user',
      },
    ],
  },
];

/**
 * Cache invalidation trigger manager
 */
export class CacheInvalidationTriggers {
  private static triggers: Map<string, InvalidationTrigger> = new Map();

  /**
   * Initialize default triggers
   */
  static initialize(): void {
    console.log('Initializing cache invalidation triggers');

    DEFAULT_TRIGGERS.forEach(trigger => {
      this.triggers.set(trigger.id, trigger);
    });

    console.log(
      `Initialized ${this.triggers.size} cache invalidation triggers`
    );
  }

  /**
   * Register a new invalidation trigger
   */
  static registerTrigger(trigger: InvalidationTrigger): void {
    console.log(`Registering cache invalidation trigger: ${trigger.name}`);
    this.triggers.set(trigger.id, trigger);
  }

  /**
   * Remove an invalidation trigger
   */
  static removeTrigger(triggerId: string): boolean {
    console.log(`Removing cache invalidation trigger: ${triggerId}`);
    return this.triggers.delete(triggerId);
  }

  /**
   * Enable or disable a trigger
   */
  static setTriggerEnabled(triggerId: string, enabled: boolean): boolean {
    const trigger = this.triggers.get(triggerId);
    if (trigger) {
      trigger.enabled = enabled;
      console.log(
        `${enabled ? 'Enabled' : 'Disabled'} cache invalidation trigger: ${trigger.name}`
      );
      return true;
    }
    return false;
  }

  /**
   * Get all registered triggers
   */
  static getAllTriggers(): InvalidationTrigger[] {
    return Array.from(this.triggers.values());
  }

  /**
   * Get enabled triggers
   */
  static getEnabledTriggers(): InvalidationTrigger[] {
    return Array.from(this.triggers.values()).filter(
      trigger => trigger.enabled
    );
  }

  /**
   * Process an event and execute matching triggers
   */
  static async processEvent(
    eventType: string,
    dataType: string,
    context: {
      userId?: string;
      resourceId?: string;
      data?: any;
      filters?: Record<string, any>;
    }
  ): Promise<number> {
    console.log(
      `Processing cache invalidation event: ${eventType} (${dataType})`
    );

    let totalInvalidated = 0;
    const matchingTriggers = this.getMatchingTriggers(
      eventType,
      dataType,
      context.filters
    );

    if (matchingTriggers.length === 0) {
      console.log(`No matching triggers found for event: ${eventType}`);
      return 0;
    }

    console.log(
      `Found ${matchingTriggers.length} matching triggers for event: ${eventType}`
    );

    // Process triggers in parallel
    const results = await Promise.allSettled(
      matchingTriggers.map(trigger => this.executeTrigger(trigger, context))
    );

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        totalInvalidated += result.value;
        console.log(
          `Trigger ${matchingTriggers[index].name} invalidated ${result.value} entries`
        );
      } else {
        console.error(
          `Trigger ${matchingTriggers[index].name} failed:`,
          result.reason
        );
      }
    });

    console.log(
      `Event processing completed. Total entries invalidated: ${totalInvalidated}`
    );
    return totalInvalidated;
  }

  /**
   * Find triggers that match the given event
   */
  private static getMatchingTriggers(
    eventType: string,
    dataType: string,
    filters?: Record<string, any>
  ): InvalidationTrigger[] {
    return this.getEnabledTriggers().filter(trigger => {
      // Check event type match
      if (trigger.conditions.eventType !== eventType) {
        return false;
      }

      // Check data type match
      if (trigger.conditions.dataType !== dataType) {
        return false;
      }

      // Check filters if specified
      if (trigger.conditions.filters && filters) {
        for (const [key, value] of Object.entries(trigger.conditions.filters)) {
          if (filters[key] !== value) {
            return false;
          }
        }
      }

      return true;
    });
  }

  /**
   * Execute a specific trigger
   */
  private static async executeTrigger(
    trigger: InvalidationTrigger,
    context: {
      userId?: string;
      resourceId?: string;
      data?: any;
    }
  ): Promise<number> {
    console.log(`Executing cache invalidation trigger: ${trigger.name}`);

    let totalInvalidated = 0;

    for (const action of trigger.actions) {
      try {
        let invalidatedCount = 0;

        switch (action.invalidationType) {
          case 'user':
            if (context.userId) {
              invalidatedCount = await CacheInvalidationService.invalidateUser(
                context.userId
              );
            }
            break;

          case 'github':
            if (context.userId) {
              invalidatedCount =
                await CacheInvalidationService.invalidateGitHubData(
                  context.userId,
                  action.context?.repository || context.data?.repository
                );
            }
            break;

          case 'slack':
            if (context.userId) {
              invalidatedCount =
                await CacheInvalidationService.invalidateSlackData(
                  context.userId,
                  action.context?.channel || context.data?.channel
                );
            }
            break;

          case 'ai':
            if (context.userId) {
              invalidatedCount =
                await CacheInvalidationService.invalidateAISummary(
                  context.userId,
                  action.context?.date || context.data?.date
                );
            }
            break;

          case 'api':
            if (action.context?.endpoint) {
              invalidatedCount =
                await CacheInvalidationService.invalidateAPICache(
                  action.context.endpoint,
                  ...(action.context.params || [])
                );
            }
            break;

          case 'smart':
            if (context.userId && action.context?.changeType) {
              invalidatedCount =
                await CacheInvalidationService.smartInvalidation(
                  action.context.changeType,
                  context.userId,
                  {
                    repository: context.data?.repository,
                    channel: context.data?.channel,
                    date: context.data?.date,
                    affectedUsers: context.data?.affectedUsers,
                  }
                );
            }
            break;

          case 'realtime':
            if (
              context.userId &&
              context.resourceId &&
              action.context?.updateType
            ) {
              invalidatedCount =
                await CacheInvalidationService.realtimeInvalidation(
                  action.context.updateType,
                  context.userId,
                  context.resourceId
                );
            }
            break;

          default:
            console.warn(
              `Unknown invalidation type: ${action.invalidationType}`
            );
        }

        totalInvalidated += invalidatedCount;
      } catch (error) {
        console.error(
          `Failed to execute trigger action ${action.invalidationType}:`,
          error
        );
      }
    }

    return totalInvalidated;
  }

  /**
   * Convenience methods for common events
   */

  static async onGitHubPush(
    userId: string,
    repository: string,
    commits: any[]
  ): Promise<number> {
    return this.processEvent('github.push', 'repository', {
      userId,
      resourceId: repository,
      data: { repository, commits },
    });
  }

  static async onSlackMessage(
    userId: string,
    channel: string,
    message: any
  ): Promise<number> {
    return this.processEvent('slack.message', 'channel', {
      userId,
      resourceId: channel,
      data: { channel, message },
    });
  }

  static async onAISummaryRegenerate(
    userId: string,
    date: string
  ): Promise<number> {
    return this.processEvent('ai.summary.regenerate', 'summary', {
      userId,
      resourceId: date,
      data: { date },
    });
  }

  static async onUserSettingsUpdate(
    userId: string,
    settings: any
  ): Promise<number> {
    return this.processEvent('user.settings.update', 'user', {
      userId,
      resourceId: userId,
      data: { settings },
    });
  }

  static async onIntegrationDisconnect(
    userId: string,
    integrationType: string
  ): Promise<number> {
    return this.processEvent('integration.disconnect', 'integration', {
      userId,
      resourceId: integrationType,
      data: { integrationType },
    });
  }
}

// Initialize triggers when module is loaded
CacheInvalidationTriggers.initialize();
