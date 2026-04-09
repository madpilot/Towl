// jest.mock factories must only use globals — no out-of-scope variables.
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));

import * as SQLite from 'expo-sqlite';
import { randomUUID } from 'expo-crypto';
import type { AddItemPayload, RemoveItemPayload } from '@/db/syncQueue';

// Shared mock db — shared across all tests in this file because schema.ts
// caches the db handle at module level after the first getDb() call.
const mockDb = {
  execAsync: jest.fn(),
  runAsync: jest.fn(),
  getFirstAsync: jest.fn(),
  getAllAsync: jest.fn(),
};

let uuidCounter = 0;

beforeEach(() => {
  uuidCounter = 0;
  jest.clearAllMocks();

  // Reset mock implementations after clearAllMocks.
  mockDb.execAsync.mockResolvedValue(undefined);
  mockDb.runAsync.mockResolvedValue(undefined);
  mockDb.getFirstAsync.mockResolvedValue({ version: 1 }); // schema already at v1
  mockDb.getAllAsync.mockResolvedValue([]);

  (SQLite.openDatabaseAsync as jest.Mock).mockResolvedValue(mockDb);
  (randomUUID as jest.Mock).mockImplementation(() => `test-uuid-${++uuidCounter}`);
});

// Lazy import so the module picks up the mock.
const getModule = () => require('@/db/syncQueue');

describe('syncQueue', () => {
  describe('enqueue', () => {
    it('inserts an ADD_ITEM op and returns the typed record', async () => {
      const { enqueue } = getModule();
      const payload: AddItemPayload = {
        opType: 'ADD_ITEM',
        listServerId: 42,
        listLocalId: 'local-list-1',
        itemLocalId: 'local-item-1',
        name: 'Milk',
        description: '2 litres',
      };

      const op = await enqueue(payload, 'local-list-1');

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO sync_queue'),
        expect.arrayContaining(['test-uuid-1', JSON.stringify(payload)])
      );
      expect(op.id).toBe('test-uuid-1');
      expect(op.payload).toEqual(payload);
      expect(op.listLocalId).toBe('local-list-1');
      expect(op.attempts).toBe(0);
    });

    it('inserts a REMOVE_ITEM op with null listLocalId when not provided', async () => {
      const { enqueue } = getModule();
      const payload: RemoveItemPayload = {
        opType: 'REMOVE_ITEM',
        listServerId: 42,
        itemServerId: 7,
        itemLocalId: 'local-item-2',
      };

      const op = await enqueue(payload);

      expect(op.payload.opType).toBe('REMOVE_ITEM');
      expect(op.listLocalId).toBeNull();
    });
  });

  describe('getAll', () => {
    it('returns empty array when queue is empty', async () => {
      const { getAll } = getModule();
      mockDb.getAllAsync.mockResolvedValueOnce([]);

      const ops = await getAll();
      expect(ops).toEqual([]);
    });

    it('deserialises JSON payload correctly', async () => {
      const { getAll } = getModule();
      const payload: AddItemPayload = {
        opType: 'ADD_ITEM',
        listServerId: 1,
        listLocalId: 'l1',
        itemLocalId: 'i1',
        name: 'Eggs',
        description: '',
      };
      mockDb.getAllAsync.mockResolvedValueOnce([
        {
          id: 'some-id',
          payload: JSON.stringify(payload),
          list_local_id: 'l1',
          created_at: 1000,
          attempts: 0,
        },
      ]);

      const ops = await getAll();

      expect(ops).toHaveLength(1);
      expect(ops[0].payload).toEqual(payload);
      expect(ops[0].id).toBe('some-id');
    });

    it('throws when stored payload has an unknown opType', async () => {
      const { getAll } = getModule();
      mockDb.getAllAsync.mockResolvedValueOnce([
        {
          id: 'bad-id',
          payload: JSON.stringify({ opType: 'UNKNOWN_OP', data: 'garbage' }),
          list_local_id: null,
          created_at: 1000,
          attempts: 0,
        },
      ]);

      await expect(getAll()).rejects.toThrow();
    });
  });

  describe('remove', () => {
    it('calls DELETE with the correct id', async () => {
      const { remove } = getModule();
      await remove('abc-123');
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        'DELETE FROM sync_queue WHERE id = ?',
        ['abc-123']
      );
    });
  });

  describe('incrementAttempts', () => {
    it('updates attempts counter', async () => {
      const { incrementAttempts } = getModule();
      await incrementAttempts('abc-123');
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('attempts = attempts + 1'),
        ['abc-123']
      );
    });
  });

  describe('clearAll', () => {
    it('deletes all rows', async () => {
      const { clearAll } = getModule();
      await clearAll();
      expect(mockDb.runAsync).toHaveBeenCalledWith('DELETE FROM sync_queue');
    });
  });

  describe('CHECK_ITEM payload', () => {
    it('enqueues a CHECK_ITEM op successfully', async () => {
      const { enqueue } = getModule();
      const op = await enqueue({
        opType: 'CHECK_ITEM',
        listServerId: 1,
        itemServerId: 99,
        itemLocalId: 'local-item-1',
      });
      expect(op.payload.opType).toBe('CHECK_ITEM');
      expect(op.payload).toMatchObject({
        listServerId: 1,
        itemServerId: 99,
        itemLocalId: 'local-item-1',
      });
    });

    it('deserialises CHECK_ITEM payload from the queue', async () => {
      const { getAll } = getModule();
      const payload = {
        opType: 'CHECK_ITEM',
        listServerId: 5,
        itemServerId: 42,
        itemLocalId: 'item-abc',
      };
      mockDb.getAllAsync.mockResolvedValueOnce([
        { id: 'q-id', payload: JSON.stringify(payload), list_local_id: 'l1', created_at: 1000, attempts: 0 },
      ]);

      const ops = await getAll();
      expect(ops[0].payload.opType).toBe('CHECK_ITEM');
    });
  });

  describe('removePendingCheckItem', () => {
    it('returns false and removes nothing when no CHECK_ITEM op exists for the item', async () => {
      const { removePendingCheckItem } = getModule();
      mockDb.getAllAsync.mockResolvedValueOnce([]);

      const found = await removePendingCheckItem('item-xyz');
      expect(found).toBe(false);
      expect(mockDb.runAsync).not.toHaveBeenCalled();
    });

    it('removes matching CHECK_ITEM op and returns true', async () => {
      const { removePendingCheckItem } = getModule();
      const payload = { opType: 'CHECK_ITEM', listServerId: 1, itemServerId: 2, itemLocalId: 'item-abc' };
      mockDb.getAllAsync.mockResolvedValueOnce([
        { id: 'op-1', payload: JSON.stringify(payload), list_local_id: null, created_at: 1000, attempts: 0 },
      ]);

      const found = await removePendingCheckItem('item-abc');
      expect(found).toBe(true);
      expect(mockDb.runAsync).toHaveBeenCalledWith('DELETE FROM sync_queue WHERE id = ?', ['op-1']);
    });

    it('does not remove ops for different items', async () => {
      const { removePendingCheckItem } = getModule();
      const payload = { opType: 'CHECK_ITEM', listServerId: 1, itemServerId: 2, itemLocalId: 'item-other' };
      mockDb.getAllAsync.mockResolvedValueOnce([
        { id: 'op-2', payload: JSON.stringify(payload), list_local_id: null, created_at: 1000, attempts: 0 },
      ]);

      const found = await removePendingCheckItem('item-abc');
      expect(found).toBe(false);
      expect(mockDb.runAsync).not.toHaveBeenCalled();
    });
  });
});
