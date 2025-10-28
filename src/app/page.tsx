import Link from 'next/link';
import { UserProfile } from '@/components/user-profile';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Github, Mail, Lock } from 'lucide-react';

export default function Home() {
  return (
    <div className='min-h-screen bg-background'>
      <div className='container mx-auto px-4 py-8'>
        <div className='text-center space-y-6 mb-12'>
          <h1 className='text-4xl font-bold text-foreground'>
            Better Auth Demo
          </h1>
          <p className='text-muted-foreground text-lg max-w-2xl mx-auto'>
            A complete authentication system with email/password and social
            providers built with Better Auth and Next.js.
          </p>
        </div>

        <div className='grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto'>
          {/* User Profile Section */}
          <div className='space-y-4'>
            <h2 className='text-2xl font-semibold'>Session Management</h2>
            <UserProfile />
          </div>

          {/* Features Section */}
          <div className='space-y-4'>
            <h2 className='text-2xl font-semibold'>Authentication Features</h2>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <Card>
                <CardHeader className='pb-3'>
                  <CardTitle className='text-lg flex items-center'>
                    <Mail className='mr-2 h-5 w-5' />
                    Email & Password
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Secure email and password authentication with validation
                  </CardDescription>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className='pb-3'>
                  <CardTitle className='text-lg flex items-center'>
                    <Github className='mr-2 h-5 w-5' />
                    Social Login
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Sign in with GitHub and Slack OAuth providers
                  </CardDescription>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className='pb-3'>
                  <CardTitle className='text-lg flex items-center'>
                    <Lock className='mr-2 h-5 w-5' />
                    Session Management
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Persistent sessions with automatic token refresh
                  </CardDescription>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className='pb-3'>
                  <CardTitle className='text-lg'>
                    Database Integration
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    PostgreSQL integration with Prisma ORM
                  </CardDescription>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className='text-center mt-12 space-x-4'>
          <Button asChild size='lg'>
            <Link href='/auth/signin'>Sign In</Link>
          </Button>
          <Button asChild variant='outline' size='lg'>
            <Link href='/auth/signup'>Sign Up</Link>
          </Button>
          <Button asChild variant='secondary' size='lg'>
            <Link href='/dashboard'>Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
