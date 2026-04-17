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
} from '@/db/items';
import type { LocalItem } from '@/db/items';
import { enqueue, removePendingCheckItem } from '@/sync/syncManager';
import { matchItem } from '@/data/foodMatcher';
import { mergeQuantities } from '@/utils/mergeQuantities';
import { recordItemUsed } from '@/db/history';
import { generateServerDescription } from '@/utils/generateServerDescription';
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
      await enqueue(
        {
          opType: 'UPDATE_ITEM_DESC',
          listServerId: activeServerId,
          itemServerId: existing.serverId,
          itemLocalId: existing.localId,
          description: generateServerDescription({ ...existing, description: mergedDescription }),
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
  item: LocalItem;
}): Promise<LocalItem> {
  const { listContext, item } = params;
  const { activeLocalId, activeServerId } = listContext;

  const checkedAt = Date.now();
  await checkItemDb(item.localId, checkedAt);
  if (item.serverId !== null && activeServerId !== null) {
    await enqueue(
      {
        opType: 'CHECK_ITEM',
        listServerId: activeServerId,
        itemServerId: item.serverId,
        itemLocalId: item.localId,
        removedAt: checkedAt,
      },
      activeLocalId
    );
  }
  return { ...item, isChecked: true, isDirty: true, checkedAt };
}

export async function uncheckItem(params: {
  listContext: ListContext;
  item: LocalItem;
}): Promise<LocalItem> {
  const { listContext, item } = params;
  const { activeLocalId, activeServerId } = listContext;

  const hadPendingOp = await removePendingCheckItem(item.localId);
  const needsReAdd = !hadPendingOp && item.serverId !== null && activeServerId !== null;

  await uncheckItemDb(item.localId, needsReAdd);

  if (needsReAdd && activeServerId !== null) {
    await enqueue(
      {
        opType: 'ADD_ITEM',
        listServerId: activeServerId,
        listLocalId: activeLocalId,
        itemLocalId: item.localId,
        name: item.name,
        description: item.description,
      },
      activeLocalId
    );
  }
  return { ...item, isChecked: false, isDirty: needsReAdd, checkedAt: null };
}

export async function toggleImportant(params: {
  listContext: ListContext;
  item: LocalItem;
}): Promise<LocalItem> {
  const { listContext, item } = params;
  const { activeLocalId, activeServerId } = listContext;

  const newIsImportant = !item.isImportant;
  await toggleItemImportant(item.localId, newIsImportant);
  if (item.serverId !== null && activeServerId !== null) {
    await enqueue(
      {
        opType: 'UPDATE_ITEM_DESC',
        listServerId: activeServerId,
        itemServerId: item.serverId,
        itemLocalId: item.localId,
        description: generateServerDescription({ ...item, isImportant: newIsImportant }),
      },
      activeLocalId
    );
  }
  return { ...item, isImportant: newIsImportant };
}

export async function deleteItem(params: {
  listContext: ListContext;
  item: LocalItem;
}): Promise<void> {
  const { listContext, item } = params;
  const { activeLocalId, activeServerId } = listContext;

  await softDeleteItem(item.localId);
  if (item.serverId !== null && activeServerId !== null) {
    await enqueue(
      {
        opType: 'REMOVE_ITEM',
        listServerId: activeServerId,
        itemServerId: item.serverId,
        itemLocalId: item.localId,
        removedAt: Date.now(),
      },
      activeLocalId
    );
  } else {
    await hardDeleteItem(item.localId);
  }
}

export async function saveItem(params: {
  listContext: ListContext;
  item: LocalItem;
  name: string;
  description: string;
  iconKey: string | null;
}): Promise<LocalItem> {
  const { listContext, item, name, description, iconKey } = params;
  const { activeLocalId, activeServerId } = listContext;

  await updateItemNameAndIcon(item.localId, name, description, iconKey);
  if (item.serverId !== null && activeServerId !== null) {
    const category =
      item.serverCategoryId !== null
        ? {
            id: item.serverCategoryId,
            name: item.serverCategoryName ?? '',
            ordering: item.serverCategoryOrdering ?? 0,
          }
        : null;
    await enqueue(
      {
        opType: 'UPDATE_ITEM',
        listServerId: activeServerId,
        itemServerId: item.serverId,
        itemLocalId: item.localId,
        name,
        description,
        iconKey,
        category,
      },
      activeLocalId
    );
    await enqueue(
      {
        opType: 'UPDATE_ITEM_DESC',
        listServerId: activeServerId,
        itemServerId: item.serverId,
        itemLocalId: item.localId,
        description: generateServerDescription({ ...item, description }),
      },
      activeLocalId
    );
  }
  return { ...item, name, description, iconKey };
}

export async function moveItemToCategory(params: {
  listContext: ListContext;
  item: LocalItem;
  category: HouseholdCategory | null;
}): Promise<LocalItem> {
  const { listContext, item, category } = params;
  const { activeLocalId, activeServerId } = listContext;

  const categoryName = category?.name ?? 'Uncategorized';
  const serverCategoryId = category?.id ?? null;
  const serverCategoryName = category?.name ?? null;
  const serverCategoryOrdering = category?.ordering ?? null;

  await updateItemCategory(
    item.localId,
    categoryName,
    serverCategoryId,
    serverCategoryName,
    serverCategoryOrdering
  );
  if (item.serverId !== null && activeServerId !== null) {
    const serverCategory = category
      ? { id: category.id, name: category.name, ordering: category.ordering }
      : null;
    await enqueue(
      {
        opType: 'UPDATE_ITEM',
        listServerId: activeServerId,
        itemServerId: item.serverId,
        itemLocalId: item.localId,
        name: item.name,
        description: item.description,
        iconKey: item.iconKey,
        category: serverCategory,
      },
      activeLocalId
    );
  }
  return {
    ...item,
    category: categoryName,
    serverCategoryId,
    serverCategoryName,
    serverCategoryOrdering,
    isDirty: true,
  };
}
