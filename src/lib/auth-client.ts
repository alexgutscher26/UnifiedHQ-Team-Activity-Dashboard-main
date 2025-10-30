import { createAuthClient } from 'better-auth/react';
import {
  lastLoginMethodClient,
  multiSessionClient,
} from 'better-auth/client/plugins';

// Rate limit state management
interface RateLimitState {
  isRateLimited: boolean;
  retryAfter: number;
  retryAt: number | null;
}

class RateLimitManager {
  private state: RateLimitState = {
    isRateLimited: false,
    retryAfter: 0,
    retryAt: null,
  };

  private listeners: Array<(state: RateLimitState) => void> = [];
  private countdownInterval: NodeJS.Timeout | null = null;
  private isDestroyed = false;

  setRateLimit(retryAfter: number) {
    if (this.isDestroyed) return;

    const retryAt = Date.now() + retryAfter * 1000;
    this.state = {
      isRateLimited: true,
      retryAfter,
      retryAt,
    };

    this.notifyListeners();
    this.startCountdown();
  }

  clearRateLimit() {
    if (this.isDestroyed) return;

    this.state = {
      isRateLimited: false,
      retryAfter: 0,
      retryAt: null,
    };

    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }

    this.notifyListeners();
  }

  getState(): RateLimitState {
    return { ...this.state };
  }

  subscribe(listener: (state: RateLimitState) => void) {
    if (this.isDestroyed) {
      return () => {}; // Return no-op unsubscribe function
    }

    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  destroy() {
    this.isDestroyed = true;

    // Clear any active intervals
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }

    // Clear all listeners
    this.listeners = [];

    // Reset state
    this.state = {
      isRateLimited: false,
      retryAfter: 0,
      retryAt: null,
    };
  }

  private notifyListeners() {
    if (this.isDestroyed) return;
    this.listeners.forEach(listener => listener(this.state));
  }

  private startCountdown() {
    if (this.isDestroyed) return;

    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }

    this.countdownInterval = setInterval(() => {
      if (this.isDestroyed || !this.state.retryAt) return;

      const now = Date.now();
      const remaining = Math.ceil((this.state.retryAt - now) / 1000);

      if (remaining <= 0) {
        this.clearRateLimit();
      } else {
        this.state.retryAfter = remaining;
        this.notifyListeners();
      }
    }, 1000);
  }
}

export const rateLimitManager = new RateLimitManager();

// Toast notification system
class ToastManager {
  private toasts: Array<{
    id: string;
    message: string;
    type: 'error' | 'warning' | 'info' | 'success';
    duration?: number;
  }> = [];

  private listeners: Array<(toasts: typeof this.toasts) => void> = [];
  private timeouts: Map<string, NodeJS.Timeout> = new Map();
  private isDestroyed = false;

  show(
    message: string,
    type: 'error' | 'warning' | 'info' | 'success' = 'info',
    duration = 5000
  ) {
    if (this.isDestroyed) return '';

    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const toast = { id, message, type, duration };

    this.toasts.push(toast);
    this.notifyListeners();

    if (duration > 0) {
      const timeoutId = setTimeout(() => {
        this.remove(id);
      }, duration);

      this.timeouts.set(id, timeoutId);
    }

    return id;
  }

  remove(id: string) {
    if (this.isDestroyed) return;

    // Clear associated timeout
    const timeoutId = this.timeouts.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.timeouts.delete(id);
    }

    this.toasts = this.toasts.filter(toast => toast.id !== id);
    this.notifyListeners();
  }

  subscribe(listener: (toasts: typeof this.toasts) => void) {
    if (this.isDestroyed) {
      return () => {}; // Return no-op unsubscribe function
    }

    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  destroy() {
    this.isDestroyed = true;

    // Clear all timeouts
    this.timeouts.forEach(timeoutId => {
      clearTimeout(timeoutId);
    });
    this.timeouts.clear();

    // Clear all listeners
    this.listeners = [];

    // Clear all toasts
    this.toasts = [];
  }

  private notifyListeners() {
    if (this.isDestroyed) return;
    this.listeners.forEach(listener => listener([...this.toasts]));
  }
}

export const toastManager = new ToastManager();

// Cleanup function for proper resource management
export const cleanupAuthClient = () => {
  rateLimitManager.destroy();
  toastManager.destroy();
};

// Cleanup on page unload (browser environment)
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', cleanupAuthClient);

  // Also cleanup on page visibility change (when tab becomes hidden)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      // Don't fully destroy, but clear rate limits and excess toasts
      rateLimitManager.clearRateLimit();
    }
  });
}

export const authClient = createAuthClient({
  baseURL:
    process.env.NODE_ENV === 'production'
      ? 'https://unififedhq.com'
      : 'http://localhost:3000',
  plugins: [multiSessionClient(), lastLoginMethodClient()],
  fetchOptions: {
    onError: async context => {
      const { response } = context;

      if (response.status === 429) {
        const retryAfterHeader = response.headers.get('X-Retry-After');
        const retryAfter = retryAfterHeader
          ? parseInt(retryAfterHeader, 10)
          : 60;

        console.warn(`Rate limit exceeded. Retry after ${retryAfter} seconds`);

        // Set rate limit state
        rateLimitManager.setRateLimit(retryAfter);

        // Show toast notification
        toastManager.show(
          `Too many requests. Please wait ${retryAfter} seconds before trying again.`,
          'warning',
          8000
        );

        // Optional: Redirect to rate limit page for severe cases
        if (retryAfter > 300) {
          // 5 minutes
          if (typeof window !== 'undefined') {
            const currentPath = window.location.pathname;
            if (!currentPath.includes('/rate-limit')) {
              window.history.pushState(null, '', '/rate-limit');
              window.dispatchEvent(new PopStateEvent('popstate'));
            }
          }
        }
      } else if (response.status >= 500) {
        // Handle server errors
        toastManager.show(
          'Server error occurred. Please try again later.',
          'error',
          6000
        );
      } else if (response.status === 401) {
        // Handle authentication errors
        toastManager.show(
          'Your session has expired. Please sign in again.',
          'warning',
          5000
        );
      }
    },
  },
});

// Export types for use in components
export type { RateLimitState };
