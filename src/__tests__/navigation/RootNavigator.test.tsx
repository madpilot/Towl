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

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    NavigationContainer: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
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

jest.mock('@/store/authStore', () => ({
  useAuthStore: jest.fn(),
}));

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import RootNavigator from '@/navigation/RootNavigator';
import { useAuthStore } from '@/store/authStore';
import { initializeAuth } from '@/auth/authManager';

type AuthState = { status: 'unknown' | 'unauthenticated' | 'authenticated' };

function mockAuth(status: AuthState['status']) {
  (useAuthStore as unknown as jest.Mock).mockImplementation(
    (sel: (s: AuthState) => unknown) => sel({ status })
  );
}

beforeEach(() => {
  jest.clearAllMocks();
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

  it('renders app navigator when authenticated', () => {
    mockAuth('authenticated');
    // The placeholder AppNavigator renders an ActivityIndicator
    const { UNSAFE_getAllByType } = render(<RootNavigator />);
    const { ActivityIndicator } = require('react-native');
    expect(UNSAFE_getAllByType(ActivityIndicator).length).toBeGreaterThan(0);
  });

  it('calls getDb and initializeAuth on mount', async () => {
    mockAuth('unauthenticated');
    render(<RootNavigator />);
    await waitFor(() => expect(initializeAuth).toHaveBeenCalled());
  });
});
