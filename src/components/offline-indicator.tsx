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

/**
 * Displays an offline indicator based on the network status.
 *
 * The component uses the network status context to determine if the user is online or offline. It manages visibility based on the network state and user preferences for showing online status. The indicator can auto-hide after a specified delay and supports different visual variants (banner, badge, toast) based on the provided props.
 *
 * @param className - Additional CSS classes to apply to the indicator.
 * @param showWhenOnline - A flag indicating whether to show the indicator when the user is back online.
 * @param autoHide - A flag indicating whether the indicator should auto-hide when online.
 * @param autoHideDelay - The delay in milliseconds before the indicator auto-hides when online.
 * @param position - The position of the indicator (top or bottom).
 * @param variant - The visual style of the indicator (banner, badge, or toast).
 */
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

  /**
   * Get the variant styles based on the provided variant type.
   *
   * This function constructs a set of CSS class names based on the variant type ('banner', 'badge', or 'toast') and the online/offline status. It uses a base style and conditionally adds additional styles based on the variant and the current state of isOffline and isOnline. The final class names are generated using the cn function.
   *
   * @returns A string containing the combined CSS class names for the specified variant.
   */
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

  /**
   * Returns an icon based on the online/offline status.
   *
   * The function checks the current network status using the variables isOffline and isOnline.
   * If the device is offline, it returns a WifiOff icon. If online, it returns a CheckCircle icon.
   * If neither condition is met, it defaults to returning a Wifi icon.
   */
  const getIcon = () => {
    if (isOffline) {
      return <WifiOff className='h-4 w-4' />;
    }
    if (isOnline) {
      return <CheckCircle className='h-4 w-4' />;
    }
    return <Wifi className='h-4 w-4' />;
  };

  /**
   * Retrieves a message based on the current online status.
   *
   * The function checks the values of `isOffline` and `isOnline` to determine the appropriate message to return.
   * If the user is offline, it informs them that some features may not be available.
   * If the user is online, it confirms their online status.
   * If neither condition is met, it returns a default message indicating a connected state.
   */
  const getMessage = () => {
    if (isOffline) {
      return "You're offline. Some features may not be available.";
    }
    if (isOnline) {
      return "You're back online!";
    }
    return 'Connected';
  };

  /**
   * Retrieves the connection details based on the current network status.
   *
   * The function checks if the network status has an effective type or downlink speed.
   * If either is present, it constructs an array of details including the effective type
   * (converted to uppercase), downlink speed in Mbps, and round-trip time in milliseconds.
   * Finally, it returns a formatted string of these details or null if no information is available.
   */
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
/**
 * Renders an OfflineIndicator with a 'banner' variant.
 */
export function OfflineBanner(props: Omit<OfflineIndicatorProps, 'variant'>) {
  return <OfflineIndicator {...props} variant='banner' />;
}

/**
 * Renders an OfflineIndicator with a 'badge' variant.
 */
export function OfflineBadge(props: Omit<OfflineIndicatorProps, 'variant'>) {
  return <OfflineIndicator {...props} variant='badge' />;
}

/**
 * Renders an OfflineIndicator with a 'toast' variant.
 */
export function OfflineToast(props: Omit<OfflineIndicatorProps, 'variant'>) {
  return <OfflineIndicator {...props} variant='toast' />;
}
