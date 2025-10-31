import type React from 'react';
import { redirect } from 'next/navigation';
import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { DashboardContent } from '@/components/dashboard-content';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { DashboardErrorBoundary } from '@/components/error-boundaries';
import { getCurrentUser } from '@/lib/get-user';

/**
 * Renders the main page component, redirecting unauthenticated users to the sign-in page.
 */
export default async function Page() {
  const user = await getCurrentUser();

  // Redirect to auth if user is not authenticated
  if (!user) {
    redirect('/auth/signin');
  }

  return (
    <DashboardErrorBoundary>
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
          <DashboardContent />
        </SidebarInset>
      </SidebarProvider>
    </DashboardErrorBoundary>
  );
}
