/**
 * Tests for connectivityMonitor.
 */

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { addEventListener: jest.fn() },
}));

import NetInfo from '@react-native-community/netinfo';
import {
  startNetworkMonitoring,
  stopNetworkMonitoring,
  useNetworkStore,
} from '@/sync/connectivityMonitor';

const mockAddEventListener = NetInfo.addEventListener as jest.Mock;
const mockRemoveListener = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  stopNetworkMonitoring();
  useNetworkStore.setState({ isOnline: true });
  mockAddEventListener.mockReturnValue(mockRemoveListener);
});

afterEach(() => {
  stopNetworkMonitoring();
});

describe('startNetworkMonitoring', () => {
  it('subscribes to NetInfo', () => {
    startNetworkMonitoring(jest.fn());
    expect(mockAddEventListener).toHaveBeenCalledTimes(1);
  });

  it('does not double-subscribe on repeated calls', () => {
    startNetworkMonitoring(jest.fn());
    startNetworkMonitoring(jest.fn());
    expect(mockAddEventListener).toHaveBeenCalledTimes(1);
  });

  it('calls onOnline callback when transitioning offline → online', () => {
    const onOnline = jest.fn();
    startNetworkMonitoring(onOnline);

    const handler = mockAddEventListener.mock.calls[0][0];

    // Transition to offline first
    handler({ isConnected: false, isInternetReachable: false });
    expect(onOnline).not.toHaveBeenCalled();

    // Transition back online
    handler({ isConnected: true, isInternetReachable: true });
    expect(onOnline).toHaveBeenCalledTimes(1);
  });

  it('does not call onOnline when already online and stays online', () => {
    const onOnline = jest.fn();
    startNetworkMonitoring(onOnline);

    const handler = mockAddEventListener.mock.calls[0][0];
    handler({ isConnected: true, isInternetReachable: true });
    expect(onOnline).not.toHaveBeenCalled();
  });

  it('updates the network store state', () => {
    startNetworkMonitoring(jest.fn());
    const handler = mockAddEventListener.mock.calls[0][0];

    handler({ isConnected: false, isInternetReachable: false });
    expect(useNetworkStore.getState().isOnline).toBe(false);

    handler({ isConnected: true, isInternetReachable: true });
    expect(useNetworkStore.getState().isOnline).toBe(true);
  });
});

describe('stopNetworkMonitoring', () => {
  it('calls the unsubscribe function', () => {
    startNetworkMonitoring(jest.fn());
    stopNetworkMonitoring();
    expect(mockRemoveListener).toHaveBeenCalledTimes(1);
  });

  it('is safe to call when not monitoring', () => {
    expect(() => stopNetworkMonitoring()).not.toThrow();
  });
});
