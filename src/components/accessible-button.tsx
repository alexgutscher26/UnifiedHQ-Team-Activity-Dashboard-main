'use client';

import React, { forwardRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  useKeyboardNavigation,
  useAriaLiveAnnouncer,
} from '@/hooks/use-accessibility';
import { cn } from '@/lib/utils';

interface AccessibleButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | 'default'
    | 'destructive'
    | 'outline'
    | 'secondary'
    | 'ghost'
    | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  loading?: boolean;
  loadingText?: string;
  announceOnClick?: boolean;
  announceText?: string;
  ariaDescribedBy?: string;
  ariaExpanded?: boolean;
  ariaPressed?: boolean;
  ariaSelected?: boolean;
  ariaControls?: string;
  ariaOwns?: string;
  ariaHaspopup?: boolean | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog';
  ariaModal?: boolean;
  ariaLive?: 'off' | 'polite' | 'assertive';
  ariaAtomic?: boolean;
  ariaRelevant?: 'additions' | 'removals' | 'text' | 'all';
  ariaBusy?: boolean;
  ariaOrientation?: 'horizontal' | 'vertical';
  ariaSort?: 'none' | 'ascending' | 'descending' | 'other';
  ariaRequired?: boolean;
  ariaInvalid?: boolean | 'grammar' | 'spelling';
  ariaReadonly?: boolean;
  ariaMultiselectable?: boolean;
  ariaLevel?: number;
  ariaPosinset?: number;
  ariaSetsize?: number;
  ariaValuemin?: number;
  ariaValuemax?: number;
  ariaValuenow?: number;
  ariaValuetext?: string;
  ariaFlowto?: string;
  ariaActivedescendant?: string;
  ariaAutocomplete?: 'none' | 'inline' | 'list' | 'both';
  ariaDropeffect?: 'none' | 'copy' | 'execute' | 'link' | 'move' | 'popup';
  ariaGrabbed?: boolean;
  ariaMultiline?: boolean;
  ariaPlaceholder?: string;
}

export const AccessibleButton = forwardRef<
  HTMLButtonElement,
  AccessibleButtonProps
>(
  (
    {
      children,
      className,
      variant = 'default',
      size = 'default',
      loading = false,
      loadingText = 'Loading...',
      announceOnClick = false,
      announceText,
      disabled,
      onClick,
      onKeyDown,
      ariaDescribedBy,
      ariaExpanded,
      ariaPressed,
      ariaSelected,
      ariaControls,
      ariaOwns,
      ariaHaspopup,
      ariaModal,
      ariaLive,
      ariaAtomic,
      ariaRelevant,
      ariaBusy,
      ariaOrientation,
      ariaSort,
      ariaRequired,
      ariaInvalid,
      ariaReadonly,
      ariaMultiselectable,
      ariaLevel,
      ariaPosinset,
      ariaSetsize,
      ariaValuemin,
      ariaValuemax,
      ariaValuenow,
      ariaValuetext,
      ariaFlowto,
      ariaActivedescendant,
      ariaAutocomplete,
      ariaDropeffect,
      ariaGrabbed,
      ariaMultiline,
      ariaPlaceholder,
      ...props
    },
    ref
  ) => {
    const { announce } = useAriaLiveAnnouncer();
    const { handleKeyDown } = useKeyboardNavigation();

    /**
     * Handles the click event for a button, announcing a message if required.
     */
    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (announceOnClick) {
        const message =
          announceText ||
          (typeof children === 'string' ? children : 'Button clicked');
        announce(message);
      }
      onClick?.(event);
    };

    /**
     * Handles the key down event for a button element.
     */
    const handleKeyDownEvent = (
      event: React.KeyboardEvent<HTMLButtonElement>
    ) => {
      handleKeyDown(event as any);
      onKeyDown?.(event);
    };

    const isDisabled = disabled || loading;

    return (
      <Button
        ref={ref}
        className={cn(
          'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          className
        )}
        variant={variant}
        size={size}
        disabled={isDisabled}
        onClick={handleClick}
        onKeyDown={handleKeyDownEvent}
        aria-disabled={isDisabled}
        aria-busy={loading}
        aria-describedby={ariaDescribedBy}
        aria-expanded={ariaExpanded}
        aria-pressed={ariaPressed}
        aria-selected={ariaSelected}
        aria-controls={ariaControls}
        aria-owns={ariaOwns}
        aria-haspopup={ariaHaspopup}
        aria-modal={ariaModal}
        aria-live={ariaLive}
        aria-atomic={ariaAtomic}
        aria-relevant={ariaRelevant}
        aria-orientation={ariaOrientation}
        aria-sort={ariaSort}
        aria-required={ariaRequired}
        aria-invalid={ariaInvalid}
        aria-readonly={ariaReadonly}
        aria-multiselectable={ariaMultiselectable}
        aria-level={ariaLevel}
        aria-posinset={ariaPosinset}
        aria-setsize={ariaSetsize}
        aria-valuemin={ariaValuemin}
        aria-valuemax={ariaValuemax}
        aria-valuenow={ariaValuenow}
        aria-valuetext={ariaValuetext}
        aria-flowto={ariaFlowto}
        aria-activedescendant={ariaActivedescendant}
        aria-autocomplete={ariaAutocomplete}
        aria-dropeffect={ariaDropeffect}
        aria-grabbed={ariaGrabbed}
        aria-multiline={ariaMultiline}
        aria-placeholder={ariaPlaceholder}
        {...props}
      >
        {loading ? (
          <>
            <div
              className='mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent'
              role='status'
              aria-label='Loading'
            />
            {loadingText}
          </>
        ) : (
          children
        )}
      </Button>
    );
  }
);

AccessibleButton.displayName = 'AccessibleButton';

// Specialized accessible button variants
export const AccessibleIconButton = forwardRef<
  HTMLButtonElement,
  Omit<AccessibleButtonProps, 'size'> & {
    'aria-label': string;
    icon: React.ReactNode;
  }
>(({ icon, 'aria-label': ariaLabel, ...props }, ref) => {
  return (
    <AccessibleButton ref={ref} size='icon' aria-label={ariaLabel} {...props}>
      {icon}
    </AccessibleButton>
  );
});

AccessibleIconButton.displayName = 'AccessibleIconButton';

export const AccessibleToggleButton = forwardRef<
  HTMLButtonElement,
  AccessibleButtonProps & {
    pressed: boolean;
    onToggle: (pressed: boolean) => void;
  }
>(({ pressed, onToggle, ...props }, ref) => {
  return (
    <AccessibleButton
      ref={ref}
      aria-pressed={pressed}
      onClick={() => onToggle(!pressed)}
      {...props}
    />
  );
});

AccessibleToggleButton.displayName = 'AccessibleToggleButton';

export const AccessibleMenuButton = forwardRef<
  HTMLButtonElement,
  AccessibleButtonProps & {
    expanded: boolean;
    onToggle: (expanded: boolean) => void;
    menuId: string;
  }
>(({ expanded, onToggle, menuId, ...props }, ref) => {
  return (
    <AccessibleButton
      ref={ref}
      aria-expanded={expanded}
      aria-haspopup='menu'
      aria-controls={menuId}
      onClick={() => onToggle(!expanded)}
      {...props}
    />
  );
});

AccessibleMenuButton.displayName = 'AccessibleMenuButton';
