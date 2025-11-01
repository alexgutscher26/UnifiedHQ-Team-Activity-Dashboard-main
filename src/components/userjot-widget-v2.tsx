/**
 * @fileoverview UserJot Feedback Widget Component
 *
 * This component integrates the UserJot feedback widget into the React application.
 * It handles SDK initialization and configuration, providing a seamless way to
 * collect user feedback and analytics.
 *
 * @author UnifiedHQ Team
 * @since 1.0.0
 */

'use client';

import React from 'react';
import { useUserJot } from '@/hooks/use-userjot';

/**
 * Props for the UserJot widget component
 */
interface UserJotWidgetProps {
  /** UserJot project ID (required) */
  projectId: string;
  /** Position of the widget on screen */
  position?: 'left' | 'right';
  /** Theme for the widget appearance */
  theme?: 'light' | 'dark' | 'auto';
  /** Whether to show the feedback widget */
  widget?: boolean;
}

/**
 * UserJot Feedback Widget Component
 *
 * A React component that integrates the UserJot feedback widget into the application.
 * This component handles SDK loading, initialization, and configuration management.
 * The widget appears as a floating button that users can click to provide feedback.
 *
 * @param props - Component props
 * @param props.projectId - UserJot project ID for initialization
 * @param props.position - Widget position on screen (default: 'left')
 * @param props.theme - Widget theme (default: 'auto')
 * @param props.widget - Whether to show the widget (default: true)
 *
 * @returns null - This component doesn't render anything visible; UserJot injects the widget
 *
 * @example
 * ```tsx
 * // Basic usage with project ID
 * <UserJotWidget projectId="your-project-id" />
 *
 * // Custom configuration
 * <UserJotWidget
 *   projectId="your-project-id"
 *   position="left"
 *   theme="dark"
 *   widget={true}
 * />
 * ```
 */
export function UserJotWidget({
  projectId,
  position = 'right',
  theme = 'auto',
  widget = true,
}: UserJotWidgetProps) {
  const { isLoaded, isInitialized, error, init } = useUserJot({
    projectId,
    autoInit: true,
  });

  // Re-initialize if config changes
  React.useEffect(() => {
    if (isLoaded && projectId) {
      init({
        widget,
        position,
        theme,
      });
    }
  }, [isLoaded, projectId, widget, position, theme, init]);

  // Development logging
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      if (error) {
        console.error('UserJot Error:', error);
      } else if (isInitialized) {
        console.log('UserJot widget initialized successfully with config:', {
          projectId,
          widget,
          position,
          theme,
        });
      }
    }
  }, [error, isInitialized, projectId, widget, position, theme]);

  // This component doesn't render anything - UserJot injects the widget
  return null;
}
