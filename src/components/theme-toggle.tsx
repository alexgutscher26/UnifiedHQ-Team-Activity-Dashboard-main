'use client';

import * as React from 'react';
import { useState } from 'react';
import { useTheme } from 'next-themes';
import { useCustomTheme } from '@/contexts/theme-context';
import {
  IconSun,
  IconMoon,
  IconDeviceDesktop,
  IconCheck,
  IconPalette,
} from '@tabler/icons-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ThemeSelectorModal } from '@/components/theme-selector-modal';

/**
 * Renders a theme toggle dropdown menu for selecting light, dark, or system themes.
 */
export function ThemeToggle() {
  const { setTheme, theme } = useTheme();
  const { currentTheme } = useCustomTheme();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant='ghost' size='sm' className='w-full justify-start'>
            <IconSun className='h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0' />
            <IconMoon className='absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100' />
            <span className='ml-2'>Theme</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          <DropdownMenuItem onClick={() => setTheme('light')}>
            <IconSun className='mr-2 h-4 w-4' />
            <span>Light</span>
            {theme === 'light' && <IconCheck className='ml-auto h-4 w-4' />}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme('dark')}>
            <IconMoon className='mr-2 h-4 w-4' />
            <span>Dark</span>
            {theme === 'dark' && <IconCheck className='ml-auto h-4 w-4' />}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme('system')}>
            <IconDeviceDesktop className='mr-2 h-4 w-4' />
            <span>System</span>
            {theme === 'system' && <IconCheck className='ml-auto h-4 w-4' />}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setIsModalOpen(true)}>
            <IconPalette className='mr-2 h-4 w-4' />
            <span>Customize Theme</span>
            <span className='ml-auto text-xs text-muted-foreground'>
              {currentTheme.label}
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ThemeSelectorModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
