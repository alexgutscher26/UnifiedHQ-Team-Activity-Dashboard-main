'use client';

import { useEffect } from 'react';

interface MinimalUserJotWidgetProps {
  projectId: string;
}

export function MinimalUserJotWidget({ projectId }: MinimalUserJotWidgetProps) {
  useEffect(() => {
    if (!projectId) return;

    // Initialize UserJot using the exact script pattern
    const initUserJot = () => {
      // Step 1: Initialize queue and proxy
      (window as any).$ujq = (window as any).$ujq || [];
      (window as any).uj =
        (window as any).uj ||
        new Proxy(
          {},
          {
            get:
              (_: any, p: string) =>
              (...a: any[]) =>
                (window as any).$ujq?.push([p, ...a]),
          }
        );

      // Step 2: Load SDK if not already loaded
      const existingScript = document.querySelector(
        'script[src*="cdn.userjot.com"]'
      );
      if (!existingScript) {
        const script = document.createElement('script');
        script.src = 'https://cdn.userjot.com/sdk/v2/uj.js';
        script.type = 'module';
        script.async = true;

        script.onload = () => {
          console.log('UserJot SDK loaded');
          // Step 3: Initialize widget
          (window as any).uj?.init(projectId, {
            widget: true,
            position: 'right',
            theme: 'auto',
          });
          console.log('UserJot widget initialized');
        };

        script.onerror = () => {
          console.error('Failed to load UserJot SDK');
        };

        document.head.appendChild(script);
      } else {
        // Script already loaded, just initialize
        (window as any).uj?.init(projectId, {
          widget: true,
          position: 'right',
          theme: 'auto',
        });
        console.log('UserJot widget initialized (script already loaded)');
      }
    };

    initUserJot();
  }, [projectId]);

  return null;
}
