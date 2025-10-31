/**
 * Navigation Tracking Dashboard Component
 * Displays navigation patterns and statistics from the service worker
 */

'use client'

import { useState, useEffect } from 'react'
import { useNavigationStats, useNavigationTracking } from '@/hooks/use-navigation-tracking'
import { navigationTracker } from '@/lib/navigation-tracker'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { RefreshCw, Trash2, Zap, Activity, Clock, Users } from 'lucide-react'

/**
 * Render the Navigation Tracking Dashboard component.
 *
 * This component fetches and displays navigation statistics, including user patterns, session activity, and preloader statistics. It provides functionality to clear patterns, preload critical data, and refresh the displayed data periodically. The component handles loading states and errors gracefully, ensuring a smooth user experience while monitoring navigation behavior.
 *
 * @returns {JSX.Element} The rendered Navigation Tracking Dashboard component.
 */
export function NavigationTrackingDashboard() {
    const { stats, loading, error, refresh } = useNavigationStats()
    const { clearPatterns, preloadCriticalData } = useNavigationTracking({ autoTrack: false })
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [preloaderStats, setPreloaderStats] = useState<any>(null)

    /**
     * Handles the process of clearing patterns and refreshing the state.
     */
    const handleClearPatterns = async () => {
        setActionLoading('clear')
        try {
            await clearPatterns()
            await refresh()
        } finally {
            setActionLoading(null)
        }
    }

    /**
     * Handles the preloading of critical data and updates loading state.
     */
    const handlePreloadCritical = async () => {
        setActionLoading('preload')
        try {
            await preloadCriticalData()
            await refreshPreloaderStats()
        } finally {
            setActionLoading(null)
        }
    }

    /**
     * Refreshes the preloader statistics.
     */
    const refreshPreloaderStats = async () => {
        try {
            const stats = await navigationTracker.getPreloaderStats()
            setPreloaderStats(stats)
        } catch (error) {
            console.warn('Failed to get preloader stats:', error)
        }
    }

    const handleRefresh = async () => {
        await refresh()
        await refreshPreloaderStats()
    }

    // Load preloader stats on mount and periodically
    useEffect(() => {
        refreshPreloaderStats()
        const interval = setInterval(refreshPreloaderStats, 10000) // Refresh every 10 seconds
        return () => clearInterval(interval)
    }, [])

    /**
     * Formats a duration in milliseconds into a string of minutes and seconds.
     */
    const formatDuration = (ms: number) => {
        const minutes = Math.floor(ms / 60000)
        const seconds = Math.floor((ms % 60000) / 1000)
        return `${minutes}m ${seconds}s`
    }

    /**
     * Formats a timestamp into a localized time string.
     */
    const formatTimestamp = (timestamp: number) => {
        return new Date(timestamp).toLocaleTimeString()
    }

    if (error) {
        return (
            <Card className="w-full">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5" />
                        Navigation Tracking
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8">
                        <p className="text-muted-foreground">Error loading navigation data: {error}</p>
                        <Button onClick={handleRefresh} className="mt-4">
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Retry
                        </Button>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Activity className="h-5 w-5" />
                                Navigation Tracking Dashboard
                            </CardTitle>
                            <CardDescription>
                                Monitor user navigation patterns and cache performance
                            </CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleRefresh}
                                disabled={loading}
                            >
                                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                                Refresh
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handlePreloadCritical}
                                disabled={actionLoading === 'preload'}
                            >
                                <Zap className="h-4 w-4 mr-2" />
                                Preload Critical
                            </Button>
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={handleClearPatterns}
                                disabled={actionLoading === 'clear'}
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Clear Patterns
                            </Button>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {loading && !stats ? (
                <Card>
                    <CardContent className="py-8">
                        <div className="text-center">
                            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                            <p className="text-muted-foreground">Loading navigation data...</p>
                        </div>
                    </CardContent>
                </Card>
            ) : stats ? (
                <>
                    {/* Overview Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card>
                            <CardContent className="p-6">
                                <div className="flex items-center gap-2">
                                    <Activity className="h-4 w-4 text-blue-500" />
                                    <div>
                                        <p className="text-2xl font-bold">{stats.totalPatterns}</p>
                                        <p className="text-sm text-muted-foreground">Total Patterns</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-6">
                                <div className="flex items-center gap-2">
                                    <Users className="h-4 w-4 text-green-500" />
                                    <div>
                                        <p className="text-2xl font-bold">{stats.totalSessions}</p>
                                        <p className="text-sm text-muted-foreground">Active Sessions</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-6">
                                <div className="flex items-center gap-2">
                                    <Zap className="h-4 w-4 text-orange-500" />
                                    <div>
                                        <p className="text-2xl font-bold">{stats.criticalPaths.length}</p>
                                        <p className="text-sm text-muted-foreground">Critical Paths</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-6">
                                <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-purple-500" />
                                    <div>
                                        <p className="text-2xl font-bold">
                                            {stats.sessionActivity.filter(s => s.isActive).length}
                                        </p>
                                        <p className="text-sm text-muted-foreground">Active Now</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Top Navigation Patterns */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Top Navigation Patterns</CardTitle>
                            <CardDescription>
                                Most frequently accessed paths and their preload targets
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {stats.topPatterns.length > 0 ? (
                                <div className="space-y-4">
                                    {stats.topPatterns.map((pattern, index) => (
                                        <div key={pattern.path} className="flex items-center justify-between p-4 border rounded-lg">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Badge variant="secondary">#{index + 1}</Badge>
                                                    <code className="text-sm bg-muted px-2 py-1 rounded">
                                                        {pattern.path}
                                                    </code>
                                                </div>
                                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                                    <span>{pattern.count} visits</span>
                                                    <span>Last: {formatTimestamp(pattern.lastAccessed)}</span>
                                                    {pattern.preloadTargets.length > 0 && (
                                                        <span>{pattern.preloadTargets.length} preload targets</span>
                                                    )}
                                                </div>
                                                {pattern.preloadTargets.length > 0 && (
                                                    <div className="mt-2 flex flex-wrap gap-1">
                                                        {pattern.preloadTargets.map((target) => (
                                                            <Badge key={target} variant="outline" className="text-xs">
                                                                {target}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center text-muted-foreground py-8">
                                    No navigation patterns recorded yet
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Session Activity */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Session Activity</CardTitle>
                            <CardDescription>
                                Current user sessions and their navigation behavior
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {stats.sessionActivity.length > 0 ? (
                                <div className="space-y-3">
                                    {stats.sessionActivity.map((session) => (
                                        <div key={session.sessionId} className="flex items-center justify-between p-3 border rounded">
                                            <div className="flex items-center gap-3">
                                                <Badge variant={session.isActive ? "default" : "secondary"}>
                                                    {session.isActive ? "Active" : "Inactive"}
                                                </Badge>
                                                <code className="text-sm">{session.sessionId}</code>
                                            </div>
                                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                                <span>Duration: {formatDuration(session.duration)}</span>
                                                <span>{session.pathCount} paths</span>
                                                <span>{session.patternCount} patterns</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center text-muted-foreground py-8">
                                    No active sessions
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Critical Paths */}
                    {stats.criticalPaths.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Critical Paths</CardTitle>
                                <CardDescription>
                                    Frequently accessed paths that are prioritized for preloading
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-wrap gap-2">
                                    {stats.criticalPaths.map((path) => (
                                        <Badge key={path} variant="outline" className="font-mono">
                                            {path}
                                        </Badge>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Preloader Statistics */}
                    {preloaderStats && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Cache Preloader Statistics</CardTitle>
                                <CardDescription>
                                    Advanced preloading performance and queue status
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                    <div className="text-center p-4 border rounded">
                                        <p className="text-2xl font-bold text-blue-500">{preloaderStats.queue?.size || 0}</p>
                                        <p className="text-sm text-muted-foreground">Queue Size</p>
                                    </div>
                                    <div className="text-center p-4 border rounded">
                                        <p className="text-2xl font-bold text-green-500">{preloaderStats.active?.length || 0}</p>
                                        <p className="text-sm text-muted-foreground">Active Preloads</p>
                                    </div>
                                    <div className="text-center p-4 border rounded">
                                        <p className="text-2xl font-bold text-purple-500">
                                            {Math.round((preloaderStats.performance?.successRate || 0) * 100)}%
                                        </p>
                                        <p className="text-sm text-muted-foreground">Success Rate</p>
                                    </div>
                                </div>

                                {preloaderStats.queue?.items && preloaderStats.queue.items.length > 0 && (
                                    <div className="space-y-3">
                                        <h4 className="font-medium">Preload Queue</h4>
                                        {preloaderStats.queue.items.slice(0, 5).map((item: any, index: number) => (
                                            <div key={item.url} className="flex items-center justify-between p-3 border rounded">
                                                <div>
                                                    <code className="text-sm bg-muted px-2 py-1 rounded">{item.url}</code>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <Badge variant="outline" className="text-xs">
                                                            Priority: {item.priority}
                                                        </Badge>
                                                        <Badge variant="outline" className="text-xs">
                                                            {item.strategy}
                                                        </Badge>
                                                    </div>
                                                </div>
                                                <div className="text-sm text-muted-foreground">
                                                    {item.attempts > 0 && <span>Attempts: {item.attempts}</span>}
                                                </div>
                                            </div>
                                        ))}
                                        {preloaderStats.queue.items.length > 5 && (
                                            <p className="text-sm text-muted-foreground text-center">
                                                ... and {preloaderStats.queue.items.length - 5} more items
                                            </p>
                                        )}
                                    </div>
                                )}

                                {preloaderStats.completed && (
                                    <div className="mt-6 p-4 bg-muted rounded">
                                        <h4 className="font-medium mb-2">Completion Statistics</h4>
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div>Total: {preloaderStats.completed.total}</div>
                                            <div>Successful: {preloaderStats.completed.successful}</div>
                                            <div>Failed: {preloaderStats.completed.failed}</div>
                                            <div>
                                                Avg Time: {Math.round(preloaderStats.performance?.averageTime || 0)}ms
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </>
            ) : (
                <Card>
                    <CardContent className="py-8">
                        <div className="text-center">
                            <p className="text-muted-foreground">No navigation data available</p>
                            <Button onClick={handleRefresh} className="mt-4">
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Load Data
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}