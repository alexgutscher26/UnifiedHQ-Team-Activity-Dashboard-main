'use client';

import React, { useState } from 'react';
import { OptimizedImage } from './optimized-image';
import { cn } from '@/lib/utils';
import { AccessibleButton } from './accessible-button';
import { useAriaLiveAnnouncer } from '@/hooks/use-accessibility';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface ImageGalleryProps {
  images: Array<{
    src: string;
    alt: string;
    caption?: string;
    width?: number;
    height?: number;
  }>;
  className?: string;
  showThumbnails?: boolean;
  autoPlay?: boolean;
  interval?: number;
}

/**
 * Renders an image gallery with navigation and fullscreen capabilities.
 *
 * The component manages the current image index, handles keyboard navigation, and supports auto-play functionality.
 * It also provides a thumbnail view and announces changes to the current image for accessibility.
 * The gallery displays a message when there are no images and allows users to navigate through images using buttons or keyboard shortcuts.
 *
 * @param {Object} props - The properties for the ImageGallery component.
 * @param {Array} props.images - An array of image objects to display in the gallery.
 * @param {string} [props.className=''] - Optional additional class names for styling.
 * @param {boolean} [props.showThumbnails=true] - Flag to show or hide thumbnails.
 * @param {boolean} [props.autoPlay=false] - Flag to enable automatic image transitions.
 * @param {number} [props.interval=5000] - The interval time in milliseconds for auto-playing images.
 * @returns {JSX.Element} The rendered image gallery component.
 */
export const ImageGallery: React.FC<ImageGalleryProps> = ({
  images,
  className = '',
  showThumbnails = true,
  autoPlay = false,
  interval = 5000,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { announce } = useAriaLiveAnnouncer();

  const currentImage = images[currentIndex];

  const nextImage = () => {
    setCurrentIndex(prev => (prev + 1) % images.length);
    announce(
      `Image ${currentIndex + 1} of ${images.length}: ${images[(currentIndex + 1) % images.length].alt}`
    );
  };

  /**
   * Updates the current image index to the previous image and announces it.
   */
  const prevImage = () => {
    setCurrentIndex(prev => (prev - 1 + images.length) % images.length);
    announce(
      `Image ${currentIndex} of ${images.length}: ${images[(currentIndex - 1 + images.length) % images.length].alt}`
    );
  };

  /**
   * Navigates to the specified image and announces its details.
   */
  const goToImage = (index: number) => {
    setCurrentIndex(index);
    announce(`Image ${index + 1} of ${images.length}: ${images[index].alt}`);
  };

  const openFullscreen = () => {
    setIsFullscreen(true);
    announce(`Opened fullscreen view for image: ${currentImage.alt}`);
  };

  const closeFullscreen = () => {
    setIsFullscreen(false);
    announce('Closed fullscreen view');
  };

  // Auto-play functionality
  React.useEffect(() => {
    if (autoPlay && images.length > 1) {
      const timer = setInterval(nextImage, interval);
      return () => clearInterval(timer);
    }
  }, [autoPlay, interval, images.length]);

  // Keyboard navigation
  React.useEffect(() => {
    /**
     * Handles key down events for fullscreen navigation.
     *
     * This function checks if the application is in fullscreen mode and responds to specific key presses.
     * If the 'Escape' key is pressed, it calls the closeFullscreen function.
     * The 'ArrowLeft' and 'ArrowRight' keys trigger the prevImage and nextImage functions, respectively,
     * allowing users to navigate through images while in fullscreen.
     *
     * @param e - The KeyboardEvent object representing the key down event.
     */
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isFullscreen) {
        switch (e.key) {
          case 'Escape':
            closeFullscreen();
            break;
          case 'ArrowLeft':
            prevImage();
            break;
          case 'ArrowRight':
            nextImage();
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  if (!images.length) {
    return (
      <div className='flex items-center justify-center h-64 bg-muted rounded-lg'>
        <p className='text-muted-foreground'>No images to display</p>
      </div>
    );
  }

  return (
    <>
      <div className={cn('relative', className)}>
        {/* Main Image */}
        <div className='relative group'>
          <button
            onClick={openFullscreen}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openFullscreen();
              }
            }}
            className='block w-full text-left p-0 border-0 bg-transparent cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-lg'
            aria-label={`Open ${currentImage.alt} in fullscreen view`}
          >
            <OptimizedImage
              src={currentImage.src}
              alt={currentImage.alt}
              width={currentImage.width || 800}
              height={currentImage.height || 600}
              quality='hero'
              className='w-full h-auto rounded-lg'
            />
          </button>

          {/* Navigation Arrows */}
          {images.length > 1 && (
            <>
              <AccessibleButton
                variant='ghost'
                size='icon'
                className='absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity'
                onClick={prevImage}
                aria-label={`Previous image: ${images[(currentIndex - 1 + images.length) % images.length].alt}`}
                announceOnClick={false}
              >
                <ChevronLeft className='w-6 h-6' />
              </AccessibleButton>
              <AccessibleButton
                variant='ghost'
                size='icon'
                className='absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity'
                onClick={nextImage}
                aria-label={`Next image: ${images[(currentIndex + 1) % images.length].alt}`}
                announceOnClick={false}
              >
                <ChevronRight className='w-6 h-6' />
              </AccessibleButton>
            </>
          )}

          {/* Image Counter */}
          {images.length > 1 && (
            <div
              className='absolute bottom-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-sm'
              aria-label={`Image ${currentIndex + 1} of ${images.length}`}
              role='status'
            >
              {currentIndex + 1} / {images.length}
            </div>
          )}
        </div>

        {/* Thumbnails */}
        {showThumbnails && images.length > 1 && (
          <div
            className='flex gap-2 mt-4 overflow-x-auto'
            role='tablist'
            aria-label='Image thumbnails'
          >
            {images.map((image, index) => (
              <AccessibleButton
                key={index}
                onClick={() => goToImage(index)}
                className={cn(
                  'relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all p-0',
                  index === currentIndex
                    ? 'border-blue-500 ring-2 ring-blue-200'
                    : 'border-gray-200 hover:border-gray-300'
                )}
                aria-label={`Go to image ${index + 1}: ${image.alt}`}
                aria-selected={index === currentIndex}
                role='tab'
                announceOnClick={false}
              >
                <OptimizedImage
                  src={image.src}
                  alt=''
                  width={80}
                  height={80}
                  quality='thumbnail'
                  className='w-full h-full object-cover'
                />
              </AccessibleButton>
            ))}
          </div>
        )}

        {/* Caption */}
        {currentImage.caption && (
          <p className='mt-2 text-sm text-muted-foreground text-center'>
            {currentImage.caption}
          </p>
        )}
      </div>

      {/* Fullscreen Modal */}
      {isFullscreen && (
        <div
          className='fixed inset-0 z-50 bg-black/90 flex items-center justify-center'
          role='dialog'
          aria-modal='true'
          aria-labelledby='fullscreen-image-title'
          aria-describedby='fullscreen-image-description'
        >
          <div className='relative max-w-7xl max-h-full p-4'>
            <AccessibleButton
              variant='ghost'
              size='icon'
              className='absolute top-4 right-4 text-white hover:bg-white/20'
              onClick={closeFullscreen}
              aria-label='Close fullscreen view'
              announceOnClick={false}
            >
              <X className='w-6 h-6' />
            </AccessibleButton>

            <OptimizedImage
              src={currentImage.src}
              alt={currentImage.alt}
              width={currentImage.width || 1200}
              height={currentImage.height || 800}
              quality='hero'
              className='max-w-full max-h-full object-contain'
            />

            {images.length > 1 && (
              <>
                <AccessibleButton
                  variant='ghost'
                  size='icon'
                  className='absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20'
                  onClick={prevImage}
                  aria-label={`Previous image: ${images[(currentIndex - 1 + images.length) % images.length].alt}`}
                  announceOnClick={false}
                >
                  <ChevronLeft className='w-8 h-8' />
                </AccessibleButton>
                <AccessibleButton
                  variant='ghost'
                  size='icon'
                  className='absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20'
                  onClick={nextImage}
                  aria-label={`Next image: ${images[(currentIndex + 1) % images.length].alt}`}
                  announceOnClick={false}
                >
                  <ChevronRight className='w-8 h-8' />
                </AccessibleButton>
              </>
            )}

            {currentImage.caption && (
              <div
                className='absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-4 py-2 rounded'
                role='status'
                aria-label={`Caption: ${currentImage.caption}`}
              >
                {currentImage.caption}
              </div>
            )}

            {/* Hidden labels for screen readers */}
            <div id='fullscreen-image-title' className='sr-only'>
              {currentImage.alt}
            </div>
            <div id='fullscreen-image-description' className='sr-only'>
              Fullscreen view of image {currentIndex + 1} of {images.length}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ImageGallery;
