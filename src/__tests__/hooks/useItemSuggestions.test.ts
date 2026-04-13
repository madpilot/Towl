/**
 * Tests for useItemSuggestions hook.
 */

jest.mock('@/data/iconMetadata', () => ({
  getIconMeta: jest.fn(() => ({ emoji: '🍎', category: 'Produce' })),
}));

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useItemSuggestions } from '@/hooks/useItemSuggestions';
import type { ServerItem } from '@/hooks/useItemSuggestions';

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeServerItem(overrides: Partial<ServerItem> = {}): ServerItem {
  return {
    name: 'Avocado',
    icon: 'avocado',
    category: { name: 'Fruits and vegetables' },
    ...overrides,
  };
}

function makeSearchFn(items: ServerItem[]) {
  return jest.fn().mockResolvedValue(items);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useItemSuggestions', () => {
  it('returns empty array when input is less than 2 chars', async () => {
    const searchFn = makeSearchFn([makeServerItem()]);
    const { result } = renderHook(() => useItemSuggestions('a', 8, searchFn));
    expect(result.current).toEqual([]);
    expect(searchFn).not.toHaveBeenCalled();
  });

  it('returns empty array when searchFn is null (offline)', async () => {
    const { result } = renderHook(() => useItemSuggestions('avo', 8, null));
    await act(async () => { jest.runAllTimers(); });
    expect(result.current).toEqual([]);
  });

  it('debounces the query before calling searchFn', async () => {
    const searchFn = makeSearchFn([makeServerItem()]);
    renderHook(() => useItemSuggestions('avo', 8, searchFn));

    // Not called before debounce fires
    expect(searchFn).not.toHaveBeenCalled();

    await act(async () => { jest.runAllTimers(); });
    expect(searchFn).toHaveBeenCalledWith('avo');
  });

  it('returns mapped server results after debounce', async () => {
    const searchFn = makeSearchFn([makeServerItem()]);
    const { result } = renderHook(() => useItemSuggestions('avo', 8, searchFn));

    await act(async () => { jest.runAllTimers(); });
    await waitFor(() => expect(result.current.length).toBeGreaterThan(0));

    expect(result.current[0].key).toBe('server:Avocado');
    expect(result.current[0].displayName).toBe('Avocado');
    expect(result.current[0].iconKey).toBe('avocado');
    expect(result.current[0].category).toBe('Fruits and vegetables');
  });

  it('uses "Other" category when server item has no category', async () => {
    const searchFn = makeSearchFn([makeServerItem({ name: 'Mystery', icon: null, category: null })]);
    const { result } = renderHook(() => useItemSuggestions('mys', 8, searchFn));

    await act(async () => { jest.runAllTimers(); });
    await waitFor(() => expect(result.current.length).toBeGreaterThan(0));

    expect(result.current[0].category).toBe('Other');
  });

  it('sets iconKey to null when server item has no icon', async () => {
    const searchFn = makeSearchFn([makeServerItem({ icon: null })]);
    const { result } = renderHook(() => useItemSuggestions('avo', 8, searchFn));

    await act(async () => { jest.runAllTimers(); });
    await waitFor(() => expect(result.current.length).toBeGreaterThan(0));

    expect(result.current[0].iconKey).toBeNull();
  });

  it('respects the limit', async () => {
    const manyItems = Array.from({ length: 10 }, (_, i) =>
      makeServerItem({ name: `Item ${i}` })
    );
    const searchFn = makeSearchFn(manyItems);
    const { result } = renderHook(() => useItemSuggestions('it', 4, searchFn));

    await act(async () => { jest.runAllTimers(); });
    await waitFor(() => expect(result.current.length).toBe(4));
  });

  it('returns empty array when server call fails', async () => {
    const searchFn = jest.fn().mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useItemSuggestions('avo', 8, searchFn));

    await act(async () => { jest.runAllTimers(); });
    await waitFor(() => expect(searchFn).toHaveBeenCalled());

    expect(result.current).toEqual([]);
  });

  it('cancels stale request when input changes before debounce fires', async () => {
    const searchFn = makeSearchFn([makeServerItem()]);
    const { rerender } = renderHook(
      ({ input }: { input: string }) => useItemSuggestions(input, 8, searchFn),
      { initialProps: { input: 'av' } }
    );

    rerender({ input: 'avo' });

    await act(async () => { jest.runAllTimers(); });

    // Only called once — for the final input
    expect(searchFn).toHaveBeenCalledTimes(1);
    expect(searchFn).toHaveBeenCalledWith('avo');
  });

  it('clears suggestions when input drops below 2 chars', async () => {
    const searchFn = makeSearchFn([makeServerItem()]);
    const { result, rerender } = renderHook(
      ({ input }: { input: string }) => useItemSuggestions(input, 8, searchFn),
      { initialProps: { input: 'avo' } }
    );

    await act(async () => { jest.runAllTimers(); });
    await waitFor(() => expect(result.current.length).toBeGreaterThan(0));

    rerender({ input: 'a' });
    await act(async () => { jest.runAllTimers(); });

    expect(result.current).toEqual([]);
  });
});
