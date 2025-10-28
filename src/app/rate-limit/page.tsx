'use client';

import React from 'react';
import { AlertTriangle, Clock, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { RateLimitBanner } from '@/components/rate-limit';
import { useRateLimit } from '@/components/rate-limit';

export default function RateLimitPage() {
  const rateLimitState = useRateLimit();

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${remainingSeconds}s`;
  };

  const progress = rateLimitState.retryAt
    ? Math.max(
        0,
        Math.min(
          100,
          ((rateLimitState.retryAt - Date.now()) /
            (rateLimitState.retryAfter * 1000)) *
            100
        )
      )
    : 0;

  return (
    <div className='min-h-screen bg-background flex items-center justify-center p-4'>
      <div className='w-full max-w-2xl space-y-6'>
        <Card>
          <CardHeader className='text-center'>
            <div className='mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/20'>
              <AlertTriangle className='h-8 w-8 text-yellow-600' />
            </div>
            <CardTitle className='text-3xl'>Rate Limit Exceeded</CardTitle>
            <CardDescription className='text-lg'>
              You've made too many requests and have been temporarily limited.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-6'>
            <div className='text-center space-y-4'>
              <div className='text-4xl font-bold text-yellow-600 dark:text-yellow-400'>
                {formatTime(rateLimitState.retryAfter)}
              </div>
              <div className='text-sm text-muted-foreground'>
                Time remaining before you can try again
              </div>
            </div>

            <div className='space-y-2'>
              <div className='flex items-center justify-between text-sm'>
                <span className='flex items-center gap-1'>
                  <Clock className='h-4 w-4' />
                  Progress
                </span>
                <span>{rateLimitState.retryAfter} seconds remaining</span>
              </div>
              <Progress value={progress} className='h-3' />
            </div>

            <div className='flex flex-col gap-3 sm:flex-row'>
              <Button
                onClick={() => window.location.reload()}
                className='flex-1'
              >
                <RefreshCw className='mr-2 h-4 w-4' />
                Refresh Page
              </Button>
              <Button
                variant='outline'
                onClick={() => (window.location.href = '/dashboard')}
                className='flex-1'
              >
                <Home className='mr-2 h-4 w-4' />
                Go to Dashboard
              </Button>
            </div>

            <div className='rounded-lg bg-muted p-4 space-y-2'>
              <h3 className='font-semibold'>Why am I seeing this?</h3>
              <p className='text-sm text-muted-foreground'>
                Rate limits help protect our service from abuse and ensure fair
                usage for all users. This temporary restriction will be lifted
                automatically once the countdown completes.
              </p>
            </div>

            <div className='rounded-lg bg-blue-50 dark:bg-blue-950/20 p-4 space-y-2'>
              <h3 className='font-semibold text-blue-800 dark:text-blue-200'>
                💡 Tips to avoid rate limits
              </h3>
              <ul className='text-sm text-blue-700 dark:text-blue-300 space-y-1'>
                <li>• Avoid rapid clicking or refreshing</li>
                <li>• Wait for requests to complete before making new ones</li>
                <li>• Use the application normally without automation</li>
                <li>• Contact support if you believe this is an error</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <RateLimitBanner />
      </div>
    </div>
  );
}
