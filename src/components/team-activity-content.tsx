'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  IconUsers,
  IconGitCommit,
  IconGitPullRequest,
  IconBug,
  IconClock,
  IconSearch,
  IconFilter,
  IconRefresh,
  IconEye,
  IconDownload,
  IconSortAscending,
  IconSortDescending,
  IconActivity,
  IconCode,
  IconMessageCircle,
  IconAlertCircle,
} from '@tabler/icons-react';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: string;
  status: 'active' | 'away' | 'offline';
  lastActive: string;
  commits: number;
  pullRequests: number;
  issues: number;
  reviews: number;
}

interface TeamActivity {
  id: string;
  type: 'commit' | 'pull_request' | 'issue' | 'review' | 'comment';
  title: string;
  description?: string;
  author: TeamMember;
  repository: string;
  timestamp: string;
  status?: 'open' | 'closed' | 'merged' | 'draft';
  url?: string;
  metadata?: Record<string, unknown>;
}

interface TeamStats {
  totalMembers: number;
  activeMembers: number;
  totalCommits: number;
  totalPullRequests: number;
  totalIssues: number;
  totalReviews: number;
  averageActivityPerDay: number;
  topContributors: TeamMember[];
  activityTrends: Array<{
    date: string;
    commits: number;
    pullRequests: number;
    issues: number;
    reviews: number;
  }>;
  repositoryStats: Array<{
    name: string;
    commits: number;
    pullRequests: number;
    issues: number;
    contributors: number;
  }>;
}

interface TeamActivityContentProps {
  className?: string;
}

export function TeamActivityContent({ className }: TeamActivityContentProps) {
  const [activities, setActivities] = useState<TeamActivity[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [stats, setStats] = useState<TeamStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [activityType, setActivityType] = useState<
    'all' | 'commits' | 'pull_requests' | 'issues' | 'reviews'
  >('all');
  const [sortBy, setSortBy] = useState<'timestamp' | 'author' | 'repository'>(
    'timestamp'
  );
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedMember, setSelectedMember] = useState<string>('all');
  const { toast } = useToast();

  useEffect(() => {
    fetchTeamData();
  }, [timeRange]);

  // Debug: Log when activities state changes
  useEffect(() => {
    console.log(
      '[Team Activity Component] Activities state changed:',
      activities.length
    );
    if (activities.length > 0) {
      console.log('[Team Activity Component] Sample activity:', activities[0]);
    }
  }, [activities]);

  const fetchTeamData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [activitiesRes, membersRes, statsRes] = await Promise.all([
        fetch(`/api/team-activity?timeRange=${timeRange}`, {
          credentials: 'include',
        }),
        fetch('/api/team-members', {
          credentials: 'include',
        }),
        fetch(`/api/team-stats?timeRange=${timeRange}`, {
          credentials: 'include',
        }),
      ]);

      console.log('[Team Activity Component] API Response Status:', {
        activities: activitiesRes.status,
        members: membersRes.status,
        stats: statsRes.status,
      });

      if (!activitiesRes.ok || !membersRes.ok || !statsRes.ok) {
        console.error('[Team Activity Component] API Response Error:', {
          activities: activitiesRes.status,
          members: membersRes.status,
          stats: statsRes.status,
        });
        throw new Error(
          `Failed to fetch team data: ${activitiesRes.status} ${membersRes.status} ${statsRes.status}`
        );
      }

      const [activitiesData, membersData, statsData] = await Promise.all([
        activitiesRes.json(),
        membersRes.json(),
        statsRes.json(),
      ]);

      console.log('[Team Activity Component] JSON Parsing Complete');

      console.log('[Team Activity Component] Activities data:', {
        success: activitiesData.success,
        dataLength: activitiesData.data?.length || 0,
        message: activitiesData.message,
        sample: activitiesData.data?.[0] || 'No data',
      });
      console.log('[Team Activity Component] Members data:', {
        success: membersData.success,
        dataLength: membersData.data?.length || 0,
      });
      console.log('[Team Activity Component] Stats data:', {
        success: statsData.success,
        hasData: !!statsData.data,
      });

      const activitiesArray = activitiesData.data || [];
      console.log(
        '[Team Activity Component] Setting activities:',
        activitiesArray.length
      );

      setActivities(activitiesArray);
      setTeamMembers(membersData.data || []);
      setStats(statsData.data || null);

      // Show helpful messages if provided
      if (activitiesData.message) {
        toast({
          title: 'GitHub Integration',
          description: activitiesData.message,
          variant: 'default',
        });
      }
      if (statsData.message) {
        toast({
          title: 'GitHub Integration',
          description: statsData.message,
          variant: 'default',
        });
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch team data';
      console.error('[Team Activity Component] Error fetching data:', err);
      console.error('[Team Activity Component] Error message:', errorMessage);
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredActivities = useMemo(() => {
    let filtered = activities;

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(
        activity =>
          activity.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          activity.description
            ?.toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          activity.author.name
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          activity.repository.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by activity type
    if (activityType !== 'all') {
      filtered = filtered.filter(activity => {
        switch (activityType) {
          case 'commits':
            return activity.type === 'commit';
          case 'pull_requests':
            return activity.type === 'pull_request';
          case 'issues':
            return activity.type === 'issue';
          case 'reviews':
            return activity.type === 'review';
          default:
            return true;
        }
      });
    }

    // Filter by selected member
    if (selectedMember !== 'all') {
      filtered = filtered.filter(
        activity => activity.author.id === selectedMember
      );
    }

    // Sort activities
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'timestamp':
          comparison =
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
          break;
        case 'author':
          comparison = a.author.name.localeCompare(b.author.name);
          break;
        case 'repository':
          comparison = a.repository.localeCompare(b.repository);
          break;
        default:
          comparison = 0;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [
    activities,
    searchQuery,
    activityType,
    selectedMember,
    sortBy,
    sortOrder,
  ]);

  const handleRefresh = useCallback(async () => {
    await fetchTeamData();
    toast({
      title: 'Refreshed',
      description: 'Team activity data has been updated',
    });
  }, [fetchTeamData, toast]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'commit':
        return IconGitCommit;
      case 'pull_request':
        return IconGitPullRequest;
      case 'issue':
        return IconBug;
      case 'review':
        return IconEye;
      case 'comment':
        return IconMessageCircle;
      default:
        return IconActivity;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'commit':
        return 'text-green-600';
      case 'pull_request':
        return 'text-blue-600';
      case 'issue':
        return 'text-orange-600';
      case 'review':
        return 'text-yellow-600';
      case 'comment':
        return 'text-gray-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusBadge = (status?: string) => {
    if (!status) return null;

    const statusConfig = {
      open: {
        variant: 'default' as const,
        className:
          'bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30',
      },
      closed: {
        variant: 'secondary' as const,
        className: 'bg-muted text-muted-foreground',
      },
      merged: {
        variant: 'default' as const,
        className:
          'bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30',
      },
      draft: {
        variant: 'outline' as const,
        className:
          'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30',
      },
    };

    const config =
      statusConfig[status as keyof typeof statusConfig] || statusConfig.closed;

    return (
      <Badge variant={config.variant} className={config.className}>
        {status}
      </Badge>
    );
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    );

    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className={`space-y-6 p-6 ${className}`}>
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='text-2xl font-bold text-foreground'>
              Team Activity
            </h1>
            <p className='text-muted-foreground'>
              Monitor your team's development activity
            </p>
          </div>
          <Skeleton className='h-10 w-32' />
        </div>

        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className='bg-card border-border'>
              <CardContent className='p-6'>
                <Skeleton className='h-4 w-20 mb-2' />
                <Skeleton className='h-8 w-16' />
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className='bg-card border-border'>
          <CardContent className='p-6'>
            <Skeleton className='h-96 w-full' />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`space-y-6 p-6 ${className}`}>
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='text-2xl font-bold text-foreground'>
              Team Activity
            </h1>
            <p className='text-muted-foreground'>
              Monitor your team's development activity
            </p>
          </div>
        </div>

        <Card className='bg-card border-border'>
          <CardContent className='p-6 text-center'>
            <IconAlertCircle className='h-12 w-12 text-destructive mx-auto mb-4' />
            <h3 className='text-lg font-semibold text-foreground mb-2'>
              Failed to load team data
            </h3>
            <p className='text-muted-foreground mb-4'>{error}</p>
            <Button onClick={handleRefresh} variant='outline'>
              <IconRefresh className='h-4 w-4 mr-2' />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={`space-y-6 p-6 ${className}`}>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-foreground'>Team Activity</h1>
          <p className='text-muted-foreground'>
            Monitor your team's development activity
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <Button onClick={handleRefresh} variant='outline' size='sm'>
            <IconRefresh className='h-4 w-4 mr-2' />
            Refresh
          </Button>
          <Button variant='outline' size='sm'>
            <IconDownload className='h-4 w-4 mr-2' />
            Export
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
          <Card className='bg-card border-border'>
            <CardContent className='p-6'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-sm font-medium text-muted-foreground'>
                    Team Members
                  </p>
                  <p className='text-2xl font-bold text-foreground'>
                    {stats.totalMembers}
                  </p>
                  <p className='text-xs text-green-600 dark:text-green-400'>
                    {stats.activeMembers} active
                  </p>
                </div>
                <IconUsers className='h-8 w-8 text-primary' />
              </div>
            </CardContent>
          </Card>

          <Card className='bg-card border-border'>
            <CardContent className='p-6'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-sm font-medium text-muted-foreground'>
                    Total Commits
                  </p>
                  <p className='text-2xl font-bold text-foreground'>
                    {stats.totalCommits.toLocaleString()}
                  </p>
                  <p className='text-xs text-green-600 dark:text-green-400'>
                    +{stats.averageActivityPerDay}/day
                  </p>
                </div>
                <IconGitCommit className='h-8 w-8 text-green-600 dark:text-green-400' />
              </div>
            </CardContent>
          </Card>

          <Card className='bg-card border-border'>
            <CardContent className='p-6'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-sm font-medium text-muted-foreground'>
                    Pull Requests
                  </p>
                  <p className='text-2xl font-bold text-foreground'>
                    {stats.totalPullRequests.toLocaleString()}
                  </p>
                  <p className='text-xs text-blue-600 dark:text-blue-400'>
                    Reviews: {stats.totalReviews}
                  </p>
                </div>
                <IconGitPullRequest className='h-8 w-8 text-blue-600 dark:text-blue-400' />
              </div>
            </CardContent>
          </Card>

          <Card className='bg-card border-border'>
            <CardContent className='p-6'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-sm font-medium text-muted-foreground'>
                    Issues
                  </p>
                  <p className='text-2xl font-bold text-foreground'>
                    {stats.totalIssues.toLocaleString()}
                  </p>
                  <p className='text-xs text-muted-foreground'>
                    All repositories
                  </p>
                </div>
                <IconBug className='h-8 w-8 text-red-600 dark:text-red-400' />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and Search */}
      <Card className='bg-card border-border'>
        <CardContent className='p-6'>
          <div className='flex flex-col sm:flex-row gap-4'>
            <div className='flex-1'>
              <div className='relative'>
                <IconSearch className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground' />
                <Input
                  placeholder='Search activities, members, or repositories...'
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className='pl-10'
                />
              </div>
            </div>
            <div className='flex gap-2'>
              <Select
                value={timeRange}
                onValueChange={(value: '7d' | '30d' | '90d') =>
                  setTimeRange(value)
                }
              >
                <SelectTrigger className='w-32'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='7d'>Last 7 days</SelectItem>
                  <SelectItem value='30d'>Last 30 days</SelectItem>
                  <SelectItem value='90d'>Last 90 days</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={activityType}
                onValueChange={(value: any) => setActivityType(value)}
              >
                <SelectTrigger className='w-40'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All Activities</SelectItem>
                  <SelectItem value='commits'>Commits</SelectItem>
                  <SelectItem value='pull_requests'>Pull Requests</SelectItem>
                  <SelectItem value='issues'>Issues</SelectItem>
                  <SelectItem value='reviews'>Reviews</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedMember} onValueChange={setSelectedMember}>
                <SelectTrigger className='w-40'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All Members</SelectItem>
                  {teamMembers.map(member => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant='outline' size='sm'>
                    <IconFilter className='h-4 w-4 mr-2' />
                    Sort
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setSortBy('timestamp')}>
                    <IconClock className='h-4 w-4 mr-2' />
                    By Time
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy('author')}>
                    <IconUsers className='h-4 w-4 mr-2' />
                    By Author
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy('repository')}>
                    <IconCode className='h-4 w-4 mr-2' />
                    By Repository
                  </DropdownMenuItem>
                  <Separator />
                  <DropdownMenuItem onClick={() => setSortOrder('desc')}>
                    <IconSortDescending className='h-4 w-4 mr-2' />
                    Descending
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortOrder('asc')}>
                    <IconSortAscending className='h-4 w-4 mr-2' />
                    Ascending
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Tabs defaultValue='activity' className='space-y-4'>
        <TabsList>
          <TabsTrigger value='activity'>Activity Feed</TabsTrigger>
          <TabsTrigger value='members'>Team Members</TabsTrigger>
          <TabsTrigger value='repositories'>Repositories</TabsTrigger>
        </TabsList>

        <TabsContent value='activity' className='space-y-4'>
          <Card className='bg-card border-border'>
            <CardHeader>
              <CardTitle className='text-foreground'>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className='p-0'>
              <ScrollArea className='h-96'>
                <div className='space-y-4 p-6'>
                  {filteredActivities.length === 0 ? (
                    <div className='text-center py-8'>
                      <IconActivity className='h-12 w-12 text-muted-foreground mx-auto mb-4' />
                      <h3 className='text-lg font-semibold text-foreground mb-2'>
                        No activities found
                      </h3>
                      <p className='text-muted-foreground mb-4'>
                        {activities.length === 0
                          ? 'No repositories selected for tracking. Please select repositories in the integrations page to see your team activity here.'
                          : 'Try adjusting your filters or time range'}
                      </p>
                      {activities.length === 0 && (
                        <div className='flex flex-col gap-2'>
                          <Button variant='outline' asChild>
                            <a
                              href='/integrations'
                              className='text-blue-400 hover:text-blue-300'
                            >
                              Go to Integrations
                            </a>
                          </Button>
                          <p className='text-xs text-muted-foreground text-center'>
                            After connecting GitHub, make sure to select
                            repositories to track
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    filteredActivities.map(activity => {
                      const Icon = getActivityIcon(activity.type);
                      const colorClass = getActivityColor(activity.type);
                      const actor = activity.author;
                      const payload = activity.metadata;

                      // Get the external URL for the activity
                      const getExternalUrl = () => {
                        if (payload) {
                          if ((payload as any).commit?.url)
                            return (payload as any).commit.url;
                          if ((payload as any).pull_request?.html_url)
                            return (payload as any).pull_request.html_url;
                          if ((payload as any).issue?.html_url)
                            return (payload as any).issue.html_url;
                        }
                        return activity.url || null;
                      };

                      const externalUrl = getExternalUrl();

                      return (
                        <div
                          key={activity.id}
                          className='flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors'
                        >
                          <div
                            className={`p-2 rounded-lg bg-muted ${colorClass}`}
                          >
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
                                {activity.type.replace('_', ' ')}
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
                                    <AvatarImage src={actor.avatar} />
                                    <AvatarFallback>
                                      {actor.name?.charAt(0) || '?'}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span>{actor.name}</span>
                                  <span>•</span>
                                </>
                              )}
                              <span>{activity.repository}</span>
                              <span>•</span>
                              <span>{formatTimestamp(activity.timestamp)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='members' className='space-y-4'>
          <Card className='bg-card border-border'>
            <CardHeader>
              <CardTitle className='text-foreground'>Team Members</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                {teamMembers.map(member => (
                  <div
                    key={member.id}
                    className='p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors'
                  >
                    <div className='flex items-center gap-3 mb-3'>
                      <Avatar className='h-10 w-10'>
                        <AvatarImage src={member.avatar} />
                        <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className='flex-1 min-w-0'>
                        <h4 className='text-sm font-medium text-foreground truncate'>
                          {member.name}
                        </h4>
                        <p className='text-xs text-muted-foreground truncate'>
                          {member.email}
                        </p>
                      </div>
                      <Badge
                        variant={
                          member.status === 'active'
                            ? 'default'
                            : member.status === 'away'
                              ? 'secondary'
                              : 'outline'
                        }
                        className={
                          member.status === 'active'
                            ? 'bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30'
                            : member.status === 'away'
                              ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30'
                              : 'bg-muted text-muted-foreground'
                        }
                      >
                        {member.status}
                      </Badge>
                    </div>
                    <div className='grid grid-cols-2 gap-2 text-xs'>
                      <div className='text-center'>
                        <p className='text-muted-foreground'>Commits</p>
                        <p className='text-foreground font-medium'>
                          {member.commits}
                        </p>
                      </div>
                      <div className='text-center'>
                        <p className='text-muted-foreground'>PRs</p>
                        <p className='text-foreground font-medium'>
                          {member.pullRequests}
                        </p>
                      </div>
                      <div className='text-center'>
                        <p className='text-muted-foreground'>Issues</p>
                        <p className='text-foreground font-medium'>
                          {member.issues}
                        </p>
                      </div>
                      <div className='text-center'>
                        <p className='text-muted-foreground'>Reviews</p>
                        <p className='text-foreground font-medium'>
                          {member.reviews}
                        </p>
                      </div>
                    </div>
                    <div className='mt-2 text-xs text-muted-foreground'>
                      Last active: {formatTimestamp(member.lastActive)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='repositories' className='space-y-4'>
          <Card className='bg-card border-border'>
            <CardHeader>
              <CardTitle className='text-foreground'>
                Repository Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats?.repositoryStats && stats.repositoryStats.length > 0 ? (
                <div className='space-y-4'>
                  {stats.repositoryStats.map((repo, index) => (
                    <div
                      key={index}
                      className='p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors'
                    >
                      <div className='flex items-center justify-between mb-3'>
                        <h4 className='text-sm font-medium text-foreground'>
                          {repo.name}
                        </h4>
                        <Badge
                          variant='outline'
                          className='bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30'
                        >
                          {repo.contributors} contributors
                        </Badge>
                      </div>
                      <div className='grid grid-cols-3 gap-4 text-sm'>
                        <div className='text-center'>
                          <p className='text-muted-foreground'>Commits</p>
                          <p className='text-foreground font-medium'>
                            {repo.commits}
                          </p>
                        </div>
                        <div className='text-center'>
                          <p className='text-muted-foreground'>Pull Requests</p>
                          <p className='text-foreground font-medium'>
                            {repo.pullRequests}
                          </p>
                        </div>
                        <div className='text-center'>
                          <p className='text-muted-foreground'>Issues</p>
                          <p className='text-foreground font-medium'>
                            {repo.issues}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className='text-center py-8'>
                  <IconCode className='h-12 w-12 text-muted-foreground mx-auto mb-4' />
                  <h3 className='text-lg font-semibold text-foreground mb-2'>
                    No repository data
                  </h3>
                  <p className='text-muted-foreground'>
                    Repository statistics will appear here
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
