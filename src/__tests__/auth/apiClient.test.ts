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
import { ApiClientManager } from '@/api/client';
import { SECURE_STORE_KEYS } from '@/utils/constants';

let mock: MockAdapter;

beforeAll(() => {
  mock = new MockAdapter(axios);
});

afterEach(() => {
  mock.reset();
  for (const k of Object.keys(secureStore)) { delete secureStore[k]; }
});

afterAll(() => {
  mock.restore();
});

describe('API client', () => {
  it('attaches Authorization header when access token is present', async () => {
    secureStore[SECURE_STORE_KEYS.ACCESS_TOKEN] = 'my-token';
    secureStore[SECURE_STORE_KEYS.REFRESH_TOKEN] = 'ref-token';

    const manager = new ApiClientManager('http://localhost:8080');
    mock.onGet('http://localhost:8080/api/shoppinglist').reply(200, []);

    await manager.get('/shoppinglist');

    const request = mock.history.get[0];
    expect(request.headers?.['Authorization']).toBe('Bearer my-token');
  });

  it('silently refreshes with refresh token on 401 and retries', async () => {
    secureStore[SECURE_STORE_KEYS.ACCESS_TOKEN] = 'stale-token';
    secureStore[SECURE_STORE_KEYS.REFRESH_TOKEN] = 'good-refresh';

    const manager = new ApiClientManager('http://localhost:8080');

    mock
      .onGet('http://localhost:8080/api/shoppinglist')
      .replyOnce(401)
      .onGet('http://localhost:8080/api/shoppinglist')
      .replyOnce(200, [{ id: 1, name: 'Test' }]);

    mock.onGet('http://localhost:8080/api/auth/refresh').replyOnce(200, {
      access_token: 'new-token',
      refresh_token: 'new-refresh',
    });

    const res = await manager.get('/shoppinglist');
    expect(res.data).toEqual([{ id: 1, name: 'Test' }]);
    expect(secureStore[SECURE_STORE_KEYS.ACCESS_TOKEN]).toBe('new-token');
  });

  it('falls back to LLT when refresh token fails, then retries', async () => {
    secureStore[SECURE_STORE_KEYS.ACCESS_TOKEN] = 'stale-token';
    secureStore[SECURE_STORE_KEYS.REFRESH_TOKEN] = 'expired-refresh';
    secureStore[SECURE_STORE_KEYS.LLT_TOKEN] = 'good-llt';

    const manager = new ApiClientManager('http://localhost:8080');

    mock
      .onGet('http://localhost:8080/api/shoppinglist')
      .replyOnce(401)
      .onGet('http://localhost:8080/api/shoppinglist')
      .replyOnce(200, [{ id: 1, name: 'Test' }]);

    // Refresh token attempt fails; LLT attempt succeeds
    mock
      .onGet('http://localhost:8080/api/auth/refresh')
      .replyOnce(401)
      .onGet('http://localhost:8080/api/auth/refresh')
      .replyOnce(200, {
        access_token: 'llt-new-token',
        refresh_token: 'llt-new-refresh',
      });

    const res = await manager.get('/shoppinglist');
    expect(res.data).toEqual([{ id: 1, name: 'Test' }]);
    expect(secureStore[SECURE_STORE_KEYS.ACCESS_TOKEN]).toBe('llt-new-token');
  });

  it('calls onSessionExpired when all token refresh attempts fail', async () => {
    secureStore[SECURE_STORE_KEYS.ACCESS_TOKEN] = 'stale-token';
    secureStore[SECURE_STORE_KEYS.REFRESH_TOKEN] = 'expired-refresh';
    secureStore[SECURE_STORE_KEYS.LLT_TOKEN] = 'expired-llt';

    const onSessionExpired = jest.fn();
    const manager = new ApiClientManager('http://localhost:8080', onSessionExpired);

    mock.onGet('http://localhost:8080/api/shoppinglist').reply(401);
    mock.onGet('http://localhost:8080/api/auth/refresh').reply(401);

    await expect(manager.get('/shoppinglist')).rejects.toBeDefined();
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });
});
