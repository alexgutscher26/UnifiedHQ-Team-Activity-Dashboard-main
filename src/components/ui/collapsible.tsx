'use client';

import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';

/**
 * Renders a collapsible component using CollapsiblePrimitive.Root.
 */
function Collapsible({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
  return <CollapsiblePrimitive.Root data-slot='collapsible' {...props} />;
}

/**
 * Renders a CollapsibleTrigger component with passed props.
 */
function CollapsibleTrigger({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleTrigger>) {
  return (
    <CollapsiblePrimitive.CollapsibleTrigger
      data-slot='collapsible-trigger'
      {...props}
    />
  );
}

/**
 * Renders a CollapsibleContent component with provided props.
 */
function CollapsibleContent({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleContent>) {
  return (
    <CollapsiblePrimitive.CollapsibleContent
      data-slot='collapsible-content'
      {...props}
    />
  );
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
