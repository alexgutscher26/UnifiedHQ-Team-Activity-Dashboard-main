import * as React from 'react';

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(
    undefined
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    mql.addEventListener('change', onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);

    return () => mql.removeEventListener('change', onChange);
  }, []);

  return Boolean(isMobile);
}

// Enhanced mobile detection hook with additional features
export function useResponsiveBreakpoints() {
  const [breakpoints, setBreakpoints] = React.useState({
    isMobile: false,
    isTablet: false,
    isDesktop: false,
    isLarge: false,
  });

  React.useEffect(() => {
    const mobileQuery = window.matchMedia('(max-width: 767px)');
    const tabletQuery = window.matchMedia(
      '(min-width: 768px) and (max-width: 1023px)'
    );
    const desktopQuery = window.matchMedia(
      '(min-width: 1024px) and (max-width: 1279px)'
    );
    const largeQuery = window.matchMedia('(min-width: 1280px)');

    const updateBreakpoints = () => {
      setBreakpoints({
        isMobile: mobileQuery.matches,
        isTablet: tabletQuery.matches,
        isDesktop: desktopQuery.matches,
        isLarge: largeQuery.matches,
      });
    };

    // Set initial values
    updateBreakpoints();

    // Add listeners
    mobileQuery.addEventListener('change', updateBreakpoints);
    tabletQuery.addEventListener('change', updateBreakpoints);
    desktopQuery.addEventListener('change', updateBreakpoints);
    largeQuery.addEventListener('change', updateBreakpoints);

    // Cleanup all listeners
    return () => {
      mobileQuery.removeEventListener('change', updateBreakpoints);
      tabletQuery.removeEventListener('change', updateBreakpoints);
      desktopQuery.removeEventListener('change', updateBreakpoints);
      largeQuery.removeEventListener('change', updateBreakpoints);
    };
  }, []);

  return breakpoints;
}

// Hook for detecting orientation changes
export function useOrientation() {
  const [orientation, setOrientation] = React.useState<
    'portrait' | 'landscape'
  >('portrait');

  React.useEffect(() => {
    const orientationQuery = window.matchMedia('(orientation: landscape)');

    const updateOrientation = () => {
      setOrientation(orientationQuery.matches ? 'landscape' : 'portrait');
    };

    // Set initial value
    updateOrientation();

    // Add listener
    orientationQuery.addEventListener('change', updateOrientation);

    // Cleanup
    return () => {
      orientationQuery.removeEventListener('change', updateOrientation);
    };
  }, []);

  return orientation;
}
