/**
 * Infinite scroll and pagination hooks for activity feeds
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

export interface PaginationConfig {
  initialPage?: number;
  pageSize?: number;
  maxPages?: number;
  enableInfiniteScroll?: boolean;
  threshold?: number; // Distance from bottom to trigger load more
}

export interface PaginationState {
  currentPage: number;
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  totalItems: number;
  loadedItems: number;
}

export interface InfiniteScrollConfig {
  threshold?: number;
  rootMargin?: string;
  enabled?: boolean;
}

/**
 * Hook for managing pagination state
 */
export const usePagination = (config: PaginationConfig = {}) => {
  const {
    initialPage = 1,
    pageSize = 20,
    maxPages = 10,
    enableInfiniteScroll = true,
    threshold = 100,
  } = config;

  const [state, setState] = useState<PaginationState>({
    currentPage: initialPage,
    hasMore: true,
    isLoading: false,
    isLoadingMore: false,
    totalItems: 0,
    loadedItems: 0,
  });

  const loadMore = useCallback(() => {
    if (!state.isLoadingMore && state.hasMore && state.currentPage < maxPages) {
      setState(prev => ({
        ...prev,
        isLoadingMore: true,
        currentPage: prev.currentPage + 1,
      }));
    }
  }, [state.isLoadingMore, state.hasMore, state.currentPage, maxPages]);

  const reset = useCallback(() => {
    setState({
      currentPage: initialPage,
      hasMore: true,
      isLoading: false,
      isLoadingMore: false,
      totalItems: 0,
      loadedItems: 0,
    });
  }, [initialPage]);

  const updateState = useCallback((updates: Partial<PaginationState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  return {
    ...state,
    loadMore,
    reset,
    updateState,
    pageSize,
    threshold,
    enableInfiniteScroll,
  };
};

/**
 * Hook for infinite scroll detection
 */
export const useInfiniteScroll = (
  callback: () => void,
  config: InfiniteScrollConfig = {}
) => {
  const { threshold = 100, rootMargin = '0px', enabled = true } = config;

  const [isNearBottom, setIsNearBottom] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        setIsNearBottom(entry.isIntersecting);
        if (entry.isIntersecting) {
          callback();
        }
      },
      {
        rootMargin: `${threshold}px ${rootMargin}`,
        threshold: 0.1,
      }
    );

    observerRef.current.observe(sentinel);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [callback, threshold, rootMargin, enabled]);

  return { sentinelRef, isNearBottom };
};

/**
 * Hook for scroll-based pagination
 */
export const useScrollPagination = (
  fetchMore: (page: number) => Promise<{ items: any[]; hasMore: boolean }>,
  config: PaginationConfig = {}
) => {
  const pagination = usePagination(config);
  const [items, setItems] = useState<any[]>([]);

  const { sentinelRef } = useInfiniteScroll(
    () => {
      if (pagination.hasMore && !pagination.isLoadingMore) {
        pagination.loadMore();
      }
    },
    {
      threshold: pagination.threshold,
      enabled: pagination.enableInfiniteScroll,
    }
  );

  useEffect(() => {
    const loadPage = async () => {
      if (pagination.isLoadingMore) {
        try {
          const result = await fetchMore(pagination.currentPage);
          setItems(prev => [...prev, ...result.items]);
          pagination.updateState({
            hasMore: result.hasMore,
            isLoadingMore: false,
            loadedItems: items.length + result.items.length,
          });
        } catch (error) {
          console.error('Error loading more items:', error);
          pagination.updateState({
            isLoadingMore: false,
          });
        }
      }
    };

    loadPage();
  }, [pagination.currentPage, pagination.isLoadingMore]);

  const reset = useCallback(() => {
    pagination.reset();
    setItems([]);
  }, [pagination]);

  return {
    items,
    ...pagination,
    reset,
    sentinelRef,
  };
};

/**
 * Hook for virtual scrolling with pagination
 */
export const useVirtualPagination = (
  itemCount: number,
  itemHeight: number,
  containerHeight: number,
  config: PaginationConfig = {}
) => {
  const pagination = usePagination(config);
  const [scrollTop, setScrollTop] = useState(0);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 0 });

  const calculateVisibleRange = useCallback(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - 5);
    const endIndex = Math.min(
      itemCount - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + 5
    );

    setVisibleRange({ start: startIndex, end: endIndex });
  }, [scrollTop, itemHeight, containerHeight, itemCount]);

  useEffect(() => {
    calculateVisibleRange();
  }, [calculateVisibleRange]);

  const handleScroll = useCallback(
    (scrollTop: number) => {
      setScrollTop(scrollTop);

      // Check if we need to load more items
      const isNearBottom =
        scrollTop + containerHeight >= itemCount * itemHeight - 200;
      if (isNearBottom && pagination.hasMore && !pagination.isLoadingMore) {
        pagination.loadMore();
      }
    },
    [containerHeight, itemCount, itemHeight, pagination]
  );

  return {
    ...pagination,
    scrollTop,
    visibleRange,
    handleScroll,
    totalHeight: itemCount * itemHeight,
    offsetY: visibleRange.start * itemHeight,
  };
};

/**
 * Hook for search and filtering with pagination
 */
export const useSearchablePagination = <T>(
  items: T[],
  searchFn: (items: T[], query: string) => T[],
  config: PaginationConfig = {}
) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredItems, setFilteredItems] = useState<T[]>(items);
  const pagination = usePagination(config);

  useEffect(() => {
    const filtered = searchFn(items, searchQuery);
    setFilteredItems(filtered);
    pagination.reset();
  }, [items, searchQuery, searchFn]);

  const paginatedItems = useMemo(() => {
    const startIndex = (pagination.currentPage - 1) * pagination.pageSize;
    return filteredItems.slice(0, startIndex + pagination.pageSize);
  }, [filteredItems, pagination.currentPage, pagination.pageSize]);

  const hasMoreItems = paginatedItems.length < filteredItems.length;

  return {
    searchQuery,
    setSearchQuery,
    filteredItems,
    paginatedItems,
    hasMoreItems,
    ...pagination,
  };
};

/**
 * Hook for caching paginated data
 */
export const useCachedPagination = <T>(
  fetchFn: (page: number) => Promise<{ items: T[]; hasMore: boolean }>,
  config: PaginationConfig = {}
) => {
  const [cache, setCache] = useState<Map<number, T[]>>(new Map());
  const [allItems, setAllItems] = useState<T[]>([]);
  const pagination = usePagination(config);

  const loadPage = useCallback(
    async (page: number) => {
      if (cache.has(page)) {
        return cache.get(page)!;
      }

      try {
        const result = await fetchFn(page);
        setCache(prev => new Map(prev).set(page, result.items));
        return result.items;
      } catch (error) {
        console.error(`Error loading page ${page}:`, error);
        return [];
      }
    },
    [fetchFn, cache]
  );

  useEffect(() => {
    const loadAllCachedPages = async () => {
      const pages = Array.from(
        { length: pagination.currentPage },
        (_, i) => i + 1
      );
      const allCachedItems: T[] = [];

      for (const page of pages) {
        const items = await loadPage(page);
        allCachedItems.push(...items);
      }

      setAllItems(allCachedItems);
    };

    loadAllCachedPages();
  }, [pagination.currentPage, loadPage]);

  const clearCache = useCallback(() => {
    setCache(new Map());
    setAllItems([]);
    pagination.reset();
  }, [pagination]);

  return {
    allItems,
    cache,
    clearCache,
    loadPage,
    ...pagination,
  };
};
