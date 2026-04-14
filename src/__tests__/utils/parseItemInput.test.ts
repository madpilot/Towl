import { parseItemInput } from '@/utils/parseItemInput';
import type { ServerItem } from '@/hooks/useItemSuggestions';

/**
 * Simulates a catalog search: returns items whose name starts with the query
 * (case-insensitive), mirroring how the real API responds to a single token.
 */
function catalogSearch(items: ServerItem[]) {
  return jest.fn().mockImplementation((q: string) => {
    const lower = q.toLowerCase();
    return Promise.resolve(
      items.filter((i) => i.name.toLowerCase().startsWith(lower))
    );
  });
}

describe('parseItemInput', () => {
  // ── Pre-filter ───────────────────────────────────────────────────────────────

  it('pre-filters digit tokens at the start without making API calls', async () => {
    const searchFn = catalogSearch([
      { name: 'Chicken', icon: 'chicken', category: { name: 'Meat' } },
    ]);
    const result = await parseItemInput('500g Chicken', searchFn);
    expect(result).toEqual({ name: 'Chicken', description: '500g', iconKey: 'chicken', category: 'Meat' });
    expect(searchFn).not.toHaveBeenCalledWith('500g');
    expect(searchFn).toHaveBeenCalledWith('Chicken');
  });

  it('pre-filters stop words at the start without making API calls', async () => {
    const searchFn = catalogSearch([
      { name: 'Chicken Mince', icon: 'chicken', category: { name: 'Meat' } },
    ]);
    const result = await parseItemInput('some Chicken Mince', searchFn);
    expect(result).toEqual({ name: 'Chicken Mince', description: 'some', iconKey: 'chicken', category: 'Meat' });
    expect(searchFn).not.toHaveBeenCalledWith('some');
  });

  it('pre-filters a mix of digit and stop word tokens before the item name', async () => {
    const searchFn = catalogSearch([
      { name: 'Chicken Mince', icon: 'chicken', category: { name: 'Meat' } },
    ]);
    const result = await parseItemInput('500g of Chicken Mince', searchFn);
    expect(result).toEqual({ name: 'Chicken Mince', description: '500g of', iconKey: 'chicken', category: 'Meat' });
    expect(searchFn).not.toHaveBeenCalledWith('500g');
    expect(searchFn).not.toHaveBeenCalledWith('of');
    expect(searchFn).toHaveBeenCalledWith('Chicken');
  });

  it('stops pre-filtering at the first non-descriptor token', async () => {
    // "10" is filtered (digit); "fillets" is not → filtering stops.
    // "of" and "fish" after "fillets" are NOT pre-filtered — they stay in the suffix.
    const searchFn = catalogSearch([
      { name: 'Fillets', icon: null, category: { name: 'Fish' } },
    ]);
    const result = await parseItemInput('10 fillets of fish', searchFn);
    expect(result.description).toBe('10');
    expect(result.name).toBe('fillets of fish');
    expect(searchFn).not.toHaveBeenCalledWith('10');
    expect(searchFn).toHaveBeenCalledWith('fillets');
  });

  // ── Search loop ──────────────────────────────────────────────────────────────

  it('returns the full input as name when every token search returns no results', async () => {
    const searchFn = jest.fn().mockResolvedValue([]);
    const result = await parseItemInput('oat milk', searchFn);
    expect(result).toEqual({ name: 'oat milk', description: '', iconKey: null, category: 'Other' });
  });

  it('uses a catalog result that exactly matches the full suffix', async () => {
    // Searching "Beef" returns ["Beef Mince"] — exact match for suffix "Beef Mince".
    const searchFn = catalogSearch([
      { name: 'Beef Mince', icon: 'beef', category: { name: 'Meat' } },
    ]);
    const result = await parseItemInput('500g Beef Mince', searchFn);
    expect(result).toEqual({ name: 'Beef Mince', description: '500g', iconKey: 'beef', category: 'Meat' });
  });

  it('strips a multi-token non-filterable description prefix via the search loop', async () => {
    // "Stuff" is not a stop word, so pre-filter stops at index 0.
    // The loop skips "Stuff" and "for" (empty results) and anchors on "Salad".
    const searchFn = catalogSearch([
      { name: 'Salad', icon: null, category: { name: 'Produce' } },
    ]);
    const result = await parseItemInput('Stuff for Salad', searchFn);
    expect(result).toEqual({ name: 'Salad', description: 'Stuff for', iconKey: null, category: 'Produce' });
  });

  it('uses the catalog name (not the typed candidate) as the result name', async () => {
    // User typed lowercase; catalog has title-case name.
    const searchFn = catalogSearch([
      { name: 'Milk', icon: 'milk', category: { name: 'Dairy' } },
    ]);
    const result = await parseItemInput('1L milk', searchFn);
    expect(result).toEqual({ name: 'Milk', description: '1L', iconKey: 'milk', category: 'Dairy' });
  });

  it('is case-insensitive when comparing suffix to result names', async () => {
    const searchFn = catalogSearch([{ name: 'Milk' }]);
    const result = await parseItemInput('1L MILK', searchFn);
    expect(result.name).toBe('Milk');
    expect(result.description).toBe('1L');
  });

  it('handles a single-token input that exactly matches a catalog result', async () => {
    const searchFn = catalogSearch([
      { name: 'Quinoa', icon: 'grain', category: { name: 'Grains' } },
    ]);
    const result = await parseItemInput('quinoa', searchFn);
    expect(result).toEqual({ name: 'Quinoa', description: '', iconKey: 'grain', category: 'Grains' });
  });

  it('returns null iconKey and "Other" category when result omits those fields', async () => {
    const searchFn = catalogSearch([{ name: 'Salad' }]);
    const result = await parseItemInput('Salad', searchFn);
    expect(result.iconKey).toBeNull();
    expect(result.category).toBe('Other');
  });

  it('skips a token when its search throws and continues to the next', async () => {
    let callCount = 0;
    const searchFn = jest.fn().mockImplementation((q: string) => {
      callCount++;
      // Throw on the first search call (for "Organic"); succeed for "Chicken".
      if (callCount === 1) return Promise.reject(new Error('network'));
      return q.toLowerCase() === 'chicken'
        ? Promise.resolve([{ name: 'Chicken' }])
        : Promise.resolve([]);
    });
    const result = await parseItemInput('Organic Chicken', searchFn);
    expect(result.name).toBe('Chicken');
    expect(result.description).toBe('Organic');
  });

  it('searches one token at a time, not the full multi-token input', async () => {
    // Searching "Beef" returns "Beef Mince" in results — the algorithm must
    // find the match there rather than by querying "Beef Mince" directly.
    const searchFn = jest.fn().mockImplementation((q: string) =>
      q.toLowerCase() === 'beef'
        ? Promise.resolve([{ name: 'Beef Mince', icon: null, category: null }])
        : Promise.resolve([])
    );
    const result = await parseItemInput('Beef Mince', searchFn);
    expect(result.name).toBe('Beef Mince');
    expect(result.description).toBe('');
    expect(searchFn).toHaveBeenCalledWith('Beef');
    expect(searchFn).not.toHaveBeenCalledWith('Beef Mince');
  });

  it('creates a new item from the suffix when no result exactly matches it', async () => {
    // Catalog has "Chicken" and "Chicken Mince" but not "Chicken Tenders".
    // The suffix "Chicken Tenders" becomes the new item name.
    const searchFn = catalogSearch([
      { name: 'Chicken', icon: 'chicken', category: { name: 'Meat' } },
      { name: 'Chicken Mince', icon: 'chicken', category: { name: 'Meat' } },
    ]);
    const result = await parseItemInput('500g Chicken Tenders', searchFn);
    expect(result).toEqual({ name: 'Chicken Tenders', description: '500g', iconKey: 'chicken', category: 'Meat' });
  });

  it('picks icon and category from the exact anchor-token result when creating a new item', async () => {
    // results[0] is "Chicken Nuggets"; the exact match for anchor "Chicken" is
    // the second result. Icon/category should come from "Chicken", not "Chicken Nuggets".
    const searchFn = jest.fn().mockImplementation((q: string) =>
      q.toLowerCase() === 'chicken'
        ? Promise.resolve([
            { name: 'Chicken Nuggets', icon: 'nuggets', category: { name: 'Snacks' } },
            { name: 'Chicken', icon: 'chicken', category: { name: 'Meat' } },
          ])
        : Promise.resolve([])
    );
    const result = await parseItemInput('500g Chicken Tenders', searchFn);
    expect(result.iconKey).toBe('chicken');
    expect(result.category).toBe('Meat');
  });

  it('uses the exact catalog result when the full suffix is in the result list', async () => {
    // Catalog has both "Chicken" and "Chicken Mince". Searching "Chicken" returns both.
    // The suffix "Chicken Mince" exactly matches the second result.
    const searchFn = catalogSearch([
      { name: 'Chicken', icon: 'chicken', category: { name: 'Meat' } },
      { name: 'Chicken Mince', icon: 'chicken_mince', category: { name: 'Meat' } },
    ]);
    const result = await parseItemInput('500g Chicken Mince', searchFn);
    expect(result).toEqual({ name: 'Chicken Mince', description: '500g', iconKey: 'chicken_mince', category: 'Meat' });
  });
});
