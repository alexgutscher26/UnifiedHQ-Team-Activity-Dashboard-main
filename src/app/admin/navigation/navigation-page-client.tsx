'use client'

import { NavigationTrackingDashboard } from '@/components/navigation-tracking-dashboard'
import { AuthGuard, useAuthGuard } from '@/components/auth-guard'

export function NavigationPageClient() {
    return (
        <AuthGuard>
            <NavigationPageContent />
        </AuthGuard>
    )
}

function NavigationPageContent() {
    const { user, isLoading } = useAuthGuard()

    if (isLoading) {
        return (
            <div className="container mx-auto px-4 py-6">
                <div className="animate-pulse space-y-6">
                    <div className="h-8 bg-muted rounded w-1/3"></div>
                    <div className="h-4 bg-muted rounded w-2/3"></div>
                    <div className="h-64 bg-muted rounded"></div>
                </div>
            </div>
        )
    }

    return (
        <div className="container mx-auto px-4 py-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Navigation Analytics</h1>
                    <p className="text-muted-foreground">
                        Monitor user navigation patterns, cache performance, and preloading statistics
                    </p>
                </div>
                {user && (
                    <div className="text-sm text-muted-foreground">
                        Logged in as: <span className="font-medium">{user.name || user.email}</span>
                    </div>
                )}
            </div>

            <NavigationTrackingDashboard />
        </div>
    )
}