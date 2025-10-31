/**
 * React hook for navigation tracking integration
 */

import { useEffect, useCallback, useState } from 'react'
import { usePathname } from 'next/navigation'
import { navigationTracker, type NavigationStats } from '@/lib/navigation-tracker'

export interface UseNavigationTrackingOptions {
    /**
     * Whether to automatically track navigation changes
     * @default true
     */
    autoTrack?: boolean

    /**
     * Whether to preload critical data on mount
     * @default false
     */
    preloadOnMount?: boolean

    /**
     * Debounce delay for navigation tracking (ms)
     * @default 100
     */
    debounceMs?: number
}

export interface NavigationTrackingState {
    isTracking: boolean
    stats: NavigationStats | null
    error: string | null
}

export function useNavigationTracking(options: UseNavigationTrackingOptions = {}) {
    const {
        autoTrack = true,
        preloadOnMount = false,
        debounceMs = 100
    } = options

    const pathname = usePathname()
    const [state, setState] = useState<NavigationTrackingState>({
        isTracking: false,
        stats: null,
        error: null
    })

    // Track navigation changes
    const trackNavigation = useCallback(async (path?: string) => {
        const targetPath = path || pathname

        setState(prev => ({ ...prev, isTracking: true, error: null }))

        try {
            const success = await navigationTracker.trackNavigation(targetPath)
            if (!success) {
                setState(prev => ({
                    ...prev,
                    isTracking: false,
                    error: 'Failed to track navigation'
                }))
            } else {
                setState(prev => ({ ...prev, isTracking: false }))
            }
        } catch (error) {
            setState(prev => ({
                ...prev,
                isTracking: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            }))
        }
    }, [pathname])

    // Get navigation statistics
    const getStats = useCallback(async (limit = 10) => {
        try {
            const stats = await navigationTracker.getNavigationPatterns(limit)
            setState(prev => ({ ...prev, stats, error: null }))
            return stats
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to get stats'
            setState(prev => ({ ...prev, error: errorMessage }))
            return null
        }
    }, [])

    // Preload data for current path
    const preloadForCurrentPath = useCallback(async () => {
        try {
            await navigationTracker.preloadForPath(pathname)
        } catch (error) {
            console.warn('[useNavigationTracking] Preload failed:', error)
        }
    }, [pathname])

    // Preload critical data
    const preloadCriticalData = useCallback(async () => {
        try {
            await navigationTracker.preloadCriticalData()
        } catch (error) {
            console.warn('[useNavigationTracking] Critical data preload failed:', error)
        }
    }, [])

    // Clear all patterns
    const clearPatterns = useCallback(async () => {
        try {
            const success = await navigationTracker.clearPatterns()
            if (success) {
                setState(prev => ({ ...prev, stats: null }))
            }
            return success
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to clear patterns'
            setState(prev => ({ ...prev, error: errorMessage }))
            return false
        }
    }, [])

    // Auto-track navigation changes with debouncing
    useEffect(() => {
        if (!autoTrack) return

        const timeoutId = setTimeout(() => {
            trackNavigation()
        }, debounceMs)

        return () => clearTimeout(timeoutId)
    }, [pathname, autoTrack, debounceMs, trackNavigation])

    // Preload critical data on mount if requested
    useEffect(() => {
        if (preloadOnMount) {
            preloadCriticalData()
        }
    }, [preloadOnMount, preloadCriticalData])

    return {
        // State
        ...state,

        // Actions
        trackNavigation,
        getStats,
        preloadForCurrentPath,
        preloadCriticalData,
        clearPatterns,

        // Utilities
        sessionId: navigationTracker.getSessionId(),
        renewSession: navigationTracker.renewSession.bind(navigationTracker)
    }
}

/**
 * Hook for getting navigation statistics with automatic refresh
 */
export function useNavigationStats(refreshInterval = 30000) {
    const [stats, setStats] = useState<NavigationStats | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const refreshStats = useCallback(async () => {
        setLoading(true)
        setError(null)

        try {
            const newStats = await navigationTracker.getNavigationPatterns()
            setStats(newStats)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch stats')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        refreshStats()

        if (refreshInterval > 0) {
            const interval = setInterval(refreshStats, refreshInterval)
            return () => clearInterval(interval)
        }
    }, [refreshStats, refreshInterval])

    return {
        stats,
        loading,
        error,
        refresh: refreshStats
    }
}