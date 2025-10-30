'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Displays an error message and provides options to reset or go to the home page.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to console for debugging
    console.error('Next.js error occurred:', error);
  }, [error]);

  return (
    <div className='min-h-screen flex items-center justify-center bg-background p-4'>
      <Card className='w-full max-w-md'>
        <CardHeader className='text-center'>
          <div className='mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10'>
            <AlertTriangle className='h-6 w-6 text-destructive' />
          </div>
          <CardTitle>Something went wrong!</CardTitle>
          <CardDescription>
            An unexpected error occurred. We've been notified and are working to
            fix it.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <Button onClick={reset} className='w-full'>
            <RefreshCw className='mr-2 h-4 w-4' />
            Try again
          </Button>
          <Button
            variant='outline'
            onClick={() => (window.location.href = '/')}
            className='w-full'
          >
            Go to Home
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
