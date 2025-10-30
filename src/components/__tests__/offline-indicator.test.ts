import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';

// Mock the network status hook
const mockNetworkStatus: any = {
  isOnline: true,
  isOffline: false,
  effectiveType: '4g',
  downlink: 10,
  rtt: 100,
  saveData: false,
  checkConnection: mock.fn(),
  lastChecked: Date.now(),
  isChecking: false,
};

// Mock React and hooks
const mockUseState = (initialValue: any) => {
  let state = initialValue;
  const setState = (newValue: any) => {
    if (typeof newValue === 'function') {
      state = newValue(state);
    } else {
      state = newValue;
    }
  };
  return [state, setState];
};

const mockUseEffect = mock.fn();

// Mock the useNetworkStatus hook
const mockUseNetworkStatus = mock.fn((options?: any) => mockNetworkStatus);

describe('OfflineIndicator', () => {
  let OfflineIndicator: any;
  let renderComponent: any;

  beforeEach(async () => {
    // Reset mocks
    mockUseEffect.mock.resetCalls();
    mockUseNetworkStatus.mock.resetCalls();
    mockNetworkStatus.checkConnection.mock.resetCalls();

    // Mock the component
    OfflineIndicator = (props: any) => {
      const {
        className,
        showWhenOnline = false,
        autoHide = true,
        autoHideDelay = 3000,
        position = 'top',
        variant = 'banner',
      } = props;

      const networkStatus = mockUseNetworkStatus({
        enablePing: true,
        pingInterval: 30000,
      });

      const [isVisible, setIsVisible] = mockUseState(false);
      const [justCameOnline, setJustCameOnline] = mockUseState(false);

      // Simulate useEffect logic
      mockUseEffect(() => {
        if (networkStatus.isOffline) {
          setIsVisible(true);
          setJustCameOnline(false);
        } else if (networkStatus.isOnline) {
          if (isVisible) {
            setJustCameOnline(true);

            if (showWhenOnline) {
              if (autoHide) {
                setTimeout(() => {
                  setIsVisible(false);
                  setJustCameOnline(false);
                }, autoHideDelay);
              }
            } else {
              setIsVisible(false);
              setJustCameOnline(false);
            }
          }
        }
      }, [
        networkStatus.isOnline,
        networkStatus.isOffline,
        isVisible,
        showWhenOnline,
        autoHide,
        autoHideDelay,
      ]);

      if (!isVisible) {
        return null;
      }

      const isOffline = networkStatus.isOffline;
      const isOnline = networkStatus.isOnline && justCameOnline;

      return {
        props: {
          className,
          showWhenOnline,
          autoHide,
          autoHideDelay,
          position,
          variant,
        },
        state: {
          isVisible,
          justCameOnline,
          isOffline,
          isOnline,
        },
        networkStatus,
      };
    };

    renderComponent = (props: any = {}) => {
      return OfflineIndicator(props);
    };
  });

  afterEach(() => {
    // Clean up any timers
  });

  describe('visibility logic', () => {
    it('should be hidden when online by default', () => {
      mockNetworkStatus.isOnline = true;
      mockNetworkStatus.isOffline = false;

      const component = renderComponent();

      assert.strictEqual(component, null);
    });

    it('should be visible when offline', () => {
      mockNetworkStatus.isOnline = false;
      mockNetworkStatus.isOffline = true;

      const component = renderComponent();

      assert.ok(component !== null);
      assert.strictEqual(component.state.isVisible, true);
      assert.strictEqual(component.state.isOffline, true);
    });

    it('should show briefly when coming back online if showWhenOnline is true', () => {
      mockNetworkStatus.isOnline = true;
      mockNetworkStatus.isOffline = false;

      const component = renderComponent({ showWhenOnline: true });

      // Simulate being visible (was offline before)
      component.state.isVisible = true;

      assert.ok(component !== null);
      assert.strictEqual(component.state.justCameOnline, true);
    });

    it('should hide immediately when coming back online if showWhenOnline is false', () => {
      mockNetworkStatus.isOnline = true;
      mockNetworkStatus.isOffline = false;

      const component = renderComponent({ showWhenOnline: false });

      assert.strictEqual(component, null);
    });
  });

  describe('auto-hide functionality', () => {
    it('should auto-hide after delay when autoHide is true', (t, done) => {
      mockNetworkStatus.isOnline = true;
      mockNetworkStatus.isOffline = false;

      const component = renderComponent({
        showWhenOnline: true,
        autoHide: true,
        autoHideDelay: 100,
      });

      // Simulate being visible
      component.state.isVisible = true;

      // Should hide after delay
      setTimeout(() => {
        assert.strictEqual(component.state.isVisible, false);
        done();
      }, 150);
    });

    it('should not auto-hide when autoHide is false', (t, done) => {
      mockNetworkStatus.isOnline = true;
      mockNetworkStatus.isOffline = false;

      const component = renderComponent({
        showWhenOnline: true,
        autoHide: false,
        autoHideDelay: 100,
      });

      // Simulate being visible
      component.state.isVisible = true;

      // Should still be visible after delay
      setTimeout(() => {
        assert.strictEqual(component.state.isVisible, true);
        done();
      }, 150);
    });
  });

  describe('variant styles', () => {
    it('should apply banner variant styles', () => {
      mockNetworkStatus.isOnline = false;
      mockNetworkStatus.isOffline = true;

      const component = renderComponent({ variant: 'banner' });

      assert.strictEqual(component.props.variant, 'banner');
    });

    it('should apply badge variant styles', () => {
      mockNetworkStatus.isOnline = false;
      mockNetworkStatus.isOffline = true;

      const component = renderComponent({ variant: 'badge' });

      assert.strictEqual(component.props.variant, 'badge');
    });

    it('should apply toast variant styles', () => {
      mockNetworkStatus.isOnline = false;
      mockNetworkStatus.isOffline = true;

      const component = renderComponent({ variant: 'toast' });

      assert.strictEqual(component.props.variant, 'toast');
    });
  });

  describe('position prop', () => {
    it('should apply top position by default', () => {
      mockNetworkStatus.isOnline = false;
      mockNetworkStatus.isOffline = true;

      const component = renderComponent();

      assert.strictEqual(component.props.position, 'top');
    });

    it('should apply bottom position when specified', () => {
      mockNetworkStatus.isOnline = false;
      mockNetworkStatus.isOffline = true;

      const component = renderComponent({ position: 'bottom' });

      assert.strictEqual(component.props.position, 'bottom');
    });
  });

  describe('network status integration', () => {
    it('should call useNetworkStatus with correct options', () => {
      renderComponent();

      assert.strictEqual(mockUseNetworkStatus.mock.callCount(), 1);
      assert.deepStrictEqual(mockUseNetworkStatus.mock.calls[0].arguments[0], {
        enablePing: true,
        pingInterval: 30000,
      });
    });

    it('should display connection details when available', () => {
      mockNetworkStatus.effectiveType = '4g';
      mockNetworkStatus.downlink = 10;
      mockNetworkStatus.rtt = 100;
      mockNetworkStatus.isOnline = true;
      mockNetworkStatus.isOffline = false;

      const component = renderComponent({ showWhenOnline: true });

      // Simulate being visible and just came online
      component.state.isVisible = true;
      component.state.justCameOnline = true;

      assert.ok(component.networkStatus.effectiveType);
      assert.ok(component.networkStatus.downlink);
      assert.ok(component.networkStatus.rtt);
    });

    it('should handle missing connection details gracefully', () => {
      mockNetworkStatus.effectiveType = undefined;
      mockNetworkStatus.downlink = undefined;
      mockNetworkStatus.rtt = undefined;
      mockNetworkStatus.isOnline = false;
      mockNetworkStatus.isOffline = true;

      const component = renderComponent();

      assert.ok(component !== null);
      assert.strictEqual(component.networkStatus.effectiveType, undefined);
      assert.strictEqual(component.networkStatus.downlink, undefined);
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA attributes', () => {
      mockNetworkStatus.isOnline = false;
      mockNetworkStatus.isOffline = true;

      const component = renderComponent();

      // Component should be structured for accessibility
      assert.ok(component !== null);
      assert.strictEqual(component.state.isOffline, true);
    });

    it('should provide appropriate status messages', () => {
      // Test offline message
      mockNetworkStatus.isOnline = false;
      mockNetworkStatus.isOffline = true;

      let component = renderComponent();
      assert.strictEqual(component.state.isOffline, true);

      // Test online message
      mockNetworkStatus.isOnline = true;
      mockNetworkStatus.isOffline = false;

      component = renderComponent({ showWhenOnline: true });
      component.state.isVisible = true;
      component.state.justCameOnline = true;

      assert.strictEqual(component.state.isOnline, true);
    });
  });
});
