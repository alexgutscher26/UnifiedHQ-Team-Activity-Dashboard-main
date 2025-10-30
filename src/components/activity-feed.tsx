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

// Activity interface is now imported from types/components.ts

/**
 * Determines the appropriate icon component to display for an activity based on its source and type.
 *
 * @param activity - The activity object containing source and metadata information
 * @returns The corresponding Tabler icon component for the activity
 *
 * @example
 * ```tsx
 * const Icon = getActivityIcon(activity);
 * return <Icon className="size-4" />;
 * ```
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
 * Determines the appropriate color class for an activity based on its source and event type.
 *
 * @param activity - The activity object containing source and metadata information
 * @returns A Tailwind CSS color class string for styling the activity icon
 *
 * @example
 * ```tsx
 * const colorClass = getActivityColor(activity);
 * return <div className={`p-2 rounded-lg ${colorClass}`}>
 * ```
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
 * Formats a timestamp into a human-readable relative time string.
 *
 * @param timestamp - The timestamp to format, either as a Date object or ISO string
 * @returns A formatted string like "Just now", "2 hours ago", or "3 days ago"
 *
 * @example
 * ```tsx
 * formatTimestamp(new Date()) // "Just now"
 * formatTimestamp("2024-01-01T10:00:00Z") // "2 hours ago"
 * ```
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
 * ActivityFeed component displays a real-time feed of team activities from connected integrations.
 *
 * Features:
 * - Real-time updates via EventSource/SSE connection
 * - Manual refresh with sync capabilities for GitHub and Slack
 * - Scroll-based fade effects for better UX
 * - Live connection status indicator
 * - External links to original activities
 * - Auto-refresh every 60 seconds
 *
 * The component automatically connects to live updates on mount and handles cleanup
 * of EventSource connections and intervals to prevent memory leaks.
 *
 * @returns JSX element containing the activity feed card with header, content, and controls
 *
 * @example
 * ```tsx
 * import { ActivityFeed } from '@/components/activity-feed';
 *
 * export default function Dashboard() {
 *   return (
 *     <div className="grid gap-6">
 *       <ActivityFeed />
 *     </div>
 *   );
 * }
 * ```
 */
export function ActivityFeed() {
  const { toast } = useToast();
  const [activities, setActivities] = useState<Activity[]>([]);
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
    fetchActivities();
    connectToLiveUpdates();

    // Set up auto-refresh every 60 seconds
    const interval = setInterval(() => {
      console.log('🔄 Auto-refreshing activities...');
      fetchActivities();
    }, 60000); // 60 seconds

    setRefreshInterval(interval);

    return () => {
      // Clean up EventSource connection
      setEventSource(currentEventSource => {
        if (currentEventSource) {
          currentEventSource.close();
        }
        return null;
      });

      // Clean up refresh interval
      if (interval) {
        clearInterval(interval);
      }
      setRefreshInterval(null);
    };
  }, []);

  useEffect(() => {
    // Initialize fade states when activities change
    if (activities.length > 0) {
      setShowBottomFade(true); // Show bottom fade initially if there are activities
    }
  }, [activities]);

  /**
   * Establishes a Server-Sent Events (SSE) connection for real-time activity updates.
   *
   * Handles:
   * - EventSource connection management with cleanup
   * - Connection timeout and error handling
   * - Message parsing for different event types (connected, error, heartbeat, activity_update)
   * - Toast notifications for connection status and errors
   * - Automatic activity refresh on sync completion events
   *
   * The connection includes credentials and implements a 10-second timeout for initial connection.
   * On successful connection, it listens for various message types and updates the UI accordingly.
   */
  const connectToLiveUpdates = () => {
    try {
      // Clean up existing EventSource before creating new one
      setEventSource(currentEventSource => {
        if (currentEventSource) {
          currentEventSource.close();
        }
        return null;
      });

      // Test if EventSource is supported
      if (typeof EventSource === 'undefined') {
        console.error('❌ EventSource not supported in this browser');
        toast({
          title: 'Browser Not Supported',
          description: 'Your browser does not support live updates.',
          variant: 'destructive',
        });
        return;
      }

      console.log('🔄 Attempting to connect to SSE endpoint...');

      // Create EventSource with credentials
      const es = new EventSource('/api/activities/live', {
        withCredentials: true,
      });
      setEventSource(es);

      es.onopen = () => {
        setIsLiveConnected(true);
        console.log('✅ Connected to live updates');
      };

      // Add connection timeout
      const connectionTimeout = setTimeout(() => {
        if (es.readyState === EventSource.CONNECTING) {
          console.error('❌ SSE connection timeout after 10 seconds');
          es.close();
          setIsLiveConnected(false);
          toast({
            title: 'Connection Timeout',
            description:
              'Failed to connect to live updates. Please check your connection.',
            variant: 'destructive',
          });
        }
      }, 10000); // 10 second timeout

      // Clear timeout on successful connection
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
              toast({
                title: 'Connection Error',
                description: data.message,
                variant: 'destructive',
              });
              es.close();
              setIsLiveConnected(false);
              break;

            case 'heartbeat':
              // Keep connection alive
              break;

            case 'activity_update':
              if (data.data.type === 'sync_completed') {
                // Refresh activities when sync is completed (GitHub or Slack)
                fetchActivities();
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
        // Clear connection timeout
        clearTimeout(connectionTimeout);

        // EventSource.onerror provides limited error information
        // Log connection state and URL for better debugging
        console.error('❌ SSE connection error:', {
          readyState: es.readyState,
          url: es.url,
          withCredentials: es.withCredentials,
          error: error,
          timestamp: new Date().toISOString(),
        });

        setIsLiveConnected(false);

        // Don't auto-reconnect on error, let user manually refresh
        toast({
          title: 'Connection Lost',
          description: 'Live updates disconnected. Please refresh the page.',
          variant: 'destructive',
        });
      };
    } catch (error) {
      console.error('Failed to connect to live updates:', error);
      setIsLiveConnected(false);
    }
  };

  /**
   * Fetches the latest activities from the API endpoint.
   *
   * Makes a GET request to `/api/activities` and updates the activities state.
   * Handles errors gracefully by logging them and always sets loading to false.
   *
   * @async
   * @returns Promise that resolves when the fetch operation completes
   */
  const fetchActivities = async () => {
    try {
      const response = await fetch('/api/activities');
      if (response.ok) {
        const data = await response.json();
        setActivities(data.activities || []);
      } else {
        // Handle different error status codes
        if (response.status === 401) {
          console.warn('User not authenticated - activities unavailable');
          setActivities([]); // Set empty array for unauthenticated users
        } else if (response.status === 500) {
          console.error('Server error fetching activities');
          setActivities([]);
        } else {
          console.error(
            `Failed to fetch activities: ${response.status} ${response.statusText}`
          );
          setActivities([]);
        }
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
      setActivities([]); // Ensure activities is always an array
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handles scroll events to manage fade effect visibility at top and bottom of the activity list.
   *
   * Calculates scroll position and updates fade states to show/hide gradient overlays
   * that indicate more content is available above or below the current view.
   *
   * @param e - React scroll event containing scroll position information
   */
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isAtTop = scrollTop === 0;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 5;

    setShowTopFade(!isAtTop);
    setShowBottomFade(!isAtBottom);
  };

  /**
   * Handles manual refresh of activities by triggering sync operations for connected integrations.
   *
   * Performs the following operations:
   * 1. Triggers GitHub and Slack sync operations in parallel
   * 2. Checks sync results and handles token expiration errors
   * 3. Refreshes the activity list after sync completion
   * 4. Shows appropriate toast notifications for success/error states
   *
   * @async
   * @returns Promise that resolves when all sync operations and activity refresh complete
   */
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
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

      // Refresh activities after sync
      await fetchActivities();

      if (hasError) {
        toast({
          title: 'Sync Issues',
          description: errorMessage.trim() + ' Please check your integrations.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Success',
          description: 'Activities refreshed successfully',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to refresh activities',
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
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

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <div>
            <CardTitle className='flex items-center gap-2'>
              <IconGitCommit className='size-5' />
              Recent Activity
            </CardTitle>
            <CardDescription>
              Latest updates from your connected integrations
            </CardDescription>
          </div>
          <div className='flex items-center gap-2'>
            {/* Live connection indicator */}
            <div className='flex items-center gap-1 text-xs text-muted-foreground'>
              {isLiveConnected ? (
                <>
                  <IconWifi className='size-3 text-green-500' />
                  <span>Live</span>
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
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className='text-center py-8'>
            <p className='text-muted-foreground mb-4'>
              No activity found. Connect your integrations and select
              repositories to see activity here.
            </p>
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
                 * Constructs the external URL for an activity to link to the original source.
                 *
                 * For GitHub activities, links to commits, pull requests, or issues.
                 * For Slack activities, constructs deep links to specific messages.
                 *
                 * @returns The external URL string or null if no URL can be constructed
                 */
                const getExternalUrl = () => {
                  if (activity.source === 'github' && payload) {
                    if (payload.commit?.url) return payload.commit.url;
                    if (payload.pull_request?.url)
                      return payload.pull_request.url;
                    if (payload.issue?.url) return payload.issue.url;
                  }
                  if (activity.source === 'slack' && payload) {
                    // Construct Slack message URL
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
                    className='flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors'
                  >
                    <div className={`p-2 rounded-lg bg-muted ${colorClass}`}>
                      <Icon className='size-4' />
                    </div>
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-center gap-2 mb-1'>
                        <h4 className='font-medium text-sm'>
                          {externalUrl ? (
                            <a
                              href={externalUrl}
                              target='_blank'
                              rel='noopener noreferrer'
                              className='hover:underline text-blue-600 hover:text-blue-800'
                            >
                              {activity.title}
                            </a>
                          ) : (
                            activity.title
                          )}
                        </h4>
                        <Badge variant='secondary' className='text-xs'>
                          {activity.source}
                        </Badge>
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
            Connect more integrations to see activity from all your tools
          </p>
          <Button
            variant='outline'
            className='w-full'
            onClick={() => (window.location.href = '/integrations')}
          >
            Manage Integrations
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
