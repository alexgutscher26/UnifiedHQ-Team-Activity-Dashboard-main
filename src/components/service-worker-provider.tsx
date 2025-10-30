'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  useServiceWorker,
  type UseServiceWorkerReturn,
} from '@/hooks/use-service-worker';
import { toast } from 'sonner';

interface ServiceWorkerContextType extends UseServiceWorkerReturn {
  showUpdatePrompt: boolean;
  dismissUpdatePrompt: () => void;
  acceptUpdate: () => void;
}

const ServiceWorkerContext = createContext<ServiceWorkerContextType | null>(
  null
);

export function useServiceWorkerContext(): ServiceWorkerContextType {
  const context = useContext(ServiceWorkerContext);
  if (!context) {
    throw new Error(
      'useServiceWorkerContext must be used within ServiceWorkerProvider'
    );
  }
  return context;
}

interface ServiceWorkerProviderProps {
  children: React.ReactNode;
  enableUpdatePrompts?: boolean;
  enableErrorToasts?: boolean;
}

/**
 * Provides a context for managing service worker updates and notifications.
 *
 * This component handles the registration of a service worker, manages update prompts, and displays error toasts based on the provided props. It utilizes hooks to manage state and side effects, including showing notifications when updates are available and logging service worker status changes. The context value includes methods for accepting updates and dismissing prompts.
 *
 * @param children - The child components to be rendered within the provider.
 * @param enableUpdatePrompts - A flag to enable or disable update prompts (default is true).
 * @param enableErrorToasts - A flag to enable or disable error toasts (default is true).
 * @returns A ServiceWorkerContext.Provider component wrapping the children.
 */
export function ServiceWorkerProvider({
  children,
  enableUpdatePrompts = true,
  enableErrorToasts = true,
}: ServiceWorkerProviderProps) {
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [pendingRegistration, setPendingRegistration] =
    useState<ServiceWorkerRegistration | null>(null);

  const serviceWorker = useServiceWorker({
    autoRegister: true,
    onUpdateAvailable: registration => {
      console.log('[SW Provider] Update available');
      setPendingRegistration(registration);

      if (enableUpdatePrompts) {
        setShowUpdatePrompt(true);
      }
    },
    onUpdateReady: () => {
      console.log('[SW Provider] Update ready');

      if (enableUpdatePrompts) {
        toast.success('App updated successfully!', {
          description: 'The latest version is now active.',
        });
      }
    },
    onError: error => {
      console.error('[SW Provider] Service worker error:', error);

      if (enableErrorToasts) {
        toast.error('Service Worker Error', {
          description: 'There was an issue with the offline functionality.',
        });
      }
    },
  });

  /**
   * Hides the update prompt and resets the pending registration.
   */
  const dismissUpdatePrompt = () => {
    setShowUpdatePrompt(false);
    setPendingRegistration(null);
  };

  /**
   * Handles the acceptance of an update for the service worker.
   *
   * This function checks if there is a pending registration. If so, it attempts to skip the waiting state of the service worker, hides the update prompt, and clears the pending registration. In case of an error during this process, it logs the error and optionally displays a toast notification to inform the user about the failure.
   */
  const acceptUpdate = async () => {
    if (pendingRegistration) {
      try {
        await serviceWorker.skipWaiting();
        setShowUpdatePrompt(false);
        setPendingRegistration(null);
      } catch (error) {
        console.error('[SW Provider] Failed to apply update:', error);

        if (enableErrorToasts) {
          toast.error('Update Failed', {
            description: 'Failed to apply the update. Please refresh the page.',
          });
        }
      }
    }
  };

  // Show update notification when available
  useEffect(() => {
    if (showUpdatePrompt && enableUpdatePrompts) {
      toast.info('App Update Available', {
        description: 'A new version is available. Would you like to update?',
        action: {
          label: 'Update',
          onClick: acceptUpdate,
        },
        onDismiss: dismissUpdatePrompt,
        duration: 0, // Don't auto-dismiss
      });
    }
  }, [showUpdatePrompt, enableUpdatePrompts]);

  // Log service worker status changes
  useEffect(() => {
    if (serviceWorker.isActive) {
      console.log('[SW Provider] Service worker is active');
    }
  }, [serviceWorker.isActive]);

  const contextValue: ServiceWorkerContextType = {
    ...serviceWorker,
    showUpdatePrompt,
    dismissUpdatePrompt,
    acceptUpdate,
  };

  return (
    <ServiceWorkerContext.Provider value={contextValue}>
      {children}
    </ServiceWorkerContext.Provider>
  );
}
