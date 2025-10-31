/**
 * Navigation Tracker - Client-side utility for interacting with service worker navigation tracking
 */

export interface NavigationPattern {
    path: string
    count: number
    lastAccessed: number
    preloadTargets: string[]
}

export interface SessionActivity {
    sessionId: string
    duration: number
    pathCount: number
    patternCount: number
    isActive: boolean
}

export interface NavigationStats {
    topPatterns: NavigationPattern[]
    criticalPaths: string[]
    sessionActivity: SessionActivity[]
    totalPatterns: number
    totalSessions: number
}

class NavigationTracker {
    private serviceWorker: ServiceWorker | null = null
    private sessionId: string

    constructor() {
        this.sessionId = this.generateSessionId()
        // Don't initialize if service worker is disabled
        if (process.env.NEXT_PUBLIC_DISABLE_SW !== 'true') {
            this.initializeServiceWorker()
        }
    }

    private generateSessionId(): string {
        return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }

    private async initializeServiceWorker(): Promise<void> {
        // Don't initialize if service worker is disabled
        if (process.env.NEXT_PUBLIC_DISABLE_SW === 'true') {
            return
        }

        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.ready
                this.serviceWorker = registration.active
            } catch (error) {
                console.warn('[NavigationTracker] Service worker not available:', error)
            }
        }
    }

    /**
     * Track a navigation event
     */
    async trackNavigation(path: string): Promise<boolean> {
        if (!this.serviceWorker) {
            console.debug('[NavigationTracker] Service worker not available')
            return false
        }

        try {
            const response = await this.sendMessage('TRACK_NAVIGATION', {
                path,
                sessionId: this.sessionId
            })
            return response.success
        } catch (error) {
            console.error('[NavigationTracker] Failed to track navigation:', error)
            return false
        }
    }

    /**
     * Get navigation patterns and statistics
     */
    async getNavigationPatterns(limit = 10): Promise<NavigationStats | null> {
        if (!this.serviceWorker) {
            return null
        }

        try {
            const response = await this.sendMessage('GET_NAVIGATION_PATTERNS', { limit })
            return response.success ? response.patterns : null
        } catch (error) {
            console.error('[NavigationTracker] Failed to get patterns:', error)
            return null
        }
    }

    /**
     * Trigger preloading for a specific path
     */
    async preloadForPath(path: string): Promise<boolean> {
        if (!this.serviceWorker) {
            return false
        }

        try {
            const response = await this.sendMessage('PRELOAD_FOR_PATH', { path })
            return response.success
        } catch (error) {
            console.error('[NavigationTracker] Failed to preload for path:', error)
            return false
        }
    }

    /**
     * Preload critical data based on patterns
     */
    async preloadCriticalData(): Promise<boolean> {
        if (!this.serviceWorker) {
            return false
        }

        try {
            const response = await this.sendMessage('PRELOAD_CRITICAL_DATA')
            return response.success
        } catch (error) {
            console.error('[NavigationTracker] Failed to preload critical data:', error)
            return false
        }
    }

    /**
     * Clear all navigation patterns
     */
    async clearPatterns(): Promise<boolean> {
        if (!this.serviceWorker) {
            return false
        }

        try {
            const response = await this.sendMessage('CLEAR_NAVIGATION_PATTERNS')
            return response.success
        } catch (error) {
            console.error('[NavigationTracker] Failed to clear patterns:', error)
            return false
        }
    }

    /**
     * Get cache statistics including navigation data
     */
    async getCacheStats(): Promise<any> {
        if (!this.serviceWorker) {
            return null
        }

        try {
            const response = await this.sendMessage('GET_PRELOAD_STATS')
            return response.success ? response.stats : null
        } catch (error) {
            console.error('[NavigationTracker] Failed to get cache stats:', error)
            return null
        }
    }

    /**
     * Get detailed preloader statistics
     */
    async getPreloaderStats(): Promise<any> {
        if (!this.serviceWorker) {
            return null
        }

        try {
            const response = await this.sendMessage('GET_PRELOADER_STATS')
            return response.success ? response.stats : null
        } catch (error) {
            console.error('[NavigationTracker] Failed to get preloader stats:', error)
            return null
        }
    }

    /**
     * Force preload specific URLs
     */
    async forcePreload(urls: string[]): Promise<boolean> {
        if (!this.serviceWorker) {
            return false
        }

        try {
            const response = await this.sendMessage('FORCE_PRELOAD', { urls })
            return response.success
        } catch (error) {
            console.error('[NavigationTracker] Failed to force preload:', error)
            return false
        }
    }

    /**
     * Clear preload queue
     */
    async clearPreloadQueue(): Promise<boolean> {
        if (!this.serviceWorker) {
            return false
        }

        try {
            const response = await this.sendMessage('CLEAR_PRELOAD_QUEUE')
            return response.success
        } catch (error) {
            console.error('[NavigationTracker] Failed to clear preload queue:', error)
            return false
        }
    }

    private async sendMessage(type: string, payload?: any): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.serviceWorker) {
                reject(new Error('Service worker not available'))
                return
            }

            const messageChannel = new MessageChannel()

            messageChannel.port1.onmessage = (event) => {
                resolve(event.data)
            }

            this.serviceWorker.postMessage(
                { type, payload },
                [messageChannel.port2]
            )

            // Timeout after 5 seconds
            setTimeout(() => {
                reject(new Error('Message timeout'))
            }, 5000)
        })
    }

    /**
     * Get the current session ID
     */
    getSessionId(): string {
        return this.sessionId
    }

    /**
     * Generate a new session ID (useful for page refreshes or new sessions)
     */
    renewSession(): string {
        this.sessionId = this.generateSessionId()
        return this.sessionId
    }
}

// Export singleton instance
export const navigationTracker = new NavigationTracker()

// Export class for custom instances
export { NavigationTracker }