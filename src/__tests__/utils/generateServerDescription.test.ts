import { generateServerDescription } from '@/utils/generateServerDescription';

describe('generateServerDescription', () => {
  it('returns the description unchanged when not important', () => {
    expect(generateServerDescription('2L', false)).toBe('2L');
  });

  it('prepends ! when important', () => {
    expect(generateServerDescription('2L', true)).toBe('!2L');
  });

  it('handles empty description', () => {
    expect(generateServerDescription('', false)).toBe('');
    expect(generateServerDescription('', true)).toBe('!');
  });
});
