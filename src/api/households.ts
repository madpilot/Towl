import { z } from 'zod';
import { ApiClientManager } from './client';

export const HouseholdSchema = z.object({
  id: z.number(),
  name: z.string(),
  photo: z.string().nullable(),
});

export type Household = z.infer<typeof HouseholdSchema>;

export class HouseholdsApi {
  constructor(private client: ApiClientManager) {}

  async getHouseholds(): Promise<Household[]> {
    const res = await this.client.get<unknown>('/household');
    return z.array(HouseholdSchema).parse(res.data);
  }
}
