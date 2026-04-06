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
