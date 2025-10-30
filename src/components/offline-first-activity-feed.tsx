'use client';

import { useState, useEffect } from 'react';
import { Activity } from '@/types/components';
import {
  IconBrandSlack,
  IconBrandGithub,
  IconBug,
  IconTag,
  IconGitCommit,
  IconLoader2,
  IconRefresh,
  IconWifi,
  IconWifiOff,
  IconClock,
  IconDatabase,
} from '@tabler/icons-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useNetworkStatusContext } from '@/contexts/network-status-context';
import { cn } from '@/lib/utils';

interface CachedActivityData {
  activities: Activity[];
  timestamp: number;
  source: 'network' | 'cache';
}

/**
 * Retrieve the appropriate icon based on the activity source and event type.
 *
 * The function checks the source of the activity, which can be 'github' or 'slack'.
 * For 'github', it further inspects the event type to return specific icons for commits, pull requests, or issues.
 * If the source is 'slack', it returns the corresponding Slack icon.
 * If the source is unrecognized, it defaults to returning the Git commit icon.
 *
 * @param activity - An object representing the activity, containing source and metadata.
 * @returns The icon associated with the specified activity.
 */
const getActivityIcon = (activity: Activity) => {
  if (activity.source === 'github') {
    const eventType = activity.metadata?.eventType;
    switch (eventType) {
      case 'commit':
        return IconGitCommit;
      case 'pull_request':
        return IconTag;
      case 'issue':
        return IconBug;
      default:
        return IconBrandGithub;
    }
  }

  if (activity.source === 'slack') {
    return IconBrandSlack;
  }

  switch (activity.source) {
    case 'slack':
      return IconBrandSlack;
    case 'github':
      return IconBrandGithub;
    default:
      return IconGitCommit;
  }
};

/**
 * Get the color associated with a specific activity based on its source and event type.
 *
 * The function checks the source of the activity, which can be 'github' or 'slack', and returns a corresponding color class.
 * For 'github', it further distinguishes between event types such as 'commit', 'pull_request', and 'issue' to return specific colors.
 * If the source is not recognized, a default color is returned.
 *
 * @param activity - An object representing the activity, which includes a source and optional metadata.
 * @returns A string representing the color class associated with the activity.
 */
const getActivityColor = (activity: Activity) => {
  if (activity.source === 'github') {
    const eventType = activity.metadata?.eventType;
    switch (eventType) {
      case 'commit':
        return 'text-green-600';
      case 'pull_request':
        return 'text-blue-600';
      case 'issue':
        return 'text-orange-600';
      default:
        return 'text-gray-900';
    }
  }

  if (activity.source === 'slack') {
    return 'text-purple-600';
  }

  switch (activity.source) {
    case 'slack':
      return 'text-purple-600';
    case 'github':
      return 'text-gray-900';
    default:
      return 'text-gray-600';
  }
};

/**
 * Formats a given timestamp into a human-readable string.
 *
 * The function checks if the provided timestamp is a Date object or a string,
 * converts it to a Date if necessary, and calculates the difference in hours
 * from the current time. Depending on the difference, it returns a string
 * indicating how long ago the timestamp was, using appropriate singular or
 * plural forms for hours and days.
 *
 * @param {Date | string} timestamp - The timestamp to format, which can be
 * either a Date object or a string representation of a date.
 */
const formatTimestamp = (timestamp: Date | string) => {
  const now = new Date();
  const timestampDate =
    timestamp instanceof Date ? timestamp : new Date(timestamp);
  const diffInHours = Math.floor(
    (now.getTime() - timestampDate.getTime()) / (1000 * 60 * 60)
  );

  if (diffInHours < 1) {
    return 'Just now';
  } else if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
  } else {
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} day${diffInDays === 1 ? '' : 's'} ago`;
  }
};

/**
 * Formats a cache timestamp into a human-readable string.
 *
 * This function calculates the difference between the current time and the provided timestamp in minutes.
 * Depending on the difference, it returns a string indicating whether the cache was updated recently,
 * or how many minutes or hours ago it was cached. The function handles three cases:
 * less than a minute, less than an hour, and more than an hour.
 *
 * @param timestamp - The timestamp to format, represented as a number.
 */
const formatCacheTimestamp = (timestamp: number) => {
  const now = Date.now();
  const diffInMinutes = Math.floor((now - timestamp) / (1000 * 60));

  if (diffInMinutes < 1) {
    return 'Just cached';
  } else if (diffInMinutes < 60) {
    return `Cached ${diffInMinutes}m ago`;
  } else {
    const diffInHours = Math.floor(diffInMinutes / 60);
    return `Cached ${diffInHours}h ago`;
  }
};

/**
 * Manages the offline-first activity feed, handling data loading and live updates.
 *
 * This function initializes state variables for managing activities, loading status, and network connectivity. It sets up effects to load activities from cache and network, connect to live updates, and handle refresh intervals. The function also manages the display of activities, including handling scroll events and refresh actions, while providing user feedback through toasts for errors and successes.
 *
 * @returns {JSX.Element} The rendered activity feed component.
 */
export function OfflineFirstActivityFeed() {
  const { toast } = useToast();
  const networkStatus = useNetworkStatusContext();
  const [cachedData, setCachedData] = useState<CachedActivityData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showTopFade, setShowTopFade] = useState(false);
  const [showBottomFade, setShowBottomFade] = useState(false);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(
    null
  );

  useEffect(() => {
    loadActivities();
    if (networkStatus.isOnline) {
      connectToLiveUpdates();

      // Set up auto-refresh every 60 seconds when online
      const interval = setInterval(() => {
        console.log('🔄 Auto-refreshing activities...');
        loadActivities();
      }, 60000);

      setRefreshInterval(interval);
    }

    return () => {
      // Clean up EventSource connection
      setEventSource(currentEventSource => {
        if (currentEventSource) {
          currentEventSource.close();
        }
        return null;
      });

      // Clean up refresh interval
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
      setRefreshInterval(null);
    };
  }, [networkStatus.isOnline]);

  // Load activities from cache first, then network if available
  /**
   * Load activities from cache or network.
   *
   * The function first attempts to load activities from the cache. If cached data is available, it sets the cached data and logs the source. If the network is online, it attempts to fetch fresh data from the API, updating the cached data accordingly. In case of a network error, it falls back to cached data if available. Errors during the loading process are caught and handled, displaying a toast notification if no cached data is present.
   *
   * @returns {Promise<void>} A promise that resolves when the loading process is complete.
   * @throws Error If the network request fails and no cached data is available.
   */
  const loadActivities = async () => {
    try {
      setIsLoading(true);

      // Try to load from cache first
      const cacheKey = 'unifiedhq-activities';
      const cachedResponse = await caches
        .open('unifiedhq-api-v1')
        .then(cache => cache.match(`/api/activities?cache=${cacheKey}`));

      if (cachedResponse) {
        const cachedJson = await cachedResponse.json();
        const cacheTimestamp = parseInt(
          cachedResponse.headers.get('sw-cached-at') || '0'
        );

        setCachedData({
          activities: cachedJson.activities || [],
          timestamp: cacheTimestamp,
          source: 'cache',
        });

        console.log('📦 Loaded activities from cache');
      }

      // If online, try to fetch fresh data
      if (networkStatus.isOnline) {
        try {
          const response = await fetch('/api/activities', {
            headers: {
              'Cache-Control': 'no-cache',
            },
          });

          if (response.ok) {
            const data = await response.json();
            setCachedData({
              activities: data.activities || [],
              timestamp: Date.now(),
              source: 'network',
            });
            console.log('🌐 Loaded fresh activities from network');
          }
        } catch (networkError) {
          console.log('🔌 Network request failed, using cached data');
          if (!cachedData) {
            throw networkError;
          }
        }
      }
    } catch (error) {
      console.error('Error loading activities:', error);
      if (!cachedData) {
        toast({
          title: 'Error',
          description: 'Failed to load activities. Please try again.',
          variant: 'destructive',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Establish a connection to live updates via Server-Sent Events (SSE).
   *
   * The function first checks the network status and cleans up any existing EventSource before creating a new one.
   * It handles various SSE events such as 'open', 'message', and 'error', processing incoming messages based on their type.
   * Additionally, it implements a timeout mechanism to handle connection delays and logs relevant information throughout the process.
   *
   * @returns {void}
   */
  const connectToLiveUpdates = () => {
    if (!networkStatus.isOnline) return;

    try {
      // Clean up existing EventSource before creating new one
      setEventSource(currentEventSource => {
        if (currentEventSource) {
          currentEventSource.close();
        }
        return null;
      });

      if (typeof EventSource === 'undefined') {
        console.error('❌ EventSource not supported in this browser');
        return;
      }

      console.log('🔄 Attempting to connect to SSE endpoint...');

      const es = new EventSource('/api/activities/live', {
        withCredentials: true,
      });
      setEventSource(es);

      es.onopen = () => {
        setIsLiveConnected(true);
        console.log('✅ Connected to live updates');
      };

      const connectionTimeout = setTimeout(() => {
        if (es.readyState === EventSource.CONNECTING) {
          console.error('❌ SSE connection timeout after 10 seconds');
          es.close();
          setIsLiveConnected(false);
        }
      }, 10000);

      es.addEventListener('open', () => {
        clearTimeout(connectionTimeout);
      });

      es.onmessage = event => {
        try {
          const data = JSON.parse(event.data);
          console.log('📨 SSE message received:', data.type);

          switch (data.type) {
            case 'connected':
              console.log('Live updates connected:', data.message);
              break;

            case 'error':
              console.error('SSE error:', data.message);
              es.close();
              setIsLiveConnected(false);
              break;

            case 'heartbeat':
              break;

            case 'activity_update':
              if (data.data.type === 'sync_completed') {
                loadActivities();
                toast({
                  title: 'Live Update',
                  description: data.data.message,
                });
              }
              break;
          }
        } catch (error) {
          console.error('Error parsing SSE message:', error);
        }
      };

      es.onerror = error => {
        clearTimeout(connectionTimeout);
        console.error('❌ SSE connection error:', error);
        setIsLiveConnected(false);
      };
    } catch (error) {
      console.error('Failed to connect to live updates:', error);
      setIsLiveConnected(false);
    }
  };

  /**
   * Handles the scroll event to show or hide fade indicators.
   */
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isAtTop = scrollTop === 0;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 5;

    setShowTopFade(!isAtTop);
    setShowBottomFade(!isAtBottom);
  };

  /**
   * Handles the refresh of activities by synchronizing with GitHub and Slack.
   *
   * This function sets the refreshing state, checks the network status, and triggers both GitHub and Slack syncs concurrently.
   * It processes the results of the sync operations, handling any errors that may arise, and displays appropriate toast notifications.
   * Finally, it attempts to refresh activities, using cached data if offline, and resets the refreshing state.
   *
   * @returns {Promise<void>} A promise that resolves when the refresh operation is complete.
   * @throws {Error} If an error occurs during the sync or while loading activities.
   */
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (networkStatus.isOnline) {
        // Trigger both GitHub and Slack sync
        const [githubResponse, slackResponse] = await Promise.allSettled([
          fetch('/api/integrations/github/sync', { method: 'POST' }),
          fetch('/api/integrations/slack/sync', { method: 'POST' }),
        ]);

        let hasError = false;
        let errorMessage = '';

        // Check GitHub sync result
        if (githubResponse.status === 'fulfilled') {
          if (!githubResponse.value.ok) {
            const errorData = await githubResponse.value.json();
            if (errorData.code === 'TOKEN_EXPIRED') {
              errorMessage += 'GitHub token expired. ';
            } else {
              errorMessage += `GitHub sync failed: ${errorData.error || 'Unknown error'}. `;
            }
            hasError = true;
          }
        } else {
          errorMessage += 'GitHub sync failed. ';
          hasError = true;
        }

        // Check Slack sync result
        if (slackResponse.status === 'fulfilled') {
          if (!slackResponse.value.ok) {
            const errorData = await slackResponse.value.json();
            if (errorData.code === 'TOKEN_EXPIRED') {
              errorMessage += 'Slack token expired. ';
            } else {
              errorMessage += `Slack sync failed: ${errorData.error || 'Unknown error'}. `;
            }
            hasError = true;
          }
        } else {
          errorMessage += 'Slack sync failed. ';
          hasError = true;
        }

        if (hasError) {
          toast({
            title: 'Sync Issues',
            description:
              errorMessage.trim() + ' Please check your integrations.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Success',
            description: 'Activities refreshed successfully',
          });
        }
      }

      // Refresh activities (will use cache if offline)
      await loadActivities();
    } catch (error) {
      toast({
        title: 'Error',
        description: networkStatus.isOffline
          ? 'Cannot refresh while offline. Showing cached data.'
          : 'Failed to refresh activities',
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading && !cachedData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <IconGitCommit className='size-5' />
            Recent Activity
          </CardTitle>
          <CardDescription>
            Latest updates from your connected integrations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='space-y-4'>
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className='flex items-start gap-3 p-3 rounded-lg border bg-card'
              >
                <Skeleton className='size-8 rounded-lg' />
                <div className='flex-1 space-y-2'>
                  <Skeleton className='h-4 w-3/4' />
                  <Skeleton className='h-3 w-1/2' />
                  <Skeleton className='h-3 w-1/4' />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const activities = cachedData?.activities || [];
  const isFromCache = cachedData?.source === 'cache';
  const cacheAge = cachedData?.timestamp
    ? Date.now() - cachedData.timestamp
    : 0;
  const isStale = cacheAge > 15 * 60 * 1000; // 15 minutes

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <div>
            <CardTitle className='flex items-center gap-2'>
              <IconGitCommit className='size-5' />
              Recent Activity
              {isFromCache && (
                <Badge
                  variant={isStale ? 'destructive' : 'secondary'}
                  className='text-xs'
                >
                  <IconDatabase className='size-3 mr-1' />
                  Cached
                </Badge>
              )}
            </CardTitle>
            <CardDescription className='flex items-center gap-2'>
              Latest updates from your connected integrations
              {isFromCache && cachedData?.timestamp && (
                <span
                  className={cn(
                    'text-xs',
                    isStale ? 'text-orange-600' : 'text-muted-foreground'
                  )}
                >
                  • {formatCacheTimestamp(cachedData.timestamp)}
                </span>
              )}
            </CardDescription>
          </div>
          <div className='flex items-center gap-2'>
            {/* Network status indicator */}
            <div className='flex items-center gap-1 text-xs text-muted-foreground'>
              {networkStatus.isOnline ? (
                <>
                  <IconWifi className='size-3 text-green-500' />
                  <span>{isLiveConnected ? 'Live' : 'Online'}</span>
                </>
              ) : (
                <>
                  <IconWifiOff className='size-3 text-red-500' />
                  <span>Offline</span>
                </>
              )}
            </div>
            <Button
              variant='outline'
              size='sm'
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <IconLoader2 className='size-4 mr-2 animate-spin' />
              ) : (
                <IconRefresh className='size-4 mr-2' />
              )}
              {networkStatus.isOffline ? 'Reload Cache' : 'Refresh'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Offline notice */}
        {networkStatus.isOffline && (
          <div className='mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg'>
            <div className='flex items-center gap-2 text-orange-800'>
              <IconWifiOff className='size-4' />
              <span className='text-sm font-medium'>
                You're offline - showing cached data
              </span>
            </div>
            {isStale && (
              <p className='text-xs text-orange-600 mt-1'>
                Data may be outdated. Connect to internet to refresh.
              </p>
            )}
          </div>
        )}

        {activities.length === 0 ? (
          <div className='text-center py-8'>
            <p className='text-muted-foreground mb-4'>
              {networkStatus.isOffline
                ? 'No cached activity available. Connect to internet to load activities.'
                : 'No activity found. Connect your integrations and select repositories to see activity here.'}
            </p>
            {networkStatus.isOnline && (
              <div className='flex gap-2 justify-center'>
                <Button
                  variant='outline'
                  onClick={() => (window.location.href = '/integrations')}
                >
                  Go to Integrations
                </Button>
                <Button
                  variant='outline'
                  onClick={() => (window.location.href = '/integrations')}
                >
                  Manage Repositories
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className='relative'>
            <div
              className='max-h-96 overflow-y-auto space-y-4 pr-2'
              onScroll={handleScroll}
            >
              {activities.map(activity => {
                const Icon = getActivityIcon(activity);
                const colorClass = getActivityColor(activity);
                const actor = activity.metadata?.actor;
                const payload = activity.metadata?.payload;

                /**
                 * Retrieve the external URL based on the activity source and payload.
                 *
                 * The function checks if the activity source is 'github' or 'slack' and retrieves the corresponding URL from the payload.
                 * For 'github', it prioritizes the commit, pull request, and issue URLs. For 'slack', it constructs a URL using the channel ID and message timestamp.
                 *
                 * @returns The external URL as a string or null if no URL is found.
                 */
                const getExternalUrl = () => {
                  if (activity.source === 'github' && payload) {
                    if (payload.commit?.url) return payload.commit.url;
                    if (payload.pull_request?.url)
                      return payload.pull_request.url;
                    if (payload.issue?.url) return payload.issue.url;
                  }
                  if (activity.source === 'slack' && payload) {
                    const channel = activity.metadata?.channel;
                    if (channel?.id && payload.message?.ts) {
                      return `https://app.slack.com/client/${channel.id}/${channel.id}/p${payload.message.ts.replace('.', '')}`;
                    }
                  }
                  return null;
                };

                const externalUrl = getExternalUrl();

                return (
                  <div
                    key={activity.id}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors',
                      isFromCache && 'border-l-4 border-l-blue-200'
                    )}
                  >
                    <div className={`p-2 rounded-lg bg-muted ${colorClass}`}>
                      <Icon className='size-4' />
                    </div>
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-center gap-2 mb-1'>
                        <h4 className='font-medium text-sm'>
                          {externalUrl && networkStatus.isOnline ? (
                            <a
                              href={externalUrl}
                              target='_blank'
                              rel='noopener noreferrer'
                              className='hover:underline text-blue-600 hover:text-blue-800'
                            >
                              {activity.title}
                            </a>
                          ) : (
                            <span
                              className={
                                networkStatus.isOffline
                                  ? 'text-muted-foreground'
                                  : ''
                              }
                            >
                              {activity.title}
                            </span>
                          )}
                        </h4>
                        <Badge variant='secondary' className='text-xs'>
                          {activity.source}
                        </Badge>
                        {isFromCache && (
                          <Badge variant='outline' className='text-xs'>
                            <IconClock className='size-3 mr-1' />
                            Cached
                          </Badge>
                        )}
                      </div>
                      {activity.description && (
                        <p className='text-sm text-muted-foreground mb-2'>
                          {activity.description}
                        </p>
                      )}
                      <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                        {actor && (
                          <>
                            <Avatar className='size-4'>
                              <AvatarImage src={actor.avatar_url} />
                              <AvatarFallback>
                                {actor.login?.charAt(0) ||
                                  actor.name?.charAt(0) ||
                                  '?'}
                              </AvatarFallback>
                            </Avatar>
                            <span>
                              {actor.display_login || actor.login || actor.name}
                            </span>
                            <span>•</span>
                          </>
                        )}
                        <span>{formatTimestamp(activity.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Gradient fade indicators */}
            {showTopFade && (
              <div className='absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-background to-transparent pointer-events-none' />
            )}
            {showBottomFade && (
              <div className='absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-background to-transparent pointer-events-none' />
            )}
          </div>
        )}

        <div className='mt-6 pt-4 border-t'>
          <p className='text-sm text-muted-foreground text-center mb-4'>
            {networkStatus.isOffline
              ? 'Connect to internet to manage integrations and sync new data'
              : 'Connect more integrations to see activity from all your tools'}
          </p>
          <Button
            variant='outline'
            className='w-full'
            onClick={() => (window.location.href = '/integrations')}
            disabled={networkStatus.isOffline}
          >
            Manage Integrations
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
