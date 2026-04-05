import axios, { AxiosError } from "axios";
import { z } from "zod";
import { getApiClient } from "./client";

export type AxiosAuthError = AxiosError & {
  response: NonNullable<AxiosError["response"]>;
};

export function isAxiosAuthError(err: unknown): err is AxiosAuthError {
  return axios.isAxiosError(err) && err.response !== undefined;
}

export const AuthResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  user: z.object({
    id: z.number(),
    name: z.string(),
    username: z.string(),
  }),
});

export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export async function login(
  serverUrl: string,
  username: string,
  password: string,
): Promise<AuthResponse> {
  const base = serverUrl.replace(/\/$/, "") + "/api";
  const res = await axios.post<unknown>(
    `${base}/auth`,
    { username, password, device: "Towl" },
    { timeout: 15_000 },
  );
  return AuthResponseSchema.parse(res.data);
}

export async function refreshToken(): Promise<AuthResponse> {
  const client = getApiClient();
  const res = await client.get<unknown>("/auth/refresh");
  return AuthResponseSchema.parse(res.data);
}

export async function createLongLivedToken(): Promise<string> {
  const client = getApiClient();
  const res = await client.post<{ longlived_token: string }>("/auth/llt", {
    device: "Towl",
  });
  return res.data.longlived_token;
}

export async function logout(): Promise<void> {
  try {
    const client = getApiClient();
    await client.delete("/auth");
  } catch {
    // Ignore logout errors — we always clear local state
  }
}

export async function testConnection(serverUrl: string): Promise<boolean> {
  try {
    const base = serverUrl.replace(/\/$/, "");
    // KitchenOwl exposes a health endpoint; if not, we just check that /api/auth returns something
    await axios.get(`${base}/api/auth`, { timeout: 8_000 });
    return true;
  } catch (err: unknown) {
    // A 405 or 4xx from /api/auth still means the server is reachable
    if (axios.isAxiosError(err) && err.response) return true;
    return false;
  }
}
