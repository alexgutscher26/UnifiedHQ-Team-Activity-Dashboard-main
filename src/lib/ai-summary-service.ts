/**
 * AI Summary Service using OpenRouter
 * Provides intelligent summarization of team activity data with Redis caching
 */

import { Activity } from '@/types/components';
import { generateWithOpenRouter } from '@/lib/openrouter-client';
import { RedisCache, CacheKeyGenerator, TTLManager } from '@/lib/redis';

export interface AISummaryData {
  activities: Activity[];
  timeRange: {
    start: Date;
    end: Date;
  };
  teamContext?: {
    repositories: string[];
    channels: string[];
    teamSize: number;
  };
}

export interface AISummary {
  id: string;
  userId: string;
  title: string;
  keyHighlights: string[];
  actionItems: string[];
  insights: string[];
  generatedAt: Date;
  timeRange: {
    start: Date;
    end: Date;
  };
  metadata: {
    activityCount: number;
    sourceBreakdown: Record<string, number>;
    activeRepositories: number;
    activeChannels: number;
    model: string;
    tokensUsed: number;
  };
}

export class AISummaryService {
  private static readonly DEFAULT_MODEL = 'openai/gpt-4o-mini';
  private static readonly MAX_TOKENS = 2000;
  private static readonly TEMPERATURE = 0.7;
  private static readonly CACHE_TTL = TTLManager.getTTL('AI_SUMMARY'); // 1 hour

  /**
   * Generate AI summary from team activity data with caching
   */
  static async generateSummary(
    userId: string,
    data: AISummaryData,
    options: { forceRegenerate?: boolean; useCache?: boolean } = {}
  ): Promise<AISummary> {
    const { forceRegenerate = false, useCache = true } = options;

    try {
      // Generate cache key based on user, time range, and activity data
      const cacheKey = this.generateCacheKey(userId, data);

      // Try to get cached summary if not forcing regeneration
      if (useCache && !forceRegenerate) {
        const cachedSummary = await RedisCache.get<AISummary>(cacheKey);
        if (cachedSummary) {
          console.log(`📋 Using cached AI summary for user ${userId}`);
          return cachedSummary;
        }
      }

      console.log(`🤖 Generating new AI summary for user ${userId}`);
      const prompt = this.buildPrompt(data);

      // Use clean OpenRouter client
      const response = await generateWithOpenRouter({
        model: this.DEFAULT_MODEL,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(),
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: this.TEMPERATURE,
        maxTokens: this.MAX_TOKENS,
      });

      // Handle both streaming and non-streaming responses
      if (!('choices' in response)) {
        throw new Error('Streaming responses not supported in this method');
      }

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content received from AI model');
      }

      const parsedSummary = this.parseSummaryResponse(content);

      const aiSummary: AISummary = {
        id: `summary_${userId}_${Date.now()}`,
        userId,
        title: parsedSummary.title || 'Daily Team Summary',
        keyHighlights: parsedSummary.keyHighlights || [],
        actionItems: parsedSummary.actionItems || [],
        insights: parsedSummary.insights || [],
        generatedAt: new Date(),
        timeRange: data.timeRange,
        metadata: {
          activityCount: data.activities.length,
          sourceBreakdown: this.getSourceBreakdown(data.activities),
          activeRepositories: data.teamContext?.repositories.length || 0,
          activeChannels: data.teamContext?.channels.length || 0,
          model: this.DEFAULT_MODEL,
          tokensUsed: response.usage?.total_tokens || 0,
        },
      };

      // Cache the generated summary
      if (useCache) {
        await RedisCache.set(cacheKey, aiSummary, this.CACHE_TTL);
        console.log(`💾 Cached AI summary for user ${userId}`);
      }

      return aiSummary;
    } catch (error) {
      console.error('Error generating AI summary:', error);
      throw new Error('Failed to generate AI summary');
    }
  }

  /**
   * Build the prompt for AI summarization
   */
  private static buildPrompt(data: AISummaryData): string {
    const activitiesText = data.activities
      .map(activity => {
        const timestamp = new Date(activity.timestamp).toLocaleString();
        const source = activity.source.toUpperCase();
        const title = activity.title;
        const description = activity.description
          ? ` - ${activity.description}`
          : '';

        return `[${timestamp}] ${source}: ${title}${description}`;
      })
      .join('\n');

    const teamContext = data.teamContext
      ? `
Team Context:
- Repositories: ${data.teamContext.repositories.join(', ')}
- Channels: ${data.teamContext.channels.join(', ')}
- Team Size: ${data.teamContext.teamSize} members
`
      : '';

    return `
Please analyze the following team activity data and provide a comprehensive summary.

${teamContext}

Activity Data (${data.activities.length} activities from ${data.timeRange.start.toLocaleDateString()} to ${data.timeRange.end.toLocaleDateString()}):

${activitiesText}

Please provide a structured summary with:
1. Key Highlights (4-5 most important accomplishments or events)
2. Action Items (2-3 tasks that need attention or follow-up)
3. Additional Insights (any patterns, trends, or notable observations)

Format your response as JSON with the following structure:
{
  "title": "Brief summary title",
  "keyHighlights": ["highlight 1", "highlight 2", "highlight 3", "highlight 4"],
  "actionItems": ["action 1", "action 2", "action 3"],
  "insights": ["insight 1", "insight 2"]
}
`;
  }

  /**
   * Get system prompt for AI model
   */
  private static getSystemPrompt(): string {
    return `You are an AI assistant specialized in analyzing team activity data from GitHub and Slack. Your role is to provide intelligent, actionable summaries that help teams understand their productivity patterns and identify important events.

Key guidelines:
- Focus on actionable insights and important events
- Identify patterns and trends in team activity
- Highlight accomplishments and achievements
- Flag items that need attention or follow-up
- Keep summaries concise but comprehensive
- Use professional, clear language
- Prioritize the most impactful activities

Always respond with valid JSON format as requested.`;
  }

  /**
   * Parse the AI response into structured data
   */
  private static parseSummaryResponse(content: string): {
    title: string;
    keyHighlights: string[];
    actionItems: string[];
    insights: string[];
  } {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          title: parsed.title || 'Team Activity Summary',
          keyHighlights: Array.isArray(parsed.keyHighlights)
            ? parsed.keyHighlights
            : [],
          actionItems: Array.isArray(parsed.actionItems)
            ? parsed.actionItems
            : [],
          insights: Array.isArray(parsed.insights) ? parsed.insights : [],
        };
      }
    } catch (error) {
      console.warn('Failed to parse AI response as JSON:', error);
    }

    // Fallback: parse text-based response
    return this.parseTextResponse(content);
  }

  /**
   * Parse a text-based response to extract structured information.
   *
   * This function processes the input string by splitting it into lines and categorizing the content into key highlights, action items, and insights based on specific keywords. It uses a loop to identify sections and collects relevant items, ensuring that only a limited number of each type is returned for brevity.
   *
   * @param content - A string containing the text-based response to be parsed.
   * @returns An object containing the title, key highlights, action items, and insights extracted from the input content.
   */
  private static parseTextResponse(content: string): {
    title: string;
    keyHighlights: string[];
    actionItems: string[];
    insights: string[];
  } {
    const lines = content.split('\n').filter(line => line.trim());

    const keyHighlights: string[] = [];
    const actionItems: string[] = [];
    const insights: string[] = [];

    let currentSection = '';

    for (const line of lines) {
      const lowerLine = line.toLowerCase();

      if (
        lowerLine.includes('key highlights') ||
        lowerLine.includes('highlights')
      ) {
        currentSection = 'highlights';
        continue;
      } else if (
        lowerLine.includes('action items') ||
        lowerLine.includes('actions')
      ) {
        currentSection = 'actions';
        continue;
      } else if (
        lowerLine.includes('insights') ||
        lowerLine.includes('observations')
      ) {
        currentSection = 'insights';
        continue;
      }

      if (
        line.startsWith('-') ||
        line.startsWith('•') ||
        line.match(/^\d+\./)
      ) {
        const item = line.replace(/^[-•\d.\s]+/u, '').trim();
        if (item) {
          switch (currentSection) {
            case 'highlights':
              keyHighlights.push(item);
              break;
            case 'actions':
              actionItems.push(item);
              break;
            case 'insights':
              insights.push(item);
              break;
          }
        }
      }
    }

    return {
      title: 'Team Activity Summary',
      keyHighlights: keyHighlights.slice(0, 5),
      actionItems: actionItems.slice(0, 3),
      insights: insights.slice(0, 3),
    };
  }

  /**
   * Get source breakdown statistics
   */
  private static getSourceBreakdown(
    activities: Activity[]
  ): Record<string, number> {
    const breakdown: Record<string, number> = {};

    for (const activity of activities) {
      breakdown[activity.source] = (breakdown[activity.source] || 0) + 1;
    }

    return breakdown;
  }

  /**
   * Validate API key and connection
   */
  static async validateConnection(): Promise<boolean> {
    try {
      if (!process.env.OPENROUTER_API_KEY) {
        return false;
      }

      // Check if it's a placeholder key
      if (process.env.OPENROUTER_API_KEY.includes('your-actual-api-key-here')) {
        console.log('🔧 OpenRouter API key is placeholder - using mock AI for development');
        return false;
      }

      const response = await generateWithOpenRouter({
        model: this.DEFAULT_MODEL,
        messages: [{ role: 'user', content: 'Hello' }],
        maxTokens: 10,
      });

      // Handle both streaming and non-streaming responses
      if ('choices' in response) {
        return Boolean(response.choices[0]?.message?.content);
      } else {
        return false; // Streaming responses not supported for validation
      }
    } catch (error) {
      console.error('OpenRouter connection validation failed:', error);
      return false;
    }
  }

  /**
   * Generate cache key for AI summary based on user and data characteristics
   */
  private static generateCacheKey(userId: string, data: AISummaryData): string {
    // Create a hash of the activity data to ensure cache invalidation when data changes
    const activityHash = this.hashActivityData(data);
    const timeRangeKey = `${data.timeRange.start.getTime()}-${data.timeRange.end.getTime()}`;

    return CacheKeyGenerator.aiSummary(
      userId,
      'summary',
      timeRangeKey,
      activityHash
    );
  }

  /**
   * Create a hash of activity data for cache key generation
   */
  private static hashActivityData(data: AISummaryData): string {
    const activityIds = data.activities
      .map(a => a.id)
      .sort()
      .join(',');
    const contextHash = JSON.stringify({
      repos: data.teamContext?.repositories.sort(),
      channels: data.teamContext?.channels.sort(),
      count: data.activities.length,
    });

    // Simple hash function for cache key
    return Buffer.from(activityIds + contextHash)
      .toString('base64')
      .slice(0, 16);
  }

  /**
   * Invalidate cached summaries for a user
   */
  static async invalidateUserCache(userId: string): Promise<void> {
    try {
      const pattern = CacheKeyGenerator.aiSummary(userId, '*');
      const deletedCount = await RedisCache.deleteByPattern(pattern);
      console.log(
        `🗑️ Invalidated ${deletedCount} cached AI summaries for user ${userId}`
      );
    } catch (error) {
      console.error('Error invalidating user AI summary cache:', error);
    }
  }

  /**
   * Invalidate all AI summary caches
   */
  static async invalidateAllCache(): Promise<void> {
    try {
      const pattern = CacheKeyGenerator.aiSummary('*', '*');
      const deletedCount = await RedisCache.deleteByPattern(pattern);
      console.log(`🗑️ Invalidated ${deletedCount} cached AI summaries`);
    } catch (error) {
      console.error('Error invalidating all AI summary cache:', error);
    }
  }

  /**
   * Warm cache for scheduled summary generation
   */
  static async warmCacheForUsers(userIds: string[]): Promise<void> {
    console.log(`🔥 Warming AI summary cache for ${userIds.length} users`);

    for (const userId of userIds) {
      try {
        // TODO: This would typically be called before scheduled generation
        // to pre-populate cache with user activity data
        const cacheKey = CacheKeyGenerator.user(userId, 'activity_data');

        // Check if we already have cached activity data
        const cachedData = await RedisCache.get(cacheKey);
        if (!cachedData) {
          console.log(`🔥 Pre-warming activity data cache for user ${userId}`);
          // todo: The actual activity data would be fetched and cached here
          // This is a placeholder for the warming logic
        }
      } catch (error) {
        console.error(`Error warming cache for user ${userId}:`, error);
      }
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  static async getCacheStats(): Promise<{
    totalKeys: number;
    userCaches: Record<string, number>;
  }> {
    try {
      const pattern = CacheKeyGenerator.aiSummary('*', '*');
      const keys = await RedisCache.getKeysByPattern(pattern);

      const userCaches: Record<string, number> = {};

      for (const key of keys) {
        // Extract user ID from cache key
        const parts = key.split(':');
        if (parts.length >= 3) {
          const userId = parts[2];
          userCaches[userId] = (userCaches[userId] || 0) + 1;
        }
      }

      return {
        totalKeys: keys.length,
        userCaches,
      };
    } catch (error) {
      console.error('Error getting AI summary cache stats:', error);
      return { totalKeys: 0, userCaches: {} };
    }
  }

  /**
   * Get available models (for future use)
   */
  static async getAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch models');
      }

      const data = await response.json();
      return data.data?.map((model: any) => model.id) || [];
    } catch (error) {
      console.error('Error fetching available models:', error);
      return [this.DEFAULT_MODEL];
    }
  }
}
