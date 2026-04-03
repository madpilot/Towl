/**
 * @jest-environment node
 */

// Mock expo-secure-store
const secureStore: Record<string, string> = {};
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(async (k: string, v: string) => { secureStore[k] = v; }),
  getItemAsync: jest.fn(async (k: string) => secureStore[k] ?? null),
  deleteItemAsync: jest.fn(async (k: string) => { delete secureStore[k]; }),
}));

import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { createApiClient, resetApiClient, getApiClient } from '@/api/client';
import { SECURE_STORE_KEYS } from '@/utils/constants';

// We need axios-mock-adapter for this test
// It is installed below; if not present the test will fail informatively.
let mock: MockAdapter;

beforeAll(() => {
  mock = new MockAdapter(axios);
});

afterEach(() => {
  mock.reset();
  resetApiClient();
  for (const k of Object.keys(secureStore)) delete secureStore[k];
});

afterAll(() => {
  mock.restore();
});

describe('API client', () => {
  it('throws if getApiClient called before createApiClient', () => {
    expect(() => getApiClient()).toThrow('not initialized');
  });

  it('attaches Authorization header when access token is present', async () => {
    secureStore[SECURE_STORE_KEYS.ACCESS_TOKEN] = 'my-token';
    secureStore[SECURE_STORE_KEYS.REFRESH_TOKEN] = 'ref-token';

    const client = createApiClient('http://localhost:8080');
    mock.onGet('http://localhost:8080/api/shoppinglist').reply(200, []);

    await client.get('/shoppinglist');

    const request = mock.history.get[0];
    expect(request.headers?.['Authorization']).toBe('Bearer my-token');
  });

  it('silently refreshes token on 401 and retries', async () => {
    secureStore[SECURE_STORE_KEYS.ACCESS_TOKEN] = 'stale-token';
    secureStore[SECURE_STORE_KEYS.REFRESH_TOKEN] = 'good-refresh';

    const client = createApiClient('http://localhost:8080');

    // First call → 401, then success after refresh
    mock
      .onGet('http://localhost:8080/api/shoppinglist')
      .replyOnce(401)
      .onGet('http://localhost:8080/api/shoppinglist')
      .replyOnce(200, [{ id: 1, name: 'Test' }]);

    // The refresh endpoint (called via raw axios, not the instance)
    mock.onGet('http://localhost:8080/api/auth/refresh').reply(200, {
      access_token: 'new-token',
      refresh_token: 'new-refresh',
    });

    const res = await client.get('/shoppinglist');
    expect(res.data).toEqual([{ id: 1, name: 'Test' }]);

    // New token should have been persisted
    expect(secureStore[SECURE_STORE_KEYS.ACCESS_TOKEN]).toBe('new-token');
  });
});
