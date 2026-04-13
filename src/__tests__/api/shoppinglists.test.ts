/**
 * Tests for ShoppingListsApi — focused on searchItems.
 */

import { ShoppingListsApi } from '@/api/shoppinglists';
import type { ApiClientManager } from '@/api/client';

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockDelete = jest.fn();
const client = {
  get: mockGet,
  post: mockPost,
  delete: mockDelete,
} as unknown as ApiClientManager;
const api = new ShoppingListsApi(client);

beforeEach(() => {
  jest.clearAllMocks();
});

const itemFixture = {
  id: 14,
  name: 'Avocado',
  description: '',
  icon: 'avocado',
  ordering: 38,
  category_id: 4,
  category: {
    id: 4,
    name: 'Fruits and vegetables',
    ordering: 0,
    default_key: 'fruits_vegetables',
  },
  support: 0.235,
  household_id: 1,
  created_at: 1767214923552,
  updated_at: 1775876401359,
  default: true,
  default_key: 'avocado',
};

describe('searchItems', () => {
  it('calls GET /household/:id/item/search with query param', async () => {
    mockGet.mockResolvedValue({ data: [itemFixture] });

    await api.searchItems(1, 'avo');

    expect(mockGet).toHaveBeenCalledWith(
      '/household/1/item/search',
      { params: { query: 'avo' } }
    );
  });

  it('returns parsed items with name and icon', async () => {
    mockGet.mockResolvedValue({ data: [itemFixture] });

    const results = await api.searchItems(1, 'avo');

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Avocado');
    expect(results[0].icon).toBe('avocado');
    expect(results[0].category?.name).toBe('Fruits and vegetables');
  });

  it('returns empty array when server returns []', async () => {
    mockGet.mockResolvedValue({ data: [] });

    const results = await api.searchItems(1, 'xyz');

    expect(results).toEqual([]);
  });

  it('handles items with null icon', async () => {
    mockGet.mockResolvedValue({
      data: [{ ...itemFixture, icon: null }],
    });

    const results = await api.searchItems(1, 'avo');

    expect(results[0].icon).toBeNull();
  });

  it('handles items without a category', async () => {
    const { category: _c, category_id: _ci, ...withoutCategory } = itemFixture;
    mockGet.mockResolvedValue({ data: [withoutCategory] });

    const results = await api.searchItems(1, 'avo');

    expect(results[0].category).toBeUndefined();
  });

  it('throws when response is not a valid array', async () => {
    mockGet.mockResolvedValue({ data: { not: 'an array' } });

    await expect(api.searchItems(1, 'avo')).rejects.toThrow();
  });
});
