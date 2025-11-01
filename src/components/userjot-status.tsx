'use client';

import { useUserJot } from '@/hooks/use-userjot';

/**
 * UserJot Status Component
 * 
 * A simple component that displays the current status of UserJot integration.
 * Useful for debugging and verifying that UserJot is working on any page.
 */
export function UserJotStatus() {
    const projectId = process.env.NEXT_PUBLIC_USERJOT_PROJECT_ID;
    const { isLoaded, isInitialized, error } = useUserJot({
        projectId,
        autoInit: false, // Don't auto-init, just check status
    });

    if (!projectId) {
        return null; // Don't show anything if no project ID
    }

    // Only show in development mode
    if (process.env.NODE_ENV !== 'development') {
        return null;
    }

    return (
        <div className="fixed top-4 left-4 z-50 bg-black/80 text-white text-xs px-3 py-2 rounded-lg font-mono">
            <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${error ? 'bg-red-500' :
                        isInitialized ? 'bg-green-500' :
                            isLoaded ? 'bg-yellow-500' :
                                'bg-gray-500'
                    }`} />
                <span>
                    UserJot: {
                        error ? 'Error' :
                            isInitialized ? 'Ready' :
                                isLoaded ? 'Loaded' :
                                    'Loading...'
                    }
                </span>
            </div>
            {error && (
                <div className="text-red-300 mt-1 text-xs">
                    {error}
                </div>
            )}
        </div>
    );
}