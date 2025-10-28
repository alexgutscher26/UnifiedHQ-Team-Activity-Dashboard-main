import { ImageLoaderProps } from 'next/image';

/**
 * Custom image loader for Next.js Image component
 * Provides optimized image URLs with WebP support
 */
export const customImageLoader = ({
  src,
  width,
  quality,
}: ImageLoaderProps): string => {
  // For external URLs, return as-is (Next.js will handle optimization)
  if (src.startsWith('http')) {
    return src;
  }

  // For local images, return the path as-is
  // Next.js will automatically optimize these
  return src;
};

/**
 * Generate responsive image sizes for different breakpoints
 */
export const getResponsiveImageSizes = (baseWidth: number = 800) => {
  return {
    mobile: Math.round(baseWidth * 0.5),
    tablet: Math.round(baseWidth * 0.75),
    desktop: baseWidth,
    large: Math.round(baseWidth * 1.5),
  };
};

/**
 * Image optimization configuration
 */
export const imageConfig = {
  // Quality settings for different image types
  quality: {
    hero: 90,
    card: 80,
    thumbnail: 70,
    avatar: 75,
  },

  // Breakpoint sizes
  breakpoints: {
    mobile: 640,
    tablet: 768,
    desktop: 1024,
    large: 1280,
    xlarge: 1536,
  },

  // Supported formats (in order of preference)
  formats: ['image/avif', 'image/webp', 'image/jpeg', 'image/png'],

  // Placeholder settings
  placeholder: 'blur' as const,
  blurDataURL:
    'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q==',
};

/**
 * Generate optimized image props for Next.js Image component
 */
export const getOptimizedImageProps = (
  src: string,
  alt: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    priority?: boolean;
    className?: string;
    sizes?: string;
  } = {}
) => {
  const {
    width = 800,
    height = 600,
    quality = imageConfig.quality.card,
    priority = false,
    className = '',
    sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
  } = options;

  return {
    src,
    alt,
    width,
    height,
    quality,
    priority,
    className,
    sizes,
    loader: customImageLoader,
    placeholder: imageConfig.placeholder,
    blurDataURL: imageConfig.blurDataURL,
  };
};

/**
 * Check if browser supports WebP format
 */
export const supportsWebP = (): Promise<boolean> => {
  return new Promise(resolve => {
    const webP = new Image();
    webP.onload = webP.onerror = () => {
      resolve(webP.height === 2);
    };
    webP.src =
      'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
  });
};

/**
 * Generate responsive image srcSet for different breakpoints
 */
export const generateSrcSet = (
  baseSrc: string,
  baseWidth: number = 800
): string => {
  const breakpoints = [640, 768, 1024, 1280, 1536];

  return breakpoints
    .map(width => {
      const height = Math.round((baseWidth / width) * (baseWidth * 0.75));
      return `${baseSrc}?w=${width}&h=${height} ${width}w`;
    })
    .join(', ');
};

/**
 * Preload critical images
 */
export const preloadImage = (src: string, as: 'image' = 'image'): void => {
  if (typeof window !== 'undefined') {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = src;
    link.as = as;
    document.head.appendChild(link);
  }
};

/**
 * Lazy load images with intersection observer
 * Note: This function is moved to a separate hook file for better organization
 */
