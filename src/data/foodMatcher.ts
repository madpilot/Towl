import Fuse from 'fuse.js';
import { ALL_ICON_KEYS } from '@/icons/kitchenowlIcons';
import { getIconMeta, DEFAULT_META, type IconMeta } from './iconMetadata';

export type MatchResult = {
  iconKey: string | null;
  emoji: string;
  category: string;
};

// ── Build search corpus ──────────────────────────────────────────────────────

type SearchEntry = {
  /** Display label — underscores replaced with spaces. */
  label: string;
  /** Original icon key stored in KitchenOwl. */
  iconKey: string;
};

const corpus: SearchEntry[] = ALL_ICON_KEYS.map((key) => ({
  iconKey: key,
  label: key.replaceAll('_', ' '),
}));

// ── Exact match map (O(1) for common inputs) ────────────────────────────────

const exactMap = new Map<string, string>(corpus.map(({ label, iconKey }) => [label, iconKey]));

// ── Fuse.js index ────────────────────────────────────────────────────────────

const fuse = new Fuse(corpus, {
  keys: ['label'],
  threshold: 0.4,
  distance: 100,
  includeScore: true,
  minMatchCharLength: 2,
  shouldSort: true,
});

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Matches a free-text item name to the closest KitchenOwl icon key.
 * Returns the icon key (for sending to the API), along with a fallback emoji
 * and inferred category for offline / pre-sync display.
 *
 * Returns `iconKey: null` with the default shopping-cart emoji when no
 * reasonable match is found.
 */
export function matchItem(input: string): MatchResult {
  const normalised = input.toLowerCase().trim();
  if (!normalised) {
    return { iconKey: null, ...DEFAULT_META };
  }

  // 1. Exact match
  const exact = exactMap.get(normalised);
  if (exact) {
    return buildResult(exact);
  }

  // 2. Fuzzy match
  const results = fuse.search(normalised);
  if (results.length > 0 && results[0].score !== undefined && results[0].score <= 0.4) {
    return buildResult(results[0].item.iconKey);
  }

  return { iconKey: null, ...DEFAULT_META };
}

/** Returns the top N candidate icon keys for a given input string. */
export function suggestIcons(input: string, limit = 8): Array<{ iconKey: string } & IconMeta> {
  const normalised = input.toLowerCase().trim();
  if (!normalised) {
    return [];
  }

  const results = fuse.search(normalised, { limit });
  return results.map((r) => ({
    iconKey: r.item.iconKey,
    ...getIconMeta(r.item.iconKey),
  }));
}

function buildResult(iconKey: string): MatchResult {
  const meta = getIconMeta(iconKey);
  return { iconKey, ...meta };
}
