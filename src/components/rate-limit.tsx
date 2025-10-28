'use client';

import React, { useEffect, useState } from 'react';
import { Clock, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { rateLimitManager, type RateLimitState } from '@/lib/auth-client';

interface RateLimitBannerProps {
  className?: string;
}

export function RateLimitBanner({ className }: RateLimitBannerProps) {
  const [rateLimitState, setRateLimitState] = useState<RateLimitState>({
    isRateLimited: false,
    retryAfter: 0,
    retryAt: null,
  });

  useEffect(() => {
    const unsubscribe = rateLimitManager.subscribe(setRateLimitState);
    return unsubscribe;
  }, []);

  if (!rateLimitState.isRateLimited) return null;

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
    <Card
      className={cn(
        'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/20',
        className
      )}
    >
      <CardHeader className='pb-3'>
        <div className='flex items-center gap-2'>
          <AlertTriangle className='h-5 w-5 text-yellow-600' />
          <CardTitle className='text-lg text-yellow-800 dark:text-yellow-200'>
            Rate Limit Exceeded
          </CardTitle>
        </div>
        <CardDescription className='text-yellow-700 dark:text-yellow-300'>
          Too many requests. Please wait before trying again.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='space-y-2'>
          <div className='flex items-center justify-between text-sm'>
            <span className='text-yellow-700 dark:text-yellow-300'>
              <Clock className='inline h-4 w-4 mr-1' />
              Time remaining: {formatTime(rateLimitState.retryAfter)}
            </span>
            <span className='text-yellow-600 dark:text-yellow-400 font-medium'>
              {rateLimitState.retryAfter} seconds
            </span>
          </div>
          <Progress
            value={progress}
            className='h-2 bg-yellow-200 dark:bg-yellow-800'
          />
        </div>

        <div className='text-xs text-yellow-600 dark:text-yellow-400'>
          💡 Tip: Rate limits help protect our service. Please wait for the
          countdown to complete.
        </div>
      </CardContent>
    </Card>
  );
}

interface RateLimitOverlayProps {
  className?: string;
}

export function RateLimitOverlay({ className }: RateLimitOverlayProps) {
  const [rateLimitState, setRateLimitState] = useState<RateLimitState>({
    isRateLimited: false,
    retryAfter: 0,
    retryAt: null,
  });

  useEffect(() => {
    const unsubscribe = rateLimitManager.subscribe(setRateLimitState);
    return unsubscribe;
  }, []);

  if (!rateLimitState.isRateLimited) return null;

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${remainingSeconds}s`;
  };

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm',
        className
      )}
    >
      <Card className='w-full max-w-md mx-4'>
        <CardHeader className='text-center'>
          <div className='mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/20'>
            <AlertTriangle className='h-6 w-6 text-yellow-600' />
          </div>
          <CardTitle className='text-xl'>Rate Limit Exceeded</CardTitle>
          <CardDescription>
            You've made too many requests. Please wait before trying again.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          <div className='text-center space-y-2'>
            <div className='text-3xl font-bold text-yellow-600 dark:text-yellow-400'>
              {formatTime(rateLimitState.retryAfter)}
            </div>
            <div className='text-sm text-muted-foreground'>Time remaining</div>
          </div>

          <div className='space-y-2'>
            <div className='flex items-center justify-between text-sm'>
              <span>Progress</span>
              <span>{rateLimitState.retryAfter} seconds</span>
            </div>
            <Progress
              value={
                rateLimitState.retryAt
                  ? Math.max(
                      0,
                      Math.min(
                        100,
                        ((rateLimitState.retryAt - Date.now()) /
                          (rateLimitState.retryAfter * 1000)) *
                          100
                      )
                    )
                  : 0
              }
              className='h-2'
            />
          </div>

          <div className='text-center'>
            <Button
              variant='outline'
              onClick={() => window.location.reload()}
              className='w-full'
            >
              <RefreshCw className='mr-2 h-4 w-4' />
              Refresh Page
            </Button>
          </div>

          <div className='text-xs text-center text-muted-foreground'>
            Rate limits help protect our service and ensure fair usage for all
            users.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Hook for rate limit state
export function useRateLimit() {
  const [rateLimitState, setRateLimitState] = useState<RateLimitState>({
    isRateLimited: false,
    retryAfter: 0,
    retryAt: null,
  });

  useEffect(() => {
    const unsubscribe = rateLimitManager.subscribe(setRateLimitState);
    return unsubscribe;
  }, []);

  return rateLimitState;
}
