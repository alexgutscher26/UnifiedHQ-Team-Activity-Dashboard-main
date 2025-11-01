/**
 * @fileoverview UserJot SDK Integration Hook
 * 
 * This hook provides a React interface for integrating with the UserJot
 * feedback and analytics SDK. It handles SDK loading, initialization,
 * and provides methods for interacting with the UserJot widget.
 * 
 * @author UnifiedHQ Team
 * @since 1.0.0
 */

'use client';

import { useEffect, useState, useCallback } from 'react';

// Global type declarations for UserJot SDK
declare global {
    interface Window {
        /**
         * UserJot SDK instance
         */
        uj?: {
            init: (projectId: string, config?: UserJotConfig) => void;
            show: () => void;
            hide: () => void;
            open: () => void;
            close: () => void;
            track: (event: string, properties?: Record<string, any>) => void;
        };
        /**
         * UserJot command queue for pre-initialization commands
         */
        $ujq?: Array<[string, ...any[]]>;
    }
}

/**
 * Configuration options for UserJot widget initialization
 */
interface UserJotConfig {
    /** Whether to show the feedback widget */
    widget?: boolean;
    /** Position of the widget on screen */
    position?: 'left' | 'right';
    /** Theme for the widget */
    theme?: 'light' | 'dark' | 'auto';
}

/**
 * Options for the useUserJot hook
 */
interface UseUserJotOptions {
    /** UserJot project ID */
    projectId?: string;
    /** Whether to automatically initialize the SDK */
    autoInit?: boolean;
}

/**
 * State object returned by the useUserJot hook
 */
interface UserJotState {
    /** Whether the UserJot SDK has been loaded */
    isLoaded: boolean;
    /** Whether the UserJot widget has been initialized */
    isInitialized: boolean;
    /** Any error that occurred during loading or initialization */
    error: string | null;
}

/**
 * Custom React hook for integrating with UserJot feedback SDK
 * 
 * This hook manages the lifecycle of the UserJot SDK, including loading,
 * initialization, and providing methods to interact with the feedback widget.
 * 
 * @param options - Configuration options for the hook
 * @param options.projectId - UserJot project ID for initialization
 * @param options.autoInit - Whether to automatically load and initialize the SDK
 * 
 * @returns Object containing SDK state and control methods
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isLoaded, init, show, track } = useUserJot({
 *     projectId: 'your-project-id',
 *     autoInit: true
 *   });
 * 
 *   const handleFeedback = () => {
 *     if (isLoaded) {
 *       show();
 *       track('feedback_requested', { source: 'button' });
 *     }
 *   };
 * 
 *   return <button onClick={handleFeedback}>Give Feedback</button>;
 * }
 * ```
 */
export function useUserJot(options: UseUserJotOptions = {}) {
    const { projectId, autoInit = true } = options;
    const [state, setState] = useState<UserJotState>({
        isLoaded: false,
        isInitialized: false,
        error: null,
    });

    /**
     * Loads the UserJot SDK script and sets up the global objects
     * 
     * @returns Promise that resolves when SDK is loaded
     * @throws Error if SDK fails to load
     */
    const loadSDK = useCallback(async () => {
        try {
            // Check if already loaded
            if (window.uj && typeof window.uj.init === 'function') {
                setState(prev => ({ ...prev, isLoaded: true }));
                return;
            }

            // Initialize queue and proxy
            window.$ujq = window.$ujq || [];
            window.uj = window.uj || new Proxy({} as any, {
                get: (_, p) => (...a: any[]) => window.$ujq?.push([String(p), ...a])
            });

            // Load script
            const existingScript = document.querySelector('script[src*="cdn.userjot.com"]');
            if (!existingScript) {
                const script = document.createElement('script');
                script.src = 'https://cdn.userjot.com/sdk/v2/uj.js';
                script.type = 'module';
                script.async = true;

                await new Promise<void>((resolve, reject) => {
                    script.onload = () => {
                        setState(prev => ({ ...prev, isLoaded: true, error: null }));
                        resolve();
                    };
                    script.onerror = () => {
                        const error = 'Failed to load UserJot SDK';
                        setState(prev => ({ ...prev, error }));
                        reject(new Error(error));
                    };
                    document.head.appendChild(script);
                });
            } else {
                setState(prev => ({ ...prev, isLoaded: true }));
            }
        } catch (error) {
            setState(prev => ({
                ...prev,
                error: error instanceof Error ? error.message : 'Unknown error'
            }));
        }
    }, []);

    /**
     * Initializes the UserJot widget with the provided configuration
     * 
     * @param config - Widget configuration options
     * @param config.widget - Whether to show the feedback widget (default: true)
     * @param config.position - Widget position on screen (default: 'right')
     * @param config.theme - Widget theme (default: 'auto')
     */
    const init = useCallback((config: UserJotConfig = {}) => {
        if (!projectId) {
            console.warn('UserJot: No project ID provided');
            return;
        }

        if (!window.uj) {
            console.warn('UserJot: SDK not loaded');
            return;
        }

        try {
            window.uj.init(projectId, {
                widget: true,
                position: 'right',
                theme: 'auto',
                ...config,
            });
            setState(prev => ({ ...prev, isInitialized: true }));
        } catch (error) {
            setState(prev => ({
                ...prev,
                error: error instanceof Error ? error.message : 'Initialization failed'
            }));
        }
    }, [projectId]);

    /**
     * Shows the UserJot feedback widget
     */
    const show = useCallback(() => {
        if (window.uj?.show) {
            window.uj.show();
        }
    }, []);

    /**
     * Hides the UserJot feedback widget
     */
    const hide = useCallback(() => {
        if (window.uj?.hide) {
            window.uj.hide();
        }
    }, []);

    /**
     * Opens the UserJot feedback widget (makes it visible and active)
     */
    const open = useCallback(() => {
        if (window.uj?.open) {
            window.uj.open();
        }
    }, []);

    /**
     * Closes the UserJot feedback widget
     */
    const close = useCallback(() => {
        if (window.uj?.close) {
            window.uj.close();
        }
    }, []);

    /**
     * Tracks a custom event with UserJot analytics
     * 
     * @param event - The event name to track
     * @param properties - Optional event properties/metadata
     * 
     * @example
     * ```tsx
     * track('button_clicked', { buttonId: 'feedback', page: 'dashboard' });
     * ```
     */
    const track = useCallback((event: string, properties?: Record<string, any>) => {
        if (window.uj?.track) {
            window.uj.track(event, properties);
        }
    }, []);

    // Auto-initialize on mount
    useEffect(() => {
        if (autoInit && projectId) {
            loadSDK().then(() => {
                // Small delay to ensure SDK is ready
                setTimeout(() => init(), 100);
            });
        }
    }, [autoInit, projectId, loadSDK, init]);

    return {
        ...state,
        loadSDK,
        init,
        show,
        hide,
        open,
        close,
        track,
    };
}