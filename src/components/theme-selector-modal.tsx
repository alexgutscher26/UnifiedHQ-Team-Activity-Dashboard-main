'use client';

import React from 'react';
import { IconCheck, IconX } from '@tabler/icons-react';
import { useCustomTheme } from '@/contexts/theme-context';
import { type ThemeConfig } from '@/lib/themes';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ThemeSelectorModalProps {
  open: boolean;
  onClose: () => void;
}

export function ThemeSelectorModal({ open, onClose }: ThemeSelectorModalProps) {
  const { currentTheme, setTheme, availableThemes } = useCustomTheme();

  const handleThemeSelect = (theme: ThemeConfig) => {
    setTheme(theme.name);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className='sm:max-w-md animate-in fade-in-0 zoom-in-95 duration-200'>
        <DialogHeader>
          <DialogTitle>Choose Theme</DialogTitle>
          <DialogDescription>
            Select a color theme for your dashboard. You can change this
            anytime.
          </DialogDescription>
        </DialogHeader>

        <div className='grid grid-cols-2 gap-3 py-4'>
          {availableThemes.map(theme => (
            <ThemeCard
              key={theme.name}
              theme={theme}
              isSelected={currentTheme.name === theme.name}
              onSelect={() => handleThemeSelect(theme)}
            />
          ))}
        </div>

        <div className='flex justify-end'>
          <Button variant='outline' onClick={onClose}>
            <IconX className='mr-2 h-4 w-4' />
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ThemeCardProps {
  theme: ThemeConfig;
  isSelected: boolean;
  onSelect: () => void;
}

/**
 * Renders a themed card button with color indicators and selection state.
 */
function ThemeCard({ theme, isSelected, onSelect }: ThemeCardProps) {
  return (
    <button
      onClick={onSelect}
      className={`relative p-4 rounded-lg border-2 transition-all duration-150 hover:scale-105 active:scale-95 ${
        isSelected
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-primary/50'
      }`}
    >
      <div className='space-y-3'>
        <div className='flex items-center justify-between'>
          <h3 className='font-medium text-sm'>{theme.label}</h3>
          {isSelected && (
            <IconCheck className='h-4 w-4 text-primary animate-in fade-in-0 zoom-in-95 duration-200' />
          )}
        </div>

        <div className='flex gap-2'>
          <div
            className='w-6 h-6 rounded-full border border-border transition-transform duration-150 hover:scale-110'
            style={{ backgroundColor: theme.colors.light.primary }}
            title='Primary'
          />
          <div
            className='w-6 h-6 rounded-full border border-border transition-transform duration-150 hover:scale-110'
            style={{ backgroundColor: theme.colors.light.secondary }}
            title='Secondary'
          />
          <div
            className='w-6 h-6 rounded-full border border-border transition-transform duration-150 hover:scale-110'
            style={{ backgroundColor: theme.colors.light.accent }}
            title='Accent'
          />
        </div>
      </div>
    </button>
  );
}
