'use client';

import { useState, useEffect } from 'react';
import { AISummaryData } from '@/types/components';
import { IconSparkles } from '@tabler/icons-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingSkeleton } from '@/components/ui/loading';
import { useMemoryLeakPrevention } from '@/lib/memory-leak-prevention';

/**
 * Renders an AI-generated daily summary card.
 *
 * This function manages the state for the summary and loading status,
 * fetches real AI-generated summaries from the API, and displays the summary
 * highlights and action items once loading is complete. It includes memory
 * leak prevention and handles errors gracefully.
 */
export function AISummary() {
  const [summary, setSummary] = useState<AISummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Memory leak prevention
  useMemoryLeakPrevention('AISummary');

  // Fetch real AI summary from API
  const generateSummary = async () => {
    try {
      const response = await fetch('/api/ai-summary/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to generate AI summary: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.data) {
        setSummary({
          highlights: data.data.keyHighlights || [],
          actionItems: data.data.actionItems || [],
          generatedAt: new Date(data.data.generatedAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        });
      } else {
        throw new Error(data.message || 'Failed to generate summary');
      }
    } catch (error) {
      console.error('Error generating AI summary:', error);
      // Set empty summary on error to show the component structure
      setSummary({
        highlights: [],
        actionItems: [],
        generatedAt: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    generateSummary();
  }, []);

  return (
    <Card className='bg-gradient-to-br from-primary/5 via-card to-card'>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <IconSparkles className='size-5' />
            <CardTitle>AI Daily Summary</CardTitle>
          </div>
          <Badge variant='secondary'>Today</Badge>
        </div>
        <CardDescription>
          Intelligent insights from your team&apos;s activity
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        {isLoading ? (
          <div className='space-y-4'>
            <div className='space-y-2'>
              <LoadingSkeleton className='h-4 w-24' />
              <div className='space-y-2'>
                <LoadingSkeleton className='h-3 w-full' />
                <LoadingSkeleton className='h-3 w-5/6' />
                <LoadingSkeleton className='h-3 w-4/6' />
                <LoadingSkeleton className='h-3 w-3/4' />
              </div>
            </div>
            <div className='space-y-2'>
              <LoadingSkeleton className='h-4 w-20' />
              <div className='space-y-2'>
                <LoadingSkeleton className='h-3 w-full' />
                <LoadingSkeleton className='h-3 w-4/5' />
              </div>
            </div>
          </div>
        ) : (
          summary && (
            <>
              <div className='space-y-2'>
                <h4 className='font-semibold text-sm'>Key Highlights</h4>
                <ul className='space-y-2 text-sm text-muted-foreground'>
                  {summary.highlights.map(
                    (highlight: string, index: number) => (
                      <li key={index} className='flex items-start gap-2'>
                        <span className='mt-1 size-1.5 rounded-full bg-primary flex-shrink-0' />
                        <span>{highlight}</span>
                      </li>
                    )
                  )}
                </ul>
              </div>
              <div className='space-y-2'>
                <h4 className='font-semibold text-sm'>Action Items</h4>
                <ul className='space-y-2 text-sm text-muted-foreground'>
                  {summary.actionItems.map((item: string, index: number) => (
                    <li key={index} className='flex items-start gap-2'>
                      <span className='mt-1 size-1.5 rounded-full bg-orange-500 flex-shrink-0' />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className='pt-2 border-t'>
                <p className='text-xs text-muted-foreground'>
                  Summary generated at {summary.generatedAt} • Updates every 30
                  minutes
                </p>
              </div>
            </>
          )
        )}
      </CardContent>
    </Card>
  );
}
