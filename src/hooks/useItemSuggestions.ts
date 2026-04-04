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
}

const DEBOUNCE_MS = 180;

/**
 * Returns a combined, deduplicated suggestion list for a given input string.
 * History matches are ranked first; icon fuzzy matches fill the remainder.
 * Results are debounced to avoid excessive SQLite queries while typing.
 */
export function useItemSuggestions(input: string, limit = 8): ItemSuggestion[] {
  const [suggestions, setSuggestions] = useState<ItemSuggestion[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const trimmed = input.trim();

    if (timerRef.current) clearTimeout(timerRef.current);

    // Use 0ms delay for clearing so setState never fires synchronously in the effect.
    const delay = trimmed.length < 2 ? 0 : DEBOUNCE_MS;
    timerRef.current = setTimeout(() => {
      if (trimmed.length < 2) {
        setSuggestions([]);
        return;
      }
      buildSuggestions(trimmed, limit).then(setSuggestions).catch(() => {
        setSuggestions([]);
      });
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [input, limit]);

  return suggestions;
}

async function buildSuggestions(
  query: string,
  limit: number
): Promise<ItemSuggestion[]> {
  // 1. History matches (from SQLite, ranked by frequency + recency)
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

  // 2. Icon fuzzy matches (fill remaining slots)
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

/** Returns the emoji for a given icon key via iconMetadata. */
function iconToEmoji(iconKey: string): string {
  const meta: IconMeta = getIconMeta(iconKey);
  return meta.emoji;
}
