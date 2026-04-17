/**
 * Tests for listDetailStore actions.
 * Item DB/sync logic now lives in @/items/itemOperations — that module is mocked
 * here so each action test focuses purely on: correct op called + Zustand state.
 */

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

jest.mock('@/db/items', () => ({
  getItemsForList: jest.fn(),
  upsertItemFromServer: jest.fn(),
  removeItemsDeletedOnServer: jest.fn(),
  clearCheckedItems: jest.fn(),
  clearExpiredCheckedItems: jest.fn(),
  getItem: jest.fn(),
}));

jest.mock('@/db/lists', () => ({
  getAllLists: jest.fn(),
  upsertListFromServer: jest.fn(),
  removeListsDeletedOnServer: jest.fn(),
}));

jest.mock('@/items/itemOperations', () => ({
  addItem: jest.fn(),
  checkItem: jest.fn(),
  uncheckItem: jest.fn(),
  toggleImportant: jest.fn(),
  deleteItem: jest.fn(),
  saveItem: jest.fn(),
  moveItemToCategory: jest.fn(),
}));

const mockGetShoppingLists = jest.fn();
const mockGetHousehold = jest.fn();
const mockGetCategories = jest.fn();
jest.mock('@/store/authStore', () => ({
  useAuthStore: {
    getState: jest.fn(() => ({
      shoppingListsApi: { getShoppingLists: mockGetShoppingLists },
      householdsApi: { getHousehold: mockGetHousehold, getCategories: mockGetCategories },
    })),
  },
}));

jest.mock('@/data/foodMatcher', () => ({
  matchItem: jest.fn(() => ({ iconKey: 'apple', category: 'Produce' })),
}));

import { getItemAsync, setItemAsync } from 'expo-secure-store';
import { getItemsForList, clearCheckedItems, clearExpiredCheckedItems } from '@/db/items';
import { getAllLists, upsertListFromServer, removeListsDeletedOnServer } from '@/db/lists';
import {
  addItem as addItemOp,
  checkItem as checkItemOp,
  uncheckItem as uncheckItemOp,
  toggleImportant as toggleImportantOp,
  deleteItem as deleteItemOp,
  saveItem as saveItemOp,
  moveItemToCategory as moveItemToCategoryOp,
} from '@/items/itemOperations';
import { useListDetailStore } from '@/store/listDetailStore';
import type { LocalItem } from '@/db/items';
import type { LocalList } from '@/db/lists';

function makeList(overrides: Partial<LocalList> = {}): LocalList {
  return {
    localId: 'list-local-1',
    serverId: 5,
    householdId: 1,
    name: 'Groceries',
    isDirty: false,
    isDeleted: false,
    lastSynced: 0,
    ...overrides,
  };
}

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

const initialState = {
  activeLocalId: null,
  activeServerId: null,
  activeName: '',
  items: [],
  allLists: [],
  allCategories: [],
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
  (upsertListFromServer as jest.Mock).mockResolvedValue(undefined);
  (removeListsDeletedOnServer as jest.Mock).mockResolvedValue(undefined);
  (mockGetShoppingLists as jest.Mock).mockResolvedValue([]);
  (mockGetCategories as jest.Mock).mockResolvedValue([]);
  (mockGetHousehold as jest.Mock).mockResolvedValue({
    id: 1,
    name: 'Home',
    photo: null,
    member: [],
    default_shopping_list: null,
  });
  // Default op return values
  (checkItemOp as jest.Mock).mockResolvedValue(makeItem({ isChecked: true, isDirty: true, checkedAt: 1000 }));
  (uncheckItemOp as jest.Mock).mockResolvedValue(makeItem({ isChecked: false, isDirty: false, checkedAt: null }));
  (toggleImportantOp as jest.Mock).mockResolvedValue(makeItem({ isImportant: true }));
  (deleteItemOp as jest.Mock).mockResolvedValue(undefined);
  (saveItemOp as jest.Mock).mockResolvedValue(makeItem());
  (moveItemToCategoryOp as jest.Mock).mockResolvedValue(makeItem());
  (addItemOp as jest.Mock).mockResolvedValue({ action: 'added', item: makeItem({ localId: 'new-item', name: 'Bread' }) });
});

// ─── syncLists ────────────────────────────────────────────────────────────────

describe('syncLists', () => {
  it('fetches from server, upserts each list, and removes deleted ones', async () => {
    const serverLists = [{ id: 5, name: 'Weekly', items: [] }];
    mockGetShoppingLists.mockResolvedValue(serverLists);
    (getAllLists as jest.Mock).mockResolvedValue([makeList()]);

    await useListDetailStore.getState().syncLists(1);

    expect(mockGetShoppingLists).toHaveBeenCalledWith(1);
    expect(upsertListFromServer).toHaveBeenCalledWith(5, 1, 'Weekly');
    expect(removeListsDeletedOnServer).toHaveBeenCalledWith(1, [5]);
  });

  it('updates allLists from SQLite after syncing', async () => {
    const lists = [makeList()];
    mockGetShoppingLists.mockResolvedValue([{ id: 5, name: 'Weekly', items: [] }]);
    (getAllLists as jest.Mock).mockResolvedValue(lists);

    await useListDetailStore.getState().syncLists(1);

    expect(useListDetailStore.getState().allLists).toEqual(lists);
  });

  it('keeps existing allLists when API call fails', async () => {
    const existingLists = [makeList()];
    (getAllLists as jest.Mock).mockResolvedValue(existingLists);
    mockGetShoppingLists.mockRejectedValue(new Error('Network error'));

    await useListDetailStore.getState().syncLists(1);

    expect(useListDetailStore.getState().allLists).toEqual(existingLists);
    expect(upsertListFromServer).not.toHaveBeenCalled();
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
      id: 1,
      name: 'Home',
      photo: null,
      member: [],
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
      id: 1,
      name: 'Home',
      photo: null,
      member: [],
      default_shopping_list: { id: 99, name: 'Unknown', household_id: 1 },
    });

    await useListDetailStore.getState().bootstrap(1, true);

    expect(useListDetailStore.getState().activeLocalId).toBe('list-local-1');
  });

  it('skips full reload and fires background refresh when already loaded', async () => {
    useListDetailStore.setState({
      activeLocalId: 'list-local-1',
      activeServerId: 5,
      items: [makeItem()],
      loading: false,
    });

    await useListDetailStore.getState().bootstrap(1, false);

    // Should not have cleared items or started loading
    expect(useListDetailStore.getState().loading).toBe(false);
    expect(useListDetailStore.getState().items).toHaveLength(1);
    // Should not have called getItemsForList for a fresh load
    expect(getItemsForList).not.toHaveBeenCalled();
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
    useListDetailStore.setState({
      items: [makeItem()],
      activeLocalId: 'list-local-1',
      activeServerId: 5,
    });
  });

  it('calls checkItemOp with correct list context when checking', async () => {
    await useListDetailStore.getState().toggleDone('item-1');

    expect(checkItemOp).toHaveBeenCalledWith({
      listContext: { activeLocalId: 'list-local-1', activeServerId: 5 },
      item: expect.objectContaining({ localId: 'item-1' }),
    });
  });

  it('updates item to isChecked=true in state after checking', async () => {
    (checkItemOp as jest.Mock).mockResolvedValue(makeItem({ isChecked: true, isDirty: true, checkedAt: 9999 }));

    await useListDetailStore.getState().toggleDone('item-1');

    const item = useListDetailStore.getState().items[0];
    expect(item.isChecked).toBe(true);
    expect(item.isDirty).toBe(true);
    expect(item.checkedAt).toBe(9999);
  });

  it('calls uncheckItemOp with correct list context when unchecking', async () => {
    useListDetailStore.setState({ items: [makeItem({ isChecked: true })] });

    await useListDetailStore.getState().toggleDone('item-1');

    expect(uncheckItemOp).toHaveBeenCalledWith({
      listContext: { activeLocalId: 'list-local-1', activeServerId: 5 },
      item: expect.objectContaining({ localId: 'item-1' }),
    });
  });

  it('updates item to isChecked=false in state after unchecking', async () => {
    useListDetailStore.setState({ items: [makeItem({ isChecked: true })] });
    (uncheckItemOp as jest.Mock).mockResolvedValue(makeItem({ isChecked: false, isDirty: true, checkedAt: null }));

    await useListDetailStore.getState().toggleDone('item-1');

    const item = useListDetailStore.getState().items[0];
    expect(item.isChecked).toBe(false);
    expect(item.isDirty).toBe(true);
    expect(item.checkedAt).toBeNull();
  });

  it('sets isDirty=false when needsReAdd is false', async () => {
    useListDetailStore.setState({ items: [makeItem({ isChecked: true })] });
    (uncheckItemOp as jest.Mock).mockResolvedValue(makeItem({ isChecked: false, isDirty: false, checkedAt: null }));

    await useListDetailStore.getState().toggleDone('item-1');

    expect(useListDetailStore.getState().items[0].isDirty).toBe(false);
  });

  it('does nothing for unknown localId', async () => {
    useListDetailStore.setState({ items: [] });
    await useListDetailStore.getState().toggleDone('ghost');
    expect(checkItemOp).not.toHaveBeenCalled();
    expect(uncheckItemOp).not.toHaveBeenCalled();
  });
});

// ─── toggleImportant ──────────────────────────────────────────────────────────

describe('toggleImportant', () => {
  beforeEach(() => {
    useListDetailStore.setState({
      items: [makeItem({ isImportant: false })],
      activeLocalId: 'list-local-1',
      activeServerId: 5,
    });
  });

  it('calls toggleImportantOp with correct params', async () => {
    await useListDetailStore.getState().toggleImportant('item-1');

    expect(toggleImportantOp).toHaveBeenCalledWith({
      listContext: { activeLocalId: 'list-local-1', activeServerId: 5 },
      item: expect.objectContaining({ localId: 'item-1', isImportant: false }),
    });
  });

  it('flips isImportant in Zustand state', async () => {
    await useListDetailStore.getState().toggleImportant('item-1');

    expect(useListDetailStore.getState().items[0].isImportant).toBe(true);
  });

  it('does nothing for unknown localId', async () => {
    useListDetailStore.setState({ items: [] });
    await useListDetailStore.getState().toggleImportant('ghost');
    expect(toggleImportantOp).not.toHaveBeenCalled();
  });
});

// ─── deleteItem ───────────────────────────────────────────────────────────────

describe('deleteItem', () => {
  beforeEach(() => {
    useListDetailStore.setState({
      items: [makeItem()],
      activeLocalId: 'list-local-1',
      activeServerId: 5,
    });
  });

  it('calls deleteItemOp with correct params', async () => {
    await useListDetailStore.getState().deleteItem('item-1');

    expect(deleteItemOp).toHaveBeenCalledWith({
      listContext: { activeLocalId: 'list-local-1', activeServerId: 5 },
      item: expect.objectContaining({ localId: 'item-1' }),
    });
  });

  it('removes item from Zustand state', async () => {
    await useListDetailStore.getState().deleteItem('item-1');

    expect(useListDetailStore.getState().items).toEqual([]);
  });

  it('does nothing when no activeLocalId', async () => {
    useListDetailStore.setState({ activeLocalId: null });
    await useListDetailStore.getState().deleteItem('item-1');
    expect(deleteItemOp).not.toHaveBeenCalled();
  });
});

// ─── saveItem ────────────────────────────────────────────────────────────────

describe('saveItem', () => {
  beforeEach(() => {
    useListDetailStore.setState({
      items: [makeItem()],
      activeLocalId: 'list-local-1',
      activeServerId: 5,
    });
  });

  it('calls saveItemOp with correct params', async () => {
    await useListDetailStore.getState().saveItem('item-1', 'Almond Milk', '500g', 'milk');

    expect(saveItemOp).toHaveBeenCalledWith({
      listContext: { activeLocalId: 'list-local-1', activeServerId: 5 },
      item: expect.objectContaining({ localId: 'item-1' }),
      name: 'Almond Milk',
      description: '500g',
      iconKey: 'milk',
    });
  });

  it('updates name, description, iconKey in Zustand state', async () => {
    (saveItemOp as jest.Mock).mockResolvedValue(makeItem({ name: 'Almond Milk', description: '500g', iconKey: 'milk' }));

    await useListDetailStore.getState().saveItem('item-1', 'Almond Milk', '500g', 'milk');

    const item = useListDetailStore.getState().items[0];
    expect(item.name).toBe('Almond Milk');
    expect(item.description).toBe('500g');
    expect(item.iconKey).toBe('milk');
  });

  it('does nothing when no activeLocalId', async () => {
    useListDetailStore.setState({ activeLocalId: null });
    await useListDetailStore.getState().saveItem('item-1', 'X', '', null);
    expect(saveItemOp).not.toHaveBeenCalled();
  });
});

// ─── addItem ─────────────────────────────────────────────────────────────────

describe('addItem', () => {
  beforeEach(() => {
    useListDetailStore.setState({ items: [], activeLocalId: 'list-local-1', activeServerId: 5 });
  });

  it('calls addItemOp with correct params', async () => {
    await useListDetailStore.getState().addItem('Bread', '', null, 'Other');

    expect(addItemOp).toHaveBeenCalledWith({
      listContext: { activeLocalId: 'list-local-1', activeServerId: 5 },
      currentItems: [],
      name: 'Bread',
      description: '',
      iconKey: null,
      category: 'Other',
    });
  });

  it('appends new item to state when action=added', async () => {
    const newItem = makeItem({ localId: 'new-item', name: 'Bread' });
    (addItemOp as jest.Mock).mockResolvedValue({ action: 'added', item: newItem });

    await useListDetailStore.getState().addItem('Bread', '', null, 'Other');

    expect(useListDetailStore.getState().items).toContainEqual(newItem);
  });

  it('updates existing item description in state when action=merged', async () => {
    const existing = makeItem({ localId: 'item-milk', name: 'Milk', description: '3L' });
    useListDetailStore.setState({ items: [existing], activeLocalId: 'list-local-1', activeServerId: 5 });
    (addItemOp as jest.Mock).mockResolvedValue({
      action: 'merged',
      item: { ...existing, description: '3L + 2L' },
    });

    await useListDetailStore.getState().addItem('Milk', '2L', null, 'Dairy');

    expect(useListDetailStore.getState().items[0].description).toBe('3L + 2L');
    expect(useListDetailStore.getState().items).toHaveLength(1);
  });

  it('does nothing when no activeLocalId', async () => {
    useListDetailStore.setState({ activeLocalId: null });
    await useListDetailStore.getState().addItem('Bread', '', null, 'Other');
    expect(addItemOp).not.toHaveBeenCalled();
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

// ─── moveItemToCategory ───────────────────────────────────────────────────────

describe('moveItemToCategory', () => {
  const dairyCategory = { id: 9, name: 'Dairy', ordering: 1 };

  beforeEach(() => {
    useListDetailStore.setState({
      items: [makeItem()],
      activeLocalId: 'list-local-1',
      activeServerId: 5,
      allCategories: [dairyCategory],
    });
  });

  it('calls moveItemToCategoryOp with resolved category', async () => {
    await useListDetailStore.getState().moveItemToCategory('item-1', 9);

    expect(moveItemToCategoryOp).toHaveBeenCalledWith({
      listContext: { activeLocalId: 'list-local-1', activeServerId: 5 },
      item: expect.objectContaining({ localId: 'item-1' }),
      category: dairyCategory,
    });
  });

  it('calls moveItemToCategoryOp with null when categoryId is null', async () => {
    await useListDetailStore.getState().moveItemToCategory('item-1', null);

    expect(moveItemToCategoryOp).toHaveBeenCalledWith(
      expect.objectContaining({ category: null })
    );
  });

  it('updates category fields in Zustand state', async () => {
    (moveItemToCategoryOp as jest.Mock).mockResolvedValue(
      makeItem({ category: 'Dairy', serverCategoryId: 9, serverCategoryName: 'Dairy', isDirty: true })
    );

    await useListDetailStore.getState().moveItemToCategory('item-1', 9);

    const item = useListDetailStore.getState().items[0];
    expect(item.category).toBe('Dairy');
    expect(item.serverCategoryId).toBe(9);
    expect(item.isDirty).toBe(true);
  });

  it('sets Uncategorized when categoryId is null', async () => {
    (moveItemToCategoryOp as jest.Mock).mockResolvedValue(
      makeItem({ category: 'Uncategorized', serverCategoryId: null })
    );

    await useListDetailStore.getState().moveItemToCategory('item-1', null);

    const item = useListDetailStore.getState().items[0];
    expect(item.category).toBe('Uncategorized');
    expect(item.serverCategoryId).toBeNull();
  });

  it('does nothing when no activeLocalId', async () => {
    useListDetailStore.setState({ activeLocalId: null });
    await useListDetailStore.getState().moveItemToCategory('item-1', 9);
    expect(moveItemToCategoryOp).not.toHaveBeenCalled();
  });
});
