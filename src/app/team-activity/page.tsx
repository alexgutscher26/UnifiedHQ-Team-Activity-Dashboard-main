import type React from 'react';
import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { TeamActivityContent } from '@/components/team-activity-content';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { DashboardErrorBoundary } from '@/components/error-boundaries';
import { getCurrentUser } from '@/lib/get-user';

export default async function TeamActivityPage() {
  const user = await getCurrentUser();
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
          <TeamActivityContent />
        </SidebarInset>
      </SidebarProvider>
    </DashboardErrorBoundary>
  );
}
