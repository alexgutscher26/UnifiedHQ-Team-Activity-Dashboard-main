'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  IconBrandGithub,
  IconBrandSlack,
  IconCheck,
  IconX,
  IconRefresh,
  IconSettings,
  IconLoader2,
  IconExternalLink,
} from '@tabler/icons-react';

interface IntegrationSettingsProps {
  onSettingsChange?: (section: string, message: string) => void;
}

interface IntegrationStatus {
  connected: boolean;
  lastSync?: string;
  status: 'connected' | 'disconnected' | 'error' | 'loading';
  details?: string;
}

export function IntegrationSettings({
  onSettingsChange,
}: IntegrationSettingsProps) {
  const { toast } = useToast();
  const [integrations, setIntegrations] = useState<
    Record<string, IntegrationStatus>
  >({
    github: { connected: false, status: 'loading' },
    slack: { connected: false, status: 'loading' },
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadIntegrationStatus();
  }, []);

  const loadIntegrationStatus = async () => {
    try {
      setIsLoading(true);

      // Check GitHub status
      const githubResponse = await fetch('/api/github/stats');
      const githubConnected = githubResponse.ok;

      // Check Slack status
      const slackResponse = await fetch('/api/slack/stats');
      const slackData = slackResponse.ok ? await slackResponse.json() : null;
      const slackConnected = slackData && slackData.status !== 'Not Connected';

      setIntegrations({
        github: {
          connected: githubConnected,
          status: githubConnected ? 'connected' : 'disconnected',
          lastSync: githubConnected ? 'Recently synced' : undefined,
          details: githubConnected
            ? 'Active repository monitoring'
            : 'Not connected',
        },
        slack: {
          connected: slackConnected,
          status: slackConnected ? 'connected' : 'disconnected',
          lastSync: slackConnected ? slackData?.lastUpdate : undefined,
          details: slackConnected
            ? `${slackData?.count || 0} messages tracked`
            : 'Not connected',
        },
      });
    } catch (error) {
      console.error('Failed to load integration status:', error);
      toast({
        title: 'Error',
        description: 'Failed to load integration status',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async (integration: string) => {
    try {
      setIntegrations(prev => ({
        ...prev,
        [integration]: { ...prev[integration], status: 'loading' },
      }));

      const response = await fetch(`/api/integrations/${integration}/connect`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.url) {
          window.location.href = data.url;
        }
      } else {
        throw new Error('Failed to initiate connection');
      }
    } catch (error) {
      console.error(`Failed to connect ${integration}:`, error);
      setIntegrations(prev => ({
        ...prev,
        [integration]: { ...prev[integration], status: 'error' },
      }));
      toast({
        title: 'Error',
        description: `Failed to connect ${integration}`,
        variant: 'destructive',
      });
    }
  };

  const handleDisconnect = async (integration: string) => {
    try {
      setIntegrations(prev => ({
        ...prev,
        [integration]: { ...prev[integration], status: 'loading' },
      }));

      const response = await fetch(
        `/api/integrations/${integration}/disconnect`,
        {
          method: 'POST',
        }
      );

      if (response.ok) {
        await loadIntegrationStatus();
        onSettingsChange?.(
          'Integrations',
          `${integration} disconnected successfully`
        );
        toast({
          title: 'Success',
          description: `${integration} disconnected successfully`,
        });
      } else {
        throw new Error('Failed to disconnect');
      }
    } catch (error) {
      console.error(`Failed to disconnect ${integration}:`, error);
      setIntegrations(prev => ({
        ...prev,
        [integration]: { ...prev[integration], status: 'error' },
      }));
      toast({
        title: 'Error',
        description: `Failed to disconnect ${integration}`,
        variant: 'destructive',
      });
    }
  };

  const handleSync = async (integration: string) => {
    try {
      setIntegrations(prev => ({
        ...prev,
        [integration]: { ...prev[integration], status: 'loading' },
      }));

      const response = await fetch(`/api/integrations/${integration}/sync`, {
        method: 'POST',
      });

      if (response.ok) {
        await loadIntegrationStatus();
        onSettingsChange?.(
          'Integrations',
          `${integration} synced successfully`
        );
        toast({
          title: 'Success',
          description: `${integration} synced successfully`,
        });
      } else {
        throw new Error('Failed to sync');
      }
    } catch (error) {
      console.error(`Failed to sync ${integration}:`, error);
      setIntegrations(prev => ({
        ...prev,
        [integration]: { ...prev[integration], status: 'error' },
      }));
      toast({
        title: 'Error',
        description: `Failed to sync ${integration}`,
        variant: 'destructive',
      });
    }
  };

  const getIntegrationIcon = (integration: string) => {
    switch (integration) {
      case 'github':
        return IconBrandGithub;
      case 'slack':
        return IconBrandSlack;
      default:
        return IconSettings;
    }
  };

  const getStatusBadge = (status: IntegrationStatus) => {
    switch (status.status) {
      case 'connected':
        return (
          <Badge variant='default' className='bg-green-500'>
            Connected
          </Badge>
        );
      case 'disconnected':
        return <Badge variant='secondary'>Disconnected</Badge>;
      case 'error':
        return <Badge variant='destructive'>Error</Badge>;
      case 'loading':
        return <Badge variant='outline'>Loading...</Badge>;
      default:
        return <Badge variant='secondary'>Unknown</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className='space-y-6'>
        {['github', 'slack'].map(integration => (
          <Card key={integration}>
            <CardHeader>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  <Skeleton className='h-8 w-8 rounded' />
                  <div>
                    <Skeleton className='h-5 w-24 mb-1' />
                    <Skeleton className='h-4 w-32' />
                  </div>
                </div>
                <Skeleton className='h-6 w-20' />
              </div>
            </CardHeader>
            <CardContent>
              <Skeleton className='h-4 w-full mb-2' />
              <div className='flex gap-2'>
                <Skeleton className='h-8 w-24' />
                <Skeleton className='h-8 w-20' />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className='space-y-6 px-4 lg:px-6'>
      {/* GitHub Integration */}
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-3'>
              <div className='p-2 bg-gray-100 dark:bg-gray-800 rounded-lg'>
                <IconBrandGithub className='h-6 w-6' />
              </div>
              <div>
                <CardTitle className='text-lg'>GitHub</CardTitle>
                <CardDescription>
                  Connect your GitHub account to track commits, pull requests,
                  and issues
                </CardDescription>
              </div>
            </div>
            {getStatusBadge(integrations.github)}
          </div>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='text-sm text-muted-foreground'>
            {integrations.github.details}
          </div>
          {integrations.github.lastSync && (
            <div className='text-sm text-muted-foreground'>
              Last sync: {integrations.github.lastSync}
            </div>
          )}
          <div className='flex items-center gap-2'>
            {integrations.github.connected ? (
              <>
                <Button
                  onClick={() => handleSync('github')}
                  disabled={integrations.github.status === 'loading'}
                  variant='outline'
                  size='sm'
                >
                  {integrations.github.status === 'loading' ? (
                    <IconLoader2 className='h-4 w-4 mr-2 animate-spin' />
                  ) : (
                    <IconRefresh className='h-4 w-4 mr-2' />
                  )}
                  Sync Now
                </Button>
                <Button
                  onClick={() => handleDisconnect('github')}
                  disabled={integrations.github.status === 'loading'}
                  variant='destructive'
                  size='sm'
                >
                  <IconX className='h-4 w-4 mr-2' />
                  Disconnect
                </Button>
              </>
            ) : (
              <Button
                onClick={() => handleConnect('github')}
                disabled={integrations.github.status === 'loading'}
                size='sm'
              >
                {integrations.github.status === 'loading' ? (
                  <IconLoader2 className='h-4 w-4 mr-2 animate-spin' />
                ) : (
                  <IconCheck className='h-4 w-4 mr-2' />
                )}
                Connect GitHub
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Slack Integration */}
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-3'>
              <div className='p-2 bg-purple-100 dark:bg-purple-900 rounded-lg'>
                <IconBrandSlack className='h-6 w-6' />
              </div>
              <div>
                <CardTitle className='text-lg'>Slack</CardTitle>
                <CardDescription>
                  Connect your Slack workspace to track messages and team
                  activity
                </CardDescription>
              </div>
            </div>
            {getStatusBadge(integrations.slack)}
          </div>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='text-sm text-muted-foreground'>
            {integrations.slack.details}
          </div>
          {integrations.slack.lastSync && (
            <div className='text-sm text-muted-foreground'>
              Last sync: {integrations.slack.lastSync}
            </div>
          )}
          <div className='flex items-center gap-2'>
            {integrations.slack.connected ? (
              <>
                <Button
                  onClick={() => handleSync('slack')}
                  disabled={integrations.slack.status === 'loading'}
                  variant='outline'
                  size='sm'
                >
                  {integrations.slack.status === 'loading' ? (
                    <IconLoader2 className='h-4 w-4 mr-2 animate-spin' />
                  ) : (
                    <IconRefresh className='h-4 w-4 mr-2' />
                  )}
                  Sync Now
                </Button>
                <Button
                  onClick={() => handleDisconnect('slack')}
                  disabled={integrations.slack.status === 'loading'}
                  variant='destructive'
                  size='sm'
                >
                  <IconX className='h-4 w-4 mr-2' />
                  Disconnect
                </Button>
              </>
            ) : (
              <Button
                onClick={() => handleConnect('slack')}
                disabled={integrations.slack.status === 'loading'}
                size='sm'
              >
                {integrations.slack.status === 'loading' ? (
                  <IconLoader2 className='h-4 w-4 mr-2 animate-spin' />
                ) : (
                  <IconCheck className='h-4 w-4 mr-2' />
                )}
                Connect Slack
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Integration Help */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <IconExternalLink className='h-5 w-5' />
            Need Help?
          </CardTitle>
          <CardDescription>
            Learn more about connecting and managing your integrations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='space-y-2 text-sm text-muted-foreground'>
            <p>
              • GitHub: Connect to track repository activity and pull requests
            </p>
            <p>• Slack: Connect to monitor team messages and channels</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
