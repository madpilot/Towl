import type { ServerItem } from '@/hooks/useItemSuggestions';

export type ParseResult = {
  name: string;
  description: string;
  iconKey: string | null;
  category: string;
};

/**
 * Returns true when the top search result's name exactly matches the candidate
 * (case-insensitive, trimmed). This is a "strong match" — the server found an
 * exact catalog item for the candidate tokens, so those tokens are the item name
 * and everything before them is the description prefix.
 */
function isStrongMatch(candidate: string, result: ServerItem): boolean {
  return result.name.trim().toLowerCase() === candidate.trim().toLowerCase();
}

/**
 * Splits a free-text input (e.g. "500g Beef Mince") into a canonical catalog
 * name ("Beef Mince") and a description prefix ("500g") by progressively
 * stripping leading tokens and querying the server catalog.
 *
 * Algorithm:
 *   For i = 0 … tokens.length − 1:
 *     candidate = tokens[i…].join(' ')
 *     results   = await searchFn(candidate)
 *     if results[0] strongly matches candidate:
 *       → name = results[0].name, description = tokens[0…i-1].join(' ')
 *   Fallback: name = raw input, description = ''
 *
 * "Strong match" means the top result's name equals the candidate after
 * case-insensitive normalisation. The search API handles fuzzy lookup
 * internally, so if the user typed a recognised catalog item name the server
 * will return it as the first result.
 */
export async function parseItemInput(
  raw: string,
  searchFn: (query: string) => Promise<ServerItem[]>
): Promise<ParseResult> {
  const trimmed = raw.trim();
  const tokens = trimmed.split(/\s+/);

  for (let i = 0; i < tokens.length; i++) {
    const candidate = tokens.slice(i).join(' ');
    try {
      const results = await searchFn(candidate);
      if (results.length > 0 && isStrongMatch(candidate, results[0])) {
        return {
          name: results[0].name,
          description: tokens.slice(0, i).join(' '),
          iconKey: results[0].icon ?? null,
          category: results[0].category?.name ?? 'Other',
        };
      }
    } catch {
      // Search failed for this candidate — try the next split point
    }
  }

  return { name: trimmed, description: '', iconKey: null, category: 'Other' };
}
