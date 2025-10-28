'use client';

import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import * as ReactWindow from 'react-window';
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
  IconSearch,
  IconFilter,
  IconChevronDown,
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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  useScrollPerformanceMonitor,
  scrollOptimizationPresets,
} from '@/hooks/use-scroll-optimization';

// Memoized activity icon component
const ActivityIcon = memo(({ activity }: { activity: Activity }) => {
  if (activity.source === 'github') {
    const eventType = activity.metadata?.eventType;
    switch (eventType) {
      case 'commit':
        return <IconGitCommit className='size-4' />;
      case 'pull_request':
        return <IconTag className='size-4' />;
      case 'issue':
        return <IconBug className='size-4' />;
      default:
        return <IconBrandGithub className='size-4' />;
    }
  }

  switch (activity.source) {
    case 'slack':
      return <IconBrandSlack className='size-4' />;
    case 'github':
      return <IconBrandGithub className='size-4' />;
    default:
      return <IconGitCommit className='size-4' />;
  }
});

ActivityIcon.displayName = 'ActivityIcon';

// Memoized activity color component
const ActivityColor = memo(({ activity }: { activity: Activity }) => {
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

  switch (activity.source) {
    case 'slack':
      return 'text-purple-600';
    case 'github':
      return 'text-gray-900';
    default:
      return 'text-gray-600';
  }
});

ActivityColor.displayName = 'ActivityColor';

// Memoized timestamp formatter
const formatTimestamp = memo((timestamp: Date | string) => {
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
});

formatTimestamp.displayName = 'FormatTimestamp';

// Individual activity item component
const ActivityItem = memo(
  ({
    activity,
    style,
  }: {
    activity: Activity;
    style?: React.CSSProperties;
  }) => {
    const colorClass = ActivityColor({ activity });
    const actor = activity.metadata?.actor;
    const payload = activity.metadata?.payload;

    // Get the GitHub URL for the activity
    const getGitHubUrl = useCallback(() => {
      if (activity.source === 'github' && payload) {
        if (payload.commit?.url) return payload.commit.url;
        if (payload.pull_request?.url) return payload.pull_request.url;
        if (payload.issue?.url) return payload.issue.url;
      }
      return null;
    }, [activity.source, payload]);

    const githubUrl = getGitHubUrl();

    return (
      <div
        style={style}
        className='flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors'
      >
        <div className={`p-2 rounded-lg bg-muted ${colorClass}`}>
          <ActivityIcon activity={activity} />
        </div>
        <div className='flex-1 min-w-0'>
          <div className='flex items-center gap-2 mb-1'>
            <h4 className='font-medium text-sm'>
              {githubUrl ? (
                <a
                  href={githubUrl}
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
                    {actor.login?.charAt(0) || '?'}
                  </AvatarFallback>
                </Avatar>
                <span>{actor.display_login || actor.login}</span>
                <span>•</span>
              </>
            )}
            <span>{formatTimestamp(activity.timestamp)}</span>
          </div>
        </div>
      </div>
    );
  }
);

ActivityItem.displayName = 'ActivityItem';

// Virtualized list item renderer
const VirtualizedActivityItem = memo(
  ({
    index,
    style,
    data,
  }: {
    index: number;
    style: React.CSSProperties;
    data: Activity[];
  }) => {
    const activity = data[index];
    return <ActivityItem activity={activity} style={style} />;
  }
);

VirtualizedActivityItem.displayName = 'VirtualizedActivityItem';

// Debounce hook for search
const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// Performance monitoring hook
const usePerformanceMonitor = () => {
  const [metrics, setMetrics] = useState({
    renderTime: 0,
    itemCount: 0,
    lastUpdate: new Date(),
  });

  const measureRender = useCallback((itemCount: number, renderTime: number) => {
    setMetrics({
      renderTime,
      itemCount,
      lastUpdate: new Date(),
    });
  }, []);

  return { metrics, measureRender };
};

/**
 * Renders an optimized activity feed with live updates and filtering capabilities.
 *
 * This component manages the state of activities, loading status, and filters for searching and pagination.
 * It connects to a live updates endpoint using EventSource, handles auto-refreshing of activities,
 * and provides performance monitoring. The component also includes debounced search functionality and
 * pagination for displaying activities efficiently.
 *
 * @returns {JSX.Element} The rendered activity feed component.
 */
export function OptimizedActivityFeed() {
  const { toast } = useToast();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(
    null
  );

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [filterEventType, setFilterEventType] = useState<string>('all');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Performance monitoring
  const { metrics, measureRender } = usePerformanceMonitor();

  // Scroll performance monitoring
  const { metrics: scrollMetrics, handleScroll } = useScrollPerformanceMonitor(
    scrollOptimizationPresets.monitoring
  );

  // Debounced search
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Filtered and searched activities
  const filteredActivities = useMemo(() => {
    let filtered = activities;

    // Apply search filter
    if (debouncedSearchQuery) {
      filtered = filtered.filter(
        activity =>
          activity.title
            .toLowerCase()
            .includes(debouncedSearchQuery.toLowerCase()) ||
          activity.description
            ?.toLowerCase()
            .includes(debouncedSearchQuery.toLowerCase()) ||
          activity.metadata?.actor?.login
            ?.toLowerCase()
            .includes(debouncedSearchQuery.toLowerCase())
      );
    }

    // Apply source filter
    if (filterSource !== 'all') {
      filtered = filtered.filter(activity => activity.source === filterSource);
    }

    // Apply event type filter
    if (filterEventType !== 'all') {
      filtered = filtered.filter(
        activity => activity.metadata?.eventType === filterEventType
      );
    }

    return filtered;
  }, [activities, debouncedSearchQuery, filterSource, filterEventType]);

  // Paginated activities
  const paginatedActivities = useMemo(() => {
    const itemsPerPage = 50;
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredActivities.slice(0, startIndex + itemsPerPage);
  }, [filteredActivities, currentPage]);

  // Unique sources for filter dropdown
  const uniqueSources = useMemo(() => {
    return Array.from(new Set(activities.map(a => a.source)));
  }, [activities]);

  // Unique event types for filter dropdown
  const uniqueEventTypes = useMemo(() => {
    return Array.from(
      new Set(activities.map(a => a.metadata?.eventType).filter(Boolean))
    );
  }, [activities]);

  useEffect(() => {
    fetchActivities();
    connectToLiveUpdates();

    // Set up auto-refresh every 60 seconds
    const interval = setInterval(() => {
      console.log('🔄 Auto-refreshing activities...');
      fetchActivities();
    }, 60000);

    setRefreshInterval(interval);

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (interval) {
        clearInterval(interval);
      }
    };
  }, []);

  const connectToLiveUpdates = useCallback(() => {
    try {
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
  }, [toast]);

  const fetchActivities = useCallback(
    async (page = 1, append = false) => {
      try {
        const startTime = performance.now();

        const response = await fetch(`/api/activities?page=${page}&limit=50`);
        if (response.ok) {
          const data = await response.json();

          if (append) {
            setActivities(prev => [...prev, ...(data.activities || [])]);
          } else {
            setActivities(data.activities || []);
          }

          setHasMore(data.hasMore || false);

          const endTime = performance.now();
          measureRender(data.activities?.length || 0, endTime - startTime);
        } else {
          console.error('Failed to fetch activities');
        }
      } catch (error) {
        console.error('Error fetching activities:', error);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [measureRender]
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const syncResponse = await fetch('/api/integrations/github/sync', {
        method: 'POST',
      });

      if (syncResponse.ok) {
        await fetchActivities();
        toast({
          title: 'Success',
          description: 'Activities refreshed successfully',
        });
      } else {
        const errorData = await syncResponse.json();
        if (errorData.code === 'TOKEN_EXPIRED') {
          toast({
            title: 'GitHub Token Expired',
            description:
              'Please reconnect your GitHub account in Settings > Integrations',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Error',
            description: errorData.error || 'Failed to refresh activities',
            variant: 'destructive',
          });
        }
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
  }, [fetchActivities, toast]);

  const loadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      setIsLoadingMore(true);
      setCurrentPage(prev => prev + 1);
      fetchActivities(currentPage + 1, true);
    }
  }, [isLoadingMore, hasMore, currentPage, fetchActivities]);

  const resetFilters = useCallback(() => {
    setSearchQuery('');
    setFilterSource('all');
    setFilterEventType('all');
    setCurrentPage(1);
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
              {filteredActivities.length !== activities.length && (
                <Badge variant='outline' className='text-xs'>
                  {filteredActivities.length} of {activities.length}
                </Badge>
              )}
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
        {/* Search and Filter Controls */}
        <div className='mb-4 space-y-3'>
          <div className='flex gap-2'>
            <div className='relative flex-1'>
              <IconSearch className='absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-muted-foreground' />
              <Input
                placeholder='Search activities...'
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className='pl-10'
              />
            </div>
            <Select value={filterSource} onValueChange={setFilterSource}>
              <SelectTrigger className='w-32'>
                <SelectValue placeholder='Source' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Sources</SelectItem>
                {uniqueSources.map(source => (
                  <SelectItem key={source} value={source}>
                    {source}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterEventType} onValueChange={setFilterEventType}>
              <SelectTrigger className='w-32'>
                <SelectValue placeholder='Type' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Types</SelectItem>
                {uniqueEventTypes.map(eventType => (
                  <SelectItem key={eventType} value={eventType!}>
                    {eventType}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant='outline'
              size='sm'
              onClick={resetFilters}
              disabled={
                searchQuery === '' &&
                filterSource === 'all' &&
                filterEventType === 'all'
              }
            >
              <IconFilter className='size-4 mr-1' />
              Reset
            </Button>
          </div>

          {/* Performance Metrics */}
          <div className='text-xs text-muted-foreground flex gap-4'>
            <span>Items: {paginatedActivities.length}</span>
            <span>Render: {metrics.renderTime.toFixed(2)}ms</span>
            <span>Scroll: {scrollMetrics.averageScrollTime.toFixed(2)}ms</span>
            <span>Jank: {scrollMetrics.scrollJank}</span>
            <span>Last Update: {metrics.lastUpdate.toLocaleTimeString()}</span>
          </div>
        </div>

        {paginatedActivities.length === 0 ? (
          <div className='text-center py-8'>
            <p className='text-muted-foreground mb-4'>
              {activities.length === 0
                ? 'No activity found. Connect your integrations and select repositories to see activity here.'
                : 'No activities match your current filters.'}
            </p>
            {activities.length === 0 ? (
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
            ) : (
              <Button variant='outline' onClick={resetFilters}>
                Clear Filters
              </Button>
            )}
          </div>
        ) : (
          <div className='space-y-4'>
            {/* Virtualized List for Large Datasets */}
            {paginatedActivities.length > 20 ? (
              <div className='border rounded-lg'>
                {(ReactWindow.List as any)({
                  height: 400,
                  itemCount: paginatedActivities.length,
                  itemSize: 120,
                  itemData: paginatedActivities,
                  overscanCount: 5,
                  onScroll: (e: React.UIEvent<HTMLDivElement>) =>
                    handleScroll(e.nativeEvent),
                  children: VirtualizedActivityItem,
                })}
              </div>
            ) : (
              /* Regular List for Small Datasets */
              <div className='space-y-4'>
                {paginatedActivities.map(activity => (
                  <ActivityItem key={activity.id} activity={activity} />
                ))}
              </div>
            )}

            {/* Load More Button */}
            {hasMore && (
              <div className='text-center pt-4'>
                <Button
                  variant='outline'
                  onClick={loadMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? (
                    <>
                      <IconLoader2 className='size-4 mr-2 animate-spin' />
                      Loading...
                    </>
                  ) : (
                    <>
                      <IconChevronDown className='size-4 mr-2' />
                      Load More
                    </>
                  )}
                </Button>
              </div>
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
