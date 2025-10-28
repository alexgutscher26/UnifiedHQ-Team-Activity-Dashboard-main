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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  IconBell,
  IconMail,
  IconSparkles,
  IconClock,
  IconTestPipe,
} from '@tabler/icons-react';

interface NotificationSettingsProps {
  onSettingsChange?: (section: string, message: string) => void;
}

interface NotificationSettings {
  enabled: boolean;
  dailyReminder: boolean;
  newSummaryAlert: boolean;
  emailNotifications: boolean;
  slackNotifications: boolean;
  reminderTime: string;
  digestFrequency: 'daily' | 'weekly' | 'monthly';
  activityThreshold: number;
  aiSummaryEnabled: boolean;
  aiSummaryDailyReminder: boolean;
  aiSummaryNewAlert: boolean;
  aiSummaryEmail: boolean;
  aiSummaryReminderTime: string;
}

export function NotificationSettings({
  onSettingsChange,
}: NotificationSettingsProps) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<NotificationSettings>({
    enabled: true,
    dailyReminder: true,
    newSummaryAlert: true,
    emailNotifications: false,
    slackNotifications: false,
    reminderTime: '09:00',
    digestFrequency: 'daily',
    activityThreshold: 10,
    aiSummaryEnabled: true,
    aiSummaryDailyReminder: true,
    aiSummaryNewAlert: true,
    aiSummaryEmail: false,
    aiSummaryReminderTime: '09:00',
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = () => {
    try {
      // Load general notification settings
      const savedSettings = localStorage.getItem('notification-settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings(prev => ({ ...prev, ...parsed }));
      }

      // Load AI summary notification settings
      const aiSummarySettings = localStorage.getItem(
        'ai-summary-notifications'
      );
      if (aiSummarySettings) {
        const parsed = JSON.parse(aiSummarySettings);
        setSettings(prev => ({
          ...prev,
          aiSummaryEnabled: parsed.enabled ?? true,
          aiSummaryDailyReminder: parsed.dailyReminder ?? true,
          aiSummaryNewAlert: parsed.newSummaryAlert ?? true,
          aiSummaryEmail: parsed.emailNotifications ?? false,
          aiSummaryReminderTime: parsed.reminderTime ?? '09:00',
        }));
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = (newSettings: Partial<NotificationSettings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);

    try {
      // Save general notification settings
      const generalSettings = {
        enabled: updatedSettings.enabled,
        dailyReminder: updatedSettings.dailyReminder,
        newSummaryAlert: updatedSettings.newSummaryAlert,
        emailNotifications: updatedSettings.emailNotifications,
        slackNotifications: updatedSettings.slackNotifications,
        reminderTime: updatedSettings.reminderTime,
        digestFrequency: updatedSettings.digestFrequency,
        activityThreshold: updatedSettings.activityThreshold,
      };
      localStorage.setItem(
        'notification-settings',
        JSON.stringify(generalSettings)
      );

      // Save AI summary notification settings
      const aiSummarySettings = {
        enabled: updatedSettings.aiSummaryEnabled,
        dailyReminder: updatedSettings.aiSummaryDailyReminder,
        newSummaryAlert: updatedSettings.aiSummaryNewAlert,
        emailNotifications: updatedSettings.aiSummaryEmail,
        reminderTime: updatedSettings.aiSummaryReminderTime,
      };
      localStorage.setItem(
        'ai-summary-notifications',
        JSON.stringify(aiSummarySettings)
      );

      onSettingsChange?.('Notifications', 'Settings updated successfully');
      toast({
        title: 'Settings Updated',
        description: 'Notification preferences have been saved',
      });
    } catch (error) {
      console.error('Failed to save notification settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save notification settings',
        variant: 'destructive',
      });
    }
  };

  const testNotification = () => {
    toast({
      title: 'AI Summary Notification',
      description:
        'This is how AI summary notifications will appear when enabled.',
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <IconBell className='size-5' />
            Notification Settings
          </CardTitle>
          <CardDescription>
            Configure how and when you receive notifications
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
      {/* General Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <IconBell className='size-5' />
            General Notifications
          </CardTitle>
          <CardDescription>
            Control your overall notification preferences
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          <div className='flex items-center justify-between'>
            <div className='space-y-1'>
              <Label htmlFor='notifications-enabled'>
                Enable Notifications
              </Label>
              <p className='text-sm text-muted-foreground'>
                Turn on or off all notifications
              </p>
            </div>
            <Switch
              id='notifications-enabled'
              checked={settings.enabled}
              onCheckedChange={checked => saveSettings({ enabled: checked })}
            />
          </div>

          <Separator />

          <div className='flex items-center justify-between'>
            <div className='space-y-1'>
              <Label htmlFor='daily-reminder'>Daily Reminder</Label>
              <p className='text-sm text-muted-foreground'>
                Get reminded to check your daily summary
              </p>
            </div>
            <Switch
              id='daily-reminder'
              checked={settings.dailyReminder}
              onCheckedChange={checked =>
                saveSettings({ dailyReminder: checked })
              }
              disabled={!settings.enabled}
            />
          </div>

          <div className='flex items-center justify-between'>
            <div className='space-y-1'>
              <Label htmlFor='new-summary-alert'>New Summary Alert</Label>
              <p className='text-sm text-muted-foreground'>
                Get notified when a new AI summary is generated
              </p>
            </div>
            <Switch
              id='new-summary-alert'
              checked={settings.newSummaryAlert}
              onCheckedChange={checked =>
                saveSettings({ newSummaryAlert: checked })
              }
              disabled={!settings.enabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* Notification Channels */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <IconMail className='size-5' />
            Notification Channels
          </CardTitle>
          <CardDescription>
            Choose how you want to receive notifications
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          <div className='flex items-center justify-between'>
            <div className='space-y-1'>
              <Label htmlFor='email-notifications'>Email Notifications</Label>
              <p className='text-sm text-muted-foreground'>
                Receive notifications via email
              </p>
            </div>
            <Switch
              id='email-notifications'
              checked={settings.emailNotifications}
              onCheckedChange={checked =>
                saveSettings({ emailNotifications: checked })
              }
              disabled={!settings.enabled}
            />
          </div>

          <div className='flex items-center justify-between'>
            <div className='space-y-1'>
              <Label htmlFor='slack-notifications'>Slack Notifications</Label>
              <p className='text-sm text-muted-foreground'>
                Send notifications to your Slack workspace
              </p>
            </div>
            <Switch
              id='slack-notifications'
              checked={settings.slackNotifications}
              onCheckedChange={checked =>
                saveSettings({ slackNotifications: checked })
              }
              disabled={!settings.enabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* Timing and Frequency */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <IconClock className='size-5' />
            Timing & Frequency
          </CardTitle>
          <CardDescription>
            Set when and how often you receive notifications
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          <div className='space-y-2'>
            <Label htmlFor='reminder-time'>Daily Reminder Time</Label>
            <Select
              value={settings.reminderTime}
              onValueChange={value => saveSettings({ reminderTime: value })}
              disabled={!settings.enabled || !settings.dailyReminder}
            >
              <SelectTrigger>
                <SelectValue placeholder='Select time' />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }, (_, i) => {
                  const hour = i.toString().padStart(2, '0');
                  return (
                    <SelectItem key={hour} value={`${hour}:00`}>
                      {hour}:00
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='digest-frequency'>Digest Frequency</Label>
            <Select
              value={settings.digestFrequency}
              onValueChange={(value: 'daily' | 'weekly' | 'monthly') =>
                saveSettings({ digestFrequency: value })
              }
              disabled={!settings.enabled}
            >
              <SelectTrigger>
                <SelectValue placeholder='Select frequency' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='daily'>Daily</SelectItem>
                <SelectItem value='weekly'>Weekly</SelectItem>
                <SelectItem value='monthly'>Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='activity-threshold'>Activity Threshold</Label>
            <Select
              value={settings.activityThreshold.toString()}
              onValueChange={value =>
                saveSettings({ activityThreshold: parseInt(value) })
              }
              disabled={!settings.enabled}
            >
              <SelectTrigger>
                <SelectValue placeholder='Select threshold' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='5'>5 activities</SelectItem>
                <SelectItem value='10'>10 activities</SelectItem>
                <SelectItem value='20'>20 activities</SelectItem>
                <SelectItem value='50'>50 activities</SelectItem>
              </SelectContent>
            </Select>
            <p className='text-sm text-muted-foreground'>
              Only send notifications when activity exceeds this threshold
            </p>
          </div>
        </CardContent>
      </Card>

      {/* AI Summary Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <IconSparkles className='size-5' />
            AI Summary Notifications
          </CardTitle>
          <CardDescription>
            Configure notifications related to AI-generated summaries
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          <div className='flex items-center justify-between'>
            <div className='space-y-1'>
              <Label htmlFor='ai-summary-enabled'>
                Enable AI Summary Notifications
              </Label>
              <p className='text-sm text-muted-foreground'>
                Receive notifications about AI-generated summaries
              </p>
            </div>
            <Switch
              id='ai-summary-enabled'
              checked={settings.aiSummaryEnabled}
              onCheckedChange={checked =>
                saveSettings({ aiSummaryEnabled: checked })
              }
              disabled={!settings.enabled}
            />
          </div>

          {settings.aiSummaryEnabled && (
            <>
              <Separator />

              <div className='flex items-center justify-between'>
                <div className='space-y-1'>
                  <Label htmlFor='ai-daily-reminder'>
                    Daily Summary Reminder
                  </Label>
                  <p className='text-sm text-muted-foreground'>
                    Get reminded to check your daily AI summary
                  </p>
                </div>
                <Switch
                  id='ai-daily-reminder'
                  checked={settings.aiSummaryDailyReminder}
                  onCheckedChange={checked =>
                    saveSettings({ aiSummaryDailyReminder: checked })
                  }
                  disabled={!settings.enabled}
                />
              </div>

              <div className='flex items-center justify-between'>
                <div className='space-y-1'>
                  <Label htmlFor='ai-new-alert'>New Summary Alert</Label>
                  <p className='text-sm text-muted-foreground'>
                    Get notified when new AI summaries are generated
                  </p>
                </div>
                <Switch
                  id='ai-new-alert'
                  checked={settings.aiSummaryNewAlert}
                  onCheckedChange={checked =>
                    saveSettings({ aiSummaryNewAlert: checked })
                  }
                  disabled={!settings.enabled}
                />
              </div>

              <div className='flex items-center justify-between'>
                <div className='space-y-1'>
                  <Label htmlFor='ai-email'>Email AI Summaries</Label>
                  <p className='text-sm text-muted-foreground'>
                    Receive AI summaries via email
                  </p>
                </div>
                <Switch
                  id='ai-email'
                  checked={settings.aiSummaryEmail}
                  onCheckedChange={checked =>
                    saveSettings({ aiSummaryEmail: checked })
                  }
                  disabled={!settings.enabled}
                />
              </div>

              {settings.aiSummaryDailyReminder && (
                <div className='space-y-2'>
                  <Label htmlFor='ai-reminder-time'>
                    AI Summary Reminder Time
                  </Label>
                  <Select
                    value={settings.aiSummaryReminderTime}
                    onValueChange={value =>
                      saveSettings({ aiSummaryReminderTime: value })
                    }
                    disabled={!settings.enabled}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder='Select time' />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => {
                        const hour = i.toString().padStart(2, '0');
                        return (
                          <SelectItem key={hour} value={`${hour}:00`}>
                            {hour}:00
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}

          <Separator />

          <div className='flex items-center gap-2'>
            <Button onClick={testNotification} variant='outline' size='sm'>
              <IconTestPipe className='h-4 w-4 mr-2' />
              Test AI Summary Notification
            </Button>
            <div className='flex items-center gap-2 text-sm text-muted-foreground'>
              <Badge
                variant={settings.aiSummaryEnabled ? 'default' : 'secondary'}
                className={settings.aiSummaryEnabled ? 'bg-green-500' : ''}
              >
                {settings.aiSummaryEnabled ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
