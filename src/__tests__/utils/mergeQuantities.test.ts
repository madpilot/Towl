import { mergeQuantities } from '@/utils/mergeQuantities';

describe('mergeQuantities', () => {
  describe('empty inputs', () => {
    it('returns incoming when existing is empty', () => {
      expect(mergeQuantities('', '3L')).toBe('3L');
    });

    it('returns existing when incoming is empty', () => {
      expect(mergeQuantities('3L', '')).toBe('3L');
    });

    it('returns empty string when both are empty', () => {
      expect(mergeQuantities('', '')).toBe('');
    });
  });

  describe('pure numbers', () => {
    it('adds two integers', () => {
      expect(mergeQuantities('3', '2')).toBe('5');
    });

    it('adds decimals', () => {
      expect(mergeQuantities('1.5', '0.5')).toBe('2');
    });
  });

  describe('compatible units', () => {
    it('sums matching volume units (L)', () => {
      expect(mergeQuantities('3L', '2L')).toBe('5 L');
    });

    it('converts mixed volume units (L + mL)', () => {
      expect(mergeQuantities('1 l', '250 ml')).toBe('1.25 l');
    });

    it('sums matching mass units (g)', () => {
      expect(mergeQuantities('500g', '200g')).toBe('700 g');
    });

    it('converts mixed mass units (kg + g)', () => {
      expect(mergeQuantities('1 kg', '500 g')).toBe('1.5 kg');
    });
  });

  describe('incompatible units — fallback to concatenation', () => {
    it('falls back for mass + volume', () => {
      expect(mergeQuantities('1 kg', '500 ml')).toBe('1 kg + 500 ml');
    });

    it('falls back for unparsable input', () => {
      expect(mergeQuantities('a dozen', 'half a dozen')).toBe('a dozen + half a dozen');
    });

    it('falls back for bare text', () => {
      expect(mergeQuantities('large', 'small')).toBe('large + small');
    });
  });

  describe('chained concatenation is still evaluable', () => {
    it('a prior fallback string can be re-evaluated on the next merge', () => {
      // First merge: incompatible → raw string
      const first = mergeQuantities('1 kg', '500 ml');
      expect(first).toBe('1 kg + 500 ml');

      // Hypothetical third add of "0 ml" to show concatenation stays parseable
      // (the third add would produce "1 kg + 500 ml + 0 ml" which still fails,
      // but a same-unit chain like "3L + 2L + 1L" should evaluate)
      const chained = mergeQuantities('3L + 2L', '1L');
      expect(chained).toBe('6 L');
    });
  });
});
