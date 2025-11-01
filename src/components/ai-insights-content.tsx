'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  IconSparkles,
  IconTrendingUp,
  IconBrain,
  IconTarget,
  IconChartBar,
  IconRefresh,
  IconDownload,
  IconCalendar,
  IconUsers,
  IconGitCommit,
  IconClock,
  IconArrowUp,
  IconArrowDown,
  IconMinus,
} from '@tabler/icons-react';

interface AIInsight {
  id: string;
  type:
    | 'productivity'
    | 'collaboration'
    | 'code_quality'
    | 'trend'
    | 'recommendation';
  title: string;
  description: string;
  confidence: number;
  impact: 'high' | 'medium' | 'low';
  category: string;
  data: any;
  generatedAt: string;
  timeRange: {
    start: string;
    end: string;
  };
}

interface ProductivityMetrics {
  commitFrequency: {
    current: number;
    previous: number;
    trend: 'up' | 'down' | 'stable';
  };
  codeReviewTime: {
    average: number;
    trend: 'up' | 'down' | 'stable';
  };
  issueResolutionTime: {
    average: number;
    trend: 'up' | 'down' | 'stable';
  };
  collaborationScore: {
    score: number;
    trend: 'up' | 'down' | 'stable';
  };
}

/**
 * AI Insights Content Component
 *
 * This component displays comprehensive AI-powered insights regarding team productivity, collaboration patterns, code quality trends, and actionable recommendations. It manages state for insights and metrics, handles user interactions for filtering and generating insights, and fetches data from APIs while providing fallback mechanisms. The component also includes loading states and error handling to enhance user experience.
 *
 * @returns {JSX.Element} The rendered AI Insights Content component.
 */
export function AIInsightsContent() {
  const { toast } = useToast();
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [metrics, setMetrics] = useState<ProductivityMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Optimized event handlers using useCallback
  const handleTimeRangeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setTimeRange(e.target.value as '7d' | '30d' | '90d');
    },
    []
  );

  const handleCategorySelect = useCallback((category: string) => {
    setSelectedCategory(category);
  }, []);

  const handleTrackEvent = useCallback((eventName: string, data: any) => {
    // track function should be passed as prop or from context
    console.log('Track event:', eventName, data);
  }, []);

  useEffect(() => {
    fetchInsights();
    fetchMetrics();
  }, [timeRange]);

  const fetchInsights = async () => {
    try {
      setIsLoading(true);

      const response = await fetch(`/api/ai-insights?timeRange=${timeRange}`);

      if (response.ok) {
        const data = await response.json();
        setInsights(data.insights || []);
        return;
      }

      // Fallback to mock insights if API fails
      const mockInsights: AIInsight[] = [
        {
          id: '1',
          type: 'productivity',
          title: 'Peak Productivity Hours Identified',
          description:
            'Your team shows highest commit activity between 10 AM - 12 PM and 2 PM - 4 PM. Consider scheduling important meetings outside these windows.',
          confidence: 0.87,
          impact: 'high',
          category: 'Productivity',
          data: { peakHours: ['10-12', '14-16'], commitCount: 45 },
          generatedAt: new Date().toISOString(),
          timeRange: {
            start: new Date(
              Date.now() - 30 * 24 * 60 * 60 * 1000
            ).toISOString(),
            end: new Date().toISOString(),
          },
        },
        {
          id: '2',
          type: 'collaboration',
          title: 'Code Review Bottleneck Detected',
          description:
            'Pull requests are taking 40% longer to review than industry average. Consider implementing automated code quality checks.',
          confidence: 0.92,
          impact: 'high',
          category: 'Collaboration',
          data: { avgReviewTime: 2.3, industryAvg: 1.6 },
          generatedAt: new Date().toISOString(),
          timeRange: {
            start: new Date(
              Date.now() - 30 * 24 * 60 * 60 * 1000
            ).toISOString(),
            end: new Date().toISOString(),
          },
        },
        {
          id: '3',
          type: 'trend',
          title: 'Increasing Commit Frequency',
          description:
            'Daily commit frequency has increased by 25% over the past month, indicating improved development velocity.',
          confidence: 0.78,
          impact: 'medium',
          category: 'Trends',
          data: { increase: 25, period: '30d' },
          generatedAt: new Date().toISOString(),
          timeRange: {
            start: new Date(
              Date.now() - 30 * 24 * 60 * 60 * 1000
            ).toISOString(),
            end: new Date().toISOString(),
          },
        },
        {
          id: '4',
          type: 'recommendation',
          title: 'Optimize Repository Structure',
          description:
            'Large files and deep directory structures detected. Consider refactoring to improve build times and developer experience.',
          confidence: 0.65,
          impact: 'medium',
          category: 'Code Quality',
          data: { largeFiles: 12, maxDepth: 8 },
          generatedAt: new Date().toISOString(),
          timeRange: {
            start: new Date(
              Date.now() - 30 * 24 * 60 * 60 * 1000
            ).toISOString(),
            end: new Date().toISOString(),
          },
        },
        {
          id: '5',
          type: 'collaboration',
          title: 'Cross-Team Communication Pattern',
          description:
            'Slack activity shows increased cross-functional collaboration, with 35% more messages between development and design teams.',
          confidence: 0.81,
          impact: 'medium',
          category: 'Collaboration',
          data: { crossTeamIncrease: 35, teams: ['dev', 'design'] },
          generatedAt: new Date().toISOString(),
          timeRange: {
            start: new Date(
              Date.now() - 30 * 24 * 60 * 60 * 1000
            ).toISOString(),
            end: new Date().toISOString(),
          },
        },
      ];

      setInsights(mockInsights);
    } catch (error) {
      console.error('Error fetching insights:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch AI insights',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMetrics = async () => {
    try {
      const response = await fetch(
        `/api/ai-insights/metrics?timeRange=${timeRange}`
      );

      if (response.ok) {
        const data = await response.json();
        setMetrics(data.metrics);
      } else {
        // Fallback to mock metrics
        const mockMetrics: ProductivityMetrics = {
          commitFrequency: {
            current: 4.2,
            previous: 3.8,
            trend: 'up',
          },
          codeReviewTime: {
            average: 2.3,
            trend: 'down',
          },
          issueResolutionTime: {
            average: 1.8,
            trend: 'down',
          },
          collaborationScore: {
            score: 78,
            trend: 'up',
          },
        };
        setMetrics(mockMetrics);
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
      // Set empty metrics on error
      setMetrics(null);
    }
  };

  const generateNewInsights = async () => {
    try {
      setIsGenerating(true);

      const response = await fetch('/api/ai-insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          timeRange,
          forceRegenerate: true,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setInsights(data.insights || []);

        toast({
          title: 'Insights Generated',
          description: `Generated ${data.insights?.length || 0} new insights from ${data.activityCount} activities`,
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate insights');
      }
    } catch (error) {
      toast({
        title: 'Generation Failed',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to generate new insights',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const exportInsights = () => {
    const exportData = {
      insights,
      metrics,
      timeRange,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-insights-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'medium':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'low':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'productivity':
        return <IconTrendingUp className='size-4' />;
      case 'collaboration':
        return <IconUsers className='size-4' />;
      case 'code_quality':
        return <IconGitCommit className='size-4' />;
      case 'trend':
        return <IconChartBar className='size-4' />;
      case 'recommendation':
        return <IconTarget className='size-4' />;
      default:
        return <IconBrain className='size-4' />;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <IconArrowUp className='size-4 text-green-500' />;
      case 'down':
        return <IconArrowDown className='size-4 text-red-500' />;
      case 'stable':
        return <IconMinus className='size-4 text-gray-500' />;
      default:
        return <IconMinus className='size-4 text-gray-500' />;
    }
  };

  const filteredInsights =
    selectedCategory === 'all'
      ? insights
      : insights.filter(
          insight =>
            insight.category.toLowerCase() === selectedCategory.toLowerCase()
        );

  const categories = [
    'all',
    ...Array.from(new Set(insights.map(i => i.category))),
  ];

  if (isLoading) {
    return (
      <div className='flex flex-1 flex-col gap-4 p-4'>
        <div className='flex items-center justify-between'>
          <div>
            <Skeleton className='h-8 w-48 mb-2' />
            <Skeleton className='h-4 w-96' />
          </div>
          <div className='flex gap-2'>
            <Skeleton className='h-10 w-32' />
            <Skeleton className='h-10 w-24' />
          </div>
        </div>

        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className='h-4 w-24' />
                <Skeleton className='h-8 w-16' />
              </CardHeader>
            </Card>
          ))}
        </div>

        <div className='space-y-4'>
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className='h-6 w-64' />
                <Skeleton className='h-4 w-full' />
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className='flex flex-1 flex-col gap-4 p-4'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight flex items-center gap-2'>
            <IconSparkles className='size-8 text-blue-500' />
            AI Insights
          </h1>
          <p className='text-muted-foreground'>
            Intelligent analysis of your team's productivity and collaboration
            patterns
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <select
            value={timeRange}
            onChange={handleTimeRangeChange}
            className='px-3 py-2 border rounded-md text-sm'
          >
            <option value='7d'>Last 7 days</option>
            <option value='30d'>Last 30 days</option>
            <option value='90d'>Last 90 days</option>
          </select>
          <Button
            onClick={generateNewInsights}
            disabled={isGenerating}
            className='flex items-center gap-2'
          >
            {isGenerating ? (
              <IconRefresh className='size-4 animate-spin' />
            ) : (
              <IconBrain className='size-4' />
            )}
            {isGenerating ? 'Generating...' : 'Generate Insights'}
          </Button>
          <Button variant='outline' onClick={exportInsights}>
            <IconDownload className='size-4 mr-2' />
            Export
          </Button>
        </div>
      </div>

      {/* Metrics Overview */}
      {metrics && (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                Commit Frequency
              </CardTitle>
              <IconGitCommit className='size-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold flex items-center gap-2'>
                {metrics.commitFrequency.current}/day
                {getTrendIcon(metrics.commitFrequency.trend)}
              </div>
              <p className='text-xs text-muted-foreground'>
                {metrics.commitFrequency.trend === 'up' ? '+' : ''}
                {(
                  ((metrics.commitFrequency.current -
                    metrics.commitFrequency.previous) /
                    metrics.commitFrequency.previous) *
                  100
                ).toFixed(1)}
                % from last period
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                Code Review Time
              </CardTitle>
              <IconClock className='size-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold flex items-center gap-2'>
                {metrics.codeReviewTime.average}d
                {getTrendIcon(metrics.codeReviewTime.trend)}
              </div>
              <p className='text-xs text-muted-foreground'>
                Average time to review
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                Issue Resolution
              </CardTitle>
              <IconTarget className='size-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold flex items-center gap-2'>
                {metrics.issueResolutionTime.average}d
                {getTrendIcon(metrics.issueResolutionTime.trend)}
              </div>
              <p className='text-xs text-muted-foreground'>
                Average resolution time
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                Collaboration Score
              </CardTitle>
              <IconUsers className='size-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold flex items-center gap-2'>
                {metrics.collaborationScore.score}%
                {getTrendIcon(metrics.collaborationScore.trend)}
              </div>
              <p className='text-xs text-muted-foreground'>
                Team collaboration index
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Insights Content */}
      <Tabs defaultValue='insights' className='space-y-4'>
        <TabsList>
          <TabsTrigger value='insights'>All Insights</TabsTrigger>
          <TabsTrigger value='productivity'>Productivity</TabsTrigger>
          <TabsTrigger value='collaboration'>Collaboration</TabsTrigger>
          <TabsTrigger value='trends'>Trends</TabsTrigger>
        </TabsList>

        <TabsContent value='insights' className='space-y-4'>
          {/* Category Filter */}
          <div className='flex items-center gap-2'>
            <span className='text-sm font-medium'>Filter by category:</span>
            {categories.map(category => (
              <Button
                key={category}
                variant={selectedCategory === category ? 'default' : 'outline'}
                size='sm'
                onClick={() => handleCategorySelect(category)}
              >
                {category === 'all' ? 'All' : category}
              </Button>
            ))}
          </div>

          {/* Insights List */}
          <div className='space-y-4'>
            {filteredInsights.map(insight => (
              <Card key={insight.id} className='border-l-4 border-l-blue-500'>
                <CardHeader>
                  <div className='flex items-start justify-between'>
                    <div className='flex items-center gap-2'>
                      {getTypeIcon(insight.type)}
                      <div>
                        <CardTitle className='text-lg'>
                          {insight.title}
                        </CardTitle>
                        <CardDescription className='mt-1'>
                          {insight.description}
                        </CardDescription>
                      </div>
                    </div>
                    <div className='flex items-center gap-2'>
                      <Badge
                        variant='outline'
                        className={getImpactColor(insight.impact)}
                      >
                        {insight.impact} impact
                      </Badge>
                      <Badge variant='secondary'>
                        {Math.round(insight.confidence * 100)}% confidence
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className='flex items-center justify-between text-sm text-muted-foreground'>
                    <div className='flex items-center gap-4'>
                      <span className='flex items-center gap-1'>
                        <IconCalendar className='size-3' />
                        Generated{' '}
                        {new Date(insight.generatedAt).toLocaleDateString()}
                      </span>
                      <Badge variant='outline' className='text-xs'>
                        {insight.category}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredInsights.length === 0 && (
            <Card>
              <CardContent className='flex items-center justify-center py-8'>
                <div className='text-center'>
                  <IconBrain className='size-12 text-muted-foreground mx-auto mb-4' />
                  <h3 className='text-lg font-medium'>No Insights Available</h3>
                  <p className='text-muted-foreground mb-4'>
                    {selectedCategory === 'all'
                      ? 'No AI insights have been generated yet.'
                      : `No insights found for the ${selectedCategory} category.`}
                  </p>
                  <Button onClick={generateNewInsights} disabled={isGenerating}>
                    <IconBrain className='size-4 mr-2' />
                    Generate Insights
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value='productivity'>
          <div className='space-y-4'>
            {insights
              .filter(i => i.type === 'productivity')
              .map(insight => (
                <Card key={insight.id}>
                  <CardHeader>
                    <CardTitle className='flex items-center gap-2'>
                      <IconTrendingUp className='size-5' />
                      {insight.title}
                    </CardTitle>
                    <CardDescription>{insight.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
          </div>
        </TabsContent>

        <TabsContent value='collaboration'>
          <div className='space-y-4'>
            {insights
              .filter(i => i.type === 'collaboration')
              .map(insight => (
                <Card key={insight.id}>
                  <CardHeader>
                    <CardTitle className='flex items-center gap-2'>
                      <IconUsers className='size-5' />
                      {insight.title}
                    </CardTitle>
                    <CardDescription>{insight.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
          </div>
        </TabsContent>

        <TabsContent value='trends'>
          <div className='space-y-4'>
            {insights
              .filter(i => i.type === 'trend')
              .map(insight => (
                <Card key={insight.id}>
                  <CardHeader>
                    <CardTitle className='flex items-center gap-2'>
                      <IconChartBar className='size-5' />
                      {insight.title}
                    </CardTitle>
                    <CardDescription>{insight.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
