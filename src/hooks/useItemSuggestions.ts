import { useEffect, useRef, useState } from 'react';

export type ItemSuggestion = {
  /** Unique key for React lists. */
  key: string;
  /** Display name shown to the user. */
  displayName: string;
  /** KitchenOwl icon key (null if not matched). */
  iconKey: string | null;
  /** Item category. */
  category: string;
};

/** Minimal shape the hook requires from a server search result. */
export type ServerItem = {
  name: string;
  icon?: string | null;
  category?: { name: string } | null;
};

const DEBOUNCE_MS = 180;

/**
 * Returns a debounced suggestion list from the server catalog for a given
 * input string.  Requires a `searchFn` to fire network requests; returns an
 * empty array when `searchFn` is null (e.g. while unauthenticated or offline).
 *
 * @param searchFn  Async function that queries the server catalog.
 *                  Pass null to produce no suggestions.
 */
export function useItemSuggestions(
  input: string,
  limit = 8,
  searchFn: ((query: string) => Promise<ServerItem[]>) | null = null
): ItemSuggestion[] {
  const [suggestions, setSuggestions] = useState<ItemSuggestion[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Each effect run gets its own cancellable token so stale callbacks are no-ops.
  const cancelRef = useRef<{ cancelled: boolean }>({ cancelled: false });
  // Stable ref keeps searchFn out of effect deps while staying current.
  const searchFnRef = useRef(searchFn);
  useEffect(() => { searchFnRef.current = searchFn; });

  useEffect(() => {
    const trimmed = input.trim();

    if (timerRef.current) { clearTimeout(timerRef.current); }

    cancelRef.current.cancelled = true;
    const run = { cancelled: false };
    cancelRef.current = run;

    const delay = trimmed.length < 2 ? 0 : DEBOUNCE_MS;
    timerRef.current = setTimeout(() => {
      if (trimmed.length < 2) {
        setSuggestions([]);
        return;
      }

      const fn = searchFnRef.current;
      if (!fn) {
        setSuggestions([]);
        return;
      }

      void (async () => {
        try {
          const items = await fn(trimmed);
          if (run.cancelled) { return; }
          setSuggestions(
            items.slice(0, limit).map((item) => ({
              key: `server:${item.name}`,
              displayName: item.name,
              iconKey: item.icon ?? null,
              category: item.category?.name ?? 'Uncategorised',
            }))
          );
        } catch {
          if (!run.cancelled) { setSuggestions([]); }
        }
      })();
    }, delay);

    return () => {
      if (timerRef.current) { clearTimeout(timerRef.current); }
      run.cancelled = true;
    };
  }, [input, limit]); // searchFnRef is a stable ref — safe to omit from deps

  return suggestions;
}
