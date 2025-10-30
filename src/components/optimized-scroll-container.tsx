'use client';

import React, { useRef, useEffect, ReactNode } from 'react';
import {
  useOptimizedScroll,
  scrollOptimizationPresets,
} from '@/hooks/use-scroll-optimization';

interface OptimizedScrollContainerProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  optimizationPreset?: keyof typeof scrollOptimizationPresets;
  onScroll?: (event: Event) => void;
  height?: string | number;
  maxHeight?: string | number;
  enableScrollbar?: boolean;
}

/**
 * Renders an optimized scrollable container component.
 *
 * The OptimizedScrollContainer component utilizes a reference to a div element to manage scrolling behavior. It configures an optimized scroll handler based on the provided optimizationPreset and attaches it to the container. The component also manages the scroll event listener lifecycle, ensuring proper cleanup. The container's style is dynamically set based on the provided height, maxHeight, and enableScrollbar properties.
 *
 * @param {Object} props - The properties for the component.
 * @param {React.ReactNode} props.children - The content to be rendered inside the container.
 * @param {string} [props.className=''] - Additional class names for the container.
 * @param {React.CSSProperties} [props.style={}] - Custom styles for the container.
 * @param {string} [props.optimizationPreset='smooth'] - The preset for scroll optimization.
 * @param {function} [props.onScroll] - Callback function triggered on scroll events.
 * @param {string} [props.height] - The height of the container.
 * @param {string} [props.maxHeight] - The maximum height of the container.
 * @param {boolean} [props.enableScrollbar=true] - Flag to enable or disable the scrollbar.
 */
export function OptimizedScrollContainer({
  children,
  className = '',
  style = {},
  optimizationPreset = 'smooth',
  onScroll,
  height,
  maxHeight,
  enableScrollbar = true,
}: OptimizedScrollContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Get optimization config based on preset
  const optimizationConfig = scrollOptimizationPresets[optimizationPreset];

  // Create optimized scroll handler
  const optimizedScrollHandler = useOptimizedScroll((event: Event) => {
    onScroll?.(event);
  }, optimizationConfig);

  // Add scroll listener with optimization
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    /**
     * Removes the scroll event listener from the container.
     */
    const cleanup = () => {
      container.removeEventListener('scroll', optimizedScrollHandler);
    };

    container.addEventListener('scroll', optimizedScrollHandler, {
      passive: optimizationConfig.enablePassiveListeners,
    });

    return cleanup;
  }, [optimizedScrollHandler, optimizationConfig.enablePassiveListeners]);

  const containerStyle: React.CSSProperties = {
    overflow: enableScrollbar ? 'auto' : 'hidden',
    height: height || '100%',
    maxHeight: maxHeight || 'none',
    ...style,
  };

  return (
    <div
      ref={containerRef}
      className={`optimized-scroll-container ${className}`}
      style={containerStyle}
    >
      {children}
    </div>
  );
}

interface ScrollPerformanceIndicatorProps {
  scrollMetrics: {
    averageScrollTime: number;
    maxScrollTime: number;
    scrollJank: number;
    scrollEvents: number;
  };
  className?: string;
}

/**
 * Renders a scroll performance indicator based on provided scroll metrics.
 *
 * This function calculates the performance grade based on the average scroll time and displays various metrics including average scroll time, maximum scroll time, jank percentage, and the number of scroll events. The performance grade is determined by the average scroll time, categorizing it into grades A to D, each associated with a specific color. The jank percentage is calculated only if there are scroll events recorded.
 *
 * @param {Object} props - The properties for the component.
 * @param {ScrollPerformanceIndicatorProps} props.scrollMetrics - The metrics related to scroll performance.
 * @param {string} [props.className=''] - Optional additional class names for styling.
 */
export function ScrollPerformanceIndicator({
  scrollMetrics,
  className = '',
}: ScrollPerformanceIndicatorProps) {
  const getPerformanceGrade = () => {
    if (scrollMetrics.averageScrollTime <= 8)
      return { grade: 'A', color: 'text-green-600' };
    if (scrollMetrics.averageScrollTime <= 16)
      return { grade: 'B', color: 'text-blue-600' };
    if (scrollMetrics.averageScrollTime <= 32)
      return { grade: 'C', color: 'text-yellow-600' };
    return { grade: 'D', color: 'text-red-600' };
  };

  const performanceGrade = getPerformanceGrade();
  const jankPercentage =
    scrollMetrics.scrollEvents > 0
      ? (scrollMetrics.scrollJank / scrollMetrics.scrollEvents) * 100
      : 0;

  return (
    <div className={`scroll-performance-indicator ${className}`}>
      <div className='flex items-center gap-4 text-xs text-muted-foreground'>
        <div className='flex items-center gap-1'>
          <span>Scroll:</span>
          <span className={`font-medium ${performanceGrade.color}`}>
            {scrollMetrics.averageScrollTime.toFixed(1)}ms
          </span>
          <span className={performanceGrade.color}>
            ({performanceGrade.grade})
          </span>
        </div>

        <div className='flex items-center gap-1'>
          <span>Max:</span>
          <span>{scrollMetrics.maxScrollTime.toFixed(1)}ms</span>
        </div>

        <div className='flex items-center gap-1'>
          <span>Jank:</span>
          <span
            className={jankPercentage > 10 ? 'text-red-600' : 'text-green-600'}
          >
            {jankPercentage.toFixed(1)}%
          </span>
        </div>

        <div className='flex items-center gap-1'>
          <span>Events:</span>
          <span>{scrollMetrics.scrollEvents}</span>
        </div>
      </div>
    </div>
  );
}

interface ScrollOptimizationSettingsProps {
  currentPreset: keyof typeof scrollOptimizationPresets;
  onPresetChange: (preset: keyof typeof scrollOptimizationPresets) => void;
  className?: string;
}

/**
 * Renders the scroll optimization settings component.
 *
 * This component allows users to select a scroll optimization preset from a dropdown menu.
 * It updates the current preset through the onPresetChange callback when a new option is selected.
 * Additionally, it displays a description of the selected preset to inform the user about its functionality.
 *
 * @param {Object} props - The properties for the component.
 * @param {keyof typeof scrollOptimizationPresets} props.currentPreset - The currently selected scroll optimization preset.
 * @param {function} props.onPresetChange - Callback function to handle changes to the selected preset.
 * @param {string} [props.className=''] - Optional additional class names for styling.
 */
export function ScrollOptimizationSettings({
  currentPreset,
  onPresetChange,
  className = '',
}: ScrollOptimizationSettingsProps) {
  return (
    <div className={`scroll-optimization-settings ${className}`}>
      <div className='space-y-2'>
        <label className='text-sm font-medium'>Scroll Optimization:</label>
        <select
          value={currentPreset}
          onChange={e =>
            onPresetChange(
              e.target.value as keyof typeof scrollOptimizationPresets
            )
          }
          className='w-full p-2 border rounded-md text-sm'
        >
          <option value='smooth'>Smooth (Balanced)</option>
          <option value='highFrequency'>
            High Frequency (Virtual Scrolling)
          </option>
          <option value='animations'>Animations (No Throttling)</option>
          <option value='lazyLoading'>Lazy Loading (Debounced)</option>
          <option value='monitoring'>Monitoring (Performance Tracking)</option>
        </select>

        <div className='text-xs text-muted-foreground'>
          {currentPreset === 'smooth' && 'Balanced performance for general use'}
          {currentPreset === 'highFrequency' &&
            'Optimized for high-frequency scroll events'}
          {currentPreset === 'animations' &&
            'No throttling for smooth animations'}
          {currentPreset === 'lazyLoading' &&
            'Debounced for lazy loading scenarios'}
          {currentPreset === 'monitoring' && 'Performance monitoring enabled'}
        </div>
      </div>
    </div>
  );
}
