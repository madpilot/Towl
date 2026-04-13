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
  checked_at: null,
};

describe('items', () => {
  describe('parseImportantDescription', () => {
    it('returns isImportant=false and unchanged description when no leading !', () => {
      const { parseImportantDescription } = getModule();
      expect(parseImportantDescription('some item')).toEqual({ description: 'some item', isImportant: false });
    });

    it('returns isImportant=true and strips the leading ! when present', () => {
      const { parseImportantDescription } = getModule();
      expect(parseImportantDescription('!buy this')).toEqual({ description: 'buy this', isImportant: true });
    });

    it('also strips spaces after the ! so leading whitespace is removed', () => {
      const { parseImportantDescription } = getModule();
      expect(parseImportantDescription('!  spaced')).toEqual({ description: 'spaced', isImportant: true });
    });

    it('returns isImportant=false for an empty string', () => {
      const { parseImportantDescription } = getModule();
      expect(parseImportantDescription('')).toEqual({ description: '', isImportant: false });
    });
  });

  describe('getItemsForList', () => {
    it('orders items with is_important DESC, name ASC', async () => {
      const { getItemsForList } = getModule();
      await getItemsForList('list-1');
      const [sql] = mockDb.getAllAsync.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('is_important DESC');
      expect(sql).toContain('name ASC');
    });
  });

  describe('upsertItemFromServer', () => {
    it('strips ! from description and sets is_important=1 on insert when description starts with !', async () => {
      const { upsertItemFromServer } = getModule();
      // No existing row
      mockDb.getFirstAsync
        .mockResolvedValueOnce(null) // existing check
        .mockResolvedValueOnce({ ...baseRow, local_id: 'test-uuid', server_id: 10, description: 'buy this', is_important: 1, is_dirty: 0, is_deleted: 0 }); // read-back

      await upsertItemFromServer(10, 'list-1', 'Milk', '!buy this', null, 'Dairy', null, null, null);

      const [sql, params] = mockDb.runAsync.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('is_important');
      // description stored without !
      expect(params).toContain('buy this');
      // is_important = 1
      expect(params).toContain(1);
      // raw '!' not stored
      expect(params).not.toContain('!buy this');
    });

    it('sets is_important=0 on insert when description has no !', async () => {
      const { upsertItemFromServer } = getModule();
      mockDb.getFirstAsync
        .mockResolvedValueOnce(null) // existing check
        .mockResolvedValueOnce({ ...baseRow, local_id: 'test-uuid', server_id: 11, description: 'plain', is_important: 0, is_dirty: 0, is_deleted: 0 }); // read-back

      await upsertItemFromServer(11, 'list-1', 'Eggs', 'plain', null, 'Dairy', null, null, null);

      const [, params] = mockDb.runAsync.mock.calls[0] as [string, unknown[]];
      expect(params).toContain(0); // is_important = 0
      expect(params).toContain('plain');
    });

    it('updates is_important on existing non-dirty row when server description starts with !', async () => {
      const { upsertItemFromServer } = getModule();
      mockDb.getFirstAsync
        .mockResolvedValueOnce({ ...baseRow, is_dirty: 0 }) // existing check
        .mockResolvedValueOnce({ ...baseRow, description: 'urgent', is_important: 1 }); // read-back

      await upsertItemFromServer(42, 'list-1', 'Milk', '!urgent', null, 'Dairy', null, null, null);

      const [sql, params] = mockDb.runAsync.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('is_important');
      expect(params).toContain('urgent'); // stripped
      expect(params).toContain(1); // is_important = 1
    });

    it('skips UPDATE for existing dirty row (local edits take priority)', async () => {
      const { upsertItemFromServer } = getModule();
      mockDb.getFirstAsync
        .mockResolvedValueOnce({ ...baseRow, is_dirty: 1 }) // existing check
        .mockResolvedValueOnce({ ...baseRow, is_dirty: 1 }); // read-back

      await upsertItemFromServer(42, 'list-1', 'Milk', '!urgent', null, 'Dairy', null, null, null);

      expect(mockDb.runAsync).not.toHaveBeenCalled();
    });
  });

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
        expect.stringContaining('server_id IS NOT NULL'),
        ['list-1']
      );
      // Trolley items (is_checked = 1) must be preserved
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('is_checked = 0'),
        expect.anything()
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

  describe('checkItem', () => {
    it('sets is_checked=1, is_dirty=1, and checked_at on the row', async () => {
      const { checkItem } = getModule();
      await checkItem('item-1', 9000);
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('is_checked = 1'),
        [9000, 'item-1']
      );
      const [sql] = mockDb.runAsync.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('is_dirty = 1');
      expect(sql).toContain('checked_at = ?');
    });
  });

  describe('uncheckItem', () => {
    it('clears is_checked and checked_at, sets is_dirty when needsReAdd=true', async () => {
      const { uncheckItem } = getModule();
      await uncheckItem('item-1', true);
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('is_checked = 0'),
        [1, 'item-1']
      );
      const [sql] = mockDb.runAsync.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('checked_at = NULL');
    });

    it('sets is_dirty=0 when needsReAdd=false (op still pending)', async () => {
      const { uncheckItem } = getModule();
      await uncheckItem('item-1', false);
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.any(String),
        [0, 'item-1']
      );
    });
  });

  describe('clearCheckedItems', () => {
    it('hard-deletes all checked items for the list', async () => {
      const { clearCheckedItems } = getModule();
      await clearCheckedItems('list-1');
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('is_checked = 1'),
        ['list-1']
      );
      const [sql] = mockDb.runAsync.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('DELETE FROM local_items');
    });
  });

  describe('clearExpiredCheckedItems', () => {
    it('deletes checked items with checked_at older than the cutoff', async () => {
      const { clearExpiredCheckedItems } = getModule();
      await clearExpiredCheckedItems('list-1', 5000);
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('checked_at < ?'),
        ['list-1', 5000]
      );
      const [sql] = mockDb.runAsync.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('checked_at IS NOT NULL');
      expect(sql).toContain('is_checked = 1');
    });
  });

  describe('removeItemsDeletedOnServer', () => {
    it('preserves trolley items (is_checked = 1) when removing server-deleted items', async () => {
      const { removeItemsDeletedOnServer } = getModule();
      await removeItemsDeletedOnServer('list-1', [10]);
      const [sql] = mockDb.runAsync.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('is_checked = 0');
    });
  });
});
