import type { ServerItem } from '@/hooks/useItemSuggestions';

export type ParseResult = {
  name: string;
  description: string;
  iconKey: string | null;
  category: string;
};

/**
 * Common function words that indicate a description prefix rather than the
 * start of an item name. Only applied to leading tokens — once a non-filtered
 * token is encountered, filtering stops.
 */
const STOP_WORDS = new Set([
  'a', 'an', 'the',
  'of', 'for', 'with', 'and', 'or', 'to', 'in', 'on', 'at', 'by',
  'some', 'x',
]);

/**
 * Returns true for tokens that are almost certainly description words rather
 * than the start of a catalog item name:
 *   - Tokens whose first character is a digit ("500g", "1L", "10", "2x")
 *   - Common English function words unlikely to be catalog item names
 */
function isDescriptionToken(token: string): boolean {
  return /^\d/.test(token) || STOP_WORDS.has(token.toLowerCase());
}

/**
 * Splits a free-text input (e.g. "500g of Chicken Mince") into a canonical
 * name and a description prefix by first filtering obvious description words
 * then querying the server catalog one token at a time.
 *
 * Algorithm:
 *   1. Pre-filter: advance past leading digit-tokens and stop words without
 *      any API calls — they are never catalog item names.
 *      Stop as soon as the first non-filtered token is reached.
 *        "500g of Chicken Mince" → skip "500g", "of"; start at "Chicken"
 *        "10 fillets of fish"   → skip "10" only; "of"/"fish" stay in suffix
 *   2. From the first non-filtered token, search one token at a time:
 *        results = await searchFn(tokens[i])
 *        if results is empty: token is a description word → continue
 *        otherwise: anchor found — item name starts here
 *          suffix      = tokens[i … end].join(' ')
 *          description = tokens[0 … i-1].join(' ')
 *          exactMatch  = results.find(r.name ≅ suffix)
 *          if found   → use that catalog entry's name/icon/category
 *          if not     → suffix becomes a new item name; icon/category from
 *                        the result matching tokens[i] alone, or results[0]
 *   3. Fallback: name = raw input, description = ''
 */
export async function parseItemInput(
  raw: string,
  searchFn: (query: string) => Promise<ServerItem[]>
): Promise<ParseResult> {
  const trimmed = raw.trim();
  const tokens = trimmed.split(/\s+/);

  // Step 1 — pre-filter: skip obvious description tokens from the left.
  let startIndex = 0;
  while (startIndex < tokens.length && isDescriptionToken(tokens[startIndex])) {
    startIndex++;
  }

  // Step 2 — search loop starting from the first non-filtered token.
  for (let i = startIndex; i < tokens.length; i++) {
    let results: ServerItem[];
    try {
      results = await searchFn(tokens[i]);
    } catch {
      continue;
    }
    if (results.length === 0) continue;

    const suffix = tokens.slice(i).join(' ');
    const description = tokens.slice(0, i).join(' ');
    const suffixLower = suffix.toLowerCase();

    // Check if any catalog result exactly matches the full remaining input.
    const exactMatch = results.find(
      (r) => r.name.trim().toLowerCase() === suffixLower
    );
    if (exactMatch) {
      return {
        name: exactMatch.name,
        description,
        iconKey: exactMatch.icon ?? null,
        category: exactMatch.category?.name ?? 'Other',
      };
    }

    // No exact match — the remaining input becomes a new item name.
    // Prefer icon/category from the result that matches the anchor token alone.
    const anchorResult =
      results.find((r) => r.name.trim().toLowerCase() === tokens[i].toLowerCase())
      ?? results[0];
    return {
      name: suffix,
      description,
      iconKey: anchorResult.icon ?? null,
      category: anchorResult.category?.name ?? 'Other',
    };
  }

  return { name: trimmed, description: '', iconKey: null, category: 'Other' };
}
