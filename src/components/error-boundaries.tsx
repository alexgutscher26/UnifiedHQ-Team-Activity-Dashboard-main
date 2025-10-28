'use client';

import React from 'react';
import { ErrorBoundary } from './error-boundary';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Global error boundary for the entire app
 */
export function GlobalErrorBoundary({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('Global error caught:', error, errorInfo);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * Error boundary for dashboard components
 */
export function DashboardErrorBoundary({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary
      fallback={
        <Card className='m-4'>
          <CardHeader>
            <div className='flex items-center gap-2'>
              <AlertTriangle className='h-5 w-5 text-destructive' />
              <CardTitle>Dashboard Error</CardTitle>
            </div>
            <CardDescription>
              Something went wrong while loading the dashboard. Please try
              refreshing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.reload()}>
              <RefreshCw className='mr-2 h-4 w-4' />
              Refresh Dashboard
            </Button>
          </CardContent>
        </Card>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * Error boundary for activity feed
 */
export function ActivityFeedErrorBoundary({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary
      fallback={
        <Card className='m-4'>
          <CardHeader>
            <div className='flex items-center gap-2'>
              <AlertTriangle className='h-5 w-5 text-destructive' />
              <CardTitle>Activity Feed Error</CardTitle>
            </div>
            <CardDescription>
              Unable to load activity data. This might be a temporary issue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant='outline'
              onClick={() => window.location.reload()}
              className='w-full'
            >
              <RefreshCw className='mr-2 h-4 w-4' />
              Retry
            </Button>
          </CardContent>
        </Card>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * Error boundary for GitHub integration
 */
export function GitHubErrorBoundary({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary
      fallback={
        <Card className='m-4'>
          <CardHeader>
            <div className='flex items-center gap-2'>
              <AlertTriangle className='h-5 w-5 text-destructive' />
              <CardTitle>GitHub Integration Error</CardTitle>
            </div>
            <CardDescription>
              There was an issue with the GitHub integration. Please check your
              connection.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='space-y-2'>
              <Button
                variant='outline'
                onClick={() => window.location.reload()}
                className='w-full'
              >
                <RefreshCw className='mr-2 h-4 w-4' />
                Retry Connection
              </Button>
              <Button
                variant='ghost'
                onClick={() => (window.location.href = '/integrations')}
                className='w-full'
              >
                Go to Integrations
              </Button>
            </div>
          </CardContent>
        </Card>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * Error boundary for authentication components
 */
export function AuthErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      fallback={
        <div className='min-h-screen flex items-center justify-center bg-background p-4'>
          <Card className='w-full max-w-md'>
            <CardHeader className='text-center'>
              <div className='mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10'>
                <AlertTriangle className='h-6 w-6 text-destructive' />
              </div>
              <CardTitle>Authentication Error</CardTitle>
              <CardDescription>
                There was an issue with the authentication process. Please try
                again.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => (window.location.href = '/auth/signin')}
                className='w-full'
              >
                Go to Sign In
              </Button>
            </CardContent>
          </Card>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * Error boundary for API components
 */
export function ApiErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      fallback={
        <Card className='m-4'>
          <CardHeader>
            <div className='flex items-center gap-2'>
              <AlertTriangle className='h-5 w-5 text-destructive' />
              <CardTitle>API Error</CardTitle>
            </div>
            <CardDescription>
              Unable to connect to the server. Please check your internet
              connection.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant='outline'
              onClick={() => window.location.reload()}
              className='w-full'
            >
              <RefreshCw className='mr-2 h-4 w-4' />
              Retry
            </Button>
          </CardContent>
        </Card>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * Error boundary for form components
 */
export function FormErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      fallback={
        <div className='rounded-lg border border-destructive/20 bg-destructive/5 p-4'>
          <div className='flex items-center gap-2 text-destructive'>
            <AlertTriangle className='h-4 w-4' />
            <span className='text-sm font-medium'>Form Error</span>
          </div>
          <p className='mt-2 text-sm text-muted-foreground'>
            There was an issue with the form. Please refresh and try again.
          </p>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}
