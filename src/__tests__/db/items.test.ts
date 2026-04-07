jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));

import * as SQLite from 'expo-sqlite';
import { randomUUID } from 'expo-crypto';

const mockDb = {
  execAsync: jest.fn().mockResolvedValue(undefined),
  runAsync: jest.fn().mockResolvedValue(undefined),
  getFirstAsync: jest.fn().mockResolvedValue({ version: 2 }),
  getAllAsync: jest.fn().mockResolvedValue([]),
};

// Prime the db cache once so that subsequent calls to getDb() skip migration
// and don't consume getFirstAsync mock values.
beforeAll(async () => {
  (SQLite.openDatabaseAsync as jest.Mock).mockResolvedValue(mockDb);
  const { getDb } = require('@/db/schema');
  await getDb();
});

beforeEach(() => {
  jest.clearAllMocks();
  mockDb.execAsync.mockResolvedValue(undefined);
  mockDb.runAsync.mockResolvedValue(undefined);
  mockDb.getFirstAsync.mockResolvedValue({ version: 2 });
  mockDb.getAllAsync.mockResolvedValue([]);
  (SQLite.openDatabaseAsync as jest.Mock).mockResolvedValue(mockDb);
  (randomUUID as jest.Mock).mockReturnValue('test-uuid');
});

const getModule = () => require('@/db/items');

const baseRow = {
  local_id: 'item-1',
  server_id: 42,
  list_local_id: 'list-1',
  name: 'Milk',
  description: '',
  icon_key: 'milk',
  category: 'Dairy',
  is_checked: 0,
  is_important: 0,
  is_dirty: 0,
  is_deleted: 0,
  created_at: 1000,
};

describe('items', () => {
  describe('removeItemsDeletedOnServer', () => {
    it('deletes synced clean items whose serverId is absent from the server list', async () => {
      const { removeItemsDeletedOnServer } = getModule();
      await removeItemsDeletedOnServer('list-1', [10, 20]);
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('server_id NOT IN'),
        ['list-1', 10, 20]
      );
    });

    it('deletes all synced non-pending-removal items when server list is empty', async () => {
      const { removeItemsDeletedOnServer } = getModule();
      await removeItemsDeletedOnServer('list-1', []);
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('server_id IS NOT NULL AND is_deleted = 0'),
        ['list-1']
      );
      // Must NOT use NOT IN — empty IN clause is invalid SQL
      expect(mockDb.runAsync).not.toHaveBeenCalledWith(
        expect.stringContaining('NOT IN'),
        expect.anything()
      );
    });

    it('passes only the listLocalId and serverIds as parameters', async () => {
      const { removeItemsDeletedOnServer } = getModule();
      await removeItemsDeletedOnServer('list-99', [5, 6, 7]);
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.any(String),
        ['list-99', 5, 6, 7]
      );
    });

    it('targets only the given list (list_local_id filter is present)', async () => {
      const { removeItemsDeletedOnServer } = getModule();
      await removeItemsDeletedOnServer('list-A', [1]);
      const [sql] = mockDb.runAsync.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('list_local_id = ?');
    });

    it('excludes locally-added items by requiring server_id IS NOT NULL', async () => {
      const { removeItemsDeletedOnServer } = getModule();
      await removeItemsDeletedOnServer('list-1', [1]);
      const [sql] = mockDb.runAsync.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('server_id IS NOT NULL');
    });

    it('excludes pending-removal items by requiring is_deleted = 0', async () => {
      const { removeItemsDeletedOnServer } = getModule();
      await removeItemsDeletedOnServer('list-1', [1]);
      const [sql] = mockDb.runAsync.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('is_deleted = 0');
    });
  });

  describe('getItem', () => {
    it('returns null when item is not found', async () => {
      const { getItem } = getModule();
      // db is cached; getFirstAsync is called once for the actual query
      mockDb.getFirstAsync.mockResolvedValueOnce(null);

      const result = await getItem('missing-id');
      expect(result).toBeNull();
    });

    it('returns the item with correct fields when found', async () => {
      const { getItem } = getModule();
      mockDb.getFirstAsync.mockResolvedValueOnce(baseRow);

      const result = await getItem('item-1');
      expect(result?.localId).toBe('item-1');
      expect(result?.serverId).toBe(42);
      expect(result?.name).toBe('Milk');
      expect(result?.isDeleted).toBe(false);
    });

    it('returns the item even when soft-deleted (no is_deleted filter)', async () => {
      const { getItem } = getModule();
      mockDb.getFirstAsync.mockResolvedValueOnce({ ...baseRow, is_deleted: 1, server_id: 55 });

      const result = await getItem('item-1');
      expect(result?.isDeleted).toBe(true);
      expect(result?.serverId).toBe(55);
    });
  });
});
