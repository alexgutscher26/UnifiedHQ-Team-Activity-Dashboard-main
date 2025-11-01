/**
 * Cache Preloader Dashboard Component
 * Displays cache preloading statistics and controls
 */

'use client';

import { useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  RefreshCw,
  Zap,
  TrendingUp,
  Clock,
  BarChart3,
  Trash2,
  Loader2,
} from 'lucide-react';
import {
  useCachePreloader,
  usePreloadRecommendations,
} from '@/hooks/use-cache-preloader';

export function CachePreloaderDashboard() {
  const {
    isInitialized,
    stats,
    isLoading,
    error,
    getStats,
    preloadCriticalData,
    clearPatterns,
    smartPreload,
  } = useCachePreloader();

  const {
    recommendations,
    isLoading: recommendationsLoading,
    refreshRecommendations,
  } = usePreloadRecommendations();

  const [activeTab, setActiveTab] = useState('overview');

  // Optimized tab change handler
  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value);
  }, []);

  if (!isInitialized && !error) {
    return (
      <Card>
        <CardContent className='flex items-center justify-center p-6'>
          <div className='flex items-center space-x-2'>
            <Loader2 className='h-4 w-4 animate-spin' />
            <span>Initializing cache preloader...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className='p-6'>
          <div className='text-center text-red-600'>
            <p className='font-medium'>Cache Preloader Error</p>
            <p className='text-sm text-muted-foreground mt-1'>{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-2xl font-bold'>Cache Preloader</h2>
          <p className='text-muted-foreground'>
            Intelligent caching based on navigation patterns
          </p>
        </div>
        <div className='flex space-x-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={getStats}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className='h-4 w-4 animate-spin' />
            ) : (
              <RefreshCw className='h-4 w-4' />
            )}
            Refresh
          </Button>
          <Button
            variant='outline'
            size='sm'
            onClick={smartPreload}
            disabled={isLoading}
          >
            <Zap className='h-4 w-4' />
            Smart Preload
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value='overview'>Overview</TabsTrigger>
          <TabsTrigger value='patterns'>Navigation Patterns</TabsTrigger>
          <TabsTrigger value='predictions'>Predictions</TabsTrigger>
          <TabsTrigger value='controls'>Controls</TabsTrigger>
        </TabsList>

        <TabsContent value='overview' className='space-y-4'>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
            <Card>
              <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                <CardTitle className='text-sm font-medium'>
                  Navigation Patterns
                </CardTitle>
                <BarChart3 className='h-4 w-4 text-muted-foreground' />
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>
                  {stats?.totalPatterns || 0}
                </div>
                <p className='text-xs text-muted-foreground'>
                  Learned patterns
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                <CardTitle className='text-sm font-medium'>
                  Frequent Paths
                </CardTitle>
                <TrendingUp className='h-4 w-4 text-muted-foreground' />
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>
                  {stats?.frequentPaths?.length || 0}
                </div>
                <p className='text-xs text-muted-foreground'>
                  High-traffic routes
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                <CardTitle className='text-sm font-medium'>
                  Recommendations
                </CardTitle>
                <Clock className='h-4 w-4 text-muted-foreground' />
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>
                  {recommendations?.length || 0}
                </div>
                <p className='text-xs text-muted-foreground'>
                  Current suggestions
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Current Recommendations</CardTitle>
              <CardDescription>
                Paths recommended for preloading based on your patterns
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recommendationsLoading ? (
                <div className='flex items-center space-x-2'>
                  <Loader2 className='h-4 w-4 animate-spin' />
                  <span>Loading recommendations...</span>
                </div>
              ) : recommendations.length > 0 ? (
                <div className='flex flex-wrap gap-2'>
                  {recommendations.map((path, index) => (
                    <Badge key={index} variant='secondary'>
                      {path}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className='text-muted-foreground'>
                  No recommendations available yet. Navigate around to build
                  patterns.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='patterns' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>Frequent Navigation Paths</CardTitle>
              <CardDescription>
                Most frequently accessed paths in your application
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stats?.frequentPaths && stats.frequentPaths.length > 0 ? (
                <div className='space-y-2'>
                  {stats.frequentPaths.map((path, index) => (
                    <div
                      key={index}
                      className='flex items-center justify-between'
                    >
                      <span className='font-mono text-sm'>{path}</span>
                      <Badge variant='outline'>Frequent</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className='text-muted-foreground'>
                  No frequent patterns detected yet. Continue using the
                  application to build patterns.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Time-Based Recommendations</CardTitle>
              <CardDescription>
                Paths typically accessed at this time of day
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stats?.timeBasedRecommendations &&
              stats.timeBasedRecommendations.length > 0 ? (
                <div className='flex flex-wrap gap-2'>
                  {stats.timeBasedRecommendations.map((path, index) => (
                    <Badge key={index} variant='secondary'>
                      {path}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className='text-muted-foreground'>
                  No time-based patterns available yet.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='predictions' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>Navigation Predictions</CardTitle>
              <CardDescription>
                Predicted next paths based on current navigation patterns
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stats?.predictions && stats.predictions.length > 0 ? (
                <div className='space-y-3'>
                  {stats.predictions.map((prediction, index) => (
                    <div key={index} className='space-y-2'>
                      <div className='flex items-center justify-between'>
                        <span className='font-mono text-sm'>
                          {prediction.path}
                        </span>
                        <Badge
                          variant={
                            prediction.probability > 0.7
                              ? 'default'
                              : 'secondary'
                          }
                        >
                          {Math.round(prediction.probability * 100)}%
                        </Badge>
                      </div>
                      <Progress
                        value={prediction.probability * 100}
                        className='h-2'
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className='text-muted-foreground'>
                  No predictions available yet. Navigate between pages to build
                  prediction models.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='controls' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>Preloading Controls</CardTitle>
              <CardDescription>
                Manage cache preloading behavior and data
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='flex flex-col space-y-2'>
                <Button
                  onClick={preloadCriticalData}
                  disabled={isLoading}
                  className='w-full'
                >
                  {isLoading ? (
                    <Loader2 className='h-4 w-4 animate-spin mr-2' />
                  ) : (
                    <Zap className='h-4 w-4 mr-2' />
                  )}
                  Preload Critical Data
                </Button>
                <p className='text-xs text-muted-foreground'>
                  Immediately cache essential dashboard data and API endpoints
                </p>
              </div>

              <div className='flex flex-col space-y-2'>
                <Button
                  onClick={smartPreload}
                  disabled={isLoading}
                  variant='outline'
                  className='w-full'
                >
                  {isLoading ? (
                    <Loader2 className='h-4 w-4 animate-spin mr-2' />
                  ) : (
                    <TrendingUp className='h-4 w-4 mr-2' />
                  )}
                  Smart Preload
                </Button>
                <p className='text-xs text-muted-foreground'>
                  Preload paths based on navigation patterns and predictions
                </p>
              </div>

              <div className='flex flex-col space-y-2'>
                <Button
                  onClick={refreshRecommendations}
                  disabled={recommendationsLoading}
                  variant='outline'
                  className='w-full'
                >
                  {recommendationsLoading ? (
                    <Loader2 className='h-4 w-4 animate-spin mr-2' />
                  ) : (
                    <RefreshCw className='h-4 w-4 mr-2' />
                  )}
                  Refresh Recommendations
                </Button>
                <p className='text-xs text-muted-foreground'>
                  Update navigation recommendations based on current patterns
                </p>
              </div>

              <div className='border-t pt-4'>
                <div className='flex flex-col space-y-2'>
                  <Button
                    onClick={clearPatterns}
                    disabled={isLoading}
                    variant='destructive'
                    className='w-full'
                  >
                    {isLoading ? (
                      <Loader2 className='h-4 w-4 animate-spin mr-2' />
                    ) : (
                      <Trash2 className='h-4 w-4 mr-2' />
                    )}
                    Clear Navigation Patterns
                  </Button>
                  <p className='text-xs text-muted-foreground'>
                    Reset all learned navigation patterns and start fresh
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
