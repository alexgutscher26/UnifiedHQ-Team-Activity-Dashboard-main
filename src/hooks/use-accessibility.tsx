/**
 * Accessibility utilities and hooks for UI components
 */

import { useEffect, useRef, useState, useCallback } from 'react';

// ARIA live region announcements
export const useAriaLiveAnnouncer = () => {
  const [announcements, setAnnouncements] = useState<string[]>([]);

  const announce = useCallback(
    (message: string, priority: 'polite' | 'assertive' = 'polite') => {
      setAnnouncements(prev => [...prev, `${priority}:${message}`]);

      // Clear announcement after a delay
      setTimeout(() => {
        setAnnouncements(prev => prev.slice(1));
      }, 1000);
    },
    []
  );

  return { announce, announcements };
};

// Focus management utilities
export const useFocusManagement = () => {
  const focusHistory = useRef<HTMLElement[]>([]);

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

    return () => {
      container.removeEventListener('keydown', handleTabKey);
    };
  }, []);

  const restoreFocus = useCallback(() => {
    const lastFocused = focusHistory.current[focusHistory.current.length - 1];
    if (lastFocused && typeof lastFocused.focus === 'function') {
      lastFocused.focus();
    }
  }, []);

  const saveFocus = useCallback((element: HTMLElement) => {
    focusHistory.current.push(element);
  }, []);

  return { trapFocus, restoreFocus, saveFocus };
};

// Keyboard navigation utilities
export const useKeyboardNavigation = (
  onEscape?: () => void,
  onEnter?: () => void,
  onArrowUp?: () => void,
  onArrowDown?: () => void,
  onArrowLeft?: () => void,
  onArrowRight?: () => void
) => {
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

  return { handleKeyDown };
};

// Screen reader utilities
export const useScreenReaderSupport = () => {
  const [isScreenReaderActive, setIsScreenReaderActive] = useState(false);

  useEffect(() => {
    // Detect screen reader usage
    const detectScreenReader = () => {
      const hasScreenReader =
        window.speechSynthesis ||
        navigator.userAgent.includes('NVDA') ||
        navigator.userAgent.includes('JAWS') ||
        navigator.userAgent.includes('VoiceOver');

      setIsScreenReaderActive(!!hasScreenReader);
    };

    detectScreenReader();
  }, []);

  const announceToScreenReader = useCallback(
    (message: string) => {
      if (isScreenReaderActive && window.speechSynthesis) {
        const utterance = new SpeechSynthesisUtterance(message);
        utterance.volume = 0.5;
        window.speechSynthesis.speak(utterance);
      }
    },
    [isScreenReaderActive]
  );

  return { isScreenReaderActive, announceToScreenReader };
};

// Color contrast utilities
export const useColorContrast = () => {
  const getContrastRatio = useCallback((color1: string, color2: string) => {
    // Simplified contrast ratio calculation
    // In a real implementation, you'd parse colors and calculate luminance
    return 4.5; // Placeholder - should be calculated properly
  }, []);

  const isAccessibleContrast = useCallback(
    (foreground: string, background: string) => {
      const ratio = getContrastRatio(foreground, background);
      return ratio >= 4.5; // WCAG AA standard
    },
    [getContrastRatio]
  );

  return { getContrastRatio, isAccessibleContrast };
};

// Skip link utilities
export const useSkipLinks = () => {
  const skipLinks = [
    { id: 'main-content', label: 'Skip to main content' },
    { id: 'navigation', label: 'Skip to navigation' },
    { id: 'search', label: 'Skip to search' },
  ];

  return { skipLinks };
};

// High contrast mode detection
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

// Reduced motion detection
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

// Accessibility testing utilities
export const useAccessibilityAudit = () => {
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

// ARIA live region component
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

// Skip links component
export const SkipLinks: React.FC = () => {
  const { skipLinks } = useSkipLinks();

  return (
    <div className='sr-only focus-within:not-sr-only'>
      {skipLinks.map(link => (
        <a
          key={link.id}
          href={`#${link.id}`}
          className='absolute top-0 left-0 z-50 bg-primary text-primary-foreground px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-ring'
        >
          {link.label}
        </a>
      ))}
    </div>
  );
};

// Focus visible polyfill for older browsers
export const useFocusVisible = () => {
  useEffect(() => {
    // Add focus-visible polyfill if needed
    if (!CSS.supports('selector(:focus-visible)')) {
      document.body.classList.add('focus-visible-polyfill');
    }
  }, []);
};

// Accessibility constants
export const ACCESSIBILITY_CONSTANTS = {
  FOCUS_TIMEOUT: 100,
  ANNOUNCE_DELAY: 1000,
  MIN_CONTRAST_RATIO: 4.5,
  LARGE_TEXT_CONTRAST_RATIO: 3.0,
  KEYBOARD_NAVIGATION_TIMEOUT: 300,
} as const;

// ARIA roles and properties
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

// Common ARIA properties
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
