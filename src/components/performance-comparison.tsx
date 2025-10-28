'use client';

import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ActivityFeed } from './activity-feed';
import { OptimizedActivityFeed } from './optimized-activity-feed';
import { IconActivity, IconBolt, IconChartBar } from '@tabler/icons-react';

interface PerformanceComparisonProps {
  activities: any[];
}

export function PerformanceComparison({
  activities,
}: PerformanceComparisonProps) {
  const [selectedTab, setSelectedTab] = useState('original');
  const [performanceMetrics, setPerformanceMetrics] = useState({
    original: { renderTime: 0, memoryUsage: 0, itemCount: 0 },
    optimized: { renderTime: 0, memoryUsage: 0, itemCount: 0 },
  });

  const generateMockActivities = (count: number) => {
    return Array.from({ length: count }, (_, i) => ({
      id: `activity-${i}`,
      source: ['github', 'slack'][i % 3],
      title: `Activity ${i + 1}`,
      description: `This is a description for activity ${i + 1}`,
      timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
      metadata: {
        eventType: ['commit', 'pull_request', 'issue'][i % 3],
        actor: {
          login: `user${i}`,
          avatar_url: `https://avatars.githubusercontent.com/u/${i}`,
          html_url: `https://github.com/user${i}`,
        },
        payload: {
          commit: {
            sha: `abc${i}`,
            message: `Commit message ${i}`,
            url: `https://github.com/repo/commit/abc${i}`,
          },
        },
      },
    }));
  };

  const mockActivities = generateMockActivities(1000);

  const measurePerformance = (
    component: 'original' | 'optimized',
    metrics: any
  ) => {
    setPerformanceMetrics(prev => ({
      ...prev,
      [component]: metrics,
    }));
  };

  const getPerformanceImprovement = () => {
    const original = performanceMetrics.original;
    const optimized = performanceMetrics.optimized;

    if (original.renderTime === 0 || optimized.renderTime === 0) return 0;

    return (
      ((original.renderTime - optimized.renderTime) / original.renderTime) * 100
    );
  };

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <IconChartBar className='size-5' />
            Performance Comparison
          </CardTitle>
          <CardDescription>
            Compare the performance of the original vs optimized activity feed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4 mb-6'>
            <div className='space-y-2'>
              <h4 className='font-medium flex items-center gap-2'>
                <IconActivity className='size-4' />
                Original Feed
              </h4>
              <div className='space-y-1 text-sm'>
                <div className='flex justify-between'>
                  <span>Render Time:</span>
                  <Badge variant='outline'>
                    {performanceMetrics.original.renderTime.toFixed(2)}ms
                  </Badge>
                </div>
                <div className='flex justify-between'>
                  <span>Memory Usage:</span>
                  <Badge variant='outline'>
                    {performanceMetrics.original.memoryUsage.toFixed(2)}MB
                  </Badge>
                </div>
                <div className='flex justify-between'>
                  <span>Items:</span>
                  <Badge variant='outline'>
                    {performanceMetrics.original.itemCount}
                  </Badge>
                </div>
              </div>
            </div>

            <div className='space-y-2'>
              <h4 className='font-medium flex items-center gap-2'>
                <IconBolt className='size-4' />
                Optimized Feed
              </h4>
              <div className='space-y-1 text-sm'>
                <div className='flex justify-between'>
                  <span>Render Time:</span>
                  <Badge
                    variant='outline'
                    className='bg-green-50 text-green-700'
                  >
                    {performanceMetrics.optimized.renderTime.toFixed(2)}ms
                  </Badge>
                </div>
                <div className='flex justify-between'>
                  <span>Memory Usage:</span>
                  <Badge
                    variant='outline'
                    className='bg-green-50 text-green-700'
                  >
                    {performanceMetrics.optimized.memoryUsage.toFixed(2)}MB
                  </Badge>
                </div>
                <div className='flex justify-between'>
                  <span>Items:</span>
                  <Badge
                    variant='outline'
                    className='bg-green-50 text-green-700'
                  >
                    {performanceMetrics.optimized.itemCount}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {getPerformanceImprovement() > 0 && (
            <div className='bg-green-50 border border-green-200 rounded-lg p-4'>
              <h5 className='font-medium text-green-800 mb-2'>
                Performance Improvement
              </h5>
              <div className='text-sm text-green-700'>
                <p>
                  Render time improved by{' '}
                  <strong>{getPerformanceImprovement().toFixed(1)}%</strong>
                </p>
                <p>
                  Memory usage reduced by{' '}
                  <strong>
                    {(
                      ((performanceMetrics.original.memoryUsage -
                        performanceMetrics.optimized.memoryUsage) /
                        performanceMetrics.original.memoryUsage) *
                      100
                    ).toFixed(1)}
                    %
                  </strong>
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className='grid w-full grid-cols-2'>
          <TabsTrigger value='original'>Original Feed</TabsTrigger>
          <TabsTrigger value='optimized'>Optimized Feed</TabsTrigger>
        </TabsList>

        <TabsContent value='original' className='mt-4'>
          <div className='border rounded-lg'>
            <div className='p-4 bg-muted/50 border-b'>
              <h3 className='font-medium'>Original Activity Feed</h3>
              <p className='text-sm text-muted-foreground'>
                Standard implementation with all items rendered at once
              </p>
            </div>
            <div className='max-h-96 overflow-hidden'>
              <ActivityFeed />
            </div>
          </div>
        </TabsContent>

        <TabsContent value='optimized' className='mt-4'>
          <div className='border rounded-lg'>
            <div className='p-4 bg-green-50 border-b'>
              <h3 className='font-medium text-green-800'>
                Optimized Activity Feed
              </h3>
              <p className='text-sm text-green-700'>
                Virtual scrolling, memoization, and performance optimizations
              </p>
            </div>
            <div className='max-h-96 overflow-hidden'>
              <OptimizedActivityFeed />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Optimization Features</CardTitle>
          <CardDescription>
            Key performance improvements implemented
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div className='space-y-3'>
              <h4 className='font-medium'>Rendering Optimizations</h4>
              <ul className='space-y-2 text-sm'>
                <li className='flex items-center gap-2'>
                  <div className='w-2 h-2 bg-green-500 rounded-full'></div>
                  React.memo for activity items
                </li>
                <li className='flex items-center gap-2'>
                  <div className='w-2 h-2 bg-green-500 rounded-full'></div>
                  Virtual scrolling for large lists
                </li>
                <li className='flex items-center gap-2'>
                  <div className='w-2 h-2 bg-green-500 rounded-full'></div>
                  Memoized timestamp formatting
                </li>
                <li className='flex items-center gap-2'>
                  <div className='w-2 h-2 bg-green-500 rounded-full'></div>
                  Optimized icon rendering
                </li>
              </ul>
            </div>

            <div className='space-y-3'>
              <h4 className='font-medium'>User Experience</h4>
              <ul className='space-y-2 text-sm'>
                <li className='flex items-center gap-2'>
                  <div className='w-2 h-2 bg-blue-500 rounded-full'></div>
                  Debounced search (300ms)
                </li>
                <li className='flex items-center gap-2'>
                  <div className='w-2 h-2 bg-blue-500 rounded-full'></div>
                  Infinite scroll pagination
                </li>
                <li className='flex items-center gap-2'>
                  <div className='w-2 h-2 bg-blue-500 rounded-full'></div>
                  Real-time filtering
                </li>
                <li className='flex items-center gap-2'>
                  <div className='w-2 h-2 bg-blue-500 rounded-full'></div>
                  Performance metrics display
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
