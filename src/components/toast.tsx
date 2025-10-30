'use client';

import React, { useEffect, useState } from 'react';
import { X, AlertTriangle, Info, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toastManager } from '@/lib/auth-client';

interface Toast {
  id: string;
  message: string;
  type: 'error' | 'warning' | 'info' | 'success';
  duration?: number;
}

interface ToastProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

/**
 * Renders a toast notification component with entrance and exit animations.
 *
 * The component manages its visibility state and triggers animations based on the toast's lifecycle.
 * It displays an icon and message based on the toast type and provides a button to remove the toast,
 * which triggers a callback function after a delay. The background color is determined by the toast type.
 *
 * @param {ToastProps} props - The properties for the ToastComponent, including the toast object and onRemove callback.
 */
function ToastComponent({ toast, onRemove }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  /**
   * Initiates the removal process for a toast notification.
   */
  const handleRemove = () => {
    setIsLeaving(true);
    setTimeout(() => onRemove(toast.id), 300);
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle className='h-5 w-5 text-green-600' />;
      case 'error':
        return <AlertCircle className='h-5 w-5 text-red-600' />;
      case 'warning':
        return <AlertTriangle className='h-5 w-5 text-yellow-600' />;
      case 'info':
      default:
        return <Info className='h-5 w-5 text-blue-600' />;
    }
  };

  /**
   * Get the background color based on the type of toast notification.
   *
   * The function evaluates the `toast.type` and returns a corresponding CSS class string for the background and border colors.
   * It handles four cases: 'success', 'error', 'warning', and 'info', defaulting to 'info' if none match.
   *
   * @returns A string representing the CSS classes for the background and border colors.
   */
  const getBackgroundColor = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800';
      case 'error':
        return 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800';
      case 'info':
      default:
        return 'bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800';
    }
  };

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border p-4 shadow-lg transition-all duration-300',
        getBackgroundColor(),
        isVisible && !isLeaving
          ? 'translate-x-0 opacity-100'
          : 'translate-x-full opacity-0'
      )}
      role='alert'
      aria-live='polite'
    >
      {getIcon()}
      <div className='flex-1 text-sm'>
        <p className='font-medium text-foreground'>{toast.message}</p>
      </div>
      <Button
        variant='ghost'
        size='sm'
        onClick={handleRemove}
        className='h-6 w-6 p-0 hover:bg-transparent'
        aria-label='Close notification'
      >
        <X className='h-4 w-4' />
      </Button>
    </div>
  );
}

/**
 * Renders a container for displaying toast notifications.
 */
export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const unsubscribe = toastManager.subscribe(setToasts);
    return unsubscribe;
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className='fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm'>
      {toasts.map(toast => (
        <ToastComponent
          key={toast.id}
          toast={toast}
          onRemove={id => toastManager.remove(id)}
        />
      ))}
    </div>
  );
}

// Hook for programmatic toast usage
/**
 * Provides methods to show and remove toasts.
 */
export function useToast() {
  return {
    show: toastManager.show,
    remove: toastManager.remove,
  };
}
