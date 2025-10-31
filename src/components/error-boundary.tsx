'use client';

import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className='flex flex-col items-center justify-center min-h-[400px] p-8'>
            <h2 className='text-xl font-semibold mb-4'>Something went wrong</h2>
            <p className='text-muted-foreground mb-4'>
              The page encountered an error. Please refresh to try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className='px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90'
            >
              Refresh Page
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
