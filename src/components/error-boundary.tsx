'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  AlertTriangle,
  RefreshCw,
  Home,
  Bug,
  Copy,
  Check,
  X,
} from 'lucide-react';
import { logError } from '@/lib/error-logger';
import { cn } from '@/lib/utils';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetOnPropsChange?: boolean;
  resetKeys?: Array<string | number>;
  enableAutoRecovery?: boolean;
  autoRecoveryDelay?: number;
  maxRetries?: number;
  showErrorId?: boolean;
  enableErrorReporting?: boolean;
  className?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
  retryCount: number;
  isRetrying: boolean;
  lastErrorTime: number | null;
  errorReported: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: number | null = null;
  private autoRecoveryTimeoutId: number | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0,
      isRetrying: false,
      lastErrorTime: null,
      errorReported: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      lastErrorTime: Date.now(),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Generate unique error ID
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Log error details
    logError(error, errorInfo, errorId);

    this.setState({
      error,
      errorInfo,
      errorId,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Enable automatic recovery if configured
    const {
      enableAutoRecovery = false,
      autoRecoveryDelay = 5000,
      maxRetries = 3,
    } = this.props;
    if (enableAutoRecovery && this.state.retryCount < maxRetries) {
      this.scheduleAutoRecovery(autoRecoveryDelay);
    }
  }

  componentDidUpdate(prevProps: Props) {
    const { resetKeys, resetOnPropsChange } = this.props;
    const { hasError } = this.state;

    if (hasError && prevProps.resetKeys !== resetKeys) {
      if (resetOnPropsChange) {
        this.resetErrorBoundary();
      }
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
    if (this.autoRecoveryTimeoutId) {
      clearTimeout(this.autoRecoveryTimeoutId);
    }
  }

  resetErrorBoundary = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
    if (this.autoRecoveryTimeoutId) {
      clearTimeout(this.autoRecoveryTimeoutId);
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      isRetrying: false,
    });
  };

  scheduleAutoRecovery = (delay: number) => {
    this.setState({ isRetrying: true });

    this.autoRecoveryTimeoutId = window.setTimeout(() => {
      this.setState(prevState => ({
        retryCount: prevState.retryCount + 1,
        isRetrying: false,
      }));
      this.resetErrorBoundary();
    }, delay);
  };

  handleRetry = () => {
    this.setState(prevState => ({
      retryCount: prevState.retryCount + 1,
    }));
    this.resetErrorBoundary();
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/dashboard';
  };

  handleReportError = async () => {
    const { error, errorInfo, errorId } = this.state;
    if (!error || this.state.errorReported) return;

    try {
      // Report error to external service
      await fetch('/api/errors/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          errorId,
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo?.componentStack,
          timestamp: Date.now(),
          userAgent: navigator.userAgent,
          url: window.location.href,
        }),
      });

      this.setState({ errorReported: true });
    } catch (reportError) {
      console.error('Failed to report error:', reportError);
    }
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          errorId={this.state.errorId}
          retryCount={this.state.retryCount}
          isRetrying={this.state.isRetrying}
          errorReported={this.state.errorReported}
          showErrorId={this.props.showErrorId}
          enableErrorReporting={this.props.enableErrorReporting}
          className={this.props.className}
          onRetry={this.handleRetry}
          onReload={this.handleReload}
          onGoHome={this.handleGoHome}
          onReportError={this.handleReportError}
        />
      );
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
  retryCount: number;
  isRetrying: boolean;
  errorReported: boolean;
  showErrorId?: boolean;
  enableErrorReporting?: boolean;
  className?: string;
  onRetry: () => void;
  onReload: () => void;
  onGoHome: () => void;
  onReportError: () => void;
}

/**
 * Renders an error fallback UI when an unexpected error occurs.
 *
 * This component displays a user-friendly message indicating that something went wrong, along with options to retry the action, go to the dashboard, or reload the page. It also provides the ability to show technical details about the error, including the error message and component stack if available. The component manages its own state to toggle the visibility of the technical details.
 *
 * @param {Object} props - The properties for the ErrorFallback component.
 * @param {Error} props.error - The error object containing error details.
 * @param {Object} props.errorInfo - Additional information about the error context.
 * @param {string} props.errorId - An identifier for the error, if available.
 * @param {Function} props.onRetry - Callback function to retry the action that caused the error.
 * @param {Function} props.onReload - Callback function to reload the current page.
 * @param {Function} props.onGoHome - Callback function to navigate to the home/dashboard.
 */
function ErrorFallback({
  error,
  errorInfo,
  errorId,
  retryCount,
  isRetrying,
  errorReported,
  showErrorId = true,
  enableErrorReporting = false,
  className,
  onRetry,
  onReload,
  onGoHome,
  onReportError,
}: ErrorFallbackProps) {
  const [showDetails, setShowDetails] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [logCopied, setLogCopied] = React.useState(false);

  const copyErrorId = async () => {
    if (!errorId) return;

    try {
      await navigator.clipboard.writeText(errorId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy error ID:', err);
    }
  };

  const copyFullLog = async () => {
    if (!error) return;

    try {
      const logData = {
        errorId,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        retryCount,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        componentStack: errorInfo?.componentStack,
        environment: {
          platform: navigator.platform,
          language: navigator.language,
          cookieEnabled: navigator.cookieEnabled,
          onLine: navigator.onLine,
        },
      };

      const logText = `Error Log - ${errorId}
Timestamp: ${logData.timestamp}
URL: ${logData.url}
Retry Count: ${logData.retryCount}

Error Details:
Name: ${logData.error.name}
Message: ${logData.error.message}

Stack Trace:
${logData.error.stack || 'No stack trace available'}

Component Stack:
${logData.componentStack || 'No component stack available'}

Environment:
Platform: ${logData.environment.platform}
Language: ${logData.environment.language}
Online: ${logData.environment.onLine}
User Agent: ${logData.userAgent}`;

      await navigator.clipboard.writeText(logText);
      setLogCopied(true);
      setTimeout(() => setLogCopied(false), 3000);
    } catch (err) {
      console.error('Failed to copy error log:', err);
    }
  };

  const getErrorMessage = () => {
    if (!error) return 'An unexpected error occurred';

    // Provide more user-friendly error messages
    if (error.message.includes('ChunkLoadError')) {
      return 'Failed to load application resources. Please refresh the page.';
    }
    if (error.message.includes('NetworkError')) {
      return 'Network connection issue. Please check your internet connection.';
    }
    if (error.message.includes('TypeError')) {
      return 'Application error. Please try refreshing the page.';
    }

    return error.message || 'An unexpected error occurred';
  };

  return (
    <div
      className={cn(
        'min-h-screen flex items-center justify-center bg-background p-4',
        className
      )}
    >
      <Card className='w-full max-w-2xl' role='alert' aria-live='polite'>
        <CardHeader className='text-center'>
          <div className='mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10'>
            <AlertTriangle
              className='h-6 w-6 text-destructive'
              aria-hidden='true'
            />
          </div>
          <CardTitle className='text-2xl'>Something went wrong</CardTitle>
          <CardDescription>
            {getErrorMessage()}
            {retryCount > 0 && (
              <span className='block mt-2 text-sm text-muted-foreground'>
                Retry attempt {retryCount}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-6'>
          {showErrorId && errorId && (
            <div className='rounded-lg bg-muted p-3 text-sm flex items-center justify-between'>
              <div>
                <strong>Error ID:</strong> {errorId}
              </div>
              <Button
                variant='ghost'
                size='sm'
                onClick={copyErrorId}
                className='ml-2 h-6 w-6 p-0'
                aria-label='Copy error ID'
              >
                {copied ? (
                  <Check className='h-3 w-3 text-green-600' />
                ) : (
                  <Copy className='h-3 w-3' />
                )}
              </Button>
            </div>
          )}

          <div className='flex flex-col gap-3 sm:flex-row'>
            <Button
              onClick={onRetry}
              className='flex-1'
              disabled={isRetrying}
              aria-label='Try again'
            >
              <RefreshCw
                className={cn('mr-2 h-4 w-4', isRetrying && 'animate-spin')}
              />
              {isRetrying ? 'Retrying...' : 'Try Again'}
            </Button>
            <Button
              onClick={onGoHome}
              variant='outline'
              className='flex-1'
              aria-label='Go to dashboard'
            >
              <Home className='mr-2 h-4 w-4' />
              Go to Dashboard
            </Button>
            <Button
              onClick={onReload}
              variant='outline'
              className='flex-1'
              aria-label='Reload page'
            >
              <RefreshCw className='mr-2 h-4 w-4' />
              Reload Page
            </Button>
          </div>

          {enableErrorReporting && !errorReported && (
            <div className='text-center'>
              <Button
                variant='ghost'
                size='sm'
                onClick={onReportError}
                className='text-muted-foreground hover:text-foreground'
              >
                Report this error to help us improve
              </Button>
            </div>
          )}

          {errorReported && (
            <div className='text-center text-sm text-green-600'>
              ✓ Error reported successfully. Thank you for your feedback!
            </div>
          )}

          <div className='space-y-2'>
            <div className='flex gap-2'>
              <Button
                variant='ghost'
                size='sm'
                onClick={() => setShowDetails(!showDetails)}
                className='flex-1'
                aria-expanded={showDetails}
                aria-controls='error-details'
              >
                <Bug className='mr-2 h-4 w-4' />
                {showDetails ? 'Hide' : 'Show'} Technical Details
              </Button>
              <Button
                variant='ghost'
                size='sm'
                onClick={copyFullLog}
                className='px-3'
                aria-label='Copy full error log'
                title='Copy complete error log including stack trace and environment details'
              >
                {logCopied ? (
                  <Check className='h-4 w-4 text-green-600' />
                ) : (
                  <Copy className='h-4 w-4' />
                )}
              </Button>
            </div>

            {showDetails && (
              <div
                id='error-details'
                className='space-y-4 rounded-lg border bg-muted/50 p-4'
                role='region'
                aria-label='Error technical details'
              >
                {error && (
                  <div>
                    <h4 className='font-semibold text-destructive'>Error:</h4>
                    <pre className='mt-1 overflow-auto rounded bg-background p-2 text-xs max-h-32'>
                      {error.message}
                    </pre>
                    {error.stack && (
                      <>
                        <h4 className='font-semibold text-destructive mt-3'>
                          Stack Trace:
                        </h4>
                        <pre className='mt-1 overflow-auto rounded bg-background p-2 text-xs max-h-32'>
                          {error.stack}
                        </pre>
                      </>
                    )}
                  </div>
                )}

                {errorInfo && (
                  <div>
                    <h4 className='font-semibold text-destructive'>
                      Component Stack:
                    </h4>
                    <pre className='mt-1 overflow-auto rounded bg-background p-2 text-xs max-h-32'>
                      {errorInfo.componentStack}
                    </pre>
                  </div>
                )}

                <div className='text-xs text-muted-foreground'>
                  💡 Tip: Use the copy button above to grab the complete error
                  log for support. If this error persists, please contact
                  support with the Error ID above.
                </div>
              </div>
            )}

            {logCopied && (
              <div className='text-center text-sm text-green-600 bg-green-50 dark:bg-green-950/20 rounded-lg p-2'>
                ✓ Complete error log copied to clipboard!
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Higher-order component for easier usage
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

// Hook for functional components to trigger error boundary
export function useErrorHandler() {
  return (error: Error, errorInfo?: ErrorInfo) => {
    logError(error, errorInfo);
    throw error;
  };
}

// Preset configurations for common use cases
export const ErrorBoundaryPresets = {
  // For critical components that need immediate recovery
  critical: {
    enableAutoRecovery: true,
    autoRecoveryDelay: 3000,
    maxRetries: 5,
    showErrorId: true,
    enableErrorReporting: true,
  },

  // For non-critical components with graceful degradation
  graceful: {
    enableAutoRecovery: false,
    showErrorId: false,
    enableErrorReporting: false,
  },

  // For development with detailed error information
  development: {
    enableAutoRecovery: true,
    autoRecoveryDelay: 2000,
    maxRetries: 3,
    showErrorId: true,
    enableErrorReporting: true,
  },

  // For production with minimal user impact
  production: {
    enableAutoRecovery: true,
    autoRecoveryDelay: 5000,
    maxRetries: 2,
    showErrorId: true,
    enableErrorReporting: true,
  },
} as const;

// Utility function to create error boundary with preset
export function createErrorBoundary(preset: keyof typeof ErrorBoundaryPresets) {
  return function ErrorBoundaryWithPreset(
    props: Omit<Props, keyof (typeof ErrorBoundaryPresets)[typeof preset]>
  ) {
    return <ErrorBoundary {...ErrorBoundaryPresets[preset]} {...props} />;
  };
}
