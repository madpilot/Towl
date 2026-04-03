import { getApiClient } from './client';

export interface Household {
  id: number;
  name: string;
  photo: string | null;
}

export async function getHouseholds(): Promise<Household[]> {
  const client = getApiClient();
  const res = await client.get<Household[]>('/household');
  return res.data;
}
