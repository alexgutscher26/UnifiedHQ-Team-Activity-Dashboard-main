// Service Worker Registration and Lifecycle Management

export interface ServiceWorkerState {
  isSupported: boolean;
  isRegistered: boolean;
  isInstalling: boolean;
  isWaiting: boolean;
  isActive: boolean;
  hasUpdate: boolean;
  registration: ServiceWorkerRegistration | null;
}

export interface ServiceWorkerCallbacks {
  onInstalling?: () => void;
  onWaiting?: () => void;
  onActive?: () => void;
  onUpdateAvailable?: (registration: ServiceWorkerRegistration) => void;
  onUpdateReady?: () => void;
  onError?: (error: Error) => void;
}

class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private callbacks: ServiceWorkerCallbacks = {};
  private state: ServiceWorkerState = {
    isSupported: false,
    isRegistered: false,
    isInstalling: false,
    isWaiting: false,
    isActive: false,
    hasUpdate: false,
    registration: null,
  };

  constructor() {
    this.state.isSupported = 'serviceWorker' in navigator;
  }

  /**
   * Register the service worker with lifecycle callbacks
   */
  async register(
    callbacks: ServiceWorkerCallbacks = {}
  ): Promise<ServiceWorkerState> {
    this.callbacks = callbacks;

    if (!this.state.isSupported) {
      const error = new Error(
        'Service Worker is not supported in this browser'
      );
      this.callbacks.onError?.(error);
      throw error;
    }

    try {
      // Check if service worker is disabled via environment variable
      if (process.env.NEXT_PUBLIC_DISABLE_SW === 'true') {
        console.log(
          '[SW Manager] Service worker disabled via environment variable'
        );
        return;
      }

      console.log('[SW Manager] Registering service worker...');

      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none', // Always check for updates
      });

      this.state.registration = this.registration;
      this.state.isRegistered = true;

      // Set up event listeners
      this.setupEventListeners();

      // Check initial state
      this.updateState();

      console.log('[SW Manager] Service worker registered successfully');
      return this.state;
    } catch (error) {
      console.error('[SW Manager] Service worker registration failed:', error);
      this.callbacks.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * Unregister the service worker
   */
  async unregister(): Promise<boolean> {
    if (!this.registration) {
      return false;
    }

    try {
      const result = await this.registration.unregister();
      console.log('[SW Manager] Service worker unregistered:', result);

      this.registration = null;
      this.state.isRegistered = false;
      this.state.registration = null;

      return result;
    } catch (error) {
      console.error('[SW Manager] Failed to unregister service worker:', error);
      this.callbacks.onError?.(error as Error);
      return false;
    }
  }

  /**
   * Update the service worker
   */
  async update(): Promise<void> {
    if (!this.registration) {
      throw new Error('Service worker is not registered');
    }

    try {
      console.log('[SW Manager] Checking for service worker updates...');
      await this.registration.update();
    } catch (error) {
      console.error('[SW Manager] Failed to update service worker:', error);
      this.callbacks.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * Skip waiting and activate the new service worker
   */
  async skipWaiting(): Promise<void> {
    if (!this.registration?.waiting) {
      throw new Error('No waiting service worker found');
    }

    try {
      // Send skip waiting message to the waiting service worker
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });

      // Wait for the new service worker to become active
      await new Promise<void>(resolve => {
        const handleStateChange = () => {
          if (this.registration?.active) {
            this.registration.active.removeEventListener(
              'statechange',
              handleStateChange
            );
            resolve();
          }
        };

        if (this.registration?.active) {
          resolve();
        } else {
          this.registration?.addEventListener('updatefound', () => {
            this.registration?.installing?.addEventListener(
              'statechange',
              handleStateChange
            );
          });
        }
      });

      console.log('[SW Manager] Service worker updated and activated');
      this.callbacks.onUpdateReady?.();
    } catch (error) {
      console.error('[SW Manager] Failed to skip waiting:', error);
      this.callbacks.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * Get the current service worker version
   */
  async getVersion(): Promise<string | null> {
    if (!this.registration?.active) {
      return null;
    }

    return new Promise(resolve => {
      const messageChannel = new MessageChannel();

      messageChannel.port1.onmessage = event => {
        resolve(event.data.version || null);
      };

      this.registration!.active!.postMessage({ type: 'GET_VERSION' }, [
        messageChannel.port2,
      ]);

      // Timeout after 5 seconds
      setTimeout(() => resolve(null), 5000);
    });
  }

  /**
   * Clear service worker caches
   */
  async clearCache(cacheName?: string): Promise<boolean> {
    if (!this.registration?.active) {
      throw new Error('No active service worker found');
    }

    return new Promise((resolve, reject) => {
      const messageChannel = new MessageChannel();

      messageChannel.port1.onmessage = event => {
        if (event.data.success) {
          resolve(true);
        } else {
          reject(new Error(event.data.error || 'Failed to clear cache'));
        }
      };

      this.registration!.active!.postMessage(
        { type: 'CLEAR_CACHE', payload: { cacheName } },
        [messageChannel.port2]
      );

      // Timeout after 10 seconds
      setTimeout(() => reject(new Error('Cache clear timeout')), 10000);
    });
  }

  /**
   * Get the current state
   */
  getState(): ServiceWorkerState {
    return { ...this.state };
  }

  /**
   * Set up event listeners for service worker lifecycle
   */
  private setupEventListeners(): void {
    if (!this.registration) return;

    // Listen for updates
    this.registration.addEventListener('updatefound', () => {
      console.log('[SW Manager] Service worker update found');

      const newWorker = this.registration!.installing;
      if (!newWorker) return;

      this.state.isInstalling = true;
      this.callbacks.onInstalling?.();

      newWorker.addEventListener('statechange', () => {
        this.updateState();

        switch (newWorker.state) {
          case 'installed':
            if (navigator.serviceWorker.controller) {
              // New service worker is waiting
              this.state.hasUpdate = true;
              this.callbacks.onUpdateAvailable?.(this.registration!);
            } else {
              // First time installation
              this.callbacks.onActive?.();
            }
            break;

          case 'activated':
            this.callbacks.onActive?.();
            break;
        }
      });
    });

    // Listen for controller changes
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[SW Manager] Service worker controller changed');
      this.updateState();
      window.location.reload();
    });

    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', event => {
      console.log('[SW Manager] Message from service worker:', event.data);
    });
  }

  /**
   * Update the internal state based on current service worker status
   */
  private updateState(): void {
    if (!this.registration) return;

    this.state.isInstalling = Boolean(this.registration.installing);
    this.state.isWaiting = Boolean(this.registration.waiting);
    this.state.isActive = Boolean(this.registration.active);
    this.state.hasUpdate = Boolean(this.registration.waiting);
  }
}

// Export singleton instance
export const serviceWorkerManager = new ServiceWorkerManager();

// Convenience functions
export const registerServiceWorker = (callbacks?: ServiceWorkerCallbacks) =>
  serviceWorkerManager.register(callbacks);

export const unregisterServiceWorker = () => serviceWorkerManager.unregister();

export const updateServiceWorker = () => serviceWorkerManager.update();

export const skipWaitingServiceWorker = () =>
  serviceWorkerManager.skipWaiting();

export const getServiceWorkerVersion = () => serviceWorkerManager.getVersion();

export const clearServiceWorkerCache = (cacheName?: string) =>
  serviceWorkerManager.clearCache(cacheName);

export const getServiceWorkerState = () => serviceWorkerManager.getState();
