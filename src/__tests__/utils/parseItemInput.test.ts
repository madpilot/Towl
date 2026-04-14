import { parseItemInput } from '@/utils/parseItemInput';
import type { ServerItem } from '@/hooks/useItemSuggestions';

/** Helper: search returns a strong match only for the exact query given. */
function matchOnly(query: string, item: ServerItem) {
  return jest.fn().mockImplementation((q: string) =>
    q.toLowerCase() === query.toLowerCase()
      ? Promise.resolve([item])
      : Promise.resolve([])
  );
}

describe('parseItemInput', () => {
  it('returns the full input as name when search returns no matches', async () => {
    const searchFn = jest.fn().mockResolvedValue([]);
    const result = await parseItemInput('oat milk', searchFn);
    expect(result).toEqual({ name: 'oat milk', description: '', iconKey: null, category: 'Other' });
  });

  it('returns the full input when the top result does not strongly match any split point', async () => {
    // Server always returns "something else" regardless of query — never a strong match.
    const searchFn = jest.fn().mockResolvedValue([{ name: 'something else' }]);
    const result = await parseItemInput('500g Beef Mince', searchFn);
    expect(result).toEqual({ name: '500g Beef Mince', description: '', iconKey: null, category: 'Other' });
  });

  it('strips a single-token prefix when the remaining tokens match', async () => {
    const searchFn = matchOnly('Beef Mince', { name: 'Beef Mince', icon: 'beef', category: { name: 'Meat' } });
    const result = await parseItemInput('500g Beef Mince', searchFn);
    expect(result).toEqual({ name: 'Beef Mince', description: '500g', iconKey: 'beef', category: 'Meat' });
  });

  it('strips a multi-token prefix', async () => {
    const searchFn = matchOnly('Salad', { name: 'Salad', icon: null, category: { name: 'Produce' } });
    const result = await parseItemInput('Stuff for Salad', searchFn);
    expect(result).toEqual({ name: 'Salad', description: 'Stuff for', iconKey: null, category: 'Produce' });
  });

  it('uses the catalog name (not the typed candidate) as the result name', async () => {
    // User typed lowercase; catalog has title-case name.
    const searchFn = matchOnly('milk', { name: 'Milk', icon: 'milk', category: { name: 'Dairy' } });
    const result = await parseItemInput('1L milk', searchFn);
    expect(result).toEqual({ name: 'Milk', description: '1L', iconKey: 'milk', category: 'Dairy' });
  });

  it('is case-insensitive when comparing candidate to top result', async () => {
    const searchFn = matchOnly('MILK', { name: 'Milk' });
    const result = await parseItemInput('1L MILK', searchFn);
    expect(result.name).toBe('Milk');
    expect(result.description).toBe('1L');
  });

  it('handles a single-token input that matches exactly', async () => {
    const searchFn = matchOnly('quinoa', { name: 'Quinoa', icon: 'grain', category: { name: 'Grains' } });
    const result = await parseItemInput('quinoa', searchFn);
    expect(result).toEqual({ name: 'Quinoa', description: '', iconKey: 'grain', category: 'Grains' });
  });

  it('returns null iconKey and "Other" category when result omits those fields', async () => {
    const searchFn = matchOnly('Salad', { name: 'Salad' });
    const result = await parseItemInput('Salad', searchFn);
    expect(result.iconKey).toBeNull();
    expect(result.category).toBe('Other');
  });

  it('continues to the next split point when search throws', async () => {
    let callCount = 0;
    const searchFn = jest.fn().mockImplementation((q: string) => {
      callCount++;
      // Fail on the first call; return a match for "Beef" on subsequent calls.
      if (callCount === 1) return Promise.reject(new Error('network'));
      return q.toLowerCase() === 'beef'
        ? Promise.resolve([{ name: 'Beef' }])
        : Promise.resolve([]);
    });
    const result = await parseItemInput('500g Beef', searchFn);
    expect(result.name).toBe('Beef');
    expect(result.description).toBe('500g');
  });

  it('queries from the full input first (no unnecessary strip)', async () => {
    // "Beef Mince" matches when queried as the full input — no stripping needed.
    const searchFn = matchOnly('Beef Mince', { name: 'Beef Mince' });
    const result = await parseItemInput('Beef Mince', searchFn);
    expect(result).toEqual({ name: 'Beef Mince', description: '', iconKey: null, category: 'Other' });
    // searchFn should have been called once with the full input.
    expect(searchFn).toHaveBeenCalledWith('Beef Mince');
    expect(searchFn).toHaveBeenCalledTimes(1);
  });

  it('appends trailing tokens to the catalog name when only a sub-span matches', async () => {
    // Catalog has "Chicken" but not "Chicken Mince". The trailing "Mince" is
    // folded into the item name so the user gets "Chicken Mince", not just "Chicken".
    const searchFn = matchOnly('Chicken', { name: 'Chicken', icon: 'chicken', category: { name: 'Meat' } });
    const result = await parseItemInput('500g Chicken Mince', searchFn);
    expect(result).toEqual({ name: 'Chicken Mince', description: '500g', iconKey: 'chicken', category: 'Meat' });
  });

  it('prefers a longer-span catalog match over a shorter one for the same prefix', async () => {
    // Catalog has both "Chicken" and "Chicken Mince". The longer match wins because
    // longer spans are tried first within each prefix position.
    const searchFn = jest.fn().mockImplementation((q: string) => {
      if (q.toLowerCase() === 'chicken mince')
        return Promise.resolve([{ name: 'Chicken Mince', icon: 'chicken', category: { name: 'Meat' } }]);
      if (q.toLowerCase() === 'chicken')
        return Promise.resolve([{ name: 'Chicken', icon: 'chicken', category: { name: 'Meat' } }]);
      return Promise.resolve([]);
    });
    const result = await parseItemInput('500g Chicken Mince', searchFn);
    expect(result).toEqual({ name: 'Chicken Mince', description: '500g', iconKey: 'chicken', category: 'Meat' });
  });

  it('appends multiple trailing tokens to the matched catalog name', async () => {
    // "Chicken" matches; two trailing tokens "Mince Spicy" become part of the name.
    const searchFn = matchOnly('Chicken', { name: 'Chicken', icon: 'chicken', category: { name: 'Meat' } });
    const result = await parseItemInput('500g Chicken Mince Spicy', searchFn);
    expect(result).toEqual({ name: 'Chicken Mince Spicy', description: '500g', iconKey: 'chicken', category: 'Meat' });
  });
});
