/**
 * Cache Warming Utilities
 * 
 * This module provides utilities to trigger cache warming for various scenarios
 * like user login, integration connections, and scheduled maintenance.
 */

import { CacheWarmer } from '@/middleware/cache-middleware';

export interface CacheWarmingOptions {
  userId?: string;
  authToken?: string;
  background?: boolean;
}

/**
 * Warm cache after user login
 */
export async function warmCacheOnLogin(userId: string, authToken?: string): Promise<void> {
  try {
    console.log(`🔥 Warming cache for user login: ${userId}`);

    // Warm user-specific cache in background
    if (authToken) {
      // Don't await - run in background
      CacheWarmer.warmUserCache(userId, authToken).catch(error => {
        console.error('Background cache warming failed:', error);
      });
    }
  } catch (error) {
    console.error('Cache warming on login failed:', error);
  }
}

/**
 * Warm cache after integration connection
 */
export async function warmCacheOnIntegrationConnect(
  userId: string,
  integration: 'github' | 'slack',
  authToken?: string
): Promise<void> {
  try {
    console.log(`🔥 Warming cache for ${integration} integration: ${userId}`);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const headers: Record<string, string> = {};
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    let endpoints: Array<{ url: string; headers?: Record<string, string> }> = [];

    if (integration === 'github') {
      endpoints = [
        { url: `${baseUrl}/api/integrations/github/repositories`, headers },
        { url: `${baseUrl}/api/integrations/github/sync`, headers },
      ];
    } else if (integration === 'slack') {
      endpoints = [
        { url: `${baseUrl}/api/integrations/slack/channels`, headers },
        { url: `${baseUrl}/api/integrations/slack/sync`, headers },
      ];
    }

    // Warm integration-specific endpoints
    await CacheWarmer.warmEndpoints(endpoints);

    // Also warm general activity cache
    await CacheWarmer.warmEndpoints([
      { url: `${baseUrl}/api/activities`, headers },
      { url: `${baseUrl}/api/ai-summary?timeRange=24h&limit=1`, headers },
    ]);

  } catch (error) {
    console.error(`Cache warming for ${integration} integration failed:`, error);
  }
}

/**
 * Warm cache for dashboard on page load
 */
export async function warmCacheOnDashboardLoad(authToken?: string): Promise<void> {
  try {
    console.log('🔥 Warming dashboard cache on page load');

    // Run in background - don't block page load
    CacheWarmer.warmDashboardCache(authToken).catch(error => {
      console.error('Background dashboard cache warming failed:', error);
    });
  } catch (error) {
    console.error('Dashboard cache warming failed:', error);
  }
}

/**
 * Scheduled cache warming (for cron jobs)
 */
export async function scheduledCacheWarming(): Promise<void> {
  try {
    console.log('🔥 Running scheduled cache warming');

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Warm public endpoints that don't require authentication
    const publicEndpoints = [
      { url: `${baseUrl}/api/health` },
      { url: `${baseUrl}/api/integrations/slack/client-id` },
    ];

    await CacheWarmer.warmEndpoints(publicEndpoints);

    console.log('✅ Scheduled cache warming completed');
  } catch (error) {
    console.error('Scheduled cache warming failed:', error);
  }
}

/**
 * Warm cache with retry logic
 */
export async function warmCacheWithRetry(
  warmingFunction: () => Promise<void>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<void> {
  let attempts = 0;

  while (attempts < maxRetries) {
    try {
      await warmingFunction();
      return; // Success
    } catch (error) {
      attempts++;
      console.warn(`Cache warming attempt ${attempts} failed:`, error);

      if (attempts >= maxRetries) {
        console.error('Cache warming failed after all retries:', error);
        throw error;
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delay * attempts));
    }
  }
}

/**
 * Utility to trigger cache warming via API call
 */
export async function triggerCacheWarmingAPI(
  type: 'user' | 'dashboard' | 'all' = 'user',
  authToken?: string
): Promise<boolean> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const response = await fetch(`${baseUrl}/api/cache/warm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
      },
      body: JSON.stringify({ type, authToken }),
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Cache warming API call successful:', result.message);
      return true;
    } else {
      console.error('❌ Cache warming API call failed:', response.status, response.statusText);
      return false;
    }
  } catch (error) {
    console.error('❌ Cache warming API call error:', error);
    return false;
  }
}