'use client';

import React from 'react';
import { OptimizedImage } from './optimized-image';
import { cn } from '@/lib/utils';

interface AvatarImageProps {
  src: string;
  alt: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | number;
  className?: string;
  fallback?: string;
  priority?: boolean;
}

const sizeMap = {
  sm: 32,
  md: 40,
  lg: 48,
  xl: 64,
};

export const AvatarImage: React.FC<AvatarImageProps> = ({
  src,
  alt,
  size = 'md',
  className = '',
  fallback,
  priority = false,
}) => {
  const sizeValue = typeof size === 'number' ? size : sizeMap[size];

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-full bg-gray-100',
        className
      )}
      style={{ width: sizeValue, height: sizeValue }}
    >
      <OptimizedImage
        src={src}
        alt={alt}
        width={sizeValue}
        height={sizeValue}
        quality='avatar'
        priority={priority}
        className='w-full h-full object-cover'
        fallback={fallback}
        lazy={!priority}
      />
    </div>
  );
};

export default AvatarImage;
