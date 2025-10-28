'use client';

import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogOut, User } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function UserProfile() {
  const { data: session, isPending, error } = authClient.useSession();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await authClient.signOut({
        fetchOptions: {
          onSuccess: () => {
            router.push('/');
          },
        },
      });
    } catch (err) {
      console.error('Failed to sign out:', err);
    }
  };

  if (isPending) {
    return (
      <Card className='w-full max-w-md'>
        <CardContent className='p-6'>
          <div className='text-center'>Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (error || !session) {
    return (
      <Card className='w-full max-w-md'>
        <CardContent className='p-6 text-center space-y-4'>
          <div>
            <User className='mx-auto h-12 w-12 text-muted-foreground' />
            <h3 className='mt-2 text-lg font-semibold'>Not signed in</h3>
            <p className='text-muted-foreground'>
              Sign in to view your profile
            </p>
          </div>
          <div className='space-x-2'>
            <Button onClick={() => router.push('/auth/signin')}>Sign In</Button>
            <Button
              variant='outline'
              onClick={() => router.push('/auth/signup')}
            >
              Sign Up
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className='w-full max-w-md'>
      <CardHeader>
        <CardTitle className='flex items-center space-x-2'>
          <User className='h-5 w-5' />
          <span>User Profile</span>
        </CardTitle>
        <CardDescription>
          Your account information and session details
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='flex items-center space-x-4'>
          <Avatar>
            <AvatarImage src={session.user.image || ''} />
            <AvatarFallback>
              {session.user.name?.charAt(0) ||
                session.user.email?.charAt(0) ||
                'U'}
            </AvatarFallback>
          </Avatar>
          <div className='space-y-1'>
            <p className='text-sm font-medium leading-none'>
              {session.user.name || 'No name'}
            </p>
            <p className='text-sm text-muted-foreground'>
              {session.user.email}
            </p>
          </div>
        </div>

        <div className='space-y-2 text-sm'>
          <div className='flex justify-between'>
            <span className='text-muted-foreground'>Email Verified:</span>
            <span
              className={
                session.user.emailVerified ? 'text-green-600' : 'text-red-600'
              }
            >
              {session.user.emailVerified ? 'Yes' : 'No'}
            </span>
          </div>
          <div className='flex justify-between'>
            <span className='text-muted-foreground'>User ID:</span>
            <span className='font-mono text-xs'>{session.user.id}</span>
          </div>
          <div className='flex justify-between'>
            <span className='text-muted-foreground'>Created:</span>
            <span>{new Date(session.user.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        <Button variant='outline' className='w-full' onClick={handleSignOut}>
          <LogOut className='mr-2 h-4 w-4' />
          Sign Out
        </Button>
      </CardContent>
    </Card>
  );
}
