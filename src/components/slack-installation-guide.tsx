'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  IconBrandSlack,
  IconExternalLink,
  IconCopy,
  IconCheck,
  IconArrowRight,
  IconInfoCircle,
} from '@tabler/icons-react';
import { useToast } from '@/hooks/use-toast';

interface SlackInstallationGuideProps {
  clientId?: string;
}

/**
 * Renders the Slack installation guide modal for users.
 *
 * This component manages the installation process of the Slack app, including displaying the installation URL, handling clipboard actions, and providing troubleshooting information. It utilizes state management for modal visibility and copied step tracking, and it ensures the body scroll is disabled when the modal is open. The installation URL is dynamically generated based on the provided clientId.
 *
 * @param clientId - The client ID used to generate the installation URL for the Slack app.
 */
export function SlackInstallationGuide({
  clientId,
}: SlackInstallationGuideProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [copiedStep, setCopiedStep] = useState<number | null>(null);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const installationUrl = clientId
    ? `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=channels:read,channels:history,groups:read,im:history,mpim:history,users:read,team:read,channels:join&redirect_uri=${encodeURIComponent(window.location.origin + '/api/integrations/slack/callback')}`
    : '';

  const copyToClipboard = async (text: string, step: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedStep(step);
      toast({
        title: 'Copied!',
        description: 'Installation URL copied to clipboard',
      });
      setTimeout(() => setCopiedStep(null), 2000);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy to clipboard',
        variant: 'destructive',
      });
    }
  };

  const steps = [
    {
      number: 1,
      title: 'Install the App',
      description:
        'Click the button below to install UnifiedHQ Integration to your Slack workspace',
      action: (
        <div className='space-y-2'>
          <Button
            onClick={() => window.open(installationUrl, '_blank')}
            className='w-full bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white shadow-lg hover:shadow-xl transition-all duration-200'
            disabled={!clientId}
          >
            <IconBrandSlack className='size-4 mr-2' />
            Install to Slack Workspace
            <IconExternalLink className='size-4 ml-2' />
          </Button>
          {!clientId && (
            <p className='text-xs text-muted-foreground'>
              Client ID not configured. Please check your environment variables.
            </p>
          )}
        </div>
      ),
    },
    {
      number: 2,
      title: 'Authorize Permissions',
      description: 'Review and approve the permissions requested by the app',
      details: [
        'Read messages in channels you select',
        'View basic information about channels',
        'Join public channels automatically',
        'Access your workspace information',
      ],
    },
    {
      number: 3,
      title: 'Return to UnifiedHQ',
      description: "After installation, you'll be redirected back to UnifiedHQ",
      details: [
        'The app will automatically connect to your workspace',
        'You can then select which channels to monitor',
        'Start syncing your Slack activity!',
      ],
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant='outline'
          size='sm'
          className='hover:bg-purple-50 hover:border-purple-200 dark:hover:bg-purple-950/20 dark:hover:border-purple-800 transition-colors'
        >
          <IconInfoCircle className='size-4 mr-2' />
          Installation Guide
        </Button>
      </DialogTrigger>
      <DialogContent className='max-w-3xl max-h-[90vh] overflow-hidden flex flex-col'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <IconBrandSlack className='size-5' />
            Slack App Installation Guide
          </DialogTitle>
          <DialogDescription>
            Follow these steps to install and connect your Slack workspace to
            UnifiedHQ
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-6 overflow-y-auto flex-1 pr-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent'>
          {/* Benefits Card */}
          <Card className='bg-gradient-to-r from-purple-50 to-violet-50 border-purple-200 dark:from-purple-950/50 dark:to-violet-950/50 dark:border-purple-800'>
            <CardHeader className='pb-3'>
              <CardTitle className='text-lg flex items-center gap-2'>
                <IconBrandSlack className='size-5 text-purple-600 dark:text-purple-400' />
                Why Install the Slack App?
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-2'>
              <div className='flex items-center gap-2 text-sm'>
                <IconCheck className='size-4 text-green-600 dark:text-green-400' />
                <span>No manual channel invitations needed</span>
              </div>
              <div className='flex items-center gap-2 text-sm'>
                <IconCheck className='size-4 text-green-600 dark:text-green-400' />
                <span>Automatic access to public channels</span>
              </div>
              <div className='flex items-center gap-2 text-sm'>
                <IconCheck className='size-4 text-green-600 dark:text-green-400' />
                <span>Professional, secure integration</span>
              </div>
              <div className='flex items-center gap-2 text-sm'>
                <IconCheck className='size-4 text-green-600 dark:text-green-400' />
                <span>Works with any Slack workspace</span>
              </div>
            </CardContent>
          </Card>

          {/* Installation Steps */}
          <div className='space-y-4'>
            <h3 className='text-lg font-semibold'>Installation Steps</h3>
            {steps.map((step, index) => (
              <Card
                key={step.number}
                className='relative border-l-4 border-l-primary/20 hover:border-l-primary/40 transition-colors'
              >
                <CardHeader className='pb-3'>
                  <div className='flex items-center gap-3'>
                    <div className='flex items-center justify-center w-10 h-10 bg-primary text-primary-foreground rounded-full text-sm font-semibold shadow-lg'>
                      {step.number}
                    </div>
                    <div className='flex-1'>
                      <CardTitle className='text-base'>{step.title}</CardTitle>
                      <CardDescription className='text-sm'>
                        {step.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className='pt-0'>
                  {step.action}
                  {step.details && (
                    <div className='mt-3 space-y-1'>
                      {step.details.map((detail, idx) => (
                        <div
                          key={idx}
                          className='flex items-center gap-2 text-sm text-muted-foreground'
                        >
                          <IconArrowRight className='size-3' />
                          <span>{detail}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
                {index < steps.length - 1 && (
                  <div className='absolute -bottom-2 left-10 w-px h-6 bg-primary/20' />
                )}
              </Card>
            ))}
          </div>

          {/* Manual Installation Option */}
          <Card className='bg-muted/50 border-dashed'>
            <CardHeader className='pb-3'>
              <CardTitle className='text-base flex items-center gap-2'>
                <IconCopy className='size-4' />
                Manual Installation
              </CardTitle>
              <CardDescription>
                If the automatic installation doesn't work, you can install
                manually
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-3'>
              <div className='space-y-2'>
                <label className='text-sm font-medium'>Installation URL:</label>
                <div className='flex items-center gap-2'>
                  <code className='flex-1 p-3 bg-background border rounded-md text-xs overflow-x-auto font-mono'>
                    {installationUrl || 'Client ID not configured'}
                  </code>
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() => copyToClipboard(installationUrl, 999)}
                    disabled={!clientId}
                  >
                    {copiedStep === 999 ? (
                      <IconCheck className='size-4' />
                    ) : (
                      <IconCopy className='size-4' />
                    )}
                  </Button>
                </div>
              </div>
              <p className='text-xs text-muted-foreground'>
                Copy this URL and paste it in your browser to install the app
                manually
              </p>
            </CardContent>
          </Card>

          {/* Troubleshooting */}
          <Card className='border-orange-200 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-950/20'>
            <CardHeader className='pb-3'>
              <CardTitle className='text-base flex items-center gap-2'>
                <IconInfoCircle className='size-4 text-orange-600 dark:text-orange-400' />
                Troubleshooting
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-2 text-sm'>
              <div className='space-y-2'>
                <p className='font-medium'>Can&apos;t install the app?</p>
                <ul className='list-disc list-inside space-y-1 text-muted-foreground ml-4'>
                  <li>
                    Make sure you&apos;re an admin or have permission to install
                    apps
                  </li>
                  <li>
                    Check if your workspace allows third-party app installations
                  </li>
                  <li>Try the manual installation URL above</li>
                </ul>
              </div>
              <Separator className='my-3' />
              <div className='space-y-2'>
                <p className='font-medium'>App installed but not working?</p>
                <ul className='list-disc list-inside space-y-1 text-muted-foreground ml-4'>
                  <li>Make sure all required permissions were granted</li>
                  <li>Try disconnecting and reconnecting the integration</li>
                  <li>
                    Check that the app is added to the channels you want to
                    monitor
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className='flex justify-end pt-4 border-t bg-gradient-to-r from-transparent via-muted/20 to-transparent flex-shrink-0'>
          <Button onClick={() => setIsOpen(false)} className='px-8'>
            Got it!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
