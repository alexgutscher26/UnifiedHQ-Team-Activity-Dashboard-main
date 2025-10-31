/**
 * Client-side authentication guard component
 * Provides additional protection and better UX for protected pages
 */

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, ShieldCheck } from 'lucide-react'

interface AuthGuardProps {
    children: React.ReactNode
    fallback?: React.ReactNode
    redirectTo?: string
    requireAdmin?: boolean
}

export function AuthGuard({
    children,
    fallback,
    redirectTo = '/auth/signin',
    requireAdmin = false
}: AuthGuardProps) {
    const [isLoading, setIsLoading] = useState(true)
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [user, setUser] = useState<any>(null)
    const router = useRouter()

    useEffect(() => {
        let mounted = true

        const checkAuth = async () => {
            try {
                const session = await authClient.getSession()

                if (!mounted) return

                if (session.data?.user) {
                    setUser(session.data.user)
                    setIsAuthenticated(true)

                    // Optional: Check admin role
                    if (requireAdmin && session.data.user.role !== 'admin') {
                        router.push('/unauthorized')
                        return
                    }
                } else {
                    // Redirect to sign in with current path as callback
                    const currentPath = window.location.pathname
                    const signInUrl = `${redirectTo}?callbackUrl=${encodeURIComponent(currentPath)}`
                    router.push(signInUrl)
                    return
                }
            } catch (error) {
                console.error('Auth check failed:', error)
                if (mounted) {
                    const currentPath = window.location.pathname
                    const signInUrl = `${redirectTo}?callbackUrl=${encodeURIComponent(currentPath)}`
                    router.push(signInUrl)
                }
            } finally {
                if (mounted) {
                    setIsLoading(false)
                }
            }
        }

        checkAuth()

        return () => {
            mounted = false
        }
    }, [router, redirectTo, requireAdmin])

    if (isLoading) {
        return fallback || (
            <div className="min-h-screen flex items-center justify-center">
                <Card className="w-full max-w-md">
                    <CardContent className="flex flex-col items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">Checking authentication...</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (!isAuthenticated) {
        return fallback || (
            <div className="min-h-screen flex items-center justify-center">
                <Card className="w-full max-w-md">
                    <CardContent className="flex flex-col items-center justify-center py-8">
                        <ShieldCheck className="h-8 w-8 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">Redirecting to sign in...</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return <>{children}</>
}

/**
 * Hook to get current user from auth guard context
 */
export function useAuthGuard() {
    const [user, setUser] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        let mounted = true

        const getUser = async () => {
            try {
                const session = await authClient.getSession()
                if (mounted && session.data?.user) {
                    setUser(session.data.user)
                }
            } catch (error) {
                console.error('Failed to get user:', error)
            } finally {
                if (mounted) {
                    setIsLoading(false)
                }
            }
        }

        getUser()

        return () => {
            mounted = false
        }
    }, [])

    return { user, isLoading }
}