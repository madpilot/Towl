/**
 * Tests for ServerSetupScreen.
 * Verifies URL validation, connection testing, navigation, and error states.
 */

jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  function Svg({ children }: { children?: React.ReactNode }) { return React.createElement(View, null, children); }
  function Path() { return null; }
  function Circle() { return null; }
  function Ellipse() { return null; }
  function Line() { return null; }
  return { __esModule: true, default: Svg, Path, Circle, Ellipse, Line };
});

jest.mock('@/api/auth', () => ({
  testConnection: jest.fn(),
}));

jest.mock('@/auth/tokenStore', () => ({
  TokenStore: { instance: { saveServerUrl: jest.fn() } },
}));

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import ServerSetupScreen from '@/screens/auth/ServerSetupScreen';
import * as authApi from '@/api/auth';
import { TokenStore } from '@/auth/tokenStore';

const mockNavigate = jest.fn();
const baseProps = {
  navigation: { navigate: mockNavigate } as never,
  route: {} as never,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ServerSetupScreen', () => {
  it('renders wordmark and URL input', () => {
    const { getByText, getByPlaceholderText } = render(
      <ServerSetupScreen {...baseProps} />,
    );
    expect(getByText('towl')).toBeTruthy();
    expect(getByPlaceholderText('https://kitchenowl.example.com')).toBeTruthy();
  });

  it('shows error when URL is empty', async () => {
    const { getByTestId, getByText } = render(<ServerSetupScreen {...baseProps} />);
    await act(async () => {
      fireEvent.press(getByTestId('connect-btn'));
    });
    expect(getByText('Pop a server URL in there 👆')).toBeTruthy();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows error when URL is invalid', async () => {
    const { getByTestId, getByText, getByPlaceholderText } = render(
      <ServerSetupScreen {...baseProps} />,
    );
    fireEvent.changeText(
      getByPlaceholderText('https://kitchenowl.example.com'),
      'not-a-url',
    );
    await act(async () => {
      fireEvent.press(getByTestId('connect-btn'));
    });
    expect(getByText("Hmm, that doesn't look like a valid URL…")).toBeTruthy();
  });

  it('shows error when server is unreachable', async () => {
    (authApi.testConnection as jest.Mock).mockResolvedValue(false);
    const { getByTestId, getByText, getByPlaceholderText } = render(
      <ServerSetupScreen {...baseProps} />,
    );
    fireEvent.changeText(
      getByPlaceholderText('https://kitchenowl.example.com'),
      'https://nowhere.example.com',
    );
    await act(async () => {
      fireEvent.press(getByTestId('connect-btn'));
    });
    await waitFor(() =>
      expect(
        getByText('Could not reach the server. Check the URL and try again.'),
      ).toBeTruthy(),
    );
  });

  it('saves URL and navigates to Login on success', async () => {
    (authApi.testConnection as jest.Mock).mockResolvedValue(true);
    (TokenStore.instance.saveServerUrl as jest.Mock).mockResolvedValue(undefined);

    const { getByTestId, getByPlaceholderText } = render(
      <ServerSetupScreen {...baseProps} />,
    );
    fireEvent.changeText(
      getByPlaceholderText('https://kitchenowl.example.com'),
      'https://kitchen.local',
    );
    await act(async () => {
      fireEvent.press(getByTestId('connect-btn'));
    });

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('Login', {
        serverUrl: 'https://kitchen.local',
      }),
    );
    expect(TokenStore.instance.saveServerUrl).toHaveBeenCalledWith('https://kitchen.local');
  });
});
