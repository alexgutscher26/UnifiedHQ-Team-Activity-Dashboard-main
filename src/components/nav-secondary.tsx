'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { type Icon } from '@tabler/icons-react';

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

/**
 * Renders a secondary navigation component with menu items and handles navigation.
 */
export function NavSecondary({
  items,
  ...props
}: {
  items: {
    title: string;
    url: string;
    icon: Icon;
  }[];
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  const router = useRouter();

  /**
   * Handles navigation by pushing the given URL to the router or logging for placeholder links.
   */
  const handleNavigation = (url: string) => {
    if (url === '#') {
      // Handle placeholder links - you can add specific logic here
      console.log('Placeholder link clicked');
      return;
    }
    router.push(url);
  };
  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map(item => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                className='cursor-pointer'
                onClick={() => handleNavigation(item.url)}
              >
                <item.icon />
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
