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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  loadUserPreferences,
  saveUserPreferences,
  type UserPreferences,
} from '@/lib/user-preferences';
import {
  IconUser,
  IconCalendar,
  IconEdit,
  IconCheck,
  IconX,
  IconLoader2,
} from '@tabler/icons-react';

interface UserPreferencesSettingsProps {
  onSettingsChange?: (section: string, message: string) => void;
}

/**
 * Manages user preferences settings including loading, saving, and editing preferences.
 *
 * This component initializes state for user preferences and loading states, utilizing effects to load preferences on mount.
 * It provides functionality to save updated preferences, handle cancellation of edits, and displays appropriate loading indicators and error messages.
 * The component also includes UI elements for editing GitHub-related settings and dashboard preferences.
 *
 * @param onSettingsChange - Callback function triggered when settings are changed.
 * @returns JSX.Element representing the user preferences settings interface.
 */
export function UserPreferencesSettings({
  onSettingsChange,
}: UserPreferencesSettingsProps) {
  const { toast } = useToast();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    githubOwner: '',
    githubRepo: '',
    githubRepoId: 0,
  });

  useEffect(() => {
    loadPreferences();
  }, []);

  /**
   * Loads user preferences and updates the application state.
   *
   * This function sets the loading state to true, retrieves user preferences using the loadUserPreferences function,
   * and updates the preferences and edit form state accordingly. If an error occurs during the loading process,
   * it logs the error and displays a toast notification to inform the user. Finally, it resets the loading state.
   */
  const loadPreferences = async () => {
    try {
      setIsLoading(true);
      const prefs = await loadUserPreferences();
      setPreferences(prefs);
      setEditForm({
        githubOwner: prefs.githubOwner || '',
        githubRepo: prefs.githubRepo || '',
        githubRepoId: prefs.githubRepoId || 0,
      });
    } catch (error) {
      console.error('Failed to load preferences:', error);
      toast({
        title: 'Error',
        description: 'Failed to load user preferences',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handles the saving of user preferences.
   *
   * This function sets a saving state, attempts to save user preferences using the saveUserPreferences function, and handles the success or failure of that operation. On success, it loads the updated preferences, updates the editing state, and triggers a settings change notification. In case of an error, it logs the error and displays a toast notification indicating the failure. The saving state is reset in the finally block.
   */
  const handleSave = async () => {
    try {
      setIsSaving(true);
      const success = await saveUserPreferences({
        githubOwner: editForm.githubOwner,
        githubRepo: editForm.githubRepo,
        githubRepoId: editForm.githubRepoId,
      });

      if (success) {
        await loadPreferences();
        setIsEditing(false);
        onSettingsChange?.('Profile', 'Preferences updated successfully');
        toast({
          title: 'Success',
          description: 'User preferences saved successfully',
        });
      } else {
        throw new Error('Failed to save preferences');
      }
    } catch (error) {
      console.error('Failed to save preferences:', error);
      toast({
        title: 'Error',
        description: 'Failed to save user preferences',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Handles the cancellation of an editing session.
   *
   * This function checks if preferences are available. If so, it updates the edit form state with the
   * corresponding values from preferences, providing default values if they are not set. Finally, it
   * sets the editing state to false, indicating that the editing session has been canceled.
   */
  const handleCancel = () => {
    if (preferences) {
      setEditForm({
        githubOwner: preferences.githubOwner || '',
        githubRepo: preferences.githubRepo || '',
        githubRepoId: preferences.githubRepoId || 0,
      });
    }
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <IconUser className='size-5' />
            Profile Settings
          </CardTitle>
          <CardDescription>
            Manage your personal information and preferences
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          <div className='space-y-4'>
            <Skeleton className='h-4 w-32' />
            <Skeleton className='h-10 w-full' />
          </div>
          <div className='space-y-4'>
            <Skeleton className='h-4 w-32' />
            <Skeleton className='h-10 w-full' />
          </div>
          <div className='space-y-4'>
            <Skeleton className='h-4 w-32' />
            <Skeleton className='h-10 w-full' />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className='space-y-6 px-4 lg:px-6'>
      {/* Profile Information */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <IconUser className='size-5' />
            Profile Information
          </CardTitle>
          <CardDescription>
            Manage your personal information and account details
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
            <div className='space-y-2'>
              <Label htmlFor='githubOwner'>GitHub Owner</Label>
              {isEditing ? (
                <Input
                  id='githubOwner'
                  value={editForm.githubOwner}
                  onChange={e =>
                    setEditForm(prev => ({
                      ...prev,
                      githubOwner: e.target.value,
                    }))
                  }
                  placeholder='Enter GitHub username or organization'
                />
              ) : (
                <div className='flex items-center gap-2'>
                  <span className='text-sm text-muted-foreground'>
                    {preferences?.githubOwner || 'Not set'}
                  </span>
                  {preferences?.githubOwner && (
                    <Badge variant='secondary' className='text-xs'>
                      Active
                    </Badge>
                  )}
                </div>
              )}
            </div>

            <div className='space-y-2'>
              <Label htmlFor='githubRepo'>GitHub Repository</Label>
              {isEditing ? (
                <Input
                  id='githubRepo'
                  value={editForm.githubRepo}
                  onChange={e =>
                    setEditForm(prev => ({
                      ...prev,
                      githubRepo: e.target.value,
                    }))
                  }
                  placeholder='Enter repository name'
                />
              ) : (
                <div className='flex items-center gap-2'>
                  <span className='text-sm text-muted-foreground'>
                    {preferences?.githubRepo || 'Not set'}
                  </span>
                  {preferences?.githubRepo && (
                    <Badge variant='secondary' className='text-xs'>
                      Active
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>

          <Separator />

          <div className='flex items-center justify-between'>
            <div className='space-y-1'>
              <h4 className='text-sm font-medium'>Repository ID</h4>
              <p className='text-sm text-muted-foreground'>
                {preferences?.githubRepoId
                  ? `ID: ${preferences.githubRepoId}`
                  : 'No repository selected'}
              </p>
            </div>
            {isEditing && (
              <Input
                type='number'
                value={editForm.githubRepoId}
                onChange={e =>
                  setEditForm(prev => ({
                    ...prev,
                    githubRepoId: parseInt(e.target.value) || 0,
                  }))
                }
                placeholder='Repository ID'
                className='w-32'
              />
            )}
          </div>

          <div className='flex items-center gap-2'>
            {isEditing ? (
              <>
                <Button onClick={handleSave} disabled={isSaving} size='sm'>
                  {isSaving ? (
                    <IconLoader2 className='size-4 mr-2 animate-spin' />
                  ) : (
                    <IconCheck className='size-4 mr-2' />
                  )}
                  Save Changes
                </Button>
                <Button onClick={handleCancel} variant='outline' size='sm'>
                  <IconX className='size-4 mr-2' />
                  Cancel
                </Button>
              </>
            ) : (
              <Button onClick={() => setIsEditing(true)} size='sm'>
                <IconEdit className='size-4 mr-2' />
                Edit Profile
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dashboard Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <IconCalendar className='size-5' />
            Dashboard Preferences
          </CardTitle>
          <CardDescription>
            Customize how your dashboard displays information
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          <div className='space-y-4'>
            <div className='flex items-center justify-between'>
              <div className='space-y-1'>
                <Label htmlFor='compactMode'>Compact Mode</Label>
                <p className='text-sm text-muted-foreground'>
                  Show more information in a condensed layout
                </p>
              </div>
              <Switch id='compactMode' defaultChecked={false} />
            </div>

            <div className='flex items-center justify-between'>
              <div className='space-y-1'>
                <Label htmlFor='showSidebar'>Show Sidebar</Label>
                <p className='text-sm text-muted-foreground'>
                  Display the navigation sidebar by default
                </p>
              </div>
              <Switch id='showSidebar' defaultChecked />
            </div>

            <div className='flex items-center justify-between'>
              <div className='space-y-1'>
                <Label htmlFor='gridLayout'>Grid Layout</Label>
                <p className='text-sm text-muted-foreground'>
                  Use grid layout instead of list view
                </p>
              </div>
              <Switch id='gridLayout' defaultChecked />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
