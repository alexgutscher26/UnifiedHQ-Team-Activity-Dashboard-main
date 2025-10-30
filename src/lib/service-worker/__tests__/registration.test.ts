import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';

// Helper to create typed mock functions
const createMockFn = () => mock.fn<any>();

// Mock global objects for service worker testing
const mockServiceWorker = {
  register: mock.fn<any>(),
  unregister: mock.fn<any>(),
  update: mock.fn<any>(),
  addEventListener: mock.fn<any>(),
  removeEventListener: mock.fn<any>(),
  postMessage: mock.fn<any>(),
};

const mockRegistration = {
  installing: null,
  waiting: null,
  active: null,
  addEventListener: mock.fn<any>(),
  removeEventListener: mock.fn<any>(),
  unregister: mock.fn<any>(() => Promise.resolve(true)),
  update: mock.fn<any>(() => Promise.resolve()),
};

// Mock navigator
global.navigator = {
  serviceWorker: mockServiceWorker,
  onLine: true,
} as any;

// Mock MessageChannel
global.MessageChannel = class {
  port1 = { onmessage: null, postMessage: mock.fn() };
  port2 = { onmessage: null, postMessage: mock.fn() };
} as any;

describe('Service Worker Registration', () => {
  let serviceWorkerManager: any;

  beforeEach(async () => {
    // Reset mocks
    mockServiceWorker.register.mock.resetCalls();
    mockServiceWorker.unregister.mock.resetCalls();
    mockServiceWorker.update.mock.resetCalls();
    mockRegistration.unregister.mock.resetCalls();
    mockRegistration.update.mock.resetCalls();

    // Import the module after setting up mocks
    const { serviceWorkerManager: manager } = await import('../registration');
    serviceWorkerManager = manager;
  });

  afterEach(() => {
    // Clean up any timers or listeners
  });

  describe('register', () => {
    it('should register service worker successfully', async () => {
      mockServiceWorker.register.mock.mockImplementationOnce(() =>
        Promise.resolve(mockRegistration)
      );

      const callbacks = {
        onInstalling: mock.fn<any>(),
        onActive: mock.fn<any>(),
        onError: mock.fn<any>(),
      };

      const state = await serviceWorkerManager.register(callbacks);

      assert.strictEqual(mockServiceWorker.register.mock.callCount(), 1);
      assert.strictEqual(
        mockServiceWorker.register.mock.calls[0].arguments[0],
        '/sw.js'
      );
      assert.strictEqual(state.isSupported, true);
      assert.strictEqual(state.isRegistered, true);
    });

    it('should handle registration failure', async () => {
      const error = new Error('Registration failed');
      mockServiceWorker.register.mock.mockImplementationOnce(() =>
        Promise.reject(error)
      );

      const callbacks = {
        onError: mock.fn(),
      };

      try {
        await serviceWorkerManager.register(callbacks);
        assert.fail('Should have thrown an error');
      } catch (err) {
        assert.strictEqual(err, error);
        assert.strictEqual(callbacks.onError.mock.callCount(), 1);
        assert.strictEqual(callbacks.onError.mock.calls[0].arguments[0], error);
      }
    });

    it('should throw error when service worker is not supported', async () => {
      // Temporarily remove service worker support
      const originalServiceWorker = global.navigator.serviceWorker;
      delete (global.navigator as any).serviceWorker;

      const callbacks = {
        onError: mock.fn(),
      };

      try {
        await serviceWorkerManager.register(callbacks);
        assert.fail('Should have thrown an error');
      } catch (err) {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('not supported'));
        assert.strictEqual(callbacks.onError.mock.callCount(), 1);
      } finally {
        // Restore service worker support
        (global.navigator as any).serviceWorker = originalServiceWorker;
      }
    });
  });

  describe('unregister', () => {
    it('should unregister service worker successfully', async () => {
      // First register
      mockServiceWorker.register.mock.mockImplementationOnce(() =>
        Promise.resolve(mockRegistration)
      );
      await serviceWorkerManager.register();

      // Then unregister
      mockRegistration.unregister.mock.mockImplementationOnce(() =>
        Promise.resolve(true)
      );

      const result = await serviceWorkerManager.unregister();

      assert.strictEqual(mockRegistration.unregister.mock.callCount(), 1);
      assert.strictEqual(result, true);
    });

    it('should return false when no registration exists', async () => {
      const result = await serviceWorkerManager.unregister();
      assert.strictEqual(result, false);
    });

    it('should handle unregistration failure', async () => {
      // First register
      mockServiceWorker.register.mock.mockImplementationOnce(() =>
        Promise.resolve(mockRegistration)
      );
      await serviceWorkerManager.register();

      // Then fail to unregister
      const error = new Error('Unregistration failed');
      mockRegistration.unregister.mock.mockImplementationOnce(() =>
        Promise.reject(error)
      );

      const callbacks = {
        onError: mock.fn(),
      };
      await serviceWorkerManager.register(callbacks);

      const result = await serviceWorkerManager.unregister();

      assert.strictEqual(result, false);
      assert.strictEqual(callbacks.onError.mock.callCount(), 1);
    });
  });

  describe('update', () => {
    it('should update service worker successfully', async () => {
      // First register
      mockServiceWorker.register.mock.mockImplementationOnce(() =>
        Promise.resolve(mockRegistration)
      );
      await serviceWorkerManager.register();

      // Then update
      mockRegistration.update.mock.mockImplementationOnce(() =>
        Promise.resolve()
      );

      await serviceWorkerManager.update();

      assert.strictEqual(mockRegistration.update.mock.callCount(), 1);
    });

    it('should throw error when no registration exists', async () => {
      try {
        await serviceWorkerManager.update();
        assert.fail('Should have thrown an error');
      } catch (err) {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('not registered'));
      }
    });

    it('should handle update failure', async () => {
      // First register
      mockServiceWorker.register.mock.mockImplementationOnce(() =>
        Promise.resolve(mockRegistration)
      );

      const callbacks = {
        onError: mock.fn(),
      };
      await serviceWorkerManager.register(callbacks);

      // Then fail to update
      const error = new Error('Update failed');
      mockRegistration.update.mock.mockImplementationOnce(() =>
        Promise.reject(error)
      );

      try {
        await serviceWorkerManager.update();
        assert.fail('Should have thrown an error');
      } catch (err) {
        assert.strictEqual(err, error);
        assert.strictEqual(callbacks.onError.mock.callCount(), 1);
      }
    });
  });

  describe('skipWaiting', () => {
    it('should skip waiting successfully', async () => {
      const mockWaitingWorker = {
        postMessage: mock.fn<any>(),
        addEventListener: mock.fn<any>(),
        removeEventListener: mock.fn<any>(),
      };

      const mockActiveWorker = {
        addEventListener: mock.fn<any>(),
        removeEventListener: mock.fn<any>(),
      };

      const registrationWithWaiting = {
        ...mockRegistration,
        waiting: mockWaitingWorker,
        active: mockActiveWorker,
        addEventListener: mock.fn(),
      };

      // First register
      mockServiceWorker.register.mock.mockImplementationOnce(() =>
        Promise.resolve(registrationWithWaiting)
      );
      await serviceWorkerManager.register();

      await serviceWorkerManager.skipWaiting();

      assert.strictEqual(mockWaitingWorker.postMessage.mock.callCount(), 1);
      assert.deepStrictEqual(
        mockWaitingWorker.postMessage.mock.calls[0].arguments[0],
        { type: 'SKIP_WAITING' }
      );
    });

    it('should throw error when no waiting worker exists', async () => {
      // First register
      mockServiceWorker.register.mock.mockImplementationOnce(() =>
        Promise.resolve(mockRegistration)
      );
      await serviceWorkerManager.register();

      try {
        await serviceWorkerManager.skipWaiting();
        assert.fail('Should have thrown an error');
      } catch (err) {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('No waiting service worker'));
      }
    });
  });

  describe('getVersion', () => {
    it('should get version from active service worker', async () => {
      const mockActiveWorker = {
        postMessage: mock.fn(),
      };

      const registrationWithActive = {
        ...mockRegistration,
        active: mockActiveWorker,
      };

      // First register
      mockServiceWorker.register.mock.mockImplementationOnce(() =>
        Promise.resolve(registrationWithActive)
      );
      await serviceWorkerManager.register();

      // Mock the message response
      const versionPromise = serviceWorkerManager.getVersion();

      // Simulate the service worker responding
      setTimeout(() => {
        const messageCall = mockActiveWorker.postMessage.mock.calls[0];
        const port = messageCall.arguments[1][0];
        port.onmessage({ data: { version: '1.0.0' } });
      }, 0);

      const version = await versionPromise;

      assert.strictEqual(version, '1.0.0');
      assert.strictEqual(mockActiveWorker.postMessage.mock.callCount(), 1);
    });

    it('should return null when no active worker exists', async () => {
      const version = await serviceWorkerManager.getVersion();
      assert.strictEqual(version, null);
    });
  });

  describe('clearCache', () => {
    it('should clear cache successfully', async () => {
      const mockActiveWorker = {
        postMessage: mock.fn(),
      };

      const registrationWithActive = {
        ...mockRegistration,
        active: mockActiveWorker,
      };

      // First register
      mockServiceWorker.register.mock.mockImplementationOnce(() =>
        Promise.resolve(registrationWithActive)
      );
      await serviceWorkerManager.register();

      // Mock the message response
      const clearPromise = serviceWorkerManager.clearCache('test-cache');

      // Simulate the service worker responding
      setTimeout(() => {
        const messageCall = mockActiveWorker.postMessage.mock.calls[0];
        const port = messageCall.arguments[1][0];
        port.onmessage({ data: { success: true } });
      }, 0);

      const result = await clearPromise;

      assert.strictEqual(result, true);
      assert.strictEqual(mockActiveWorker.postMessage.mock.callCount(), 1);
    });

    it('should handle cache clear failure', async () => {
      const mockActiveWorker = {
        postMessage: mock.fn(),
      };

      const registrationWithActive = {
        ...mockRegistration,
        active: mockActiveWorker,
      };

      // First register
      mockServiceWorker.register.mock.mockImplementationOnce(() =>
        Promise.resolve(registrationWithActive)
      );
      await serviceWorkerManager.register();

      // Mock the message response
      const clearPromise = serviceWorkerManager.clearCache('test-cache');

      // Simulate the service worker responding with error
      setTimeout(() => {
        const messageCall = mockActiveWorker.postMessage.mock.calls[0];
        const port = messageCall.arguments[1][0];
        port.onmessage({ data: { success: false, error: 'Cache not found' } });
      }, 0);

      try {
        await clearPromise;
        assert.fail('Should have thrown an error');
      } catch (err) {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('Cache not found'));
      }
    });

    it('should throw error when no active worker exists', async () => {
      try {
        await serviceWorkerManager.clearCache();
        assert.fail('Should have thrown an error');
      } catch (err) {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes('No active service worker'));
      }
    });
  });
});
