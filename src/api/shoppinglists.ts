import { z } from 'zod';
import { getApiClient } from './client';

// ─── Item schema ──────────────────────────────────────────────────────────────
// Matches the flat item objects returned both inline in the list response
// and from the individual /shoppinglist/{id}/items endpoint.

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
// The household shopping list endpoint returns lists with embedded items and
// recentItems already populated — no separate items call needed.

export const ApiShoppingListSchema = z.object({
  id: z.number(),
  name: z.string(),
  household_id: z.number(),
  items: z.array(ApiShoppingListItemSchema).default([]),
  recentItems: z.array(ApiShoppingListItemSchema).default([]),
});
export type ApiShoppingList = z.infer<typeof ApiShoppingListSchema>;

// ─── API functions ────────────────────────────────────────────────────────────

export async function getShoppingLists(householdId: number): Promise<ApiShoppingList[]> {
  const client = getApiClient();
  const res = await client.get<unknown>(`/household/${householdId}/shoppinglist`);
  return z.array(ApiShoppingListSchema).parse(res.data);
}

export async function addItemByName(
  listId: number,
  name: string,
  description?: string
): Promise<ApiShoppingListItem> {
  const client = getApiClient();
  const res = await client.post<unknown>(
    `/shoppinglist/${listId}/add-item-by-name`,
    { name, description: description ?? '' }
  );
  return ApiShoppingListItemSchema.parse(res.data);
}

export async function removeItem(listId: number, itemId: number): Promise<void> {
  const client = getApiClient();
  await client.delete(`/shoppinglist/${listId}/item`, {
    data: { item_id: itemId },
  });
}

export async function updateItemDescription(
  listId: number,
  itemId: number,
  description: string
): Promise<void> {
  const client = getApiClient();
  await client.post(`/shoppinglist/${listId}/item/${itemId}`, { description });
}

export async function updateItem(
  itemId: number,
  name: string,
  description: string,
  iconKey: string | null,
  category: { id: number; name: string; ordering: number } | null
): Promise<void> {
  const client = getApiClient();
  await client.post(`/item/${itemId}`, {
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

export async function createShoppingList(name: string, householdId: number): Promise<ApiShoppingList> {
  const client = getApiClient();
  const res = await client.post<unknown>(`/household/${householdId}/shoppinglist`, { name });
  return ApiShoppingListSchema.parse(res.data);
}

export async function deleteShoppingList(listId: number): Promise<void> {
  const client = getApiClient();
  await client.delete(`/shoppinglist/${listId}`);
}
