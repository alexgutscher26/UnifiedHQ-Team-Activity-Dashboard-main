'use client';

import React, { useState, useEffect } from 'react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useNetworkStatusContext } from '@/contexts/network-status-context';
import { cn } from '@/lib/utils';
import {
  IconLoader2,
  IconCheck,
  IconX,
  IconWifi,
  IconWifiOff,
  IconClock,
  IconAlertTriangle,
  IconRefresh,
} from '@tabler/icons-react';

interface SyncProgress {
  total: number;
  processed: number;
  failed: number;
  current?: string;
  isRunning: boolean;
  startTime?: number;
  endTime?: number;
}

interface SyncProgressIndicatorProps {
  className?: string;
  variant?: 'compact' | 'detailed' | 'toast';
  showControls?: boolean;
  autoHide?: boolean;
  autoHideDelay?: number;
}

/**
 * Displays a synchronization progress indicator with controls for triggering and canceling sync operations.
 *
 * The component manages its visibility based on the sync state and updates the progress every 2 seconds.
 * It fetches sync progress from an API and handles user interactions for starting and canceling sync operations,
 * while providing feedback through toast notifications. The component also formats and displays the duration
 * of the sync process and handles network status changes.
 *
 * @param className - Additional class names for styling the component.
 * @param variant - The display variant of the progress indicator, either 'compact' or 'toast'.
 * @param showControls - A flag to show or hide control buttons for sync operations.
 * @param autoHide - A flag to automatically hide the indicator after sync completion.
 * @param autoHideDelay - The delay in milliseconds before the indicator hides automatically after sync completion.
 */
export function SyncProgressIndicator({
  className,
  variant = 'compact',
  showControls = true,
  autoHide = true,
  autoHideDelay = 5000,
}: SyncProgressIndicatorProps) {
  const { toast } = useToast();
  const networkStatus = useNetworkStatusContext();
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<{
    success: boolean;
    timestamp: number;
    message: string;
  } | null>(null);

  useEffect(() => {
    loadSyncProgress();

    // Set up periodic refresh
    const interval = setInterval(loadSyncProgress, 2000); // Every 2 seconds

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Show/hide logic based on sync state
    if (progress?.isRunning) {
      setIsVisible(true);
    } else if (progress && !progress.isRunning && autoHide) {
      // Hide after delay when sync completes
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, autoHideDelay);

      return () => clearTimeout(timer);
    }
  }, [progress?.isRunning, autoHide, autoHideDelay]);

  /**
   * Loads the synchronization progress from the server.
   *
   * This function fetches the current sync progress from the '/api/offline/sync/progress' endpoint.
   * If the response is successful, it updates the progress state with the retrieved data.
   * Additionally, it checks for a completed sync and updates the last sync result if available.
   * Errors during the fetch operation are logged to the console.
   */
  const loadSyncProgress = async () => {
    try {
      const response = await fetch('/api/offline/sync/progress');
      if (response.ok) {
        const data = await response.json();
        setProgress(data.progress);

        // Check for completed sync
        if (data.lastResult) {
          setLastSyncResult(data.lastResult);
        }
      }
    } catch (error) {
      console.error('Failed to load sync progress:', error);
    }
  };

  /**
   * Triggers synchronization of offline actions with the server.
   *
   * This function first checks the network status to ensure the user is online. If not, it displays a toast notification indicating that synchronization cannot proceed. If online, it attempts to send a POST request to the server to trigger the sync. Upon a successful response, it shows a toast notification for sync initiation, makes a progress indicator visible, and sets a timeout to refresh the sync progress. If the request fails, it catches the error and displays a failure notification.
   */
  const triggerSync = async () => {
    if (!networkStatus.isOnline) {
      toast({
        title: 'Cannot Sync',
        description: 'You need to be online to sync offline actions.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await fetch('/api/offline/sync/trigger', {
        method: 'POST',
      });

      if (response.ok) {
        toast({
          title: 'Sync Started',
          description: 'Offline actions are being synchronized.',
        });

        // Show progress indicator
        setIsVisible(true);

        // Refresh progress immediately
        setTimeout(loadSyncProgress, 500);
      } else {
        throw new Error('Failed to trigger sync');
      }
    } catch (error) {
      toast({
        title: 'Sync Failed',
        description: 'Failed to start synchronization. Please try again.',
        variant: 'destructive',
      });
    }
  };

  /**
   * Cancels the synchronization process.
   *
   * This function sends a POST request to the '/api/offline/sync/cancel' endpoint to cancel the ongoing synchronization.
   * If the request is successful, it displays a success message and calls the loadSyncProgress function to update the UI.
   * In case of an error during the request, it shows a failure message indicating that the cancellation has failed.
   */
  const cancelSync = async () => {
    try {
      const response = await fetch('/api/offline/sync/cancel', {
        method: 'POST',
      });

      if (response.ok) {
        toast({
          title: 'Sync Cancelled',
          description: 'Synchronization has been cancelled.',
        });
        loadSyncProgress();
      }
    } catch (error) {
      toast({
        title: 'Cancel Failed',
        description: 'Failed to cancel synchronization.',
        variant: 'destructive',
      });
    }
  };

  /**
   * Formats the duration between two timestamps.
   *
   * This function calculates the duration in seconds or minutes and seconds between the provided startTime and endTime.
   * If endTime is not provided, the current time is used. The function returns a string representation of the duration
   * in a human-readable format, either in seconds or in minutes and seconds.
   *
   * @param {number} [startTime] - The starting timestamp in milliseconds.
   * @param {number} [endTime] - The ending timestamp in milliseconds. If not provided, the current time is used.
   */
  const formatDuration = (startTime?: number, endTime?: number) => {
    if (!startTime) return '';

    const end = endTime || Date.now();
    const duration = Math.floor((end - startTime) / 1000);

    if (duration < 60) {
      return `${duration}s`;
    } else {
      const minutes = Math.floor(duration / 60);
      const seconds = duration % 60;
      return `${minutes}m ${seconds}s`;
    }
  };

  /**
   * Calculates the progress percentage based on processed and total values.
   */
  const getProgressPercentage = () => {
    if (!progress || progress.total === 0) return 0;
    return Math.round((progress.processed / progress.total) * 100);
  };

  /**
   * Returns the appropriate synchronization status icon based on the current progress and last sync result.
   *
   * The function checks if a sync process is currently running, in which case it returns a loading icon.
   * If the sync has completed, it evaluates the last sync result to determine whether to display a success or failure icon.
   * If there is no sync activity, it defaults to a clock icon indicating pending status.
   */
  const getSyncStatusIcon = () => {
    if (progress?.isRunning) {
      return <IconLoader2 className='size-4 animate-spin text-blue-500' />;
    }

    if (lastSyncResult) {
      return lastSyncResult.success ? (
        <IconCheck className='size-4 text-green-500' />
      ) : (
        <IconX className='size-4 text-red-500' />
      );
    }

    return <IconClock className='size-4 text-gray-500' />;
  };

  const getSyncStatusText = () => {
    if (progress?.isRunning) {
      return `Syncing ${progress.processed}/${progress.total} actions...`;
    }

    if (lastSyncResult) {
      return lastSyncResult.message;
    }

    return 'No recent sync activity';
  };

  // Don't render if not visible and not running
  if (!isVisible && !progress?.isRunning) {
    return null;
  }

  if (variant === 'toast') {
    return (
      <div className={cn('fixed bottom-4 right-4 z-50 max-w-sm', className)}>
        <Card className='shadow-lg border-l-4 border-l-blue-500'>
          <CardContent className='p-4'>
            <div className='flex items-center gap-3'>
              {getSyncStatusIcon()}
              <div className='flex-1'>
                <p className='text-sm font-medium'>{getSyncStatusText()}</p>
                {progress?.isRunning && (
                  <Progress
                    value={getProgressPercentage()}
                    className='h-2 mt-2'
                  />
                )}
              </div>
              {showControls && progress?.isRunning && (
                <Button size='sm' variant='ghost' onClick={cancelSync}>
                  <IconX className='size-4' />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div
        className={cn(
          'flex items-center gap-2 p-2 rounded-lg bg-muted/50',
          className
        )}
      >
        {getSyncStatusIcon()}
        <div className='flex-1'>
          <div className='flex items-center gap-2'>
            <span className='text-sm font-medium'>
              {progress?.isRunning ? 'Syncing' : 'Sync Status'}
            </span>
            {networkStatus.isOnline ? (
              <IconWifi className='size-3 text-green-500' />
            ) : (
              <IconWifiOff className='size-3 text-red-500' />
            )}
          </div>
          {progress?.isRunning && (
            <Progress value={getProgressPercentage()} className='h-1 mt-1' />
          )}
        </div>
        {showControls && (
          <div className='flex gap-1'>
            {progress?.isRunning ? (
              <Button size='sm' variant='ghost' onClick={cancelSync}>
                <IconX className='size-3' />
              </Button>
            ) : (
              <Button
                size='sm'
                variant='ghost'
                onClick={triggerSync}
                disabled={!networkStatus.isOnline}
              >
                <IconRefresh className='size-3' />
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  // Detailed variant
  return (
    <Card className={className}>
      <CardContent className='p-4 space-y-4'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            {getSyncStatusIcon()}
            <h4 className='font-medium'>Sync Status</h4>
            <Badge variant={networkStatus.isOnline ? 'default' : 'destructive'}>
              {networkStatus.isOnline ? 'Online' : 'Offline'}
            </Badge>
          </div>
          {showControls && (
            <div className='flex gap-2'>
              {progress?.isRunning ? (
                <Button size='sm' variant='outline' onClick={cancelSync}>
                  <IconX className='size-4 mr-2' />
                  Cancel
                </Button>
              ) : (
                <Button
                  size='sm'
                  onClick={triggerSync}
                  disabled={!networkStatus.isOnline}
                >
                  <IconRefresh className='size-4 mr-2' />
                  Sync Now
                </Button>
              )}
            </div>
          )}
        </div>

        {progress?.isRunning && (
          <div className='space-y-2'>
            <div className='flex items-center justify-between text-sm'>
              <span>Progress</span>
              <span>
                {progress.processed}/{progress.total} actions
              </span>
            </div>
            <Progress value={getProgressPercentage()} className='h-2' />

            {progress.current && (
              <p className='text-xs text-muted-foreground'>
                Current: {progress.current}
              </p>
            )}

            {progress.failed > 0 && (
              <div className='flex items-center gap-1 text-xs text-red-600'>
                <IconAlertTriangle className='size-3' />
                <span>{progress.failed} failed</span>
              </div>
            )}

            <p className='text-xs text-muted-foreground'>
              Duration: {formatDuration(progress.startTime)}
            </p>
          </div>
        )}

        {!progress?.isRunning && lastSyncResult && (
          <div className='space-y-2'>
            <p className='text-sm text-muted-foreground'>
              {lastSyncResult.message}
            </p>
            <p className='text-xs text-muted-foreground'>
              Last sync: {new Date(lastSyncResult.timestamp).toLocaleString()}
            </p>
          </div>
        )}

        {networkStatus.isOffline && (
          <div className='p-3 bg-orange-50 border border-orange-200 rounded-lg'>
            <div className='flex items-center gap-2 text-orange-800'>
              <IconWifiOff className='size-4' />
              <span className='text-sm font-medium'>
                Offline - Sync will resume when connection is restored
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
