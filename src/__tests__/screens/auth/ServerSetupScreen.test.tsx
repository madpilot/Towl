/**
 * Tests for ServerSetupScreen.
 * Verifies URL validation, connection testing, navigation, and error states.
 */

jest.mock('@/api/auth', () => ({
  testConnection: jest.fn(),
}));

jest.mock('@/auth/tokenStore', () => ({
  saveServerUrl: jest.fn(),
}));

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import ServerSetupScreen from '@/screens/auth/ServerSetupScreen';
import * as authApi from '@/api/auth';
import * as tokenStore from '@/auth/tokenStore';

// Minimal navigation/route mocks
const mockNavigate = jest.fn();
const baseProps = {
  navigation: { navigate: mockNavigate } as never,
  route: {} as never,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ServerSetupScreen', () => {
  it('renders title and input', () => {
    const { getByText, getByPlaceholderText } = render(
      <ServerSetupScreen {...baseProps} />
    );
    expect(getByText('Towl')).toBeTruthy();
    expect(getByPlaceholderText('https://kitchenowl.example.com')).toBeTruthy();
  });

  it('shows error when URL is empty', async () => {
    const { getByText } = render(<ServerSetupScreen {...baseProps} />);
    await act(async () => { fireEvent.press(getByText('Connect')); });
    expect(getByText('Please enter your KitchenOwl server URL.')).toBeTruthy();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows error when URL missing protocol', async () => {
    const { getByText, getByPlaceholderText } = render(
      <ServerSetupScreen {...baseProps} />
    );
    fireEvent.changeText(
      getByPlaceholderText('https://kitchenowl.example.com'),
      'kitchenowl.example.com'
    );
    await act(async () => { fireEvent.press(getByText('Connect')); });
    expect(getByText('URL must start with http:// or https://')).toBeTruthy();
  });

  it('shows error when server is unreachable', async () => {
    (authApi.testConnection as jest.Mock).mockResolvedValue(false);
    const { getByText, getByPlaceholderText } = render(
      <ServerSetupScreen {...baseProps} />
    );
    fireEvent.changeText(
      getByPlaceholderText('https://kitchenowl.example.com'),
      'https://nowhere.example.com'
    );
    await act(async () => { fireEvent.press(getByText('Connect')); });
    await waitFor(() =>
      expect(
        getByText('Could not reach the server. Check the URL and try again.')
      ).toBeTruthy()
    );
  });

  it('saves URL and navigates to Login on success', async () => {
    (authApi.testConnection as jest.Mock).mockResolvedValue(true);
    (tokenStore.saveServerUrl as jest.Mock).mockResolvedValue(undefined);

    const { getByText, getByPlaceholderText } = render(
      <ServerSetupScreen {...baseProps} />
    );
    fireEvent.changeText(
      getByPlaceholderText('https://kitchenowl.example.com'),
      'https://kitchen.local'
    );
    await act(async () => { fireEvent.press(getByText('Connect')); });

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('Login', {
        serverUrl: 'https://kitchen.local',
      })
    );
    expect(tokenStore.saveServerUrl).toHaveBeenCalledWith('https://kitchen.local');
  });
});
