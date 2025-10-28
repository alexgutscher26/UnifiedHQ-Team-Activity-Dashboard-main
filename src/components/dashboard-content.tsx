'use client';

import React from 'react';
import { ActivityFeed } from '@/components/activity-feed';
import { AISummaryCard } from '@/components/ai-summary-card';
import { SectionCards } from '@/components/section-cards';
import {
  ActivityFeedErrorBoundary,
  GitHubErrorBoundary,
} from '@/components/error-boundaries';
import { useMemoryLeakPrevention } from '@/lib/memory-leak-prevention';

export function DashboardContent() {
  // Memory leak prevention
  useMemoryLeakPrevention('DashboardContent');

  return (
    <div className='flex flex-1 flex-col'>
      <div className='@container/main flex flex-1 flex-col gap-2'>
        <div className='flex flex-col gap-4 py-4 md:gap-6 md:py-6'>
          <GitHubErrorBoundary>
            <SectionCards />
          </GitHubErrorBoundary>

          <div className='grid grid-cols-1 gap-4 px-4 lg:grid-cols-3 lg:gap-6 lg:px-6'>
            <div className='lg:col-span-2'>
              <ActivityFeedErrorBoundary>
                <ActivityFeed />
              </ActivityFeedErrorBoundary>
            </div>
            <div className='lg:col-span-1 space-y-6'>
              <GitHubErrorBoundary>
                <AISummaryCard />
              </GitHubErrorBoundary>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
