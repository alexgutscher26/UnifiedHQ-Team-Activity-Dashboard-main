import { useState, useEffect } from 'react';
import { StatsData, ConnectionState } from '@/types/components';
import {
  IconBrandGithub,
  IconBrandSlack,
  IconSparkles,
  IconWifi,
} from '@tabler/icons-react';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { LoadingSkeleton } from '@/components/ui/loading';
import {
  useMemoryLeakPrevention,
  useSafeTimer,
} from '@/lib/memory-leak-prevention';

/**
 * Renders the SectionCards component that displays real-time statistics from GitHub and Slack.
 *
 * This component manages its own state for loading status, connection state, and fetched statistics.
 * It fetches GitHub and Slack statistics asynchronously, updates the state accordingly, and connects to live updates
 * for real-time data. The component also implements memory leak prevention and periodic refresh of statistics.
 *
 * @returns {JSX.Element} The rendered SectionCards component.
 */
export function SectionCards() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>('connecting');

  // Memory leak prevention
  useMemoryLeakPrevention('SectionCards');
  const { setTimeout, clearTimeout } = useSafeTimer();

  /**
   * Load and set statistics from GitHub and Slack APIs.
   *
   * The function fetches statistics from the GitHub and Slack APIs, handling both successful and failed responses.
   * It sets the statistics data, including integration details and a summary of activities, while ensuring that
   * loading state is managed appropriately. The function also ensures that default values are provided in case of
   * missing data from the API responses.
   *
   * @returns {Promise<void>} A promise that resolves when the statistics have been loaded and set.
   */
  const loadStats = async () => {
    try {
      // Fetch real GitHub statistics
      const githubResponse = await fetch('/api/github/stats');
      const githubStats = githubResponse.ok
        ? await githubResponse.json()
        : {
            count: 0,
            status: 'Inactive',
            details: 'No activity',
            lastUpdate: 'No recent activity',
          };

      // Fetch real Slack statistics
      const slackResponse = await fetch('/api/slack/stats');
      const slackStats = slackResponse.ok
        ? await slackResponse.json()
        : {
            count: 0,
            status: 'Inactive',
            details: 'No activity',
            lastUpdate: 'No recent activity',
          };

      // Fetch AI summary statistics
      const aiSummaryResponse = await fetch('/api/ai-summary/stats');
      const aiSummaryStats = aiSummaryResponse.ok
        ? await aiSummaryResponse.json()
        : {
            count: 0,
            status: 'Inactive',
            details: 'No summaries generated',
            lastUpdate: 'No recent activity',
            breakdown: {
              totalActivities: 0,
              averageActivities: 0,
              activeRepositories: 0,
              summariesGenerated: 0,
            },
          };

      // Set stats data
      setStats({
        integrations: {
          github: {
            repositories: githubStats.count || 0,
            pullRequests: githubStats.breakdown?.pullRequests || 0,
            commits: githubStats.breakdown?.commits || 0,
            issues: githubStats.breakdown?.reviews || 0, // Using reviews as issues for now
            lastActivity: githubStats.lastUpdate || 'No recent activity',
          },
          slack: {
            channels:
              slackStats.channels?.selected ||
              slackStats.breakdown?.channels ||
              0,
            messages: slackStats.count || 0,
            mentions: slackStats.breakdown?.reactions || 0, // Using reactions as mentions for now
            lastActivity: slackStats.lastUpdate || 'No recent activity',
          },
        },
        summary: {
          totalActivities: aiSummaryStats.breakdown?.totalActivities || 0,
          activeRepositories: aiSummaryStats.breakdown?.activeRepositories || 0,
          pendingReviews: githubStats.breakdown?.reviews || 0,
          urgentItems: 0,
          summaryCount: aiSummaryStats.count || 0,
        },
        lastUpdated: aiSummaryStats.lastUpdate || new Date().toISOString(),
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Connect to live updates for real-time GitHub stats
  const connectToLiveUpdates = (retryCount = 0) => {
    try {
      setConnectionState('connecting');

      const es = new EventSource('/api/activities/live', {
        withCredentials: true,
      });
      setEventSource(es);

      es.onopen = () => {
        console.log('✅ SectionCards connected to live updates');
        setConnectionState('connected');
      };

      es.onmessage = event => {
        try {
          const data = JSON.parse(event.data);

          // Handle different message types
          if (data.type === 'connected') {
            console.log('📡 SSE connection established');
            setConnectionState('connected');
          } else if (data.type === 'heartbeat') {
            // Silently handle heartbeats
            return;
          } else if (
            data.type === 'activity_update' &&
            data.data?.type === 'sync_completed'
          ) {
            // Refresh stats when sync is completed (GitHub or Slack)
            console.log('🔄 Refreshing stats after sync:', data.data);
            loadStats();
          } else if (data.type === 'error') {
            console.warn('⚠️ SSE error message:', data.message);
            setConnectionState('error');
            // Don't treat error messages as connection failures
          }
        } catch (error) {
          console.error('Error parsing SSE message in SectionCards:', error);
        }
      };

      es.onerror = error => {
        // More detailed error logging
        console.warn('⚠️ SectionCards SSE connection issue:', {
          readyState: es.readyState,
          url: es.url,
          error: error,
          retryCount,
        });

        setConnectionState('disconnected');

        // Only log as error if it's a critical failure
        if (es.readyState === EventSource.CLOSED) {
          console.error('❌ SectionCards SSE connection closed');

          // Retry connection after a delay (max 3 retries)
          if (retryCount < 3) {
            console.log(
              `🔄 Retrying SSE connection (attempt ${retryCount + 1}/3)`
            );
            setTimeout(
              () => {
                connectToLiveUpdates(retryCount + 1);
              },
              Math.pow(2, retryCount) * 1000
            ); // Exponential backoff: 1s, 2s, 4s
          } else {
            console.error('❌ Max SSE retry attempts reached');
            setConnectionState('error');
          }
        }
      };
    } catch (error) {
      console.error('Failed to create SSE connection in SectionCards:', error);
      setConnectionState('error');
    }
  };

  useEffect(() => {
    loadStats();
    connectToLiveUpdates();

    // Set up periodic refresh every 2 minutes for all stats (GitHub and Slack)
    const interval = setTimeout(() => {
      console.log('🔄 Periodic stats refresh (GitHub and Slack)');
      loadStats();
    }, 120000); // 2 minutes

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (interval) {
        clearTimeout(interval);
      }
    };
  }, []);

  const LoadingCard = () => (
    <Card className='@container/card'>
      <CardHeader>
        <CardDescription className='flex items-center gap-2'>
          <LoadingSkeleton className='h-4 w-4' />
          <LoadingSkeleton className='h-4 w-20' />
        </CardDescription>
        <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
          <LoadingSkeleton className='h-8 w-12' />
        </CardTitle>
        <CardAction>
          <LoadingSkeleton className='h-6 w-16' />
        </CardAction>
      </CardHeader>
      <CardFooter className='flex-col items-start gap-1.5 text-sm'>
        <LoadingSkeleton className='h-4 w-32' />
        <LoadingSkeleton className='h-3 w-24' />
      </CardFooter>
    </Card>
  );

  return (
    <div className='*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4'>
      {isLoading ? (
        <>
          <LoadingCard />
          <LoadingCard />
          <LoadingCard />
          <LoadingCard />
        </>
      ) : (
        stats && (
          <>
            <Card className='@container/card'>
              <CardHeader>
                <CardDescription className='flex items-center gap-2'>
                  <IconBrandSlack className='size-4' />
                  Slack Messages
                  {connectionState === 'connected' && (
                    <IconWifi
                      className='size-3 text-green-500'
                      title='Live updates active'
                    />
                  )}
                  {connectionState === 'connecting' && (
                    <div
                      className='size-3 animate-spin rounded-full border-2 border-blue-500 border-t-transparent'
                      title='Connecting...'
                    />
                  )}
                  {connectionState === 'error' && (
                    <div
                      className='size-3 rounded-full bg-red-500'
                      title='Connection failed'
                    />
                  )}
                </CardDescription>
                <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
                  {stats.integrations.slack.messages}
                </CardTitle>
                <CardAction>
                  <Badge variant='outline' className='bg-background'>
                    Active
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardFooter className='flex-col items-start gap-1.5 text-sm'>
                <div className='line-clamp-1 font-medium'>
                  {stats.integrations.slack.channels} channels
                </div>
                <div className='text-muted-foreground'>
                  Last message {stats.integrations.slack.lastActivity}
                </div>
              </CardFooter>
            </Card>
            <Card className='@container/card'>
              <CardHeader>
                <CardDescription className='flex items-center gap-2'>
                  <IconBrandGithub className='size-4' />
                  GitHub Activity
                  {connectionState === 'connected' && (
                    <IconWifi
                      className='size-3 text-green-500'
                      title='Live updates active'
                    />
                  )}
                  {connectionState === 'connecting' && (
                    <div
                      className='size-3 animate-spin rounded-full border-2 border-blue-500 border-t-transparent'
                      title='Connecting...'
                    />
                  )}
                  {connectionState === 'error' && (
                    <div
                      className='size-3 rounded-full bg-red-500'
                      title='Connection failed'
                    />
                  )}
                </CardDescription>
                <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
                  {stats.integrations.github.repositories}
                </CardTitle>
                <CardAction>
                  <Badge variant='outline' className='bg-background'>
                    Active
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardFooter className='flex-col items-start gap-1.5 text-sm'>
                <div className='line-clamp-1 font-medium'>
                  {stats.integrations.github.commits} commits
                </div>
                <div className='text-muted-foreground'>
                  Last commit {stats.integrations.github.lastActivity}
                </div>
              </CardFooter>
            </Card>
            <Card className='@container/card'>
              <CardHeader>
                <CardDescription className='flex items-center gap-2'>
                  <IconSparkles className='size-4' />
                  AI Summary
                </CardDescription>
                <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
                  {stats.summary.summaryCount}
                </CardTitle>
                <CardAction>
                  <Badge variant='outline' className='bg-background'>
                    Total
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardFooter className='flex-col items-start gap-1.5 text-sm'>
                <div className='line-clamp-1 font-medium'>
                  {stats.summary.activeRepositories} active repos
                </div>
                <div className='text-muted-foreground'>
                  Updated {new Date(stats.lastUpdated).toLocaleTimeString()}
                </div>
              </CardFooter>
            </Card>
          </>
        )
      )}
    </div>
  );
}
