import type { ServerItem } from '@/hooks/useItemSuggestions';

export type ParseResult = {
  name: string;
  description: string;
  iconKey: string | null;
  category: string;
};

/**
 * Matches purely numeric tokens ("10", "500") and numbers joined to a unit
 * or multiplier suffix ("500g", "1L", "2x", "1.5kg", "250ml").
 */
const QUANTITY_RE = /^\d+(?:\.\d+)?[a-zA-Z]*$/;

/**
 * Words that are never catalog item names and should be treated as description
 * prefixes when they appear at the start of the input.
 *
 * Includes:
 *   - Common articles, prepositions and conjunctions
 *   - Vague quantifiers
 *   - Standalone food measurement units (for inputs like "500 g chicken")
 */
const STOP_WORDS = new Set([
  // Articles, conjunctions, prepositions
  'a', 'an', 'the', 'and', 'or',
  'of', 'for', 'with', 'to', 'in', 'on', 'at', 'by',
  // Vague quantifiers / filler words
  'some', 'x', 'stuff', 'things',
  // Standalone food measurement units
  'g', 'kg', 'mg', 'ml', 'l', 'cl', 'dl',
  'lb', 'lbs', 'oz', 'fl',
  'cup', 'cups', 'tsp', 'tbsp',
  'teaspoon', 'teaspoons', 'tablespoon', 'tablespoons',
  'pint', 'pints', 'litre', 'litres', 'liter', 'liters',
  'piece', 'pieces', 'slice', 'slices', 'pc', 'pcs',
]);

/**
 * Returns true for tokens that are description words rather than the start
 * of a catalog item name:
 *   - Purely numeric or number-with-unit tokens ("10", "500g", "1L", "2x", "1.5kg")
 *   - Common function words and standalone food measurement units
 */
function isDescriptionToken(token: string): boolean {
  return QUANTITY_RE.test(token) || STOP_WORDS.has(token.toLowerCase());
}

/**
 * Splits a free-text grocery input into a canonical item name and a
 * description prefix by filtering obvious quantity/modifier tokens from the
 * left, then making a single catalog search for the remainder.
 *
 * Algorithm:
 *   1. Pre-filter: advance past leading quantity expressions and stop words
 *      without any API calls. Stop at the first "real" word.
 *        description   = filtered leading tokens  ("500g of")
 *        nameCandidate = remaining tokens          ("beef stock")
 *   2. Search nameCandidate as a single query.
 *        exact result match  → use catalog name / icon / category
 *        no exact match      → use nameCandidate as name; icon/category from results[0]
 *        search throws/empty → use nameCandidate with no icon/category
 *   3. Edge case — all tokens filtered: return raw input with empty description.
 *
 * Examples:
 *   "500g of beef stock"  → desc="500g of",  search "beef stock"
 *   "10 fillets of fish"  → desc="10",        search "fillets of fish"
 *   "stuff for salad"     → desc="stuff for", search "salad"
 *   "2x chicken breast"   → desc="2x",        search "chicken breast"
 */
export async function parseItemInput(
  raw: string,
  searchFn: (query: string) => Promise<ServerItem[]>
): Promise<ParseResult> {
  const trimmed = raw.trim();
  const tokens = trimmed.split(/\s+/);

  // Step 1 — pre-filter leading description tokens without API calls.
  let startIndex = 0;
  while (startIndex < tokens.length && isDescriptionToken(tokens[startIndex])) {
    startIndex++;
  }

  // Edge case: every token was filtered — nothing meaningful to search.
  if (startIndex === tokens.length) {
    return { name: trimmed, description: '', iconKey: null, category: 'Other' };
  }

  const description = tokens.slice(0, startIndex).join(' ');
  const nameCandidate = tokens.slice(startIndex).join(' ');
  const nameLower = nameCandidate.toLowerCase();

  // Step 2 — single catalog search for the unfiltered portion.
  let results: ServerItem[] = [];
  try {
    results = await searchFn(nameCandidate);
  } catch {
    // Offline or transient failure — fall through to raw name.
  }

  const exactMatch = results.find(
    (r) => r.name.trim().toLowerCase() === nameLower
  );
  if (exactMatch) {
    return {
      name: exactMatch.name,
      description,
      iconKey: exactMatch.icon ?? null,
      category: exactMatch.category?.name ?? 'Other',
    };
  }

  return {
    name: nameCandidate,
    description,
    iconKey: results[0]?.icon ?? null,
    category: results[0]?.category?.name ?? 'Other',
  };
}
