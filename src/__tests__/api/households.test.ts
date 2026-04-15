/**
 * Tests for HouseholdsApi — getHousehold and getMembers.
 */

import { HouseholdsApi } from '@/api/households';
import type { ApiClientManager } from '@/api/client';

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockDelete = jest.fn();
const client = { get: mockGet, post: mockPost, delete: mockDelete } as unknown as ApiClientManager;
const api = new HouseholdsApi(client);

const householdDetailFixture = {
  id: 1,
  name: 'Home',
  photo: null,
  description: null,
  default_shopping_list: { id: 3, name: 'Groceries', household_id: 1 },
  member: [
    { id: 1, name: 'Alice', username: 'alice', photo: null },
    { id: 2, name: 'Bob', username: 'bob', photo: 'avatar.jpg' },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getHousehold', () => {
  it('calls GET /household/:id and returns parsed detail', async () => {
    mockGet.mockResolvedValue({ data: householdDetailFixture });

    const detail = await api.getHousehold(1);

    expect(mockGet).toHaveBeenCalledWith('/household/1');
    expect(detail.id).toBe(1);
    expect(detail.name).toBe('Home');
    expect(detail.default_shopping_list).toEqual({ id: 3, name: 'Groceries', household_id: 1 });
    expect(detail.member).toHaveLength(2);
    expect(detail.member[1]).toMatchObject({ id: 2, name: 'Bob', photo: 'avatar.jpg' });
  });

  it('handles null default_shopping_list', async () => {
    mockGet.mockResolvedValue({ data: { ...householdDetailFixture, default_shopping_list: null } });

    const detail = await api.getHousehold(2);

    expect(detail.default_shopping_list).toBeNull();
  });

  it('defaults member array to [] when field is absent', async () => {
    const { member: _m, ...withoutMember } = householdDetailFixture;
    mockGet.mockResolvedValue({ data: withoutMember });

    const detail = await api.getHousehold(1);

    expect(detail.member).toEqual([]);
  });
});

describe('createCategory', () => {
  it('POSTs name and ordering to /household/:id/category and returns parsed category', async () => {
    mockPost.mockResolvedValue({ data: { id: 5, name: 'Baked goods', ordering: 2 } });

    const created = await api.createCategory(1, 'Baked goods', 2);

    expect(mockPost).toHaveBeenCalledWith('/household/1/category', {
      name: 'Baked goods',
      ordering: 2,
    });
    expect(created).toEqual({ id: 5, name: 'Baked goods', ordering: 2 });
  });
});

describe('updateCategory', () => {
  it('POSTs name and ordering to /category/:id', async () => {
    mockPost.mockResolvedValue({ data: {} });

    await api.updateCategory(7, 'Baked goods', 0);

    expect(mockPost).toHaveBeenCalledWith('/category/7', { name: 'Baked goods', ordering: 0 });
  });
});

describe('deleteCategory', () => {
  it('sends DELETE /category/:id', async () => {
    mockDelete.mockResolvedValue({ data: {} });

    await api.deleteCategory(7);

    expect(mockDelete).toHaveBeenCalledWith('/category/7');
  });
});

describe('getMembers', () => {
  it('returns the member array from the household detail', async () => {
    mockGet.mockResolvedValue({ data: householdDetailFixture });

    const members = await api.getMembers(1);

    expect(mockGet).toHaveBeenCalledWith('/household/1');
    expect(members).toHaveLength(2);
    expect(members[0]).toMatchObject({ id: 1, name: 'Alice', photo: null });
    expect(members[1]).toMatchObject({ id: 2, name: 'Bob', photo: 'avatar.jpg' });
  });
});
