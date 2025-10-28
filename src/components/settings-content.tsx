'use client';

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  IconUser,
  IconBrandGithub,
  IconBell,
  IconPalette,
  IconDatabase,
  IconShield,
} from '@tabler/icons-react';

import { UserPreferencesSettings } from '@/components/settings/user-preferences-settings';
import { IntegrationSettings } from '@/components/settings/integration-settings';
import { NotificationSettings } from '@/components/settings/notification-settings';
import { ThemeSettings } from '@/components/settings/theme-settings';
import { DataManagementSettings } from '@/components/settings/data-management-settings';
import { SecuritySettings } from '@/components/settings/security-settings';

export function SettingsContent() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('profile');

  const handleSettingsChange = (section: string, message: string) => {
    toast({
      title: 'Settings Updated',
      description: `${section}: ${message}`,
    });
  };

  return (
    <div className='flex flex-1 flex-col'>
      <div className='@container/main flex flex-1 flex-col gap-2'>
        <div className='flex flex-col gap-4 py-4 md:gap-6 md:py-6'>
          {/* Header */}
          <div className='space-y-2 px-4 lg:px-6'>
            <h1 className='text-3xl font-bold tracking-tight'>Settings</h1>
            <p className='text-muted-foreground'>
              Manage your account settings, integrations, and preferences.
            </p>
          </div>

          <div className='px-4 lg:px-6'>
            <Separator />
          </div>

          {/* Settings Tabs */}
          <div className='px-4 lg:px-6'>
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className='space-y-6'
            >
              <TabsList className='grid w-full grid-cols-2 md:grid-cols-3 lg:grid-cols-6'>
                <TabsTrigger
                  value='profile'
                  className='flex items-center gap-2'
                >
                  <IconUser className='size-4' />
                  <span className='hidden sm:inline'>Profile</span>
                </TabsTrigger>
                <TabsTrigger
                  value='integrations'
                  className='flex items-center gap-2'
                >
                  <IconBrandGithub className='size-4' />
                  <span className='hidden sm:inline'>Integrations</span>
                </TabsTrigger>
                <TabsTrigger
                  value='notifications'
                  className='flex items-center gap-2'
                >
                  <IconBell className='size-4' />
                  <span className='hidden sm:inline'>Notifications</span>
                </TabsTrigger>
                <TabsTrigger
                  value='appearance'
                  className='flex items-center gap-2'
                >
                  <IconPalette className='size-4' />
                  <span className='hidden sm:inline'>Appearance</span>
                </TabsTrigger>
                <TabsTrigger value='data' className='flex items-center gap-2'>
                  <IconDatabase className='size-4' />
                  <span className='hidden sm:inline'>Data</span>
                </TabsTrigger>
                <TabsTrigger
                  value='security'
                  className='flex items-center gap-2'
                >
                  <IconShield className='size-4' />
                  <span className='hidden sm:inline'>Security</span>
                </TabsTrigger>
              </TabsList>

              {/* Profile Settings */}
              <TabsContent value='profile' className='space-y-6'>
                <UserPreferencesSettings
                  onSettingsChange={handleSettingsChange}
                />
              </TabsContent>

              {/* Integration Settings */}
              <TabsContent value='integrations' className='space-y-6'>
                <IntegrationSettings onSettingsChange={handleSettingsChange} />
              </TabsContent>

              {/* Notification Settings */}
              <TabsContent value='notifications' className='space-y-6'>
                <NotificationSettings onSettingsChange={handleSettingsChange} />
              </TabsContent>

              {/* Appearance Settings */}
              <TabsContent value='appearance' className='space-y-6'>
                <ThemeSettings onSettingsChange={handleSettingsChange} />
              </TabsContent>

              {/* Data Management Settings */}
              <TabsContent value='data' className='space-y-6'>
                <DataManagementSettings
                  onSettingsChange={handleSettingsChange}
                />
              </TabsContent>

              {/* Security Settings */}
              <TabsContent value='security' className='space-y-6'>
                <SecuritySettings onSettingsChange={handleSettingsChange} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
