'use client';

import React, { useState } from 'react';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import {
  IconDatabase,
  IconDownload,
  IconTrash,
  IconRefresh,
  IconAlertTriangle,
  IconClock,
  IconShield,
} from '@tabler/icons-react';

interface DataManagementSettingsProps {
  onSettingsChange?: (section: string, message: string) => void;
}

interface DataSettings {
  autoSync: boolean;
  syncInterval: '15min' | '30min' | '1hour' | '6hours' | '24hours';
  dataRetention: '30days' | '90days' | '1year' | 'forever';
  cacheEnabled: boolean;
  exportFormat: 'json' | 'csv' | 'pdf';
}

export function DataManagementSettings({
  onSettingsChange,
}: DataManagementSettingsProps) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<DataSettings>({
    autoSync: true,
    syncInterval: '1hour',
    dataRetention: '90days',
    cacheEnabled: true,
    exportFormat: 'json',
  });
  const [isExporting, setIsExporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const saveSettings = (newSettings: Partial<DataSettings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);

    try {
      localStorage.setItem('data-settings', JSON.stringify(updatedSettings));
      onSettingsChange?.('Data Management', 'Settings updated successfully');
      toast({
        title: 'Settings Updated',
        description: 'Data management preferences have been saved',
      });
    } catch (error) {
      console.error('Failed to save data settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save data settings',
        variant: 'destructive',
      });
    }
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);

      // Simulate export process
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Create export data
      const exportData = {
        settings,
        timestamp: new Date().toISOString(),
        version: '1.0',
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `unifiedhq-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      onSettingsChange?.('Data Management', 'Data exported successfully');
      toast({
        title: 'Export Complete',
        description: 'Your data has been exported successfully',
      });
    } catch (error) {
      console.error('Failed to export data:', error);
      toast({
        title: 'Export Failed',
        description: 'Failed to export your data',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleClearCache = async () => {
    try {
      setIsClearing(true);

      const response = await fetch('/api/cache/cleanup', {
        method: 'POST',
      });

      if (response.ok) {
        onSettingsChange?.('Data Management', 'Cache cleared successfully');
        toast({
          title: 'Cache Cleared',
          description: 'All cached data has been cleared',
        });
      } else {
        throw new Error('Failed to clear cache');
      }
    } catch (error) {
      console.error('Failed to clear cache:', error);
      toast({
        title: 'Error',
        description: 'Failed to clear cache',
        variant: 'destructive',
      });
    } finally {
      setIsClearing(false);
    }
  };

  const handleClearAllData = async () => {
    try {
      // This would typically call an API endpoint to clear all user data
      onSettingsChange?.('Data Management', 'All data cleared successfully');
      toast({
        title: 'Data Cleared',
        description: 'All your data has been cleared',
        variant: 'destructive',
      });
    } catch (error) {
      console.error('Failed to clear all data:', error);
      toast({
        title: 'Error',
        description: 'Failed to clear all data',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className='space-y-6 px-4 lg:px-6'>
      {/* Sync Settings */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <IconRefresh className='size-5' />
            Sync Settings
          </CardTitle>
          <CardDescription>
            Configure how often your data is synchronized
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          <div className='flex items-center justify-between'>
            <div className='space-y-1'>
              <Label htmlFor='auto-sync'>Automatic Sync</Label>
              <p className='text-sm text-muted-foreground'>
                Automatically sync data from connected integrations
              </p>
            </div>
            <Switch
              id='auto-sync'
              checked={settings.autoSync}
              onCheckedChange={checked => saveSettings({ autoSync: checked })}
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='sync-interval'>Sync Interval</Label>
            <Select
              value={settings.syncInterval}
              onValueChange={(
                value: '15min' | '30min' | '1hour' | '6hours' | '24hours'
              ) => saveSettings({ syncInterval: value })}
              disabled={!settings.autoSync}
            >
              <SelectTrigger>
                <SelectValue placeholder='Select interval' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='15min'>Every 15 minutes</SelectItem>
                <SelectItem value='30min'>Every 30 minutes</SelectItem>
                <SelectItem value='1hour'>Every hour</SelectItem>
                <SelectItem value='6hours'>Every 6 hours</SelectItem>
                <SelectItem value='24hours'>Every 24 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Data Retention */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <IconClock className='size-5' />
            Data Retention
          </CardTitle>
          <CardDescription>Control how long your data is kept</CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          <div className='space-y-2'>
            <Label htmlFor='data-retention'>Retention Period</Label>
            <Select
              value={settings.dataRetention}
              onValueChange={(
                value: '30days' | '90days' | '1year' | 'forever'
              ) => saveSettings({ dataRetention: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder='Select retention period' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='30days'>30 days</SelectItem>
                <SelectItem value='90days'>90 days</SelectItem>
                <SelectItem value='1year'>1 year</SelectItem>
                <SelectItem value='forever'>Forever</SelectItem>
              </SelectContent>
            </Select>
            <p className='text-sm text-muted-foreground'>
              Data older than this period will be automatically deleted
            </p>
          </div>

          <div className='flex items-center justify-between'>
            <div className='space-y-1'>
              <Label htmlFor='cache-enabled'>Enable Caching</Label>
              <p className='text-sm text-muted-foreground'>
                Cache data locally for faster access
              </p>
            </div>
            <Switch
              id='cache-enabled'
              checked={settings.cacheEnabled}
              onCheckedChange={checked =>
                saveSettings({ cacheEnabled: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Export Data */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <IconDownload className='size-5' />
            Export Data
          </CardTitle>
          <CardDescription>
            Download your data for backup or migration
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          <div className='space-y-2'>
            <Label htmlFor='export-format'>Export Format</Label>
            <Select
              value={settings.exportFormat}
              onValueChange={(value: 'json' | 'csv' | 'pdf') =>
                saveSettings({ exportFormat: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder='Select format' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='json'>JSON</SelectItem>
                <SelectItem value='csv'>CSV</SelectItem>
                <SelectItem value='pdf'>PDF</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className='flex items-center gap-2'>
            <Button
              onClick={handleExport}
              disabled={isExporting}
              variant='outline'
            >
              {isExporting ? (
                <IconRefresh className='h-4 w-4 mr-2 animate-spin' />
              ) : (
                <IconDownload className='h-4 w-4 mr-2' />
              )}
              Export Data
            </Button>
            <p className='text-sm text-muted-foreground'>
              Download all your data in {settings.exportFormat.toUpperCase()}{' '}
              format
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Data Management Actions */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <IconShield className='size-5' />
            Data Management
          </CardTitle>
          <CardDescription>Manage your stored data and cache</CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          <div className='space-y-4'>
            <div className='flex items-center justify-between p-4 border rounded-lg'>
              <div className='space-y-1'>
                <h4 className='font-medium'>Clear Cache</h4>
                <p className='text-sm text-muted-foreground'>
                  Remove all cached data to free up space
                </p>
              </div>
              <Button
                onClick={handleClearCache}
                disabled={isClearing}
                variant='outline'
                size='sm'
              >
                {isClearing ? (
                  <IconRefresh className='h-4 w-4 mr-2 animate-spin' />
                ) : (
                  <IconTrash className='h-4 w-4 mr-2' />
                )}
                Clear Cache
              </Button>
            </div>

            <div className='flex items-center justify-between p-4 border rounded-lg border-destructive/20'>
              <div className='space-y-1'>
                <h4 className='font-medium text-destructive'>Clear All Data</h4>
                <p className='text-sm text-muted-foreground'>
                  Permanently delete all your data and settings
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant='destructive' size='sm'>
                    <IconTrash className='h-4 w-4 mr-2' />
                    Clear All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className='flex items-center gap-2'>
                      <IconAlertTriangle className='h-5 w-5 text-destructive' />
                      Clear All Data
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete
                      all your data, settings, and preferences. Are you sure you
                      want to continue?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleClearAllData}
                      className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
                    >
                      Yes, Clear All Data
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Storage Information */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <IconDatabase className='size-5' />
            Storage Information
          </CardTitle>
          <CardDescription>View your current storage usage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='space-y-4'>
            <div className='flex items-center justify-between'>
              <span className='text-sm text-muted-foreground'>Activities</span>
              <span className='text-sm font-medium'>~2.3 MB</span>
            </div>
            <div className='flex items-center justify-between'>
              <span className='text-sm text-muted-foreground'>Cache</span>
              <span className='text-sm font-medium'>~1.1 MB</span>
            </div>
            <div className='flex items-center justify-between'>
              <span className='text-sm text-muted-foreground'>Settings</span>
              <span className='text-sm font-medium'>~0.2 MB</span>
            </div>
            <Separator />
            <div className='flex items-center justify-between'>
              <span className='text-sm font-medium'>Total</span>
              <span className='text-sm font-medium'>~3.6 MB</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
