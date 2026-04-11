import { z } from 'zod';
import { ApiClientManager } from './client';

export const HouseholdSchema = z.object({
  id: z.number(),
  name: z.string(),
  photo: z.string().nullable(),
});

export type Household = z.infer<typeof HouseholdSchema>;

export const HouseholdCategorySchema = z.object({
  id: z.number(),
  name: z.string(),
  ordering: z.number().default(0),
});

export type HouseholdCategory = z.infer<typeof HouseholdCategorySchema>;

export const HouseholdMemberSchema = z.object({
  id: z.number(),
  name: z.string(),
  username: z.string(),
  photo: z.string().nullable(),
});

export type HouseholdMember = z.infer<typeof HouseholdMemberSchema>;

const HouseholdDefaultListSchema = z.object({
  id: z.number(),
  name: z.string(),
  household_id: z.number(),
});

export const HouseholdDetailSchema = z.object({
  id: z.number(),
  name: z.string(),
  photo: z.string().nullable(),
  description: z.string().nullable().optional(),
  default_shopping_list: HouseholdDefaultListSchema.nullable().optional(),
  member: z.array(HouseholdMemberSchema).default([]),
});

export type HouseholdDetail = z.infer<typeof HouseholdDetailSchema>;

export class HouseholdsApi {
  constructor(private client: ApiClientManager) {}

  async getHouseholds(): Promise<Household[]> {
    const res = await this.client.get<unknown>('/household');
    return z.array(HouseholdSchema).parse(res.data);
  }

  // Endpoint: POST /household  (follows REST convention — unconfirmed)
  async createHousehold(name: string): Promise<Household> {
    const res = await this.client.post<unknown>('/household', { name });
    return HouseholdSchema.parse(res.data);
  }

  async getHousehold(id: number): Promise<HouseholdDetail> {
    const res = await this.client.get<unknown>(`/household/${id}`);
    return HouseholdDetailSchema.parse(res.data);
  }

  // Endpoint unknown — stub until confirmed
  async renameHousehold(_householdId: number, _name: string): Promise<void> {
    throw new Error('renameHousehold: KitchenOwl API endpoint not yet confirmed');
  }

  // ── Categories ─────────────────────────────────────────────────────────────
  // Endpoint: GET /household/{id}/category  (confirmed in CLAUDE.md)
  async getCategories(householdId: number): Promise<HouseholdCategory[]> {
    const res = await this.client.get<unknown>(`/household/${householdId}/category`);
    return z.array(HouseholdCategorySchema).parse(res.data);
  }

  // Category write endpoints unknown — stubs until confirmed
  async createCategory(_householdId: number, _name: string): Promise<HouseholdCategory> {
    throw new Error('createCategory: KitchenOwl API endpoint not yet confirmed');
  }

  async updateCategory(_householdId: number, _categoryId: number, _name: string): Promise<void> {
    throw new Error('updateCategory: KitchenOwl API endpoint not yet confirmed');
  }

  async deleteCategory(_householdId: number, _categoryId: number): Promise<void> {
    throw new Error('deleteCategory: KitchenOwl API endpoint not yet confirmed');
  }

  // ── Members ────────────────────────────────────────────────────────────────

  async getMembers(householdId: number): Promise<HouseholdMember[]> {
    const detail = await this.getHousehold(householdId);
    return detail.member;
  }

  async inviteMember(_householdId: number, _username: string): Promise<void> {
    throw new Error('inviteMember: KitchenOwl API endpoint not yet confirmed');
  }

  async removeMember(_householdId: number, _memberId: number): Promise<void> {
    throw new Error('removeMember: KitchenOwl API endpoint not yet confirmed');
  }

  async leaveHousehold(_householdId: number): Promise<void> {
    throw new Error('leaveHousehold: KitchenOwl API endpoint not yet confirmed');
  }
}
