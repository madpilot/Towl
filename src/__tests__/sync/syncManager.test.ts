/**
 * Tests for syncManager.drain().
 */

jest.mock('@/db/syncQueue', () => ({
  getAll: jest.fn(),
  remove: jest.fn(),
  incrementAttempts: jest.fn(),
}));

jest.mock('@/db/items', () => ({
  markItemSynced: jest.fn(),
  hardDeleteItem: jest.fn(),
  markItemCheckSynced: jest.fn(),
  getItem: jest.fn(),
}));

jest.mock('@/db/lists', () => ({
  markListSynced: jest.fn(),
  hardDeleteList: jest.fn(),
}));

jest.mock('@/sync/connectivityMonitor', () => ({
  useNetworkStore: {
    getState: jest.fn(() => ({ isOnline: true })),
  },
}));

const mockSetStatus = jest.fn();
const mockSetPendingCount = jest.fn();
const mockBumpSyncVersion = jest.fn();
jest.mock('@/store/syncStore', () => ({
  useSyncStore: {
    getState: jest.fn(() => ({
      setStatus: mockSetStatus,
      setPendingCount: mockSetPendingCount,
      bumpSyncVersion: mockBumpSyncVersion,
    })),
  },
}));

const mockApi = {
  addItemByName: jest.fn(),
  removeItemFromList: jest.fn(),
  deleteItem: jest.fn(),
  createShoppingList: jest.fn(),
  deleteShoppingList: jest.fn(),
  updateItemDescription: jest.fn(),
  updateItem: jest.fn(),
};
jest.mock('@/store/authStore', () => ({
  useAuthStore: {
    getState: jest.fn(() => ({ shoppingListsApi: mockApi })),
  },
}));

import * as syncQueue from '@/db/syncQueue';
import * as itemsDb from '@/db/items';
import * as listsDb from '@/db/lists';
import { useNetworkStore } from '@/sync/connectivityMonitor';
import { drain } from '@/sync/syncManager';

function makeAddOp(overrides: Partial<{ id: string; attempts: number }> = {}) {
  return {
    id: 'op-1',
    attempts: 0,
    listLocalId: 'list-local-1',
    createdAt: Date.now(),
    payload: {
      opType: 'ADD_ITEM' as const,
      listServerId: 5,
      listLocalId: 'list-local-1',
      itemLocalId: 'item-local-1',
      name: 'Milk',
      description: '',
    },
    ...overrides,
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  (useNetworkStore.getState as jest.Mock).mockReturnValue({ isOnline: true });
  (syncQueue.getAll as jest.Mock).mockResolvedValue([]);
  (syncQueue.remove as jest.Mock).mockResolvedValue(undefined);
  (syncQueue.incrementAttempts as jest.Mock).mockResolvedValue(undefined);
  // Default: item is not important (matches most test scenarios)
  (itemsDb.getItem as jest.Mock).mockResolvedValue({ isImportant: false, description: '' });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('drain()', () => {
  it('does nothing when offline', async () => {
    (useNetworkStore.getState as jest.Mock).mockReturnValue({ isOnline: false });
    await drain();
    expect(syncQueue.getAll).not.toHaveBeenCalled();
  });

  it('sets status to idle when queue is empty', async () => {
    await drain();
    expect(mockSetStatus).toHaveBeenCalledWith('idle');
  });

  it('processes ADD_ITEM op and marks item synced', async () => {
    const op = makeAddOp();
    (syncQueue.getAll as jest.Mock)
      .mockResolvedValueOnce([op])
      .mockResolvedValue([]);
    mockApi.addItemByName.mockResolvedValue({
      id: 99, name: 'Milk', description: '',
      category: { id: 9, name: '🥛 Dairy', ordering: 0, default_key: 'dairy' },
    });

    await drain();

    expect(mockApi.addItemByName).toHaveBeenCalledWith(5, 'Milk', '');
    expect(itemsDb.markItemSynced).toHaveBeenCalledWith('item-local-1', 99, 9, '🥛 Dairy', 0);
    expect(syncQueue.remove).toHaveBeenCalledWith('op-1');
  });

  it('processes CREATE_LIST op and marks list synced', async () => {
    const op = {
      id: 'op-2',
      attempts: 0,
      listLocalId: 'list-local-1',
      createdAt: Date.now(),
      payload: {
        opType: 'CREATE_LIST' as const,
        listLocalId: 'list-local-1',
        householdId: 1,
        name: 'Groceries',
      },
    };
    (syncQueue.getAll as jest.Mock)
      .mockResolvedValueOnce([op])
      .mockResolvedValue([]);
    mockApi.createShoppingList.mockResolvedValue({ id: 42 });

    await drain();

    expect(mockApi.createShoppingList).toHaveBeenCalledWith('Groceries', 1);
    expect(listsDb.markListSynced).toHaveBeenCalledWith('list-local-1', 42);
    expect(syncQueue.remove).toHaveBeenCalledWith('op-2');
  });

  it('increments attempts on retryable error', async () => {
    const op = makeAddOp();
    (syncQueue.getAll as jest.Mock)
      .mockResolvedValueOnce([op])
      .mockResolvedValue([op]);
    mockApi.addItemByName.mockRejectedValue(new Error('Network error'));

    await drain();

    expect(syncQueue.incrementAttempts).toHaveBeenCalledWith('op-1');
    expect(syncQueue.remove).not.toHaveBeenCalled();
  });

  it('removes op without retry on 4xx non-retryable error', async () => {
    const op = makeAddOp();
    (syncQueue.getAll as jest.Mock)
      .mockResolvedValueOnce([op])
      .mockResolvedValue([]);

    const axiosErr = Object.assign(new Error('Unprocessable'), {
      isAxiosError: true,
      response: { status: 422 },
    });
    mockApi.addItemByName.mockRejectedValue(axiosErr);

    await drain();

    expect(syncQueue.remove).toHaveBeenCalledWith('op-1');
    expect(syncQueue.incrementAttempts).not.toHaveBeenCalled();
  });

  it('processes UPDATE_ITEM op and calls updateItem API', async () => {
    const op = {
      id: 'op-upd',
      attempts: 0,
      listLocalId: 'list-local-1',
      createdAt: Date.now(),
      payload: {
        opType: 'UPDATE_ITEM' as const,
        listServerId: 5,
        itemServerId: 12,
        itemLocalId: 'item-local-1',
        name: 'Almond Milk',
        description: '2 bunches',
        iconKey: 'milk_carton',
        category: { id: 9, name: '🥛 Dairy', ordering: 0 },
      },
    };
    (syncQueue.getAll as jest.Mock)
      .mockResolvedValueOnce([op])
      .mockResolvedValue([]);
    mockApi.updateItem.mockResolvedValue(undefined);

    await drain();

    expect(mockApi.updateItem).toHaveBeenCalledWith(12, 'Almond Milk', '2 bunches', 'milk_carton', { id: 9, name: '🥛 Dairy', ordering: 0 });
    expect(itemsDb.markItemCheckSynced).toHaveBeenCalledWith('item-local-1');
    expect(syncQueue.remove).toHaveBeenCalledWith('op-upd');
  });

  it('ADD_ITEM: prepends ! to description when item isImportant=true', async () => {
    const op = makeAddOp();
    (syncQueue.getAll as jest.Mock)
      .mockResolvedValueOnce([op])
      .mockResolvedValue([]);
    (itemsDb.getItem as jest.Mock).mockResolvedValue({ isImportant: true, description: '' });
    mockApi.addItemByName.mockResolvedValue({ id: 99, name: 'Milk', description: '!' });

    await drain();

    expect(mockApi.addItemByName).toHaveBeenCalledWith(5, 'Milk', '!');
  });

  it('ADD_ITEM: does not prepend ! when item isImportant=false', async () => {
    const op = makeAddOp();
    (syncQueue.getAll as jest.Mock)
      .mockResolvedValueOnce([op])
      .mockResolvedValue([]);
    (itemsDb.getItem as jest.Mock).mockResolvedValue({ isImportant: false, description: '' });
    mockApi.addItemByName.mockResolvedValue({ id: 99, name: 'Milk', description: '' });

    await drain();

    expect(mockApi.addItemByName).toHaveBeenCalledWith(5, 'Milk', '');
  });

  it('UPDATE_ITEM: prepends ! to description when item isImportant=true', async () => {
    const op = {
      id: 'op-upd-imp',
      attempts: 0,
      listLocalId: 'list-local-1',
      createdAt: Date.now(),
      payload: {
        opType: 'UPDATE_ITEM' as const,
        listServerId: 5,
        itemServerId: 12,
        itemLocalId: 'item-local-1',
        name: 'Almond Milk',
        description: 'two pints',
        iconKey: 'milk_carton',
        category: null,
      },
    };
    (syncQueue.getAll as jest.Mock)
      .mockResolvedValueOnce([op])
      .mockResolvedValue([]);
    (itemsDb.getItem as jest.Mock).mockResolvedValue({ isImportant: true, description: 'two pints' });
    mockApi.updateItem.mockResolvedValue(undefined);

    await drain();

    expect(mockApi.updateItem).toHaveBeenCalledWith(12, 'Almond Milk', '!two pints', 'milk_carton', null);
  });

  it('UPDATE_ITEM: does not prepend ! when item isImportant=false', async () => {
    const op = {
      id: 'op-upd-noimp',
      attempts: 0,
      listLocalId: 'list-local-1',
      createdAt: Date.now(),
      payload: {
        opType: 'UPDATE_ITEM' as const,
        listServerId: 5,
        itemServerId: 12,
        itemLocalId: 'item-local-1',
        name: 'Almond Milk',
        description: 'two pints',
        iconKey: null,
        category: null,
      },
    };
    (syncQueue.getAll as jest.Mock)
      .mockResolvedValueOnce([op])
      .mockResolvedValue([]);
    (itemsDb.getItem as jest.Mock).mockResolvedValue({ isImportant: false, description: 'two pints' });
    mockApi.updateItem.mockResolvedValue(undefined);

    await drain();

    expect(mockApi.updateItem).toHaveBeenCalledWith(12, 'Almond Milk', 'two pints', null, null);
  });

  it('drops ops that have exceeded MAX_SYNC_RETRIES', async () => {
    const op = makeAddOp({ attempts: 999 });
    (syncQueue.getAll as jest.Mock)
      .mockResolvedValueOnce([op])
      .mockResolvedValue([]);

    await drain();

    expect(syncQueue.remove).toHaveBeenCalledWith('op-1');
    expect(mockApi.addItemByName).not.toHaveBeenCalled();
  });

  describe('syncVersion', () => {
    it('bumps syncVersion after a successful op is removed', async () => {
      const op = makeAddOp();
      (syncQueue.getAll as jest.Mock)
        .mockResolvedValueOnce([op])
        .mockResolvedValue([]);
      mockApi.addItemByName.mockResolvedValue({ id: 99, name: 'Milk', description: '' });

      await drain();

      expect(mockBumpSyncVersion).toHaveBeenCalledTimes(1);
    });

    it('bumps syncVersion when a max-retries op is dropped', async () => {
      const op = makeAddOp({ attempts: 999 });
      (syncQueue.getAll as jest.Mock)
        .mockResolvedValueOnce([op])
        .mockResolvedValue([]);

      await drain();

      expect(mockBumpSyncVersion).toHaveBeenCalledTimes(1);
    });

    it('bumps syncVersion when a non-retryable op is removed', async () => {
      const op = makeAddOp();
      (syncQueue.getAll as jest.Mock)
        .mockResolvedValueOnce([op])
        .mockResolvedValue([]);
      const axiosErr = Object.assign(new Error('Bad Request'), {
        isAxiosError: true,
        response: { status: 400 },
      });
      mockApi.addItemByName.mockRejectedValue(axiosErr);

      await drain();

      expect(mockBumpSyncVersion).toHaveBeenCalledTimes(1);
    });

    it('does not bump syncVersion when queue is empty', async () => {
      (syncQueue.getAll as jest.Mock).mockResolvedValue([]);

      await drain();

      expect(mockBumpSyncVersion).not.toHaveBeenCalled();
    });

    it('does not bump syncVersion when op fails with a retryable error', async () => {
      const op = makeAddOp();
      (syncQueue.getAll as jest.Mock)
        .mockResolvedValueOnce([op])
        .mockResolvedValue([op]);
      mockApi.addItemByName.mockRejectedValue(new Error('Network error'));

      await drain();

      expect(syncQueue.remove).not.toHaveBeenCalled();
      expect(mockBumpSyncVersion).not.toHaveBeenCalled();
    });
  });

  it('processes REMOVE_ITEM op: calls removeItemFromList and hard-deletes local item', async () => {
    const op = {
      id: 'op-remove',
      attempts: 0,
      listLocalId: 'list-local-1',
      createdAt: Date.now(),
      payload: {
        opType: 'REMOVE_ITEM' as const,
        listServerId: 5,
        itemServerId: 77,
        itemLocalId: 'item-local-1',
        removedAt: 1700000000000,
      },
    };
    (syncQueue.getAll as jest.Mock)
      .mockResolvedValueOnce([op])
      .mockResolvedValue([]);
    mockApi.removeItemFromList.mockResolvedValue(undefined);

    await drain();

    expect(mockApi.removeItemFromList).toHaveBeenCalledWith(5, 77, 1700000000000);
    expect(itemsDb.hardDeleteItem).toHaveBeenCalledWith('item-local-1');
    expect(syncQueue.remove).toHaveBeenCalledWith('op-remove');
  });

  it('REMOVE_ITEM: treats 404 as success (item already gone from server)', async () => {
    const op = {
      id: 'op-remove-404',
      attempts: 0,
      listLocalId: 'list-local-1',
      createdAt: Date.now(),
      payload: {
        opType: 'REMOVE_ITEM' as const,
        listServerId: 5,
        itemServerId: 77,
        itemLocalId: 'item-local-1',
        removedAt: 1700000000000,
      },
    };
    (syncQueue.getAll as jest.Mock)
      .mockResolvedValueOnce([op])
      .mockResolvedValue([]);
    const notFound = Object.assign(new Error('Not Found'), {
      isAxiosError: true,
      response: { status: 404 },
    });
    mockApi.removeItemFromList.mockRejectedValue(notFound);

    await drain();

    expect(syncQueue.remove).toHaveBeenCalledWith('op-remove-404');
    expect(itemsDb.hardDeleteItem).not.toHaveBeenCalled();
  });

  it('processes CHECK_ITEM op: calls removeItemFromList and marks item check-synced', async () => {
    const op = {
      id: 'op-check',
      attempts: 0,
      listLocalId: 'list-local-1',
      createdAt: Date.now(),
      payload: {
        opType: 'CHECK_ITEM' as const,
        listServerId: 5,
        itemServerId: 77,
        itemLocalId: 'item-local-1',
        removedAt: 1700000000000,
      },
    };
    (syncQueue.getAll as jest.Mock)
      .mockResolvedValueOnce([op])
      .mockResolvedValue([]);
    mockApi.removeItemFromList.mockResolvedValue(undefined);

    await drain();

    expect(mockApi.removeItemFromList).toHaveBeenCalledWith(5, 77, 1700000000000);
    expect(itemsDb.markItemCheckSynced).toHaveBeenCalledWith('item-local-1');
    expect(itemsDb.hardDeleteItem).not.toHaveBeenCalled();
    expect(syncQueue.remove).toHaveBeenCalledWith('op-check');
  });

  it('CHECK_ITEM: treats 404 as success (item already removed from server)', async () => {
    const op = {
      id: 'op-check-404',
      attempts: 0,
      listLocalId: null,
      createdAt: Date.now(),
      payload: {
        opType: 'CHECK_ITEM' as const,
        listServerId: 5,
        itemServerId: 77,
        itemLocalId: 'item-local-1',
        removedAt: 1700000000000,
      },
    };
    (syncQueue.getAll as jest.Mock)
      .mockResolvedValueOnce([op])
      .mockResolvedValue([]);
    const notFound = Object.assign(new Error('Not Found'), {
      isAxiosError: true,
      response: { status: 404 },
    });
    mockApi.removeItemFromList.mockRejectedValue(notFound);

    await drain();

    expect(syncQueue.remove).toHaveBeenCalledWith('op-check-404');
    expect(itemsDb.markItemCheckSynced).not.toHaveBeenCalled();
  });

  it('resets draining flag after completion so a follow-up drain processes remaining ops', async () => {
    const op = makeAddOp();
    const op2 = makeAddOp({ id: 'op-2' });
    (syncQueue.getAll as jest.Mock)
      .mockResolvedValueOnce([op])
      .mockResolvedValueOnce([op2])
      .mockResolvedValueOnce([op2])
      .mockResolvedValue([]);
    mockApi.addItemByName.mockResolvedValue({ id: 99 });

    await drain();
    await drain();

    expect(mockApi.addItemByName).toHaveBeenCalledTimes(2);
  });
});
