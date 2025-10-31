import { Metadata } from 'next';
import { NavigationPageClient } from './navigation-page-client';

export const metadata: Metadata = {
  title: 'Navigation Analytics - UnifiedHQ Admin',
  description:
    'Monitor navigation patterns and cache performance for UnifiedHQ',
};

/**
 * Renders the NavigationPageClient component for client-side authentication.
 */
export default function NavigationAnalyticsPage() {
  // Use fully client-side authentication to avoid Edge Runtime issues
  // The NavigationPageClient component will handle all auth logic
  return <NavigationPageClient />;
}
