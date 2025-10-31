import type React from 'react';
import { redirect } from 'next/navigation';
import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { IntegrationsPage } from '@/components/integrations-page';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { getCurrentUser } from '@/lib/get-user';

/**
 * Renders the main page component, redirecting to authentication if the user is not logged in.
 */
export default async function Page() {
  const user = await getCurrentUser();

  // Redirect to auth if user is not authenticated
  if (!user) {
    redirect('/auth/signin');
  }

  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': 'calc(var(--spacing) * 72)',
          '--header-height': 'calc(var(--spacing) * 12)',
        } as React.CSSProperties
      }
    >
      <AppSidebar variant='inset' user={user} />
      <SidebarInset>
        <SiteHeader />
        <IntegrationsPage />
      </SidebarInset>
    </SidebarProvider>
  );
}
