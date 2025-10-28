import type React from 'react';
import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Analytics } from '@vercel/analytics/next';
import { Suspense } from 'react';
import { GlobalErrorBoundary } from '@/components/error-boundaries';
import { MemoryMonitor } from '@/components/memory-monitor';
import { ThemeProvider } from '@/components/theme-provider';
import { CustomThemeProvider } from '@/contexts/theme-context';
import { ToastContainer } from '@/components/toast';
import { RateLimitOverlay } from '@/components/rate-limit';
import { LoadingSkeleton } from '@/components/ui/loading';
import './globals.css';

export const metadata: Metadata = {
  title: 'UnifiedHQ - Team Activity Dashboard',
  description: 'One dashboard to see everything your team did today',
};

function LoadingScreen() {
  return (
    <div className='min-h-screen bg-background flex items-center justify-center'>
      <div className='flex flex-col items-center space-y-4'>
        <div className='flex space-x-2'>
          <div className='w-3 h-3 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]'></div>
          <div className='w-3 h-3 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]'></div>
          <div className='w-3 h-3 bg-primary rounded-full animate-bounce'></div>
        </div>
        <div className='text-center space-y-2'>
          <h2 className='text-lg font-semibold text-foreground'>
            Loading UnifiedHQ
          </h2>
          <p className='text-sm text-muted-foreground'>
            Preparing your dashboard...
          </p>
        </div>
        <div className='w-64 space-y-2'>
          <LoadingSkeleton className='h-2 w-full' />
          <LoadingSkeleton className='h-2 w-3/4' />
          <LoadingSkeleton className='h-2 w-1/2' />
        </div>
      </div>
    </div>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en' suppressHydrationWarning>
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <ThemeProvider attribute='class' defaultTheme='system' enableSystem>
          <CustomThemeProvider>
            <GlobalErrorBoundary>
              <Suspense fallback={<LoadingScreen />}>{children}</Suspense>
            </GlobalErrorBoundary>
            <ToastContainer />
            <RateLimitOverlay />
            <Analytics />
            <MemoryMonitor />
          </CustomThemeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
