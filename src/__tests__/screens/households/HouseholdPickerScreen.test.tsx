const mockGetHouseholds = jest.fn();
jest.mock('@/store/authStore', () => ({
  useAuthStore: jest.fn((sel: (s: { householdsApi: { getHouseholds: jest.Mock } }) => unknown) =>
    sel({ householdsApi: { getHouseholds: mockGetHouseholds } })
  ),
}));

jest.mock('@/store/householdStore', () => ({
  useHouseholdStore: jest.fn(),
  persistAndSelectHousehold: jest.fn(),
}));

jest.mock('@/components/TommyOwl', () => {
  const React = require('react');
  const { View } = require('react-native');
  function TommyOwl() {
    return React.createElement(View, { testID: 'tommy-owl' });
  }
  return TommyOwl;
});

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import HouseholdPickerScreen from '@/screens/households/HouseholdPickerScreen';
import { useHouseholdStore, persistAndSelectHousehold } from '@/store/householdStore';
import type { Household } from '@/api/households';

const mockPersistAndSelectHousehold = persistAndSelectHousehold as unknown as jest.Mock;
const mockNavigation = {
  navigate: jest.fn(),
  canGoBack: jest.fn(),
  goBack: jest.fn(),
  reset: jest.fn(),
};
const baseProps = { navigation: mockNavigation as never, route: {} as never };

function makeHousehold(overrides: Partial<Household> = {}): Household {
  return { id: 1, name: 'Home', photo: null, ...overrides };
}

function mockStore(selectedHousehold: Household | null = null) {
  (useHouseholdStore as unknown as jest.Mock).mockImplementation(
    (sel: (s: { selectedHousehold: Household | null; setHouseholds: jest.Mock }) => unknown) =>
      sel({ selectedHousehold, setHouseholds: jest.fn() })
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockStore(null);
  mockNavigation.canGoBack.mockReturnValue(false);
  mockPersistAndSelectHousehold.mockResolvedValue(undefined);
});

describe('HouseholdPickerScreen', () => {
  it('shows loading indicator initially', () => {
    mockGetHouseholds.mockResolvedValue([]);
    const { getByTestId } = render(<HouseholdPickerScreen {...baseProps} />);
    expect(getByTestId('household-loading')).toBeTruthy();
  });

  it('auto-selects when only one household during onboarding (canGoBack = false)', async () => {
    const household = makeHousehold();
    mockGetHouseholds.mockResolvedValue([household]);

    render(<HouseholdPickerScreen {...baseProps} />);

    await waitFor(() => expect(mockPersistAndSelectHousehold).toHaveBeenCalledWith(household));
  });

  it('does not auto-select when only one household and reached from nav bar (canGoBack = true)', async () => {
    mockNavigation.canGoBack.mockReturnValue(true);
    mockStore(makeHousehold());
    const household = makeHousehold();
    mockGetHouseholds.mockResolvedValue([household]);

    const { getByText } = render(<HouseholdPickerScreen {...baseProps} />);

    await waitFor(() => expect(getByText('Home')).toBeTruthy());
    expect(mockPersistAndSelectHousehold).not.toHaveBeenCalled();
  });

  it('renders list of households', async () => {
    mockGetHouseholds.mockResolvedValue([
      makeHousehold({ id: 1, name: 'Home' }),
      makeHousehold({ id: 2, name: 'Office' }),
    ]);

    const { getByText } = render(<HouseholdPickerScreen {...baseProps} />);
    await waitFor(() => {
      expect(getByText('Home')).toBeTruthy();
      expect(getByText('Office')).toBeTruthy();
    });
  });

  describe('in-app mode (canGoBack = true)', () => {
    beforeEach(() => {
      mockNavigation.canGoBack.mockReturnValue(true);
    });

    it('calls persistAndSelectHousehold immediately when a household is tapped', async () => {
      const household = makeHousehold({ id: 2, name: 'Office' });
      mockGetHouseholds.mockResolvedValue([makeHousehold({ id: 1, name: 'Home' }), household]);

      const { getByText } = render(<HouseholdPickerScreen {...baseProps} />);
      await waitFor(() => expect(getByText('Office')).toBeTruthy());

      fireEvent.press(getByText('Office'));
      await waitFor(() => expect(mockPersistAndSelectHousehold).toHaveBeenCalledWith(household));
    });

    it('calls goBack after selecting', async () => {
      mockGetHouseholds.mockResolvedValue([
        makeHousehold({ id: 1, name: 'Home' }),
        makeHousehold({ id: 2, name: 'Office' }),
      ]);

      const { getByText } = render(<HouseholdPickerScreen {...baseProps} />);
      await waitFor(() => expect(getByText('Office')).toBeTruthy());

      fireEvent.press(getByText('Office'));
      await waitFor(() => expect(mockNavigation.goBack).toHaveBeenCalled());
    });

    it('does not show Done button', async () => {
      mockGetHouseholds.mockResolvedValue([makeHousehold()]);

      const { queryByTestId } = render(<HouseholdPickerScreen {...baseProps} />);
      await waitFor(() => expect(queryByTestId('done-button')).toBeNull());
    });
  });

  describe('onboarding mode (canGoBack = false)', () => {
    it('does not call persistAndSelectHousehold when a household is tapped', async () => {
      mockGetHouseholds.mockResolvedValue([
        makeHousehold({ id: 1, name: 'Home' }),
        makeHousehold({ id: 2, name: 'Office' }),
      ]);

      const { getByText } = render(<HouseholdPickerScreen {...baseProps} />);
      await waitFor(() => expect(getByText('Office')).toBeTruthy());

      fireEvent.press(getByText('Office'));
      expect(mockPersistAndSelectHousehold).not.toHaveBeenCalled();
    });

    it('does not call goBack when a household is tapped', async () => {
      mockGetHouseholds.mockResolvedValue([
        makeHousehold({ id: 1, name: 'Home' }),
        makeHousehold({ id: 2, name: 'Office' }),
      ]);

      const { getByText } = render(<HouseholdPickerScreen {...baseProps} />);
      await waitFor(() => expect(getByText('Office')).toBeTruthy());

      fireEvent.press(getByText('Office'));
      expect(mockNavigation.goBack).not.toHaveBeenCalled();
    });

    it('shows Done button when no household is pre-selected (disabled)', async () => {
      mockGetHouseholds.mockResolvedValue([
        makeHousehold({ id: 1, name: 'Home' }),
        makeHousehold({ id: 2, name: 'Office' }),
      ]);

      const { getByTestId } = render(<HouseholdPickerScreen {...baseProps} />);
      await waitFor(() => expect(getByTestId('done-button')).toBeTruthy());
    });

    it('Done button calls persistAndSelectHousehold with the selected household', async () => {
      const office = makeHousehold({ id: 2, name: 'Office' });
      mockGetHouseholds.mockResolvedValue([makeHousehold({ id: 1, name: 'Home' }), office]);

      const { getByText, getByTestId } = render(<HouseholdPickerScreen {...baseProps} />);
      await waitFor(() => expect(getByText('Office')).toBeTruthy());

      fireEvent.press(getByText('Office'));
      fireEvent.press(getByTestId('done-button'));

      await waitFor(() => expect(mockPersistAndSelectHousehold).toHaveBeenCalledWith(office));
    });

    it('Done button does not call persistAndSelectHousehold when no household selected', async () => {
      mockGetHouseholds.mockResolvedValue([
        makeHousehold({ id: 1, name: 'Home' }),
        makeHousehold({ id: 2, name: 'Office' }),
      ]);

      const { getByTestId } = render(<HouseholdPickerScreen {...baseProps} />);
      await waitFor(() => expect(getByTestId('done-button')).toBeTruthy());

      fireEvent.press(getByTestId('done-button'));
      expect(mockPersistAndSelectHousehold).not.toHaveBeenCalled();
    });

    it('resets navigation to ListDetail when selectedHousehold becomes non-null', async () => {
      const household = makeHousehold();
      mockGetHouseholds.mockResolvedValue([household, makeHousehold({ id: 2, name: 'Office' })]);

      // Start with no selection, then simulate store updating after Done.
      const { rerender } = render(<HouseholdPickerScreen {...baseProps} />);
      mockStore(household);
      rerender(<HouseholdPickerScreen {...baseProps} />);

      await waitFor(() =>
        expect(mockNavigation.reset).toHaveBeenCalledWith({
          index: 0,
          routes: [{ name: 'ListDetail' }],
        })
      );
    });

    it('does not reset navigation when canGoBack is true and selectedHousehold is set', async () => {
      mockNavigation.canGoBack.mockReturnValue(true);
      mockStore(makeHousehold());
      mockGetHouseholds.mockResolvedValue([makeHousehold()]);

      render(<HouseholdPickerScreen {...baseProps} />);
      await waitFor(() => expect(mockNavigation.goBack).not.toHaveBeenCalled());
      expect(mockNavigation.reset).not.toHaveBeenCalled();
    });
  });

  it('shows error message when API fails', async () => {
    mockGetHouseholds.mockRejectedValue(new Error('Network error'));

    const { getByText } = render(<HouseholdPickerScreen {...baseProps} />);
    await waitFor(() => expect(getByText(/Could not load households/)).toBeTruthy());
  });

  it('shows back button when canGoBack is true', async () => {
    mockNavigation.canGoBack.mockReturnValue(true);
    mockStore(makeHousehold());
    mockGetHouseholds.mockResolvedValue([
      makeHousehold({ id: 1, name: 'Home' }),
      makeHousehold({ id: 2, name: 'Office' }),
    ]);

    const { getByText } = render(<HouseholdPickerScreen {...baseProps} />);
    await waitFor(() => expect(getByText('‹ Back')).toBeTruthy());
  });
});
