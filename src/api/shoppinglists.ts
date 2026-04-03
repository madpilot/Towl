import { getApiClient } from './client';

export interface ApiItem {
  id: number;
  name: string;
  icon: string | null;
  ordering: number;
}

export interface ApiShoppingListItem {
  item_id: number;
  item: ApiItem;
  description: string;
  created_by: number | null;
}

export interface ApiShoppingList {
  id: number;
  name: string;
  household_id: number;
}

export async function getShoppingLists(): Promise<ApiShoppingList[]> {
  const client = getApiClient();
  const res = await client.get<ApiShoppingList[]>('/shoppinglist');
  return res.data;
}

export async function getShoppingListItems(listId: number): Promise<ApiShoppingListItem[]> {
  const client = getApiClient();
  const res = await client.get<ApiShoppingListItem[]>(`/shoppinglist/${listId}/items`);
  return res.data;
}

export async function getRecentItems(listId: number, limit = 20): Promise<ApiItem[]> {
  const client = getApiClient();
  const res = await client.get<ApiItem[]>(`/shoppinglist/${listId}/recent-items`, {
    params: { limit },
  });
  return res.data;
}

export async function getSuggestedItems(listId: number): Promise<ApiItem[]> {
  const client = getApiClient();
  const res = await client.get<ApiItem[]>(`/shoppinglist/${listId}/suggested-items`);
  return res.data;
}

export async function addItemByName(
  listId: number,
  name: string,
  description?: string
): Promise<ApiShoppingListItem> {
  const client = getApiClient();
  const res = await client.post<ApiShoppingListItem>(
    `/shoppinglist/${listId}/add-item-by-name`,
    { name, description: description ?? '' }
  );
  return res.data;
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
  const res = await client.post<ApiShoppingList>('/shoppinglist', { name });
  return res.data;
}

export async function deleteShoppingList(listId: number): Promise<void> {
  const client = getApiClient();
  await client.delete(`/shoppinglist/${listId}`);
}
