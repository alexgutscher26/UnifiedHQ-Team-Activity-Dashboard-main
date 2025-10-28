'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  useFocusManagement,
  useAriaLiveAnnouncer,
  useKeyboardNavigation,
} from '@/hooks/use-accessibility';
import { X } from 'lucide-react';

interface AccessibleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closeOnEscape?: boolean;
  closeOnOverlayClick?: boolean;
  showCloseButton?: boolean;
  announceOnOpen?: boolean;
  announceOnClose?: boolean;
}

/**
 * A React functional component that renders an accessible modal dialog.
 *
 * The AccessibleModal component manages focus trapping, announces modal state changes, and handles keyboard and overlay interactions. It saves the previous focus when opened and restores it when closed. The modal can be customized with various props, including size, close behavior, and visibility of the close button.
 *
 * @param open - A boolean indicating whether the modal is open.
 * @param onOpenChange - A function to handle changes to the modal's open state.
 * @param title - The title of the modal.
 * @param description - An optional description of the modal.
 * @param children - The content to be displayed inside the modal.
 * @param className - Additional CSS classes to apply to the modal.
 * @param size - The size of the modal, defaults to 'md'.
 * @param closeOnEscape - A boolean indicating if the modal should close on the Escape key press, defaults to true.
 * @param closeOnOverlayClick - A boolean indicating if the modal should close when the overlay is clicked, defaults to true.
 * @param showCloseButton - A boolean indicating if the close button should be shown, defaults to true.
 * @param announceOnOpen - A boolean indicating if the modal opening should be announced, defaults to true.
 * @param announceOnClose - A boolean indicating if the modal closing should be announced, defaults to true.
 * @returns A JSX element representing the modal dialog.
 */
export const AccessibleModal: React.FC<AccessibleModalProps> = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  size = 'md',
  closeOnEscape = true,
  closeOnOverlayClick = true,
  showCloseButton = true,
  announceOnOpen = true,
  announceOnClose = true,
}) => {
  const { trapFocus, restoreFocus, saveFocus } = useFocusManagement();
  const { announce } = useAriaLiveAnnouncer();
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const { handleKeyDown } = useKeyboardNavigation(() => {
    // Escape key
    if (closeOnEscape) {
      handleClose();
    }
  });

  useEffect(() => {
    if (open) {
      // Save current focus
      previousFocusRef.current = document.activeElement as HTMLElement;

      // Announce modal opening
      if (announceOnOpen) {
        announce(`Modal opened: ${title}`);
      }

      // Trap focus in modal
      if (modalRef.current) {
        const cleanup = trapFocus(modalRef.current);
        return cleanup;
      }
    } else {
      // Restore previous focus
      if (previousFocusRef.current) {
        restoreFocus();
      }

      // Announce modal closing
      if (announceOnClose) {
        announce(`Modal closed: ${title}`);
      }
    }
  }, [
    open,
    title,
    announceOnOpen,
    announceOnClose,
    announce,
    trapFocus,
    restoreFocus,
  ]);

  /**
   * Closes the open state by setting it to false.
   */
  const handleClose = () => {
    onOpenChange(false);
  };

  /**
   * Handles click events on the overlay to close it if conditions are met.
   */
  const handleOverlayClick = (event: React.MouseEvent) => {
    if (closeOnOverlayClick && event.target === event.currentTarget) {
      handleClose();
    }
  };

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-full mx-4',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={modalRef}
        className={cn(sizeClasses[size], className)}
        onKeyDown={e => handleKeyDown(e.nativeEvent)}
        onClick={handleOverlayClick}
        role='dialog'
        aria-modal='true'
        aria-labelledby='modal-title'
        aria-describedby={description ? 'modal-description' : undefined}
      >
        <DialogHeader>
          <DialogTitle id='modal-title'>{title}</DialogTitle>
          {description && (
            <DialogDescription id='modal-description'>
              {description}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className='space-y-4'>{children}</div>

        {showCloseButton && (
          <Button
            variant='ghost'
            size='icon'
            className='absolute right-4 top-4'
            onClick={handleClose}
            aria-label='Close modal'
          >
            <X className='h-4 w-4' />
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
};

interface AccessibleAlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  actionLabel: string;
  cancelLabel?: string;
  onAction: () => void;
  onCancel?: () => void;
  variant?: 'default' | 'destructive';
  announceOnOpen?: boolean;
}

/**
 * Renders an accessible alert dialog component.
 *
 * The AccessibleAlertDialog component manages the dialog's open state, announces the title and description when opened, and handles focus trapping. It provides action and cancel buttons, invoking the respective callbacks on user interaction. The dialog can be customized with different labels and variants, ensuring a user-friendly experience.
 *
 * @param {boolean} open - Indicates whether the dialog is open or closed.
 * @param {function} onOpenChange - Callback function to handle changes in the dialog's open state.
 * @param {string} title - The title of the alert dialog.
 * @param {string} description - The description of the alert dialog.
 * @param {string} actionLabel - The label for the action button.
 * @param {string} [cancelLabel='Cancel'] - The label for the cancel button.
 * @param {function} onAction - Callback function to be called when the action button is clicked.
 * @param {function} onCancel - Callback function to be called when the cancel button is clicked.
 * @param {string} [variant='default'] - The variant of the action button.
 * @param {boolean} [announceOnOpen=true] - Indicates whether to announce the dialog content when opened.
 */
export const AccessibleAlertDialog: React.FC<AccessibleAlertDialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  actionLabel,
  cancelLabel = 'Cancel',
  onAction,
  onCancel,
  variant = 'default',
  announceOnOpen = true,
}) => {
  const { announce } = useAriaLiveAnnouncer();
  const { trapFocus, restoreFocus } = useFocusManagement();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      if (announceOnOpen) {
        announce(`Alert: ${title}. ${description}`);
      }

      if (dialogRef.current) {
        const cleanup = trapFocus(dialogRef.current);
        return cleanup;
      }
    } else {
      restoreFocus();
    }
  }, [
    open,
    title,
    description,
    announceOnOpen,
    announce,
    trapFocus,
    restoreFocus,
  ]);

  const handleAction = () => {
    onAction();
    onOpenChange(false);
  };

  /**
   * Handles the cancel action by invoking onCancel and setting onOpenChange to false.
   */
  const handleCancel = () => {
    onCancel?.();
    onOpenChange(false);
  };

  return (
    <AccessibleModal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size='sm'
      closeOnEscape={false}
      closeOnOverlayClick={false}
      showCloseButton={false}
      announceOnOpen={false}
      announceOnClose={false}
    >
      <div className='space-y-4'>
        <p className='text-sm text-muted-foreground'>{description}</p>
        <div className='flex justify-end space-x-2'>
          <Button variant='outline' onClick={handleCancel} autoFocus>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            onClick={handleAction}
          >
            {actionLabel}
          </Button>
        </div>
      </div>
    </AccessibleModal>
  );
};

interface AccessibleTooltipProps {
  children: React.ReactNode;
  content: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  delayDuration?: number;
  className?: string;
}

/**
 * A React functional component that displays an accessible tooltip.
 *
 * The AccessibleTooltip component manages its visibility based on mouse and focus events. It uses the useAriaLiveAnnouncer to announce the tooltip content when it becomes visible. The tooltip's position can be adjusted using the 'side' prop, and it includes a delay before appearing. The component also applies conditional styling based on the provided className and the tooltip's position.
 *
 * @param children - The content to be displayed within the tooltip trigger area.
 * @param content - The text to be displayed within the tooltip.
 * @param side - The position of the tooltip relative to the trigger (default is 'top').
 * @param delayDuration - The duration to delay the tooltip's appearance (default is 700ms).
 * @param className - Additional CSS classes to apply to the tooltip container.
 * @returns A JSX element representing the tooltip and its trigger.
 */
export const AccessibleTooltip: React.FC<AccessibleTooltipProps> = ({
  children,
  content,
  side = 'top',
  delayDuration = 700,
  className,
}) => {
  const [open, setOpen] = useState(false);
  const { announce } = useAriaLiveAnnouncer();

  /**
   * Handles mouse enter event by setting open state and announcing content.
   */
  const handleMouseEnter = () => {
    setOpen(true);
    announce(content);
  };

  const handleMouseLeave = () => {
    setOpen(false);
  };

  /**
   * Sets the open state to true and announces the content.
   */
  const handleFocus = () => {
    setOpen(true);
    announce(content);
  };

  /** Closes the open state when the blur event occurs. */
  const handleBlur = () => {
    setOpen(false);
  };

  return (
    <div
      className={cn('relative inline-block', className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      {children}
      {open && (
        <div
          role='tooltip'
          className={cn(
            'absolute z-50 px-3 py-2 text-sm text-primary-foreground bg-primary rounded-md shadow-lg',
            'animate-in fade-in-0 zoom-in-95',
            side === 'top' &&
              'bottom-full left-1/2 transform -translate-x-1/2 mb-2',
            side === 'bottom' &&
              'top-full left-1/2 transform -translate-x-1/2 mt-2',
            side === 'left' &&
              'right-full top-1/2 transform -translate-y-1/2 mr-2',
            side === 'right' &&
              'left-full top-1/2 transform -translate-y-1/2 ml-2'
          )}
        >
          {content}
          <div
            className={cn(
              'absolute w-2 h-2 bg-primary transform rotate-45',
              side === 'top' &&
                'top-full left-1/2 transform -translate-x-1/2 -mt-1',
              side === 'bottom' &&
                'bottom-full left-1/2 transform -translate-x-1/2 -mb-1',
              side === 'left' &&
                'left-full top-1/2 transform -translate-y-1/2 -ml-1',
              side === 'right' &&
                'right-full top-1/2 transform -translate-y-1/2 -mr-1'
            )}
          />
        </div>
      )}
    </div>
  );
};

interface AccessiblePopoverProps {
  children: React.ReactNode;
  content: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  className?: string;
  announceOnOpen?: boolean;
}

/**
 * A React functional component that renders an accessible popover.
 *
 * The AccessiblePopover component manages its open state, handles focus management, and announces its opening via ARIA live announcements. It provides a trigger element that toggles the popover's visibility and supports keyboard interactions for accessibility. The popover's position can be customized using the side and align props.
 *
 * @param children - The content to be displayed as the trigger for the popover.
 * @param content - The content to be displayed inside the popover.
 * @param open - A controlled prop to manage the open state of the popover.
 * @param onOpenChange - A callback function to handle changes to the open state.
 * @param side - The position of the popover relative to the trigger (default is 'bottom').
 * @param align - The alignment of the popover content (default is 'center').
 * @param className - Additional CSS classes to apply to the popover.
 * @param announceOnOpen - A flag to determine if an announcement should be made when the popover opens (default is true).
 * @returns A JSX element representing the accessible popover.
 */
export const AccessiblePopover: React.FC<AccessiblePopoverProps> = ({
  children,
  content,
  open,
  onOpenChange,
  side = 'bottom',
  align = 'center',
  className,
  announceOnOpen = true,
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const { announce } = useAriaLiveAnnouncer();
  const { trapFocus, restoreFocus } = useFocusManagement();
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const isOpen = open !== undefined ? open : internalOpen;
  const setIsOpen = onOpenChange || setInternalOpen;

  useEffect(() => {
    if (isOpen && announceOnOpen) {
      announce('Popover opened');
    }
  }, [isOpen, announceOnOpen, announce]);

  /**
   * Toggles the isOpen state.
   */
  const handleTriggerClick = () => {
    setIsOpen(!isOpen);
  };

  /**
   * Closes the modal when the Escape key is pressed.
   */
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className={cn('relative', className)}>
      <div
        ref={triggerRef}
        onClick={handleTriggerClick}
        onKeyDown={handleKeyDown}
        role='button'
        tabIndex={0}
        aria-expanded={isOpen}
        aria-haspopup='true'
        className='inline-block'
      >
        {children}
      </div>

      {isOpen && (
        <div
          ref={popoverRef}
          role='dialog'
          aria-modal='false'
          className={cn(
            'absolute z-50 p-4 bg-popover border rounded-md shadow-lg',
            'animate-in fade-in-0 zoom-in-95',
            side === 'top' && 'bottom-full mb-2',
            side === 'bottom' && 'top-full mt-2',
            side === 'left' && 'right-full mr-2',
            side === 'right' && 'left-full ml-2',
            align === 'start' && 'left-0',
            align === 'center' && 'left-1/2 transform -translate-x-1/2',
            align === 'end' && 'right-0'
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
};
