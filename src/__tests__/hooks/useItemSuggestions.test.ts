/**
 * Tests for useItemSuggestions hook.
 */

jest.mock('@/db/history', () => ({
  searchHistory: jest.fn(),
}));

jest.mock('@/data/foodMatcher', () => ({
  suggestIcons: jest.fn(),
}));

jest.mock('@/data/iconMetadata', () => ({
  getIconMeta: jest.fn(() => ({ emoji: '🍎', category: 'Produce' })),
}));

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useItemSuggestions } from '@/hooks/useItemSuggestions';
import type { ServerItem } from '@/hooks/useItemSuggestions';
import * as history from '@/db/history';
import * as foodMatcher from '@/data/foodMatcher';

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  (history.searchHistory as jest.Mock).mockResolvedValue([]);
  (foodMatcher.suggestIcons as jest.Mock).mockReturnValue([]);
});

afterEach(() => {
  jest.useRealTimers();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeHistoryEntry(overrides: Partial<ReturnType<typeof baseHistoryEntry>> = {}) {
  return baseHistoryEntry(overrides);
}

function baseHistoryEntry(overrides = {}) {
  return {
    id: 1,
    name: 'milk',
    displayName: 'Milk',
    iconKey: 'milk',
    category: 'Dairy & Eggs',
    useCount: 5,
    lastUsedAt: Date.now(),
    ...overrides,
  };
}

function makeServerItem(overrides: Partial<ServerItem> = {}): ServerItem {
  return {
    name: 'Avocado',
    icon: 'avocado',
    category: { name: 'Fruits and vegetables' },
    ...overrides,
  };
}

// ── Basic behaviour ───────────────────────────────────────────────────────────

describe('useItemSuggestions', () => {
  it('returns empty array when input is less than 2 chars', async () => {
    const { result } = renderHook(() => useItemSuggestions('a'));
    expect(result.current).toEqual([]);
    expect(history.searchHistory).not.toHaveBeenCalled();
  });

  it('debounces the query and returns combined results', async () => {
    (history.searchHistory as jest.Mock).mockResolvedValue([makeHistoryEntry()]);
    (foodMatcher.suggestIcons as jest.Mock).mockReturnValue([
      { iconKey: 'milk_carton', emoji: '🥛', category: 'Dairy & Eggs' },
    ]);

    const { result } = renderHook(() => useItemSuggestions('mil'));

    expect(result.current).toEqual([]);

    await act(async () => { jest.runAllTimers(); });
    await waitFor(() => expect(result.current.length).toBeGreaterThan(0));

    expect(result.current[0].fromHistory).toBe(true);
    expect(result.current[0].displayName).toBe('Milk');
    expect(result.current[0].key).toBe('history:milk');
  });

  it('deduplicates icon suggestions already in history', async () => {
    (history.searchHistory as jest.Mock).mockResolvedValue([makeHistoryEntry()]);
    (foodMatcher.suggestIcons as jest.Mock).mockReturnValue([
      { iconKey: 'milk', emoji: '🥛', category: 'Dairy & Eggs' },
    ]);

    const { result } = renderHook(() => useItemSuggestions('mil'));
    await act(async () => { jest.runAllTimers(); });
    await waitFor(() => expect(result.current.length).toBeGreaterThan(0));

    const milkEntries = result.current.filter((s) =>
      s.displayName.toLowerCase() === 'milk'
    );
    expect(milkEntries).toHaveLength(1);
  });

  it('returns only icon suggestions when history is empty', async () => {
    (history.searchHistory as jest.Mock).mockResolvedValue([]);
    (foodMatcher.suggestIcons as jest.Mock).mockReturnValue([
      { iconKey: 'apple', emoji: '🍎', category: 'Produce' },
    ]);

    const { result } = renderHook(() => useItemSuggestions('app'));
    await act(async () => { jest.runAllTimers(); });
    await waitFor(() => expect(result.current.length).toBeGreaterThan(0));

    expect(result.current[0].fromHistory).toBe(false);
    expect(result.current[0].key).toBe('icon:apple');
  });

  it('cancels pending debounce when input changes', async () => {
    const { rerender } = renderHook(
      ({ input }: { input: string }) => useItemSuggestions(input),
      { initialProps: { input: 'mi' } }
    );

    rerender({ input: 'mil' });

    await act(async () => { jest.runAllTimers(); });

    expect(history.searchHistory).toHaveBeenCalledTimes(1);
    expect(history.searchHistory).toHaveBeenCalledWith('mil', 8);
  });

  // ── Server search ─────────────────────────────────────────────────────────

  describe('with searchFn', () => {
    it('shows local results before server results arrive', async () => {
      (history.searchHistory as jest.Mock).mockResolvedValue([makeHistoryEntry()]);

      let resolveServer!: (items: ServerItem[]) => void;
      const searchFn = jest.fn(
        () => new Promise<ServerItem[]>((res) => { resolveServer = res; })
      );

      const { result } = renderHook(() => useItemSuggestions('mil', 8, searchFn));

      await act(async () => { jest.runAllTimers(); });
      await waitFor(() => expect(result.current.length).toBeGreaterThan(0));

      // Local history result is shown immediately, before server resolves.
      expect(result.current[0].fromHistory).toBe(true);
      expect(result.current[0].displayName).toBe('Milk');

      // Server resolves with a different item.
      await act(async () => { resolveServer([makeServerItem()]); });

      // History item is still present, server item is also present.
      const names = result.current.map((s) => s.displayName);
      expect(names).toContain('Milk');
      expect(names).toContain('Avocado');
    });

    it('places server results between history and icon fuzzy matches', async () => {
      (history.searchHistory as jest.Mock).mockResolvedValue([makeHistoryEntry()]);
      (foodMatcher.suggestIcons as jest.Mock).mockReturnValue([
        { iconKey: 'almond_milk', emoji: '🥛', category: 'Dairy & Eggs' },
      ]);

      const searchFn = jest.fn().mockResolvedValue([makeServerItem({ name: 'Avocado', icon: 'avocado' })]);

      const { result } = renderHook(() => useItemSuggestions('mi', 8, searchFn));
      await act(async () => { jest.runAllTimers(); });
      await waitFor(() =>
        expect(result.current.some((s) => s.key === 'server:Avocado')).toBe(true)
      );

      const keys = result.current.map((s) => s.key);
      const historyIdx = keys.indexOf('history:milk');
      const serverIdx = keys.indexOf('server:Avocado');
      const iconIdx = keys.findIndex((k) => k.startsWith('icon:'));

      expect(historyIdx).toBeLessThan(serverIdx);
      if (iconIdx !== -1) {
        expect(serverIdx).toBeLessThan(iconIdx);
      }
    });

    it('deduplicates server results already in history', async () => {
      (history.searchHistory as jest.Mock).mockResolvedValue([makeHistoryEntry()]);
      // Server also returns "milk" — should be dropped.
      const searchFn = jest.fn().mockResolvedValue([
        makeServerItem({ name: 'milk', icon: 'milk' }),
        makeServerItem({ name: 'Avocado', icon: 'avocado' }),
      ]);

      const { result } = renderHook(() => useItemSuggestions('mil', 8, searchFn));
      await act(async () => { jest.runAllTimers(); });
      await waitFor(() =>
        expect(result.current.some((s) => s.key === 'server:Avocado')).toBe(true)
      );

      const milkEntries = result.current.filter(
        (s) => s.displayName.toLowerCase() === 'milk'
      );
      expect(milkEntries).toHaveLength(1);
    });

    it('keeps local results when server call fails', async () => {
      (history.searchHistory as jest.Mock).mockResolvedValue([makeHistoryEntry()]);
      const searchFn = jest.fn().mockRejectedValue(new Error('offline'));

      const { result } = renderHook(() => useItemSuggestions('mil', 8, searchFn));
      await act(async () => { jest.runAllTimers(); });
      await waitFor(() => expect(result.current.length).toBeGreaterThan(0));

      // Local result survives the server error.
      expect(result.current[0].displayName).toBe('Milk');
    });

    it('does not call searchFn when input is less than 2 chars', async () => {
      const searchFn = jest.fn().mockResolvedValue([]);

      renderHook(() => useItemSuggestions('a', 8, searchFn));
      await act(async () => { jest.runAllTimers(); });

      expect(searchFn).not.toHaveBeenCalled();
    });

    it('respects the limit when server adds results', async () => {
      (history.searchHistory as jest.Mock).mockResolvedValue([makeHistoryEntry()]);
      const manyServerItems = Array.from({ length: 10 }, (_, i) =>
        makeServerItem({ name: `Item ${i}`, icon: null })
      );
      const searchFn = jest.fn().mockResolvedValue(manyServerItems);

      const { result } = renderHook(() => useItemSuggestions('mi', 5, searchFn));
      await act(async () => { jest.runAllTimers(); });
      await waitFor(() => expect(result.current.length).toBe(5));

      expect(result.current.length).toBe(5);
    });

    it('sets server result iconKey from icon field', async () => {
      (history.searchHistory as jest.Mock).mockResolvedValue([]);
      const searchFn = jest.fn().mockResolvedValue([
        makeServerItem({ name: 'Avocado', icon: 'avocado' }),
      ]);

      const { result } = renderHook(() => useItemSuggestions('avo', 8, searchFn));
      await act(async () => { jest.runAllTimers(); });
      await waitFor(() => expect(result.current.length).toBeGreaterThan(0));

      expect(result.current[0].iconKey).toBe('avocado');
      expect(result.current[0].key).toBe('server:Avocado');
    });

    it('uses "Other" category when server item has no category', async () => {
      (history.searchHistory as jest.Mock).mockResolvedValue([]);
      const searchFn = jest.fn().mockResolvedValue([
        makeServerItem({ name: 'Mystery', icon: null, category: null }),
      ]);

      const { result } = renderHook(() => useItemSuggestions('mys', 8, searchFn));
      await act(async () => { jest.runAllTimers(); });
      await waitFor(() => expect(result.current.length).toBeGreaterThan(0));

      expect(result.current[0].category).toBe('Other');
    });
  });
});
