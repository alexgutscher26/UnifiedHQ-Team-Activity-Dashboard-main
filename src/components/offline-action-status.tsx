'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { cn } from '@/lib/utils';
import {
  IconClock,
  IconCheck,
  IconX,
  IconLoader2,
  IconChevronDown,
  IconChevronUp,
  IconRefresh,
  IconTrash,
  IconAlertTriangle,
  IconDatabase,
  IconWifi,
  IconWifiOff,
} from '@tabler/icons-react';

interface OfflineAction {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  resource: string;
  payload: any;
  timestamp: number;
  retryCount: number;
  status: 'PENDING' | 'SYNCING' | 'COMPLETED' | 'FAILED';
  lastAttempt?: number;
  error?: string;
}

interface QueueStats {
  totalActions: number;
  pendingActions: number;
  failedActions: number;
  completedActions: number;
  lastSync?: number;
}

interface SyncProgress {
  total: number;
  processed: number;
  failed: number;
  current?: string;
  isRunning: boolean;
  startTime?: number;
  endTime?: number;
}

/**
 * Manages the offline action status, including loading actions, syncing, and displaying status.
 *
 * This function initializes state variables for actions, stats, sync progress, and loading/error states.
 * It sets up an effect to load action data periodically and provides methods to trigger sync, clear completed actions,
 * and retry failed actions. The UI reflects the current network status and displays relevant action information.
 *
 * @returns {JSX.Element} The rendered component displaying offline actions and their statuses.
 */
export function OfflineActionStatus() {
  const { toast } = useToast();
  const networkStatus = useNetworkStatus();
  const [actions, setActions] = useState<OfflineAction[]>([]);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadActionData();

    // Set up periodic refresh
    const interval = setInterval(loadActionData, 5000); // Every 5 seconds

    return () => clearInterval(interval);
  }, []);

  /**
   * Load action data from various API endpoints.
   *
   * This function fetches queue statistics, recent actions, and sync progress from the server. It handles errors by setting an error message and ensures that loading state is updated accordingly. Each fetch operation checks for a successful response before processing the data and updating the respective state.
   *
   * @returns {Promise<void>} A promise that resolves when the data loading is complete.
   * @throws {Error} If an error occurs during the fetch operations.
   */
  const loadActionData = async () => {
    try {
      setError(null);

      // Load queue stats
      const statsResponse = await fetch('/api/offline/queue/stats');
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }

      // Load recent actions
      const actionsResponse = await fetch(
        '/api/offline/queue/actions?limit=20'
      );
      if (actionsResponse.ok) {
        const actionsData = await actionsResponse.json();
        setActions(actionsData.actions || []);
      }

      // Load sync progress if available
      const progressResponse = await fetch('/api/offline/sync/progress');
      if (progressResponse.ok) {
        const progressData = await progressResponse.json();
        setSyncProgress(progressData.progress);
      }
    } catch (error) {
      console.error('Failed to load offline action data:', error);
      setError('Failed to load offline action data');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Triggers synchronization of offline actions with the server.
   *
   * This function first checks the network status to ensure the user is online. If offline, it displays a toast notification indicating that synchronization cannot proceed. If online, it attempts to send a POST request to the server to trigger the sync. Upon a successful response, it notifies the user that synchronization has started and refreshes the action data after a short delay. In case of an error during the fetch operation, it displays a failure notification.
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

        // Refresh data to show updated progress
        setTimeout(loadActionData, 1000);
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
   * Clears completed actions from the offline queue.
   *
   * This function sends a POST request to the '/api/offline/queue/cleanup' endpoint to initiate the cleanup process.
   * If the response is successful, it displays a success toast notification and calls the loadActionData function to refresh the action data.
   * In case of an error, it catches the exception and displays a failure toast notification.
   */
  const clearCompletedActions = async () => {
    try {
      const response = await fetch('/api/offline/queue/cleanup', {
        method: 'POST',
      });

      if (response.ok) {
        toast({
          title: 'Cleanup Complete',
          description: 'Completed actions have been cleared.',
        });
        loadActionData();
      } else {
        throw new Error('Failed to cleanup actions');
      }
    } catch (error) {
      toast({
        title: 'Cleanup Failed',
        description: 'Failed to clear completed actions.',
        variant: 'destructive',
      });
    }
  };

  /**
   * Retries a failed action by sending a POST request to the server.
   *
   * This function attempts to retry an action identified by the given actionId.
   * It sends a request to the server and, upon a successful response, displays a
   * success message and triggers the loading of action data. If the request fails,
   * it catches the error and displays a failure message.
   *
   * @param actionId - The identifier of the action to be retried.
   */
  const retryFailedAction = async (actionId: string) => {
    try {
      const response = await fetch(`/api/offline/queue/retry/${actionId}`, {
        method: 'POST',
      });

      if (response.ok) {
        toast({
          title: 'Action Queued',
          description: 'Failed action has been queued for retry.',
        });
        loadActionData();
      } else {
        throw new Error('Failed to retry action');
      }
    } catch (error) {
      toast({
        title: 'Retry Failed',
        description: 'Failed to queue action for retry.',
        variant: 'destructive',
      });
    }
  };

  /**
   * Get the appropriate status icon based on the provided status.
   *
   * The function evaluates the status and returns a corresponding icon component.
   * It handles multiple cases including 'PENDING', 'SYNCING', 'COMPLETED', and 'FAILED',
   * defaulting to a gray clock icon if the status does not match any known values.
   *
   * @param status - The status for which the icon is to be retrieved.
   * @returns A JSX element representing the status icon.
   */
  const getStatusIcon = (status: OfflineAction['status']) => {
    switch (status) {
      case 'PENDING':
        return <IconClock className='size-4 text-yellow-500' />;
      case 'SYNCING':
        return <IconLoader2 className='size-4 text-blue-500 animate-spin' />;
      case 'COMPLETED':
        return <IconCheck className='size-4 text-green-500' />;
      case 'FAILED':
        return <IconX className='size-4 text-red-500' />;
      default:
        return <IconClock className='size-4 text-gray-500' />;
    }
  };

  /**
   * Get the badge variant based on the status of an OfflineAction.
   *
   * The function maps specific status values to corresponding badge variants. It handles multiple cases, returning 'secondary' for both unrecognized and 'PENDING' statuses, 'default' for 'SYNCING' and 'COMPLETED', and 'destructive' for 'FAILED'.
   *
   * @param status - The status of the OfflineAction, which determines the badge variant.
   * @returns The badge variant as a string based on the provided status.
   */
  const getStatusBadgeVariant = (status: OfflineAction['status']) => {
    switch (status) {
      case 'PENDING':
        return 'secondary';
      case 'SYNCING':
        return 'default';
      case 'COMPLETED':
        return 'default';
      case 'FAILED':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  /**
   * Formats a timestamp into a locale-specific string representation.
   */
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const formatActionDescription = (action: OfflineAction) => {
    const { type, resource, payload } = action;

    switch (type) {
      case 'CREATE':
        return `Create ${resource}`;
      case 'UPDATE':
        return `Update ${resource} (${payload.id || 'unknown'})`;
      case 'DELETE':
        return `Delete ${resource} (${payload.id || 'unknown'})`;
      default:
        return `${type} ${resource}`;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <IconDatabase className='size-5' />
            Offline Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='flex items-center justify-center py-8'>
            <IconLoader2 className='size-6 animate-spin' />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <IconDatabase className='size-5' />
            Offline Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='text-center py-8'>
            <IconAlertTriangle className='size-12 text-red-500 mx-auto mb-4' />
            <p className='text-muted-foreground'>{error}</p>
            <Button variant='outline' onClick={loadActionData} className='mt-4'>
              <IconRefresh className='size-4 mr-2' />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasActions = stats && stats.totalActions > 0;
  const hasPendingActions = stats && stats.pendingActions > 0;
  const hasFailedActions = stats && stats.failedActions > 0;

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <CardTitle className='flex items-center gap-2'>
            <IconDatabase className='size-5' />
            Offline Actions
            {networkStatus.isOffline && (
              <Badge variant='destructive' className='text-xs'>
                <IconWifiOff className='size-3 mr-1' />
                Offline
              </Badge>
            )}
          </CardTitle>
          <div className='flex items-center gap-2'>
            {networkStatus.isOnline ? (
              <IconWifi className='size-4 text-green-500' />
            ) : (
              <IconWifiOff className='size-4 text-red-500' />
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className='space-y-4'>
        {/* Stats Summary */}
        {stats && (
          <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
            <div className='text-center'>
              <div className='text-2xl font-bold text-yellow-600'>
                {stats.pendingActions}
              </div>
              <div className='text-xs text-muted-foreground'>Pending</div>
            </div>
            <div className='text-center'>
              <div className='text-2xl font-bold text-red-600'>
                {stats.failedActions}
              </div>
              <div className='text-xs text-muted-foreground'>Failed</div>
            </div>
            <div className='text-center'>
              <div className='text-2xl font-bold text-green-600'>
                {stats.completedActions}
              </div>
              <div className='text-xs text-muted-foreground'>Completed</div>
            </div>
            <div className='text-center'>
              <div className='text-2xl font-bold'>{stats.totalActions}</div>
              <div className='text-xs text-muted-foreground'>Total</div>
            </div>
          </div>
        )}

        {/* Sync Progress */}
        {syncProgress?.isRunning && (
          <div className='space-y-2'>
            <div className='flex items-center justify-between text-sm'>
              <span>Syncing actions...</span>
              <span>
                {syncProgress.processed}/{syncProgress.total}
              </span>
            </div>
            <Progress
              value={(syncProgress.processed / syncProgress.total) * 100}
              className='h-2'
            />
            {syncProgress.current && (
              <p className='text-xs text-muted-foreground'>
                Current: {syncProgress.current}
              </p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className='flex gap-2'>
          <Button
            onClick={triggerSync}
            disabled={
              !networkStatus.isOnline ||
              !hasPendingActions ||
              syncProgress?.isRunning
            }
            size='sm'
            className='flex-1'
          >
            {syncProgress?.isRunning ? (
              <IconLoader2 className='size-4 mr-2 animate-spin' />
            ) : (
              <IconRefresh className='size-4 mr-2' />
            )}
            {syncProgress?.isRunning ? 'Syncing...' : 'Sync Now'}
          </Button>

          {stats && stats.completedActions > 0 && (
            <Button onClick={clearCompletedActions} variant='outline' size='sm'>
              <IconTrash className='size-4 mr-2' />
              Clear Completed
            </Button>
          )}
        </div>

        {/* No Actions State */}
        {!hasActions && (
          <div className='text-center py-8'>
            <IconCheck className='size-12 text-green-500 mx-auto mb-4' />
            <h4 className='font-medium mb-2'>All Caught Up!</h4>
            <p className='text-sm text-muted-foreground'>
              No offline actions in queue. All your changes are synchronized.
            </p>
          </div>
        )}

        {/* Actions List */}
        {hasActions && (
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant='ghost' className='w-full justify-between p-0'>
                <span className='text-sm font-medium'>
                  Recent Actions ({actions.length})
                </span>
                {isExpanded ? (
                  <IconChevronUp className='size-4' />
                ) : (
                  <IconChevronDown className='size-4' />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className='space-y-2 mt-4'>
              <ScrollArea className='h-64'>
                <div className='space-y-2 pr-4'>
                  {actions.map(action => (
                    <div
                      key={action.id}
                      className={cn(
                        'flex items-start gap-3 p-3 rounded-lg border',
                        action.status === 'FAILED' &&
                          'border-red-200 bg-red-50',
                        action.status === 'COMPLETED' &&
                          'border-green-200 bg-green-50',
                        action.status === 'SYNCING' &&
                          'border-blue-200 bg-blue-50',
                        action.status === 'PENDING' &&
                          'border-yellow-200 bg-yellow-50'
                      )}
                    >
                      <div className='flex-shrink-0 mt-0.5'>
                        {getStatusIcon(action.status)}
                      </div>
                      <div className='flex-1 min-w-0'>
                        <div className='flex items-center gap-2 mb-1'>
                          <h4 className='text-sm font-medium'>
                            {formatActionDescription(action)}
                          </h4>
                          <Badge
                            variant={getStatusBadgeVariant(action.status)}
                            className='text-xs'
                          >
                            {action.status}
                          </Badge>
                        </div>
                        <p className='text-xs text-muted-foreground mb-1'>
                          {formatTimestamp(action.timestamp)}
                        </p>
                        {action.retryCount > 0 && (
                          <p className='text-xs text-orange-600'>
                            Retry attempt: {action.retryCount}
                          </p>
                        )}
                        {action.error && (
                          <p className='text-xs text-red-600 mt-1'>
                            Error: {action.error}
                          </p>
                        )}
                      </div>
                      {action.status === 'FAILED' && (
                        <Button
                          size='sm'
                          variant='outline'
                          onClick={() => retryFailedAction(action.id)}
                          disabled={!networkStatus.isOnline}
                        >
                          <IconRefresh className='size-3' />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Network Status Notice */}
        {networkStatus.isOffline && hasPendingActions && (
          <div className='p-3 bg-orange-50 border border-orange-200 rounded-lg'>
            <div className='flex items-center gap-2 text-orange-800'>
              <IconWifiOff className='size-4' />
              <span className='text-sm font-medium'>
                Offline - Actions will sync when connection is restored
              </span>
            </div>
            <p className='text-xs text-orange-600 mt-1'>
              {stats?.pendingActions} action(s) waiting to be synchronized.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
