'use client';

import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

/**
 * Renders a styled input group component.
 */
function InputGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='input-group'
      role='group'
      className={cn(
        'group/input-group border-input dark:bg-input/30 relative flex w-full items-center rounded-md border shadow-xs transition-[color,box-shadow] outline-none',
        'h-9 has-[>textarea]:h-auto',

        // Variants based on alignment.
        'has-[>[data-align=inline-start]]:[&>input]:pl-2',
        'has-[>[data-align=inline-end]]:[&>input]:pr-2',
        'has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>[data-align=block-start]]:[&>input]:pb-3',
        'has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-end]]:[&>input]:pt-3',

        // Focus state.
        'has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50 has-[[data-slot=input-group-control]:focus-visible]:ring-[3px]',

        // Error state.
        'has-[[data-slot][aria-invalid=true]]:ring-destructive/20 has-[[data-slot][aria-invalid=true]]:border-destructive dark:has-[[data-slot][aria-invalid=true]]:ring-destructive/40',

        className
      )}
      {...props}
    />
  );
}

const inputGroupAddonVariants = cva(
  "text-muted-foreground flex h-auto items-center justify-center gap-2 py-1.5 text-sm font-medium select-none [&>svg:not([class*='size-'])]:size-4 [&>kbd]:rounded-[calc(var(--radius)-5px)] group-data-[disabled=true]/input-group:opacity-50",
  {
    variants: {
      align: {
        'inline-start':
          'order-first pl-3 has-[>button]:ml-[-0.45rem] has-[>kbd]:ml-[-0.35rem]',
        'inline-end':
          'order-last pr-3 has-[>button]:mr-[-0.4rem] has-[>kbd]:mr-[-0.35rem]',
        'block-start':
          'order-first w-full justify-start px-3 pt-3 [.border-b]:pb-3 group-has-[>input]/input-group:pt-2.5',
        'block-end':
          'order-last w-full justify-start px-3 pb-3 [.border-t]:pt-3 group-has-[>input]/input-group:pb-2.5',
      },
    },
    defaultVariants: {
      align: 'inline-start',
    },
  }
);

/**
 * Renders an input group addon component.
 *
 * This component creates an accessible addon for input groups, allowing for alignment and additional props.
 * It can optionally handle click events to focus on the nearest input element unless the click originated from a button within the group.
 * The alignment can be customized through the `align` prop, and additional class names can be provided via `className`.
 *
 * @param {Object} props - The properties for the component.
 * @param {string} [props.className] - Additional class names to apply to the component.
 * @param {string} [props.align='inline-start'] - The alignment of the addon within the input group.
 * @param {boolean} [props.clickable=false] - Whether the addon should be clickable to focus the input.
 */
function InputGroupAddon({
  className,
  align = 'inline-start',
  clickable = false,
  ...props
}: React.ComponentProps<'div'> &
  VariantProps<typeof inputGroupAddonVariants> & {
    clickable?: boolean;
  }) {

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
    e.currentTarget.parentElement?.querySelector('input')?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if ((e.target as HTMLElement).closest('button')) {
        return;
      }
      e.currentTarget.parentElement?.querySelector('input')?.focus();
    }
  };

  if (clickable) {
    return (
      <div
        role='button'
        tabIndex={0}
        data-slot='input-group-addon'
        data-align={align}
        className={cn(
          inputGroupAddonVariants({ align }),
          'cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-sm hover:bg-muted/50 transition-colors',
          className
        )}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        aria-label="Focus input field"
        {...props}
      />
    );
  }

  return (
    <div
      role='group'
      data-slot='input-group-addon'
      data-align={align}
      className={cn(inputGroupAddonVariants({ align }), 'cursor-default', className)}
      {...props}
    />
  );
}

const inputGroupButtonVariants = cva(
  'text-sm shadow-none flex gap-2 items-center',
  {
    variants: {
      size: {
        xs: "h-6 gap-1 px-2 rounded-[calc(var(--radius)-5px)] [&>svg:not([class*='size-'])]:size-3.5 has-[>svg]:px-2",
        sm: 'h-8 px-2.5 gap-1.5 rounded-md has-[>svg]:px-2.5',
        'icon-xs':
          'size-6 rounded-[calc(var(--radius)-5px)] p-0 has-[>svg]:p-0',
        'icon-sm': 'size-8 p-0 has-[>svg]:p-0',
      },
    },
    defaultVariants: {
      size: 'xs',
    },
  }
);

/**
 * Renders a button within an input group with customizable properties.
 */
function InputGroupButton({
  className,
  type = 'button',
  variant = 'ghost',
  size = 'xs',
  ...props
}: Omit<React.ComponentProps<typeof Button>, 'size'> &
  VariantProps<typeof inputGroupButtonVariants>) {
  return (
    <Button
      type={type}
      data-size={size}
      variant={variant}
      className={cn(inputGroupButtonVariants({ size }), className)}
      {...props}
    />
  );
}

/**
 * Renders a span element with specified className and props.
 */
function InputGroupText({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      className={cn(
        "text-muted-foreground flex items-center gap-2 text-sm [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  );
}

/**
 * Renders an input component with specific styles and props.
 */
function InputGroupInput({
  className,
  ...props
}: React.ComponentProps<'input'>) {
  return (
    <Input
      data-slot='input-group-control'
      className={cn(
        'flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent',
        className
      )}
      {...props}
    />
  );
}

function InputGroupTextarea({
  className,
  ...props
}: React.ComponentProps<'textarea'>) {
  return (
    <Textarea
      data-slot='input-group-control'
      className={cn(
        'flex-1 resize-none rounded-none border-0 bg-transparent py-3 shadow-none focus-visible:ring-0 dark:bg-transparent',
        className
      )}
      {...props}
    />
  );
}

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
};
