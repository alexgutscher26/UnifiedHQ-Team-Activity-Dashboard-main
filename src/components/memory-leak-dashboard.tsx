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
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  MemoryStick,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Download,
  Settings,
  TrendingUp,
  Clock,
  Bug,
  Zap,
} from 'lucide-react';
import {
  createClientMemoryLeakDetector,
  startClientRuntimeMonitoring,
  clientMemoryUtils,
  type LeakReport,
  type RuntimeLeakReport,
  type ProjectLeakReport,
  type LeakSeverity,
  type LeakType,
} from '@/lib/memory-leak-detection/client';
import type {
  LeakReport,
  RuntimeLeakReport,
  ProjectLeakReport,
  LeakSeverity,
  LeakType,
} from '@/lib/memory-leak-detection/types';

interface MemoryLeakDashboardProps {
  className?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface DashboardState {
  projectReport: ProjectLeakReport | null;
  runtimeReport: RuntimeLeakReport | null;
  isScanning: boolean;
  isMonitoring: boolean;
  lastScanTime: Date | null;
  scanHistory: Array<{
    timestamp: Date;
    totalLeaks: number;
    criticalCount: number;
  }>;
}

const SEVERITY_COLORS: Record<LeakSeverity, string> = {
  critical: 'text-red-600 bg-red-50 border-red-200',
  high: 'text-orange-600 bg-orange-50 border-orange-200',
  medium: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  low: 'text-blue-600 bg-blue-50 border-blue-200',
};

const LEAK_TYPE_ICONS: Record<LeakType, React.ReactNode> = {
  'missing-useeffect-cleanup': <Bug className='h-4 w-4' />,
  'uncleaned-event-listener': <Zap className='h-4 w-4' />,
  'uncleaned-interval': <Clock className='h-4 w-4' />,
  'uncleaned-timeout': <Clock className='h-4 w-4' />,
  'uncleaned-subscription': <TrendingUp className='h-4 w-4' />,
  'unclosed-eventsource': <TrendingUp className='h-4 w-4' />,
  'unclosed-websocket': <TrendingUp className='h-4 w-4' />,
  'memory-accumulation': <MemoryStick className='h-4 w-4' />,
  'circular-reference': <RefreshCw className='h-4 w-4' />,
};

export function MemoryLeakDashboard({
  className = '',
  autoRefresh = true,
  refreshInterval = 30000,
}: MemoryLeakDashboardProps) {
  const [state, setState] = useState<DashboardState>({
    projectReport: null,
    runtimeReport: null,
    isScanning: false,
    isMonitoring: false,
    lastScanTime: null,
    scanHistory: [],
  });

  const [selectedSeverity, setSelectedSeverity] = useState<
    LeakSeverity | 'all'
  >('all');
  const [selectedType, setSelectedType] = useState<LeakType | 'all'>('all');
  const [monitoringCleanup, setMonitoringCleanup] = useState<
    (() => void) | null
  >(null);

  // Scan project for memory leaks
  const scanProject = useCallback(async () => {
    setState(prev => ({ ...prev, isScanning: true }));

    try {
      const detector = createClientMemoryLeakDetector();
      const projectReport = await detector.scanProject();
      const runtimeReport = await detector.analyzeRuntime();

      setState(prev => ({
        ...prev,
        projectReport,
        runtimeReport,
        lastScanTime: new Date(),
        scanHistory: [
          ...prev.scanHistory.slice(-9), // Keep last 10 entries
          {
            timestamp: new Date(),
            totalLeaks: projectReport.totalLeaks,
            criticalCount: projectReport.summary.criticalCount,
          },
        ],
      }));
    } catch (error) {
      console.error('Failed to scan project:', error);
    } finally {
      setState(prev => ({ ...prev, isScanning: false }));
    }
  }, []);

  // Start/stop runtime monitoring
  const toggleMonitoring = useCallback(() => {
    if (state.isMonitoring && monitoringCleanup) {
      monitoringCleanup();
      setMonitoringCleanup(null);
      setState(prev => ({ ...prev, isMonitoring: false }));
    } else {
      const cleanup = startClientRuntimeMonitoring({
        interval: 5000,
        memoryThreshold: 100,
        onLeak: report => {
          setState(prev => ({ ...prev, runtimeReport: report }));
        },
      });

      setMonitoringCleanup(() => cleanup);
      setState(prev => ({ ...prev, isMonitoring: true }));
    }
  }, [state.isMonitoring, monitoringCleanup]);

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(scanProject, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, scanProject]);

  // Initial scan
  useEffect(() => {
    scanProject();
  }, [scanProject]);

  // Cleanup monitoring on unmount
  useEffect(() => {
    return () => {
      if (monitoringCleanup) {
        monitoringCleanup();
      }
    };
  }, [monitoringCleanup]);

  // Filter reports based on selected criteria
  const filteredReports =
    state.projectReport?.reports.filter(report => {
      const severityMatch =
        selectedSeverity === 'all' || report.severity === selectedSeverity;
      const typeMatch = selectedType === 'all' || report.type === selectedType;
      return severityMatch && typeMatch;
    }) || [];

  // Export report data
  const exportReport = () => {
    if (!state.projectReport) return;

    const reportData = {
      ...state.projectReport,
      runtimeData: state.runtimeReport,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: 'application/json',
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `memory-leak-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatMemoryUsage = clientMemoryUtils.formatMemoryUsage;

  const getSeverityBadgeVariant = (severity: LeakSeverity) => {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'destructive';
      case 'medium':
        return 'secondary';
      case 'low':
        return 'outline';
      default:
        return 'outline';
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-2xl font-bold tracking-tight'>
            Memory Leak Dashboard
          </h2>
          <p className='text-muted-foreground'>
            Monitor and analyze memory leaks in your application
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={scanProject}
            disabled={state.isScanning}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${state.isScanning ? 'animate-spin' : ''}`}
            />
            {state.isScanning ? 'Scanning...' : 'Scan Now'}
          </Button>
          <Button
            variant={state.isMonitoring ? 'destructive' : 'default'}
            size='sm'
            onClick={toggleMonitoring}
          >
            <MemoryStick className='h-4 w-4 mr-2' />
            {state.isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}
          </Button>
          <Button variant='outline' size='sm' onClick={exportReport}>
            <Download className='h-4 w-4 mr-2' />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Total Issues</CardTitle>
            <Bug className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {state.projectReport?.totalLeaks || 0}
            </div>
            <p className='text-xs text-muted-foreground'>
              {state.lastScanTime
                ? `Last scan: ${state.lastScanTime.toLocaleTimeString()}`
                : 'No scan yet'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Critical Issues
            </CardTitle>
            <AlertTriangle className='h-4 w-4 text-red-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-red-600'>
              {state.projectReport?.summary.criticalCount || 0}
            </div>
            <p className='text-xs text-muted-foreground'>
              Require immediate attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Memory Usage</CardTitle>
            <MemoryStick className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>
              {state.runtimeReport
                ? formatMemoryUsage(state.runtimeReport.memoryUsage.current)
                : 'N/A'}
            </div>
            <p className='text-xs text-muted-foreground'>Current heap usage</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Fixable Issues
            </CardTitle>
            <CheckCircle className='h-4 w-4 text-green-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-green-600'>
              {state.projectReport?.summary.fixableCount || 0}
            </div>
            <p className='text-xs text-muted-foreground'>
              Can be automatically fixed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue='issues' className='space-y-4'>
        <TabsList>
          <TabsTrigger value='issues'>Issues</TabsTrigger>
          <TabsTrigger value='runtime'>Runtime Monitor</TabsTrigger>
          <TabsTrigger value='trends'>Trends</TabsTrigger>
          <TabsTrigger value='files'>Files</TabsTrigger>
        </TabsList>

        <TabsContent value='issues' className='space-y-4'>
          {/* Filters */}
          <div className='flex items-center gap-4'>
            <div className='flex items-center gap-2'>
              <label className='text-sm font-medium'>Severity:</label>
              <select
                value={selectedSeverity}
                onChange={e =>
                  setSelectedSeverity(e.target.value as LeakSeverity | 'all')
                }
                className='px-3 py-1 border rounded-md text-sm'
              >
                <option value='all'>All</option>
                <option value='critical'>Critical</option>
                <option value='high'>High</option>
                <option value='medium'>Medium</option>
                <option value='low'>Low</option>
              </select>
            </div>
            <div className='flex items-center gap-2'>
              <label className='text-sm font-medium'>Type:</label>
              <select
                value={selectedType}
                onChange={e =>
                  setSelectedType(e.target.value as LeakType | 'all')
                }
                className='px-3 py-1 border rounded-md text-sm'
              >
                <option value='all'>All</option>
                <option value='missing-useeffect-cleanup'>
                  useEffect Cleanup
                </option>
                <option value='uncleaned-event-listener'>
                  Event Listeners
                </option>
                <option value='uncleaned-interval'>Intervals</option>
                <option value='uncleaned-timeout'>Timeouts</option>
                <option value='uncleaned-subscription'>Subscriptions</option>
                <option value='unclosed-eventsource'>EventSource</option>
                <option value='unclosed-websocket'>WebSocket</option>
              </select>
            </div>
            <div className='text-sm text-muted-foreground'>
              Showing {filteredReports.length} of{' '}
              {state.projectReport?.totalLeaks || 0} issues
            </div>
          </div>

          {/* Issues List */}
          <ScrollArea className='h-[600px]'>
            <div className='space-y-3'>
              {filteredReports.map(report => (
                <Card
                  key={report.id}
                  className={`border-l-4 ${SEVERITY_COLORS[report.severity]}`}
                >
                  <CardHeader className='pb-3'>
                    <div className='flex items-start justify-between'>
                      <div className='flex items-center gap-2'>
                        {LEAK_TYPE_ICONS[report.type]}
                        <div>
                          <CardTitle className='text-sm'>
                            {report.description}
                          </CardTitle>
                          <CardDescription className='text-xs'>
                            {report.file}:{report.line}:{report.column}
                          </CardDescription>
                        </div>
                      </div>
                      <div className='flex items-center gap-2'>
                        <Badge
                          variant={getSeverityBadgeVariant(report.severity)}
                        >
                          {report.severity}
                        </Badge>
                        <Badge variant='outline' className='text-xs'>
                          {Math.round(report.confidence * 100)}%
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className='pt-0'>
                    <div className='space-y-2'>
                      <div className='bg-gray-50 p-2 rounded text-xs font-mono'>
                        {report.codeSnippet}
                      </div>
                      {report.suggestedFix && (
                        <div className='text-sm'>
                          <span className='font-medium text-green-600'>
                            Suggested Fix:
                          </span>
                          <p className='text-muted-foreground mt-1'>
                            {report.suggestedFix}
                          </p>
                        </div>
                      )}
                      {report.context.componentName && (
                        <div className='text-xs text-muted-foreground'>
                          Component: {report.context.componentName}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}

              {filteredReports.length === 0 && (
                <Card>
                  <CardContent className='flex items-center justify-center py-8'>
                    <div className='text-center'>
                      <CheckCircle className='h-12 w-12 text-green-500 mx-auto mb-4' />
                      <h3 className='text-lg font-medium'>No Issues Found</h3>
                      <p className='text-muted-foreground'>
                        {selectedSeverity !== 'all' || selectedType !== 'all'
                          ? 'No issues match the selected filters'
                          : 'Great! No memory leaks detected in your codebase'}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value='runtime' className='space-y-4'>
          {state.runtimeReport ? (
            <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
              {/* Memory Usage */}
              <Card>
                <CardHeader>
                  <CardTitle className='text-sm'>Memory Usage</CardTitle>
                </CardHeader>
                <CardContent className='space-y-4'>
                  <div className='space-y-2'>
                    <div className='flex justify-between text-sm'>
                      <span>Current Usage</span>
                      <span>
                        {formatMemoryUsage(
                          state.runtimeReport.memoryUsage.current
                        )}
                      </span>
                    </div>
                    <div className='flex justify-between text-sm'>
                      <span>Peak Usage</span>
                      <span>
                        {formatMemoryUsage(
                          state.runtimeReport.memoryUsage.peak
                        )}
                      </span>
                    </div>
                    <div className='flex justify-between text-sm'>
                      <span>Trend</span>
                      <Badge
                        variant={
                          state.runtimeReport.memoryUsage.trend === 'growing'
                            ? 'destructive'
                            : state.runtimeReport.memoryUsage.trend ===
                                'declining'
                              ? 'default'
                              : 'secondary'
                        }
                      >
                        {state.runtimeReport.memoryUsage.trend}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Active Resources */}
              <Card>
                <CardHeader>
                  <CardTitle className='text-sm'>Active Resources</CardTitle>
                </CardHeader>
                <CardContent className='space-y-3'>
                  <div className='flex justify-between text-sm'>
                    <span>Event Listeners</span>
                    <Badge
                      variant={
                        state.runtimeReport.activeResources.eventListeners > 0
                          ? 'destructive'
                          : 'secondary'
                      }
                    >
                      {state.runtimeReport.activeResources.eventListeners}
                    </Badge>
                  </div>
                  <div className='flex justify-between text-sm'>
                    <span>Intervals</span>
                    <Badge
                      variant={
                        state.runtimeReport.activeResources.intervals > 0
                          ? 'destructive'
                          : 'secondary'
                      }
                    >
                      {state.runtimeReport.activeResources.intervals}
                    </Badge>
                  </div>
                  <div className='flex justify-between text-sm'>
                    <span>Timeouts</span>
                    <Badge
                      variant={
                        state.runtimeReport.activeResources.timeouts > 0
                          ? 'destructive'
                          : 'secondary'
                      }
                    >
                      {state.runtimeReport.activeResources.timeouts}
                    </Badge>
                  </div>
                  <div className='flex justify-between text-sm'>
                    <span>Subscriptions</span>
                    <Badge
                      variant={
                        state.runtimeReport.activeResources.subscriptions > 0
                          ? 'destructive'
                          : 'secondary'
                      }
                    >
                      {state.runtimeReport.activeResources.subscriptions}
                    </Badge>
                  </div>
                  <div className='flex justify-between text-sm'>
                    <span>Connections</span>
                    <Badge
                      variant={
                        state.runtimeReport.activeResources.connections > 0
                          ? 'destructive'
                          : 'secondary'
                      }
                    >
                      {state.runtimeReport.activeResources.connections}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Recommendations */}
              {state.runtimeReport.recommendations.length > 0 && (
                <Card className='lg:col-span-2'>
                  <CardHeader>
                    <CardTitle className='text-sm'>Recommendations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className='space-y-2'>
                      {state.runtimeReport.recommendations.map((rec, index) => (
                        <Alert key={index}>
                          <AlertTriangle className='h-4 w-4' />
                          <AlertDescription>{rec}</AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className='flex items-center justify-center py-8'>
                <div className='text-center'>
                  <MemoryStick className='h-12 w-12 text-muted-foreground mx-auto mb-4' />
                  <h3 className='text-lg font-medium'>
                    Runtime Monitoring Disabled
                  </h3>
                  <p className='text-muted-foreground mb-4'>
                    Start monitoring to see real-time memory usage and resource
                    tracking
                  </p>
                  <Button onClick={toggleMonitoring}>
                    <MemoryStick className='h-4 w-4 mr-2' />
                    Start Monitoring
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value='trends' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle className='text-sm'>Scan History</CardTitle>
              <CardDescription>
                Memory leak detection trends over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              {state.scanHistory.length > 0 ? (
                <div className='space-y-3'>
                  {state.scanHistory
                    .slice(-10)
                    .reverse()
                    .map((scan, index) => (
                      <div
                        key={index}
                        className='flex items-center justify-between py-2 border-b last:border-b-0'
                      >
                        <div className='text-sm'>
                          {scan.timestamp.toLocaleString()}
                        </div>
                        <div className='flex items-center gap-2'>
                          <Badge variant='outline'>
                            {scan.totalLeaks} total
                          </Badge>
                          {scan.criticalCount > 0 && (
                            <Badge variant='destructive'>
                              {scan.criticalCount} critical
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className='text-center py-8 text-muted-foreground'>
                  No scan history available yet
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='files' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle className='text-sm'>Files with Issues</CardTitle>
              <CardDescription>
                Memory leak issues grouped by file
              </CardDescription>
            </CardHeader>
            <CardContent>
              {state.projectReport?.files.length ? (
                <ScrollArea className='h-[400px]'>
                  <div className='space-y-2'>
                    {state.projectReport.files.map(file => {
                      const fileReports = state.projectReport!.reports.filter(
                        r => r.file === file
                      );
                      const criticalCount = fileReports.filter(
                        r => r.severity === 'critical'
                      ).length;
                      const highCount = fileReports.filter(
                        r => r.severity === 'high'
                      ).length;

                      return (
                        <div
                          key={file}
                          className='flex items-center justify-between py-2 px-3 border rounded'
                        >
                          <div className='text-sm font-mono truncate flex-1 mr-4'>
                            {file}
                          </div>
                          <div className='flex items-center gap-2'>
                            <Badge variant='outline'>
                              {fileReports.length} issues
                            </Badge>
                            {criticalCount > 0 && (
                              <Badge variant='destructive'>
                                {criticalCount} critical
                              </Badge>
                            )}
                            {highCount > 0 && (
                              <Badge variant='secondary'>
                                {highCount} high
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              ) : (
                <div className='text-center py-8 text-muted-foreground'>
                  No files with memory leak issues found
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
