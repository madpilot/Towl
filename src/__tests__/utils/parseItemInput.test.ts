import { parseItemInput } from '@/utils/parseItemInput';
import type { ServerItem } from '@/hooks/useItemSuggestions';

/** Returns a search function that resolves to the given items for any query. */
function alwaysReturns(items: ServerItem[]) {
  return jest.fn().mockResolvedValue(items);
}

/** Returns a search function that resolves to items whose name exactly matches the query. */
function exactSearch(items: ServerItem[]) {
  return jest.fn().mockImplementation((q: string) =>
    Promise.resolve(items.filter((i) => i.name.toLowerCase() === q.toLowerCase()))
  );
}

describe('parseItemInput', () => {
  // ── Pre-filter: what gets classified as a description token ──────────────────

  describe('pre-filter', () => {
    it('filters purely numeric tokens', async () => {
      const searchFn = exactSearch([{ name: 'Chicken', icon: 'chicken', category: { name: 'Meat' } }]);
      const result = await parseItemInput('10 Chicken', searchFn);
      expect(result.description).toBe('10');
      expect(searchFn).not.toHaveBeenCalledWith('10');
      expect(searchFn).toHaveBeenCalledWith('Chicken');
    });

    it('filters number-with-unit tokens ("500g", "1L", "2x", "1.5kg")', async () => {
      const searchFn = alwaysReturns([]);
      await parseItemInput('500g chicken', searchFn);
      expect(searchFn).not.toHaveBeenCalledWith('500g');
      expect(searchFn).toHaveBeenCalledWith('chicken');
    });

    it('filters standalone measurement unit words', async () => {
      // "500 g chicken" — "500" and "g" are both filtered, search is "chicken"
      const searchFn = alwaysReturns([]);
      await parseItemInput('500 g chicken', searchFn);
      expect(searchFn).not.toHaveBeenCalledWith('500');
      expect(searchFn).not.toHaveBeenCalledWith('g');
      expect(searchFn).toHaveBeenCalledWith('chicken');
    });

    it('filters stop words ("of", "for", "some", "with", etc.)', async () => {
      const searchFn = alwaysReturns([]);
      await parseItemInput('some chicken', searchFn);
      expect(searchFn).not.toHaveBeenCalledWith('some');
      expect(searchFn).toHaveBeenCalledWith('chicken');
    });

    it('filters "stuff" and "things"', async () => {
      const searchFn = exactSearch([{ name: 'Salad', icon: null, category: { name: 'Produce' } }]);
      const stuffResult = await parseItemInput('stuff for salad', searchFn);
      expect(stuffResult.description).toBe('stuff for');
      expect(stuffResult.name).toBe('Salad');

      const thingsResult = await parseItemInput('things for the salad', searchFn);
      expect(thingsResult.description).toBe('things for the');
      expect(thingsResult.name).toBe('Salad');
    });

    it('filters a mix of quantity and stop word tokens at the start', async () => {
      const searchFn = alwaysReturns([]);
      await parseItemInput('500g of chicken', searchFn);
      expect(searchFn).toHaveBeenCalledTimes(1);
      expect(searchFn).toHaveBeenCalledWith('chicken');
    });

    it('stops filtering at the first non-descriptor token', async () => {
      // "10" is filtered; "fillets" is not — "of" and "fish" stay in the name candidate
      const searchFn = alwaysReturns([]);
      const result = await parseItemInput('10 fillets of fish', searchFn);
      expect(result.description).toBe('10');
      expect(result.name).toBe('fillets of fish');
      expect(searchFn).not.toHaveBeenCalledWith('10');
      expect(searchFn).toHaveBeenCalledWith('fillets of fish');
    });

    it('returns the raw input with empty description when every token is filtered', async () => {
      const searchFn = jest.fn();
      const result = await parseItemInput('500g of', searchFn);
      expect(result).toEqual({ name: '500g of', description: '', iconKey: null, category: 'Other' });
      expect(searchFn).not.toHaveBeenCalled();
    });

    it('filters mathjs + operator between quantity tokens', async () => {
      const searchFn = alwaysReturns([]);
      const result = await parseItemInput('250g + 150g Beef Mince', searchFn);
      expect(result.description).toBe('250g + 150g');
      expect(result.name).toBe('Beef Mince');
      expect(searchFn).toHaveBeenCalledWith('Beef Mince');
    });

    it('filters mathjs - operator between quantity tokens', async () => {
      const searchFn = alwaysReturns([]);
      const result = await parseItemInput('500ml - 250ml Chicken Stock', searchFn);
      expect(result.description).toBe('500ml - 250ml');
      expect(result.name).toBe('Chicken Stock');
    });

    it('filters mathjs * operator between quantity tokens', async () => {
      const searchFn = alwaysReturns([]);
      const result = await parseItemInput('2 * 500g Beef Mince', searchFn);
      expect(result.description).toBe('2 * 500g');
      expect(result.name).toBe('Beef Mince');
    });

    it('filters mathjs / operator between quantity tokens', async () => {
      const searchFn = alwaysReturns([]);
      const result = await parseItemInput('1 / 2 kg Rice', searchFn);
      expect(result.description).toBe('1 / 2 kg');
      expect(result.name).toBe('Rice');
    });
  });

  // ── Search: single call for the unfiltered portion ───────────────────────────

  describe('catalog search', () => {
    it('searches the full unfiltered string as one query, not token-by-token', async () => {
      const searchFn = exactSearch([{ name: 'Beef Stock', icon: 'beef', category: { name: 'Pantry' } }]);
      const result = await parseItemInput('500g of beef stock', searchFn);
      expect(result).toEqual({ name: 'Beef Stock', description: '500g of', iconKey: 'beef', category: 'Pantry' });
      expect(searchFn).toHaveBeenCalledTimes(1);
      expect(searchFn).toHaveBeenCalledWith('beef stock');
    });

    it('uses an exact catalog result when the name candidate matches', async () => {
      const searchFn = exactSearch([{ name: 'Chicken Mince', icon: 'chicken', category: { name: 'Meat' } }]);
      const result = await parseItemInput('500g Chicken Mince', searchFn);
      expect(result).toEqual({ name: 'Chicken Mince', description: '500g', iconKey: 'chicken', category: 'Meat' });
    });

    it('uses the catalog name casing, not the typed candidate', async () => {
      const searchFn = exactSearch([{ name: 'Oat Milk', icon: 'milk', category: { name: 'Dairy' } }]);
      const result = await parseItemInput('1L oat milk', searchFn);
      expect(result).toEqual({ name: 'Oat Milk', description: '1L', iconKey: 'milk', category: 'Dairy' });
    });

    it('is case-insensitive when comparing to catalog results', async () => {
      const searchFn = exactSearch([{ name: 'Milk' }]);
      const result = await parseItemInput('1L MILK', searchFn);
      expect(result.name).toBe('Milk');
      expect(result.description).toBe('1L');
    });

    it('uses the name candidate as-is when no exact catalog match is found', async () => {
      // "Chicken Tenders" is not in the catalog — use it as a new item name.
      const searchFn = exactSearch([
        { name: 'Chicken', icon: 'chicken', category: { name: 'Meat' } },
        { name: 'Chicken Mince', icon: 'chicken', category: { name: 'Meat' } },
      ]);
      const result = await parseItemInput('500g Chicken Tenders', searchFn);
      expect(result.name).toBe('Chicken Tenders');
      expect(result.description).toBe('500g');
    });

    it('uses icon and category from results[0] when no exact match', async () => {
      const searchFn = alwaysReturns([
        { name: 'Chicken Mince', icon: 'chicken', category: { name: 'Meat' } },
      ]);
      const result = await parseItemInput('500g Chicken Tenders', searchFn);
      expect(result.iconKey).toBe('chicken');
      expect(result.category).toBe('Meat');
    });

    it('handles a single-token input that exactly matches a catalog result', async () => {
      const searchFn = exactSearch([{ name: 'Quinoa', icon: 'grain', category: { name: 'Grains' } }]);
      const result = await parseItemInput('quinoa', searchFn);
      expect(result).toEqual({ name: 'Quinoa', description: '', iconKey: 'grain', category: 'Grains' });
    });

    it('returns the name candidate with no description when no tokens are filtered', async () => {
      const searchFn = alwaysReturns([]);
      const result = await parseItemInput('oat milk', searchFn);
      expect(result).toEqual({ name: 'oat milk', description: '', iconKey: null, category: 'Other' });
    });

    it('returns null iconKey and "Other" category when result omits those fields', async () => {
      const searchFn = exactSearch([{ name: 'Salad' }]);
      const result = await parseItemInput('Salad', searchFn);
      expect(result.iconKey).toBeNull();
      expect(result.category).toBe('Other');
    });

    it('falls back to the name candidate with no icon when search throws', async () => {
      const searchFn = jest.fn().mockRejectedValue(new Error('network'));
      const result = await parseItemInput('500g chicken breast', searchFn);
      expect(result.name).toBe('chicken breast');
      expect(result.description).toBe('500g');
      expect(result.iconKey).toBeNull();
      expect(result.category).toBe('Other');
    });
  });
});
