'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { IconChartBar, IconRefresh } from '@tabler/icons-react';

interface SummaryStats {
  totalSummaries: number;
  averageActivities: number;
  totalTokensUsed: number;
  averageTokensPerSummary: number;
  modelBreakdown: Record<string, number>;
  dailyTrends: Array<{
    date: string;
    count: number;
    tokensUsed: number;
  }>;
  topInsights: string[];
  activityDistribution: Record<string, number>;
}

interface SummaryStatisticsProps {
  className?: string;
  timeRange?: '7d' | '30d' | '90d';
}

export function SummaryStatistics({
  className,
  timeRange = '30d',
}: SummaryStatisticsProps) {
  const [stats, setStats] = useState<SummaryStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, [timeRange]);

  const fetchStats = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        `/api/ai-summary/stats?timeRange=${timeRange}`,
        {
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch statistics`);
      }

      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching summary statistics:', error);
      setError(
        error instanceof Error ? error.message : 'Failed to load statistics'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  /**
   * Formats a date string into a short localized date format.
   */
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className='pb-3'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <IconChartBar className='size-5 text-white' />
              <CardTitle className='text-lg text-white'>
                Summary Statistics
              </CardTitle>
            </div>
            <Skeleton className='h-6 w-6' />
          </div>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className='p-4 bg-slate-800/50 rounded-lg'>
                <Skeleton className='h-4 w-16 mb-2' />
                <Skeleton className='h-6 w-12' />
              </div>
            ))}
          </div>
          <Skeleton className='h-32 w-full' />
        </CardContent>
      </Card>
    );
  }

  if (error || !stats) {
    return (
      <Card className={className}>
        <CardHeader className='pb-3'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <IconChartBar className='size-5 text-white' />
              <CardTitle className='text-lg text-white'>
                Summary Statistics
              </CardTitle>
            </div>
            <button
              onClick={fetchStats}
              className='text-gray-400 hover:text-white transition-colors'
            >
              <IconRefresh className='size-5' />
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <div className='text-center py-8'>
            <IconChartBar className='size-12 text-red-500 mx-auto mb-4' />
            <h4 className='text-lg font-medium text-white mb-2'>
              Failed to Load Statistics
            </h4>
            <p className='text-gray-400'>
              {error || 'No statistics available'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className='pb-3'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <IconChartBar className='size-5 text-white' />
            <CardTitle className='text-lg text-white'>
              Summary Statistics
            </CardTitle>
          </div>
          <button
            onClick={fetchStats}
            className='text-gray-400 hover:text-white transition-colors'
          >
            <IconRefresh className='size-5' />
          </button>
        </div>
      </CardHeader>

      <CardContent className='space-y-6'>
        {/* Activity Distribution */}
        {stats.activityDistribution &&
          Object.keys(stats.activityDistribution).length > 0 && (
            <div>
              <h3 className='text-lg font-semibold text-white mb-3'>
                Activity Distribution
              </h3>
              <div className='space-y-2'>
                {Object.entries(stats.activityDistribution)
                  .sort(([, a], [, b]) => b - a)
                  .map(([source, count]) => (
                    <div
                      key={source}
                      className='flex items-center justify-between p-3 bg-slate-800/50 rounded-lg'
                    >
                      <span className='text-gray-300 text-sm capitalize'>
                        {source}
                      </span>
                      <Badge variant='secondary'>{count} activities</Badge>
                    </div>
                  ))}
              </div>
            </div>
          )}

        {/* Top Insights */}
        {stats.topInsights && stats.topInsights.length > 0 && (
          <div>
            <h3 className='text-lg font-semibold text-white mb-3'>
              Common Insights
            </h3>
            <div className='space-y-2'>
              {stats.topInsights.slice(0, 5).map((insight, index) => (
                <div key={index} className='p-3 bg-slate-800/50 rounded-lg'>
                  <p className='text-gray-300 text-sm'>{insight}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
