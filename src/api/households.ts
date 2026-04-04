import { z } from 'zod';
import { getApiClient } from './client';

export const HouseholdSchema = z.object({
  id: z.number(),
  name: z.string(),
  photo: z.string().nullable(),
});

export type Household = z.infer<typeof HouseholdSchema>;

export async function getHouseholds(): Promise<Household[]> {
  const client = getApiClient();
  const res = await client.get<Household[]>('/household');
  return res.data;
}
