'use client';

import React, { useState } from 'react';
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
import { Github, Slack } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthErrorBoundary } from '@/components/error-boundaries';
import { ValidatedInput, FormGroup, FormActions } from '@/components/ui/form';
import { useFormValidation } from '@/lib/validation';
import { validationSchemas } from '@/lib/validation';

export default function SignUpPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();

  const {
    data,
    errors,
    updateField,
    validateForm,
    getFieldError,
    isFormValid,
  } = useFormValidation(
    { name: '', email: '', password: '', confirmPassword: '' },
    validationSchemas.signUp
  );

  /**
   * Handles the email sign-up process for a user.
   *
   * This function prevents the default form submission, validates the form, and checks if the password matches the confirmation.
   * It then initiates the sign-up process using the authClient, handling success and error responses accordingly.
   * Loading states are managed throughout the process to provide feedback to the user.
   *
   * @param e - The form event triggered by the sign-up form submission.
   */
  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form before submission
    if (!validateForm()) {
      return;
    }

    // Check password confirmation
    if (data.password !== data.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const { data: authData, error } = await authClient.signUp.email(
        {
          email: data.email,
          password: data.password,
          name: data.name,
          callbackURL: '/dashboard',
        },
        {
          onSuccess: () => {
            setSuccess('Account created successfully! Redirecting...');
            setTimeout(() => router.push('/dashboard'), 2000);
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
            <CardTitle className='text-2xl text-center'>Sign Up</CardTitle>
            <CardDescription className='text-center'>
              Create a new account to get started
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            {/* Social Sign In */}
            <div className='space-y-2'>
              <Button
                variant='outline'
                className='w-full'
                onClick={() => handleSocialSignIn('github')}
              >
                <Github className='mr-2 h-4 w-4' />
                Continue with GitHub
              </Button>
              <Button
                variant='outline'
                className='w-full'
                onClick={() => handleSocialSignIn('slack')}
              >
                <Slack className='mr-2 h-4 w-4' />
                Continue with Slack
              </Button>
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

            {/* Email/Password Sign Up */}
            <form onSubmit={handleEmailSignUp}>
              <FormGroup>
                <ValidatedInput
                  label='Full Name'
                  type='text'
                  placeholder='John Doe'
                  value={data.name}
                  onChange={e => updateField('name', e.target.value)}
                  validation={{ required: true, minLength: 2, maxLength: 50 }}
                  error={getFieldError('name')}
                  required
                />
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
                  placeholder='Minimum 8 characters with uppercase, lowercase, and number'
                  value={data.password}
                  onChange={e => updateField('password', e.target.value)}
                  validation={{
                    required: true,
                    minLength: 8,
                    custom: value => {
                      if (!value) return 'Password is required';
                      if (value.length < 8)
                        return 'Password must be at least 8 characters';
                      if (!/(?=.*[a-z])/.test(value))
                        return 'Password must contain at least one lowercase letter';
                      if (!/(?=.*[A-Z])/.test(value))
                        return 'Password must contain at least one uppercase letter';
                      if (!/(?=.*\d)/.test(value))
                        return 'Password must contain at least one number';
                      return null;
                    },
                  }}
                  error={getFieldError('password')}
                  required
                />
                <ValidatedInput
                  label='Confirm Password'
                  type='password'
                  placeholder='Confirm your password'
                  value={data.confirmPassword}
                  onChange={e => updateField('confirmPassword', e.target.value)}
                  validation={{ required: true }}
                  error={getFieldError('confirmPassword')}
                  required
                />
                {error && (
                  <div className='text-sm text-destructive bg-destructive/10 p-3 rounded-md border border-destructive/20'>
                    {error}
                  </div>
                )}
                {success && (
                  <div className='text-sm text-green-600 bg-green-50 p-3 rounded-md border border-green-200'>
                    {success}
                  </div>
                )}
                <FormActions>
                  <Button
                    type='submit'
                    className='w-full'
                    disabled={isLoading || !isFormValid()}
                  >
                    {isLoading ? 'Creating account...' : 'Sign Up'}
                  </Button>
                </FormActions>
              </FormGroup>
            </form>

            <div className='text-center text-sm'>
              Already have an account?{' '}
              <Link
                href='/auth/signin'
                className='text-primary hover:underline'
              >
                Sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </AuthErrorBoundary>
  );
}
