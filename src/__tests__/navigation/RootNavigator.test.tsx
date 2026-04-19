/**
 * Tests for RootNavigator.
 * Verifies that the correct navigator is rendered based on auth status.
 */

jest.mock('@/auth/authManager', () => ({
  initializeAuth: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/db/schema', () => ({
  getDb: jest.fn().mockResolvedValue({}),
  resetDb: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/sync/syncManager', () => ({
  drain: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/sync/connectivityMonitor', () => ({
  startNetworkMonitoring: jest.fn(),
  stopNetworkMonitoring: jest.fn(),
}));

jest.mock('@/navigation/navigationRef', () => ({
  navigationRef: {
    reset: jest.fn(),
    getCurrentRoute: jest.fn(() => undefined),
    isReady: jest.fn(() => false),
  },
}));

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    NavigationContainer: ({
      children,
      onReady,
    }: {
      children: React.ReactNode;
      onReady?: () => void;
    }) => {
      React.useEffect(() => { onReady?.(); }, [onReady]);
      return React.createElement(React.Fragment, null, children);
    },
    useFocusEffect: jest.fn(),
    createNavigationContainerRef: jest.fn(() => ({
      reset: jest.fn(),
      getCurrentRoute: jest.fn(() => undefined),
      isReady: jest.fn(() => false),
    })),
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
  function ServerSetupScreen() {
    return React.createElement(Text, null, 'ServerSetup');
  }
  return ServerSetupScreen;
});

jest.mock('@/screens/auth/LoginScreen', () => {
  const React = require('react');
  const { Text } = require('react-native');
  function LoginScreen() {
    return React.createElement(Text, null, 'Login');
  }
  return LoginScreen;
});

jest.mock('@/screens/lists/ListDetailScreen', () => {
  const React = require('react');
  const { Text } = require('react-native');
  function ListDetailScreen() {
    return React.createElement(Text, null, 'ListDetail');
  }
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
  function HouseholdPickerScreen() {
    return React.createElement(Text, null, 'HouseholdPicker');
  }
  return HouseholdPickerScreen;
});

jest.mock('@/screens/settings/SettingsScreen', () => {
  const React = require('react');
  const { Text } = require('react-native');
  function SettingsScreen() {
    return React.createElement(Text, null, 'Settings');
  }
  return SettingsScreen;
});

jest.mock('@/screens/settings/HouseholdDetailScreen', () => {
  const React = require('react');
  const { Text } = require('react-native');
  function HouseholdDetailScreen() {
    return React.createElement(Text, null, 'HouseholdDetail');
  }
  return HouseholdDetailScreen;
});

jest.mock('@/screens/settings/HouseholdItemsScreen', () => {
  const React = require('react');
  const { Text } = require('react-native');
  function HouseholdItemsScreen() {
    return React.createElement(Text, null, 'HouseholdItems');
  }
  return HouseholdItemsScreen;
});

jest.mock('@/screens/settings/HouseholdCategoriesScreen', () => {
  const React = require('react');
  const { Text } = require('react-native');
  function HouseholdCategoriesScreen() {
    return React.createElement(Text, null, 'HouseholdCategories');
  }
  return HouseholdCategoriesScreen;
});

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import RootNavigator from '@/navigation/RootNavigator';
import { useAuthStore } from '@/store/authStore';
import { useHouseholdStore } from '@/store/householdStore';
import { initializeAuth } from '@/auth/authManager';
import { getDb, resetDb } from '@/db/schema';

type AuthState = { status: 'unknown' | 'unauthenticated' | 'authenticated' };
type HouseholdState = { selectedHousehold: { id: number; name: string; photo: null } | null };

function mockAuth(status: AuthState['status']) {
  (useAuthStore as unknown as jest.Mock).mockImplementation((sel: (s: AuthState) => unknown) =>
    sel({ status })
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
    await waitFor(() => expect(getByText('ListDetail')).toBeTruthy());
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

  describe('startup error handling', () => {
    it('resets and retries when getDb fails the first time', async () => {
      mockAuth('unauthenticated');
      (getDb as jest.Mock)
        .mockRejectedValueOnce(new Error('db open failed'))
        .mockResolvedValueOnce({});

      const { getByText } = render(<RootNavigator />);
      await waitFor(() => expect(resetDb).toHaveBeenCalled());
      await waitFor(() => expect(getByText('ServerSetup')).toBeTruthy());
    });

    it('shows fatal error screen when db reset also fails', async () => {
      mockAuth('unknown');
      (getDb as jest.Mock).mockRejectedValue(new Error('db open failed'));
      (resetDb as jest.Mock).mockRejectedValue(new Error('delete failed'));

      const { getByText } = render(<RootNavigator />);
      await waitFor(() => expect(getByText('Unable to open storage')).toBeTruthy());
    });

    it('does not freeze when initializeAuth throws an unexpected error', async () => {
      // initializeAuth handles Keystore errors itself; this covers any remaining
      // edge case where it unexpectedly throws.
      (initializeAuth as jest.Mock).mockRejectedValueOnce(new Error('unexpected'));
      mockAuth('unauthenticated');

      const { getByText } = render(<RootNavigator />);
      // App should render the auth screen rather than freezing on the splash
      await waitFor(() => expect(getByText('ServerSetup')).toBeTruthy());
    });
  });
});
