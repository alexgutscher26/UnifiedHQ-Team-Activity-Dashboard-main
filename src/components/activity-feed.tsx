'use client';

import { useState, useEffect, useRef } from 'react';
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
  return activity.source === 'slack' ? IconBrandSlack : IconGitCommit;
};

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
  return activity.source === 'slack' ? 'text-purple-600' : 'text-gray-600';
};

const formatTimestamp = (timestamp: Date | string) => {
  const now = new Date();
  const timestampDate = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const diffInHours = Math.floor((now.getTime() - timestampDate.getTime()) / (1000 * 60 * 60));

  if (diffInHours < 1) return 'Just now';
  if (diffInHours < 24) return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;

  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays} day${diffInDays === 1 ? '' : 's'} ago`;
};

export function ActivityFeed() {
  const { toast } = useToast();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLiveConnected, setIsLiveConnected] = useState(false);

  // Use refs to store timer IDs and EventSource
  const refreshIntervalRef = useRef<number | null>(null);
  const sseTimeoutRef = useRef<number | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchActivities = async () => {
    try {
      const response = await fetch('/api/activities');
      if (response.ok) {
        const data = await response.json();
        setActivities(data.activities || []);
      } else {
        console.warn('Failed to fetch activities:', response.status);
        setActivities([]);
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
      setActivities([]);
    } finally {
      setIsLoading(false);
    }
  };

  const connectToLiveUpdates = () => {
    try {
      // Clean up existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      if (typeof EventSource === 'undefined') {
        console.warn('EventSource not supported');
        return;
      }

      const es = new EventSource('/api/activities/live', { withCredentials: true });
      eventSourceRef.current = es;

      es.onopen = () => {
        setIsLiveConnected(true);
        console.log('✅ Connected to live updates');
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'activity_update' && data.data.type === 'sync_completed') {
            fetchActivities();
            toast({
              title: 'Live Update',
              description: data.data.message,
            });
          }
        } catch (error) {
          console.error('Error parsing SSE message:', error);
        }
      };

      es.onerror = () => {
        setIsLiveConnected(false);
        console.warn('SSE connection error');
      };

      // Connection timeout
      const timeoutId = window.setTimeout(() => {
        if (es.readyState === EventSource.CONNECTING) {
          es.close();
          setIsLiveConnected(false);
        }
      }, 15000);

      return () => {
        window.clearTimeout(timeoutId);
      };
    } catch (error) {
      console.error('Failed to connect to live updates:', error);
      setIsLiveConnected(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const [githubResponse, slackResponse] = await Promise.allSettled([
        fetch('/api/integrations/github/sync', { method: 'POST' }),
        fetch('/api/integrations/slack/sync', { method: 'POST' }),
      ]);

      let hasError = false;
      let errorMessage = '';

      if (githubResponse.status === 'fulfilled' && !githubResponse.value.ok) {
        errorMessage += 'GitHub sync failed. ';
        hasError = true;
      }

      if (slackResponse.status === 'fulfilled' && !slackResponse.value.ok) {
        errorMessage += 'Slack sync failed. ';
        hasError = true;
      }

      await fetchActivities();

      if (hasError) {
        toast({
          title: 'Sync Issues',
          description: errorMessage.trim(),
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

  // Initial load and setup
  useEffect(() => {
    fetchActivities();

    // Setup SSE connection after delay
    sseTimeoutRef.current = window.setTimeout(() => {
      connectToLiveUpdates();
    }, 3000);

    // Setup auto-refresh
    refreshIntervalRef.current = window.setInterval(() => {
      console.log('🔄 Auto-refreshing activities...');
      fetchActivities();
    }, 60000);

    // Cleanup function
    return () => {
      if (sseTimeoutRef.current) {
        window.clearTimeout(sseTimeoutRef.current);
      }
      if (refreshIntervalRef.current) {
        window.clearInterval(refreshIntervalRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

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
              <div key={i} className='flex items-start gap-3 p-3 rounded-lg border bg-card'>
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
              No activity found. Connect your integrations and select repositories to see activity here.
            </p>
            <div className='flex gap-2 justify-center'>
              <Button
                variant='outline'
                onClick={() => (window.location.href = '/integrations')}
              >
                Go to Integrations
              </Button>
            </div>
          </div>
        ) : (
          <div className='max-h-96 overflow-y-auto space-y-4 pr-2'>
            {activities.map((activity) => {
              const Icon = getActivityIcon(activity);
              const colorClass = getActivityColor(activity);
              const actor = activity.metadata?.actor;
              const payload = activity.metadata?.payload;

              const getExternalUrl = () => {
                if (activity.source === 'github' && payload) {
                  if (payload.commit?.url) return payload.commit.url;
                  if (payload.pull_request?.url) return payload.pull_request.url;
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
                            {activity.title || 'Untitled Activity'}
                          </a>
                        ) : (
                          activity.title || 'Untitled Activity'
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
                              {actor.login?.charAt(0) || actor.name?.charAt(0) || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <span>{actor.display_login || actor.login || actor.name}</span>
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