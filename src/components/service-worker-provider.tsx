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

  const dismissUpdatePrompt = () => {
    setShowUpdatePrompt(false);
    setPendingRegistration(null);
  };

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
