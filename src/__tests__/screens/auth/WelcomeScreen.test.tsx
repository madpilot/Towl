/**
 * Tests for WelcomeScreen.
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

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import WelcomeScreen from '@/screens/auth/WelcomeScreen';

const mockNavigate = jest.fn();
const baseProps = {
  navigation: { navigate: mockNavigate } as never,
  route: {} as never,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('WelcomeScreen', () => {
  it('renders the wordmark', () => {
    const { getByText } = render(<WelcomeScreen {...baseProps} />);
    expect(getByText('towl')).toBeTruthy();
  });

  it('shows tagline text after animation completes', async () => {
    const { getByText } = render(<WelcomeScreen {...baseProps} />);
    await waitFor(() => expect(getByText('Never forget the milk.')).toBeTruthy(), {
      timeout: 2000,
    });
  });

  it('navigates to ServerSetup when button is pressed', async () => {
    const { getByTestId } = render(<WelcomeScreen {...baseProps} />);
    // Button is in the tree immediately (opacity animates but element exists)
    fireEvent.press(getByTestId('welcome-next-btn'));
    expect(mockNavigate).toHaveBeenCalledWith('ServerSetup');
  });
});
