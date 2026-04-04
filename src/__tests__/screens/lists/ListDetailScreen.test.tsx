/**
 * Tests for ListDetailScreen.
 */

jest.mock('@/db/items', () => ({
  getItemsForList: jest.fn(),
  addItemLocally: jest.fn(),
  softDeleteItem: jest.fn(),
  hardDeleteItem: jest.fn(),
  upsertItemFromServer: jest.fn(),
}));

jest.mock('@/db/syncQueue', () => ({
  enqueue: jest.fn(),
}));

jest.mock('@/db/history', () => ({
  recordItemUsed: jest.fn(),
}));

jest.mock('@/api/shoppinglists', () => ({
  getShoppingListItems: jest.fn(),
}));

jest.mock('@/data/foodMatcher', () => ({
  matchItem: jest.fn(() => ({ iconKey: 'apple', emoji: '🍎', category: 'Produce' })),
  suggestIcons: jest.fn(() => []),
}));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: () => (() => void) | void) => {
    const React = require('react');
    React.useEffect(cb, []);
  },
}));

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import ListDetailScreen from '@/screens/lists/ListDetailScreen';
import * as itemsDb from '@/db/items';
import * as syncQueue from '@/db/syncQueue';
import * as historyDb from '@/db/history';
import type { LocalItem } from '@/db/items';

const baseRoute = {
  params: { listLocalId: 'list-local-1', listName: 'Groceries', listServerId: 5 },
} as never;

const baseProps = {
  navigation: {} as never,
  route: baseRoute,
};

function makeItem(overrides: Partial<LocalItem> = {}): LocalItem {
  return {
    localId: 'item-1',
    serverId: 100,
    listLocalId: 'list-local-1',
    name: 'Milk',
    description: '',
    iconKey: 'milk',
    category: 'Dairy & Eggs',
    isChecked: false,
    isDirty: false,
    isDeleted: false,
    createdAt: Date.now(),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  (itemsDb.getItemsForList as jest.Mock).mockResolvedValue([]);
  (itemsDb.addItemLocally as jest.Mock).mockResolvedValue(makeItem({ localId: 'new-item' }));
  (itemsDb.softDeleteItem as jest.Mock).mockResolvedValue(undefined);
  (itemsDb.hardDeleteItem as jest.Mock).mockResolvedValue(undefined);
  (itemsDb.upsertItemFromServer as jest.Mock).mockResolvedValue(makeItem());
  (syncQueue.enqueue as jest.Mock).mockResolvedValue({});
  (historyDb.recordItemUsed as jest.Mock).mockResolvedValue(undefined);
});

describe('ListDetailScreen', () => {
  it('renders empty state when no items', async () => {
    const { getByText } = render(<ListDetailScreen {...baseProps} />);
    await waitFor(() => expect(getByText('List is empty.')).toBeTruthy());
  });

  it('renders items from db', async () => {
    (itemsDb.getItemsForList as jest.Mock).mockResolvedValue([
      makeItem({ name: 'Milk' }),
      makeItem({ localId: 'item-2', name: 'Eggs' }),
    ]);

    const { getByText } = render(<ListDetailScreen {...baseProps} />);
    await waitFor(() => {
      expect(getByText('Milk')).toBeTruthy();
      expect(getByText('Eggs')).toBeTruthy();
    });
  });

  it('adds item locally and enqueues sync op', async () => {
    (itemsDb.getItemsForList as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValue([makeItem({ name: 'Bread' })]);

    const { getByTestId } = render(<ListDetailScreen {...baseProps} />);
    await waitFor(() => expect(getByTestId('add-item-fab')).toBeTruthy());

    await act(async () => { fireEvent.press(getByTestId('add-item-fab')); });
    fireEvent.changeText(getByTestId('item-name-input'), 'Bread');
    await act(async () => { fireEvent.press(getByTestId('add-item-button')); });

    await waitFor(() => {
      expect(itemsDb.addItemLocally).toHaveBeenCalledWith(
        'list-local-1', 'Bread', '', 'apple', 'Produce'
      );
      expect(historyDb.recordItemUsed).toHaveBeenCalled();
      expect(syncQueue.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ opType: 'ADD_ITEM', listServerId: 5 }),
        'list-local-1'
      );
    });
  });

  it('does not enqueue sync op when list has no serverId', async () => {
    const offlineProps = {
      ...baseProps,
      route: {
        params: { listLocalId: 'list-local-1', listName: 'Offline', listServerId: null },
      } as never,
    };

    const { getByTestId } = render(<ListDetailScreen {...offlineProps} />);
    await waitFor(() => expect(getByTestId('add-item-fab')).toBeTruthy());

    await act(async () => { fireEvent.press(getByTestId('add-item-fab')); });
    fireEvent.changeText(getByTestId('item-name-input'), 'Butter');
    await act(async () => { fireEvent.press(getByTestId('add-item-button')); });

    await waitFor(() => expect(itemsDb.addItemLocally).toHaveBeenCalled());
    expect(syncQueue.enqueue).not.toHaveBeenCalled();
  });
});
