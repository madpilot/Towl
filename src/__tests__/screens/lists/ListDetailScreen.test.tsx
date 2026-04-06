/**
 * Tests for ListDetailScreen (redesigned).
 *
 * The screen uses AddItemBar (inline input) instead of a FAB + bottom sheet.
 * Items are grouped by category; done items appear in "In the Trolley".
 */

jest.mock('@/db/items', () => ({
  getItemsForList: jest.fn(),
  addItemLocally: jest.fn(),
  softDeleteItem: jest.fn(),
  hardDeleteItem: jest.fn(),
  upsertItemFromServer: jest.fn(),
  toggleItemChecked: jest.fn(),
  toggleItemImportant: jest.fn(),
  updateItemNameAndIcon: jest.fn(),
}));

jest.mock('@/db/lists', () => ({
  getAllLists: jest.fn(),
}));

jest.mock('@/db/syncQueue', () => ({
  enqueue: jest.fn(),
}));

jest.mock('@/sync/syncManager', () => ({
  drain: jest.fn().mockResolvedValue(undefined),
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

jest.mock('@/store/householdStore', () => ({
  useHouseholdStore: jest.fn(() => ({ selectedHousehold: { id: 1, name: 'Home', photo: null } })),
}));

// Suppress font/icon rendering in tests
jest.mock('@/components/KitchenOwlIcon', () => {
  const React = require('react');
  const { Text } = require('react-native');
  function KitchenOwlIcon({ iconKey }: { iconKey: string | null | undefined }) {
    return React.createElement(Text, { testID: `icon-${iconKey ?? 'none'}` }, iconKey ?? '?');
  }
  return KitchenOwlIcon;
});

jest.mock('@/components/TommyOwl', () => {
  const React = require('react');
  const { View } = require('react-native');
  function TommyOwl() { return React.createElement(View, { testID: 'tommy-owl' }); }
  return TommyOwl;
});

// AddItemBar is an integration point — mock to a simple controlled input
jest.mock('@/components/AddItemBar', () => {
  const React = require('react');
  const { TextInput, TouchableOpacity, View } = require('react-native');
  function AddItemBar({ onAdd }: { onAdd: (name: string, desc: string, iconKey: string | null, category: string) => void }) {
    const [val, setVal] = React.useState('');
    return React.createElement(View, null,
      React.createElement(TextInput, { testID: 'add-item-input', value: val, onChangeText: setVal }),
      React.createElement(TouchableOpacity, {
        testID: 'add-item-submit',
        onPress: () => { if (val.trim()) { onAdd(val.trim(), '', null, 'Other'); setVal(''); } },
      })
    );
  }
  return AddItemBar;
});

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
import * as listsDb from '@/db/lists';
import * as syncQueue from '@/db/syncQueue';
import * as historyDb from '@/db/history';
import type { LocalItem } from '@/db/items';

const baseRoute = {
  params: { listLocalId: 'list-local-1', listName: 'Groceries', listServerId: 5 },
} as never;

const mockNavigation = { navigate: jest.fn() };

const baseProps = {
  navigation: mockNavigation as never,
  route: baseRoute,
};

function makeItem(overrides: Partial<LocalItem> = {}): LocalItem {
  return {
    localId: 'item-1',
    serverId: 100,
    listLocalId: 'list-local-1',
    name: 'Milk',
    description: '',
    iconKey: 'milk_carton',
    category: 'Dairy & Eggs',
    isChecked: false,
    isImportant: false,
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
  (itemsDb.toggleItemChecked as jest.Mock).mockResolvedValue(undefined);
  (itemsDb.toggleItemImportant as jest.Mock).mockResolvedValue(undefined);
  (itemsDb.updateItemNameAndIcon as jest.Mock).mockResolvedValue(undefined);
  (listsDb.getAllLists as jest.Mock).mockResolvedValue([]);
  (syncQueue.enqueue as jest.Mock).mockResolvedValue({});
  (historyDb.recordItemUsed as jest.Mock).mockResolvedValue(undefined);
});

describe('ListDetailScreen', () => {
  it('shows list name in header', async () => {
    const { getByText } = render(<ListDetailScreen {...baseProps} />);
    await waitFor(() => expect(getByText('Groceries')).toBeTruthy());
  });

  it('renders items from db', async () => {
    (itemsDb.getItemsForList as jest.Mock).mockResolvedValue([
      makeItem({ name: 'Milk' }),
      makeItem({ localId: 'item-2', name: 'Eggs', iconKey: 'eggs' }),
    ]);

    const { getByText } = render(<ListDetailScreen {...baseProps} />);
    await waitFor(() => {
      expect(getByText('Milk')).toBeTruthy();
      expect(getByText('Eggs')).toBeTruthy();
    });
  });

  it('adds item and enqueues sync op', async () => {
    const { getByTestId } = render(<ListDetailScreen {...baseProps} />);
    await waitFor(() => expect(getByTestId('add-item-input')).toBeTruthy());

    fireEvent.changeText(getByTestId('add-item-input'), 'Bread');
    await act(async () => { fireEvent.press(getByTestId('add-item-submit')); });

    await waitFor(() => {
      // matchItem mock returns { iconKey: 'apple', category: 'Produce' }
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
    await waitFor(() => expect(getByTestId('add-item-input')).toBeTruthy());

    fireEvent.changeText(getByTestId('add-item-input'), 'Butter');
    await act(async () => { fireEvent.press(getByTestId('add-item-submit')); });

    await waitFor(() => expect(itemsDb.addItemLocally).toHaveBeenCalled());
    expect(syncQueue.enqueue).not.toHaveBeenCalled();
  });
});
