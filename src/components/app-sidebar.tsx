'use client';

import type * as React from 'react';
import {
  IconDashboard,
  IconHelp,
  IconSearch,
  IconSettings,
  IconSparkles,
  IconUsers,
  IconHistory,
} from '@tabler/icons-react';

import { NavMain } from '@/components/nav-main';
import { NavSecondary } from '@/components/nav-secondary';
import { NavUser } from '@/components/nav-user';
import { IntegrationsList } from '@/components/integrations-list';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

const data = {
  navMain: [
    {
      title: 'Dashboard',
      url: '/dashboard',
      icon: IconDashboard,
    },
    {
      title: 'Summary History',
      url: '/summary-history',
      icon: IconHistory,
    },
    {
      title: 'Team Activity',
      url: '/team-activity',
      icon: IconUsers,
    },
    {
      title: 'AI Insights',
      url: '#',
      icon: IconSparkles,
    },
  ],
  navSecondary: [
    {
      title: 'Settings',
      url: '/settings',
      icon: IconSettings,
    },
    {
      title: 'Get Help',
      url: '#',
      icon: IconHelp,
    },
    {
      title: 'Search',
      url: '#',
      icon: IconSearch,
    },
  ],
};

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user?: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  } | null;
}

export function AppSidebar({ user, ...props }: AppSidebarProps) {
  return (
    <Sidebar collapsible='offcanvas' {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className='data-[slot=sidebar-menu-button]:!p-1.5 cursor-pointer'
            >
              <a href='#' className='cursor-pointer'>
                <IconSparkles className='!size-5' />
                <span className='text-base font-semibold'>UnifiedHQ</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <div className='px-3 py-2'>
          <div className='mb-2 px-2 text-xs font-semibold text-sidebar-foreground/70'>
            Integrations
          </div>
          <IntegrationsList />
        </div>
        <NavSecondary items={data.navSecondary} className='mt-auto' />
      </SidebarContent>
      <SidebarFooter>{user && <NavUser user={user} />}</SidebarFooter>
    </Sidebar>
  );
}
