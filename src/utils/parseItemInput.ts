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
 * Splits a free-text input (e.g. "500g Chicken Mince") into a canonical
 * name and a description prefix by querying the server catalog.
 *
 * Algorithm:
 *   For i = 0 … tokens.length − 1  (description prefix length):
 *     For j = tokens.length … i + 1  (match span end, longest first):
 *       candidate = tokens[i … j-1].join(' ')
 *       results   = await searchFn(candidate)
 *       if results[0] strongly matches candidate:
 *         → description = tokens[0 … i-1].join(' ')
 *         → name = results[0].name + tokens[j…].join(' ')  (catalog name + trailing tokens)
 *   Fallback: name = raw input, description = ''
 *
 * Examples:
 *   "500g Beef Mince"   → catalog has "Beef Mince" → name="Beef Mince", desc="500g"
 *   "500g Chicken Mince"→ catalog has "Chicken"   → name="Chicken Mince", desc="500g"
 *
 * Trying longer spans before shorter ones for a given prefix ensures that a
 * multi-word catalog entry (e.g. "Chicken Mince") beats a shorter entry
 * ("Chicken") when both are present in the catalog.
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
    for (let j = tokens.length; j > i; j--) {
      const candidate = tokens.slice(i, j).join(' ');
      try {
        const results = await searchFn(candidate);
        if (results.length > 0 && isStrongMatch(candidate, results[0])) {
          const trailing = tokens.slice(j);
          const name = trailing.length > 0
            ? `${results[0].name} ${trailing.join(' ')}`
            : results[0].name;
          return {
            name,
            description: tokens.slice(0, i).join(' '),
            iconKey: results[0].icon ?? null,
            category: results[0].category?.name ?? 'Other',
          };
        }
      } catch {
        // Search failed for this candidate — try the next split point
      }
    }
  }

  return { name: trimmed, description: '', iconKey: null, category: 'Other' };
}
