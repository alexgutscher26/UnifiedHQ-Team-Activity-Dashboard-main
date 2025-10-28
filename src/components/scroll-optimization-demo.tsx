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
import {
  OptimizedScrollContainer,
  ScrollPerformanceIndicator,
  ScrollOptimizationSettings,
} from '@/components/optimized-scroll-container';
import {
  useScrollPerformanceMonitor,
  scrollOptimizationPresets,
} from '@/hooks/use-scroll-optimization';
import {
  IconArrowsVertical,
  IconBolt,
  IconChartBar,
  IconSettings,
} from '@tabler/icons-react';

/**
 * Renders a scroll optimization demo with performance monitoring and settings.
 */
export function ScrollOptimizationDemo() {
  const [selectedPreset, setSelectedPreset] =
    useState<keyof typeof scrollOptimizationPresets>('smooth');
  const [showPerformance, setShowPerformance] = useState(true);

  // Scroll performance monitoring
  const { metrics: scrollMetrics, handleScroll } = useScrollPerformanceMonitor(
    scrollOptimizationPresets[selectedPreset]
  );

  // Generate large dataset for testing
  const generateTestData = (count: number) => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      title: `Scroll Test Item ${i + 1}`,
      description: `This is a test item to demonstrate scroll performance optimization. Item ${i + 1} of ${count}.`,
      timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
      category: ['Performance', 'Optimization', 'Testing', 'Demo'][i % 4],
    }));
  };

  const testData = generateTestData(1000);

  const renderTestItem = (item: any, index: number) => (
    <div
      key={item.id}
      className='p-4 border-b border-gray-200 hover:bg-gray-50 transition-colors'
      style={{ minHeight: '80px' }}
    >
      <div className='flex items-center justify-between mb-2'>
        <h3 className='font-medium text-sm'>{item.title}</h3>
        <Badge variant='outline' className='text-xs'>
          {item.category}
        </Badge>
      </div>
      <p className='text-sm text-gray-600 mb-2'>{item.description}</p>
      <div className='text-xs text-gray-400'>
        Index: {index} | ID: {item.id}
      </div>
    </div>
  );

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <IconArrowsVertical className='size-5' />
            Scroll Optimization Demo
          </CardTitle>
          <CardDescription>
            Compare different scroll optimization strategies and monitor
            performance in real-time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4 mb-6'>
            <ScrollOptimizationSettings
              currentPreset={selectedPreset}
              onPresetChange={setSelectedPreset}
            />

            <div className='space-y-2'>
              <label className='text-sm font-medium'>Display Options:</label>
              <div className='flex items-center space-x-2'>
                <input
                  type='checkbox'
                  id='showPerformance'
                  checked={showPerformance}
                  onChange={e => setShowPerformance(e.target.checked)}
                  className='rounded'
                />
                <label htmlFor='showPerformance' className='text-sm'>
                  Show Performance Metrics
                </label>
              </div>
            </div>
          </div>

          {showPerformance && (
            <ScrollPerformanceIndicator
              scrollMetrics={scrollMetrics}
              className='mb-4'
            />
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue='optimized' className='w-full'>
        <TabsList className='grid w-full grid-cols-2'>
          <TabsTrigger value='optimized'>Optimized Scroll</TabsTrigger>
          <TabsTrigger value='standard'>Standard Scroll</TabsTrigger>
        </TabsList>

        <TabsContent value='optimized' className='mt-4'>
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <IconBolt className='size-4 text-green-600' />
                Optimized Scroll Container
              </CardTitle>
              <CardDescription>
                Using scroll throttling, RAF optimization, and passive listeners
              </CardDescription>
            </CardHeader>
            <CardContent>
              <OptimizedScrollContainer
                height={400}
                optimizationPreset={selectedPreset}
                onScroll={handleScroll}
                className='border rounded-lg'
              >
                <div className='space-y-0'>
                  {testData.map((item, index) => renderTestItem(item, index))}
                </div>
              </OptimizedScrollContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='standard' className='mt-4'>
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <IconChartBar className='size-4 text-orange-600' />
                Standard Scroll Container
              </CardTitle>
              <CardDescription>
                Standard scroll implementation without optimization
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className='border rounded-lg overflow-auto'
                style={{ height: '400px' }}
              >
                <div className='space-y-0'>
                  {testData.map((item, index) => renderTestItem(item, index))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <IconSettings className='size-5' />
            Optimization Features
          </CardTitle>
          <CardDescription>
            Key scroll optimization techniques implemented
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
            <div className='space-y-4'>
              <h4 className='font-medium text-green-800'>
                Performance Optimizations
              </h4>
              <ul className='space-y-2 text-sm'>
                <li className='flex items-center gap-2'>
                  <div className='w-2 h-2 bg-green-600 rounded-full'></div>
                  <span>Scroll throttling (16ms = 60fps)</span>
                </li>
                <li className='flex items-center gap-2'>
                  <div className='w-2 h-2 bg-green-600 rounded-full'></div>
                  <span>RequestAnimationFrame optimization</span>
                </li>
                <li className='flex items-center gap-2'>
                  <div className='w-2 h-2 bg-green-600 rounded-full'></div>
                  <span>Passive event listeners</span>
                </li>
                <li className='flex items-center gap-2'>
                  <div className='w-2 h-2 bg-green-600 rounded-full'></div>
                  <span>Debounced scroll handling</span>
                </li>
              </ul>
            </div>

            <div className='space-y-4'>
              <h4 className='font-medium text-blue-800'>Monitoring Features</h4>
              <ul className='space-y-2 text-sm'>
                <li className='flex items-center gap-2'>
                  <div className='w-2 h-2 bg-blue-600 rounded-full'></div>
                  <span>Real-time scroll performance metrics</span>
                </li>
                <li className='flex items-center gap-2'>
                  <div className='w-2 h-2 bg-blue-600 rounded-full'></div>
                  <span>Scroll jank detection</span>
                </li>
                <li className='flex items-center gap-2'>
                  <div className='w-2 h-2 bg-blue-600 rounded-full'></div>
                  <span>Performance grade scoring</span>
                </li>
                <li className='flex items-center gap-2'>
                  <div className='w-2 h-2 bg-blue-600 rounded-full'></div>
                  <span>Automatic performance alerts</span>
                </li>
              </ul>
            </div>
          </div>

          <div className='mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg'>
            <h5 className='font-medium text-blue-800 mb-2'>
              Performance Targets
            </h5>
            <div className='grid grid-cols-1 md:grid-cols-3 gap-4 text-sm'>
              <div>
                <span className='font-medium'>Scroll Time:</span>
                <div className='text-blue-700'>
                  ≤8ms (Excellent) | ≤16ms (Good) | &gt;16ms (Needs Improvement)
                </div>
              </div>
              <div>
                <span className='font-medium'>Jank Rate:</span>
                <div className='text-blue-700'>
                  ≤5% (Excellent) | ≤10% (Good) | &gt;10% (Needs Improvement)
                </div>
              </div>
              <div>
                <span className='font-medium'>Frame Rate:</span>
                <div className='text-blue-700'>
                  ≥60fps (Excellent) | ≥30fps (Good) | &lt;30fps (Needs
                  Improvement)
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
