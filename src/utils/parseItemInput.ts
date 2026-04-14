import type { ServerItem } from '@/hooks/useItemSuggestions';

export type ParseResult = {
  name: string;
  description: string;
  iconKey: string | null;
  category: string;
};

/**
 * Splits a free-text input (e.g. "500g Chicken Mince") into a canonical
 * name and a description prefix by querying the server catalog one token at
 * a time and scanning the returned result list for an exact suffix match.
 *
 * Algorithm:
 *   For i = 0 … tokens.length − 1:
 *     results = await searchFn(tokens[i])      ← single-token query
 *     if results is empty: tokens[i] is a description word → continue
 *     suffix      = tokens[i … end].join(' ')
 *     description = tokens[0 … i-1].join(' ')
 *     exactMatch  = results.find(r => r.name ≅ suffix)   ← case-insensitive
 *     if exactMatch:
 *       → return { name: exactMatch.name, description, … }
 *     else:
 *       → return { name: suffix, description, icon/category from anchor result }
 *   Fallback: name = raw input, description = ''
 *
 * Examples (catalog: "Chicken", "Chicken Mince"):
 *   "500g Chicken Mince" → search "500g"→[], "Chicken"→["Chicken","Chicken Mince"]
 *                          suffix "Chicken Mince" found in results
 *                          → name="Chicken Mince", desc="500g"
 *   "500g Chicken Tenders" → search "Chicken"→["Chicken","Chicken Mince"]
 *                            suffix "Chicken Tenders" NOT in results
 *                            → name="Chicken Tenders" (new), desc="500g"
 *
 * The icon and category for a newly-created item are taken from the result
 * that exactly matches the anchor token (tokens[i]), or from results[0] if
 * no such result exists.
 */
export async function parseItemInput(
  raw: string,
  searchFn: (query: string) => Promise<ServerItem[]>
): Promise<ParseResult> {
  const trimmed = raw.trim();
  const tokens = trimmed.split(/\s+/);

  for (let i = 0; i < tokens.length; i++) {
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
