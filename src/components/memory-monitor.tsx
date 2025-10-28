'use client';

import React, { useState, useEffect } from 'react';
import { MemorySnapshot } from '@/types/components';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  useMemoryMonitoring,
  getMemoryReport,
  cleanupAllMemoryLeaks,
} from '@/lib/memory-leak-prevention';
import { MemoryStick, Trash2, RefreshCw, AlertTriangle } from 'lucide-react';

interface MemoryMonitorProps {
  show?: boolean;
  className?: string;
}

export function MemoryMonitor({ show = false, className }: MemoryMonitorProps) {
  const [report, setReport] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(show);

  // Monitor memory in development
  useMemoryMonitoring(5000);

  const updateReport = () => {
    const memoryReport = getMemoryReport();
    setReport(memoryReport);
  };

  useEffect(() => {
    if (isVisible) {
      updateReport();
      const interval = setInterval(updateReport, 2000);
      return () => clearInterval(interval);
    }
  }, [isVisible]);

  const handleCleanup = () => {
    cleanupAllMemoryLeaks();
    updateReport();
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  if (!isVisible) {
    return (
      <Button
        variant='outline'
        size='sm'
        onClick={() => setIsVisible(true)}
        className='fixed bottom-4 right-4 z-50'
      >
        <MemoryStick className='h-4 w-4 mr-2' />
        Memory Monitor
      </Button>
    );
  }

  return (
    <Card className={`fixed bottom-4 right-4 w-80 z-50 ${className}`}>
      <CardHeader className='pb-3'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <MemoryStick className='h-4 w-4' />
            <CardTitle className='text-sm'>Memory Monitor</CardTitle>
          </div>
          <div className='flex items-center gap-1'>
            <Button
              variant='ghost'
              size='sm'
              onClick={updateReport}
              className='h-6 w-6 p-0'
            >
              <RefreshCw className='h-3 w-3' />
            </Button>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => setIsVisible(false)}
              className='h-6 w-6 p-0'
            >
              ×
            </Button>
          </div>
        </div>
        <CardDescription className='text-xs'>
          Development memory leak detection
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-3'>
        {report && (
          <>
            <div className='space-y-2'>
              <div className='flex items-center justify-between text-xs'>
                <span>Active Subscriptions</span>
                <Badge
                  variant={
                    report.activeSubscriptions > 0 ? 'destructive' : 'secondary'
                  }
                >
                  {report.activeSubscriptions}
                </Badge>
              </div>
              <div className='flex items-center justify-between text-xs'>
                <span>Active Timers</span>
                <Badge
                  variant={
                    report.activeTimers > 0 ? 'destructive' : 'secondary'
                  }
                >
                  {report.activeTimers}
                </Badge>
              </div>
              <div className='flex items-center justify-between text-xs'>
                <span>Event Listeners</span>
                <Badge
                  variant={
                    report.activeEventListeners > 0
                      ? 'destructive'
                      : 'secondary'
                  }
                >
                  {report.activeEventListeners}
                </Badge>
              </div>
            </div>

            {report.memorySnapshots.length > 0 && (
              <div className='space-y-2'>
                <div className='text-xs font-medium'>Memory Usage</div>
                {report.memorySnapshots
                  .slice(-3)
                  .map((snapshot: MemorySnapshot, index: number) => (
                    <div key={index} className='text-xs space-y-1'>
                      <div className='flex justify-between'>
                        <span>Used:</span>
                        <span>
                          {formatBytes(snapshot.memory.usedJSHeapSize)}
                        </span>
                      </div>
                      <div className='flex justify-between'>
                        <span>Total:</span>
                        <span>
                          {formatBytes(snapshot.memory.totalJSHeapSize)}
                        </span>
                      </div>
                      <div className='flex justify-between'>
                        <span>Limit:</span>
                        <span>
                          {formatBytes(snapshot.memory.jsHeapSizeLimit)}
                        </span>
                      </div>
                      <div className='w-full bg-gray-200 rounded-full h-1'>
                        <div
                          className='bg-blue-600 h-1 rounded-full'
                          style={{
                            width: `${(snapshot.memory.usedJSHeapSize / snapshot.memory.jsHeapSizeLimit) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {Object.keys(report.componentMounts).length > 0 && (
              <div className='space-y-2'>
                <div className='text-xs font-medium'>Component Mounts</div>
                <div className='space-y-1 max-h-20 overflow-y-auto'>
                  {Object.entries(report.componentMounts).map(
                    ([component, count]) => (
                      <div
                        key={component}
                        className='flex justify-between text-xs'
                      >
                        <span className='truncate'>{component}</span>
                        <Badge
                          variant={
                            (count as number) > 1 ? 'destructive' : 'secondary'
                          }
                        >
                          {count as number}
                        </Badge>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            {(report.activeSubscriptions > 0 ||
              report.activeTimers > 0 ||
              report.activeEventListeners > 0) && (
              <div className='flex items-center gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs'>
                <AlertTriangle className='h-3 w-3 text-yellow-600' />
                <span className='text-yellow-800'>
                  Potential memory leaks detected
                </span>
              </div>
            )}

            <Button
              variant='outline'
              size='sm'
              onClick={handleCleanup}
              className='w-full'
            >
              <Trash2 className='h-3 w-3 mr-2' />
              Cleanup All
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
