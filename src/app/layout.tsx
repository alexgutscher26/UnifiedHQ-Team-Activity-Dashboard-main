/**
 * @fileoverview Root Layout for UnifiedHQ Application
 *
 * This file defines the root layout component that wraps all pages in the
 * UnifiedHQ application. It sets up essential providers, error boundaries,
 * and global components needed for the application to function properly.
 *
 * Key responsibilities:
 * - Theme management (dark/light mode)
 * - Error boundary and error handling
 * - Network status and offline functionality
 * - Performance monitoring and memory management
 * - Service worker registration
 * - Global UI components (toasts, overlays, etc.)
 * - Analytics and monitoring integration
 * - Chatbot integration
 *
 * @author UnifiedHQ Team
 * @since 1.0.0
 */

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
import { ServiceWorkerProvider } from '@/components/service-worker-provider';
import { NetworkStatusProvider } from '@/contexts/network-status-context';
import { OfflineProvider } from '@/contexts/offline-context';
import { OfflineBanner } from '@/components/offline-indicator';
import { CacheChecker } from '@/components/cache-checker';
import { ThinkStackChatbot } from '@/components/thinkstack-chatbot';
import { UserJotProvider } from '@/components/providers/userjot-provider';

import './globals.css';

/**
 * Application Metadata
 *
 * Defines the default metadata for the UnifiedHQ application.
 * This metadata is used by Next.js for SEO, social sharing,
 * and browser tab information.
 *
 * @type {Metadata}
 * @property {string} title - The default page title shown in browser tabs
 * @property {string} description - The default meta description for SEO
 */
export const metadata: Metadata = {
  title: 'UnifiedHQ - Team Activity Dashboard',
  description: 'One dashboard to see everything your team did today',
};

/**
 * Animated Loading Dots Component
 *
 * Displays three bouncing dots with staggered animation timing.
 */
function LoadingDots() {
  return (
    <div className='flex space-x-2'>
      <div className='w-3 h-3 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]' />
      <div className='w-3 h-3 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]' />
      <div className='w-3 h-3 bg-primary rounded-full animate-bounce' />
    </div>
  );
}

/**
 * Loading Message Component
 *
 * Displays the loading text and description.
 */
function LoadingMessage() {
  return (
    <div className='text-center space-y-2'>
      <h2 className='text-lg font-semibold text-foreground'>
        Loading UnifiedHQ
      </h2>
      <p className='text-sm text-muted-foreground'>
        Preparing your dashboard...
      </p>
    </div>
  );
}

/**
 * Loading Progress Bars Component
 *
 * Displays skeleton loading bars for visual feedback.
 */
function LoadingProgress() {
  return (
    <div className='w-64 space-y-2'>
      <LoadingSkeleton className='h-2 w-full' />
      <LoadingSkeleton className='h-2 w-3/4' />
      <LoadingSkeleton className='h-2 w-1/2' />
    </div>
  );
}

/**
 * Loading Screen Component
 *
 * Displays an animated loading screen while the application initializes.
 * Used as a Suspense fallback for async components and route transitions.
 */
function LoadingScreen() {
  return (
    <div className='min-h-screen bg-background flex items-center justify-center'>
      <div className='flex flex-col items-center space-y-4'>
        <LoadingDots />
        <LoadingMessage />
        <LoadingProgress />
      </div>
    </div>
  );
}

/**
 * Theme and Context Providers Component
 *
 * Groups all theme-related providers to reduce nesting in main layout.
 */
function ThemeProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute='class' defaultTheme='system' enableSystem>
      <CustomThemeProvider>{children}</CustomThemeProvider>
    </ThemeProvider>
  );
}

/**
 * Service and Network Providers Component
 *
 * Groups service worker and network-related providers.
 */
function ServiceProviders({ children }: { children: React.ReactNode }) {
  return (
    <ServiceWorkerProvider>
      <NetworkStatusProvider>
        <OfflineProvider>{children}</OfflineProvider>
      </NetworkStatusProvider>
    </ServiceWorkerProvider>
  );
}

/**
 * Global UI Components
 *
 * Groups all global UI components that should be rendered at the root level.
 */
function GlobalComponents() {
  return (
    <>
      <CacheChecker />
      <OfflineBanner showWhenOnline />
      <ToastContainer />
      <RateLimitOverlay />
      <Analytics />
      {/* <MemoryMonitor /> */}
    </>
  );
}

/**
 * Application Content Wrapper
 *
 * Wraps the main application content with error boundary and suspense.
 */
function AppContent({ children }: { children: React.ReactNode }) {
  return (
    <GlobalErrorBoundary>
      <Suspense fallback={<LoadingScreen />}>{children}</Suspense>
    </GlobalErrorBoundary>
  );
}

/**
 * Application Providers Wrapper
 *
 * Groups all application-level providers and components to reduce nesting.
 */
function ApplicationWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProviders>
      <ServiceProviders>
        <UserJotProvider>
          <AppContent>{children}</AppContent>
          <GlobalComponents />
          {/* <ThinkStackChatbot /> */}
        </UserJotProvider>
      </ServiceProviders>
    </ThemeProviders>
  );
}

/**
 * Root Layout Component
 *
 * The main layout wrapper for the entire UnifiedHQ application.
 * Provides essential providers, error boundaries, and global components
 * that are needed across all pages.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en' suppressHydrationWarning>
      <head></head>
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <ApplicationWrapper>{children}</ApplicationWrapper>
      </body>
    </html>
  );
}
