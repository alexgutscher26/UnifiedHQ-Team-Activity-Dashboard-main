/**
 * Client-side authentication guard component
 * Provides additional protection and better UX for protected pages
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, ShieldCheck } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  redirectTo?: string;
  requireAdmin?: boolean;
}

/**
 * Authenticates a user and manages access to child components based on authentication status.
 *
 * The function checks the user's authentication status using an asynchronous call to authClient.getSession.
 * If the user is authenticated and has the required admin role (if specified), it renders the children.
 * If not authenticated, it redirects to the sign-in page, preserving the current path as a callback URL.
 * While loading, it displays a loading indicator or a fallback UI.
 *
 * @param children - The child components to render if the user is authenticated.
 * @param fallback - The fallback UI to display while loading or if not authenticated.
 * @param redirectTo - The URL to redirect to for sign-in (default is '/auth/signin').
 * @param requireAdmin - A flag indicating if admin role is required for access (default is false).
 */
export function AuthGuard({
  children,
  fallback,
  redirectTo = '/auth/signin',
  requireAdmin = false,
}: AuthGuardProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    /**
     * Checks the authentication status of the user and manages session state.
     *
     * The function retrieves the current session using authClient.getSession(). If the session contains a user, it updates the user state and authentication status. If an admin role is required and the user is not an admin, it redirects to an unauthorized page. If no user is found, it redirects to the sign-in page with the current path as a callback. In case of an error, it logs the error and attempts to redirect to the sign-in page if still mounted. Finally, it updates the loading state.
     *
     * @param {boolean} requireAdmin - Indicates if admin role verification is required.
     * @param {string} redirectTo - The URL to redirect to for signing in.
     * @param {boolean} mounted - A flag indicating if the component is still mounted.
     * @param {function} setUser - Function to set the authenticated user.
     * @param {function} setIsAuthenticated - Function to update the authentication status.
     * @param {function} setIsLoading - Function to update the loading state.
     * @param {object} router - The router object used for navigation.
     * @returns {Promise<void>} A promise that resolves when the authentication check is complete.
     */
    const checkAuth = async () => {
      try {
        const session = await authClient.getSession();

        if (!mounted) return;

        if (session.data?.user) {
          setUser(session.data.user);
          setIsAuthenticated(true);

          // Optional: Check admin role
          if (requireAdmin && session.data.user.role !== 'admin') {
            router.push('/unauthorized');
            return;
          }
        } else {
          // Redirect to sign in with current path as callback
          const currentPath = window.location.pathname;
          const signInUrl = `${redirectTo}?callbackUrl=${encodeURIComponent(currentPath)}`;
          router.push(signInUrl);
          return;
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        if (mounted) {
          const currentPath = window.location.pathname;
          const signInUrl = `${redirectTo}?callbackUrl=${encodeURIComponent(currentPath)}`;
          router.push(signInUrl);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    checkAuth();

    return () => {
      mounted = false;
    };
  }, [router, redirectTo, requireAdmin]);

  if (isLoading) {
    return (
      fallback || (
        <div className='min-h-screen flex items-center justify-center'>
          <Card className='w-full max-w-md'>
            <CardContent className='flex flex-col items-center justify-center py-8'>
              <Loader2 className='h-8 w-8 animate-spin text-muted-foreground mb-4' />
              <p className='text-muted-foreground'>
                Checking authentication...
              </p>
            </CardContent>
          </Card>
        </div>
      )
    );
  }

  if (!isAuthenticated) {
    return (
      fallback || (
        <div className='min-h-screen flex items-center justify-center'>
          <Card className='w-full max-w-md'>
            <CardContent className='flex flex-col items-center justify-center py-8'>
              <ShieldCheck className='h-8 w-8 text-muted-foreground mb-4' />
              <p className='text-muted-foreground'>Redirecting to sign in...</p>
            </CardContent>
          </Card>
        </div>
      )
    );
  }

  return <>{children}</>;
}

/**
 * Hook to get current user from auth guard context.
 *
 * This hook manages the authentication state by fetching the current user from the auth client.
 * It initializes the user state and loading state, then uses an effect to asynchronously retrieve
 * the user session. If the component is still mounted, it updates the user state with the retrieved
 * user data and sets the loading state to false once the operation is complete. The cleanup function
 * ensures that state updates do not occur on unmounted components.
 */
export function useAuthGuard() {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const getUser = async () => {
      try {
        const session = await authClient.getSession();
        if (mounted && session.data?.user) {
          setUser(session.data.user);
        }
      } catch (error) {
        console.error('Failed to get user:', error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    getUser();

    return () => {
      mounted = false;
    };
  }, []);

  return { user, isLoading };
}
