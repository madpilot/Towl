import {
  addItemLocally,
  softDeleteItem,
  hardDeleteItem,
  checkItem as checkItemDb,
  uncheckItem as uncheckItemDb,
  toggleItemImportant,
  updateItemDescription,
  updateItemNameAndIcon,
  updateItemCategory,
  getItem,
} from '@/db/items';
import type { LocalItem } from '@/db/items';
import { enqueue, removePendingCheckItem } from '@/sync/syncManager';
import { matchItem } from '@/data/foodMatcher';
import { mergeQuantities } from '@/utils/mergeQuantities';
import { recordItemUsed } from '@/db/history';
import type { HouseholdCategory } from '@/api/households';

type ListContext = { activeLocalId: string; activeServerId: number | null };

export async function addItem(params: {
  listContext: ListContext;
  currentItems: LocalItem[];
  name: string;
  description: string;
  iconKey: string | null;
  category: string;
}): Promise<{ action: 'added'; item: LocalItem } | { action: 'merged'; item: LocalItem }> {
  const { listContext, currentItems, name, description, iconKey, category } = params;
  const { activeLocalId, activeServerId } = listContext;

  const nameLower = name.trim().toLowerCase();
  const existing = currentItems.find(
    (i) => !i.isChecked && !i.isDeleted && i.name.toLowerCase() === nameLower
  );

  if (existing !== undefined) {
    const mergedDescription = mergeQuantities(existing.description, description);
    await updateItemDescription(existing.localId, mergedDescription);
    if (existing.serverId !== null && activeServerId !== null) {
      const serverDescription = existing.isImportant
        ? `!${mergedDescription}`
        : mergedDescription;
      await enqueue(
        {
          opType: 'UPDATE_ITEM_DESC',
          listServerId: activeServerId,
          itemServerId: existing.serverId,
          itemLocalId: existing.localId,
          description: serverDescription,
        },
        activeLocalId
      );
    }
    return { action: 'merged', item: { ...existing, description: mergedDescription } };
  }

  const match = iconKey ? { iconKey, category } : matchItem(name);
  const newItem = await addItemLocally(
    activeLocalId,
    name,
    description,
    match.iconKey,
    match.category
  );
  await recordItemUsed(name, match.iconKey, match.category);
  if (activeServerId !== null) {
    await enqueue(
      {
        opType: 'ADD_ITEM',
        listServerId: activeServerId,
        listLocalId: activeLocalId,
        itemLocalId: newItem.localId,
        name,
        description,
      },
      activeLocalId
    );
  }
  return { action: 'added', item: newItem };
}

export async function checkItem(params: {
  listContext: ListContext;
  itemLocalId: string;
}): Promise<{ checkedAt: number }> {
  const { listContext, itemLocalId } = params;
  const { activeLocalId, activeServerId } = listContext;

  const checkedAt = Date.now();
  await checkItemDb(itemLocalId, checkedAt);
  const freshItem = await getItem(itemLocalId);
  if (
    freshItem?.serverId !== null &&
    freshItem?.serverId !== undefined &&
    activeServerId !== null
  ) {
    await enqueue(
      {
        opType: 'CHECK_ITEM',
        listServerId: activeServerId,
        itemServerId: freshItem.serverId,
        itemLocalId,
        removedAt: checkedAt,
      },
      activeLocalId
    );
  }
  return { checkedAt };
}

export async function uncheckItem(params: {
  listContext: ListContext;
  itemLocalId: string;
}): Promise<{ needsReAdd: boolean }> {
  const { listContext, itemLocalId } = params;
  const { activeLocalId, activeServerId } = listContext;

  const hadPendingOp = await removePendingCheckItem(itemLocalId);
  const freshItem = await getItem(itemLocalId);
  const needsReAdd =
    !hadPendingOp &&
    freshItem?.serverId !== null &&
    freshItem?.serverId !== undefined &&
    activeServerId !== null;

  await uncheckItemDb(itemLocalId, needsReAdd);

  if (needsReAdd && freshItem && activeServerId !== null) {
    await enqueue(
      {
        opType: 'ADD_ITEM',
        listServerId: activeServerId,
        listLocalId: activeLocalId,
        itemLocalId,
        name: freshItem.name,
        description: freshItem.description,
      },
      activeLocalId
    );
  }
  return { needsReAdd };
}

export async function toggleImportant(params: {
  listContext: ListContext;
  itemLocalId: string;
  currentIsImportant: boolean;
}): Promise<void> {
  const { listContext, itemLocalId, currentIsImportant } = params;
  const { activeLocalId, activeServerId } = listContext;

  await toggleItemImportant(itemLocalId, !currentIsImportant);
  const freshItem = await getItem(itemLocalId);
  if (
    freshItem?.serverId !== null &&
    freshItem?.serverId !== undefined &&
    activeServerId !== null
  ) {
    const serverDescription = freshItem.isImportant
      ? `!${freshItem.description}`
      : freshItem.description;
    await enqueue(
      {
        opType: 'UPDATE_ITEM_DESC',
        listServerId: activeServerId,
        itemServerId: freshItem.serverId,
        itemLocalId,
        description: serverDescription,
      },
      activeLocalId
    );
  }
}

export async function deleteItem(params: {
  listContext: ListContext;
  itemLocalId: string;
}): Promise<void> {
  const { listContext, itemLocalId } = params;
  const { activeLocalId, activeServerId } = listContext;

  await softDeleteItem(itemLocalId);
  const freshItem = await getItem(itemLocalId);
  if (
    freshItem?.serverId !== null &&
    freshItem?.serverId !== undefined &&
    activeServerId !== null
  ) {
    await enqueue(
      {
        opType: 'REMOVE_ITEM',
        listServerId: activeServerId,
        itemServerId: freshItem.serverId,
        itemLocalId,
        removedAt: Date.now(),
      },
      activeLocalId
    );
  } else {
    await hardDeleteItem(itemLocalId);
  }
}

export async function saveItem(params: {
  listContext: ListContext;
  itemLocalId: string;
  name: string;
  description: string;
  iconKey: string | null;
}): Promise<void> {
  const { listContext, itemLocalId, name, description, iconKey } = params;
  const { activeLocalId, activeServerId } = listContext;

  await updateItemNameAndIcon(itemLocalId, name, description, iconKey);
  const freshItem = await getItem(itemLocalId);
  if (
    freshItem?.serverId !== null &&
    freshItem?.serverId !== undefined &&
    activeServerId !== null
  ) {
    const category =
      freshItem.serverCategoryId !== null
        ? {
            id: freshItem.serverCategoryId,
            name: freshItem.serverCategoryName ?? '',
            ordering: freshItem.serverCategoryOrdering ?? 0,
          }
        : null;
    await enqueue(
      {
        opType: 'UPDATE_ITEM',
        listServerId: activeServerId,
        itemServerId: freshItem.serverId,
        itemLocalId,
        name,
        description,
        iconKey,
        category,
      },
      activeLocalId
    );
    const serverDescription = freshItem.isImportant ? `!${description}` : description;
    await enqueue(
      {
        opType: 'UPDATE_ITEM_DESC',
        listServerId: activeServerId,
        itemServerId: freshItem.serverId,
        itemLocalId,
        description: serverDescription,
      },
      activeLocalId
    );
  }
}

export async function moveItemToCategory(params: {
  listContext: ListContext;
  itemLocalId: string;
  category: HouseholdCategory | null;
}): Promise<void> {
  const { listContext, itemLocalId, category } = params;
  const { activeLocalId, activeServerId } = listContext;

  const categoryName = category?.name ?? 'Uncategorized';
  const serverCategoryId = category?.id ?? null;
  const serverCategoryName = category?.name ?? null;
  const serverCategoryOrdering = category?.ordering ?? null;

  await updateItemCategory(
    itemLocalId,
    categoryName,
    serverCategoryId,
    serverCategoryName,
    serverCategoryOrdering
  );
  const freshItem = await getItem(itemLocalId);
  if (
    freshItem?.serverId !== null &&
    freshItem?.serverId !== undefined &&
    activeServerId !== null
  ) {
    const serverCategory = category
      ? { id: category.id, name: category.name, ordering: category.ordering }
      : null;
    await enqueue(
      {
        opType: 'UPDATE_ITEM',
        listServerId: activeServerId,
        itemServerId: freshItem.serverId,
        itemLocalId,
        name: freshItem.name,
        description: freshItem.description,
        iconKey: freshItem.iconKey,
        category: serverCategory,
      },
      activeLocalId
    );
  }
}
