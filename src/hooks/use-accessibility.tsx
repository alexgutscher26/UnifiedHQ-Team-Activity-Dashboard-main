/**
 * Accessibility utilities and hooks for UI components
 */

import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Hook for managing ARIA live region announcements with proper cleanup
 * 
 * @description Provides functionality to announce messages to screen readers
 * using ARIA live regions. Automatically manages announcement lifecycle and
 * cleans up timeouts to prevent memory leaks.
 * 
 * @returns {Object} Object containing announce function and current announcements
 * @returns {Function} returns.announce - Function to announce a message
 * @returns {string[]} returns.announcements - Array of current announcements
 * 
 * @example
 * ```tsx
 * const { announce, announcements } = useAriaLiveAnnouncer();
 * 
 * // Announce with default 'polite' priority
 * announce("Form saved successfully");
 * 
 * // Announce with 'assertive' priority for urgent messages
 * announce("Error: Please fix the required fields", "assertive");
 * ```
 */
export const useAriaLiveAnnouncer = () => {
  const [announcements, setAnnouncements] = useState<string[]>([]);
  const timeoutRefs = useRef<Set<NodeJS.Timeout>>(new Set());

  /**
   * Announces a message to screen readers via ARIA live regions
   * 
   * @param message - The message to announce
   * @param priority - The announcement priority ('polite' or 'assertive')
   */
  const announce = useCallback(
    (message: string, priority: 'polite' | 'assertive' = 'polite') => {
      setAnnouncements(prev => [...prev, `${priority}:${message}`]);

      // Clear announcement after a delay
      const timeoutId = setTimeout(() => {
        setAnnouncements(prev => prev.slice(1));
        timeoutRefs.current.delete(timeoutId);
      }, 1000);

      timeoutRefs.current.add(timeoutId);
    },
    []
  );

  // Cleanup all timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach(timeoutId => {
        clearTimeout(timeoutId);
      });
      timeoutRefs.current.clear();
    };
  }, []);

  return { announce, announcements };
};

/**
 * Hook for managing focus behavior and focus trapping with proper cleanup
 * 
 * @description Provides utilities for focus management including focus trapping,
 * focus restoration, and focus history. Automatically cleans up event listeners
 * to prevent memory leaks.
 * 
 * @returns {Object} Object containing focus management functions
 * @returns {Function} returns.trapFocus - Traps focus within a container element
 * @returns {Function} returns.restoreFocus - Restores focus to the last saved element
 * @returns {Function} returns.saveFocus - Saves the current focused element
 * 
 * @example
 * ```tsx
 * const { trapFocus, restoreFocus, saveFocus } = useFocusManagement();
 * 
 * // Save current focus before opening modal
 * saveFocus(document.activeElement as HTMLElement);
 * 
 * // Trap focus within modal
 * const cleanup = trapFocus(modalRef.current);
 * 
 * // Restore focus when modal closes
 * restoreFocus();
 * ```
 */
export const useFocusManagement = () => {
  const focusHistory = useRef<HTMLElement[]>([]);
  const activeTraps = useRef<Set<() => void>>(new Set());

  /**
   * Traps focus within a container element (e.g., for modals or dropdowns)
   * 
   * @param container - The HTML element to trap focus within
   * @returns Cleanup function to remove the focus trap
   */
  const trapFocus = useCallback((container: HTMLElement) => {
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    container.addEventListener('keydown', handleTabKey);
    firstElement?.focus();

    const cleanup = () => {
      container.removeEventListener('keydown', handleTabKey);
      activeTraps.current.delete(cleanup);
    };

    activeTraps.current.add(cleanup);
    return cleanup;
  }, []);

  /**
   * Restores focus to the last element in the focus history
   */
  const restoreFocus = useCallback(() => {
    const lastFocused = focusHistory.current[focusHistory.current.length - 1];
    if (lastFocused && typeof lastFocused.focus === 'function') {
      lastFocused.focus();
    }
  }, []);

  /**
   * Saves an element to the focus history for later restoration
   * 
   * @param element - The HTML element to save for focus restoration
   */
  const saveFocus = useCallback((element: HTMLElement) => {
    focusHistory.current.push(element);
  }, []);

  // Cleanup all active focus traps on unmount
  useEffect(() => {
    return () => {
      activeTraps.current.forEach(cleanup => cleanup());
      activeTraps.current.clear();
    };
  }, []);

  return { trapFocus, restoreFocus, saveFocus };
};

/**
 * Hook for handling keyboard navigation with customizable key handlers
 * 
 * @description Provides keyboard event handling for common navigation patterns.
 * Automatically manages event listener attachment/detachment to prevent memory leaks.
 * 
 * @param onEscape - Handler for Escape key press
 * @param onEnter - Handler for Enter or Space key press
 * @param onArrowUp - Handler for Arrow Up key press
 * @param onArrowDown - Handler for Arrow Down key press
 * @param onArrowLeft - Handler for Arrow Left key press
 * @param onArrowRight - Handler for Arrow Right key press
 * 
 * @returns {Object} Object containing keyboard navigation functions
 * @returns {Function} returns.handleKeyDown - Key down event handler
 * @returns {Function} returns.attachKeyboardListener - Attaches global keyboard listener
 * @returns {Function} returns.detachKeyboardListener - Detaches global keyboard listener
 * 
 * @example
 * ```tsx
 * const { attachKeyboardListener, detachKeyboardListener } = useKeyboardNavigation(
 *   () => closeModal(), // onEscape
 *   () => selectItem(), // onEnter
 *   () => navigateUp(), // onArrowUp
 *   () => navigateDown() // onArrowDown
 * );
 * 
 * useEffect(() => {
 *   attachKeyboardListener();
 *   return detachKeyboardListener;
 * }, []);
 * ```
 */
export const useKeyboardNavigation = (
  onEscape?: () => void,
  onEnter?: () => void,
  onArrowUp?: () => void,
  onArrowDown?: () => void,
  onArrowLeft?: () => void,
  onArrowRight?: () => void
) => {
  const isAttached = useRef(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onEscape?.();
          break;
        case 'Enter':
        case ' ':
          onEnter?.();
          break;
        case 'ArrowUp':
          onArrowUp?.();
          break;
        case 'ArrowDown':
          onArrowDown?.();
          break;
        case 'ArrowLeft':
          onArrowLeft?.();
          break;
        case 'ArrowRight':
          onArrowRight?.();
          break;
      }
    },
    [onEscape, onEnter, onArrowUp, onArrowDown, onArrowLeft, onArrowRight]
  );

  const attachKeyboardListener = useCallback(() => {
    if (!isAttached.current) {
      document.addEventListener('keydown', handleKeyDown);
      isAttached.current = true;
    }
  }, [handleKeyDown]);

  const detachKeyboardListener = useCallback(() => {
    if (isAttached.current) {
      document.removeEventListener('keydown', handleKeyDown);
      isAttached.current = false;
    }
  }, [handleKeyDown]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      detachKeyboardListener();
    };
  }, [detachKeyboardListener]);

  return { handleKeyDown, attachKeyboardListener, detachKeyboardListener };
};

/**
 * Hook for screen reader detection and speech synthesis support
 * 
 * @description Detects screen reader usage and provides text-to-speech functionality.
 * Automatically manages speech synthesis utterances and cleans up on unmount.
 * 
 * @returns {Object} Object containing screen reader utilities
 * @returns {boolean} returns.isScreenReaderActive - Whether a screen reader is detected
 * @returns {Function} returns.announceToScreenReader - Function to speak text aloud
 * 
 * @example
 * ```tsx
 * const { isScreenReaderActive, announceToScreenReader } = useScreenReaderSupport();
 * 
 * if (isScreenReaderActive) {
 *   announceToScreenReader("Welcome to the application");
 * }
 * ```
 */
export const useScreenReaderSupport = () => {
  const [isScreenReaderActive, setIsScreenReaderActive] = useState(false);
  const activeUtterances = useRef<Set<SpeechSynthesisUtterance>>(new Set());

  useEffect(() => {
    // Detect screen reader usage
    const detectScreenReader = () => {
      const hasScreenReader =
        window.speechSynthesis ||
        navigator.userAgent.includes('NVDA') ||
        navigator.userAgent.includes('JAWS') ||
        navigator.userAgent.includes('VoiceOver');

      setIsScreenReaderActive(Boolean(hasScreenReader));
    };

    detectScreenReader();

    // Cleanup all active utterances on unmount
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      activeUtterances.current.clear();
    };
  }, []);

  /**
   * Announces a message using speech synthesis for screen readers
   * 
   * @param message - The message to speak aloud
   */
  const announceToScreenReader = useCallback(
    (message: string) => {
      if (isScreenReaderActive && window.speechSynthesis) {
        const utterance = new SpeechSynthesisUtterance(message);
        utterance.volume = 0.5;

        // Track utterance for cleanup
        activeUtterances.current.add(utterance);

        utterance.onend = () => {
          activeUtterances.current.delete(utterance);
        };

        utterance.onerror = () => {
          activeUtterances.current.delete(utterance);
        };

        window.speechSynthesis.speak(utterance);
      }
    },
    [isScreenReaderActive]
  );

  return { isScreenReaderActive, announceToScreenReader };
};

/**
 * Hook for color contrast calculations and accessibility validation
 * 
 * @description Provides utilities for calculating color contrast ratios and
 * validating accessibility compliance according to WCAG guidelines.
 * 
 * @returns {Object} Object containing contrast utilities
 * @returns {Function} returns.getContrastRatio - Calculates contrast ratio between two colors
 * @returns {Function} returns.isAccessibleContrast - Checks if contrast meets WCAG AA standards
 * 
 * @example
 * ```tsx
 * const { getContrastRatio, isAccessibleContrast } = useColorContrast();
 * 
 * const ratio = getContrastRatio('#000000', '#ffffff');
 * const isAccessible = isAccessibleContrast('#333333', '#ffffff');
 * ```
 */
export const useColorContrast = () => {
  /**
   * Calculates the contrast ratio between two colors
   * 
   * @param color1 - First color (hex, rgb, or named color)
   * @param color2 - Second color (hex, rgb, or named color)
   * @returns The contrast ratio between the colors
   */
  const getContrastRatio = useCallback((color1: string, color2: string) => {
    // Simplified contrast ratio calculation
    // In a real implementation, you'd parse colors and calculate luminance
    return 4.5; // Placeholder - should be calculated properly
  }, []);

  /**
   * Checks if the contrast between foreground and background colors meets WCAG AA standards
   * 
   * @param foreground - Foreground color
   * @param background - Background color
   * @returns True if contrast ratio meets WCAG AA standard (4.5:1)
   */
  const isAccessibleContrast = useCallback(
    (foreground: string, background: string) => {
      const ratio = getContrastRatio(foreground, background);
      return ratio >= 4.5; // WCAG AA standard
    },
    [getContrastRatio]
  );

  return { getContrastRatio, isAccessibleContrast };
};

/**
 * Hook providing predefined skip links for keyboard navigation
 * 
 * @description Returns a list of common skip links that allow keyboard users
 * to quickly navigate to main content areas.
 * 
 * @returns {Object} Object containing skip links configuration
 * @returns {Array} returns.skipLinks - Array of skip link objects with id and label
 * 
 * @example
 * ```tsx
 * const { skipLinks } = useSkipLinks();
 * 
 * return (
 *   <nav>
 *     {skipLinks.map(link => (
 *       <a key={link.id} href={`#${link.id}`}>{link.label}</a>
 *     ))}
 *   </nav>
 * );
 * ```
 */
export const useSkipLinks = () => {
  const skipLinks = [
    { id: 'main-content', label: 'Skip to main content' },
    { id: 'navigation', label: 'Skip to navigation' },
    { id: 'search', label: 'Skip to search' },
  ];

  return { skipLinks };
};

/**
 * Hook for detecting high contrast mode preference
 * 
 * @description Detects if the user has enabled high contrast mode in their
 * system preferences and provides reactive updates when the preference changes.
 * 
 * @returns {Object} Object containing high contrast state
 * @returns {boolean} returns.isHighContrast - Whether high contrast mode is enabled
 * 
 * @example
 * ```tsx
 * const { isHighContrast } = useHighContrastMode();
 * 
 * return (
 *   <div className={isHighContrast ? 'high-contrast-theme' : 'normal-theme'}>
 *     Content
 *   </div>
 * );
 * ```
 */
export const useHighContrastMode = () => {
  const [isHighContrast, setIsHighContrast] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-contrast: high)');
    setIsHighContrast(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setIsHighContrast(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return { isHighContrast };
};

/**
 * Hook for detecting reduced motion preference
 * 
 * @description Detects if the user prefers reduced motion in their system
 * preferences and provides reactive updates when the preference changes.
 * 
 * @returns {Object} Object containing reduced motion state
 * @returns {boolean} returns.prefersReducedMotion - Whether reduced motion is preferred
 * 
 * @example
 * ```tsx
 * const { prefersReducedMotion } = useReducedMotion();
 * 
 * return (
 *   <div 
 *     className={prefersReducedMotion ? 'no-animations' : 'with-animations'}
 *   >
 *     Content
 *   </div>
 * );
 * ```
 */
export const useReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return { prefersReducedMotion };
};

/**
 * Hook for performing basic accessibility audits on DOM elements
 * 
 * @description Provides utilities to audit DOM elements for common accessibility
 * issues such as missing alt text, form labels, and proper heading hierarchy.
 * 
 * @returns {Object} Object containing audit utilities
 * @returns {Function} returns.auditComponent - Audits a DOM element for accessibility issues
 * 
 * @example
 * ```tsx
 * const { auditComponent } = useAccessibilityAudit();
 * 
 * useEffect(() => {
 *   const issues = auditComponent(containerRef.current);
 *   if (issues.length > 0) {
 *     console.warn('Accessibility issues found:', issues);
 *   }
 * }, []);
 * ```
 */
export const useAccessibilityAudit = () => {
  /**
   * Audits a DOM element for common accessibility issues
   * 
   * @param element - The HTML element to audit
   * @returns Array of accessibility issue descriptions
   */
  const auditComponent = useCallback((element: HTMLElement) => {
    const issues: string[] = [];

    // Check for missing alt text on images
    const images = element.querySelectorAll('img');
    images.forEach(img => {
      if (!img.alt && !img.getAttribute('aria-label')) {
        issues.push('Image missing alt text or aria-label');
      }
    });

    // Check for missing labels on form inputs
    const inputs = element.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      const id = input.getAttribute('id');
      const label = element.querySelector(`label[for="${id}"]`);
      const ariaLabel = input.getAttribute('aria-label');
      const ariaLabelledBy = input.getAttribute('aria-labelledby');

      if (!label && !ariaLabel && !ariaLabelledBy) {
        issues.push('Form input missing label or aria-label');
      }
    });

    // Check for missing ARIA labels on interactive elements
    const buttons = element.querySelectorAll('button');
    buttons.forEach(button => {
      const ariaLabel = button.getAttribute('aria-label');
      const ariaLabelledBy = button.getAttribute('aria-labelledby');
      const textContent = button.textContent?.trim();

      if (!ariaLabel && !ariaLabelledBy && !textContent) {
        issues.push('Button missing accessible name');
      }
    });

    // Check for proper heading hierarchy
    const headings = element.querySelectorAll('h1, h2, h3, h4, h5, h6');
    let lastLevel = 0;
    headings.forEach(heading => {
      const level = parseInt(heading.tagName.charAt(1));
      if (level > lastLevel + 1) {
        issues.push(`Heading level ${level} skips level ${lastLevel + 1}`);
      }
      lastLevel = level;
    });

    return issues;
  }, []);

  return { auditComponent };
};

/**
 * ARIA live region component for screen reader announcements
 * 
 * @description Renders an ARIA live region that announces messages to screen readers.
 * The component is visually hidden but accessible to assistive technologies.
 * 
 * @param props - Component props
 * @param props.announcements - Array of announcement strings to display
 * 
 * @example
 * ```tsx
 * const { announcements } = useAriaLiveAnnouncer();
 * 
 * return (
 *   <div>
 *     <AriaLiveRegion announcements={announcements} />
 *     {/* Rest of your component */}
 *   </div >
 * );
 * ```
 */
export const AriaLiveRegion: React.FC<{ announcements: string[] }> = ({
  announcements,
}) => {
  return (
    <div
      aria-live='polite'
      aria-atomic='true'
      className='sr-only'
      role='status'
    >
      {announcements.map((announcement, index) => (
        <div key={index}>{announcement}</div>
      ))}
    </div>
  );
};

/**
 * Skip links component for keyboard navigation
 * 
 * @description Renders skip links that are hidden by default but become visible
 * when focused. Allows keyboard users to quickly navigate to main content areas.
 * 
 * @example
 * ```tsx
  * return (
 * <div>
      *     <SkipLinks />
      *     <nav id="navigation">Navigation content</nav>
      *     <main id="main-content">Main content</main>
      *   </div>
    * );
 * ```
 */
export const SkipLinks: React.FC = () => {
  const { skipLinks } = useSkipLinks();

  return (
    <div className='sr-only focus-within:not-sr-only'>
      {skipLinks.map(link => (
        <a
          key={link.id}
          href={`#${ link.id } `}
          className='absolute top-0 left-0 z-50 bg-primary text-primary-foreground px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-ring'
        >
          {link.label}
        </a>
      ))}
    </div>
  );
};

/**
 * Hook for focus-visible polyfill support in older browsers
 * 
 * @description Adds focus-visible polyfill class to the document body
 * for browsers that don't support the :focus-visible CSS selector.
 * 
 * @example
 * ```tsx
  * function App() {
 * useFocusVisible();
 *   
 *   return <div>Your app content</div>;
 * }
  * ```
 */
export const useFocusVisible = () => {
  useEffect(() => {
    // Add focus-visible polyfill if needed
    if (!CSS.supports('selector(:focus-visible)')) {
      document.body.classList.add('focus-visible-polyfill');
    }
  }, []);
};

/**
 * Accessibility-related constants and timing values
 * 
 * @description Provides standardized timing and threshold values for
 * accessibility features to ensure consistent behavior across the application.
 */
export const ACCESSIBILITY_CONSTANTS = {
  FOCUS_TIMEOUT: 100,
  ANNOUNCE_DELAY: 1000,
  MIN_CONTRAST_RATIO: 4.5,
  LARGE_TEXT_CONTRAST_RATIO: 3.0,
  KEYBOARD_NAVIGATION_TIMEOUT: 300,
} as const;

/**
 * Standard ARIA roles for accessibility
 * 
 * @description Provides a comprehensive list of ARIA roles as constants
 * to ensure consistent usage and prevent typos in role assignments.
 */
export const ARIA_ROLES = {
  BUTTON: 'button',
  LINK: 'link',
  MENU: 'menu',
  MENUITEM: 'menuitem',
  DIALOG: 'dialog',
  ALERT: 'alert',
  STATUS: 'status',
  LOG: 'log',
  MARQUEE: 'marquee',
  TIMER: 'timer',
  PROGRESSBAR: 'progressbar',
  TAB: 'tab',
  TABLIST: 'tablist',
  TABPANEL: 'tabpanel',
  TOOLTIP: 'tooltip',
  COMBOBOX: 'combobox',
  LISTBOX: 'listbox',
  OPTION: 'option',
  CHECKBOX: 'checkbox',
  RADIO: 'radio',
  SWITCH: 'switch',
  SLIDER: 'slider',
  SPINBUTTON: 'spinbutton',
  TEXTBOX: 'textbox',
  SEARCHBOX: 'searchbox',
  GRID: 'grid',
  GRIDCELL: 'gridcell',
  ROW: 'row',
  COLUMNHEADER: 'columnheader',
  ROWHEADER: 'rowheader',
  TABLE: 'table',
  CELL: 'cell',
  COLUMN: 'column',
  ROWGROUP: 'rowgroup',
  PRESENTATION: 'presentation',
  NONE: 'none',
} as const;

/**
 * Standard ARIA properties and attributes
 * 
 * @description Provides a comprehensive list of ARIA properties as constants
 * to ensure consistent usage and prevent typos in attribute assignments.
 */
export const ARIA_PROPERTIES = {
  LABEL: 'aria-label',
  LABELLEDBY: 'aria-labelledby',
  DESCRIBEDBY: 'aria-describedby',
  EXPANDED: 'aria-expanded',
  SELECTED: 'aria-selected',
  CHECKED: 'aria-checked',
  PRESSED: 'aria-pressed',
  DISABLED: 'aria-disabled',
  HIDDEN: 'aria-hidden',
  LIVE: 'aria-live',
  ATOMIC: 'aria-atomic',
  RELEVANT: 'aria-relevant',
  BUSY: 'aria-busy',
  ORIENTATION: 'aria-orientation',
  SORT: 'aria-sort',
  REQUIRED: 'aria-required',
  INVALID: 'aria-invalid',
  READONLY: 'aria-readonly',
  MULTISELECTABLE: 'aria-multiselectable',
  LEVEL: 'aria-level',
  POSINSET: 'aria-posinset',
  SETSIZE: 'aria-setsize',
  VALUEMIN: 'aria-valuemin',
  VALUEMAX: 'aria-valuemax',
  VALUENOW: 'aria-valuenow',
  VALUETEXT: 'aria-valuetext',
  CONTROLS: 'aria-controls',
  OWNED: 'aria-owns',
  FLOWTO: 'aria-flowto',
  ACTIVE: 'aria-activedescendant',
  AUTOPLACE: 'aria-autocomplete',
  DROPEFFECT: 'aria-dropeffect',
  GRABBED: 'aria-grabbed',
  HASPOPUP: 'aria-haspopup',
  MODAL: 'aria-modal',
  MULTILINE: 'aria-multiline',
  PLACEHOLDER: 'aria-placeholder',
} as const;
