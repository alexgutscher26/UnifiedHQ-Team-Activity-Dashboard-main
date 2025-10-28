/**
 * Error logging utility for tracking and reporting errors
 */

export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  url?: string;
  userAgent?: string;
  timestamp?: string;
  componentStack?: string;
  errorId?: string;
}

export interface ErrorDetails {
  message: string;
  stack?: string;
  name: string;
  componentStack?: string;
  context: ErrorContext;
}

class ErrorLogger {
  private errors: ErrorDetails[] = [];
  private maxErrors = 50;

  logError(error: Error, errorInfo?: any, errorId?: string): void {
    const errorDetails: ErrorDetails = {
      message: error.message,
      stack: error.stack,
      name: error.name,
      componentStack: errorInfo?.componentStack,
      context: {
        errorId: errorId || this.generateErrorId(),
        timestamp: new Date().toISOString(),
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        userAgent:
          typeof window !== 'undefined'
            ? window.navigator.userAgent
            : undefined,
      },
    };

    this.errors.unshift(errorDetails);
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(0, this.maxErrors);
    }

    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 Error Boundary Caught Error');
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
      console.error('Error Details:', errorDetails);
      console.groupEnd();
    }

    if (process.env.NODE_ENV === 'production') {
      this.sendToErrorService(errorDetails);
    }
  }

  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async sendToErrorService(errorDetails: ErrorDetails): Promise<void> {
    try {
      await fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorDetails),
      });
    } catch (err) {
      console.error('Failed to send error to tracking service:', err);
    }
  }
}

const errorLogger = new ErrorLogger();

export function logError(
  error: Error,
  errorInfo?: any,
  errorId?: string
): void {
  errorLogger.logError(error, errorInfo, errorId);
}
