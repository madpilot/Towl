import { getIconMeta, DEFAULT_META, ICON_METADATA } from '@/data/iconMetadata';
import { ALL_ICON_KEYS } from '@/icons/kitchenowlIcons';

describe('ICON_METADATA', () => {
  it('covers at least 90% of KitchenOwl icon keys', () => {
    const covered = ALL_ICON_KEYS.filter((key) => key in ICON_METADATA).length;
    const coverage = covered / ALL_ICON_KEYS.length;
    expect(coverage).toBeGreaterThanOrEqual(0.9);
  });

  it('every entry has a non-empty emoji', () => {
    const missing = Object.entries(ICON_METADATA)
      .filter(([, meta]) => meta.emoji.length === 0)
      .map(([key]) => key);

    expect(missing).toHaveLength(0);
  });

  it('every entry has a non-empty category', () => {
    const missing = Object.entries(ICON_METADATA)
      .filter(([, meta]) => meta.category.length === 0)
      .map(([key]) => key);

    expect(missing).toHaveLength(0);
  });
});

describe('getIconMeta', () => {
  it('returns correct meta for a known key', () => {
    const meta = getIconMeta('apple');
    expect(meta.emoji).toBe('🍎');
    expect(meta.category).toBe('Produce');
  });

  it('returns DEFAULT_META for null', () => {
    expect(getIconMeta(null)).toEqual(DEFAULT_META);
  });

  it('returns DEFAULT_META for undefined', () => {
    expect(getIconMeta(undefined)).toEqual(DEFAULT_META);
  });

  it('returns DEFAULT_META for an unrecognised key', () => {
    expect(getIconMeta('not_a_real_icon')).toEqual(DEFAULT_META);
  });

  it('returns correct meta for toilet_paper', () => {
    const meta = getIconMeta('toilet_paper');
    expect(meta.emoji).toBe('🧻');
    expect(meta.category).toBe('Household');
  });
});
