/**
 * Tests for AuthApi — getUser and getSessions.
 */

import { AuthApi } from '@/api/auth';
import type { ApiClientManager } from '@/api/client';

const mockGet = jest.fn();
const mockPost = jest.fn();
const client = { get: mockGet, post: mockPost } as unknown as ApiClientManager;
const api = new AuthApi(client);

const userFixture = {
  id: 1,
  name: 'Alice',
  username: 'alice',
  email: null,
  photo: 'a522879b.jpg',
  tokens: [
    {
      id: 1407,
      name: 'Mozilla/5.0 Firefox/135.0',
      type: 'refresh',
      last_used_at: null,
      created_at: 1774755238625,
      refresh_token_id: 1165,
      updated_at: 1774755238625,
    },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getUser', () => {
  it('calls GET /user and returns parsed user with tokens', async () => {
    mockGet.mockResolvedValue({ data: userFixture });

    const user = await api.getUser();

    expect(mockGet).toHaveBeenCalledWith('/user');
    expect(user.id).toBe(1);
    expect(user.name).toBe('Alice');
    expect(user.photo).toBe('a522879b.jpg');
    expect(user.tokens).toHaveLength(1);
    expect(user.tokens[0]).toMatchObject({ id: 1407, type: 'refresh' });
  });

  it('defaults tokens to [] when field is absent', async () => {
    const { tokens: _t, ...withoutTokens } = userFixture;
    mockGet.mockResolvedValue({ data: withoutTokens });

    const user = await api.getUser();

    expect(user.tokens).toEqual([]);
  });

  it('parses tokens where refresh_token_id is null (LLT tokens)', async () => {
    const lltToken = { ...userFixture.tokens[0], id: 999, type: 'llt', refresh_token_id: null };
    mockGet.mockResolvedValue({ data: { ...userFixture, tokens: [lltToken] } });

    const user = await api.getUser();

    expect(user.tokens[0]?.refresh_token_id).toBeNull();
  });
});

describe('getSessions', () => {
  it('returns the tokens array from getUser', async () => {
    mockGet.mockResolvedValue({ data: userFixture });

    const sessions = await api.getSessions();

    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.id).toBe(1407);
    expect(sessions[0]?.name).toBe('Mozilla/5.0 Firefox/135.0');
  });
});

describe('updateProfile', () => {
  it('POSTs name to /user', async () => {
    mockPost.mockResolvedValue({ data: {} });

    await api.updateProfile('Bob');

    expect(mockPost).toHaveBeenCalledWith('/user', { name: 'Bob' });
  });
});

describe('revokeSession', () => {
  it('sends DELETE /auth/:sessionId', async () => {
    const mockDelete = jest.fn().mockResolvedValue({ data: {} });
    const apiWithDelete = new AuthApi({ get: mockGet, post: mockPost, delete: mockDelete } as unknown as ApiClientManager);

    await apiWithDelete.revokeSession(1407);

    expect(mockDelete).toHaveBeenCalledWith('/auth/1407');
  });
});
