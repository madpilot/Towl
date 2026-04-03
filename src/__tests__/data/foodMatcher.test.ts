import { matchItem, suggestIcons } from '@/data/foodMatcher';

describe('matchItem', () => {
  it('exact match on a known icon name', () => {
    const result = matchItem('apple');
    expect(result.iconKey).toBe('apple');
    expect(result.emoji).toBe('🍎');
    expect(result.category).toBe('Produce');
  });

  it('exact match is case-insensitive', () => {
    const result = matchItem('BANANA');
    expect(result.iconKey).toBe('banana');
  });

  it('matches with underscores converted to spaces', () => {
    const result = matchItem('toilet paper');
    expect(result.iconKey).toBe('toilet_paper');
    expect(result.emoji).toBe('🧻');
    expect(result.category).toBe('Household');
  });

  it('fuzzy-matches a close typo', () => {
    const result = matchItem('chiken');
    expect(result.iconKey).toBe('chicken');
  });

  it('fuzzy-matches a partial word', () => {
    const result = matchItem('broc');
    expect(result.iconKey).toBe('broccoli');
  });

  it('returns null iconKey for a completely unknown item', () => {
    const result = matchItem('xyzzy-nonexistent-item-qqqq');
    expect(result.iconKey).toBeNull();
    expect(result.emoji).toBe('🛒');
    expect(result.category).toBe('Other');
  });

  it('returns default for empty string', () => {
    const result = matchItem('');
    expect(result.iconKey).toBeNull();
    expect(result.emoji).toBe('🛒');
  });

  it('matches olive oil', () => {
    const result = matchItem('olive oil');
    expect(result.iconKey).toBe('olive_oil');
  });

  it('matches milk carton', () => {
    const result = matchItem('milk');
    // 'milk' doesn't have an exact entry but 'milk_carton' should fuzzy-match
    expect(result.iconKey).toMatch(/milk/);
  });
});

describe('suggestIcons', () => {
  it('returns an array of icon suggestions', () => {
    const suggestions = suggestIcons('bread', 5);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.length).toBeLessThanOrEqual(5);
    expect(suggestions[0]).toHaveProperty('iconKey');
    expect(suggestions[0]).toHaveProperty('emoji');
    expect(suggestions[0]).toHaveProperty('category');
  });

  it('returns top result for bread', () => {
    const suggestions = suggestIcons('bread');
    const keys = suggestions.map((s) => s.iconKey);
    expect(keys).toContain('bread');
  });

  it('returns empty array for empty input', () => {
    expect(suggestIcons('')).toEqual([]);
  });
});
