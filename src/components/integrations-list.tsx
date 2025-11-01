'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { SidebarMenuButton } from '@/components/ui/sidebar';
import { IconBrandGithub, IconBrandSlack, IconPlus } from '@tabler/icons-react';

interface Integration {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  connected: boolean;
  status: 'connected' | 'disconnected' | 'coming-soon';
  description?: string;
}

/**
 * Renders a list of integrations with their connection statuses.
 *
 * This function initializes the integrations state with Slack and GitHub integrations, fetching their connection statuses concurrently using asynchronous functions. It updates the state based on the fetched data and handles visibility changes and storage events to refresh the statuses. The function also provides click handlers for navigating to the integrations page and determining the status color and text for each integration.
 *
 * @returns {JSX.Element} The rendered integrations list component.
 */
export function IntegrationsList() {
  const router = useRouter();
  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      id: 'slack',
      title: 'Slack',
      icon: IconBrandSlack,
      connected: false,
      status: 'disconnected',
    },
    {
      id: 'github',
      title: 'GitHub',
      icon: IconBrandGithub,
      connected: false,
      status: 'disconnected',
    },
  ]);

  // Fetch integration connection status
  useEffect(() => {
    /**
     * Fetches the current status of the GitHub integration.
     *
     * This asynchronous function sends a request to the GitHub sync API endpoint.
     * If the response is successful, it updates the integration state by mapping
     * through the existing integrations and modifying the GitHub integration's
     * connection status based on the fetched data. In case of an error, it logs
     * the error message to the console.
     */
    const fetchGitHubStatus = async () => {
      try {
        const response = await fetch('/api/integrations/github/sync');
        if (response.ok) {
          const data = await response.json();
          setIntegrations(prev =>
            prev.map(integration =>
              integration.id === 'github'
                ? {
                  ...integration,
                  connected: data.connected,
                  status: data.connected ? 'connected' : 'disconnected',
                }
                : integration
            )
          );
        }
      } catch (error) {
        console.error('Failed to fetch GitHub status:', error);
      }
    };

    /**
     * Fetches the Slack integration status and updates the state accordingly.
     *
     * This asynchronous function makes a request to the Slack API to synchronize the integration status.
     * If the response is successful, it updates the state of integrations by mapping over the previous state
     * and modifying the Slack integration's connected status and status message based on the fetched data.
     * In case of an error during the fetch operation, it logs the error to the console.
     */
    const fetchSlackStatus = async () => {
      try {
        const response = await fetch('/api/integrations/slack/sync');
        if (response.ok) {
          const data = await response.json();
          setIntegrations(prev =>
            prev.map(integration =>
              integration.id === 'slack'
                ? {
                  ...integration,
                  connected: data.connected,
                  status: data.connected ? 'connected' : 'disconnected',
                }
                : integration
            )
          );
        }
      } catch (error) {
        console.error('Failed to fetch Slack status:', error);
      }
    };

    /**
     * Fetches statuses from GitHub and Slack concurrently.
     */
    const fetchAllStatuses = async () => {
      await Promise.all([fetchGitHubStatus(), fetchSlackStatus()]);
    };

    fetchAllStatuses();

    // Refresh status when the page becomes visible (user returns from integrations page)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchAllStatuses();
      }
    };

    // Listen for storage changes (when user connects/disconnects in another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'integration-status-changed') {
        fetchAllStatuses();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  /**
   * Navigates to the integrations page.
   */
  const handleIntegrationClick = useCallback((integration: Integration) => {
    // Navigate to integrations page
    router.push('/integrations');
  }, [router]);

  /**
   * Navigates to the integrations page for adding new integrations.
   */
  const handleAddIntegrationClick = useCallback(() => {
    router.push('/integrations');
  }, [router]);

  const getStatusColor = (status: Integration['status']) => {
    switch (status) {
      case 'connected':
        return 'bg-green-500';
      case 'disconnected':
        return 'bg-gray-300';
      case 'coming-soon':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-300';
    }
  };

  /**
   * Returns a user-friendly status text based on the provided integration status.
   *
   * The function evaluates the input status and returns a corresponding string that
   * represents the connection state. It handles specific cases for 'connected',
   * 'disconnected', and 'coming-soon', while returning 'Unknown' for any other status.
   *
   * @param status - The current status of the integration.
   */
  const getStatusText = (status: Integration['status']) => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'disconnected':
        return 'Not Connected';
      case 'coming-soon':
        return 'Coming Soon';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className='space-y-1'>
      {integrations.map(integration => (
        <SidebarMenuButton
          key={integration.id}
          asChild
          onClick={() => handleIntegrationClick(integration)}
          className='group relative cursor-pointer'
        >
          <button
            className='flex items-center gap-3 w-full text-left p-2 rounded-md hover:bg-accent transition-colors cursor-pointer'
            onClick={() => handleIntegrationClick(integration)}
          >
            <div className='flex-shrink-0'>
              <integration.icon className='size-4 text-muted-foreground group-hover:text-foreground transition-colors' />
            </div>
            <div className='flex-1 min-w-0'>
              <div className='flex items-center justify-between'>
                <span className='text-sm font-medium truncate'>
                  {integration.title}
                </span>
                <div className='flex items-center gap-2'>
                  <div
                    className={`size-2 rounded-full ${getStatusColor(integration.status)}`}
                    title={getStatusText(integration.status)}
                  />
                </div>
              </div>
              {integration.description && (
                <p className='text-xs text-muted-foreground truncate mt-0.5'>
                  {integration.description}
                </p>
              )}
            </div>
          </button>
        </SidebarMenuButton>
      ))}

      {/* Add Integration Button */}
      <SidebarMenuButton
        asChild
        onClick={handleAddIntegrationClick}
        className='group relative cursor-pointer'
      >
        <button
          className='flex items-center gap-3 w-full text-left p-2 rounded-md hover:bg-accent transition-colors border-t pt-3 mt-2 cursor-pointer'
          onClick={handleAddIntegrationClick}
        >
          <div className='flex-shrink-0'>
            <IconPlus className='size-4 text-muted-foreground group-hover:text-foreground transition-colors' />
          </div>
          <span className='text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors'>
            Add Integration
          </span>
        </button>
      </SidebarMenuButton>
    </div>
  );
}
