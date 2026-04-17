/**
 * Tests for itemOperations — verifies that every operation correctly pairs
 * its SQLite write with the right sync enqueue (and skips the enqueue when
 * the item or list has no serverId).
 */

jest.mock('@/db/items', () => ({
  addItemLocally: jest.fn(),
  softDeleteItem: jest.fn(),
  hardDeleteItem: jest.fn(),
  checkItem: jest.fn(),
  uncheckItem: jest.fn(),
  toggleItemImportant: jest.fn(),
  updateItemDescription: jest.fn(),
  updateItemNameAndIcon: jest.fn(),
  updateItemCategory: jest.fn(),
  getItem: jest.fn(),
}));

jest.mock('@/sync/syncManager', () => ({
  enqueue: jest.fn().mockResolvedValue(undefined),
  removePendingCheckItem: jest.fn().mockResolvedValue(false),
}));

jest.mock('@/data/foodMatcher', () => ({
  matchItem: jest.fn(() => ({ iconKey: 'apple', category: 'Produce' })),
}));

jest.mock('@/utils/mergeQuantities', () => ({
  mergeQuantities: jest.fn((a: string, b: string) =>
    a && b ? `${a} + ${b}` : a || b
  ),
}));

jest.mock('@/db/history', () => ({
  recordItemUsed: jest.fn().mockResolvedValue(undefined),
}));

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
import { enqueue, removePendingCheckItem } from '@/sync/syncManager';
import { matchItem } from '@/data/foodMatcher';
import { mergeQuantities } from '@/utils/mergeQuantities';
import { recordItemUsed } from '@/db/history';
import type { LocalItem } from '@/db/items';
import {
  addItem,
  checkItem,
  uncheckItem,
  toggleImportant,
  deleteItem,
  saveItem,
  moveItemToCategory,
} from '@/items/itemOperations';

function makeItem(overrides: Partial<LocalItem> = {}): LocalItem {
  return {
    localId: 'item-1',
    serverId: 100,
    listLocalId: 'list-local-1',
    name: 'Milk',
    description: '',
    iconKey: 'milk_carton',
    category: 'Dairy & Eggs',
    serverCategoryId: null,
    serverCategoryName: null,
    serverCategoryOrdering: null,
    isChecked: false,
    isImportant: false,
    isDirty: false,
    isDeleted: false,
    createdAt: 1000,
    checkedAt: null,
    ...overrides,
  };
}

const LIST_CTX = { activeLocalId: 'list-local-1', activeServerId: 5 };
const NO_SERVER_CTX = { activeLocalId: 'list-local-1', activeServerId: null };

beforeEach(() => {
  jest.clearAllMocks();
  (enqueue as jest.Mock).mockResolvedValue(undefined);
  (removePendingCheckItem as jest.Mock).mockResolvedValue(false);
  (getItem as jest.Mock).mockResolvedValue(makeItem());
  (addItemLocally as jest.Mock).mockResolvedValue(makeItem({ localId: 'new-item', name: 'Bread' }));
  (softDeleteItem as jest.Mock).mockResolvedValue(undefined);
  (hardDeleteItem as jest.Mock).mockResolvedValue(undefined);
  (checkItemDb as jest.Mock).mockResolvedValue(undefined);
  (uncheckItemDb as jest.Mock).mockResolvedValue(undefined);
  (toggleItemImportant as jest.Mock).mockResolvedValue(undefined);
  (updateItemDescription as jest.Mock).mockResolvedValue(undefined);
  (updateItemNameAndIcon as jest.Mock).mockResolvedValue(undefined);
  (updateItemCategory as jest.Mock).mockResolvedValue(undefined);
  (recordItemUsed as jest.Mock).mockResolvedValue(undefined);
});

// ─── addItem ─────────────────────────────────────────────────────────────────

describe('addItem', () => {
  describe('new item path', () => {
    it('calls matchItem and addItemLocally when no iconKey provided', async () => {
      await addItem({ listContext: LIST_CTX, currentItems: [], name: 'Bread', description: '', iconKey: null, category: 'Other' });

      expect(matchItem).toHaveBeenCalledWith('Bread');
      expect(addItemLocally).toHaveBeenCalledWith('list-local-1', 'Bread', '', 'apple', 'Produce');
    });

    it('uses provided iconKey and category, skips matchItem', async () => {
      await addItem({ listContext: LIST_CTX, currentItems: [], name: 'Banana', description: '', iconKey: 'banana', category: 'Produce' });

      expect(matchItem).not.toHaveBeenCalled();
      expect(addItemLocally).toHaveBeenCalledWith('list-local-1', 'Banana', '', 'banana', 'Produce');
    });

    it('calls recordItemUsed after adding', async () => {
      await addItem({ listContext: LIST_CTX, currentItems: [], name: 'Bread', description: '', iconKey: null, category: 'Other' });

      expect(recordItemUsed).toHaveBeenCalled();
    });

    it('enqueues ADD_ITEM when list has a serverId', async () => {
      await addItem({ listContext: LIST_CTX, currentItems: [], name: 'Bread', description: '', iconKey: null, category: 'Other' });

      expect(enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ opType: 'ADD_ITEM', listServerId: 5 }),
        'list-local-1'
      );
    });

    it('skips ADD_ITEM enqueue when activeServerId is null', async () => {
      await addItem({ listContext: NO_SERVER_CTX, currentItems: [], name: 'Bread', description: '', iconKey: null, category: 'Other' });

      expect(enqueue).not.toHaveBeenCalled();
    });

    it('returns { action: "added", item }', async () => {
      const result = await addItem({ listContext: LIST_CTX, currentItems: [], name: 'Bread', description: '', iconKey: null, category: 'Other' });

      expect(result.action).toBe('added');
      expect(result.item.localId).toBe('new-item');
    });
  });

  describe('duplicate merge path', () => {
    const existingItem = makeItem({ localId: 'item-milk', serverId: 100, name: 'Milk', description: '3L' });

    it('calls mergeQuantities and updateItemDescription when name matches', async () => {
      await addItem({ listContext: LIST_CTX, currentItems: [existingItem], name: 'Milk', description: '2L', iconKey: null, category: 'Dairy' });

      expect(mergeQuantities).toHaveBeenCalledWith('3L', '2L');
      expect(updateItemDescription).toHaveBeenCalledWith('item-milk', '3L + 2L');
      expect(addItemLocally).not.toHaveBeenCalled();
    });

    it('enqueues UPDATE_ITEM_DESC with merged description', async () => {
      await addItem({ listContext: LIST_CTX, currentItems: [existingItem], name: 'Milk', description: '2L', iconKey: null, category: 'Dairy' });

      expect(enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ opType: 'UPDATE_ITEM_DESC', listServerId: 5, itemServerId: 100, description: '3L + 2L' }),
        'list-local-1'
      );
    });

    it('prefixes ! in server description when existing item isImportant', async () => {
      const important = { ...existingItem, isImportant: true };
      await addItem({ listContext: LIST_CTX, currentItems: [important], name: 'Milk', description: '2L', iconKey: null, category: 'Dairy' });

      expect(enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ opType: 'UPDATE_ITEM_DESC', description: '!3L + 2L' }),
        'list-local-1'
      );
    });

    it('skips enqueue when existing item has no serverId', async () => {
      const noServer = { ...existingItem, serverId: null };
      await addItem({ listContext: LIST_CTX, currentItems: [noServer], name: 'Milk', description: '2L', iconKey: null, category: 'Dairy' });

      expect(enqueue).not.toHaveBeenCalled();
      expect(updateItemDescription).toHaveBeenCalled();
    });

    it('skips enqueue when list has no serverId', async () => {
      await addItem({ listContext: NO_SERVER_CTX, currentItems: [existingItem], name: 'Milk', description: '2L', iconKey: null, category: 'Dairy' });

      expect(enqueue).not.toHaveBeenCalled();
      expect(updateItemDescription).toHaveBeenCalled();
    });

    it('matches name case-insensitively', async () => {
      await addItem({ listContext: LIST_CTX, currentItems: [existingItem], name: 'MILK', description: '2L', iconKey: null, category: 'Dairy' });

      expect(mergeQuantities).toHaveBeenCalledWith('3L', '2L');
      expect(addItemLocally).not.toHaveBeenCalled();
    });

    it('does not merge with checked items — falls through to new item path', async () => {
      const checked = { ...existingItem, isChecked: true };
      await addItem({ listContext: LIST_CTX, currentItems: [checked], name: 'Milk', description: '2L', iconKey: null, category: 'Dairy' });

      expect(addItemLocally).toHaveBeenCalled();
      expect(updateItemDescription).not.toHaveBeenCalled();
    });

    it('does not merge with soft-deleted items — falls through to new item path', async () => {
      const deleted = { ...existingItem, isDeleted: true };
      await addItem({ listContext: LIST_CTX, currentItems: [deleted], name: 'Milk', description: '2L', iconKey: null, category: 'Dairy' });

      expect(addItemLocally).toHaveBeenCalled();
      expect(updateItemDescription).not.toHaveBeenCalled();
    });

    it('returns { action: "merged", item } with updated description', async () => {
      const result = await addItem({ listContext: LIST_CTX, currentItems: [existingItem], name: 'Milk', description: '2L', iconKey: null, category: 'Dairy' });

      expect(result.action).toBe('merged');
      expect(result.item.localId).toBe('item-milk');
      expect(result.item.description).toBe('3L + 2L');
    });
  });
});

// ─── checkItem ───────────────────────────────────────────────────────────────

describe('checkItem', () => {
  it('calls DB checkItem with a timestamp', async () => {
    await checkItem({ listContext: LIST_CTX, itemLocalId: 'item-1' });

    expect(checkItemDb).toHaveBeenCalledWith('item-1', expect.any(Number));
  });

  it('reads fresh item from DB after the write', async () => {
    await checkItem({ listContext: LIST_CTX, itemLocalId: 'item-1' });

    expect(getItem).toHaveBeenCalledWith('item-1');
  });

  it('enqueues CHECK_ITEM when fresh item has a serverId', async () => {
    (getItem as jest.Mock).mockResolvedValue(makeItem({ serverId: 100 }));

    await checkItem({ listContext: LIST_CTX, itemLocalId: 'item-1' });

    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ opType: 'CHECK_ITEM', listServerId: 5, itemServerId: 100 }),
      'list-local-1'
    );
  });

  it('skips enqueue when fresh item has no serverId', async () => {
    (getItem as jest.Mock).mockResolvedValue(makeItem({ serverId: null }));

    await checkItem({ listContext: LIST_CTX, itemLocalId: 'item-1' });

    expect(enqueue).not.toHaveBeenCalled();
  });

  it('skips enqueue when activeServerId is null', async () => {
    await checkItem({ listContext: NO_SERVER_CTX, itemLocalId: 'item-1' });

    expect(enqueue).not.toHaveBeenCalled();
  });

  it('returns { checkedAt } matching the timestamp written to DB', async () => {
    const result = await checkItem({ listContext: LIST_CTX, itemLocalId: 'item-1' });

    expect(result.checkedAt).toBeGreaterThan(0);
    const dbCall = (checkItemDb as jest.Mock).mock.calls[0];
    expect(result.checkedAt).toBe(dbCall[1]);
  });
});

// ─── uncheckItem ─────────────────────────────────────────────────────────────

describe('uncheckItem', () => {
  it('calls removePendingCheckItem first', async () => {
    await uncheckItem({ listContext: LIST_CTX, itemLocalId: 'item-1' });

    expect(removePendingCheckItem).toHaveBeenCalledWith('item-1');
  });

  it('calls DB uncheckItem with isDirty=false when pending op was found', async () => {
    (removePendingCheckItem as jest.Mock).mockResolvedValue(true);

    await uncheckItem({ listContext: LIST_CTX, itemLocalId: 'item-1' });

    expect(uncheckItemDb).toHaveBeenCalledWith('item-1', false);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('calls DB uncheckItem with isDirty=true when no pending op and item has serverId', async () => {
    (removePendingCheckItem as jest.Mock).mockResolvedValue(false);
    (getItem as jest.Mock).mockResolvedValue(makeItem({ serverId: 100 }));

    await uncheckItem({ listContext: LIST_CTX, itemLocalId: 'item-1' });

    expect(uncheckItemDb).toHaveBeenCalledWith('item-1', true);
  });

  it('enqueues ADD_ITEM when no pending op and item has serverId', async () => {
    (removePendingCheckItem as jest.Mock).mockResolvedValue(false);
    (getItem as jest.Mock).mockResolvedValue(makeItem({ serverId: 100, name: 'Milk', description: '1L' }));

    await uncheckItem({ listContext: LIST_CTX, itemLocalId: 'item-1' });

    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ opType: 'ADD_ITEM', listServerId: 5, name: 'Milk' }),
      'list-local-1'
    );
  });

  it('skips enqueue when hadPendingOp is true', async () => {
    (removePendingCheckItem as jest.Mock).mockResolvedValue(true);

    await uncheckItem({ listContext: LIST_CTX, itemLocalId: 'item-1' });

    expect(enqueue).not.toHaveBeenCalled();
  });

  it('skips enqueue when fresh item has no serverId', async () => {
    (getItem as jest.Mock).mockResolvedValue(makeItem({ serverId: null }));

    await uncheckItem({ listContext: LIST_CTX, itemLocalId: 'item-1' });

    expect(enqueue).not.toHaveBeenCalled();
  });

  it('skips enqueue when activeServerId is null', async () => {
    (getItem as jest.Mock).mockResolvedValue(makeItem({ serverId: 100 }));

    await uncheckItem({ listContext: NO_SERVER_CTX, itemLocalId: 'item-1' });

    expect(enqueue).not.toHaveBeenCalled();
  });

  it('returns { needsReAdd: true } when ADD_ITEM was enqueued', async () => {
    (removePendingCheckItem as jest.Mock).mockResolvedValue(false);
    (getItem as jest.Mock).mockResolvedValue(makeItem({ serverId: 100 }));

    const result = await uncheckItem({ listContext: LIST_CTX, itemLocalId: 'item-1' });

    expect(result.needsReAdd).toBe(true);
  });

  it('returns { needsReAdd: false } when pending op was cancelled', async () => {
    (removePendingCheckItem as jest.Mock).mockResolvedValue(true);

    const result = await uncheckItem({ listContext: LIST_CTX, itemLocalId: 'item-1' });

    expect(result.needsReAdd).toBe(false);
  });
});

// ─── toggleImportant ─────────────────────────────────────────────────────────

describe('toggleImportant', () => {
  it('calls toggleItemImportant with the negated value', async () => {
    await toggleImportant({ listContext: LIST_CTX, itemLocalId: 'item-1', currentIsImportant: false });

    expect(toggleItemImportant).toHaveBeenCalledWith('item-1', true);
  });

  it('reads fresh item from DB after the toggle', async () => {
    await toggleImportant({ listContext: LIST_CTX, itemLocalId: 'item-1', currentIsImportant: false });

    expect(getItem).toHaveBeenCalledWith('item-1');
  });

  it('enqueues UPDATE_ITEM_DESC with ! prefix when toggling to important', async () => {
    (getItem as jest.Mock).mockResolvedValue(makeItem({ serverId: 100, isImportant: true, description: 'cold pressed' }));

    await toggleImportant({ listContext: LIST_CTX, itemLocalId: 'item-1', currentIsImportant: false });

    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ opType: 'UPDATE_ITEM_DESC', description: '!cold pressed' }),
      'list-local-1'
    );
  });

  it('enqueues UPDATE_ITEM_DESC without ! prefix when toggling to not important', async () => {
    (getItem as jest.Mock).mockResolvedValue(makeItem({ serverId: 100, isImportant: false, description: 'cold pressed' }));

    await toggleImportant({ listContext: LIST_CTX, itemLocalId: 'item-1', currentIsImportant: true });

    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ opType: 'UPDATE_ITEM_DESC', description: 'cold pressed' }),
      'list-local-1'
    );
  });

  it('skips enqueue when fresh item has no serverId', async () => {
    (getItem as jest.Mock).mockResolvedValue(makeItem({ serverId: null }));

    await toggleImportant({ listContext: LIST_CTX, itemLocalId: 'item-1', currentIsImportant: false });

    expect(enqueue).not.toHaveBeenCalled();
  });

  it('skips enqueue when activeServerId is null', async () => {
    await toggleImportant({ listContext: NO_SERVER_CTX, itemLocalId: 'item-1', currentIsImportant: false });

    expect(enqueue).not.toHaveBeenCalled();
  });
});

// ─── deleteItem ──────────────────────────────────────────────────────────────

describe('deleteItem', () => {
  it('calls softDeleteItem first', async () => {
    await deleteItem({ listContext: LIST_CTX, itemLocalId: 'item-1' });

    expect(softDeleteItem).toHaveBeenCalledWith('item-1');
  });

  it('reads fresh item from DB to guard against stale state', async () => {
    await deleteItem({ listContext: LIST_CTX, itemLocalId: 'item-1' });

    expect(getItem).toHaveBeenCalledWith('item-1');
  });

  it('enqueues REMOVE_ITEM when fresh item has a serverId', async () => {
    (getItem as jest.Mock).mockResolvedValue(makeItem({ serverId: 100 }));

    await deleteItem({ listContext: LIST_CTX, itemLocalId: 'item-1' });

    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ opType: 'REMOVE_ITEM', listServerId: 5, itemServerId: 100 }),
      'list-local-1'
    );
    expect(hardDeleteItem).not.toHaveBeenCalled();
  });

  it('hard-deletes immediately when fresh item has no serverId', async () => {
    (getItem as jest.Mock).mockResolvedValue(makeItem({ serverId: null }));

    await deleteItem({ listContext: LIST_CTX, itemLocalId: 'item-1' });

    expect(hardDeleteItem).toHaveBeenCalledWith('item-1');
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('hard-deletes when activeServerId is null', async () => {
    await deleteItem({ listContext: NO_SERVER_CTX, itemLocalId: 'item-1' });

    expect(hardDeleteItem).toHaveBeenCalledWith('item-1');
    expect(enqueue).not.toHaveBeenCalled();
  });
});

// ─── saveItem ────────────────────────────────────────────────────────────────

describe('saveItem', () => {
  const PARAMS = { listContext: LIST_CTX, itemLocalId: 'item-1', name: 'Almond Milk', description: '500g', iconKey: 'milk' };

  it('calls updateItemNameAndIcon with the new values', async () => {
    await saveItem(PARAMS);

    expect(updateItemNameAndIcon).toHaveBeenCalledWith('item-1', 'Almond Milk', '500g', 'milk');
  });

  it('reads fresh item from DB after the write', async () => {
    await saveItem(PARAMS);

    expect(getItem).toHaveBeenCalledWith('item-1');
  });

  it('enqueues UPDATE_ITEM with catalog fields', async () => {
    (getItem as jest.Mock).mockResolvedValue(makeItem({ serverId: 100, serverCategoryId: null }));

    await saveItem(PARAMS);

    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ opType: 'UPDATE_ITEM', listServerId: 5, itemServerId: 100, name: 'Almond Milk' }),
      'list-local-1'
    );
  });

  it('enqueues UPDATE_ITEM_DESC as a second op for the per-list description', async () => {
    (getItem as jest.Mock).mockResolvedValue(makeItem({ serverId: 100, isImportant: false }));

    await saveItem(PARAMS);

    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ opType: 'UPDATE_ITEM_DESC', description: '500g' }),
      'list-local-1'
    );
  });

  it('prepends ! in UPDATE_ITEM_DESC when fresh item isImportant', async () => {
    (getItem as jest.Mock).mockResolvedValue(makeItem({ serverId: 100, isImportant: true }));

    await saveItem(PARAMS);

    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ opType: 'UPDATE_ITEM_DESC', description: '!500g' }),
      'list-local-1'
    );
  });

  it('does not prepend ! in UPDATE_ITEM regardless of importance', async () => {
    (getItem as jest.Mock).mockResolvedValue(makeItem({ serverId: 100, isImportant: true }));

    await saveItem(PARAMS);

    const updateItemCall = (enqueue as jest.Mock).mock.calls.find(
      ([p]) => p.opType === 'UPDATE_ITEM'
    );
    expect(updateItemCall[0].description).toBe('500g');
  });

  it('includes serverCategory in UPDATE_ITEM when serverCategoryId is set', async () => {
    (getItem as jest.Mock).mockResolvedValue(
      makeItem({ serverId: 100, serverCategoryId: 9, serverCategoryName: 'Dairy', serverCategoryOrdering: 1 })
    );

    await saveItem(PARAMS);

    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        opType: 'UPDATE_ITEM',
        category: { id: 9, name: 'Dairy', ordering: 1 },
      }),
      'list-local-1'
    );
  });

  it('passes null category in UPDATE_ITEM when serverCategoryId is null', async () => {
    (getItem as jest.Mock).mockResolvedValue(makeItem({ serverId: 100, serverCategoryId: null }));

    await saveItem(PARAMS);

    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ opType: 'UPDATE_ITEM', category: null }),
      'list-local-1'
    );
  });

  it('skips both enqueue calls when fresh item has no serverId', async () => {
    (getItem as jest.Mock).mockResolvedValue(makeItem({ serverId: null }));

    await saveItem(PARAMS);

    expect(enqueue).not.toHaveBeenCalled();
  });

  it('skips both enqueue calls when activeServerId is null', async () => {
    await saveItem({ ...PARAMS, listContext: NO_SERVER_CTX });

    expect(enqueue).not.toHaveBeenCalled();
  });
});

// ─── moveItemToCategory ───────────────────────────────────────────────────────

describe('moveItemToCategory', () => {
  const dairyCategory = { id: 9, name: 'Dairy', ordering: 1 };

  it('calls updateItemCategory with resolved fields', async () => {
    await moveItemToCategory({ listContext: LIST_CTX, itemLocalId: 'item-1', category: dairyCategory });

    expect(updateItemCategory).toHaveBeenCalledWith('item-1', 'Dairy', 9, 'Dairy', 1);
  });

  it('passes "Uncategorized" and null server fields when category is null', async () => {
    await moveItemToCategory({ listContext: LIST_CTX, itemLocalId: 'item-1', category: null });

    expect(updateItemCategory).toHaveBeenCalledWith('item-1', 'Uncategorized', null, null, null);
  });

  it('enqueues UPDATE_ITEM with the full item and server category', async () => {
    (getItem as jest.Mock).mockResolvedValue(makeItem({ serverId: 100, name: 'Milk', description: '1L', iconKey: 'milk_carton' }));

    await moveItemToCategory({ listContext: LIST_CTX, itemLocalId: 'item-1', category: dairyCategory });

    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        opType: 'UPDATE_ITEM',
        listServerId: 5,
        itemServerId: 100,
        category: { id: 9, name: 'Dairy', ordering: 1 },
      }),
      'list-local-1'
    );
  });

  it('passes null category in UPDATE_ITEM when no category given', async () => {
    await moveItemToCategory({ listContext: LIST_CTX, itemLocalId: 'item-1', category: null });

    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ opType: 'UPDATE_ITEM', category: null }),
      'list-local-1'
    );
  });

  it('skips enqueue when fresh item has no serverId', async () => {
    (getItem as jest.Mock).mockResolvedValue(makeItem({ serverId: null }));

    await moveItemToCategory({ listContext: LIST_CTX, itemLocalId: 'item-1', category: dairyCategory });

    expect(enqueue).not.toHaveBeenCalled();
  });

  it('skips enqueue when activeServerId is null', async () => {
    await moveItemToCategory({ listContext: NO_SERVER_CTX, itemLocalId: 'item-1', category: dairyCategory });

    expect(enqueue).not.toHaveBeenCalled();
  });
});
