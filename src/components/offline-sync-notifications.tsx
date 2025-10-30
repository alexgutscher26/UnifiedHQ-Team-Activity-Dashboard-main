'use client';

import React, { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useNetworkStatusContext } from '@/contexts/network-status-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  IconCheck,
  IconX,
  IconAlertTriangle,
  IconWifi,
  IconWifiOff,
  IconRefresh,
  IconEye,
} from '@tabler/icons-react';

interface SyncResult {
  success: boolean;
  processedActions: number;
  failedActions: number;
  errors: Array<{ actionId: string; error: string }>;
  timestamp: number;
}

interface SyncNotification {
  id: string;
  type:
    | 'sync_complete'
    | 'sync_error'
    | 'network_restored'
    | 'conflict_detected';
  title: string;
  message: string;
  timestamp: number;
  data?: any;
  dismissed?: boolean;
}

/**
 * Manages offline synchronization notifications and network status.
 *
 * This function sets up event listeners for sync events and handles notifications based on the sync status. It monitors network connectivity and triggers synchronization when the network is restored. Notifications are displayed for various sync events, including success, failure, and conflicts, and are managed in a notification list.
 *
 * @returns null This function does not return any value.
 */
export function OfflineSyncNotifications() {
  const { toast } = useToast();
  const networkStatus = useNetworkStatusContext();
  const [notifications, setNotifications] = useState<SyncNotification[]>([]);
  const [lastNetworkState, setLastNetworkState] = useState(
    networkStatus.isOnline
  );

  useEffect(() => {
    // Listen for sync events
    const eventSource = new EventSource('/api/offline/sync/events');

    eventSource.onmessage = event => {
      try {
        const data = JSON.parse(event.data);
        handleSyncEvent(data);
      } catch (error) {
        console.error('Failed to parse sync event:', error);
      }
    };

    eventSource.onerror = error => {
      console.error('Sync event source error:', error);
    };

    return () => {
      eventSource.close();
    };
  }, []);

  useEffect(() => {
    // Handle network state changes
    if (lastNetworkState !== networkStatus.isOnline) {
      if (networkStatus.isOnline && !lastNetworkState) {
        // Just came back online
        handleNetworkRestored();
      }
      setLastNetworkState(networkStatus.isOnline);
    }
  }, [networkStatus.isOnline, lastNetworkState]);

  /**
   * Handles synchronization events and triggers corresponding notifications.
   *
   * The function processes different types of sync events, including 'sync_started', 'sync_completed', 'sync_failed', 'conflict_detected', and 'action_failed'.
   * For each event type, it calls the appropriate notification function with relevant data from the event.
   * If the event type is unknown, it logs a message to the console.
   *
   * @param event - The synchronization event object containing type and relevant data.
   */
  const handleSyncEvent = (event: any) => {
    switch (event.type) {
      case 'sync_started':
        showSyncStartedNotification();
        break;

      case 'sync_completed':
        showSyncCompletedNotification(event.result);
        break;

      case 'sync_failed':
        showSyncFailedNotification(event.error);
        break;

      case 'conflict_detected':
        showConflictDetectedNotification(event.conflict);
        break;

      case 'action_failed':
        showActionFailedNotification(event.action, event.error);
        break;

      default:
        console.log('Unknown sync event:', event);
    }
  };

  /**
   * Displays a notification indicating that synchronization has started.
   */
  const showSyncStartedNotification = () => {
    toast({
      title: 'Sync Started',
      description: 'Synchronizing offline actions...',
      duration: 3000,
    });
  };

  /**
   * Displays a notification indicating the completion status of a synchronization process.
   *
   * The function checks the number of failed actions in the provided result. If there are no failed actions, it shows a success notification with the number of processed actions. If there are failed actions, it displays a notification indicating the number of successes and failures. Additionally, it adds a notification entry to the notifications list for tracking purposes.
   *
   * @param result - The result of the synchronization process, containing processedActions and failedActions.
   */
  const showSyncCompletedNotification = (result: SyncResult) => {
    const { processedActions, failedActions } = result;

    if (failedActions === 0) {
      // All actions succeeded
      toast({
        title: 'Sync Complete',
        description: `Successfully synchronized ${processedActions} action${processedActions !== 1 ? 's' : ''}.`,
        duration: 5000,
        action: {
          label: 'View Details',
          onClick: () => showSyncDetails(result),
        },
      });
    } else {
      // Some actions failed
      toast({
        title: 'Sync Completed with Issues',
        description: `${processedActions} succeeded, ${failedActions} failed.`,
        variant: 'destructive',
        duration: 0, // Don't auto-dismiss
        action: {
          label: 'View Errors',
          onClick: () => showSyncErrors(result),
        },
      });
    }

    // Add to notifications list
    addNotification({
      type: 'sync_complete',
      title:
        failedActions === 0 ? 'Sync Complete' : 'Sync Completed with Issues',
      message: `${processedActions} succeeded${failedActions > 0 ? `, ${failedActions} failed` : ''}`,
      data: result,
    });
  };

  const showSyncFailedNotification = (error: string) => {
    toast({
      title: 'Sync Failed',
      description: error,
      variant: 'destructive',
      duration: 0, // Don't auto-dismiss
      action: {
        label: 'Retry',
        onClick: () => triggerSync(),
      },
    });

    addNotification({
      type: 'sync_error',
      title: 'Sync Failed',
      message: error,
    });
  };

  /**
   * Displays a notification for detected data conflicts requiring manual resolution.
   */
  const showConflictDetectedNotification = (conflict: any) => {
    toast({
      title: 'Data Conflict Detected',
      description: 'Manual resolution required for some changes.',
      variant: 'destructive',
      duration: 0, // Don't auto-dismiss
      action: {
        label: 'Resolve',
        onClick: () => openConflictResolution(conflict),
      },
    });

    addNotification({
      type: 'conflict_detected',
      title: 'Data Conflict',
      message: 'Manual resolution required',
      data: conflict,
    });
  };

  /**
   * Displays a notification for failed actions if the retry count exceeds 3.
   */
  const showActionFailedNotification = (action: any, error: string) => {
    // Only show toast for critical failures, not retryable ones
    if (action.retryCount >= 3) {
      toast({
        title: 'Action Failed',
        description: `Failed to sync ${action.type.toLowerCase()} ${action.resource}: ${error}`,
        variant: 'destructive',
        duration: 8000,
      });
    }
  };

  const handleNetworkRestored = () => {
    toast({
      title: 'Connection Restored',
      description: "You're back online! Checking for pending actions...",
      duration: 5000,
      action: {
        label: 'Sync Now',
        onClick: () => triggerSync(),
      },
    });

    addNotification({
      type: 'network_restored',
      title: 'Connection Restored',
      message: 'Back online - ready to sync pending actions',
    });

    // Auto-trigger sync after a short delay
    setTimeout(() => {
      checkAndAutoSync();
    }, 2000);
  };

  /**
   * Checks for pending actions and triggers synchronization if necessary.
   *
   * This function fetches the current statistics of the offline queue from the API.
   * If the response indicates that there are pending actions, it calls the triggerSync function
   * to initiate synchronization. Errors during the fetch operation are logged to the console.
   */
  const checkAndAutoSync = async () => {
    try {
      const response = await fetch('/api/offline/queue/stats');
      if (response.ok) {
        const stats = await response.json();
        if (stats.pendingActions > 0) {
          // Auto-trigger sync if there are pending actions
          triggerSync();
        }
      }
    } catch (error) {
      console.error('Failed to check pending actions:', error);
    }
  };

  /**
   * Triggers a synchronization process by sending a POST request to the server.
   *
   * This function attempts to fetch the endpoint '/api/offline/sync/trigger' to initiate the sync.
   * If the response is not successful, it throws an error. In case of any errors during the fetch operation,
   * a toast notification is displayed to inform the user that the synchronization has failed.
   */
  const triggerSync = async () => {
    try {
      const response = await fetch('/api/offline/sync/trigger', {
        method: 'POST',
      });

      if (!response.ok) {
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

  const showSyncDetails = (result: SyncResult) => {
    // This would open a detailed view of sync results
    console.log('Sync details:', result);

    toast({
      title: 'Sync Details',
      description: `Processed: ${result.processedActions}, Failed: ${result.failedActions}`,
      duration: 5000,
    });
  };

  /**
   * Displays synchronization errors in a toast notification.
   */
  const showSyncErrors = (result: SyncResult) => {
    // This would open a detailed error view
    console.log('Sync errors:', result.errors);

    const errorCount = result.errors.length;
    toast({
      title: `${errorCount} Sync Error${errorCount !== 1 ? 's' : ''}`,
      description: result.errors
        .slice(0, 2)
        .map(e => e.error)
        .join(', '),
      variant: 'destructive',
      duration: 0,
    });
  };

  const openConflictResolution = (conflict: any) => {
    // This would open the conflict resolution dialog
    console.log('Opening conflict resolution for:', conflict);

    // For now, just show a toast
    toast({
      title: 'Conflict Resolution',
      description: 'Opening conflict resolution interface...',
    });
  };

  /**
   * Adds a new notification to the list, generating a unique id and timestamp.
   */
  const addNotification = (
    notification: Omit<SyncNotification, 'id' | 'timestamp'>
  ) => {
    const newNotification: SyncNotification = {
      ...notification,
      id: `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    setNotifications(prev => [newNotification, ...prev.slice(0, 9)]); // Keep last 10
  };

  const dismissNotification = (id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, dismissed: true } : n))
    );
  };

  /**
   * Clears all notifications by setting the notifications state to an empty array.
   */
  const clearAllNotifications = () => {
    setNotifications([]);
  };

  // This component doesn't render UI directly - it manages notifications via toast
  // But we can return a small notification center if needed
  return null;
}

// Notification Center Component (optional UI component)
export function NotificationCenter() {
  const [notifications, setNotifications] = useState<SyncNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Load notifications from localStorage or API
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const response = await fetch('/api/offline/notifications');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  };

  /**
   * Get the appropriate notification icon based on the notification type.
   *
   * The function uses a switch statement to determine which icon to return based on the provided type.
   * It handles various notification types such as 'sync_complete', 'sync_error', 'network_restored',
   * and 'conflict_detected', returning a default icon for any unrecognized type.
   *
   * @param type - The type of the notification, which determines the icon to be returned.
   * @returns A JSX element representing the corresponding notification icon.
   */
  const getNotificationIcon = (type: SyncNotification['type']) => {
    switch (type) {
      case 'sync_complete':
        return <IconCheck className='size-4 text-green-500' />;
      case 'sync_error':
        return <IconX className='size-4 text-red-500' />;
      case 'network_restored':
        return <IconWifi className='size-4 text-blue-500' />;
      case 'conflict_detected':
        return <IconAlertTriangle className='size-4 text-orange-500' />;
      default:
        return <IconAlertTriangle className='size-4 text-gray-500' />;
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const unreadCount = notifications.filter(n => !n.dismissed).length;

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className='relative'>
      <Button
        variant='ghost'
        size='sm'
        onClick={() => setIsOpen(!isOpen)}
        className='relative'
      >
        <IconEye className='size-4' />
        {unreadCount > 0 && (
          <Badge
            variant='destructive'
            className='absolute -top-1 -right-1 size-5 text-xs p-0 flex items-center justify-center'
          >
            {unreadCount}
          </Badge>
        )}
      </Button>

      {isOpen && (
        <div className='absolute right-0 top-full mt-2 w-80 bg-white border rounded-lg shadow-lg z-50'>
          <div className='p-3 border-b'>
            <div className='flex items-center justify-between'>
              <h3 className='font-medium'>Sync Notifications</h3>
              <Button
                variant='ghost'
                size='sm'
                onClick={() => setNotifications([])}
              >
                Clear All
              </Button>
            </div>
          </div>

          <div className='max-h-64 overflow-y-auto'>
            {notifications.map(notification => (
              <div
                key={notification.id}
                className={`p-3 border-b last:border-b-0 ${
                  notification.dismissed ? 'opacity-50' : ''
                }`}
              >
                <div className='flex items-start gap-3'>
                  {getNotificationIcon(notification.type)}
                  <div className='flex-1'>
                    <h4 className='text-sm font-medium'>
                      {notification.title}
                    </h4>
                    <p className='text-xs text-muted-foreground'>
                      {notification.message}
                    </p>
                    <p className='text-xs text-muted-foreground mt-1'>
                      {formatTimestamp(notification.timestamp)}
                    </p>
                  </div>
                  {!notification.dismissed && (
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => {
                        setNotifications(prev =>
                          prev.map(n =>
                            n.id === notification.id
                              ? { ...n, dismissed: true }
                              : n
                          )
                        );
                      }}
                    >
                      <IconX className='size-3' />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
