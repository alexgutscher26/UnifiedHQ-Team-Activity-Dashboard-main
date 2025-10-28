import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({
  size = 'md',
  className,
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return (
    <Loader2 className={cn('animate-spin', sizeClasses[size], className)} />
  );
}

interface LoadingSkeletonProps {
  className?: string;
  lines?: number;
}

export function LoadingSkeleton({
  className,
  lines = 1,
}: LoadingSkeletonProps) {
  if (lines === 1) {
    return (
      <div
        className={cn('animate-pulse rounded-md bg-muted/60', className)}
        style={{
          animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        }}
      />
    );
  }

  return (
    <div className='space-y-2'>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'animate-pulse rounded-md bg-muted/60',
            i === lines - 1 ? 'w-3/4' : 'w-full',
            className
          )}
          style={{
            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
    </div>
  );
}

interface LoadingCardProps {
  className?: string;
  showHeader?: boolean;
  showContent?: boolean;
  showFooter?: boolean;
}

export function LoadingCard({
  className,
  showHeader = true,
  showContent = true,
  showFooter = false,
}: LoadingCardProps) {
  return (
    <div className={cn('rounded-lg border bg-card p-6', className)}>
      {showHeader && (
        <div className='space-y-2 mb-4'>
          <LoadingSkeleton className='h-6 w-1/3' />
          <LoadingSkeleton className='h-4 w-1/2' />
        </div>
      )}
      {showContent && (
        <div className='space-y-3'>
          <LoadingSkeleton className='h-4 w-full' />
          <LoadingSkeleton className='h-4 w-5/6' />
          <LoadingSkeleton className='h-4 w-4/6' />
        </div>
      )}
      {showFooter && (
        <div className='mt-4 pt-4 border-t'>
          <LoadingSkeleton className='h-4 w-1/4' />
        </div>
      )}
    </div>
  );
}

interface LoadingButtonProps {
  loading?: boolean;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
}

export function LoadingButton({
  loading = false,
  children,
  className,
  disabled,
  onClick,
  ...props
}: LoadingButtonProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:pointer-events-none disabled:opacity-50',
        className
      )}
      disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {loading && <LoadingSpinner size='sm' />}
      {children}
    </button>
  );
}

interface LoadingOverlayProps {
  loading: boolean;
  children: React.ReactNode;
  message?: string;
  className?: string;
}

export function LoadingOverlay({
  loading,
  children,
  message = 'Loading...',
  className,
}: LoadingOverlayProps) {
  return (
    <div className={cn('relative', className)}>
      {children}
      {loading && (
        <div className='absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10'>
          <div className='flex flex-col items-center gap-2'>
            <LoadingSpinner size='lg' />
            <p className='text-sm text-muted-foreground'>{message}</p>
          </div>
        </div>
      )}
    </div>
  );
}

interface LoadingStateProps {
  loading: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  className?: string;
}

export function LoadingState({
  loading,
  children,
  fallback,
  className,
}: LoadingStateProps) {
  if (loading) {
    return (
      <div
        className={cn(
          'flex items-center justify-center p-8 transition-opacity duration-300',
          className
        )}
      >
        {fallback || (
          <div className='flex flex-col items-center gap-2'>
            <LoadingSpinner size='lg' />
            <p className='text-sm text-muted-foreground'>Loading...</p>
          </div>
        )}
      </div>
    );
  }

  return <div className='transition-opacity duration-300'>{children}</div>;
}
