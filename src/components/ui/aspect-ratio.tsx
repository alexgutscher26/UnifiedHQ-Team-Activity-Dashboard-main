'use client';

import * as AspectRatioPrimitive from '@radix-ui/react-aspect-ratio';

/**
 * Renders an AspectRatio component with the given props.
 */
function AspectRatio({
  ...props
}: React.ComponentProps<typeof AspectRatioPrimitive.Root>) {
  return <AspectRatioPrimitive.Root data-slot='aspect-ratio' {...props} />;
}

export { AspectRatio };
