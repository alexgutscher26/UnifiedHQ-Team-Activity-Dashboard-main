'use client';

import { useEffect } from 'react';
import { clearCacheIfNeeded } from '@/lib/cache-buster';

/**
 * Client component that checks for cache version updates and clears cache if needed
 */
export function CacheChecker() {
  useEffect(() => {
    // Check cache version on mount
    clearCacheIfNeeded();
  }, []);

  // This component doesn't render anything
  return null;
}
