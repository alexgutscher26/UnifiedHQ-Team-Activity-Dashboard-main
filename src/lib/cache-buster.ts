/**
 * Cache busting utilities to force browser cache refresh
 */

export const CACHE_VERSION = '1.0.1';

/**
 * Forces a hard refresh of the page to clear cached JavaScript
 */
export function forceHardRefresh() {
  if (typeof window !== 'undefined') {
    // Clear all caches
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          caches.delete(name);
        });
      });
    }

    // Clear service worker cache
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(registration => {
          registration.unregister();
        });
      });
    }

    // Force hard refresh
    window.location.reload();
  }
}

/**
 * Adds cache busting parameter to URLs
 */
export function addCacheBuster(url: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}_cb=${CACHE_VERSION}_${Date.now()}`;
}

/**
 * Checks if the current cache version is outdated
 */
export function isCacheOutdated(): boolean {
  if (typeof window === 'undefined') return false;

  const storedVersion = localStorage.getItem('cache_version');
  return storedVersion !== CACHE_VERSION;
}

/**
 * Updates the stored cache version
 */
export function updateCacheVersion(): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('cache_version', CACHE_VERSION);
  }
}

/**
 * Clears browser cache and forces refresh if needed
 */
export function clearCacheIfNeeded(): void {
  if (isCacheOutdated()) {
    console.log('🔄 Cache version outdated, clearing cache...');
    updateCacheVersion();
    forceHardRefresh();
  }
}
