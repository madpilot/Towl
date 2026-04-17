import { generateServerDescription } from '@/utils/generateServerDescription';
import type { LocalItem } from '@/db/items';

function makeItem(overrides: Partial<LocalItem> = {}): LocalItem {
  return {
    localId: 'item-1',
    serverId: null,
    listLocalId: 'list-1',
    name: 'Milk',
    description: '2L',
    iconKey: null,
    category: 'Dairy',
    serverCategoryId: null,
    serverCategoryName: null,
    serverCategoryOrdering: null,
    isChecked: false,
    isImportant: false,
    isDirty: false,
    isDeleted: false,
    createdAt: 0,
    checkedAt: null,
    ...overrides,
  };
}

describe('generateServerDescription', () => {
  it('returns the description unchanged when not important', () => {
    expect(generateServerDescription(makeItem({ description: '2L', isImportant: false }))).toBe('2L');
  });

  it('prepends ! when important', () => {
    expect(generateServerDescription(makeItem({ description: '2L', isImportant: true }))).toBe('!2L');
  });

  it('handles empty description', () => {
    expect(generateServerDescription(makeItem({ description: '', isImportant: false }))).toBe('');
    expect(generateServerDescription(makeItem({ description: '', isImportant: true }))).toBe('!');
  });
});
