# Image Optimization and WebP Support

This document describes the image optimization features implemented in the project, including WebP support, lazy loading, and responsive images.

## Features

### 🚀 Automatic Format Optimization
- **WebP Support**: Automatic conversion to WebP format for supported browsers
- **AVIF Support**: Next-generation format for even better compression
- **Fallback Support**: Graceful fallback to JPEG/PNG for older browsers
- **SVG Support**: Proper handling of vector graphics

### 📱 Responsive Images
- **Multiple Breakpoints**: Optimized images for different screen sizes
- **Device-Specific Sizing**: Automatic sizing based on device capabilities
- **Retina Support**: High-resolution images for retina displays

### ⚡ Performance Optimizations
- **Lazy Loading**: Images load only when they come into view
- **Preloading**: Critical images are preloaded for better performance
- **Caching**: Intelligent caching with configurable TTL
- **Blur Placeholders**: Smooth loading experience with blur placeholders

### 🎨 Quality Control
- **Multiple Quality Levels**: Hero (90%), Card (80%), Thumbnail (70%), Avatar (75%)
- **Custom Quality**: Support for custom quality values
- **Format Selection**: Automatic selection of best format for each use case

## Components

### OptimizedImage
The main component for optimized images with WebP support.

```tsx
import { OptimizedImage } from '@/components/optimized-image';

<OptimizedImage
  src="/path/to/image.jpg"
  alt="Description"
  width={800}
  height={600}
  quality="hero"
  priority={true}
  className="rounded-lg"
/>
```

**Props:**
- `src`: Image source path
- `alt`: Alt text for accessibility
- `width`: Image width (optional if using fill)
- `height`: Image height (optional if using fill)
- `quality`: Quality level ('hero', 'card', 'thumbnail', 'avatar') or number
- `priority`: Whether to preload the image
- `className`: CSS classes
- `sizes`: Responsive sizes string
- `fill`: Whether to fill the container
- `lazy`: Whether to lazy load (default: true)
- `blur`: Whether to show blur placeholder (default: true)
- `fallback`: Fallback image URL
- `onLoad`: Load event handler
- `onError`: Error event handler

### AvatarImage
Specialized component for avatar images.

```tsx
import { AvatarImage } from '@/components/avatar-image';

<AvatarImage
  src="/path/to/avatar.jpg"
  alt="User avatar"
  size="lg"
  priority={true}
/>
```

**Props:**
- `src`: Avatar image source
- `alt`: Alt text
- `size`: Size ('sm', 'md', 'lg', 'xl') or number
- `className`: CSS classes
- `fallback`: Fallback image URL
- `priority`: Whether to preload

### ImageGallery
Interactive gallery component with thumbnails and fullscreen view.

```tsx
import { ImageGallery } from '@/components/image-gallery';

<ImageGallery
  images={[
    {
      src: '/image1.jpg',
      alt: 'Image 1',
      caption: 'Description',
      width: 800,
      height: 600,
    },
    // ... more images
  ]}
  showThumbnails={true}
  autoPlay={false}
  interval={5000}
/>
```

**Props:**
- `images`: Array of image objects
- `showThumbnails`: Whether to show thumbnail navigation
- `autoPlay`: Whether to auto-advance images
- `interval`: Auto-play interval in milliseconds
- `className`: CSS classes

## Utilities

### Image Utils
Utility functions for image optimization.

```tsx
import {
  customImageLoader,
  getResponsiveImageSizes,
  getOptimizedImageProps,
  supportsWebP,
  generateSrcSet,
  preloadImage,
} from '@/lib/image-utils';
```

### Lazy Loading Hook
Hook for implementing lazy loading.

```tsx
import { useLazyImage } from '@/hooks/use-lazy-image';

const { imgRef, isIntersecting, hasLoaded } = useLazyImage({
  threshold: 0.1,
  rootMargin: '50px',
  triggerOnce: true,
});
```

## Configuration

### Next.js Configuration
The image optimization is configured in `next.config.mjs`:

```javascript
const nextConfig = {
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};
```

### Sharp Installation
Sharp is required for image optimization:

```bash
npm install sharp
```

## Usage Examples

### Basic Image
```tsx
<OptimizedImage
  src="/hero-image.jpg"
  alt="Hero image"
  width={1200}
  height={600}
  quality="hero"
  priority={true}
/>
```

### Responsive Image
```tsx
<OptimizedImage
  src="/card-image.jpg"
  alt="Card image"
  width={400}
  height={300}
  quality="card"
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
/>
```

### Lazy Loaded Image
```tsx
<OptimizedImage
  src="/lazy-image.jpg"
  alt="Lazy loaded image"
  width={600}
  height={400}
  quality="card"
  lazy={true}
/>
```

### Avatar Image
```tsx
<AvatarImage
  src="/user-avatar.jpg"
  alt="User avatar"
  size="lg"
  fallback="/default-avatar.jpg"
/>
```

### Image Gallery
```tsx
<ImageGallery
  images={galleryImages}
  showThumbnails={true}
  autoPlay={true}
  interval={3000}
/>
```

## Best Practices

### 1. Use Appropriate Quality Levels
- **Hero images**: Use `quality="hero"` (90%) for above-the-fold images
- **Card images**: Use `quality="card"` (80%) for content images
- **Thumbnails**: Use `quality="thumbnail"` (70%) for small images
- **Avatars**: Use `quality="avatar"` (75%) for profile pictures

### 2. Implement Lazy Loading
- Use `lazy={true}` for images below the fold
- Use `priority={true}` for critical images
- Consider using the `useLazyImage` hook for custom implementations

### 3. Provide Fallbacks
- Always provide `alt` text for accessibility
- Use `fallback` prop for error handling
- Consider providing multiple image formats

### 4. Optimize Sizes
- Use appropriate `width` and `height` values
- Provide responsive `sizes` attribute
- Consider using `fill` for container-based sizing

### 5. Preload Critical Images
- Use `priority={true}` for above-the-fold images
- Use `preloadImage()` utility for custom preloading
- Consider using the `onLoad` callback for additional logic

## Performance Benefits

### WebP Format
- **25-35% smaller** file sizes compared to JPEG
- **Better compression** with similar quality
- **Wide browser support** (95%+ of users)

### Lazy Loading
- **Faster initial page load** by deferring non-critical images
- **Reduced bandwidth usage** for users who don't scroll
- **Better Core Web Vitals** scores

### Responsive Images
- **Optimal image sizes** for each device
- **Reduced bandwidth** on mobile devices
- **Better user experience** across all devices

### Caching
- **Faster subsequent loads** with intelligent caching
- **Reduced server load** with client-side caching
- **Better performance** for returning users

## Browser Support

### WebP Support
- Chrome 23+ (2012)
- Firefox 65+ (2019)
- Safari 14+ (2020)
- Edge 18+ (2018)

### AVIF Support
- Chrome 85+ (2020)
- Firefox 93+ (2021)
- Safari 16+ (2022)
- Edge 85+ (2020)

### Fallback Strategy
The implementation automatically falls back to JPEG/PNG for browsers that don't support WebP/AVIF, ensuring compatibility across all browsers.

## Troubleshooting

### Common Issues

1. **Images not loading**
   - Check if Sharp is installed
   - Verify image paths are correct
   - Check browser console for errors

2. **WebP not working**
   - Ensure Next.js image optimization is enabled
   - Check browser support
   - Verify image format compatibility

3. **Lazy loading not working**
   - Check if Intersection Observer is supported
   - Verify `lazy` prop is set to `true`
   - Check for JavaScript errors

4. **Performance issues**
   - Use appropriate quality levels
   - Implement lazy loading for non-critical images
   - Consider using `priority` for critical images

### Debug Mode
Enable debug mode by setting `NODE_ENV=development` to see additional logging information.

## Migration Guide

### From Standard Images
Replace standard `<img>` tags with `<OptimizedImage>`:

```tsx
// Before
<img src="/image.jpg" alt="Description" width={800} height={600} />

// After
<OptimizedImage
  src="/image.jpg"
  alt="Description"
  width={800}
  height={600}
  quality="card"
/>
```

### From Next.js Image
The `OptimizedImage` component extends Next.js Image with additional features:

```tsx
// Before
import Image from 'next/image';

<Image
  src="/image.jpg"
  alt="Description"
  width={800}
  height={600}
  quality={80}
/>

// After
import { OptimizedImage } from '@/components/optimized-image';

<OptimizedImage
  src="/image.jpg"
  alt="Description"
  width={800}
  height={600}
  quality="card"
  lazy={true}
/>
```

## Contributing

When adding new image-related features:

1. Follow the existing component patterns
2. Add proper TypeScript types
3. Include accessibility features
4. Add performance optimizations
5. Update documentation
6. Test across different browsers and devices

## Resources

- [Next.js Image Optimization](https://nextjs.org/docs/basic-features/image-optimization)
- [WebP Format](https://developers.google.com/speed/webp)
- [AVIF Format](https://caniuse.com/avif)
- [Sharp Documentation](https://sharp.pixelplumbing.com/)
- [Intersection Observer API](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API)
