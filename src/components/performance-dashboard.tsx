'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  IconActivity,
  IconDatabase,
  IconClock,
  IconTrendingUp,
  IconTrendingDown,
  IconRefresh,
  IconAlertTriangle,
} from '@tabler/icons-react';

interface PerformanceMetrics {
  renderTime: number;
  memoryUsage: number;
  itemCount: number;
  fps: number;
  scrollPerformance: {
    scrollEvents: number;
    averageScrollTime: number;
    maxScrollTime: number;
    scrollJank: number;
  };
  lastUpdate: Date;
}

interface PerformanceDashboardProps {
  metrics: PerformanceMetrics;
  onRefresh?: () => void;
}

/**
 * Renders a performance dashboard displaying various performance metrics and alerts.
 *
 * The component maintains historical data of performance metrics, updates alerts based on the current metrics,
 * and calculates a performance grade. It also provides visual indicators for render time, memory usage, FPS,
 * and scroll performance, along with trend icons for comparative analysis against previous metrics.
 *
 * @param metrics - An object containing performance metrics including renderTime, memoryUsage, fps, and scrollPerformance.
 * @param onRefresh - A callback function to refresh the metrics.
 * @returns A JSX element representing the performance dashboard.
 */
export function PerformanceDashboard({
  metrics,
  onRefresh,
}: PerformanceDashboardProps) {
  const [historicalData, setHistoricalData] = useState<PerformanceMetrics[]>(
    []
  );
  const [alerts, setAlerts] = useState<string[]>([]);

  useEffect(() => {
    setHistoricalData(prev => [...prev.slice(-9), metrics]);
  }, [metrics]);

  useEffect(() => {
    const newAlerts: string[] = [];

    if (metrics.renderTime > 100) {
      newAlerts.push('High render time detected');
    }

    if (metrics.memoryUsage > 100) {
      newAlerts.push('High memory usage detected');
    }

    if (metrics.fps < 30) {
      newAlerts.push('Low FPS detected');
    }

    if (metrics.scrollPerformance.averageScrollTime > 16) {
      newAlerts.push('Slow scroll performance');
    }

    if (
      metrics.scrollPerformance.scrollJank >
      metrics.scrollPerformance.scrollEvents * 0.1
    ) {
      newAlerts.push('High scroll jank detected');
    }

    if (metrics.scrollPerformance.maxScrollTime > 50) {
      newAlerts.push('Maximum scroll time exceeds threshold');
    }

    setAlerts(newAlerts);
  }, [metrics]);

  const getPerformanceGrade = () => {
    let score = 100;

    if (metrics.renderTime > 50) score -= 20;
    if (metrics.memoryUsage > 50) score -= 20;
    if (metrics.fps < 60) score -= 20;
    if (metrics.scrollPerformance.averageScrollTime > 16) score -= 20;

    if (score >= 90)
      return { grade: 'A', color: 'text-green-600', bg: 'bg-green-50' };
    if (score >= 80)
      return { grade: 'B', color: 'text-blue-600', bg: 'bg-blue-50' };
    if (score >= 70)
      return { grade: 'C', color: 'text-yellow-600', bg: 'bg-yellow-50' };
    if (score >= 60)
      return { grade: 'D', color: 'text-orange-600', bg: 'bg-orange-50' };
    return { grade: 'F', color: 'text-red-600', bg: 'bg-red-50' };
  };

  const performanceGrade = getPerformanceGrade();

  const getTrend = (current: number, previous: number) => {
    if (previous === 0) return 'neutral';
    const change = ((current - previous) / previous) * 100;
    return change > 5 ? 'up' : change < -5 ? 'down' : 'neutral';
  };

  const renderTrendIcon = (trend: 'up' | 'down' | 'neutral') => {
    switch (trend) {
      case 'up':
        return <IconTrendingUp className='size-4 text-red-500' />;
      case 'down':
        return <IconTrendingDown className='size-4 text-green-500' />;
      default:
        return <div className='size-4' />;
    }
  };

  const previousMetrics = historicalData[historicalData.length - 2];

  return (
    <div className='space-y-4'>
      {/* Performance Grade */}
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <CardTitle className='text-lg'>Performance Grade</CardTitle>
            {onRefresh && (
              <Button variant='outline' size='sm' onClick={onRefresh}>
                <IconRefresh className='size-4 mr-2' />
                Refresh
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className='p-4'>
          <div className={`${performanceGrade.bg} rounded-lg p-4 text-center`}>
            <div
              className={`text-4xl font-bold ${performanceGrade.color} mb-2`}
            >
              {performanceGrade.grade}
            </div>
            <p className={`text-sm ${performanceGrade.color}`}>
              Overall Performance Score
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-muted-foreground'>
                  Render Time
                </p>
                <p className='text-2xl font-bold'>
                  {metrics.renderTime.toFixed(1)}ms
                </p>
              </div>
              <IconClock className='size-8 text-blue-500' />
            </div>
            {previousMetrics && (
              <div className='flex items-center gap-1 mt-2'>
                {renderTrendIcon(
                  getTrend(metrics.renderTime, previousMetrics.renderTime)
                )}
                <span className='text-xs text-muted-foreground'>
                  {Math.abs(
                    ((metrics.renderTime - previousMetrics.renderTime) /
                      previousMetrics.renderTime) *
                      100
                  ).toFixed(1)}
                  %
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-muted-foreground'>
                  Memory Usage
                </p>
                <p className='text-2xl font-bold'>
                  {metrics.memoryUsage.toFixed(1)}MB
                </p>
              </div>
              <IconDatabase className='size-8 text-purple-500' />
            </div>
            {previousMetrics && (
              <div className='flex items-center gap-1 mt-2'>
                {renderTrendIcon(
                  getTrend(metrics.memoryUsage, previousMetrics.memoryUsage)
                )}
                <span className='text-xs text-muted-foreground'>
                  {Math.abs(
                    ((metrics.memoryUsage - previousMetrics.memoryUsage) /
                      previousMetrics.memoryUsage) *
                      100
                  ).toFixed(1)}
                  %
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-muted-foreground'>FPS</p>
                <p className='text-2xl font-bold'>{metrics.fps}</p>
              </div>
              <IconActivity className='size-8 text-green-500' />
            </div>
            {previousMetrics && (
              <div className='flex items-center gap-1 mt-2'>
                {renderTrendIcon(getTrend(metrics.fps, previousMetrics.fps))}
                <span className='text-xs text-muted-foreground'>
                  {Math.abs(
                    ((metrics.fps - previousMetrics.fps) /
                      previousMetrics.fps) *
                      100
                  ).toFixed(1)}
                  %
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-muted-foreground'>
                  Scroll Performance
                </p>
                <p className='text-2xl font-bold'>
                  {metrics.scrollPerformance.averageScrollTime.toFixed(1)}ms
                </p>
              </div>
              <IconActivity className='size-8 text-orange-500' />
            </div>
            <div className='mt-2 space-y-1'>
              <div className='flex justify-between text-xs text-muted-foreground'>
                <span>Max:</span>
                <span>
                  {metrics.scrollPerformance.maxScrollTime.toFixed(1)}ms
                </span>
              </div>
              <div className='flex justify-between text-xs text-muted-foreground'>
                <span>Jank:</span>
                <span
                  className={
                    metrics.scrollPerformance.scrollJank >
                    metrics.scrollPerformance.scrollEvents * 0.1
                      ? 'text-red-600'
                      : 'text-green-600'
                  }
                >
                  {metrics.scrollPerformance.scrollJank}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Progress Bars */}
      <Card>
        <CardHeader>
          <CardTitle className='text-lg'>Performance Indicators</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div>
            <div className='flex justify-between text-sm mb-2'>
              <span>Render Performance</span>
              <span>
                {metrics.renderTime < 50
                  ? 'Excellent'
                  : metrics.renderTime < 100
                    ? 'Good'
                    : 'Needs Improvement'}
              </span>
            </div>
            <Progress
              value={Math.max(0, 100 - metrics.renderTime)}
              className='h-2'
            />
          </div>

          <div>
            <div className='flex justify-between text-sm mb-2'>
              <span>Memory Efficiency</span>
              <span>
                {metrics.memoryUsage < 50
                  ? 'Excellent'
                  : metrics.memoryUsage < 100
                    ? 'Good'
                    : 'Needs Improvement'}
              </span>
            </div>
            <Progress
              value={Math.max(0, 100 - metrics.memoryUsage)}
              className='h-2'
            />
          </div>

          <div>
            <div className='flex justify-between text-sm mb-2'>
              <span>Frame Rate</span>
              <span>
                {metrics.fps >= 60
                  ? 'Excellent'
                  : metrics.fps >= 30
                    ? 'Good'
                    : 'Needs Improvement'}
              </span>
            </div>
            <Progress value={(metrics.fps / 60) * 100} className='h-2' />
          </div>

          <div>
            <div className='flex justify-between text-sm mb-2'>
              <span>Scroll Performance</span>
              <span>
                {metrics.scrollPerformance.averageScrollTime <= 8
                  ? 'Excellent'
                  : metrics.scrollPerformance.averageScrollTime <= 16
                    ? 'Good'
                    : 'Needs Improvement'}
              </span>
            </div>
            <Progress
              value={Math.max(
                0,
                100 - (metrics.scrollPerformance.averageScrollTime / 16) * 100
              )}
              className='h-2'
            />
          </div>
        </CardContent>
      </Card>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className='text-lg flex items-center gap-2'>
              <IconAlertTriangle className='size-5 text-orange-500' />
              Performance Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='space-y-2'>
              {alerts.map((alert, index) => (
                <div
                  key={index}
                  className='flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg'
                >
                  <IconAlertTriangle className='size-4 text-orange-500' />
                  <span className='text-sm text-orange-700'>{alert}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Historical Chart Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className='text-lg'>Performance Trends</CardTitle>
          <CardDescription>Last 10 measurements</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='h-32 bg-muted/50 rounded-lg flex items-center justify-center'>
            <p className='text-muted-foreground text-sm'>
              Performance chart visualization would go here
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Last Update */}
      <div className='text-center text-sm text-muted-foreground'>
        Last updated: {metrics.lastUpdate.toLocaleTimeString()}
      </div>
    </div>
  );
}
