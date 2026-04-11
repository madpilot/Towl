import { z } from 'zod';
import { ApiClientManager } from './client';

// ─── Item schema ──────────────────────────────────────────────────────────────

export const ApiCategorySchema = z.object({
  id: z.number(),
  name: z.string(),
  ordering: z.number().optional().default(0),
  default_key: z.string().nullable(),
});
export type ApiCategory = z.infer<typeof ApiCategorySchema>;

export const ApiShoppingListItemSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().default(''),
  icon: z.string().nullable().optional(),
  ordering: z.number().optional(),
  category_id: z.number().nullable().optional(),
  category: ApiCategorySchema.optional(),
  support: z.number().optional(),
  household_id: z.number().optional(),
  created_at: z.number().optional(),
  updated_at: z.number().optional(),
  created_by: z.number().nullable().optional(),
  default: z.boolean().optional(),
  default_key: z.string().nullable().optional(),
});
export type ApiShoppingListItem = z.infer<typeof ApiShoppingListItemSchema>;

// ─── Shopping list schema ─────────────────────────────────────────────────────

export const ApiShoppingListSchema = z.object({
  id: z.number(),
  name: z.string(),
  household_id: z.number(),
  items: z.array(ApiShoppingListItemSchema).default([]),
  recentItems: z.array(ApiShoppingListItemSchema).default([]),
});
export type ApiShoppingList = z.infer<typeof ApiShoppingListSchema>;

// ─── Authenticated API class ──────────────────────────────────────────────────

export class ShoppingListsApi {
  constructor(private client: ApiClientManager) {}

  async getShoppingLists(householdId: number): Promise<ApiShoppingList[]> {
    const res = await this.client.get<unknown>(`/household/${householdId}/shoppinglist`);
    return z.array(ApiShoppingListSchema).parse(res.data);
  }

  async addItemByName(
    listId: number,
    name: string,
    description?: string
  ): Promise<ApiShoppingListItem> {
    const res = await this.client.post<unknown>(
      `/shoppinglist/${listId}/add-item-by-name`,
      { name, description: description ?? '' }
    );
    return ApiShoppingListItemSchema.parse(res.data);
  }

  async deleteItem(itemId: number): Promise<void> {
    await this.client.delete(`/item/${itemId}`);
  }

  async updateItemDescription(
    listId: number,
    itemId: number,
    description: string
  ): Promise<void> {
    await this.client.post(`/shoppinglist/${listId}/item/${itemId}`, { description });
  }

  async updateItem(
    itemId: number,
    name: string,
    description: string,
    iconKey: string | null,
    category: { id: number; name: string; ordering: number } | null
  ): Promise<void> {
    await this.client.post(`/item/${itemId}`, {
      id: itemId,
      name,
      description,
      icon: iconKey,
      category,
      ordering: 0,
      default: false,
      default_key: null,
      created_at: null,
      created_by: null,
    });
  }

  async createShoppingList(name: string, householdId: number): Promise<ApiShoppingList> {
    const res = await this.client.post<unknown>(`/household/${householdId}/shoppinglist`, { name });
    return ApiShoppingListSchema.parse(res.data);
  }

  async deleteShoppingList(listId: number): Promise<void> {
    await this.client.delete(`/shoppinglist/${listId}`);
  }

  // Endpoint unknown — stub until confirmed
  async renameShoppingList(_listId: number, _name: string): Promise<void> {
    throw new Error('renameShoppingList: KitchenOwl API endpoint not yet confirmed');
  }
}
