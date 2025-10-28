'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { themes } from '@/lib/themes';
import {
  IconPalette,
  IconSun,
  IconMoon,
  IconDeviceDesktop,
  IconCheck,
  IconEye,
} from '@tabler/icons-react';

interface ThemeSettingsProps {
  onSettingsChange?: (section: string, message: string) => void;
}

interface ThemeSettings {
  theme: string;
  colorScheme: 'light' | 'dark' | 'system';
  accentColor: string;
  fontSize: 'small' | 'medium' | 'large';
  compactMode: boolean;
}

export function ThemeSettings({ onSettingsChange }: ThemeSettingsProps) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<ThemeSettings>({
    theme: 'default',
    colorScheme: 'system',
    accentColor: 'blue',
    fontSize: 'medium',
    compactMode: false,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = () => {
    try {
      const savedSettings = localStorage.getItem('theme-settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings(prev => ({ ...prev, ...parsed }));
      }
    } catch (error) {
      console.error('Failed to load theme settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = (newSettings: Partial<ThemeSettings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);

    try {
      localStorage.setItem('theme-settings', JSON.stringify(updatedSettings));
      applyTheme(updatedSettings);
      onSettingsChange?.('Appearance', 'Theme settings updated successfully');
      toast({
        title: 'Settings Updated',
        description: 'Theme preferences have been saved',
      });
    } catch (error) {
      console.error('Failed to save theme settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save theme settings',
        variant: 'destructive',
      });
    }
  };

  const applyTheme = (themeSettings: ThemeSettings) => {
    // Apply color scheme
    const root = document.documentElement;

    if (themeSettings.colorScheme === 'dark') {
      root.classList.add('dark');
    } else if (themeSettings.colorScheme === 'light') {
      root.classList.remove('dark');
    } else {
      // System preference
      const prefersDark = window.matchMedia(
        '(prefers-color-scheme: dark)'
      ).matches;
      if (prefersDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }

    // Apply theme colors
    const theme = themes[themeSettings.theme];
    if (theme) {
      const colors =
        themeSettings.colorScheme === 'dark'
          ? theme.colors.dark
          : theme.colors.light;
      Object.entries(colors).forEach(([key, value]) => {
        root.style.setProperty(`--${key}`, value);
      });
    }

    // Apply font size
    root.style.setProperty(
      '--font-size-scale',
      themeSettings.fontSize === 'small'
        ? '0.875'
        : themeSettings.fontSize === 'large'
          ? '1.125'
          : '1'
    );

    // Apply compact mode
    if (themeSettings.compactMode) {
      root.classList.add('compact-mode');
    } else {
      root.classList.remove('compact-mode');
    }
  };

  const previewTheme = (themeName: string) => {
    const theme = themes[themeName];
    if (!theme) return;

    const root = document.documentElement;
    const isDark = document.documentElement.classList.contains('dark');
    const colors = isDark ? theme.colors.dark : theme.colors.light;

    Object.entries(colors).forEach(([key, value]) => {
      root.style.setProperty(`--${key}`, value);
    });
  };

  const resetPreview = () => {
    const currentSettings = settings;
    applyTheme(currentSettings);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <IconPalette className='size-5' />
            Theme Settings
          </CardTitle>
          <CardDescription>
            Customize the appearance of your dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='space-y-4'>
            <div className='animate-pulse space-y-2'>
              <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4'></div>
              <div className='h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2'></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className='space-y-6 px-4 lg:px-6'>
      {/* Color Scheme */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <IconPalette className='size-5' />
            Color Scheme
          </CardTitle>
          <CardDescription>Choose your preferred color scheme</CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          <div className='space-y-3'>
            <Label>Appearance</Label>
            <RadioGroup
              value={settings.colorScheme}
              onValueChange={(value: 'light' | 'dark' | 'system') =>
                saveSettings({ colorScheme: value })
              }
            >
              <div className='flex items-center space-x-2'>
                <RadioGroupItem value='light' id='light' />
                <Label htmlFor='light' className='flex items-center gap-2'>
                  <IconSun className='size-4' />
                  Light
                </Label>
              </div>
              <div className='flex items-center space-x-2'>
                <RadioGroupItem value='dark' id='dark' />
                <Label htmlFor='dark' className='flex items-center gap-2'>
                  <IconMoon className='size-4' />
                  Dark
                </Label>
              </div>
              <div className='flex items-center space-x-2'>
                <RadioGroupItem value='system' id='system' />
                <Label htmlFor='system' className='flex items-center gap-2'>
                  <IconDeviceDesktop className='size-4' />
                  System
                </Label>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      {/* Theme Selection */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <IconPalette className='size-5' />
            Theme Colors
          </CardTitle>
          <CardDescription>
            Choose from our collection of beautiful themes
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          <div className='grid grid-cols-2 md:grid-cols-3 gap-4'>
            {Object.entries(themes).map(([key, theme]) => (
              <div
                key={key}
                className={`p-4 border rounded-lg cursor-pointer transition-all ${
                  settings.theme === key
                    ? 'border-primary ring-2 ring-primary/20'
                    : 'border-border hover:border-primary/50'
                }`}
                onClick={() => saveSettings({ theme: key })}
                onMouseEnter={() => previewTheme(key)}
                onMouseLeave={resetPreview}
              >
                <div className='space-y-3'>
                  <div className='flex items-center justify-between'>
                    <h4 className='font-medium'>{theme.label}</h4>
                    {settings.theme === key && (
                      <IconCheck className='size-4 text-primary' />
                    )}
                  </div>
                  <div className='flex gap-1'>
                    <div
                      className='w-4 h-4 rounded-full'
                      style={{ backgroundColor: theme.colors.light.primary }}
                    />
                    <div
                      className='w-4 h-4 rounded-full'
                      style={{ backgroundColor: theme.colors.light.secondary }}
                    />
                    <div
                      className='w-4 h-4 rounded-full'
                      style={{ backgroundColor: theme.colors.light.accent }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Display Options */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <IconEye className='size-5' />
            Display Options
          </CardTitle>
          <CardDescription>
            Customize the display and layout of your interface
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          <div className='flex items-center justify-between'>
            <div className='space-y-1'>
              <Label htmlFor='compact-mode'>Compact Mode</Label>
              <p className='text-sm text-muted-foreground'>
                Reduce spacing and padding for a more compact layout
              </p>
            </div>
            <Switch
              id='compact-mode'
              checked={settings.compactMode}
              onCheckedChange={checked =>
                saveSettings({ compactMode: checked })
              }
            />
          </div>

          <Separator />

          <div className='space-y-3'>
            <Label>Font Size</Label>
            <RadioGroup
              value={settings.fontSize}
              onValueChange={(value: 'small' | 'medium' | 'large') =>
                saveSettings({ fontSize: value })
              }
            >
              <div className='flex items-center space-x-2'>
                <RadioGroupItem value='small' id='font-small' />
                <Label htmlFor='font-small'>Small</Label>
              </div>
              <div className='flex items-center space-x-2'>
                <RadioGroupItem value='medium' id='font-medium' />
                <Label htmlFor='font-medium'>Medium</Label>
              </div>
              <div className='flex items-center space-x-2'>
                <RadioGroupItem value='large' id='font-large' />
                <Label htmlFor='font-large'>Large</Label>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <IconEye className='size-5' />
            Preview
          </CardTitle>
          <CardDescription>
            See how your theme looks with sample content
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='space-y-4 p-4 border rounded-lg bg-card'>
            <div className='flex items-center gap-2'>
              <div className='w-8 h-8 bg-primary rounded-full'></div>
              <div>
                <div className='font-medium'>Sample User</div>
                <div className='text-sm text-muted-foreground'>
                  user@example.com
                </div>
              </div>
            </div>
            <div className='space-y-2'>
              <div className='h-2 bg-primary/20 rounded w-3/4'></div>
              <div className='h-2 bg-secondary rounded w-1/2'></div>
              <div className='h-2 bg-accent rounded w-2/3'></div>
            </div>
            <div className='flex gap-2'>
              <Button size='sm'>Primary Button</Button>
              <Button size='sm' variant='outline'>
                Secondary Button
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
