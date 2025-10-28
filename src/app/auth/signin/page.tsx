'use client';

import React, { useState, useEffect } from 'react';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Github, Slack } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthErrorBoundary } from '@/components/error-boundaries';
import { ValidatedInput, FormGroup, FormActions } from '@/components/ui/form';
import { useFormValidation } from '@/lib/validation';
import { validationSchemas } from '@/lib/validation';

/**
 * Renders the Sign In page with options for email/password and social sign-in.
 *
 * This component manages the sign-in process, including form validation and handling both email/password and social sign-in methods. It retrieves the last used login method for user convenience and manages loading and error states during the sign-in process. The form submission is handled asynchronously, with appropriate error handling for both sign-in methods.
 *
 * @returns {JSX.Element} The rendered Sign In page component.
 */
export default function SignInPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastMethod, setLastMethod] = useState<string | null>(null);
  const router = useRouter();

  const { data, updateField, validateForm, getFieldError, isFormValid } =
    useFormValidation({ email: '', password: '' }, validationSchemas.signIn);

  useEffect(() => {
    // Get the last used login method
    const lastUsedMethod = authClient.getLastUsedLoginMethod();
    setLastMethod(lastUsedMethod);
  }, []);

  /**
   * Handles email sign-in process and manages loading and error states.
   */
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form before submission
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const { data: authData, error } = await authClient.signIn.email(
        {
          email: data.email,
          password: data.password,
          callbackURL: '/dashboard',
        },
        {
          onSuccess: () => {
            router.push('/dashboard');
          },
          onError: ctx => {
            setError(ctx.error.message);
          },
        }
      );
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialSignIn = async (provider: 'github' | 'slack') => {
    try {
      await authClient.signIn.social({
        provider,
        callbackURL: '/dashboard',
      });
    } catch (err) {
      setError('Failed to sign in with ' + provider);
    }
  };

  return (
    <AuthErrorBoundary>
      <div className='min-h-screen flex items-center justify-center bg-background p-4'>
        <Card className='w-full max-w-md'>
          <CardHeader className='space-y-1'>
            <CardTitle className='text-2xl text-center'>Sign In</CardTitle>
            <CardDescription className='text-center'>
              Enter your credentials to access your account
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            {/* Social Sign In */}
            <div className='space-y-2'>
              <div className='relative'>
                <Button
                  variant={lastMethod === 'github' ? 'default' : 'outline'}
                  className='w-full'
                  onClick={() => handleSocialSignIn('github')}
                >
                  <Github className='mr-2 h-4 w-4' />
                  Continue with GitHub
                  {lastMethod === 'github' && (
                    <Badge variant='secondary' className='ml-2'>
                      Last used
                    </Badge>
                  )}
                </Button>
              </div>
              <div className='relative'>
                <Button
                  variant={lastMethod === 'slack' ? 'default' : 'outline'}
                  className='w-full'
                  onClick={() => handleSocialSignIn('slack')}
                >
                  <Slack className='mr-2 h-4 w-4' />
                  Continue with Slack
                  {lastMethod === 'slack' && (
                    <Badge variant='secondary' className='ml-2'>
                      Last used
                    </Badge>
                  )}
                </Button>
              </div>
            </div>

            <div className='relative'>
              <div className='absolute inset-0 flex items-center'>
                <Separator className='w-full' />
              </div>
              <div className='relative flex justify-center text-xs uppercase'>
                <span className='bg-background px-2 text-muted-foreground'>
                  Or continue with
                </span>
              </div>
            </div>

            {/* Email/Password Sign In */}
            <form onSubmit={handleEmailSignIn}>
              <FormGroup>
                <ValidatedInput
                  label='Email'
                  type='email'
                  placeholder='m@example.com'
                  value={data.email}
                  onChange={e => updateField('email', e.target.value)}
                  validation={{ required: true, email: true }}
                  error={getFieldError('email')}
                  required
                />
                <ValidatedInput
                  label='Password'
                  type='password'
                  placeholder='Enter your password'
                  value={data.password}
                  onChange={e => updateField('password', e.target.value)}
                  validation={{ required: true, minLength: 6 }}
                  error={getFieldError('password')}
                  required
                />
                {error && (
                  <div className='text-sm text-destructive bg-destructive/10 p-3 rounded-md border border-destructive/20'>
                    {error}
                  </div>
                )}
                <FormActions>
                  <Button
                    type='submit'
                    variant={lastMethod === 'email' ? 'default' : 'default'}
                    className='w-full'
                    disabled={isLoading || !isFormValid()}
                  >
                    {isLoading ? 'Signing in...' : 'Sign In'}
                    {lastMethod === 'email' && (
                      <Badge variant='secondary' className='ml-2'>
                        Last used
                      </Badge>
                    )}
                  </Button>
                </FormActions>
              </FormGroup>
            </form>

            <div className='text-center text-sm'>
              Don&apos;t have an account?{' '}
              <Link
                href='/auth/signup'
                className='text-primary hover:underline'
              >
                Sign up
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </AuthErrorBoundary>
  );
}
