jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

import { openDatabaseAsync } from 'expo-sqlite';

const mockDb = {
  execAsync: jest.fn(),
  runAsync: jest.fn(),
  getFirstAsync: jest.fn(),
  getAllAsync: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockDb.execAsync.mockResolvedValue(undefined);
  mockDb.runAsync.mockResolvedValue(undefined);
  mockDb.getFirstAsync.mockResolvedValue({ version: 1 });
  mockDb.getAllAsync.mockResolvedValue([]);
  (openDatabaseAsync as jest.Mock).mockResolvedValue(mockDb);
});

const getModule = () => require('@/db/history');

const makeHistoryRow = (overrides = {}) => ({
  id: 1,
  name: 'milk',
  display_name: 'Milk',
  icon_key: 'milk_carton',
  category: 'Dairy & Eggs',
  use_count: 3,
  last_used_at: 5000,
  ...overrides,
});

describe('history db', () => {
  describe('recordItemUsed', () => {
    it('upserts with normalised lowercase key', async () => {
      const { recordItemUsed } = getModule();
      await recordItemUsed('Oat Milk', 'oat_milk', 'Dairy & Eggs');

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO item_history'),
        expect.arrayContaining(['oat milk', 'Oat Milk', 'oat_milk', 'Dairy & Eggs'])
      );
    });

    it('uses null icon_key when none provided', async () => {
      const { recordItemUsed } = getModule();
      await recordItemUsed('Mystery Item', null, '');

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining(['mystery item', 'Mystery Item', null, ''])
      );
    });
  });

  describe('getRecentHistory', () => {
    it('returns mapped entries ordered by last_used_at', async () => {
      const { getRecentHistory } = getModule();
      mockDb.getAllAsync.mockResolvedValueOnce([
        makeHistoryRow({ id: 2, name: 'butter', display_name: 'Butter', last_used_at: 9000 }),
        makeHistoryRow(),
      ]);

      const entries = await getRecentHistory(10);

      expect(entries).toHaveLength(2);
      expect(entries[0].displayName).toBe('Butter');
      expect(entries[1].displayName).toBe('Milk');
    });
  });

  describe('searchHistory', () => {
    it('passes LIKE pattern to the query', async () => {
      const { searchHistory } = getModule();
      await searchHistory('mil', 5);

      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('LIKE ?'),
        ['%mil%', 5]
      );
    });

    it('lowercases and trims the query', async () => {
      const { searchHistory } = getModule();
      await searchHistory('  BUTTER  ', 5);

      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.anything(),
        ['%butter%', 5]
      );
    });
  });

  describe('getFrequentHistory', () => {
    it('calls with use_count ordering', async () => {
      const { getFrequentHistory } = getModule();
      await getFrequentHistory(10);

      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('use_count DESC'),
        [10]
      );
    });
  });
});
