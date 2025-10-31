import * as React from 'react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MoreHorizontalIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';

/**
 * Renders a pagination navigation component.
 */
function Pagination({ className, ...props }: React.ComponentProps<'nav'>) {
  return (
    <nav
      role='navigation'
      aria-label='pagination'
      data-slot='pagination'
      className={cn('mx-auto flex w-full justify-center', className)}
      {...props}
    />
  );
}

/**
 * Renders a pagination content component.
 */
function PaginationContent({
  className,
  ...props
}: React.ComponentProps<'ul'>) {
  return (
    <ul
      data-slot='pagination-content'
      className={cn('flex flex-row items-center gap-1', className)}
      {...props}
    />
  );
}

/** Renders a pagination item as a list item. */
function PaginationItem({ ...props }: React.ComponentProps<'li'>) {
  return <li data-slot='pagination-item' {...props} />;
}

type PaginationLinkProps = {
  isActive?: boolean;
  children?: React.ReactNode;
} & Pick<React.ComponentProps<typeof Button>, 'size'> &
  React.ComponentProps<'a'>;

/**
 * Renders a pagination link with optional active state and custom styles.
 */
function PaginationLink({
  className,
  isActive,
  size = 'icon',
  children,
  'aria-label': ariaLabel,
  ...props
}: PaginationLinkProps) {
  // Ensure accessibility by requiring either children or aria-label
  const hasAccessibleContent = children || ariaLabel;

  if (!hasAccessibleContent) {
    console.warn(
      'PaginationLink: Either children or aria-label must be provided for accessibility'
    );
  }

  return (
    <a
      aria-current={isActive ? 'page' : undefined}
      aria-label={ariaLabel}
      data-slot='pagination-link'
      data-active={isActive}
      className={cn(
        buttonVariants({
          variant: isActive ? 'outline' : 'ghost',
          size,
        }),
        className
      )}
      {...props}
    >
      {children}
    </a>
  );
}

/**
 * Renders a pagination link for navigating to the previous page.
 */
function PaginationPrevious({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>) {
  return (
    <PaginationLink
      aria-label='Go to previous page'
      size='default'
      className={cn('gap-1 px-2.5 sm:pl-2.5', className)}
      {...props}
    >
      <ChevronLeftIcon />
      <span className='hidden sm:block'>Previous</span>
    </PaginationLink>
  );
}

/**
 * Renders a pagination link for navigating to the next page.
 */
function PaginationNext({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>) {
  return (
    <PaginationLink
      aria-label='Go to next page'
      size='default'
      className={cn('gap-1 px-2.5 sm:pr-2.5', className)}
      {...props}
    >
      <span className='hidden sm:block'>Next</span>
      <ChevronRightIcon />
    </PaginationLink>
  );
}

/**
 * Renders a pagination ellipsis component.
 */
function PaginationEllipsis({
  className,
  ...props
}: React.ComponentProps<'span'>) {
  return (
    <span
      aria-hidden
      data-slot='pagination-ellipsis'
      className={cn('flex size-9 items-center justify-center', className)}
      {...props}
    >
      <MoreHorizontalIcon className='size-4' />
      <span className='sr-only'>More pages</span>
    </span>
  );
}

export {
  Pagination,
  PaginationContent,
  PaginationLink,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
};
