'use client';

import React from 'react';
import { OfflineFirstActivityFeed } from '@/components/offline-first-activity-feed';
import { OfflineFirstAISummaryCard } from '@/components/offline-first-ai-summary-card';
import { SectionCards } from '@/components/section-cards';
import { OfflineIndicator } from '@/components/offline-indicator';
import {
  ActivityFeedErrorBoundary,
  GitHubErrorBoundary,
} from '@/components/error-boundaries';
import { useMemoryLeakPrevention } from '@/lib/memory-leak-prevention';
import { useNetworkStatusContext } from '@/contexts/network-status-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  IconWifiOff,
  IconDatabase,
  IconRefresh,
  IconSettings,
  IconCloudOff,
} from '@tabler/icons-react';

interface OfflineFirstSectionCardsProps {
  className?: string;
}

function OfflineFirstSectionCards({
  className,
}: OfflineFirstSectionCardsProps) {
  const networkStatus = useNetworkStatusContext();

  if (networkStatus.isOffline) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <IconCloudOff className='size-5' />
            Dashboard Overview
            <Badge variant='destructive' className='text-xs'>
              <IconWifiOff className='size-3 mr-1' />
              Offline
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='text-center py-8'>
            <IconDatabase className='size-12 text-muted-foreground mx-auto mb-4' />
            <h4 className='text-lg font-medium mb-2'>Limited Functionality</h4>
            <p className='text-muted-foreground mb-4 max-w-sm mx-auto'>
              Dashboard overview requires internet connection. Connect to see
              your latest metrics and integrations.
            </p>
            <div className='flex gap-2 justify-center'>
              <Button
                variant='outline'
                onClick={() => window.location.reload()}
                className='flex items-center gap-2'
              >
                <IconRefresh className='size-4' />
                Retry Connection
              </Button>
              <Button
                variant='outline'
                onClick={() => (window.location.href = '/integrations')}
                disabled
                className='flex items-center gap-2'
              >
                <IconSettings className='size-4' />
                Manage Integrations
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // When online, use the regular SectionCards component
  return <SectionCards className={className} />;
}

export function OfflineFirstDashboardContent() {
  // Memory leak prevention
  useMemoryLeakPrevention('OfflineFirstDashboardContent');

  const networkStatus = useNetworkStatusContext();

  return (
    <div className='flex flex-1 flex-col'>
      {/* Offline indicator banner */}
      <OfflineIndicator
        showWhenOnline={true}
        autoHide={true}
        autoHideDelay={3000}
        variant='banner'
        position='top'
      />

      <div className='@container/main flex flex-1 flex-col gap-2'>
        <div className='flex flex-col gap-4 py-4 md:gap-6 md:py-6'>
          <GitHubErrorBoundary>
            <OfflineFirstSectionCards />
          </GitHubErrorBoundary>

          <div className='grid grid-cols-1 gap-4 px-4 lg:grid-cols-3 lg:gap-6 lg:px-6'>
            <div className='lg:col-span-2'>
              <ActivityFeedErrorBoundary>
                <OfflineFirstActivityFeed />
              </ActivityFeedErrorBoundary>
            </div>
            <div className='lg:col-span-1 space-y-6'>
              <GitHubErrorBoundary>
                <OfflineFirstAISummaryCard />
              </GitHubErrorBoundary>

              {/* Additional offline info card when offline */}
              {networkStatus.isOffline && (
                <Card>
                  <CardHeader>
                    <CardTitle className='flex items-center gap-2 text-sm'>
                      <IconWifiOff className='size-4' />
                      Offline Mode Active
                    </CardTitle>
                  </CardHeader>
                  <CardContent className='space-y-3'>
                    <div className='text-sm text-muted-foreground'>
                      <p className='mb-2'>
                        You're currently offline. The dashboard is showing
                        cached data where available.
                      </p>
                      <ul className='space-y-1 text-xs'>
                        <li>• Activity feed shows cached activities</li>
                        <li>• AI summaries from cache (if available)</li>
                        <li>• External links are disabled</li>
                        <li>• New data sync is paused</li>
                      </ul>
                    </div>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => window.location.reload()}
                      className='w-full flex items-center gap-2'
                    >
                      <IconRefresh className='size-4' />
                      Check Connection
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
