import { useEffect, useRef, useState } from 'react';
import { searchHistory } from '@/db/history';
import { suggestIcons } from '@/data/foodMatcher';
import { getIconMeta } from '@/data/iconMetadata';
import type { HistoryEntry } from '@/db/history';
import type { IconMeta } from '@/data/iconMetadata';

export type ItemSuggestion = {
  /** Unique key for React lists. */
  key: string;
  /** Display name shown to the user. */
  displayName: string;
  /** Emoji fallback for the icon. */
  emoji: string;
  /** KitchenOwl icon key (null if not matched). */
  iconKey: string | null;
  /** Item category. */
  category: string;
  /** True when this suggestion came from the user's history. */
  fromHistory: boolean;
};

/** Minimal shape the hook requires from a server search result. */
export type ServerItem = {
  name: string;
  icon?: string | null;
  category?: { name: string } | null;
};

const DEBOUNCE_MS = 180;

/**
 * Returns a combined, deduplicated suggestion list for a given input string.
 *
 * Results are built in two phases:
 *   1. Local (history + Fuse.js fuzzy) — emitted after the debounce period.
 *   2. Server catalog search — merged in when the network call resolves.
 *
 * Priority order: history > server catalog results > local icon fuzzy matches.
 * Server errors (offline) are swallowed silently; local results remain visible.
 *
 * @param searchFn  Optional async function that queries the server catalog.
 *                  Pass null to skip the server phase (e.g. while unauthenticated).
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

    if (timerRef.current) clearTimeout(timerRef.current);

    // Invalidate any in-flight server call from the previous run.
    cancelRef.current.cancelled = true;
    const run = { cancelled: false };
    cancelRef.current = run;

    const delay = trimmed.length < 2 ? 0 : DEBOUNCE_MS;
    timerRef.current = setTimeout(() => {
      if (trimmed.length < 2) {
        setSuggestions([]);
        return;
      }

      // ── Phase 1: local suggestions (history + Fuse.js) ────────────────────
      buildLocalSuggestions(trimmed, limit)
        .then((local) => {
          if (run.cancelled) return;
          setSuggestions(local);

          // ── Phase 2: server catalog search ─────────────────────────────────
          const fn = searchFnRef.current;
          if (!fn) return;

          fn(trimmed)
            .then((serverItems) => {
              if (run.cancelled) return;
              setSuggestions(mergeServerResults(local, serverItems, limit));
            })
            .catch(() => {
              // Offline or API error — local results already shown, nothing to do.
            });
        })
        .catch(() => {
          if (!run.cancelled) setSuggestions([]);
        });
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      run.cancelled = true;
    };
  }, [input, limit]); // searchFnRef is a stable ref — safe to omit from deps

  return suggestions;
}

// ─── Local suggestions ────────────────────────────────────────────────────────

async function buildLocalSuggestions(
  query: string,
  limit: number
): Promise<ItemSuggestion[]> {
  const historyEntries = await searchHistory(query, limit);
  const historySuggestions: ItemSuggestion[] = historyEntries.map(
    (entry: HistoryEntry) => ({
      key: `history:${entry.name}`,
      displayName: entry.displayName,
      emoji: entry.iconKey ? iconToEmoji(entry.iconKey) : '🛒',
      iconKey: entry.iconKey,
      category: entry.category,
      fromHistory: true,
    })
  );

  const seenNames = new Set(historyEntries.map((e: HistoryEntry) => e.name));
  const remaining = limit - historySuggestions.length;
  const iconSuggestions: ItemSuggestion[] =
    remaining > 0
      ? suggestIcons(query, remaining + seenNames.size)
          .filter((s) => !seenNames.has(s.iconKey.replaceAll('_', ' ')))
          .slice(0, remaining)
          .map((s) => ({
            key: `icon:${s.iconKey}`,
            displayName: s.iconKey.replaceAll('_', ' '),
            emoji: s.emoji,
            iconKey: s.iconKey,
            category: s.category,
            fromHistory: false,
          }))
      : [];

  return [...historySuggestions, ...iconSuggestions];
}

// ─── Server merge ─────────────────────────────────────────────────────────────

/**
 * Merges server catalog results into an existing local suggestion list.
 *
 * Ordering: history → server items (not already in history) → icon fuzzy
 * matches (not already covered by history or server). Capped at `limit`.
 */
function mergeServerResults(
  local: ItemSuggestion[],
  serverItems: ServerItem[],
  limit: number
): ItemSuggestion[] {
  const historyItems = local.filter((s) => s.fromHistory);
  const iconItems = local.filter((s) => !s.fromHistory);

  const seenNames = new Set(historyItems.map((s) => s.displayName.toLowerCase()));

  const serverSuggestions: ItemSuggestion[] = serverItems
    .filter((item) => !seenNames.has(item.name.toLowerCase()))
    .map((item) => {
      seenNames.add(item.name.toLowerCase());
      return {
        key: `server:${item.name}`,
        displayName: item.name,
        emoji: item.icon ? iconToEmoji(item.icon) : '🛒',
        iconKey: item.icon ?? null,
        category: item.category?.name ?? 'Other',
        fromHistory: false,
      };
    });

  const filteredIconItems = iconItems.filter(
    (s) => !seenNames.has(s.displayName.toLowerCase())
  );

  return [...historyItems, ...serverSuggestions, ...filteredIconItems].slice(0, limit);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function iconToEmoji(iconKey: string): string {
  const meta: IconMeta = getIconMeta(iconKey);
  return meta.emoji;
}
