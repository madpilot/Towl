/**
 * Tests for ListsScreen.
 */

jest.mock('@/db/lists', () => ({
  getAllLists: jest.fn(),
  getListByServerId: jest.fn(),
  upsertListFromServer: jest.fn(),
  createListLocally: jest.fn(),
  softDeleteList: jest.fn(),
  hardDeleteList: jest.fn(),
}));

jest.mock('@/db/items', () => ({
  upsertItemFromServer: jest.fn(),
}));

jest.mock('@/db/syncQueue', () => ({
  enqueue: jest.fn(),
}));

jest.mock('@/api/shoppinglists', () => ({
  getShoppingLists: jest.fn(),
}));

jest.mock('@/data/foodMatcher', () => ({
  matchItem: jest.fn(() => ({ iconKey: null, emoji: null, category: 'Other' })),
}));

jest.mock('@/store/householdStore', () => ({
  useHouseholdStore: jest.fn((selector: (s: { selectedHousehold: { id: number } | null }) => unknown) =>
    selector({ selectedHousehold: { id: 1 } })
  ),
}));

jest.mock('@/store/authStore', () => ({
  useAuthStore: jest.fn((selector: (s: { serverUrl: string | null }) => unknown) =>
    selector({ serverUrl: 'https://kitchen.local' })
  ),
}));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => (() => void) | void) => {
    const React = require('react');
    React.useEffect(cb, []);
  },
}));

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import ListsScreen from '@/screens/lists/ListsScreen';
import * as listsDb from '@/db/lists';
import * as syncQueue from '@/db/syncQueue';
import type { LocalList } from '@/db/lists';

const mockNavigate = jest.fn();
const baseProps = {
  navigation: { navigate: mockNavigate } as never,
  route: {} as never,
};

function makeList(overrides: Partial<LocalList> = {}): LocalList {
  return {
    localId: 'local-1',
    serverId: 10,
    householdId: 1,
    name: 'Groceries',
    isDirty: false,
    isDeleted: false,
    lastSynced: Date.now(),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  (listsDb.getAllLists as jest.Mock).mockResolvedValue([]);
  (listsDb.getListByServerId as jest.Mock).mockResolvedValue(null);
  (listsDb.upsertListFromServer as jest.Mock).mockResolvedValue(makeList());
  (listsDb.createListLocally as jest.Mock).mockResolvedValue(makeList({ localId: 'new-1' }));
  (syncQueue.enqueue as jest.Mock).mockResolvedValue({});
});

describe('ListsScreen', () => {
  it('renders empty state when no lists', async () => {
    const { getByText } = render(<ListsScreen {...baseProps} />);
    await waitFor(() => expect(getByText('No shopping lists yet.')).toBeTruthy());
  });

  it('renders list items from db', async () => {
    (listsDb.getAllLists as jest.Mock).mockResolvedValue([
      makeList({ name: 'Groceries' }),
      makeList({ localId: 'local-2', serverId: 11, name: 'Hardware' }),
    ]);

    const { getByText } = render(<ListsScreen {...baseProps} />);
    await waitFor(() => {
      expect(getByText('Groceries')).toBeTruthy();
      expect(getByText('Hardware')).toBeTruthy();
    });
  });

  it('navigates to ListDetail when a list is pressed', async () => {
    const list = makeList({ name: 'Groceries' });
    (listsDb.getAllLists as jest.Mock).mockResolvedValue([list]);

    const { getByText } = render(<ListsScreen {...baseProps} />);
    await waitFor(() => expect(getByText('Groceries')).toBeTruthy());

    await act(async () => { fireEvent.press(getByText('Groceries')); });

    expect(mockNavigate).toHaveBeenCalledWith('ListDetail', {
      listLocalId: list.localId,
      listName: list.name,
      listServerId: list.serverId,
    });
  });

  it('opens create modal and creates a list', async () => {
    (listsDb.getAllLists as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValue([makeList({ name: 'Meal Prep' })]);

    const { getByTestId, getByText } = render(<ListsScreen {...baseProps} />);
    await waitFor(() => expect(getByText('No shopping lists yet.')).toBeTruthy());

    await act(async () => { fireEvent.press(getByTestId('create-list-fab')); });
    fireEvent.changeText(getByTestId('new-list-input'), 'Meal Prep');
    await act(async () => { fireEvent.press(getByTestId('confirm-create-list')); });

    await waitFor(() => {
      expect(listsDb.createListLocally).toHaveBeenCalledWith(1, 'Meal Prep');
      expect(syncQueue.enqueue).toHaveBeenCalled();
    });
  });

  it('shows dirty dot for unsynced lists', async () => {
    (listsDb.getAllLists as jest.Mock).mockResolvedValue([
      makeList({ isDirty: true }),
    ]);
    const { UNSAFE_getAllByProps } = render(<ListsScreen {...baseProps} />);
    await waitFor(() => {
      // The dirty dot is a View with the dirtyDot style (backgroundColor #f59e0b)
      const dots = UNSAFE_getAllByProps({ testID: undefined }).filter(
        (el) => el.props.style?.backgroundColor === '#f59e0b'
      );
      expect(dots.length).toBeGreaterThan(0);
    });
  });
});
