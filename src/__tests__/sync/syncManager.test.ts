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
}));

jest.mock('@/db/lists', () => ({
  markListSynced: jest.fn(),
  hardDeleteList: jest.fn(),
}));

jest.mock('@/api/shoppinglists', () => ({
  addItemByName: jest.fn(),
  removeItem: jest.fn(),
  createShoppingList: jest.fn(),
  deleteShoppingList: jest.fn(),
  updateItemDescription: jest.fn(),
}));

jest.mock('@/sync/connectivityMonitor', () => ({
  useNetworkStore: {
    getState: jest.fn(() => ({ isOnline: true })),
  },
}));

const mockSetStatus = jest.fn();
const mockSetPendingCount = jest.fn();
jest.mock('@/store/syncStore', () => ({
  useSyncStore: {
    getState: jest.fn(() => ({
      setStatus: mockSetStatus,
      setPendingCount: mockSetPendingCount,
    })),
  },
}));

import * as syncQueue from '@/db/syncQueue';
import * as itemsDb from '@/db/items';
import * as listsDb from '@/db/lists';
import * as api from '@/api/shoppinglists';
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
    (api.addItemByName as jest.Mock).mockResolvedValue({ item_id: 99 });

    await drain();

    expect(api.addItemByName).toHaveBeenCalledWith(5, 'Milk', '');
    expect(itemsDb.markItemSynced).toHaveBeenCalledWith('item-local-1', 99);
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
        name: 'Groceries',
      },
    };
    (syncQueue.getAll as jest.Mock)
      .mockResolvedValueOnce([op])
      .mockResolvedValue([]);
    (api.createShoppingList as jest.Mock).mockResolvedValue({ id: 42 });

    await drain();

    expect(api.createShoppingList).toHaveBeenCalledWith('Groceries');
    expect(listsDb.markListSynced).toHaveBeenCalledWith('list-local-1', 42);
    expect(syncQueue.remove).toHaveBeenCalledWith('op-2');
  });

  it('increments attempts on retryable error', async () => {
    const op = makeAddOp();
    (syncQueue.getAll as jest.Mock)
      .mockResolvedValueOnce([op])
      .mockResolvedValue([op]);
    (api.addItemByName as jest.Mock).mockRejectedValue(new Error('Network error'));

    await drain();

    expect(syncQueue.incrementAttempts).toHaveBeenCalledWith('op-1');
    expect(syncQueue.remove).not.toHaveBeenCalled();
  });

  it('removes op without retry on 4xx non-retryable error', async () => {
    const op = makeAddOp();
    (syncQueue.getAll as jest.Mock)
      .mockResolvedValueOnce([op])
      .mockResolvedValue([]);

    // Construct an axios-like error with isAxiosError flag
    const axiosErr = Object.assign(new Error('Unprocessable'), {
      isAxiosError: true,
      response: { status: 422 },
    });
    (api.addItemByName as jest.Mock).mockRejectedValue(axiosErr);

    await drain();

    expect(syncQueue.remove).toHaveBeenCalledWith('op-1');
    expect(syncQueue.incrementAttempts).not.toHaveBeenCalled();
  });

  it('drops ops that have exceeded MAX_SYNC_RETRIES', async () => {
    const op = makeAddOp({ attempts: 999 });
    (syncQueue.getAll as jest.Mock)
      .mockResolvedValueOnce([op])
      .mockResolvedValue([]);

    await drain();

    expect(syncQueue.remove).toHaveBeenCalledWith('op-1');
    expect(api.addItemByName).not.toHaveBeenCalled();
  });
});
