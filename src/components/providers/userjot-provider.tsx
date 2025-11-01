/**
 * @fileoverview UserJot Provider Component
 * 
 * This provider component wraps the application to provide UserJot feedback
 * functionality. It automatically initializes the UserJot widget when a
 * project ID is available in the environment variables.
 * 
 * @author UnifiedHQ Team
 * @since 1.0.0
 */

'use client';

import { UserJotInline } from '@/components/userjot-inline';

/**
 * Props for the Feedback provider component
 */
interface UserJotProviderProps {
    /** Child components to render */
    children: React.ReactNode;
}

/**
 * UserJot Provider Component
 * 
 * A provider component that wraps the application to enable UserJot feedback
 * functionality. It automatically initializes the UserJot widget when the
 * NEXT_PUBLIC_USERJOT_PROJECT_ID environment variable is set.
 * 
 * The provider renders the UserJot widget with default configuration:
 * - Position: right side of screen
 * - Theme: auto (follows system preference)
 * - Widget: enabled
 * 
 * @param props - Component props
 * @param props.children - Child components to render within the provider
 * 
 * @returns JSX element containing children and UserJot widget (if configured)
 * 
 * @example
 * ```tsx
 * // Wrap your app with the provider
 * function App() {
 *   return (
 *     <UserJotProvider>
 *       <YourAppContent />
 *     </UserJotProvider>
 *   );
 * }
 * ```
 * 
 * @example
 * ```bash
 * # Set environment variable to enable UserJot
 * NEXT_PUBLIC_USERJOT_PROJECT_ID=your-project-id
 * ```
 */
export function UserJotProvider({ children }: UserJotProviderProps) {
    // Get project ID from environment variable
    const projectId = process.env.NEXT_PUBLIC_USERJOT_PROJECT_ID;

    if (process.env.NODE_ENV === 'development') {
        console.log('UserJot Provider - Project ID:', projectId ? 'Set' : 'Not set');
        if (projectId) {
            console.log('UserJot SDK v2 will be loaded');
        }
    }

    return (
        <>
            {children}
            <UserJotInline />
            {/* Temporarily disabled the hook-based widget
            {projectId && (
                <UserJotWidget
                    projectId={projectId}
                    position="right"
                    theme="auto"
                    widget={true}
                />
            )}
            */}
        </>
    );
}