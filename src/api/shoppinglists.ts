import { z } from 'zod';
import { getApiClient } from './client';

export const ApiShoppingListItemSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().optional().default(''),
  icon: z.string().nullable().optional(),
  ordering: z.number().optional(),
});
export type ApiShoppingListItem = z.infer<typeof ApiShoppingListItemSchema>;

export const ApiShoppingListSchema = z.object({
  id: z.number(),
  name: z.string(),
  household_id: z.number(),
});
export type ApiShoppingList = z.infer<typeof ApiShoppingListSchema>;

export async function getShoppingLists(householdId: number): Promise<ApiShoppingList[]> {
  const client = getApiClient();
  const res = await client.get<unknown>(`/household/${householdId}/shoppinglist`);
  return z.array(ApiShoppingListSchema).parse(res.data);
}

export async function getShoppingListItems(listId: number): Promise<ApiShoppingListItem[]> {
  const client = getApiClient();
  const res = await client.get<unknown>(`/shoppinglist/${listId}/items`);
  return z.array(ApiShoppingListItemSchema).parse(res.data);
}

export async function getRecentItems(listId: number, limit = 20): Promise<ApiShoppingListItem[]> {
  const client = getApiClient();
  const res = await client.get<unknown>(`/shoppinglist/${listId}/recent-items`, {
    params: { limit },
  });
  return z.array(ApiShoppingListItemSchema).parse(res.data);
}

export async function getSuggestedItems(listId: number): Promise<ApiShoppingListItem[]> {
  const client = getApiClient();
  const res = await client.get<unknown>(`/shoppinglist/${listId}/suggested-items`);
  return z.array(ApiShoppingListItemSchema).parse(res.data);
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

export async function createShoppingList(name: string): Promise<ApiShoppingList> {
  const client = getApiClient();
  const res = await client.post<unknown>('/shoppinglist', { name });
  return ApiShoppingListSchema.parse(res.data);
}

export async function deleteShoppingList(listId: number): Promise<void> {
  const client = getApiClient();
  await client.delete(`/shoppinglist/${listId}`);
}
