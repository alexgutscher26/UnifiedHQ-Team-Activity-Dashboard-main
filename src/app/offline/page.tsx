'use client';

import React, { useEffect, useState } from 'react';
import { WifiOff, RefreshCw, Home, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { safeLogger, sanitizeError } from '@/lib/safe-logger';

export default function OfflinePage() {
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);

  // Update last updated time
  const updateLastUpdated = () => {
    setLastUpdated(new Date().toLocaleString());
  };

  // Check connection periodically
  const checkConnection = async () => {
    if (isCheckingConnection) return;

    setIsCheckingConnection(true);

    try {
      if (navigator.onLine) {
        // Try to fetch a small resource to verify connectivity
        const response = await fetch('/api/health', {
          method: 'HEAD',
          cache: 'no-cache',
          signal: AbortSignal.timeout(5000) // 5 second timeout
        });

        if (response.ok) {
          // Connection restored, redirect to home
          window.location.href = '/';
          return;
        }
      }
    } catch (error) {
      // Still offline or fetch failed
      safeLogger.log('Connection check failed:', sanitizeError(error));
    } finally {
      setIsCheckingConnection(false);
    }

    // Schedule next check
    setTimeout(checkConnection, 5000);
  };

  // Handle online event
  const handleOnline = () => {
    setTimeout(() => {
      window.location.href = '/';
    }, 1000);
  };

  useEffect(() => {
    // Initialize
    updateLastUpdated();
    checkConnection();

    // Listen for online events
    window.addEventListener('online', handleOnline);

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array is intentional - we only want this to run once

  return (
    <div className='min-h-screen bg-background flex items-center justify-center p-4'>
      <div className='max-w-md w-full text-center space-y-6'>
        {/* Offline Icon */}
        <div className='flex justify-center'>
          <div className='relative'>
            <div className='w-24 h-24 bg-muted rounded-full flex items-center justify-center'>
              <WifiOff className='w-12 h-12 text-muted-foreground' />
            </div>
            <div className='absolute -top-1 -right-1 w-6 h-6 bg-destructive rounded-full flex items-center justify-center'>
              <span className='text-destructive-foreground text-xs font-bold'>
                !
              </span>
            </div>
          </div>
        </div>

        {/* Title and Description */}
        <div className='space-y-2'>
          <h1 className='text-2xl font-bold text-foreground'>You're Offline</h1>
          <p className='text-muted-foreground'>
            It looks like you've lost your internet connection. Don't worry, you
            can still access some cached content.
          </p>
        </div>

        {/* Status Information */}
        <div className='bg-muted/50 rounded-lg p-4 space-y-3'>
          <div className='flex items-center gap-2 text-sm'>
            <Clock className='w-4 h-4 text-muted-foreground' />
            <span className='text-muted-foreground'>
              Last updated: <span>{lastUpdated || 'Loading...'}</span>
            </span>
          </div>

          <div className='text-xs text-muted-foreground'>
            Some features may be limited while offline. Your changes will be
            saved and synced when you reconnect.
          </div>
        </div>

        {/* Available Actions */}
        <div className='space-y-3'>
          <Button
            onClick={() => window.location.reload()}
            className='w-full'
            variant='default'
          >
            <RefreshCw className='w-4 h-4 mr-2' />
            Try Again
          </Button>

          <Button asChild variant='outline' className='w-full'>
            <Link href='/'>
              <Home className='w-4 h-4 mr-2' />
              Go to Dashboard
            </Link>
          </Button>
        </div>

        {/* Cached Content Notice */}
        <div className='text-xs text-muted-foreground border-t pt-4'>
          <p>
            You can still view recently accessed pages and data. Any actions you
            take will be saved locally and synchronized when you're back online.
          </p>
        </div>
      </div>


    </div>
  );
}
