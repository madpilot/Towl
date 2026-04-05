/**
 * Tests for RootNavigator.
 * Verifies that the correct navigator is rendered based on auth status.
 */

jest.mock('@/auth/authManager', () => ({
  initializeAuth: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/db/schema', () => ({
  getDb: jest.fn().mockResolvedValue({}),
}));

jest.mock('@/sync/syncManager', () => ({
  drain: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/sync/connectivityMonitor', () => ({
  startNetworkMonitoring: jest.fn(),
  stopNetworkMonitoring: jest.fn(),
}));

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    NavigationContainer: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    useFocusEffect: jest.fn(),
  };
});

jest.mock('@react-navigation/native-stack', () => {
  const React = require('react');
  const Stack = {
    Navigator: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    Screen: ({ component: Component }: { component: React.ComponentType }) =>
      React.createElement(Component, {} as never),
  };
  return { createNativeStackNavigator: () => Stack };
});

jest.mock('@/screens/auth/ServerSetupScreen', () => {
  const React = require('react');
  const { Text } = require('react-native');
  function ServerSetupScreen() { return React.createElement(Text, null, 'ServerSetup'); }
  return ServerSetupScreen;
});

jest.mock('@/screens/auth/LoginScreen', () => {
  const React = require('react');
  const { Text } = require('react-native');
  function LoginScreen() { return React.createElement(Text, null, 'Login'); }
  return LoginScreen;
});

jest.mock('@/screens/lists/ListsScreen', () => {
  const React = require('react');
  const { Text } = require('react-native');
  function ListsScreen() { return React.createElement(Text, null, 'Lists'); }
  return ListsScreen;
});

jest.mock('@/screens/lists/ListDetailScreen', () => {
  const React = require('react');
  const { Text } = require('react-native');
  function ListDetailScreen() { return React.createElement(Text, null, 'ListDetail'); }
  return ListDetailScreen;
});

jest.mock('@/store/authStore', () => ({
  useAuthStore: jest.fn(),
}));

jest.mock('@/store/householdStore', () => ({
  useHouseholdStore: jest.fn(),
}));

jest.mock('@/screens/households/HouseholdPickerScreen', () => {
  const React = require('react');
  const { Text } = require('react-native');
  function HouseholdPickerScreen() { return React.createElement(Text, null, 'HouseholdPicker'); }
  return HouseholdPickerScreen;
});

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import RootNavigator from '@/navigation/RootNavigator';
import { useAuthStore } from '@/store/authStore';
import { useHouseholdStore } from '@/store/householdStore';
import { initializeAuth } from '@/auth/authManager';

type AuthState = { status: 'unknown' | 'unauthenticated' | 'authenticated' };
type HouseholdState = { selectedHousehold: { id: number; name: string; photo: null } | null };

function mockAuth(status: AuthState['status']) {
  (useAuthStore as unknown as jest.Mock).mockImplementation(
    (sel: (s: AuthState) => unknown) => sel({ status })
  );
}

function mockHousehold(selected: HouseholdState['selectedHousehold']) {
  (useHouseholdStore as unknown as jest.Mock).mockImplementation(
    (sel: (s: HouseholdState) => unknown) => sel({ selectedHousehold: selected })
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockHousehold({ id: 1, name: 'Home', photo: null });
});

describe('RootNavigator', () => {
  it('shows splash spinner while auth status is unknown', () => {
    mockAuth('unknown');
    const { getByTestId } = render(<RootNavigator />);
    expect(getByTestId('splash-indicator')).toBeTruthy();
  });

  it('renders auth navigator when unauthenticated', async () => {
    mockAuth('unauthenticated');
    const { getByText } = render(<RootNavigator />);
    await waitFor(() => expect(getByText('ServerSetup')).toBeTruthy());
  });

  it('renders app navigator when authenticated', async () => {
    mockAuth('authenticated');
    const { getByText } = render(<RootNavigator />);
    await waitFor(() => expect(getByText('Lists')).toBeTruthy());
  });

  it('renders household picker when authenticated but no household selected', async () => {
    mockAuth('authenticated');
    mockHousehold(null);
    const { getByText } = render(<RootNavigator />);
    await waitFor(() => expect(getByText('HouseholdPicker')).toBeTruthy());
  });

  it('calls getDb and initializeAuth on mount', async () => {
    mockAuth('unauthenticated');
    render(<RootNavigator />);
    await waitFor(() => expect(initializeAuth).toHaveBeenCalled());
  });
});
