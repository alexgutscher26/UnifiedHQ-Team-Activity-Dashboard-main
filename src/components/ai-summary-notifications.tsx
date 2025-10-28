'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  IconBell,
  IconBellOff,
  IconClock,
  IconSparkles,
  IconCheck,
  IconX,
} from '@tabler/icons-react';

interface NotificationSettings {
  enabled: boolean;
  dailyReminder: boolean;
  newSummaryAlert: boolean;
  reminderTime: string;
  emailNotifications: boolean;
}

interface AISummaryNotificationsProps {
  className?: string;
  onSettingsChange?: (settings: NotificationSettings) => void;
}

export function AISummaryNotifications({
  className,
  onSettingsChange,
}: AISummaryNotificationsProps) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<NotificationSettings>({
    enabled: true,
    dailyReminder: true,
    newSummaryAlert: true,
    reminderTime: '09:00',
    emailNotifications: false,
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Load settings from localStorage or API
    const savedSettings = localStorage.getItem('ai-summary-notifications');
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch (error) {
        console.error('Failed to parse notification settings:', error);
      }
    }
  }, []);

  const updateSettings = (newSettings: Partial<NotificationSettings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);

    // Save to localStorage
    localStorage.setItem(
      'ai-summary-notifications',
      JSON.stringify(updatedSettings)
    );

    // Call callback if provided
    if (onSettingsChange) {
      onSettingsChange(updatedSettings);
    }

    toast({
      title: 'Settings Updated',
      description: 'Notification preferences have been saved',
    });
  };

  const toggleNotifications = () => {
    updateSettings({ enabled: !settings.enabled });
  };

  const toggleDailyReminder = () => {
    updateSettings({ dailyReminder: !settings.dailyReminder });
  };

  const toggleNewSummaryAlert = () => {
    updateSettings({ newSummaryAlert: !settings.newSummaryAlert });
  };

  const toggleEmailNotifications = () => {
    updateSettings({ emailNotifications: !settings.emailNotifications });
  };

  const handleTimeChange = (time: string) => {
    updateSettings({ reminderTime: time });
  };

  const testNotification = () => {
    toast({
      title: 'Test Notification',
      description: 'This is how AI summary notifications will appear',
    });
  };

  return (
    <Card className={className}>
      <CardHeader className='pb-3'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <IconBell className='size-5 text-white' />
            <h3 className='text-lg font-semibold text-white'>
              AI Summary Notifications
            </h3>
          </div>
          <Button
            size='sm'
            variant={settings.enabled ? 'default' : 'outline'}
            onClick={toggleNotifications}
            className={
              settings.enabled
                ? 'bg-green-600 hover:bg-green-700'
                : 'border-gray-600 text-gray-400 hover:text-white'
            }
          >
            {settings.enabled ? (
              <>
                <IconBell className='size-4 mr-1' />
                Enabled
              </>
            ) : (
              <>
                <IconBellOff className='size-4 mr-1' />
                Disabled
              </>
            )}
          </Button>
        </div>
        <p className='text-sm text-gray-400'>
          Configure how you receive AI summary updates
        </p>
      </CardHeader>

      <CardContent className='space-y-6'>
        {/* Main Toggle */}
        <div className='flex items-center justify-between p-4 border border-slate-700 rounded-lg'>
          <div className='flex items-center gap-3'>
            <IconSparkles className='size-5 text-blue-400' />
            <div>
              <h4 className='text-white font-medium'>
                AI Summary Notifications
              </h4>
              <p className='text-sm text-gray-400'>
                Receive alerts when new summaries are generated
              </p>
            </div>
          </div>
          <Button
            variant='ghost'
            size='sm'
            onClick={toggleNotifications}
            className={settings.enabled ? 'text-green-400' : 'text-gray-500'}
          >
            {settings.enabled ? (
              <IconCheck className='size-5' />
            ) : (
              <IconX className='size-5' />
            )}
          </Button>
        </div>

        {/* Notification Options */}
        {settings.enabled && (
          <div className='space-y-4'>
            {/* Daily Reminder */}
            <div className='flex items-center justify-between p-3 border border-slate-700 rounded-lg'>
              <div className='flex items-center gap-3'>
                <IconClock className='size-4 text-orange-400' />
                <div>
                  <h4 className='text-white font-medium text-sm'>
                    Daily Reminder
                  </h4>
                  <p className='text-xs text-gray-400'>
                    Get reminded to check your daily summary
                  </p>
                </div>
              </div>
              <Button
                variant='ghost'
                size='sm'
                onClick={toggleDailyReminder}
                className={
                  settings.dailyReminder ? 'text-green-400' : 'text-gray-500'
                }
              >
                {settings.dailyReminder ? (
                  <IconCheck className='size-4' />
                ) : (
                  <IconX className='size-4' />
                )}
              </Button>
            </div>

            {/* New Summary Alert */}
            <div className='flex items-center justify-between p-3 border border-slate-700 rounded-lg'>
              <div className='flex items-center gap-3'>
                <IconSparkles className='size-4 text-blue-400' />
                <div>
                  <h4 className='text-white font-medium text-sm'>
                    New Summary Alert
                  </h4>
                  <p className='text-xs text-gray-400'>
                    Get notified when summaries are auto-generated
                  </p>
                </div>
              </div>
              <Button
                variant='ghost'
                size='sm'
                onClick={toggleNewSummaryAlert}
                className={
                  settings.newSummaryAlert ? 'text-green-400' : 'text-gray-500'
                }
              >
                {settings.newSummaryAlert ? (
                  <IconCheck className='size-4' />
                ) : (
                  <IconX className='size-4' />
                )}
              </Button>
            </div>

            {/* Email Notifications */}
            <div className='flex items-center justify-between p-3 border border-slate-700 rounded-lg'>
              <div className='flex items-center gap-3'>
                <IconBell className='size-4 text-purple-400' />
                <div>
                  <h4 className='text-white font-medium text-sm'>
                    Email Notifications
                  </h4>
                  <p className='text-xs text-gray-400'>
                    Receive summary notifications via email
                  </p>
                </div>
              </div>
              <Button
                variant='ghost'
                size='sm'
                onClick={toggleEmailNotifications}
                className={
                  settings.emailNotifications
                    ? 'text-green-400'
                    : 'text-gray-500'
                }
              >
                {settings.emailNotifications ? (
                  <IconCheck className='size-4' />
                ) : (
                  <IconX className='size-4' />
                )}
              </Button>
            </div>

            {/* Reminder Time */}
            {settings.dailyReminder && (
              <div className='p-3 border border-slate-700 rounded-lg'>
                <div className='flex items-center gap-3 mb-3'>
                  <IconClock className='size-4 text-orange-400' />
                  <h4 className='text-white font-medium text-sm'>
                    Reminder Time
                  </h4>
                </div>
                <input
                  type='time'
                  value={settings.reminderTime}
                  onChange={e => handleTimeChange(e.target.value)}
                  className='bg-slate-800 text-white text-sm px-3 py-2 rounded border border-slate-600 focus:border-blue-500 focus:outline-none'
                />
                <p className='text-xs text-gray-400 mt-2'>
                  You'll be reminded to check your AI summary at this time
                </p>
              </div>
            )}
          </div>
        )}

        {/* Test Notification */}
        <div className='pt-4 border-t border-slate-700'>
          <Button
            onClick={testNotification}
            variant='outline'
            className='w-full border-gray-600 text-gray-400 hover:text-white hover:border-gray-500'
          >
            <IconBell className='size-4 mr-2' />
            Test Notification
          </Button>
        </div>

        {/* Status */}
        <div className='pt-4 border-t border-slate-700'>
          <div className='flex items-center justify-between text-xs text-gray-500'>
            <span>Notification Status</span>
            <Badge
              variant={settings.enabled ? 'default' : 'secondary'}
              className={settings.enabled ? 'bg-green-600' : ''}
            >
              {settings.enabled ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
