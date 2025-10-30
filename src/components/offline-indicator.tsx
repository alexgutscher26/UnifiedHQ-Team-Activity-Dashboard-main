'use client';

import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, AlertTriangle, CheckCircle } from 'lucide-react';
import { useNetworkStatusContext } from '@/contexts/network-status-context';
import { cn } from '@/lib/utils';

interface OfflineIndicatorProps {
  className?: string;
  showWhenOnline?: boolean;
  autoHide?: boolean;
  autoHideDelay?: number;
  position?: 'top' | 'bottom';
  variant?: 'banner' | 'badge' | 'toast';
}

export function OfflineIndicator({
  className,
  showWhenOnline = false,
  autoHide = true,
  autoHideDelay = 3000,
  position = 'top',
  variant = 'banner',
}: OfflineIndicatorProps) {
  const networkStatus = useNetworkStatusContext();

  const [isVisible, setIsVisible] = useState(false);
  const [justCameOnline, setJustCameOnline] = useState(false);

  // Show/hide logic
  useEffect(() => {
    if (networkStatus.isOffline) {
      setIsVisible(true);
      setJustCameOnline(false);
    } else if (networkStatus.isOnline) {
      if (isVisible) {
        // Just came back online
        setJustCameOnline(true);

        if (showWhenOnline) {
          // Show online status briefly
          const timer = setTimeout(() => {
            if (autoHide) {
              setIsVisible(false);
              setJustCameOnline(false);
            }
          }, autoHideDelay);

          return () => clearTimeout(timer);
        } else {
          // Hide immediately if not showing online status
          setIsVisible(false);
          setJustCameOnline(false);
        }
      }
    }
  }, [
    networkStatus.isOnline,
    networkStatus.isOffline,
    isVisible,
    showWhenOnline,
    autoHide,
    autoHideDelay,
  ]);

  if (!isVisible) {
    return null;
  }

  const isOffline = networkStatus.isOffline;
  const isOnline = networkStatus.isOnline && justCameOnline;

  const getVariantStyles = () => {
    const baseStyles =
      'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-300';

    switch (variant) {
      case 'banner':
        return cn(
          baseStyles,
          'absolute top-0 left-72 right-0 justify-center z-50 flex items-center w-full',
          position === 'top' ? 'border-b' : 'border-t',
          isOffline &&
            'bg-destructive text-destructive-foreground border-destructive/20',
          isOnline && 'bg-green-500 text-white border-green-500/20'
        );

      case 'badge':
        return cn(
          baseStyles,
          'rounded-full shadow-lg',
          isOffline && 'bg-destructive text-destructive-foreground',
          isOnline && 'bg-green-500 text-white'
        );

      case 'toast':
        return cn(
          baseStyles,
          'rounded-lg shadow-lg border max-w-sm',
          isOffline &&
            'bg-destructive text-destructive-foreground border-destructive/20',
          isOnline && 'bg-green-500 text-white border-green-500/20'
        );

      default:
        return baseStyles;
    }
  };

  const getIcon = () => {
    if (isOffline) {
      return <WifiOff className='h-4 w-4' />;
    }
    if (isOnline) {
      return <CheckCircle className='h-4 w-4' />;
    }
    return <Wifi className='h-4 w-4' />;
  };

  const getMessage = () => {
    if (isOffline) {
      return "You're offline. Some features may not be available.";
    }
    if (isOnline) {
      return "You're back online!";
    }
    return 'Connected';
  };

  const getConnectionDetails = () => {
    if (!networkStatus.effectiveType && !networkStatus.downlink) {
      return null;
    }

    const details = [];
    if (networkStatus.effectiveType) {
      details.push(networkStatus.effectiveType.toUpperCase());
    }
    if (networkStatus.downlink) {
      details.push(`${networkStatus.downlink} Mbps`);
    }
    if (networkStatus.rtt) {
      details.push(`${networkStatus.rtt}ms`);
    }

    return details.length > 0 ? ` (${details.join(', ')})` : null;
  };

  return (
    <div
      className={cn(getVariantStyles(), className)}
      role='status'
      aria-live='polite'
      aria-label={getMessage()}
      aria-atomic='true'
    >
      {getIcon()}
      <span>
        {getMessage()}
        {isOnline && getConnectionDetails()}
      </span>

      {isOffline && <AlertTriangle className='h-4 w-4 ml-auto' />}
    </div>
  );
}

// Preset variants for common use cases
export function OfflineBanner(props: Omit<OfflineIndicatorProps, 'variant'>) {
  return <OfflineIndicator {...props} variant='banner' />;
}

export function OfflineBadge(props: Omit<OfflineIndicatorProps, 'variant'>) {
  return <OfflineIndicator {...props} variant='badge' />;
}

export function OfflineToast(props: Omit<OfflineIndicatorProps, 'variant'>) {
  return <OfflineIndicator {...props} variant='toast' />;
}
