/**
 * Tests for listDetailStore actions.
 * All DB/sync dependencies are mocked; actions are called directly via getState().
 */

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

jest.mock('@/db/items', () => ({
  getItemsForList: jest.fn(),
  getItem: jest.fn(),
  addItemLocally: jest.fn(),
  softDeleteItem: jest.fn(),
  hardDeleteItem: jest.fn(),
  upsertItemFromServer: jest.fn(),
  removeItemsDeletedOnServer: jest.fn(),
  checkItem: jest.fn(),
  uncheckItem: jest.fn(),
  markItemCheckSynced: jest.fn(),
  clearCheckedItems: jest.fn(),
  clearExpiredCheckedItems: jest.fn(),
  toggleItemImportant: jest.fn(),
  updateItemNameAndIcon: jest.fn(),
}));

jest.mock('@/db/lists', () => ({
  getAllLists: jest.fn(),
}));

jest.mock('@/sync/syncManager', () => ({
  enqueue: jest.fn().mockResolvedValue(undefined),
  removePendingCheckItem: jest.fn().mockResolvedValue(false),
}));

jest.mock('@/db/history', () => ({
  recordItemUsed: jest.fn(),
}));

jest.mock('@/data/foodMatcher', () => ({
  matchItem: jest.fn(() => ({ iconKey: 'apple', category: 'Produce' })),
}));

const mockGetShoppingLists = jest.fn();
const mockGetHousehold = jest.fn();
jest.mock('@/store/authStore', () => ({
  useAuthStore: {
    getState: jest.fn(() => ({
      shoppingListsApi: { getShoppingLists: mockGetShoppingLists },
      householdsApi: { getHousehold: mockGetHousehold },
    })),
  },
}));

import { getItemAsync, setItemAsync } from 'expo-secure-store';
import {
  getItemsForList,
  getItem,
  addItemLocally,
  softDeleteItem,
  hardDeleteItem,
  checkItem,
  uncheckItem,
  clearCheckedItems,
  clearExpiredCheckedItems,
  toggleItemImportant,
  updateItemNameAndIcon,
} from '@/db/items';
import { getAllLists } from '@/db/lists';
import { enqueue, removePendingCheckItem } from '@/sync/syncManager';
import { recordItemUsed } from '@/db/history';
import { useListDetailStore } from '@/store/listDetailStore';
import type { LocalItem } from '@/db/items';
import type { LocalList } from '@/db/lists';

function makeList(overrides: Partial<LocalList> = {}): LocalList {
  return {
    localId: 'list-local-1', serverId: 5, householdId: 1, name: 'Groceries',
    isDirty: false, isDeleted: false, lastSynced: 0,
    ...overrides,
  };
}

function makeItem(overrides: Partial<LocalItem> = {}): LocalItem {
  return {
    localId: 'item-1', serverId: 100, listLocalId: 'list-local-1',
    name: 'Milk', description: '', iconKey: 'milk_carton', category: 'Dairy & Eggs',
    serverCategoryId: null, serverCategoryName: null, serverCategoryOrdering: null,
    isChecked: false, isImportant: false, isDirty: false, isDeleted: false,
    createdAt: Date.now(), checkedAt: null,
    ...overrides,
  };
}

const initialState = {
  activeLocalId: null,
  activeServerId: null,
  activeName: '',
  items: [],
  allLists: [],
  loading: true,
  refreshing: false,
  listPickerVisible: false,
  editingId: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  useListDetailStore.setState(initialState);
  (getItemAsync as jest.Mock).mockResolvedValue(null);
  (setItemAsync as jest.Mock).mockResolvedValue(undefined);
  (getItemsForList as jest.Mock).mockResolvedValue([]);
  (clearExpiredCheckedItems as jest.Mock).mockResolvedValue(undefined);
  (getAllLists as jest.Mock).mockResolvedValue([]);
  (mockGetShoppingLists as jest.Mock).mockResolvedValue([]);
  (mockGetHousehold as jest.Mock).mockResolvedValue({
    id: 1, name: 'Home', photo: null, member: [], default_shopping_list: null,
  });
});

// ─── bootstrap ───────────────────────────────────────────────────────────────

describe('bootstrap', () => {
  it('loads all lists and sets allLists state', async () => {
    const lists = [makeList()];
    (getAllLists as jest.Mock).mockResolvedValue(lists);

    await useListDetailStore.getState().bootstrap(1, false);

    expect(getAllLists).toHaveBeenCalledWith(1);
    expect(useListDetailStore.getState().allLists).toEqual(lists);
  });

  it('selects first list when restoreLastList is false', async () => {
    const lists = [makeList(), makeList({ localId: 'list-2', name: 'Pharmacy' })];
    (getAllLists as jest.Mock).mockResolvedValue(lists);

    await useListDetailStore.getState().bootstrap(1, false);

    expect(useListDetailStore.getState().activeLocalId).toBe('list-local-1');
    expect(useListDetailStore.getState().activeName).toBe('Groceries');
    expect(useListDetailStore.getState().loading).toBe(false);
  });

  it('restores last list from SecureStore when restoreLastList is true', async () => {
    const lists = [makeList(), makeList({ localId: 'list-2', name: 'Pharmacy' })];
    (getAllLists as jest.Mock).mockResolvedValue(lists);
    (getItemAsync as jest.Mock).mockResolvedValue('list-2');

    await useListDetailStore.getState().bootstrap(1, true);

    expect(useListDetailStore.getState().activeLocalId).toBe('list-2');
    expect(useListDetailStore.getState().activeName).toBe('Pharmacy');
  });

  it('falls back to first list if stored key not found', async () => {
    const lists = [makeList()];
    (getAllLists as jest.Mock).mockResolvedValue(lists);
    (getItemAsync as jest.Mock).mockResolvedValue('nonexistent-id');

    await useListDetailStore.getState().bootstrap(1, true);

    expect(useListDetailStore.getState().activeLocalId).toBe('list-local-1');
  });

  it('selects server default list when no saved key exists', async () => {
    const lists = [makeList(), makeList({ localId: 'list-2', name: 'Pharmacy', serverId: 8 })];
    (getAllLists as jest.Mock).mockResolvedValue(lists);
    (getItemAsync as jest.Mock).mockResolvedValue(null);
    (mockGetHousehold as jest.Mock).mockResolvedValue({
      id: 1, name: 'Home', photo: null, member: [],
      default_shopping_list: { id: 8, name: 'Pharmacy', household_id: 1 },
    });

    await useListDetailStore.getState().bootstrap(1, true);

    expect(useListDetailStore.getState().activeLocalId).toBe('list-2');
    expect(useListDetailStore.getState().activeName).toBe('Pharmacy');
  });

  it('falls back to first list when server default list not found locally', async () => {
    const lists = [makeList()];
    (getAllLists as jest.Mock).mockResolvedValue(lists);
    (getItemAsync as jest.Mock).mockResolvedValue(null);
    (mockGetHousehold as jest.Mock).mockResolvedValue({
      id: 1, name: 'Home', photo: null, member: [],
      default_shopping_list: { id: 99, name: 'Unknown', household_id: 1 },
    });

    await useListDetailStore.getState().bootstrap(1, true);

    expect(useListDetailStore.getState().activeLocalId).toBe('list-local-1');
  });

  it('sets loading: false and no active list when no lists exist', async () => {
    (getAllLists as jest.Mock).mockResolvedValue([]);

    await useListDetailStore.getState().bootstrap(1, false);

    expect(useListDetailStore.getState().loading).toBe(false);
    expect(useListDetailStore.getState().activeLocalId).toBeNull();
  });

  it('loads items for the selected list', async () => {
    const items = [makeItem()];
    (getAllLists as jest.Mock).mockResolvedValue([makeList()]);
    (getItemsForList as jest.Mock).mockResolvedValue(items);

    await useListDetailStore.getState().bootstrap(1, false);

    expect(getItemsForList).toHaveBeenCalledWith('list-local-1');
    expect(useListDetailStore.getState().items).toEqual(items);
  });
});

// ─── switchToList ─────────────────────────────────────────────────────────────

describe('switchToList', () => {
  it('updates active list and saves to SecureStore', async () => {
    const list = makeList({ localId: 'list-2', name: 'Pharmacy', serverId: 8 });

    await useListDetailStore.getState().switchToList(list, 1);

    expect(useListDetailStore.getState().activeLocalId).toBe('list-2');
    expect(useListDetailStore.getState().activeName).toBe('Pharmacy');
    expect(useListDetailStore.getState().activeServerId).toBe(8);
    expect(setItemAsync).toHaveBeenCalledWith(expect.any(String), 'list-2');
  });

  it('loads items for the new list', async () => {
    const items = [makeItem({ listLocalId: 'list-2' })];
    (getItemsForList as jest.Mock).mockResolvedValue(items);
    const list = makeList({ localId: 'list-2', name: 'Pharmacy' });

    await useListDetailStore.getState().switchToList(list, 1);

    expect(getItemsForList).toHaveBeenCalledWith('list-2');
    expect(useListDetailStore.getState().items).toEqual(items);
  });

  it('closes the list picker', async () => {
    useListDetailStore.setState({ listPickerVisible: true });

    await useListDetailStore.getState().switchToList(makeList(), 1);

    expect(useListDetailStore.getState().listPickerVisible).toBe(false);
  });
});

// ─── reloadAfterSync ──────────────────────────────────────────────────────────

describe('reloadAfterSync', () => {
  it('reloads items when activeLocalId is set', async () => {
    const items = [makeItem()];
    useListDetailStore.setState({ activeLocalId: 'list-local-1' });
    (getItemsForList as jest.Mock).mockResolvedValue(items);

    await useListDetailStore.getState().reloadAfterSync();

    expect(getItemsForList).toHaveBeenCalledWith('list-local-1');
    expect(useListDetailStore.getState().items).toEqual(items);
  });

  it('does nothing when no active list', async () => {
    await useListDetailStore.getState().reloadAfterSync();
    expect(getItemsForList).not.toHaveBeenCalled();
  });
});

// ─── toggleDone ───────────────────────────────────────────────────────────────

describe('toggleDone', () => {
  beforeEach(() => {
    (checkItem as jest.Mock).mockResolvedValue(undefined);
    (uncheckItem as jest.Mock).mockResolvedValue(undefined);
    (getItem as jest.Mock).mockResolvedValue(makeItem({ serverId: 100 }));
    useListDetailStore.setState({ activeLocalId: 'list-local-1', activeServerId: 5 });
  });

  it('calls checkItem and enqueues CHECK_ITEM when checking an item', async () => {
    const item = makeItem({ isChecked: false });
    useListDetailStore.setState({ items: [item] });

    await useListDetailStore.getState().toggleDone('item-1');

    expect(checkItem).toHaveBeenCalledWith('item-1', expect.any(Number));
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ opType: 'CHECK_ITEM', itemServerId: 100 }),
      'list-local-1'
    );
    expect(useListDetailStore.getState().items[0].isChecked).toBe(true);
  });

  it('calls uncheckItem and cancels pending op when unchecking', async () => {
    const item = makeItem({ isChecked: true });
    useListDetailStore.setState({ items: [item] });
    (removePendingCheckItem as jest.Mock).mockResolvedValue(true);

    await useListDetailStore.getState().toggleDone('item-1');

    expect(uncheckItem).toHaveBeenCalledWith('item-1', false);
    expect(enqueue).not.toHaveBeenCalled();
    expect(useListDetailStore.getState().items[0].isChecked).toBe(false);
  });

  it('re-adds to server via ADD_ITEM when uncheck has no pending op', async () => {
    const item = makeItem({ isChecked: true });
    useListDetailStore.setState({ items: [item] });
    (removePendingCheckItem as jest.Mock).mockResolvedValue(false);

    await useListDetailStore.getState().toggleDone('item-1');

    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ opType: 'ADD_ITEM' }),
      'list-local-1'
    );
  });

  it('does nothing for unknown localId', async () => {
    useListDetailStore.setState({ items: [] });
    await useListDetailStore.getState().toggleDone('ghost');
    expect(checkItem).not.toHaveBeenCalled();
    expect(uncheckItem).not.toHaveBeenCalled();
  });
});

// ─── toggleImportant ──────────────────────────────────────────────────────────

describe('toggleImportant', () => {
  it('toggles isImportant and calls toggleItemImportant', async () => {
    const item = makeItem({ isImportant: false });
    useListDetailStore.setState({ items: [item] });
    (toggleItemImportant as jest.Mock).mockResolvedValue(undefined);

    await useListDetailStore.getState().toggleImportant('item-1');

    expect(toggleItemImportant).toHaveBeenCalledWith('item-1', true);
    expect(useListDetailStore.getState().items[0].isImportant).toBe(true);
  });
});

// ─── deleteItem ───────────────────────────────────────────────────────────────

describe('deleteItem', () => {
  beforeEach(() => {
    useListDetailStore.setState({
      items: [makeItem()], activeLocalId: 'list-local-1', activeServerId: 5,
    });
    (softDeleteItem as jest.Mock).mockResolvedValue(undefined);
    (hardDeleteItem as jest.Mock).mockResolvedValue(undefined);
  });

  it('enqueues REMOVE_ITEM when item has a serverId', async () => {
    (getItem as jest.Mock).mockResolvedValue(makeItem({ serverId: 100 }));

    await useListDetailStore.getState().deleteItem('item-1');

    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ opType: 'REMOVE_ITEM', itemServerId: 100 }),
      'list-local-1'
    );
    expect(hardDeleteItem).not.toHaveBeenCalled();
  });

  it('hard-deletes immediately when item has no serverId', async () => {
    (getItem as jest.Mock).mockResolvedValue(makeItem({ serverId: null }));

    await useListDetailStore.getState().deleteItem('item-1');

    expect(hardDeleteItem).toHaveBeenCalledWith('item-1');
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('removes item from state', async () => {
    (getItem as jest.Mock).mockResolvedValue(makeItem({ serverId: null }));

    await useListDetailStore.getState().deleteItem('item-1');

    expect(useListDetailStore.getState().items).toEqual([]);
  });
});

// ─── saveItem ────────────────────────────────────────────────────────────────

describe('saveItem', () => {
  beforeEach(() => {
    useListDetailStore.setState({
      items: [makeItem()], activeLocalId: 'list-local-1', activeServerId: 5,
    });
    (updateItemNameAndIcon as jest.Mock).mockResolvedValue(undefined);
  });

  it('enqueues UPDATE_ITEM when item has a serverId', async () => {
    (getItem as jest.Mock).mockResolvedValue(makeItem({ serverId: 100, serverCategoryId: null }));

    await useListDetailStore.getState().saveItem('item-1', 'Almond Milk', '', 'milk_carton');

    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ opType: 'UPDATE_ITEM', itemServerId: 100, name: 'Almond Milk' }),
      'list-local-1'
    );
  });

  it('also enqueues UPDATE_ITEM_DESC to sync the per-list description', async () => {
    (itemsDb.getItem as jest.Mock).mockResolvedValue(makeItem({ serverId: 100, isImportant: false }));

    await useListDetailStore.getState().saveItem('item-1', 'Beef Mince', '500g', 'beef');

    expect(syncManager.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ opType: 'UPDATE_ITEM_DESC', itemServerId: 100, description: '500g' }),
      'list-local-1'
    );
  });

  it('prepends ! to description in UPDATE_ITEM_DESC when item is important', async () => {
    (itemsDb.getItem as jest.Mock).mockResolvedValue(makeItem({ serverId: 100, isImportant: true }));

    await useListDetailStore.getState().saveItem('item-1', 'Beef Mince', '500g', 'beef');

    expect(syncManager.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ opType: 'UPDATE_ITEM_DESC', description: '!500g' }),
      'list-local-1'
    );
  });

  it('skips enqueue when item has no serverId', async () => {
    (getItem as jest.Mock).mockResolvedValue(makeItem({ serverId: null }));

    await useListDetailStore.getState().saveItem('item-1', 'New Name', '', null);

    expect(enqueue).not.toHaveBeenCalled();
  });

  it('updates item in state', async () => {
    (getItem as jest.Mock).mockResolvedValue(makeItem({ serverId: null }));

    await useListDetailStore.getState().saveItem('item-1', 'Butter', '', 'butter');

    expect(useListDetailStore.getState().items[0].name).toBe('Butter');
    expect(useListDetailStore.getState().items[0].iconKey).toBe('butter');
  });
});

// ─── addItem ─────────────────────────────────────────────────────────────────

describe('addItem', () => {
  const newItem = makeItem({ localId: 'new-item', name: 'Bread' });

  beforeEach(() => {
    useListDetailStore.setState({ items: [], activeLocalId: 'list-local-1', activeServerId: 5 });
    (addItemLocally as jest.Mock).mockResolvedValue(newItem);
    (recordItemUsed as jest.Mock).mockResolvedValue(undefined);
  });

  it('adds item locally, records history, and enqueues ADD_ITEM', async () => {
    await useListDetailStore.getState().addItem('Bread', '', null, 'Other');

    expect(addItemLocally).toHaveBeenCalledWith('list-local-1', 'Bread', '', 'apple', 'Produce');
    expect(recordItemUsed).toHaveBeenCalled();
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ opType: 'ADD_ITEM', listServerId: 5 }),
      'list-local-1'
    );
    expect(useListDetailStore.getState().items).toContainEqual(newItem);
  });

  it('skips ADD_ITEM enqueue when list has no serverId', async () => {
    useListDetailStore.setState({ activeServerId: null });

    await useListDetailStore.getState().addItem('Bread', '', null, 'Other');

    expect(addItemLocally).toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('uses provided iconKey and category instead of matching', async () => {
    await useListDetailStore.getState().addItem('Banana', '', 'banana', 'Produce');

    expect(addItemLocally).toHaveBeenCalledWith(
      'list-local-1', 'Banana', '', 'banana', 'Produce'
    );
  });

  it('does nothing when no activeLocalId', async () => {
    useListDetailStore.setState({ activeLocalId: null });

    await useListDetailStore.getState().addItem('Bread', '', null, 'Other');

    expect(addItemLocally).not.toHaveBeenCalled();
  });
});

// ─── clearTrolley ─────────────────────────────────────────────────────────────

describe('clearTrolley', () => {
  it('removes checked items locally', async () => {
    const checked = makeItem({ isChecked: true });
    const active = makeItem({ localId: 'item-2', isChecked: false });
    useListDetailStore.setState({ items: [checked, active], activeLocalId: 'list-local-1' });
    (clearCheckedItems as jest.Mock).mockResolvedValue(undefined);

    await useListDetailStore.getState().clearTrolley();

    expect(clearCheckedItems).toHaveBeenCalledWith('list-local-1');
    expect(useListDetailStore.getState().items).toEqual([active]);
  });

  it('does nothing when no activeLocalId', async () => {
    await useListDetailStore.getState().clearTrolley();
    expect(clearCheckedItems).not.toHaveBeenCalled();
  });
});
