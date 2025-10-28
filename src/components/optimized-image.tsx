'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { ImageQuality } from '@/types/components';
import {
  getOptimizedImageProps,
  supportsWebP,
  preloadImage,
} from '@/lib/image-utils';
import { cn } from '@/lib/utils';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  quality?: ImageQuality;
  priority?: boolean;
  className?: string;
  sizes?: string;
  fill?: boolean;
  style?: React.CSSProperties;
  onLoad?: () => void;
  onError?: () => void;
  fallback?: string;
  lazy?: boolean;
  blur?: boolean;
}

/**
 * Renders an optimized image component with various loading and error handling features.
 *
 * This component checks for WebP support, preloads critical images if marked as priority, and handles loading and error states.
 * It generates optimized image properties based on the provided dimensions and quality settings, and displays a loading placeholder or error message as needed.
 *
 * @param src - The source URL of the image.
 * @param alt - The alternative text for the image.
 * @param width - The width of the image (default is 800).
 * @param height - The height of the image (default is 600).
 * @param quality - The quality setting for the image (default is 'card').
 * @param priority - Indicates if the image should be prioritized for loading (default is false).
 * @param className - Additional CSS classes to apply to the image.
 * @param sizes - The sizes attribute for responsive images.
 * @param fill - Indicates if the image should fill its container (default is false).
 * @param style - Additional inline styles for the image.
 * @param onLoad - Callback function to be called when the image loads successfully.
 * @param onError - Callback function to be called when the image fails to load.
 * @param fallback - The fallback image source to use in case of an error.
 * @param lazy - Indicates if the image should be lazy-loaded (default is true).
 * @param blur - Indicates if a blur effect should be shown while loading (default is true).
 * @returns A React element representing the optimized image.
 */
export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  width = 800,
  height = 600,
  quality = 'card',
  priority = false,
  className = '',
  sizes,
  fill = false,
  style,
  onLoad,
  onError,
  fallback,
  lazy = true,
  blur = true,
}) => {
  const [imageSrc, setImageSrc] = useState(src);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [webpSupported, setWebpSupported] = useState<boolean | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Check WebP support on mount
  useEffect(() => {
    supportsWebP().then(setWebpSupported);
  }, []);

  // Preload critical images
  useEffect(() => {
    if (priority && src) {
      preloadImage(src);
    }
  }, [priority, src]);

  const handleLoad = () => {
    setIsLoading(false);
    onLoad?.();
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
    if (fallback) {
      setImageSrc(fallback);
    }
    onError?.();
  };

  // Get quality value
  const getQualityValue = () => {
    if (typeof quality === 'number') return quality;

    const qualityMap = {
      hero: 90,
      card: 80,
      thumbnail: 70,
      avatar: 75,
    };

    return qualityMap[quality] || 80;
  };

  // Generate optimized image props
  const imageProps = getOptimizedImageProps(imageSrc, alt, {
    width: fill ? undefined : width,
    height: fill ? undefined : height,
    quality: getQualityValue(),
    priority,
    className: cn(
      'transition-opacity duration-300',
      isLoading && 'opacity-0',
      !isLoading && 'opacity-100',
      className
    ),
    sizes,
  }) as React.ComponentProps<typeof Image>;

  // Add additional props
  if (fill) {
    imageProps.fill = true;
  }

  if (style) {
    imageProps.style = style;
  }

  imageProps.onLoad = handleLoad;
  imageProps.onError = handleError;

  // Show loading placeholder
  if (isLoading && blur) {
    return (
      <div
        className={cn(
          'relative overflow-hidden bg-gray-200 animate-pulse',
          fill ? 'w-full h-full' : '',
          className
        )}
        style={fill ? style : { width, height }}
      >
        <div className='absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 animate-pulse' />
      </div>
    );
  }

  // Show error state
  if (hasError && !fallback) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-gray-100 text-gray-400',
          fill ? 'w-full h-full' : '',
          className
        )}
        style={fill ? style : { width, height }}
      >
        <svg
          className='w-8 h-8'
          fill='none'
          stroke='currentColor'
          viewBox='0 0 24 24'
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={2}
            d='M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'
          />
        </svg>
      </div>
    );
  }

  return (
    <Image
      ref={imgRef}
      {...imageProps}
      alt={alt || ''}
      loading={lazy && !priority ? 'lazy' : 'eager'}
    />
  );
};

// Export a default version for easier imports
export default OptimizedImage;
