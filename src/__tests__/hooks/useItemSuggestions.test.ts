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

describe('useItemSuggestions', () => {
  it('returns empty array when input is less than 2 chars', async () => {
    const { result } = renderHook(() => useItemSuggestions('a'));
    expect(result.current).toEqual([]);
    expect(history.searchHistory).not.toHaveBeenCalled();
  });

  it('debounces the query and returns combined results', async () => {
    const historyEntry = {
      id: 1,
      name: 'milk',
      displayName: 'Milk',
      iconKey: 'milk',
      category: 'Dairy & Eggs',
      useCount: 5,
      lastUsedAt: Date.now(),
    };
    (history.searchHistory as jest.Mock).mockResolvedValue([historyEntry]);
    (foodMatcher.suggestIcons as jest.Mock).mockReturnValue([
      { iconKey: 'milk_carton', emoji: '🥛', category: 'Dairy & Eggs' },
    ]);

    const { result } = renderHook(() => useItemSuggestions('mil'));

    // Before debounce fires
    expect(result.current).toEqual([]);

    // Fire debounce timer
    await act(async () => { jest.runAllTimers(); });
    await waitFor(() => expect(result.current.length).toBeGreaterThan(0));

    // History result comes first
    expect(result.current[0].fromHistory).toBe(true);
    expect(result.current[0].displayName).toBe('Milk');
    expect(result.current[0].key).toBe('history:milk');
  });

  it('deduplicates icon suggestions already in history', async () => {
    const historyEntry = {
      id: 1,
      name: 'milk',
      displayName: 'Milk',
      iconKey: 'milk',
      category: 'Dairy & Eggs',
      useCount: 3,
      lastUsedAt: Date.now(),
    };
    (history.searchHistory as jest.Mock).mockResolvedValue([historyEntry]);
    // suggestIcons returns an entry whose label matches the history name
    (foodMatcher.suggestIcons as jest.Mock).mockReturnValue([
      { iconKey: 'milk', emoji: '🥛', category: 'Dairy & Eggs' },
    ]);

    const { result } = renderHook(() => useItemSuggestions('mil'));
    await act(async () => { jest.runAllTimers(); });
    await waitFor(() => expect(result.current.length).toBeGreaterThan(0));

    // Only one entry — the icon duplicate is filtered out
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

    // Change input before debounce fires
    rerender({ input: 'mil' });

    await act(async () => { jest.runAllTimers(); });

    // searchHistory should only be called once (for the final input)
    expect(history.searchHistory).toHaveBeenCalledTimes(1);
    expect(history.searchHistory).toHaveBeenCalledWith('mil', 8);
  });
});
