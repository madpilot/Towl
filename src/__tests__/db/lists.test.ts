jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));

import { openDatabaseAsync } from 'expo-sqlite';
import { randomUUID } from 'expo-crypto';

const mockDb = {
  execAsync: jest.fn().mockResolvedValue(undefined),
  runAsync: jest.fn().mockResolvedValue(undefined),
  getFirstAsync: jest.fn().mockResolvedValue({ version: 1 }),
  getAllAsync: jest.fn().mockResolvedValue([]),
};

let uuidCounter = 0;

// Prime the db cache once before any tests run so that subsequent calls to
// getDb() skip migration and don't consume getFirstAsync mock values.
beforeAll(async () => {
  (openDatabaseAsync as jest.Mock).mockResolvedValue(mockDb);
  const { getDb } = require('@/db/schema');
  await getDb(); // initialises + caches db, runs migration (consumes one getFirstAsync)
});

beforeEach(() => {
  uuidCounter = 0;
  jest.clearAllMocks();
  mockDb.execAsync.mockResolvedValue(undefined);
  mockDb.runAsync.mockResolvedValue(undefined);
  mockDb.getFirstAsync.mockResolvedValue({ version: 1 });
  mockDb.getAllAsync.mockResolvedValue([]);
  (openDatabaseAsync as jest.Mock).mockResolvedValue(mockDb);
  (randomUUID as jest.Mock).mockImplementation(() => `uuid-${++uuidCounter}`);
});

const getModule = () => require('@/db/lists');

const makeListRow = (overrides = {}) => ({
  local_id: 'local-1',
  server_id: 10,
  household_id: 1,
  name: 'Weekly Shop',
  is_dirty: 0,
  is_deleted: 0,
  last_synced: 1000,
  ...overrides,
});

describe('lists db', () => {
  describe('getAllLists', () => {
    it('returns mapped LocalList objects', async () => {
      const { getAllLists } = getModule();
      mockDb.getAllAsync.mockResolvedValueOnce([makeListRow()]);

      const lists = await getAllLists(1);

      expect(lists).toHaveLength(1);
      expect(lists[0]).toMatchObject({
        localId: 'local-1',
        serverId: 10,
        householdId: 1,
        name: 'Weekly Shop',
        isDirty: false,
        isDeleted: false,
      });
    });

    it('returns empty array when no lists exist', async () => {
      const { getAllLists } = getModule();
      mockDb.getAllAsync.mockResolvedValueOnce([]);
      expect(await getAllLists(1)).toEqual([]);
    });
  });

  describe('createListLocally', () => {
    it('inserts a new list with null serverId and isDirty=true', async () => {
      const { createListLocally } = getModule();
      const list = await createListLocally(1, 'Groceries');

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO local_lists'),
        expect.arrayContaining(['uuid-1', 1, 'Groceries'])
      );
      expect(list).toMatchObject({
        localId: 'uuid-1',
        serverId: null,
        householdId: 1,
        name: 'Groceries',
        isDirty: true,
        isDeleted: false,
      });
    });
  });

  describe('markListSynced', () => {
    it('updates server_id and clears is_dirty', async () => {
      const { markListSynced } = getModule();
      await markListSynced('local-1', 99);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('server_id = ?'),
        expect.arrayContaining([99, 'local-1'])
      );
    });
  });

  describe('softDeleteList', () => {
    it('marks list as deleted and dirty', async () => {
      const { softDeleteList } = getModule();
      await softDeleteList('local-1');

      expect(mockDb.runAsync).toHaveBeenCalledWith(expect.stringContaining('is_deleted = 1'), [
        'local-1',
      ]);
    });
  });

  describe('getListByServerId', () => {
    it('returns null when not found', async () => {
      const { getListByServerId } = getModule();
      // db is cached; getFirstAsync is called once for the actual query
      mockDb.getFirstAsync.mockResolvedValueOnce(null);

      const result = await getListByServerId(999);
      expect(result).toBeNull();
    });

    it('returns mapped list when found', async () => {
      const { getListByServerId } = getModule();
      mockDb.getFirstAsync.mockResolvedValueOnce(
        makeListRow({ server_id: 42, local_id: 'found-1' })
      );

      const result = await getListByServerId(42);
      expect(result?.localId).toBe('found-1');
      expect(result?.serverId).toBe(42);
    });
  });

  describe('upsertListFromServer', () => {
    it('creates a new local row when no existing list has that serverId', async () => {
      const { upsertListFromServer } = getModule();
      mockDb.getFirstAsync
        .mockResolvedValueOnce(null) // lookup by server_id — not found
        .mockResolvedValueOnce(makeListRow({ local_id: 'uuid-1', server_id: 5, name: 'Party' })); // read-back

      const list = await upsertListFromServer(5, 1, 'Party');

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO local_lists'),
        expect.arrayContaining(['uuid-1', 5, 1, 'Party'])
      );
      expect(list.name).toBe('Party');
      expect(list.serverId).toBe(5);
      expect(list.localId).toBe('uuid-1');
    });

    it('reuses the existing localId when the list already exists in SQLite', async () => {
      const { upsertListFromServer } = getModule();
      mockDb.getFirstAsync
        .mockResolvedValueOnce(makeListRow({ local_id: 'existing-1', server_id: 5 })) // found
        .mockResolvedValueOnce(makeListRow({ local_id: 'existing-1', server_id: 5, name: 'Party' })); // read-back

      const list = await upsertListFromServer(5, 1, 'Party');

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO local_lists'),
        expect.arrayContaining(['existing-1', 5, 1, 'Party'])
      );
      expect(list.localId).toBe('existing-1');
    });
  });

  describe('removeListsDeletedOnServer', () => {
    it('deletes synced non-deleted lists absent from the server list', async () => {
      const { removeListsDeletedOnServer } = getModule();
      await removeListsDeletedOnServer(1, [10, 20]);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('server_id NOT IN'),
        [1, 10, 20]
      );
    });

    it('deletes all synced lists when serverIds is empty', async () => {
      const { removeListsDeletedOnServer } = getModule();
      await removeListsDeletedOnServer(1, []);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('server_id IS NOT NULL'),
        [1]
      );
      expect(mockDb.runAsync).not.toHaveBeenCalledWith(
        expect.stringContaining('NOT IN'),
        expect.anything()
      );
    });

    it('does not delete lists that are pending a DELETE_LIST sync op (is_deleted=1)', async () => {
      const { removeListsDeletedOnServer } = getModule();
      await removeListsDeletedOnServer(1, []);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('is_deleted = 0'),
        expect.anything()
      );
    });
  });
});
