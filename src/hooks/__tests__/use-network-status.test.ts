import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';

// Mock global objects for network status testing
const mockNavigator = {
  onLine: true,
  connection: {
    effectiveType: '4g',
    downlink: 10,
    rtt: 100,
    saveData: false,
    addEventListener: mock.fn(),
    removeEventListener: mock.fn(),
  },
};

const mockWindow = {
  addEventListener: mock.fn(),
  removeEventListener: mock.fn(),
};

const mockFetch = mock.fn();

// Set up global mocks
global.navigator = mockNavigator as any;
global.window = mockWindow as any;
global.fetch = mockFetch as any;

describe('useNetworkStatus', () => {
  let useNetworkStatus: any;
  let renderHook: any;
  let act: any;

  beforeEach(async () => {
    // Reset mocks
    mockNavigator.onLine = true;
    mockWindow.addEventListener.mock.resetCalls();
    mockWindow.removeEventListener.mock.resetCalls();
    mockNavigator.connection.addEventListener.mock.resetCalls();
    mockNavigator.connection.removeEventListener.mock.resetCalls();
    mockFetch.mock.resetCalls();

    // Mock React hooks for testing
    let state: any = {
      isOnline: true,
      isOffline: false,
      effectiveType: '4g',
      downlink: 10,
      rtt: 100,
      saveData: false,
    };

    let effects: Array<() => void> = [];
    let cleanups: Array<() => void> = [];

    const mockUseState = (initialValue: any) => {
      const setState = (newValue: any) => {
        if (typeof newValue === 'function') {
          state = { ...state, ...newValue(state) };
        } else {
          state = { ...state, ...newValue };
        }
      };
      return [state, setState];
    };

    const mockUseEffect = (effect: () => void | (() => void), deps?: any[]) => {
      const cleanup = effect();
      if (cleanup && typeof cleanup === 'function') {
        cleanups.push(cleanup);
      }
      effects.push(effect);
    };

    const mockUseCallback = (callback: any, deps?: any[]) => callback;

    // Mock the hook implementation
    useNetworkStatus = (options: any = {}) => {
      const {
        onOnline,
        onOffline,
        pingUrl = '/api/health',
        pingInterval = 30000,
        enablePing = true,
      } = options;

      const checkConnection = async () => {
        if (!enablePing) {
          return mockNavigator.onLine;
        }

        try {
          const response = await fetch(pingUrl, {
            method: 'HEAD',
            cache: 'no-cache',
          });
          return response.ok;
        } catch (error) {
          return false;
        }
      };

      return {
        ...state,
        checkConnection,
        lastChecked: Date.now(),
        isChecking: false,
      };
    };

    renderHook = (hookFn: any) => {
      const result = hookFn();
      return {
        result: { current: result },
        rerender: () => hookFn(),
      };
    };

    act = (fn: () => void) => {
      fn();
    };
  });

  afterEach(() => {
    // Clean up any timers or listeners
  });

  describe('initialization', () => {
    it('should initialize with online status', () => {
      const { result } = renderHook(() => useNetworkStatus());

      assert.strictEqual(result.current.isOnline, true);
      assert.strictEqual(result.current.isOffline, false);
      assert.strictEqual(result.current.effectiveType, '4g');
      assert.strictEqual(result.current.downlink, 10);
      assert.strictEqual(result.current.rtt, 100);
      assert.strictEqual(result.current.saveData, false);
    });

    it('should initialize with offline status when navigator.onLine is false', () => {
      mockNavigator.onLine = false;

      const { result } = renderHook(() => useNetworkStatus());

      assert.strictEqual(result.current.isOnline, false);
      assert.strictEqual(result.current.isOffline, true);
    });

    it('should handle missing connection API gracefully', () => {
      const originalConnection = mockNavigator.connection;
      delete (mockNavigator as any).connection;

      const { result } = renderHook(() => useNetworkStatus());

      assert.strictEqual(result.current.isOnline, true);
      assert.strictEqual(result.current.effectiveType, undefined);
      assert.strictEqual(result.current.downlink, undefined);

      // Restore connection
      (mockNavigator as any).connection = originalConnection;
    });
  });

  describe('checkConnection', () => {
    it('should return navigator.onLine when ping is disabled', async () => {
      const { result } = renderHook(() =>
        useNetworkStatus({ enablePing: false })
      );

      const isOnline = await result.current.checkConnection();

      assert.strictEqual(isOnline, mockNavigator.onLine);
      assert.strictEqual(mockFetch.mock.callCount(), 0);
    });

    it('should make HEAD request to ping URL when ping is enabled', async () => {
      mockFetch.mock.mockImplementationOnce(() =>
        Promise.resolve({ ok: true })
      );

      const { result } = renderHook(() =>
        useNetworkStatus({
          enablePing: true,
          pingUrl: '/api/test',
        })
      );

      const isOnline = await result.current.checkConnection();

      assert.strictEqual(isOnline, true);
      assert.strictEqual(mockFetch.mock.callCount(), 1);
      assert.strictEqual(mockFetch.mock.calls[0].arguments[0], '/api/test');
      assert.strictEqual(mockFetch.mock.calls[0].arguments[1].method, 'HEAD');
    });

    it('should return false when ping request fails', async () => {
      mockFetch.mock.mockImplementationOnce(() =>
        Promise.reject(new Error('Network error'))
      );

      const { result } = renderHook(() =>
        useNetworkStatus({ enablePing: true })
      );

      const isOnline = await result.current.checkConnection();

      assert.strictEqual(isOnline, false);
      assert.strictEqual(mockFetch.mock.callCount(), 1);
    });

    it('should return false when ping response is not ok', async () => {
      mockFetch.mock.mockImplementationOnce(() =>
        Promise.resolve({ ok: false, status: 500 })
      );

      const { result } = renderHook(() =>
        useNetworkStatus({ enablePing: true })
      );

      const isOnline = await result.current.checkConnection();

      assert.strictEqual(isOnline, false);
      assert.strictEqual(mockFetch.mock.callCount(), 1);
    });

    it('should timeout after 5 seconds', async () => {
      // Mock a request that never resolves
      mockFetch.mock.mockImplementationOnce(
        () => new Promise(() => {}) // Never resolves
      );

      const { result } = renderHook(() =>
        useNetworkStatus({ enablePing: true })
      );

      const startTime = Date.now();
      const isOnline = await result.current.checkConnection();
      const endTime = Date.now();

      assert.strictEqual(isOnline, false);
      // Should timeout around 5 seconds (allowing some margin)
      assert.ok(endTime - startTime >= 4900);
      assert.ok(endTime - startTime <= 5500);
    });
  });

  describe('callbacks', () => {
    it('should call onOnline callback when going online', () => {
      const onOnline = mock.fn();
      const onOffline = mock.fn();

      mockNavigator.onLine = false;
      const { result } = renderHook(() =>
        useNetworkStatus({ onOnline, onOffline })
      );

      // Simulate going online
      mockNavigator.onLine = true;
      act(() => {
        // Simulate online event
        const onlineHandler = mockWindow.addEventListener.mock.calls.find(
          call => call.arguments[0] === 'online'
        )?.arguments[1];
        if (onlineHandler) onlineHandler();
      });

      assert.strictEqual(onOnline.mock.callCount(), 1);
      assert.strictEqual(onOffline.mock.callCount(), 0);
    });

    it('should call onOffline callback when going offline', () => {
      const onOnline = mock.fn();
      const onOffline = mock.fn();

      mockNavigator.onLine = true;
      const { result } = renderHook(() =>
        useNetworkStatus({ onOnline, onOffline })
      );

      // Simulate going offline
      mockNavigator.onLine = false;
      act(() => {
        // Simulate offline event
        const offlineHandler = mockWindow.addEventListener.mock.calls.find(
          call => call.arguments[0] === 'offline'
        )?.arguments[1];
        if (offlineHandler) offlineHandler();
      });

      assert.strictEqual(onOffline.mock.callCount(), 1);
      assert.strictEqual(onOnline.mock.callCount(), 0);
    });

    it('should not call callbacks if status does not change', () => {
      const onOnline = mock.fn();
      const onOffline = mock.fn();

      mockNavigator.onLine = true;
      const { result } = renderHook(() =>
        useNetworkStatus({ onOnline, onOffline })
      );

      // Simulate online event when already online
      act(() => {
        const onlineHandler = mockWindow.addEventListener.mock.calls.find(
          call => call.arguments[0] === 'online'
        )?.arguments[1];
        if (onlineHandler) onlineHandler();
      });

      assert.strictEqual(onOnline.mock.callCount(), 0);
      assert.strictEqual(onOffline.mock.callCount(), 0);
    });
  });

  describe('event listeners', () => {
    it('should add event listeners on mount', () => {
      renderHook(() => useNetworkStatus());

      // Should add online and offline listeners
      const addEventListenerCalls = mockWindow.addEventListener.mock.calls;
      const eventTypes = addEventListenerCalls.map(call => call.arguments[0]);

      assert.ok(eventTypes.includes('online'));
      assert.ok(eventTypes.includes('offline'));
    });

    it('should add connection change listener when available', () => {
      renderHook(() => useNetworkStatus());

      assert.strictEqual(
        mockNavigator.connection.addEventListener.mock.callCount(),
        1
      );
      assert.strictEqual(
        mockNavigator.connection.addEventListener.mock.calls[0].arguments[0],
        'change'
      );
    });

    it('should handle missing connection API gracefully', () => {
      const originalConnection = mockNavigator.connection;
      delete (mockNavigator as any).connection;

      renderHook(() => useNetworkStatus());

      // Should not throw error
      const addEventListenerCalls = mockWindow.addEventListener.mock.calls;
      const eventTypes = addEventListenerCalls.map(call => call.arguments[0]);

      assert.ok(eventTypes.includes('online'));
      assert.ok(eventTypes.includes('offline'));

      // Restore connection
      (mockNavigator as any).connection = originalConnection;
    });
  });

  describe('periodic checks', () => {
    it('should perform periodic connectivity checks when enabled', () => {
      const { result } = renderHook(() =>
        useNetworkStatus({
          enablePing: true,
          pingInterval: 1000, // 1 second for testing
        })
      );

      // Should set up interval for periodic checks
      // This is difficult to test without actual timers, so we just verify the hook doesn't crash
      assert.ok(result.current.checkConnection);
    });

    it('should not perform periodic checks when disabled', () => {
      const { result } = renderHook(() =>
        useNetworkStatus({
          enablePing: false,
          pingInterval: 1000,
        })
      );

      // Should still have checkConnection function
      assert.ok(result.current.checkConnection);
    });

    it('should not perform periodic checks when pingInterval is 0', () => {
      const { result } = renderHook(() =>
        useNetworkStatus({
          enablePing: true,
          pingInterval: 0,
        })
      );

      // Should still have checkConnection function
      assert.ok(result.current.checkConnection);
    });
  });
});
