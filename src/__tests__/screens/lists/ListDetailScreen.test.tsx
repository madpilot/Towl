/**
 * Tests for ListDetailScreen.
 *
 * All store interactions are mocked so tests focus on:
 *   - bootstrap/reloadAfterSync lifecycle
 *   - rendering (loading state, item categories)
 *   - user interactions (add item, open list picker)
 */

jest.mock('@/store/listDetailStore', () => ({
  useListDetailStore: jest.fn(),
  useListNav: jest.fn(),
  useItemActions: jest.fn(),
}));

jest.mock('@/store/householdStore', () => ({
  useHouseholdStore: jest.fn((sel: (s: unknown) => unknown) =>
    sel({ selectedHousehold: { id: 1, name: 'Home', photo: null } })
  ),
}));

let mockSyncVersion = 0;
jest.mock('@/store/syncStore', () => ({
  useSyncStore: jest.fn((sel: (s: unknown) => unknown) => sel({ syncVersion: mockSyncVersion })),
}));

jest.mock('@/screens/lists/ListPickerModal', () => {
  const React = require('react');
  const { View } = require('react-native');
  function ListPickerModal() {
    return React.createElement(View, { testID: 'list-picker-modal' });
  }
  return ListPickerModal;
});

jest.mock('@/screens/lists/TrolleySection', () => {
  const React = require('react');
  const { View } = require('react-native');
  function TrolleySection() {
    return React.createElement(View, { testID: 'trolley-section' });
  }
  return TrolleySection;
});

jest.mock('@/components/AddItemBar', () => {
  const React = require('react');
  const { TextInput, TouchableOpacity, View } = require('react-native');
  function AddItemBar({
    onAdd,
  }: {
    onAdd: (name: string, desc: string, iconKey: string | null, cat: string) => void;
  }) {
    const [val, setVal] = React.useState('');
    return React.createElement(
      View,
      null,
      React.createElement(TextInput, {
        testID: 'add-item-input',
        value: val,
        onChangeText: setVal,
      }),
      React.createElement(TouchableOpacity, {
        testID: 'add-item-submit',
        onPress: () => {
          if (val.trim()) {
            onAdd(val.trim(), '', null, 'Other');
            setVal('');
          }
        },
      })
    );
  }
  return AddItemBar;
});

jest.mock('@/components/CategorySection', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  function CategorySection({
    category,
    items,
  }: {
    category: string;
    items: Array<{ localId: string; name: string }>;
  }) {
    return React.createElement(
      View,
      { testID: `category-${category}` },
      items.map((i) => React.createElement(Text, { key: i.localId }, i.name))
    );
  }
  return CategorySection;
});

jest.mock('@/components/BottomNav', () => {
  const React = require('react');
  const { View } = require('react-native');
  function BottomNav() {
    return React.createElement(View, { testID: 'bottom-nav' });
  }
  return BottomNav;
});

jest.mock('@/components/icons/HouseIcon', () => {
  const React = require('react');
  const { View } = require('react-native');
  function HouseIcon() {
    return React.createElement(View, { testID: 'house-icon' });
  }
  return HouseIcon;
});

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { useListDetailStore, useListNav, useItemActions } from '@/store/listDetailStore';
import { useHouseholdStore } from '@/store/householdStore';
import { useSyncStore } from '@/store/syncStore';
import ListDetailScreen from '@/screens/lists/ListDetailScreen';
import type { LocalItem } from '@/db/items';

const mockNavigation = { navigate: jest.fn() };
const baseProps = { navigation: mockNavigation as never, route: {} as never };

const mockBootstrap = jest.fn().mockResolvedValue(undefined);
const mockReloadAfterSync = jest.fn().mockResolvedValue(undefined);
const mockAddItem = jest.fn().mockResolvedValue(undefined);
const mockSetListPickerVisible = jest.fn();
const mockSetEditingId = jest.fn();

function makeItem(overrides: Partial<LocalItem> = {}): LocalItem {
  return {
    localId: 'item-1',
    serverId: 100,
    listLocalId: 'list-local-1',
    name: 'Milk',
    description: '',
    iconKey: 'milk_carton',
    category: 'Dairy & Eggs',
    serverCategoryId: null,
    serverCategoryName: null,
    serverCategoryOrdering: null,
    isChecked: false,
    isImportant: false,
    isDirty: false,
    isDeleted: false,
    createdAt: Date.now(),
    checkedAt: null,
    ...overrides,
  };
}

function setupMocks({
  loading = false,
  items = [] as LocalItem[],
  activeName = 'Groceries',
  editingId = null as string | null,
} = {}) {
  (useListDetailStore as unknown as jest.Mock).mockImplementation((sel: (s: unknown) => unknown) =>
    sel({ bootstrap: mockBootstrap, reloadAfterSync: mockReloadAfterSync, loading, items })
  );
  (useListNav as jest.Mock).mockReturnValue({
    activeName,
    allLists: [],
    activeLocalId: 'list-local-1',
    listPickerVisible: false,
    refreshing: false,
    setListPickerVisible: mockSetListPickerVisible,
    switchToList: jest.fn(),
    refresh: jest.fn(),
  });
  (useItemActions as jest.Mock).mockReturnValue({
    editingId,
    setEditingId: mockSetEditingId,
    toggleDone: jest.fn(),
    toggleImportant: jest.fn(),
    deleteItem: jest.fn(),
    saveItem: jest.fn(),
    addItem: mockAddItem,
    clearTrolley: jest.fn(),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSyncVersion = 0;
  setupMocks();
});

describe('ListDetailScreen', () => {
  describe('bootstrap lifecycle', () => {
    it('calls bootstrap with restoreLastList: true on first mount', async () => {
      render(<ListDetailScreen {...baseProps} />);
      await waitFor(() => expect(mockBootstrap).toHaveBeenCalledWith(1, true));
    });

    it('calls bootstrap with restoreLastList: false on subsequent householdId change', async () => {
      const { rerender } = render(<ListDetailScreen {...baseProps} />);
      await waitFor(() => expect(mockBootstrap).toHaveBeenCalledWith(1, true));

      (useHouseholdStore as unknown as jest.Mock).mockImplementation(
        (sel: (s: unknown) => unknown) =>
          sel({ selectedHousehold: { id: 2, name: 'Work', photo: null } })
      );
      rerender(<ListDetailScreen {...baseProps} />);

      await waitFor(() => expect(mockBootstrap).toHaveBeenCalledWith(2, false));
    });

    it('skips bootstrap when no household is selected', async () => {
      (useHouseholdStore as unknown as jest.Mock).mockImplementation(
        (sel: (s: unknown) => unknown) => sel({ selectedHousehold: null })
      );
      render(<ListDetailScreen {...baseProps} />);
      await act(async () => {});
      expect(mockBootstrap).not.toHaveBeenCalled();
    });
  });

  describe('sync reload', () => {
    it('calls reloadAfterSync when syncVersion increments', async () => {
      const { rerender } = render(<ListDetailScreen {...baseProps} />);

      mockSyncVersion = 1;
      (useSyncStore as unknown as jest.Mock).mockImplementation((sel: (s: unknown) => unknown) =>
        sel({ syncVersion: 1 })
      );
      rerender(<ListDetailScreen {...baseProps} />);

      await waitFor(() => expect(mockReloadAfterSync).toHaveBeenCalledTimes(1));
    });

    it('does not call reloadAfterSync on initial render', async () => {
      render(<ListDetailScreen {...baseProps} />);
      await act(async () => {});
      expect(mockReloadAfterSync).not.toHaveBeenCalled();
    });
  });

  describe('rendering', () => {
    it('shows the active list name', () => {
      setupMocks({ activeName: 'Groceries' });
      const { getByText } = render(<ListDetailScreen {...baseProps} />);
      expect(getByText('Groceries')).toBeTruthy();
    });

    it('renders category sections for unchecked items grouped by server category', () => {
      setupMocks({
        items: [
          makeItem({
            serverCategoryId: 2,
            serverCategoryName: 'Dairy & Eggs',
            serverCategoryOrdering: 1,
            isChecked: false,
          }),
        ],
      });
      const { getByTestId } = render(<ListDetailScreen {...baseProps} />);
      expect(getByTestId('category-Dairy & Eggs')).toBeTruthy();
    });

    it('groups items with no server category as Uncategorized', () => {
      setupMocks({ items: [makeItem({ serverCategoryId: null, isChecked: false })] });
      const { getByTestId } = render(<ListDetailScreen {...baseProps} />);
      expect(getByTestId('category-Uncategorized')).toBeTruthy();
    });

    it('excludes checked items from category sections (they go to TrolleySection)', () => {
      setupMocks({
        items: [
          makeItem({ serverCategoryId: 2, serverCategoryName: 'Dairy & Eggs', isChecked: true }),
        ],
      });
      const { queryByTestId } = render(<ListDetailScreen {...baseProps} />);
      expect(queryByTestId('category-Dairy & Eggs')).toBeNull();
    });

    it('always renders TrolleySection and ListPickerModal', () => {
      const { getByTestId } = render(<ListDetailScreen {...baseProps} />);
      expect(getByTestId('trolley-section')).toBeTruthy();
      expect(getByTestId('list-picker-modal')).toBeTruthy();
    });
  });

  describe('item actions', () => {
    it('calls addItem from useItemActions when AddItemBar submits', async () => {
      const { getByTestId } = render(<ListDetailScreen {...baseProps} />);
      fireEvent.changeText(getByTestId('add-item-input'), 'Bread');
      await act(async () => {
        fireEvent.press(getByTestId('add-item-submit'));
      });
      expect(mockAddItem).toHaveBeenCalledWith('Bread', '', null, 'Other');
    });
  });

  describe('list picker', () => {
    it('opens list picker when list name header is pressed', () => {
      setupMocks({ activeName: 'Groceries' });
      const { getByText } = render(<ListDetailScreen {...baseProps} />);
      fireEvent.press(getByText('Groceries'));
      expect(mockSetListPickerVisible).toHaveBeenCalledWith(true);
    });
  });
});
