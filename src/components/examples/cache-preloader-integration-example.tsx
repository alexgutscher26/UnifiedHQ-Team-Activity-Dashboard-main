/**
 * Example integration of cache preloader in a dashboard component
 * This shows how to integrate intelligent cache preloading into existing components
 */

'use client';

import { useEffect } from 'react';
import {
  useNavigationTracking,
  usePreloadRecommendations,
} from '@/hooks/use-cache-preloader';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface DashboardWithPreloadingProps {
  userId?: string;
}

export function DashboardWithPreloading({
  userId,
}: DashboardWithPreloadingProps) {
  const { trackNavigation } = useNavigationTracking();
  const { recommendations, isLoading } = usePreloadRecommendations();

  // Track navigation when component mounts
  useEffect(() => {
    trackNavigation('/dashboard');
  }, [trackNavigation]);

  // Example of tracking specific user actions
  const handleViewGitHub = () => {
    trackNavigation('/dashboard/github');
    // Navigate to GitHub section
  };

  const handleViewSlack = () => {
    trackNavigation('/dashboard/slack');
    // Navigate to Slack section
  };

  const handleViewAISummary = () => {
    trackNavigation('/dashboard/ai-summary');
    // Navigate to AI summary section
  };

  return (
    <div className='space-y-6'>
      <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
        <Card
          className='cursor-pointer hover:shadow-md transition-shadow'
          onClick={handleViewGitHub}
        >
          <CardHeader>
            <CardTitle>GitHub Activity</CardTitle>
            <CardDescription>Recent commits and pull requests</CardDescription>
          </CardHeader>
          <CardContent>
            <p className='text-2xl font-bold'>12</p>
            <p className='text-sm text-muted-foreground'>commits today</p>
          </CardContent>
        </Card>

        <Card
          className='cursor-pointer hover:shadow-md transition-shadow'
          onClick={handleViewSlack}
        >
          <CardHeader>
            <CardTitle>Slack Messages</CardTitle>
            <CardDescription>Team communication updates</CardDescription>
          </CardHeader>
          <CardContent>
            <p className='text-2xl font-bold'>45</p>
            <p className='text-sm text-muted-foreground'>messages today</p>
          </CardContent>
        </Card>

        <Card
          className='cursor-pointer hover:shadow-md transition-shadow'
          onClick={handleViewAISummary}
        >
          <CardHeader>
            <CardTitle>AI Summary</CardTitle>
            <CardDescription>Daily activity insights</CardDescription>
          </CardHeader>
          <CardContent>
            <p className='text-2xl font-bold'>Ready</p>
            <p className='text-sm text-muted-foreground'>updated 1h ago</p>
          </CardContent>
        </Card>
      </div>

      {/* Show preload recommendations */}
      {recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recommended Sections</CardTitle>
            <CardDescription>
              Based on your usage patterns, these sections might be of interest
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className='text-muted-foreground'>
                Loading recommendations...
              </p>
            ) : (
              <div className='flex flex-wrap gap-2'>
                {recommendations.map((path, index) => (
                  <Badge
                    key={index}
                    variant='secondary'
                    className='cursor-pointer hover:bg-secondary/80'
                    onClick={() => trackNavigation(path)}
                  >
                    {path.replace('/dashboard/', '').replace('/', '') || 'Home'}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * Example of a navigation component that tracks user movement
 */
export function NavigationWithTracking() {
  const { trackNavigation } = useNavigationTracking();

  const navigationItems = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/dashboard/github', label: 'GitHub' },
    { path: '/dashboard/slack', label: 'Slack' },
    { path: '/dashboard/ai-summary', label: 'AI Summary' },
    { path: '/settings', label: 'Settings' },
  ];

  const handleNavigation = (path: string) => {
    trackNavigation(path);
    // Perform actual navigation (e.g., router.push(path))
  };

  return (
    <nav className='space-y-2'>
      {navigationItems.map(item => (
        <button
          key={item.path}
          onClick={() => handleNavigation(item.path)}
          className='block w-full text-left px-3 py-2 rounded-md hover:bg-secondary transition-colors'
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}

/**
 * Example of how to integrate with existing routing
 */
export function useRouterWithPreloading() {
  const { trackNavigation } = useNavigationTracking();

  // This would integrate with your existing router (Next.js, React Router, etc.)
  const navigateWithTracking = (path: string) => {
    // Track the navigation
    trackNavigation(path);

    // Perform the actual navigation
    // router.push(path); // Next.js
    // navigate(path); // React Router
    // window.location.href = path; // Vanilla
  };

  return { navigateWithTracking };
}
