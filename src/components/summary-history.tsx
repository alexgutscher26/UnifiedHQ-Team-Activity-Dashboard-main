'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import {
  IconHistory,
  IconChevronLeft,
  IconChevronRight,
  IconCalendar,
  IconTrendingUp,
  IconClock,
  IconCircleCheck,
  IconAlertCircle,
  IconSearch,
  IconSortAscending,
  IconSortDescending,
  IconEye,
  IconBookmark,
  IconDownload,
  IconFileText,
  IconFileCode,
  IconFileSpreadsheet,
} from '@tabler/icons-react';

interface SummaryHistoryItem {
  id: string;
  title: string;
  keyHighlights: string[];
  actionItems: string[];
  insights: string[];
  generatedAt: string;
  timeRange: {
    start: string;
    end: string;
  };
  metadata: {
    activityCount: number;
    sourceBreakdown: Record<string, number>;
    model: string;
    tokensUsed: number;
  };
}

interface SummaryHistoryProps {
  className?: string;
  onSummarySelect?: (summary: SummaryHistoryItem) => void;
}

/**
 * Render the Summary History component that displays a list of summaries with filtering, sorting, and exporting capabilities.
 *
 * This component manages its own state for summaries, loading status, error handling, pagination, and various filters. It fetches summary history from an API based on the current pagination and time range, and allows users to bookmark summaries, export them in different formats, and view detailed information in a modal. The component also supports virtual scrolling for improved performance with large lists.
 *
 * @param className - Optional additional class names for styling the component.
 * @param onSummarySelect - Callback function to handle the selection of a summary.
 */
export function SummaryHistory({
  className,
  onSummarySelect,
}: SummaryHistoryProps) {
  const { toast } = useToast();
  const [summaries, setSummaries] = useState<SummaryHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 5,
    totalCount: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  });
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  // Enhanced filtering and search states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterModel, setFilterModel] = useState<string>('all');
  const [filterActivityCount, setFilterActivityCount] = useState<string>('all');
  const [sortBy, setSortBy] = useState<
    'date' | 'activityCount' | 'tokensUsed' | 'model'
  >('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedSummary, setSelectedSummary] =
    useState<SummaryHistoryItem | null>(null);
  const [bookmarkedSummaries, setBookmarkedSummaries] = useState<Set<string>>(
    new Set()
  );
  const [showBookmarksOnly, setShowBookmarksOnly] = useState(false);
  const [useVirtualScrolling, setUseVirtualScrolling] = useState(false);

  // Load bookmarks from localStorage on mount
  useEffect(() => {
    const savedBookmarks = localStorage.getItem('summary-bookmarks');
    if (savedBookmarks) {
      try {
        const bookmarks = JSON.parse(savedBookmarks);
        setBookmarkedSummaries(new Set(bookmarks));
      } catch (error) {
        console.error('Error loading bookmarks:', error);
      }
    }
  }, []);

  // Save bookmarks to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(
      'summary-bookmarks',
      JSON.stringify(Array.from(bookmarkedSummaries))
    );
  }, [bookmarkedSummaries]);

  useEffect(() => {
    fetchHistory();
  }, [pagination.page, timeRange]);

  // Filtered and sorted summaries
  const filteredSummaries = useMemo(() => {
    let filtered = summaries;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        summary =>
          summary.title.toLowerCase().includes(query) ||
          summary.keyHighlights.some(highlight =>
            highlight.toLowerCase().includes(query)
          ) ||
          summary.actionItems.some(item =>
            item.toLowerCase().includes(query)
          ) ||
          summary.insights.some(insight =>
            insight.toLowerCase().includes(query)
          )
      );
    }

    // Apply model filter
    if (filterModel !== 'all') {
      filtered = filtered.filter(summary =>
        summary.metadata.model.toLowerCase().includes(filterModel.toLowerCase())
      );
    }

    // Apply activity count filter
    if (filterActivityCount !== 'all') {
      const [min, max] = filterActivityCount.split('-').map(Number);
      filtered = filtered.filter(summary => {
        const count = summary.metadata.activityCount;
        if (max) {
          return count >= min && count <= max;
        } else {
          return count >= min;
        }
      });
    }

    // Apply bookmark filter
    if (showBookmarksOnly) {
      filtered = filtered.filter(summary =>
        bookmarkedSummaries.has(summary.id)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortBy) {
        case 'date':
          aValue = new Date(a.generatedAt).getTime();
          bValue = new Date(b.generatedAt).getTime();
          break;
        case 'activityCount':
          aValue = a.metadata.activityCount;
          bValue = b.metadata.activityCount;
          break;
        case 'tokensUsed':
          aValue = a.metadata.tokensUsed;
          bValue = b.metadata.tokensUsed;
          break;
        case 'model':
          aValue = a.metadata.model;
          bValue = b.metadata.model;
          break;
        default:
          aValue = new Date(a.generatedAt).getTime();
          bValue = new Date(b.generatedAt).getTime();
      }

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [
    summaries,
    searchQuery,
    filterModel,
    filterActivityCount,
    sortBy,
    sortOrder,
    showBookmarksOnly,
    bookmarkedSummaries,
  ]);

  // Get unique models for filter dropdown
  const uniqueModels = useMemo(() => {
    return Array.from(
      new Set(
        summaries.map(s => s.metadata.model.split('/')[1] || s.metadata.model)
      )
    );
  }, [summaries]);

  // Helper functions
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  /**
   * Toggles the bookmark status of a summary by its ID.
   */
  const handleBookmarkToggle = (summaryId: string) => {
    setBookmarkedSummaries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(summaryId)) {
        newSet.delete(summaryId);
        toast({
          title: 'Bookmark Removed',
          description: 'Summary removed from bookmarks',
        });
      } else {
        newSet.add(summaryId);
        toast({
          title: 'Bookmark Added',
          description: 'Summary added to bookmarks',
        });
      }
      return newSet;
    });
  };

  /**
   * Handles the export of a summary in various formats.
   *
   * This function takes a SummaryHistoryItem and a format type, then constructs the appropriate content based on the specified format (json, csv, or txt). It creates a Blob from the content, generates a download link, and triggers the download. Finally, it displays a toast notification indicating the export was successful.
   *
   * @param summary - The summary data to be exported.
   * @param format - The format in which to export the summary (default is 'json').
   */
  const handleExportSummary = (
    summary: SummaryHistoryItem,
    format: 'json' | 'csv' | 'txt' = 'json'
  ) => {
    const data = {
      title: summary.title,
      generatedAt: summary.generatedAt,
      timeRange: summary.timeRange,
      keyHighlights: summary.keyHighlights,
      actionItems: summary.actionItems,
      insights: summary.insights,
      metadata: summary.metadata,
    };

    let content: string;
    let mimeType: string;
    let extension: string;

    switch (format) {
      case 'json':
        content = JSON.stringify(data, null, 2);
        mimeType = 'application/json';
        extension = 'json';
        break;
      case 'csv':
        content = [
          'Field,Value',
          `Title,"${summary.title}"`,
          `Generated At,"${summary.generatedAt}"`,
          `Time Range Start,"${summary.timeRange.start}"`,
          `Time Range End,"${summary.timeRange.end}"`,
          `Activity Count,${summary.metadata.activityCount}`,
          `Model,"${summary.metadata.model}"`,
          `Tokens Used,${summary.metadata.tokensUsed}`,
          '',
          'Key Highlights',
          ...summary.keyHighlights.map(highlight => `"${highlight}"`),
          '',
          'Action Items',
          ...summary.actionItems.map(item => `"${item}"`),
          '',
          'Insights',
          ...summary.insights.map(insight => `"${insight}"`),
        ].join('\n');
        mimeType = 'text/csv';
        extension = 'csv';
        break;
      case 'txt':
        content = [
          `Summary: ${summary.title}`,
          `Generated: ${summary.generatedAt}`,
          `Time Range: ${summary.timeRange.start} - ${summary.timeRange.end}`,
          `Activities: ${summary.metadata.activityCount}`,
          `Model: ${summary.metadata.model}`,
          `Tokens Used: ${summary.metadata.tokensUsed}`,
          '',
          'KEY HIGHLIGHTS:',
          ...summary.keyHighlights.map(highlight => `• ${highlight}`),
          '',
          'ACTION ITEMS:',
          ...summary.actionItems.map(item => `• ${item}`),
          '',
          'INSIGHTS:',
          ...summary.insights.map(insight => `• ${insight}`),
        ].join('\n');
        mimeType = 'text/plain';
        extension = 'txt';
        break;
      default:
        content = JSON.stringify(data, null, 2);
        mimeType = 'application/json';
        extension = 'json';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `summary-${summary.id}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'Export Successful',
      description: `Summary exported as ${format.toUpperCase()}`,
    });
  };

  // Auto-enable virtual scrolling for large lists
  useEffect(() => {
    setUseVirtualScrolling(filteredSummaries.length > 20);
  }, [filteredSummaries.length]);

  /**
   * Fetch the summary history from the API.
   *
   * This function initiates a loading state, makes an API call to retrieve summary history based on pagination and time range, and handles potential errors.
   * It updates the summaries and pagination state based on the response, and manages error handling, including displaying a toast notification for non-authentication errors.
   *
   * @returns {Promise<void>} A promise that resolves when the fetch operation is complete.
   * @throws Error If the response is not ok or if there is an error during the fetch operation.
   */
  const fetchHistory = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        `/api/ai-summary/history?page=${pagination.page}&limit=${pagination.limit}&timeRange=${timeRange}`,
        {
          credentials: 'include',
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error ||
            `HTTP ${response.status}: Failed to fetch summary history`
        );
      }

      const data = await response.json();
      setSummaries(data.summaries || []);
      setPagination(
        data.pagination || {
          page: 1,
          limit: 5,
          totalCount: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        }
      );
    } catch (error) {
      console.error('Error fetching summary history:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to load history';
      setError(errorMessage);

      // Don't show toast for authentication errors
      if (
        !errorMessage.includes('401') &&
        !errorMessage.includes('Unauthorized')
      ) {
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handles the click event on a summary item.
   */
  const handleSummaryClick = (summary: SummaryHistoryItem) => {
    if (onSummarySelect) {
      onSummarySelect(summary);
    }
  };

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  /**
   * Handles the export of summaries in various formats.
   *
   * This function filters the summaries based on the showBookmarksOnly flag and the filteredSummaries array.
   * It then constructs the content in the specified format (json, csv, or txt) and triggers a download of the
   * generated file. If no summaries are available for export, it displays a toast notification.
   * The function also manages the creation and cleanup of the download link.
   *
   * @param format - The format in which to export the summaries. Can be 'json', 'csv', or 'txt'.
   */
  const handleExportAll = (format: 'json' | 'csv' | 'txt' = 'json') => {
    const summariesToExport = showBookmarksOnly
      ? filteredSummaries.filter(s => bookmarkedSummaries.has(s.id))
      : filteredSummaries;

    if (summariesToExport.length === 0) {
      toast({
        title: 'No Summaries to Export',
        description: 'No summaries match your current filters',
        variant: 'destructive',
      });
      return;
    }

    let content: string;
    let mimeType: string;
    let extension: string;

    switch (format) {
      case 'json':
        content = JSON.stringify(summariesToExport, null, 2);
        mimeType = 'application/json';
        extension = 'json';
        break;
      case 'csv':
        const csvRows = [
          'ID,Title,Generated At,Time Range Start,Time Range End,Activity Count,Model,Tokens Used,Key Highlights,Action Items,Insights',
        ];

        summariesToExport.forEach(summary => {
          csvRows.push(
            [
              summary.id,
              `"${summary.title}"`,
              summary.generatedAt,
              summary.timeRange.start,
              summary.timeRange.end,
              summary.metadata.activityCount,
              `"${summary.metadata.model}"`,
              summary.metadata.tokensUsed,
              `"${summary.keyHighlights.join('; ')}"`,
              `"${summary.actionItems.join('; ')}"`,
              `"${summary.insights.join('; ')}"`,
            ].join(',')
          );
        });

        content = csvRows.join('\n');
        mimeType = 'text/csv';
        extension = 'csv';
        break;
      case 'txt':
        content = summariesToExport
          .map(summary =>
            [
              `Summary: ${summary.title}`,
              `Generated: ${summary.generatedAt}`,
              `Time Range: ${summary.timeRange.start} - ${summary.timeRange.end}`,
              `Activities: ${summary.metadata.activityCount}`,
              `Model: ${summary.metadata.model}`,
              `Tokens Used: ${summary.metadata.tokensUsed}`,
              '',
              'KEY HIGHLIGHTS:',
              ...summary.keyHighlights.map(highlight => `• ${highlight}`),
              '',
              'ACTION ITEMS:',
              ...summary.actionItems.map(item => `• ${item}`),
              '',
              'INSIGHTS:',
              ...summary.insights.map(insight => `• ${insight}`),
              '='.repeat(80),
              '',
            ].join('\n')
          )
          .join('\n');
        mimeType = 'text/plain';
        extension = 'txt';
        break;
      default:
        content = JSON.stringify(summariesToExport, null, 2);
        mimeType = 'application/json';
        extension = 'json';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `summaries-${new Date().toISOString().split('T')[0]}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'Export Successful',
      description: `${summariesToExport.length} summaries exported as ${format.toUpperCase()}`,
    });
  };

  /**
   * Resets the search query and filter settings to their default values.
   */
  const clearFilters = () => {
    setSearchQuery('');
    setFilterModel('all');
    setFilterActivityCount('all');
    setSortBy('date');
    setSortOrder('desc');
    setShowBookmarksOnly(false);
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className='pb-3'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <IconHistory className='size-5 text-white' />
              <h3 className='text-lg font-semibold text-white'>
                Summary History
              </h3>
            </div>
            <Skeleton className='h-6 w-20' />
          </div>
        </CardHeader>
        <CardContent className='space-y-4'>
          {[1, 2, 3].map(i => (
            <div key={i} className='p-4 border border-slate-700 rounded-lg'>
              <div className='flex items-center justify-between mb-2'>
                <Skeleton className='h-4 w-32' />
                <Skeleton className='h-4 w-20' />
              </div>
              <div className='space-y-2'>
                <Skeleton className='h-3 w-full' />
                <Skeleton className='h-3 w-3/4' />
              </div>
              <div className='flex gap-2 mt-3'>
                <Skeleton className='h-5 w-16' />
                <Skeleton className='h-5 w-12' />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader className='pb-3'>
          <div className='flex items-center gap-2'>
            <IconHistory className='size-5 text-white' />
            <h3 className='text-lg font-semibold text-white'>
              Summary History
            </h3>
          </div>
        </CardHeader>
        <CardContent>
          <div className='text-center py-8'>
            <IconAlertCircle className='size-12 text-red-500 mx-auto mb-4' />
            <h4 className='text-lg font-medium text-white mb-2'>
              Failed to Load History
            </h4>
            <p className='text-gray-400 mb-4'>
              {error.includes('401') || error.includes('Unauthorized')
                ? 'Please log in to view your summary history'
                : error}
            </p>
            <Button onClick={fetchHistory} variant='outline'>
              <IconClock className='size-4 mr-2' />
              Retry
            </Button>
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
            <IconHistory className='size-5 text-white' />
            <h3 className='text-lg font-semibold text-white'>
              Summary History
            </h3>
          </div>
          <div className='flex items-center gap-2'>
            <Button
              variant={showBookmarksOnly ? 'default' : 'outline'}
              size='sm'
              onClick={() => setShowBookmarksOnly(!showBookmarksOnly)}
              className={
                showBookmarksOnly
                  ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/30'
                  : 'text-gray-400 border-gray-600 hover:text-white hover:border-gray-500'
              }
            >
              <IconBookmark className='size-4 mr-1' />
              Bookmarks ({bookmarkedSummaries.size})
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant='outline'
                  size='sm'
                  className='text-gray-400 border-gray-600 hover:text-white hover:border-gray-500'
                >
                  <IconDownload className='size-4 mr-1' />
                  Export All
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className='bg-slate-800 border-slate-700'>
                <DropdownMenuItem
                  onClick={() => handleExportAll('json')}
                  className='text-white hover:bg-slate-700'
                >
                  <IconFileCode className='size-4 mr-2' />
                  Export as JSON
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleExportAll('csv')}
                  className='text-white hover:bg-slate-700'
                >
                  <IconFileSpreadsheet className='size-4 mr-2' />
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleExportAll('txt')}
                  className='text-white hover:bg-slate-700'
                >
                  <IconFileText className='size-4 mr-2' />
                  Export as Text
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Select
              value={timeRange}
              onValueChange={(value: '7d' | '30d' | '90d') =>
                setTimeRange(value)
              }
            >
              <SelectTrigger className='w-32 bg-slate-800 text-white border-slate-600'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className='bg-slate-800 border-slate-600'>
                <SelectItem value='7d'>Last 7 days</SelectItem>
                <SelectItem value='30d'>Last 30 days</SelectItem>
                <SelectItem value='90d'>Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className='mt-4 space-y-3'>
          <div className='flex items-center gap-2'>
            <div className='relative flex-1'>
              <IconSearch className='absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-gray-400' />
              <Input
                placeholder='Search summaries...'
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className='pl-10 bg-slate-800 text-white border-slate-600 focus:border-blue-500'
              />
            </div>
            <Button
              variant='outline'
              size='sm'
              onClick={clearFilters}
              className='text-gray-400 border-gray-600 hover:text-white hover:border-gray-500'
            >
              Clear
            </Button>
          </div>

          {showFilters && (
            <div className='grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700'>
              <div>
                <label className='text-xs text-gray-400 mb-1 block'>
                  Model
                </label>
                <Select value={filterModel} onValueChange={setFilterModel}>
                  <SelectTrigger className='bg-slate-800 text-white border-slate-600'>
                    <SelectValue placeholder='All Models' />
                  </SelectTrigger>
                  <SelectContent className='bg-slate-800 border-slate-600'>
                    <SelectItem value='all'>All Models</SelectItem>
                    {uniqueModels.map(model => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className='text-xs text-gray-400 mb-1 block'>
                  Activity Count
                </label>
                <Select
                  value={filterActivityCount}
                  onValueChange={setFilterActivityCount}
                >
                  <SelectTrigger className='bg-slate-800 text-white border-slate-600'>
                    <SelectValue placeholder='All Counts' />
                  </SelectTrigger>
                  <SelectContent className='bg-slate-800 border-slate-600'>
                    <SelectItem value='all'>All Counts</SelectItem>
                    <SelectItem value='0-10'>0-10 activities</SelectItem>
                    <SelectItem value='11-50'>11-50 activities</SelectItem>
                    <SelectItem value='51-100'>51-100 activities</SelectItem>
                    <SelectItem value='100'>100+ activities</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className='text-xs text-gray-400 mb-1 block'>
                  Sort By
                </label>
                <div className='flex gap-1'>
                  <Select
                    value={sortBy}
                    onValueChange={(
                      value: 'date' | 'activityCount' | 'tokensUsed' | 'model'
                    ) => setSortBy(value)}
                  >
                    <SelectTrigger className='bg-slate-800 text-white border-slate-600 flex-1'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className='bg-slate-800 border-slate-600'>
                      <SelectItem value='date'>Date</SelectItem>
                      <SelectItem value='activityCount'>
                        Activity Count
                      </SelectItem>
                      <SelectItem value='tokensUsed'>Tokens Used</SelectItem>
                      <SelectItem value='model'>Model</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() =>
                      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                    }
                    className='text-gray-400 border-gray-600 hover:text-white hover:border-gray-500'
                  >
                    {sortOrder === 'asc' ? (
                      <IconSortAscending className='size-4' />
                    ) : (
                      <IconSortDescending className='size-4' />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <p className='text-sm text-gray-400 mt-2'>
          {filteredSummaries.length} of {pagination.totalCount} summaries
          {useVirtualScrolling && (
            <span className='ml-2 text-xs text-blue-400'>
              • Virtual scrolling enabled
            </span>
          )}
        </p>
      </CardHeader>

      <CardContent className='space-y-4'>
        {filteredSummaries.length === 0 ? (
          <div className='text-center py-8'>
            <IconCalendar className='size-12 text-gray-500 mx-auto mb-4' />
            <h4 className='text-lg font-medium text-white mb-2'>
              {summaries.length === 0
                ? 'No History Found'
                : 'No Matching Summaries'}
            </h4>
            <p className='text-gray-400'>
              {summaries.length === 0
                ? 'No summaries found for the selected time range.'
                : 'Try adjusting your search or filter criteria.'}
            </p>
          </div>
        ) : (
          <>
            {useVirtualScrolling ? (
              <div className='border border-slate-700 rounded-lg max-h-96 overflow-y-auto'>
                {filteredSummaries.map((summary, index) => {
                  const summaryData = filteredSummaries[index];
                  if (!summaryData) return null;

                  return (
                    <div
                      key={summaryData.id}
                      className='p-4 border-b border-slate-700 hover:border-slate-600 transition-colors group'
                    >
                      <div className='flex items-center justify-between mb-2'>
                        <h4 className='text-white font-medium text-sm flex-1'>
                          {summaryData.title}
                        </h4>
                        <div className='flex items-center gap-2'>
                          <span className='text-xs text-gray-400'>
                            {formatDate(summaryData.generatedAt)}
                          </span>
                          <Button
                            variant='ghost'
                            size='sm'
                            onClick={e => {
                              e.stopPropagation();
                              handleBookmarkToggle(summaryData.id);
                            }}
                            className={`opacity-0 group-hover:opacity-100 transition-opacity ${
                              bookmarkedSummaries.has(summaryData.id)
                                ? 'text-yellow-400'
                                : 'text-gray-400'
                            }`}
                          >
                            <IconBookmark className='size-4' />
                          </Button>
                          <Button
                            variant='ghost'
                            size='sm'
                            onClick={e => {
                              e.stopPropagation();
                              setSelectedSummary(summaryData);
                            }}
                            className='opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-white'
                          >
                            <IconEye className='size-4' />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant='ghost'
                                size='sm'
                                onClick={e => e.stopPropagation()}
                                className='opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-white'
                              >
                                <IconDownload className='size-4' />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className='bg-slate-800 border-slate-700'>
                              <DropdownMenuItem
                                onClick={() =>
                                  handleExportSummary(summaryData, 'json')
                                }
                                className='text-white hover:bg-slate-700'
                              >
                                <IconFileCode className='size-4 mr-2' />
                                Export as JSON
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  handleExportSummary(summaryData, 'csv')
                                }
                                className='text-white hover:bg-slate-700'
                              >
                                <IconFileSpreadsheet className='size-4 mr-2' />
                                Export as CSV
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  handleExportSummary(summaryData, 'txt')
                                }
                                className='text-white hover:bg-slate-700'
                              >
                                <IconFileText className='size-4 mr-2' />
                                Export as Text
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      <div className='space-y-2 mb-3'>
                        <div className='flex items-center gap-2 text-xs text-gray-400'>
                          <IconCircleCheck className='size-3' />
                          <span>
                            {summaryData.keyHighlights.length} highlights
                          </span>
                        </div>
                        <div className='flex items-center gap-2 text-xs text-gray-400'>
                          <IconAlertCircle className='size-3' />
                          <span>
                            {summaryData.actionItems.length} action items
                          </span>
                        </div>
                      </div>

                      <div className='flex items-center justify-between'>
                        <div className='flex gap-2'>
                          <Badge variant='secondary' className='text-xs'>
                            {summaryData.metadata.activityCount} activities
                          </Badge>
                          <Badge variant='outline' className='text-xs'>
                            {summaryData.metadata.model.split('/')[1]}
                          </Badge>
                          {bookmarkedSummaries.has(summaryData.id) && (
                            <Badge
                              variant='default'
                              className='text-xs bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                            >
                              Bookmarked
                            </Badge>
                          )}
                        </div>
                        <div className='flex items-center gap-1 text-xs text-gray-500'>
                          <IconTrendingUp className='size-3' />
                          <span>{summaryData.metadata.tokensUsed} tokens</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <>
                {filteredSummaries.map(summary => (
                  <div
                    key={summary.id}
                    className='p-4 border border-slate-700 rounded-lg hover:border-slate-600 transition-colors group'
                  >
                    <div className='flex items-center justify-between mb-2'>
                      <h4 className='text-white font-medium text-sm flex-1'>
                        {summary.title}
                      </h4>
                      <div className='flex items-center gap-2'>
                        <span className='text-xs text-gray-400'>
                          {formatDate(summary.generatedAt)}
                        </span>
                        <Button
                          variant='ghost'
                          size='sm'
                          onClick={e => {
                            e.stopPropagation();
                            handleBookmarkToggle(summary.id);
                          }}
                          className={`opacity-0 group-hover:opacity-100 transition-opacity ${
                            bookmarkedSummaries.has(summary.id)
                              ? 'text-yellow-400'
                              : 'text-gray-400'
                          }`}
                        >
                          <IconBookmark className='size-4' />
                        </Button>
                        <Button
                          variant='ghost'
                          size='sm'
                          onClick={e => {
                            e.stopPropagation();
                            setSelectedSummary(summary);
                          }}
                          className='opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-white'
                        >
                          <IconEye className='size-4' />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant='ghost'
                              size='sm'
                              onClick={e => e.stopPropagation()}
                              className='opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-white'
                            >
                              <IconDownload className='size-4' />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className='bg-slate-800 border-slate-700'>
                            <DropdownMenuItem
                              onClick={() =>
                                handleExportSummary(summary, 'json')
                              }
                              className='text-white hover:bg-slate-700'
                            >
                              <IconFileCode className='size-4 mr-2' />
                              Export as JSON
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                handleExportSummary(summary, 'csv')
                              }
                              className='text-white hover:bg-slate-700'
                            >
                              <IconFileSpreadsheet className='size-4 mr-2' />
                              Export as CSV
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                handleExportSummary(summary, 'txt')
                              }
                              className='text-white hover:bg-slate-700'
                            >
                              <IconFileText className='size-4 mr-2' />
                              Export as Text
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    <div className='space-y-2 mb-3'>
                      <div className='flex items-center gap-2 text-xs text-gray-400'>
                        <IconCircleCheck className='size-3' />
                        <span>{summary.keyHighlights.length} highlights</span>
                      </div>
                      <div className='flex items-center gap-2 text-xs text-gray-400'>
                        <IconAlertCircle className='size-3' />
                        <span>{summary.actionItems.length} action items</span>
                      </div>
                    </div>

                    <div className='flex items-center justify-between'>
                      <div className='flex gap-2'>
                        <Badge variant='secondary' className='text-xs'>
                          {summary.metadata.activityCount} activities
                        </Badge>
                        <Badge variant='outline' className='text-xs'>
                          {summary.metadata.model.split('/')[1]}
                        </Badge>
                        {bookmarkedSummaries.has(summary.id) && (
                          <Badge
                            variant='default'
                            className='text-xs bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                          >
                            Bookmarked
                          </Badge>
                        )}
                      </div>
                      <div className='flex items-center gap-1 text-xs text-gray-500'>
                        <IconTrendingUp className='size-3' />
                        <span>{summary.metadata.tokensUsed} tokens</span>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className='flex items-center justify-between pt-4 border-t border-slate-700'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={!pagination.hasPrev}
                  className='text-gray-400 border-gray-600 hover:text-white hover:border-gray-500'
                >
                  <IconChevronLeft className='size-4 mr-1' />
                  Previous
                </Button>

                <span className='text-sm text-gray-400'>
                  Page {pagination.page} of {pagination.totalPages}
                </span>

                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={!pagination.hasNext}
                  className='text-gray-400 border-gray-600 hover:text-white hover:border-gray-500'
                >
                  Next
                  <IconChevronRight className='size-4 ml-1' />
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>

      {/* Detailed View Modal */}
      <Dialog
        open={!!selectedSummary}
        onOpenChange={() => setSelectedSummary(null)}
      >
        <DialogContent className='max-w-4xl max-h-[80vh] bg-slate-800 border-slate-700'>
          <DialogHeader>
            <DialogTitle className='text-white flex items-center gap-2'>
              <IconEye className='size-5' />
              Summary Details
            </DialogTitle>
          </DialogHeader>

          {selectedSummary && (
            <ScrollArea className='max-h-[60vh] pr-4'>
              <div className='space-y-6'>
                {/* Header */}
                <div className='space-y-2'>
                  <h2 className='text-xl font-bold text-white'>
                    {selectedSummary.title}
                  </h2>
                  <div className='flex items-center gap-4 text-sm text-gray-400'>
                    <span>
                      Generated: {formatDate(selectedSummary.generatedAt)}
                    </span>
                    <span>•</span>
                    <span>
                      Range:{' '}
                      {new Date(
                        selectedSummary.timeRange.start
                      ).toLocaleDateString()}{' '}
                      -{' '}
                      {new Date(
                        selectedSummary.timeRange.end
                      ).toLocaleDateString()}
                    </span>
                  </div>
                  <div className='flex gap-2'>
                    <Badge variant='secondary'>
                      {selectedSummary.metadata.activityCount} activities
                    </Badge>
                    <Badge variant='outline'>
                      {selectedSummary.metadata.model}
                    </Badge>
                    <Badge variant='outline'>
                      {selectedSummary.metadata.tokensUsed} tokens
                    </Badge>
                  </div>
                </div>

                <Separator className='bg-slate-700' />

                {/* Key Highlights */}
                <div>
                  <h3 className='text-lg font-semibold text-white mb-3 flex items-center gap-2'>
                    <IconCircleCheck className='size-5 text-green-400' />
                    Key Highlights
                  </h3>
                  <ul className='space-y-2'>
                    {selectedSummary.keyHighlights.map((highlight, index) => (
                      <li
                        key={index}
                        className='text-gray-300 text-sm flex items-start gap-2'
                      >
                        <span className='text-green-400 mt-1'>•</span>
                        <span>{highlight}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Separator className='bg-slate-700' />

                {/* Action Items */}
                <div>
                  <h3 className='text-lg font-semibold text-white mb-3 flex items-center gap-2'>
                    <IconAlertCircle className='size-5 text-orange-400' />
                    Action Items
                  </h3>
                  <ul className='space-y-2'>
                    {selectedSummary.actionItems.map((item, index) => (
                      <li
                        key={index}
                        className='text-gray-300 text-sm flex items-start gap-2'
                      >
                        <span className='text-orange-400 mt-1'>•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Separator className='bg-slate-700' />

                {/* Insights */}
                <div>
                  <h3 className='text-lg font-semibold text-white mb-3 flex items-center gap-2'>
                    <IconTrendingUp className='size-5 text-blue-400' />
                    Insights
                  </h3>
                  <ul className='space-y-2'>
                    {selectedSummary.insights.map((insight, index) => (
                      <li
                        key={index}
                        className='text-gray-300 text-sm flex items-start gap-2'
                      >
                        <span className='text-blue-400 mt-1'>•</span>
                        <span>{insight}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Source Breakdown */}
                {selectedSummary.metadata.sourceBreakdown &&
                  Object.keys(selectedSummary.metadata.sourceBreakdown).length >
                    0 && (
                    <>
                      <Separator className='bg-slate-700' />
                      <div>
                        <h3 className='text-lg font-semibold text-white mb-3'>
                          Source Breakdown
                        </h3>
                        <div className='grid grid-cols-2 gap-2'>
                          {Object.entries(
                            selectedSummary.metadata.sourceBreakdown
                          ).map(([source, count]) => (
                            <div
                              key={source}
                              className='flex justify-between items-center p-2 bg-slate-700/50 rounded'
                            >
                              <span className='text-gray-300 text-sm capitalize'>
                                {source}
                              </span>
                              <Badge variant='outline'>{count}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
              </div>
            </ScrollArea>
          )}

          <div className='flex justify-end gap-2 pt-4 border-t border-slate-700'>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant='outline'
                  className='text-gray-400 border-gray-600 hover:text-white hover:border-gray-500'
                >
                  <IconDownload className='size-4 mr-2' />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className='bg-slate-800 border-slate-700'>
                <DropdownMenuItem
                  onClick={() =>
                    selectedSummary &&
                    handleExportSummary(selectedSummary, 'json')
                  }
                  className='text-white hover:bg-slate-700'
                >
                  <IconFileCode className='size-4 mr-2' />
                  Export as JSON
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    selectedSummary &&
                    handleExportSummary(selectedSummary, 'csv')
                  }
                  className='text-white hover:bg-slate-700'
                >
                  <IconFileSpreadsheet className='size-4 mr-2' />
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    selectedSummary &&
                    handleExportSummary(selectedSummary, 'txt')
                  }
                  className='text-white hover:bg-slate-700'
                >
                  <IconFileText className='size-4 mr-2' />
                  Export as Text
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant='outline'
              onClick={() => setSelectedSummary(null)}
              className='text-gray-400 border-gray-600 hover:text-white hover:border-gray-500'
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
