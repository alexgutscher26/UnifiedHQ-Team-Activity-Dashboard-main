/**
 * Example: Integrating Navigation Tracking into Next.js App Layout
 * 
 * This example shows how to integrate the enhanced navigation tracking
 * and cache preloader into your UnifiedHQ app layout.
 */

import { NavigationTrackerProvider } from '@/components/navigation-tracker-provider'
import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'UnifiedHQ - Team Activity Dashboard',
    description: 'Centralized team activity tracking with intelligent caching',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <body>
                {/* Navigation Tracker Provider enables automatic tracking and preloading */}
                <NavigationTrackerProvider
                    preloadOnStart={true}  // Preload critical data on app start
                    autoTrack={true}       // Automatically track navigation changes
                >
                    <div className="min-h-screen bg-background">
                        {/* Your app header/navigation */}
                        <header className="border-b">
                            <nav className="container mx-auto px-4 py-3">
                                {/* Navigation items */}
                            </nav>
                        </header>

                        {/* Main content */}
                        <main className="container mx-auto px-4 py-6">
                            {children}
                        </main>

                        {/* Footer */}
                        <footer className="border-t mt-auto">
                            <div className="container mx-auto px-4 py-6 text-center text-muted-foreground">
                                <p>UnifiedHQ - Enhanced with intelligent caching</p>
                            </div>
                        </footer>
                    </div>
                </NavigationTrackerProvider>
            </body>
        </html>
    )
}

/**
 * Example: Dashboard Page with Navigation Tracking
 */
// app/dashboard/page.tsx
'use client'

import { useNavigationTracking } from '@/hooks/use-navigation-tracking'
import { useEffect } from 'react'

export default function DashboardPage() {
    const { preloadForCurrentPath, sessionId } = useNavigationTracking()

    useEffect(() => {
        // Preload likely next destinations when dashboard loads
        preloadForCurrentPath()
    }, [preloadForCurrentPath])

    return (
        <div>
            <h1>Dashboard</h1>
            <p>Session ID: {sessionId}</p>

            {/* Your dashboard content */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Dashboard widgets */}
            </div>
        </div>
    )
}

/**
 * Example: Admin Page with Navigation Analytics
 */
// app/admin/navigation/page.tsx
import { NavigationTrackingDashboard } from '@/components/navigation-tracking-dashboard'

export default function NavigationAdminPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Navigation Analytics</h1>
                <p className="text-muted-foreground">
                    Monitor navigation patterns and cache performance
                </p>
            </div>

            <NavigationTrackingDashboard />
        </div>
    )
}

/**
 * Example: Manual Navigation Tracking in Components
 */
// components/navigation-link.tsx
'use client'

import Link from 'next/link'
import { useOptionalNavigationTracker } from '@/components/navigation-tracker-provider'

interface NavigationLinkProps {
    href: string
    children: React.ReactNode
    preload?: boolean
}

export function NavigationLink({ href, children, preload = false }: NavigationLinkProps) {
    const tracker = useOptionalNavigationTracker()

    const handleClick = async () => {
        if (tracker) {
            // Track the navigation
            await tracker.trackNavigation(href)

            // Optionally preload the destination
            if (preload) {
                await tracker.preloadForCurrentPath()
            }
        }
    }

    return (
        <Link href={href} onClick={handleClick}>
            {children}
        </Link>
    )
}

/**
 * Example: Service Worker Registration
 */
// app/sw-registration.tsx
'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegistration() {
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then((registration) => {
                    console.log('SW registered:', registration)
                })
                .catch((error) => {
                    console.log('SW registration failed:', error)
                })
        }
    }, [])

    return null
}

// Add to your layout:
// <ServiceWorkerRegistration />

/**
 * Example: Environment-specific Configuration
 */
// lib/navigation-config.ts
export const navigationConfig = {
    development: {
        preloadOnStart: true,
        autoTrack: true,
        debugMode: true,
        refreshInterval: 5000, // 5 seconds for development
    },
    production: {
        preloadOnStart: true,
        autoTrack: true,
        debugMode: false,
        refreshInterval: 30000, // 30 seconds for production
    }
}

export function getNavigationConfig() {
    const env = process.env.NODE_ENV as keyof typeof navigationConfig
    return navigationConfig[env] || navigationConfig.development
}