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
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  IconShield,
  IconKey,
  IconEye,
  IconEyeOff,
  IconAlertTriangle,
  IconCheck,
  IconX,
  IconRefresh,
  IconLogout,
  IconDeviceDesktop,
  IconBrandGithub,
  IconBrandSlack,
} from '@tabler/icons-react';

interface SecuritySettingsProps {
  onSettingsChange?: (section: string, message: string) => void;
}

interface SecuritySettings {
  twoFactorEnabled: boolean;
  sessionTimeout: '15min' | '1hour' | '8hours' | '24hours';
  loginNotifications: boolean;
  dataEncryption: boolean;
  auditLogging: boolean;
}

interface ConnectedSession {
  id: string;
  device: string;
  location: string;
  lastActive: string;
  current: boolean;
}

export function SecuritySettings({ onSettingsChange }: SecuritySettingsProps) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<SecuritySettings>({
    twoFactorEnabled: false,
    sessionTimeout: '8hours',
    loginNotifications: true,
    dataEncryption: true,
    auditLogging: true,
  });
  const [sessions, setSessions] = useState<ConnectedSession[]>([
    {
      id: '1',
      device: 'Chrome on Windows',
      location: 'New York, NY',
      lastActive: '2 minutes ago',
      current: true,
    },
    {
      id: '2',
      device: 'Safari on iPhone',
      location: 'San Francisco, CA',
      lastActive: '1 hour ago',
      current: false,
    },
    {
      id: '3',
      device: 'Firefox on Mac',
      location: 'London, UK',
      lastActive: '2 days ago',
      current: false,
    },
  ]);
  const [showPassword, setShowPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const saveSettings = (newSettings: Partial<SecuritySettings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);

    try {
      localStorage.setItem(
        'security-settings',
        JSON.stringify(updatedSettings)
      );
      onSettingsChange?.('Security', 'Settings updated successfully');
      toast({
        title: 'Settings Updated',
        description: 'Security preferences have been saved',
      });
    } catch (error) {
      console.error('Failed to save security settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save security settings',
        variant: 'destructive',
      });
    }
  };

  const handlePasswordChange = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        title: 'Error',
        description: 'New passwords do not match',
        variant: 'destructive',
      });
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      toast({
        title: 'Error',
        description: 'Password must be at least 8 characters long',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsChangingPassword(true);

      // Simulate password change API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });

      onSettingsChange?.('Security', 'Password changed successfully');
      toast({
        title: 'Password Changed',
        description: 'Your password has been updated successfully',
      });
    } catch (error) {
      console.error('Failed to change password:', error);
      toast({
        title: 'Error',
        description: 'Failed to change password',
        variant: 'destructive',
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      setSessions(prev => prev.filter(session => session.id !== sessionId));
      onSettingsChange?.('Security', 'Session revoked successfully');
      toast({
        title: 'Session Revoked',
        description: 'The selected session has been revoked',
      });
    } catch (error) {
      console.error('Failed to revoke session:', error);
      toast({
        title: 'Error',
        description: 'Failed to revoke session',
        variant: 'destructive',
      });
    }
  };

  const handleRevokeAllSessions = async () => {
    try {
      setSessions(prev => prev.filter(session => session.current));
      onSettingsChange?.('Security', 'All sessions revoked successfully');
      toast({
        title: 'All Sessions Revoked',
        description: 'All other sessions have been revoked',
      });
    } catch (error) {
      console.error('Failed to revoke all sessions:', error);
      toast({
        title: 'Error',
        description: 'Failed to revoke all sessions',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className='space-y-6 px-4 lg:px-6'>
      {/* Password Security */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <IconKey className='size-5' />
            Password Security
          </CardTitle>
          <CardDescription>
            Manage your password and authentication settings
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='current-password'>Current Password</Label>
              <div className='relative'>
                <Input
                  id='current-password'
                  type={showPassword ? 'text' : 'password'}
                  value={passwordForm.currentPassword}
                  onChange={e =>
                    setPasswordForm(prev => ({
                      ...prev,
                      currentPassword: e.target.value,
                    }))
                  }
                  placeholder='Enter current password'
                />
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  className='absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent'
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <IconEyeOff className='h-4 w-4' />
                  ) : (
                    <IconEye className='h-4 w-4' />
                  )}
                </Button>
              </div>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='new-password'>New Password</Label>
              <Input
                id='new-password'
                type={showPassword ? 'text' : 'password'}
                value={passwordForm.newPassword}
                onChange={e =>
                  setPasswordForm(prev => ({
                    ...prev,
                    newPassword: e.target.value,
                  }))
                }
                placeholder='Enter new password'
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='confirm-password'>Confirm New Password</Label>
              <Input
                id='confirm-password'
                type={showPassword ? 'text' : 'password'}
                value={passwordForm.confirmPassword}
                onChange={e =>
                  setPasswordForm(prev => ({
                    ...prev,
                    confirmPassword: e.target.value,
                  }))
                }
                placeholder='Confirm new password'
              />
            </div>

            <Button
              onClick={handlePasswordChange}
              disabled={
                isChangingPassword ||
                !passwordForm.currentPassword ||
                !passwordForm.newPassword ||
                !passwordForm.confirmPassword
              }
            >
              {isChangingPassword ? (
                <IconRefresh className='h-4 w-4 mr-2 animate-spin' />
              ) : (
                <IconCheck className='h-4 w-4 mr-2' />
              )}
              Change Password
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Two-Factor Authentication */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <IconShield className='size-5' />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Add an extra layer of security to your account
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          <div className='flex items-center justify-between'>
            <div className='space-y-1'>
              <Label htmlFor='two-factor'>Enable 2FA</Label>
              <p className='text-sm text-muted-foreground'>
                Require a second verification step when signing in
              </p>
            </div>
            <Switch
              id='two-factor'
              checked={settings.twoFactorEnabled}
              onCheckedChange={checked =>
                saveSettings({ twoFactorEnabled: checked })
              }
            />
          </div>

          {settings.twoFactorEnabled && (
            <div className='p-4 border rounded-lg bg-green-50 dark:bg-green-900/20'>
              <div className='flex items-center gap-2 text-green-700 dark:text-green-400'>
                <IconCheck className='h-4 w-4' />
                <span className='text-sm font-medium'>
                  Two-factor authentication is enabled
                </span>
              </div>
              <p className='text-sm text-green-600 dark:text-green-300 mt-1'>
                Your account is protected with an additional security layer
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Session Management */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <IconDeviceDesktop className='size-5' />
            Active Sessions
          </CardTitle>
          <CardDescription>Manage your active login sessions</CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          <div className='space-y-4'>
            {sessions.map(session => (
              <div
                key={session.id}
                className='flex items-center justify-between p-4 border rounded-lg'
              >
                <div className='space-y-1'>
                  <div className='flex items-center gap-2'>
                    <span className='font-medium'>{session.device}</span>
                    {session.current && (
                      <Badge variant='default' className='text-xs'>
                        Current
                      </Badge>
                    )}
                  </div>
                  <div className='text-sm text-muted-foreground'>
                    {session.location} • Last active: {session.lastActive}
                  </div>
                </div>
                {!session.current && (
                  <Button
                    onClick={() => handleRevokeSession(session.id)}
                    variant='outline'
                    size='sm'
                  >
                    <IconX className='h-4 w-4 mr-2' />
                    Revoke
                  </Button>
                )}
              </div>
            ))}
          </div>

          <div className='flex items-center gap-2'>
            <Button
              onClick={handleRevokeAllSessions}
              variant='outline'
              size='sm'
            >
              <IconLogout className='h-4 w-4 mr-2' />
              Revoke All Other Sessions
            </Button>
            <p className='text-sm text-muted-foreground'>
              This will sign out all devices except this one
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Security Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <IconShield className='size-5' />
            Security Preferences
          </CardTitle>
          <CardDescription>
            Configure additional security settings
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          <div className='space-y-2'>
            <Label htmlFor='session-timeout'>Session Timeout</Label>
            <select
              id='session-timeout'
              value={settings.sessionTimeout}
              onChange={e =>
                saveSettings({ sessionTimeout: e.target.value as any })
              }
              className='w-full p-2 border rounded-md bg-background'
            >
              <option value='15min'>15 minutes</option>
              <option value='1hour'>1 hour</option>
              <option value='8hours'>8 hours</option>
              <option value='24hours'>24 hours</option>
            </select>
          </div>

          <div className='flex items-center justify-between'>
            <div className='space-y-1'>
              <Label htmlFor='login-notifications'>Login Notifications</Label>
              <p className='text-sm text-muted-foreground'>
                Get notified when someone signs in to your account
              </p>
            </div>
            <Switch
              id='login-notifications'
              checked={settings.loginNotifications}
              onCheckedChange={checked =>
                saveSettings({ loginNotifications: checked })
              }
            />
          </div>

          <div className='flex items-center justify-between'>
            <div className='space-y-1'>
              <Label htmlFor='data-encryption'>Data Encryption</Label>
              <p className='text-sm text-muted-foreground'>
                Encrypt sensitive data at rest
              </p>
            </div>
            <Switch
              id='data-encryption'
              checked={settings.dataEncryption}
              onCheckedChange={checked =>
                saveSettings({ dataEncryption: checked })
              }
            />
          </div>

          <div className='flex items-center justify-between'>
            <div className='space-y-1'>
              <Label htmlFor='audit-logging'>Audit Logging</Label>
              <p className='text-sm text-muted-foreground'>
                Log security events for monitoring
              </p>
            </div>
            <Switch
              id='audit-logging'
              checked={settings.auditLogging}
              onCheckedChange={checked =>
                saveSettings({ auditLogging: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Connected Accounts */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <IconShield className='size-5' />
            Connected Accounts
          </CardTitle>
          <CardDescription>
            Manage your connected third-party accounts
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex items-center justify-between p-4 border rounded-lg'>
            <div className='flex items-center gap-3'>
              <IconBrandGithub className='h-5 w-5' />
              <div>
                <div className='font-medium'>GitHub</div>
                <div className='text-sm text-muted-foreground'>Connected</div>
              </div>
            </div>
            <Badge variant='default' className='bg-green-500'>
              Active
            </Badge>
          </div>

          <div className='flex items-center justify-between p-4 border rounded-lg'>
            <div className='flex items-center gap-3'>
              <IconBrandSlack className='h-5 w-5' />
              <div>
                <div className='font-medium'>Slack</div>
                <div className='text-sm text-muted-foreground'>Connected</div>
              </div>
            </div>
            <Badge variant='default' className='bg-green-500'>
              Active
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Security Warning */}
      <Card className='border-destructive/20'>
        <CardHeader>
          <CardTitle className='flex items-center gap-2 text-destructive'>
            <IconAlertTriangle className='size-5' />
            Security Notice
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='space-y-2 text-sm text-muted-foreground'>
            <p>• Keep your password secure and don't share it with anyone</p>
            <p>• Enable two-factor authentication for enhanced security</p>
            <p>
              • Regularly review your active sessions and revoke unused ones
            </p>
            <p>• Report any suspicious activity immediately</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
