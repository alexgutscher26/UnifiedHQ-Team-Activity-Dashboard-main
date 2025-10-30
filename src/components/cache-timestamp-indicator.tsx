'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  IconClock,
  IconDatabase,
  IconWifi,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { cn } from '@/lib/utils';

interface CacheTimestampIndicatorProps {
  timestamp: number;
  source: 'network' | 'cache';
  className?: string;
  variant?: 'badge' | 'text' | 'icon';
  showIcon?: boolean;
  staleThresholdMinutes?: number;
}

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
