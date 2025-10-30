'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { IconDatabase, IconWifi, IconAlertTriangle } from '@tabler/icons-react';
import { cn } from '@/lib/utils';

interface CacheTimestampIndicatorProps {
  timestamp: number;
  source: 'network' | 'cache';
  className?: string;
  variant?: 'badge' | 'text' | 'icon';
  showIcon?: boolean;
  staleThresholdMinutes?: number;
}

/**
 * Render a cache timestamp indicator with varying styles based on freshness and source.
 *
 * The function calculates the age of the timestamp in minutes and determines if the data is stale or from cache.
 * It formats the age for display, applies appropriate styles based on the variant, and provides tooltip content
 * that indicates the source and freshness of the data. The rendering logic varies based on the specified variant.
 *
 * @param {Object} props - The properties for the CacheTimestampIndicator.
 * @param {number} props.timestamp - The timestamp to evaluate.
 * @param {string} props.source - The source of the data (e.g., 'cache').
 * @param {string} [props.className] - Additional class names for styling.
 * @param {string} [props.variant='badge'] - The variant of the indicator (e.g., 'text', 'icon', 'badge').
 * @param {boolean} [props.showIcon=true] - Whether to show an icon alongside the timestamp.
 * @param {number} [props.staleThresholdMinutes=15] - The threshold in minutes to consider the data stale.
 * @returns {JSX.Element} The rendered cache timestamp indicator component.
 */
export function CacheTimestampIndicator({
  timestamp,
  source,
  className,
  variant = 'badge',
  showIcon = true,
  staleThresholdMinutes = 15,
}: CacheTimestampIndicatorProps) {
  const now = Date.now();
  const ageInMinutes = Math.floor((now - timestamp) / (1000 * 60));
  const isStale = ageInMinutes > staleThresholdMinutes;
  const isFromCache = source === 'cache';

  /**
   * Formats a given age in minutes into a human-readable string.
   *
   * The function checks the number of minutes and returns a corresponding string representation.
   * If the minutes are less than 1, it returns 'Just now'. For minutes less than 60, it returns
   * the number of minutes followed by 'm ago'. For hours and days, it calculates the appropriate
   * values and returns them in the format of 'h ago' or 'd ago' respectively.
   *
   * @param minutes - The age in minutes to be formatted.
   */
  const formatAge = (minutes: number) => {
    if (minutes < 1) {
      return 'Just now';
    } else if (minutes < 60) {
      return `${minutes}m ago`;
    } else {
      const hours = Math.floor(minutes / 60);
      if (hours < 24) {
        return `${hours}h ago`;
      } else {
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
      }
    }
  };

  const getVariantStyles = () => {
    if (variant === 'text') {
      return cn(
        'text-xs',
        isStale ? 'text-orange-600' : 'text-muted-foreground',
        className
      );
    }

    if (variant === 'icon') {
      return cn(
        'size-4',
        isStale ? 'text-orange-500' : 'text-muted-foreground',
        className
      );
    }

    // Badge variant
    const baseVariant = isFromCache
      ? isStale
        ? 'destructive'
        : 'secondary'
      : 'outline';

    return cn('text-xs', className);
  };

  /**
   * Retrieves the appropriate icon based on the current state.
   *
   * The function checks if the icon should be displayed. If `showIcon` is false, it returns null.
   * If the icon is from cache, it further checks if the data is stale to determine whether to
   * return an `IconAlertTriangle` or an `IconDatabase`. If the icon is not from cache, it defaults
   * to returning an `IconWifi`.
   */
  const getIcon = () => {
    if (!showIcon) return null;

    if (isFromCache) {
      return isStale ? (
        <IconAlertTriangle className='size-3' />
      ) : (
        <IconDatabase className='size-3' />
      );
    }

    return <IconWifi className='size-3' />;
  };

  /**
   * Generates tooltip content based on data source and age.
   */
  const getTooltipContent = () => {
    const ageText = formatAge(ageInMinutes);
    const sourceText = isFromCache ? 'cached' : 'live';
    const staleText = isStale ? ' (may be outdated)' : '';

    return `Data ${sourceText} ${ageText}${staleText}`;
  };

  if (variant === 'text') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={getVariantStyles()}>
              {showIcon && (
                <span className='inline-flex items-center gap-1'>
                  {getIcon()}
                  {formatAge(ageInMinutes)}
                </span>
              )}
              {!showIcon && formatAge(ageInMinutes)}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{getTooltipContent()}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (variant === 'icon') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={getVariantStyles()}>{getIcon()}</div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{getTooltipContent()}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Badge variant
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant={
              isFromCache ? (isStale ? 'destructive' : 'secondary') : 'outline'
            }
            className={getVariantStyles()}
          >
            {showIcon && (
              <>
                {getIcon()}
                <span className='ml-1'>{isFromCache ? 'Cached' : 'Live'}</span>
              </>
            )}
            {!showIcon && (isFromCache ? 'Cached' : 'Live')}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{getTooltipContent()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface DataFreshnessIndicatorProps {
  timestamp: number;
  source: 'network' | 'cache';
  className?: string;
  showLabel?: boolean;
}

/**
 * Render a data freshness indicator based on the provided timestamp and source.
 *
 * This function calculates the age of the data in minutes and determines if it is stale based on a 15-minute threshold.
 * It also checks if the data is from cache to adjust the display color and text accordingly. The component returns a
 * styled indicator along with an optional label that reflects the freshness status of the data.
 *
 * @param timestamp - The timestamp indicating when the data was last updated.
 * @param source - The source of the data, which can affect its freshness status.
 * @param className - Additional CSS classes to apply to the component.
 * @param showLabel - A boolean indicating whether to display the freshness label (default is true).
 * @returns A JSX element representing the data freshness indicator.
 */
export function DataFreshnessIndicator({
  timestamp,
  source,
  className,
  showLabel = true,
}: DataFreshnessIndicatorProps) {
  const now = Date.now();
  const ageInMinutes = Math.floor((now - timestamp) / (1000 * 60));
  const isStale = ageInMinutes > 15; // 15 minutes threshold
  const isFromCache = source === 'cache';

  /**
   * Determines the freshness color based on the age of the data.
   *
   * The function checks if the data is from cache and evaluates its age in minutes.
   * If the data is cached, it returns a color indicating freshness: green for less than 5 minutes,
   * yellow for less than 15 minutes, and red for older data. If the data is live, it is always considered fresh and returns green.
   */
  const getFreshnessColor = () => {
    if (isFromCache) {
      if (ageInMinutes < 5) return 'text-green-500';
      if (ageInMinutes < 15) return 'text-yellow-500';
      return 'text-red-500';
    }
    return 'text-green-500'; // Live data is always fresh
  };

  const getFreshnessText = () => {
    if (!isFromCache) return 'Live';

    if (ageInMinutes < 5) return 'Fresh';
    if (ageInMinutes < 15) return 'Recent';
    return 'Stale';
  };

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <div
        className={cn(
          'size-2 rounded-full',
          getFreshnessColor().replace('text-', 'bg-')
        )}
      />
      {showLabel && (
        <span className={cn('text-xs', getFreshnessColor())}>
          {getFreshnessText()}
        </span>
      )}
    </div>
  );
}
