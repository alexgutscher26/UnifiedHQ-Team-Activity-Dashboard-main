'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { RepositorySelector } from '@/components/repository-selector';
import { ChannelSelector } from '@/components/channel-selector';
import { SlackInstallationGuide } from '@/components/slack-installation-guide';
import {
  IconBrandSlack,
  IconBrandGithub,
  IconBrandWindows,
  IconBrandGoogle,
  IconBrandTrello,
  IconChecklist,
  IconBrandDiscord,
  IconChartLine,
  IconListCheck,
  IconCheck,
  IconLoader2,
  IconRefresh,
  IconInfoCircle,
  IconTrendingUp,
  IconClock,
  IconDatabase,
  IconSparkles,
  IconRocket,
} from '@tabler/icons-react';

/**
 * Render the Integrations Page component.
 *
 * This component manages the connection and synchronization of various integrations such as GitHub and Slack. It checks the connection status on mount, fetches relevant statistics, and provides functionality to connect, sync, and disconnect from these services. The component also handles loading states and displays user feedback through toasts. Integration cards are dynamically generated based on the connection status and provide actions for syncing and disconnecting.
 *
 * @returns {JSX.Element} The rendered Integrations Page component.
 */
export function IntegrationsPage() {
  const { toast } = useToast();
  const [githubConnected, setGithubConnected] = useState(false);
  const [slackConnected, setSlackConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedRepos, setSelectedRepos] = useState(0);
  const [selectedChannels, setSelectedChannels] = useState(0);
  const [totalActivities, setTotalActivities] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncProgress, setSyncProgress] = useState(0);
  const [slackClientId, setSlackClientId] = useState<string | undefined>();

  // Check connection status on mount
  useEffect(() => {
    // Load lastSyncTime from localStorage
    const savedSyncTime = localStorage.getItem('lastSyncTime');
    if (savedSyncTime) {
      setLastSyncTime(new Date(savedSyncTime));
    }

    checkGithubStatus();
    checkSlackStatus();
    fetchStats();
    fetchSlackClientId();

    // Listen for storage changes (cross-tab sync)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'lastSyncTime' && e.newValue) {
        setLastSyncTime(new Date(e.newValue));
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const checkGithubStatus = async () => {
    try {
      const response = await fetch('/api/integrations/github/sync');
      const data = await response.json();
      setGithubConnected(data.connected);
    } catch (error) {
      console.error('Failed to check GitHub status:', error);
    }
  };

  const checkSlackStatus = async () => {
    try {
      const response = await fetch('/api/integrations/slack/sync');
      const data = await response.json();
      setSlackConnected(data.connected);
    } catch (error) {
      console.error('Failed to check Slack status:', error);
    }
  };

  const fetchSlackClientId = async () => {
    try {
      const response = await fetch('/api/integrations/slack/client-id');
      if (response.ok) {
        const data = await response.json();
        setSlackClientId(data.clientId);
      }
    } catch (error) {
      console.error('Failed to fetch Slack client ID:', error);
    }
  };

  const fetchStats = async () => {
    try {
      let totalActivities = 0;

      // Fetch GitHub stats
      const githubResponse = await fetch('/api/debug/github-sync');
      const githubData = await githubResponse.json();
      if (githubResponse.ok) {
        setSelectedRepos(githubData.selectedRepositories || 0);
        totalActivities += githubData.storedActivities || 0;
      }

      // Fetch Slack stats
      const slackResponse = await fetch('/api/slack/stats');
      const slackData = await slackResponse.json();
      if (slackResponse.ok) {
        setSelectedChannels(slackData.channels?.selected || 0);
        totalActivities += slackData.count || 0;
      }

      setTotalActivities(totalActivities);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const handleGithubConnect = async () => {
    setIsLoading(true);
    try {
      window.location.href = '/api/integrations/github/connect';
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to connect to GitHub. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGithubSync = async () => {
    setIsSyncing(true);
    setSyncProgress(0);

    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setSyncProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch('/api/integrations/github/sync', {
        method: 'POST',
      });
      const data = await response.json();

      console.log('GitHub sync response:', {
        ok: response.ok,
        status: response.status,
        data,
      });

      clearInterval(progressInterval);
      setSyncProgress(100);

      if (response.ok) {
        console.log(
          'GitHub sync successful, updating lastSyncTime to:',
          new Date()
        );
        const syncTime = new Date();
        setLastSyncTime(syncTime);
        localStorage.setItem('lastSyncTime', syncTime.toISOString());
        await fetchStats(); // Refresh stats after sync
        toast({
          title: 'Sync Successful',
          description: data.message,
        });
      } else {
        if (data.code === 'TOKEN_EXPIRED') {
          setGithubConnected(false);
          toast({
            title: 'GitHub Token Expired',
            description: 'Please reconnect your GitHub account.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Sync Failed',
            description: data.error || 'Failed to sync GitHub activity',
            variant: 'destructive',
          });
        }
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to sync GitHub activity. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncProgress(0), 1000);
    }
  };

  const handleGithubDisconnect = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/integrations/github/disconnect', {
        method: 'POST',
      });
      const data = await response.json();

      if (response.ok) {
        setGithubConnected(false);
        toast({
          title: 'Success',
          description: data.message,
        });
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to disconnect GitHub',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to disconnect GitHub. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSlackConnect = async () => {
    setIsLoading(true);
    try {
      window.location.href = '/api/integrations/slack/connect';
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to connect to Slack. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSlackSync = async () => {
    setIsSyncing(true);
    setSyncProgress(0);

    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setSyncProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch('/api/integrations/slack/sync', {
        method: 'POST',
      });
      const data = await response.json();

      console.log('Slack sync response:', {
        ok: response.ok,
        status: response.status,
        data,
      });

      clearInterval(progressInterval);
      setSyncProgress(100);

      if (response.ok) {
        console.log(
          'Slack sync successful, updating lastSyncTime to:',
          new Date()
        );
        const syncTime = new Date();
        setLastSyncTime(syncTime);
        localStorage.setItem('lastSyncTime', syncTime.toISOString());
        await fetchStats(); // Refresh stats after sync
        toast({
          title: 'Sync Successful',
          description: data.message,
        });
      } else {
        if (data.code === 'TOKEN_EXPIRED') {
          setSlackConnected(false);
          toast({
            title: 'Slack Token Expired',
            description: 'Please reconnect your Slack account.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Sync Failed',
            description: data.error || 'Failed to sync Slack activity',
            variant: 'destructive',
          });
        }
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to sync Slack activity. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncProgress(0), 1000);
    }
  };

  /**
   * Handles the disconnection of Slack integration.
   *
   * This function initiates a loading state, sends a POST request to the Slack disconnect API, and processes the response.
   * If the disconnection is successful, it updates the connection status, displays a success message, and triggers a storage event to refresh the sidebar.
   * In case of an error, it shows an appropriate error message. The loading state is reset in the finally block.
   */
  const handleSlackDisconnect = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/integrations/slack/disconnect', {
        method: 'POST',
      });
      const data = await response.json();

      if (response.ok) {
        setSlackConnected(false);
        toast({
          title: 'Success',
          description: data.message,
        });
        // Trigger storage event to update sidebar
        localStorage.setItem(
          'integration-status-changed',
          Date.now().toString()
        );
        setTimeout(() => {
          localStorage.removeItem('integration-status-changed');
        }, 100);
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to disconnect Slack',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to disconnect Slack. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const integrations = [
    {
      id: 'github',
      name: 'GitHub',
      description:
        'Track commits, pull requests, issues, and repository activity',
      icon: IconBrandGithub,
      connected: githubConnected,
      color: 'bg-gray-900',
      gradient: 'from-gray-800 to-gray-900',
      status: githubConnected ? 'Connected' : 'Available',
      statusColor: githubConnected ? 'bg-green-500' : 'bg-blue-500',
      features: ['Commits', 'Pull Requests', 'Issues', 'Repository Events'],
      stats: githubConnected
        ? {
            repositories: selectedRepos,
            activities: totalActivities,
            lastSync: lastSyncTime,
          }
        : null,
      action: githubConnected ? (
        <div className='flex flex-col gap-2'>
          <div className='flex gap-2'>
            <RepositorySelector isConnected={githubConnected} />
            <Button
              size='sm'
              variant='outline'
              onClick={handleGithubSync}
              disabled={isSyncing}
              className='flex-1'
            >
              {isSyncing ? (
                <IconLoader2 className='size-4 mr-2 animate-spin' />
              ) : (
                <IconRefresh className='size-4 mr-2' />
              )}
              Sync Now
            </Button>
          </div>
          {isSyncing && (
            <div className='space-y-2'>
              <Progress value={syncProgress} className='h-2' />
              <p className='text-xs text-muted-foreground text-center'>
                Syncing activities...
              </p>
            </div>
          )}
          <Button
            size='sm'
            variant='destructive'
            onClick={handleGithubDisconnect}
            disabled={isLoading}
            className='w-full'
          >
            {isLoading ? (
              <IconLoader2 className='size-4 mr-2 animate-spin' />
            ) : null}
            Disconnect
          </Button>
        </div>
      ) : (
        <Button
          size='sm'
          onClick={handleGithubConnect}
          disabled={isLoading}
          className='w-full'
        >
          {isLoading ? (
            <IconLoader2 className='size-4 mr-2 animate-spin' />
          ) : (
            <IconRocket className='size-4 mr-2' />
          )}
          Connect GitHub
        </Button>
      ),
    },
    {
      id: 'slack',
      name: 'Slack',
      description: 'Track team messages, channels, and collaboration activity',
      icon: IconBrandSlack,
      connected: slackConnected,
      color: 'bg-purple-600',
      gradient: 'from-purple-600 to-purple-700',
      status: slackConnected ? 'Connected' : 'Available',
      statusColor: slackConnected ? 'bg-green-500' : 'bg-blue-500',
      features: ['Messages', 'Channels', 'Files', 'Reactions'],
      stats: slackConnected
        ? {
            channels: selectedChannels,
            activities: 0, // Will be calculated separately
            lastSync: lastSyncTime,
          }
        : null,
      action: slackConnected ? (
        <div className='flex flex-col gap-2'>
          <div className='flex gap-2'>
            <ChannelSelector isConnected={slackConnected} />
            <Button
              size='sm'
              variant='outline'
              onClick={handleSlackSync}
              disabled={isSyncing}
              className='flex-1'
            >
              {isSyncing ? (
                <IconLoader2 className='size-4 mr-2 animate-spin' />
              ) : (
                <IconRefresh className='size-4 mr-2' />
              )}
              Sync Now
            </Button>
          </div>
          {isSyncing && (
            <div className='space-y-2'>
              <Progress value={syncProgress} className='h-2' />
              <p className='text-xs text-muted-foreground text-center'>
                Syncing activities...
              </p>
            </div>
          )}
          <Button
            size='sm'
            variant='destructive'
            onClick={handleSlackDisconnect}
            disabled={isLoading}
            className='w-full'
          >
            {isLoading ? (
              <IconLoader2 className='size-4 mr-2 animate-spin' />
            ) : null}
            Disconnect
          </Button>
          <SlackInstallationGuide clientId={slackClientId} />
        </div>
      ) : (
        <div className='flex flex-col gap-2'>
          <Button
            size='sm'
            onClick={handleSlackConnect}
            disabled={isLoading}
            className='w-full'
          >
            {isLoading ? (
              <IconLoader2 className='size-4 mr-2 animate-spin' />
            ) : (
              <IconRocket className='size-4 mr-2' />
            )}
            Connect Slack
          </Button>
          <SlackInstallationGuide clientId={slackClientId} />
        </div>
      ),
    },
    // Coming Soon Integrations
    {
      id: 'microsoft-teams',
      name: 'Microsoft Teams',
      description:
        'Track meetings, calls, and team collaboration in Microsoft Teams',
      icon: IconBrandWindows,
      connected: false,
      color: 'bg-blue-600',
      gradient: 'from-blue-600 to-blue-700',
      status: 'Coming Soon',
      statusColor: 'bg-yellow-500',
      features: ['Meetings', 'Calls', 'Chat', 'Files'],
      stats: null,
      comingSoon: true,
      action: (
        <Button size='sm' disabled className='w-full opacity-50'>
          <IconRocket className='size-4 mr-2' />
          Coming Soon
        </Button>
      ),
    },
    {
      id: 'google-workspace',
      name: 'Google Workspace',
      description: 'Track Gmail, Google Drive, Calendar, and Docs activity',
      icon: IconBrandGoogle,
      connected: false,
      color: 'bg-green-600',
      gradient: 'from-green-600 to-green-700',
      status: 'Coming Soon',
      statusColor: 'bg-yellow-500',
      features: ['Gmail', 'Drive', 'Calendar', 'Docs'],
      stats: null,
      comingSoon: true,
      action: (
        <Button size='sm' disabled className='w-full opacity-50'>
          <IconRocket className='size-4 mr-2' />
          Coming Soon
        </Button>
      ),
    },
    {
      id: 'jira',
      name: 'Jira',
      description: 'Track project management, issues, and sprint activities',
      icon: IconChecklist,
      connected: false,
      color: 'bg-blue-500',
      gradient: 'from-blue-500 to-blue-600',
      status: 'Coming Soon',
      statusColor: 'bg-yellow-500',
      features: ['Issues', 'Sprints', 'Projects', 'Reports'],
      stats: null,
      comingSoon: true,
      action: (
        <Button size='sm' disabled className='w-full opacity-50'>
          <IconRocket className='size-4 mr-2' />
          Coming Soon
        </Button>
      ),
    },
    {
      id: 'trello',
      name: 'Trello',
      description: 'Track board activities, card movements, and team workflows',
      icon: IconBrandTrello,
      connected: false,
      color: 'bg-blue-400',
      gradient: 'from-blue-400 to-blue-500',
      status: 'Coming Soon',
      statusColor: 'bg-yellow-500',
      features: ['Boards', 'Cards', 'Lists', 'Comments'],
      stats: null,
      comingSoon: true,
      action: (
        <Button size='sm' disabled className='w-full opacity-50'>
          <IconRocket className='size-4 mr-2' />
          Coming Soon
        </Button>
      ),
    },
    {
      id: 'discord',
      name: 'Discord',
      description:
        'Track server messages, voice channels, and community activity',
      icon: IconBrandDiscord,
      connected: false,
      color: 'bg-indigo-600',
      gradient: 'from-indigo-600 to-indigo-700',
      status: 'Coming Soon',
      statusColor: 'bg-yellow-500',
      features: ['Messages', 'Voice', 'Channels', 'Servers'],
      stats: null,
      comingSoon: true,
      action: (
        <Button size='sm' disabled className='w-full opacity-50'>
          <IconRocket className='size-4 mr-2' />
          Coming Soon
        </Button>
      ),
    },
    {
      id: 'linear',
      name: 'Linear',
      description:
        'Track issue management, project updates, and team productivity',
      icon: IconChartLine,
      connected: false,
      color: 'bg-purple-600',
      gradient: 'from-purple-600 to-purple-700',
      status: 'Coming Soon',
      statusColor: 'bg-yellow-500',
      features: ['Issues', 'Projects', 'Cycles', 'Updates'],
      stats: null,
      comingSoon: true,
      action: (
        <Button size='sm' disabled className='w-full opacity-50'>
          <IconRocket className='size-4 mr-2' />
          Coming Soon
        </Button>
      ),
    },
    {
      id: 'asana',
      name: 'Asana',
      description:
        'Track task management, project progress, and team coordination',
      icon: IconListCheck,
      connected: false,
      color: 'bg-red-500',
      gradient: 'from-red-500 to-red-600',
      status: 'Coming Soon',
      statusColor: 'bg-yellow-500',
      features: ['Tasks', 'Projects', 'Teams', 'Timeline'],
      stats: null,
      comingSoon: true,
      action: (
        <Button size='sm' disabled className='w-full opacity-50'>
          <IconRocket className='size-4 mr-2' />
          Coming Soon
        </Button>
      ),
    },
  ];

  return (
    <div className='flex flex-1 flex-col'>
      <div className='@container/main flex flex-1 flex-col gap-2'>
        <div className='flex flex-col gap-6 py-4 md:gap-8 md:py-6'>
          {/* Header */}
          <div className='px-4 lg:px-6'>
            <div className='space-y-4'>
              <div className='space-y-2'>
                <h1 className='text-3xl font-bold flex items-center gap-2'>
                  <IconSparkles className='size-8 text-primary' />
                  Integrations
                </h1>
                <p className='text-muted-foreground text-lg'>
                  Connect your favorite tools to get a unified view of your
                  team&apos;s activity
                </p>
              </div>

              {/* Quick Stats */}
              {(githubConnected || slackConnected) && (
                <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
                  {githubConnected && (
                    <Card className='bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 dark:from-green-950/30 dark:to-emerald-950/30 dark:border-green-800'>
                      <CardContent className='p-4'>
                        <div className='flex items-center gap-3'>
                          <div className='p-2 bg-green-100 dark:bg-green-900 rounded-lg'>
                            <IconBrandGithub className='size-5 text-green-600 dark:text-green-400' />
                          </div>
                          <div>
                            <p className='text-sm text-muted-foreground'>
                              Repositories
                            </p>
                            <p className='text-2xl font-bold text-green-700 dark:text-green-300'>
                              {selectedRepos}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {slackConnected && (
                    <Card className='bg-gradient-to-r from-purple-50 to-violet-50 border-purple-200 dark:from-purple-950/30 dark:to-violet-950/30 dark:border-purple-800'>
                      <CardContent className='p-4'>
                        <div className='flex items-center gap-3'>
                          <div className='p-2 bg-purple-100 dark:bg-purple-900 rounded-lg'>
                            <IconBrandSlack className='size-5 text-purple-600 dark:text-purple-400' />
                          </div>
                          <div>
                            <p className='text-sm text-muted-foreground'>
                              Channels
                            </p>
                            <p className='text-2xl font-bold text-purple-700 dark:text-purple-300'>
                              {selectedChannels}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <Card className='bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200 dark:from-blue-950/30 dark:to-cyan-950/30 dark:border-blue-800'>
                    <CardContent className='p-4'>
                      <div className='flex items-center gap-3'>
                        <div className='p-2 bg-blue-100 dark:bg-blue-900 rounded-lg'>
                          <IconTrendingUp className='size-5 text-blue-600 dark:text-blue-400' />
                        </div>
                        <div>
                          <p className='text-sm text-muted-foreground'>
                            Activities
                          </p>
                          <p className='text-2xl font-bold text-blue-700 dark:text-blue-300'>
                            {totalActivities}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className='bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200 dark:from-orange-950/30 dark:to-amber-950/30 dark:border-orange-800'>
                    <CardContent className='p-4'>
                      <div className='flex items-center gap-3'>
                        <div className='p-2 bg-orange-100 dark:bg-orange-900 rounded-lg'>
                          <IconClock className='size-5 text-orange-600 dark:text-orange-400' />
                        </div>
                        <div>
                          <p className='text-sm text-muted-foreground'>
                            Last Sync
                          </p>
                          <p className='text-sm font-medium text-orange-700 dark:text-orange-300'>
                            {lastSyncTime
                              ? lastSyncTime.toLocaleTimeString()
                              : 'Never'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>

          {/* Integration Cards */}
          <div className='px-4 lg:px-6'>
            <div className='grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6'>
              {integrations.map(integration => (
                <Card
                  key={integration.id}
                  className={`relative overflow-hidden transition-all duration-200 hover:shadow-lg ${
                    integration.connected
                      ? 'ring-2 ring-green-200 dark:ring-green-800 bg-green-50/30 dark:bg-green-950/20'
                      : ''
                  }`}
                >
                  {/* Gradient Background */}
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${integration.gradient} opacity-5`}
                  />

                  <CardHeader className='relative'>
                    <div className='flex items-start justify-between'>
                      <div className='flex items-center gap-3'>
                        <div
                          className={`p-3 rounded-xl ${integration.color} shadow-lg`}
                        >
                          <integration.icon className='size-6 text-white' />
                        </div>
                        <div>
                          <CardTitle className='text-xl flex items-center gap-2'>
                            {integration.name}
                            {integration.comingSoon && (
                              <Badge variant='secondary' className='text-xs'>
                                Coming Soon
                              </Badge>
                            )}
                          </CardTitle>
                          <div className='flex items-center gap-2 mt-1'>
                            <div
                              className={`size-2 rounded-full ${integration.statusColor}`}
                            />
                            <span className='text-sm text-muted-foreground'>
                              {integration.status}
                            </span>
                          </div>
                        </div>
                      </div>

                      {integration.connected && (
                        <Badge
                          variant='secondary'
                          className='bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        >
                          <IconCheck className='size-3 mr-1' />
                          Active
                        </Badge>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className='relative space-y-4'>
                    <CardDescription className='text-sm leading-relaxed'>
                      {integration.description}
                    </CardDescription>

                    {/* Features */}
                    <div className='space-y-2'>
                      <h4 className='text-sm font-medium text-muted-foreground'>
                        Features:
                      </h4>
                      <div className='flex flex-wrap gap-1'>
                        {integration.features.map((feature, index) => (
                          <Badge
                            key={index}
                            variant='outline'
                            className='text-xs'
                          >
                            {feature}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Stats for connected integrations */}
                    {integration.stats && (
                      <div className='space-y-2'>
                        <Separator />
                        <div className='grid grid-cols-2 gap-2 text-sm'>
                          <div className='flex items-center gap-2'>
                            <IconDatabase className='size-4 text-muted-foreground' />
                            <span className='text-muted-foreground'>
                              {integration.id === 'github'
                                ? 'Repos:'
                                : 'Channels:'}
                            </span>
                            <span className='font-medium'>
                              {integration.id === 'github'
                                ? integration.stats.repositories
                                : integration.stats.channels}
                            </span>
                          </div>
                          <div className='flex items-center gap-2'>
                            <IconTrendingUp className='size-4 text-muted-foreground' />
                            <span className='text-muted-foreground'>
                              Activities:
                            </span>
                            <span className='font-medium'>
                              {integration.stats.activities}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Coming Soon Notice */}
                    {integration.comingSoon && (
                      <Alert>
                        <IconInfoCircle className='size-4' />
                        <AlertDescription className='text-sm'>
                          This integration is in development. Stay tuned for
                          updates!
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Action Buttons */}
                    <div className='pt-2'>{integration.action}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
