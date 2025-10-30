import { useEffect, useRef, useState } from 'react';

interface UseLazyImageOptions {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
}

/**
 * A custom hook that manages lazy loading of images using Intersection Observer.
 *
 * This hook sets up an Intersection Observer to track the visibility of an image element.
 * It updates the state to indicate whether the image is currently intersecting the viewport
 * and whether it has been loaded. The observer can be configured with a threshold and root margin,
 * and can be set to trigger only once for the first intersection.
 *
 * @param {UseLazyImageOptions} [options={}] - Configuration options for the lazy image loading.
 */
export const useLazyImage = (options: UseLazyImageOptions = {}) => {
  const { threshold = 0.1, rootMargin = '50px', triggerOnce = true } = options;

  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setIsIntersecting(true);
            setHasLoaded(true);

            if (triggerOnce) {
              observer.unobserve(entry.target);
            }
          } else if (!triggerOnce) {
            setIsIntersecting(false);
          }
        });
      },
      {
        threshold,
        rootMargin,
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      if (imgRef.current) {
        observer.unobserve(imgRef.current);
      }
    };
  }, [threshold, rootMargin, triggerOnce]);

  return {
    imgRef,
    isIntersecting,
    hasLoaded,
  };
};

export default useLazyImage;
