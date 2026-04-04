/**
 * Tests for SyncIndicator.
 */

jest.mock('@/store/syncStore', () => ({
  useSyncStore: jest.fn(),
}));

jest.mock('@/sync/connectivityMonitor', () => ({
  useNetworkStore: jest.fn(),
}));

import React from 'react';
import { render } from '@testing-library/react-native';
import SyncIndicator from '@/components/SyncIndicator';
import { useSyncStore } from '@/store/syncStore';
import { useNetworkStore } from '@/sync/connectivityMonitor';

type SyncState = { status: 'idle' | 'syncing' | 'error'; pendingCount: number };
type NetworkState = { isOnline: boolean };

function mockStores(sync: SyncState, network: NetworkState) {
  (useSyncStore as unknown as jest.Mock).mockImplementation(
    (sel: (s: SyncState) => unknown) => sel(sync)
  );
  (useNetworkStore as unknown as jest.Mock).mockImplementation(
    (sel: (s: NetworkState) => unknown) => sel(network)
  );
}

describe('SyncIndicator', () => {
  it('renders nothing when idle, no pending, and online', () => {
    mockStores({ status: 'idle', pendingCount: 0 }, { isOnline: true });
    const { toJSON } = render(<SyncIndicator />);
    expect(toJSON()).toBeNull();
  });

  it('renders offline pill when offline', () => {
    mockStores({ status: 'idle', pendingCount: 0 }, { isOnline: false });
    const { getByTestId } = render(<SyncIndicator />);
    expect(getByTestId('sync-offline')).toBeTruthy();
  });

  it('renders syncing indicator when status is syncing', () => {
    mockStores({ status: 'syncing', pendingCount: 3 }, { isOnline: true });
    const { getByTestId } = render(<SyncIndicator />);
    expect(getByTestId('sync-syncing')).toBeTruthy();
  });

  it('renders error pill when status is error', () => {
    mockStores({ status: 'error', pendingCount: 2 }, { isOnline: true });
    const { getByTestId, getByText } = render(<SyncIndicator />);
    expect(getByTestId('sync-error')).toBeTruthy();
    expect(getByText('2 pending')).toBeTruthy();
  });

  it('renders pending pill when idle with pending count', () => {
    mockStores({ status: 'idle', pendingCount: 5 }, { isOnline: true });
    const { getByTestId, getByText } = render(<SyncIndicator />);
    expect(getByTestId('sync-pending')).toBeTruthy();
    expect(getByText('5 pending')).toBeTruthy();
  });
});
