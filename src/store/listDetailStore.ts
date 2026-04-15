import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { getItemAsync, setItemAsync } from 'expo-secure-store';
import {
  clearExpiredCheckedItems,
  getItemsForList,
  upsertItemFromServer,
  removeItemsDeletedOnServer,
  checkItem,
  uncheckItem,
  clearCheckedItems,
  toggleItemImportant,
  updateItemNameAndIcon,
  addItemLocally,
  softDeleteItem,
  hardDeleteItem,
  getItem,
  updateItemCategory,
} from '@/db/items';
import { getAllLists, upsertListFromServer } from '@/db/lists';
import { enqueue as syncManagerEnqueue, removePendingCheckItem } from '@/sync/syncManager';
import { useAuthStore } from '@/store/authStore';
import { matchItem } from '@/data/foodMatcher';
import { recordItemUsed } from '@/db/history';
import { SECURE_STORE_KEYS } from '@/utils/constants';
import type { LocalItem } from '@/db/items';
import type { LocalList } from '@/db/lists';
import type { HouseholdCategory } from '@/api/households';

// ─── State shape ─────────────────────────────────────────────────────────────

type ListDetailState = {
  activeLocalId: string | null;
  activeServerId: number | null;
  activeName: string;
  items: LocalItem[];
  allLists: LocalList[];
  allCategories: HouseholdCategory[];
  loading: boolean;
  refreshing: boolean;
  listPickerVisible: boolean;
  editingId: string | null;

  // UI toggles
  setListPickerVisible: (v: boolean) => void;
  setEditingId: (id: string | null) => void;

  // Lifecycle
  bootstrap: (householdId: number, restoreLastList: boolean) => Promise<void>;
  refresh: (householdId: number) => Promise<void>;
  reloadAfterSync: () => Promise<void>;

  // Navigation
  switchToList: (list: LocalList, householdId: number) => Promise<void>;

  // Item actions
  toggleDone: (localId: string) => Promise<void>;
  toggleImportant: (localId: string) => Promise<void>;
  deleteItem: (localId: string) => Promise<void>;
  saveItem: (
    localId: string,
    name: string,
    description: string,
    iconKey: string | null
  ) => Promise<void>;
  addItem: (
    name: string,
    description: string,
    iconKey: string | null,
    category: string
  ) => Promise<void>;
  clearTrolley: () => Promise<void>;
  moveItemToCategory: (localId: string, categoryId: number | null) => Promise<void>;

  // Category data
  fetchCategories: (householdId: number) => Promise<void>;
};

// ─── Store ───────────────────────────────────────────────────────────────────

export const useListDetailStore = create<ListDetailState>((set, get) => {
  // ── Private helpers ────────────────────────────────────────────────────────

  async function loadItems(localId: string): Promise<void> {
    // Auto-expire checked items that have been in the trolley for over 4 hours.
    await clearExpiredCheckedItems(localId, Date.now() - 4 * 60 * 60 * 1000);
    const rows = await getItemsForList(localId);
    set({ items: rows });
  }

  async function getServerDefaultList(
    householdId: number,
    lists: LocalList[]
  ): Promise<LocalList | null> {
    const householdsApi = useAuthStore.getState().householdsApi;
    if (!householdsApi) {
      return null;
    }
    try {
      const detail = await householdsApi.getHousehold(householdId);
      const defaultServerId = detail.default_shopping_list?.id;
      if (!defaultServerId) {
        return null;
      }
      return lists.find((l) => l.serverId === defaultServerId) ?? null;
    } catch {
      return null;
    }
  }

  async function syncFromServer(
    localId: string,
    serverId: number | null,
    householdId: number
  ): Promise<void> {
    if (serverId === null) {
      return;
    }
    const api = useAuthStore.getState().shoppingListsApi;
    try {
      const serverLists = (await api?.getShoppingLists(householdId)) ?? [];
      const apiList = serverLists.find((l) => l.id === serverId);
      if (!apiList) {
        return;
      }
      for (const apiItem of apiList.items) {
        const match = matchItem(apiItem.icon ?? apiItem.name);
        await upsertItemFromServer(
          apiItem.id,
          localId,
          apiItem.name,
          apiItem.description,
          match.iconKey,
          match.category,
          apiItem.category?.id ?? null,
          apiItem.category?.name ?? null,
          apiItem.category?.ordering ?? null
        );
      }
      await removeItemsDeletedOnServer(
        localId,
        apiList.items.map((i) => i.id)
      );
      await loadItems(localId);
    } catch {
      // Offline or transient failure — local data is fine.
    }
  }

  // ── Store ─────────────────────────────────────────────────────────────────

  return {
    activeLocalId: null,
    activeServerId: null,
    activeName: '',
    items: [],
    allLists: [],
    allCategories: [],
    loading: true,
    refreshing: false,
    listPickerVisible: false,
    editingId: null,

    setListPickerVisible: (v) => set({ listPickerVisible: v }),
    setEditingId: (id) => set({ editingId: id }),

    bootstrap: async (householdId, restoreLastList) => {
      set({ loading: true, items: [], activeLocalId: null, activeServerId: null, activeName: '' });

      let lists = await getAllLists(householdId);

      // Fresh install — SQLite is empty. Seed lists from the server before
      // proceeding so the rest of bootstrap has something to work with.
      if (lists.length === 0) {
        const api = useAuthStore.getState().shoppingListsApi;
        try {
          const serverLists = (await api?.getShoppingLists(householdId)) ?? [];
          for (const sl of serverLists) {
            await upsertListFromServer(sl.id, householdId, sl.name);
          }
          lists = await getAllLists(householdId);
        } catch {
          // Offline on first launch — nothing to show yet.
        }
      }

      set({ allLists: lists });

      if (lists.length === 0) {
        set({ loading: false });
        return;
      }

      let initial: LocalList;
      if (restoreLastList) {
        const lastId = await getItemAsync(SECURE_STORE_KEYS.LAST_LIST_LOCAL_ID);
        const savedList = lastId ? lists.find((l) => l.localId === lastId) : null;
        initial = savedList ?? (await getServerDefaultList(householdId, lists)) ?? lists[0];
      } else {
        initial = (await getServerDefaultList(householdId, lists)) ?? lists[0];
      }

      set({
        activeLocalId: initial.localId,
        activeServerId: initial.serverId,
        activeName: initial.name,
      });
      await loadItems(initial.localId);
      set({ loading: false });
      void syncFromServer(initial.localId, initial.serverId, householdId);
      void get().fetchCategories(householdId);
    },

    refresh: async (householdId) => {
      const { activeLocalId, activeServerId } = get();
      if (!activeLocalId) {
        return;
      }
      set({ refreshing: true });
      await syncFromServer(activeLocalId, activeServerId, householdId);
      void get().fetchCategories(householdId);
      set({ refreshing: false });
    },

    reloadAfterSync: async () => {
      const { activeLocalId } = get();
      if (activeLocalId) {
        await loadItems(activeLocalId);
      }
    },

    switchToList: async (list, householdId) => {
      set({
        activeLocalId: list.localId,
        activeServerId: list.serverId,
        activeName: list.name,
        listPickerVisible: false,
        items: [],
        loading: true,
      });
      await setItemAsync(SECURE_STORE_KEYS.LAST_LIST_LOCAL_ID, list.localId);
      await loadItems(list.localId);
      set({ loading: false });
      void syncFromServer(list.localId, list.serverId, householdId);
    },

    toggleDone: async (localId) => {
      const { items, activeLocalId, activeServerId } = get();
      const item = items.find((i) => i.localId === localId);
      if (!item) {
        return;
      }

      if (!item.isChecked) {
        // ── Checking off: move into trolley, remove from server list ──────────
        const checkedAt = Date.now();
        await checkItem(localId, checkedAt);
        const freshItem = await getItem(localId);
        if (
          freshItem?.serverId !== null &&
          freshItem?.serverId !== undefined &&
          activeServerId !== null &&
          activeLocalId !== null
        ) {
          await syncManagerEnqueue(
            {
              opType: 'CHECK_ITEM',
              listServerId: activeServerId,
              itemServerId: freshItem.serverId,
              itemLocalId: localId,
              removedAt: checkedAt,
            },
            activeLocalId
          );
        }
        set({
          items: items.map((i) =>
            i.localId === localId ? { ...i, isChecked: true, isDirty: true, checkedAt } : i
          ),
        });
      } else {
        // ── Unchecking: return item to active list ────────────────────────────
        const hadPendingOp = await removePendingCheckItem(localId);
        const freshItem = await getItem(localId);
        const needsReAdd =
          !hadPendingOp &&
          freshItem?.serverId !== null &&
          freshItem?.serverId !== undefined &&
          activeServerId !== null &&
          activeLocalId !== null;

        await uncheckItem(localId, needsReAdd);

        if (needsReAdd && freshItem && activeServerId !== null && activeLocalId !== null) {
          await syncManagerEnqueue(
            {
              opType: 'ADD_ITEM',
              listServerId: activeServerId,
              listLocalId: activeLocalId,
              itemLocalId: localId,
              name: freshItem.name,
              description: freshItem.description,
            },
            activeLocalId
          );
        }
        set({
          items: items.map((i) =>
            i.localId === localId
              ? { ...i, isChecked: false, isDirty: needsReAdd, checkedAt: null }
              : i
          ),
        });
      }
    },

    toggleImportant: async (localId) => {
      const { items, activeLocalId, activeServerId } = get();
      const item = items.find((i) => i.localId === localId);
      if (!item) {
        return;
      }
      const isImportant = item.isImportant;
      await toggleItemImportant(localId, !isImportant);
      const freshItem = await getItem(localId);
      if (
        freshItem?.serverId !== null &&
        freshItem?.serverId !== undefined &&
        activeServerId !== null &&
        activeLocalId !== null
      ) {
        const serverDescription = freshItem.isImportant
          ? `!${freshItem.description}`
          : freshItem.description;
        await syncManagerEnqueue(
          {
            opType: 'UPDATE_ITEM_DESC',
            listServerId: activeServerId,
            itemServerId: freshItem.serverId,
            description: serverDescription,
          },
          activeLocalId
        );
      }
      set({
        items: items.map((i) => (i.localId === localId ? { ...i, isImportant: !isImportant } : i)),
      });
    },

    deleteItem: async (localId) => {
      const { activeLocalId, activeServerId, items } = get();
      await softDeleteItem(localId);
      const freshItem = await getItem(localId);
      if (
        freshItem?.serverId !== null &&
        freshItem?.serverId !== undefined &&
        activeServerId !== null &&
        activeLocalId !== null
      ) {
        await syncManagerEnqueue(
          {
            opType: 'REMOVE_ITEM',
            listServerId: activeServerId,
            itemServerId: freshItem.serverId,
            itemLocalId: localId,
            removedAt: Date.now(),
          },
          activeLocalId
        );
      } else {
        await hardDeleteItem(localId);
      }
      set({ items: items.filter((i) => i.localId !== localId) });
    },

    saveItem: async (localId, name, description, iconKey) => {
      const { activeLocalId, activeServerId, items } = get();
      await updateItemNameAndIcon(localId, name, description, iconKey);
      const freshItem = await getItem(localId);
      if (
        freshItem?.serverId !== null &&
        freshItem?.serverId !== undefined &&
        activeServerId !== null &&
        activeLocalId !== null
      ) {
        const category =
          freshItem.serverCategoryId !== null
            ? {
                id: freshItem.serverCategoryId,
                name: freshItem.serverCategoryName ?? '',
                ordering: freshItem.serverCategoryOrdering ?? 0,
              }
            : null;
        await syncManagerEnqueue(
          {
            opType: 'UPDATE_ITEM',
            listServerId: activeServerId,
            itemServerId: freshItem.serverId,
            itemLocalId: localId,
            name,
            description,
            iconKey,
            category,
          },
          activeLocalId
        );
        // description is a per-list-instance field; the catalog endpoint (UPDATE_ITEM) does not
        // persist it to the shoppinglist. Sync via the dedicated per-list endpoint as well.
        const serverDescription = freshItem.isImportant ? `!${description}` : description;
        await syncManagerEnqueue(
          {
            opType: 'UPDATE_ITEM_DESC',
            listServerId: activeServerId,
            itemServerId: freshItem.serverId,
            description: serverDescription,
          },
          activeLocalId
        );
      }
      set({
        items: items.map((i) => (i.localId === localId ? { ...i, name, description, iconKey } : i)),
      });
    },

    addItem: async (name, description, iconKey, category) => {
      const { activeLocalId, activeServerId, items } = get();
      if (!activeLocalId) {
        return;
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
        await syncManagerEnqueue(
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
      set({ items: [...items, newItem] });
    },

    clearTrolley: async () => {
      const { activeLocalId, items } = get();
      if (!activeLocalId) {
        return;
      }
      // Items were already removed from the server when each was checked off.
      await clearCheckedItems(activeLocalId);
      set({ items: items.filter((i) => !i.isChecked) });
    },

    fetchCategories: async (householdId) => {
      const householdsApi = useAuthStore.getState().householdsApi;
      if (!householdsApi) {
        return;
      }
      try {
        const categories = await householdsApi.getCategories(householdId);
        set({ allCategories: categories });
      } catch {
        // Offline or transient failure — keep existing categories.
      }
    },

    moveItemToCategory: async (localId, categoryId) => {
      const { activeLocalId, activeServerId, items, allCategories } = get();
      const category =
        categoryId !== null ? (allCategories.find((c) => c.id === categoryId) ?? null) : null;

      const newName = category?.name ?? 'Uncategorized';
      const newId = category?.id ?? null;
      const newCategoryName = category?.name ?? null;
      const newOrdering = category?.ordering ?? null;

      await updateItemCategory(localId, newName, newId, newCategoryName, newOrdering);

      const freshItem = await getItem(localId);
      if (
        freshItem?.serverId !== null &&
        freshItem?.serverId !== undefined &&
        activeServerId !== null &&
        activeLocalId !== null
      ) {
        const serverCategory = category
          ? { id: category.id, name: category.name, ordering: category.ordering }
          : null;
        await syncManagerEnqueue(
          {
            opType: 'UPDATE_ITEM',
            listServerId: activeServerId,
            itemServerId: freshItem.serverId,
            itemLocalId: localId,
            name: freshItem.name,
            description: freshItem.description,
            iconKey: freshItem.iconKey,
            category: serverCategory,
          },
          activeLocalId
        );
      }

      set({
        items: items.map((i) =>
          i.localId === localId
            ? {
                ...i,
                category: newName,
                serverCategoryId: newId,
                serverCategoryName: newCategoryName,
                serverCategoryOrdering: newOrdering,
                isDirty: true,
              }
            : i
        ),
      });
    },
  };
});

// ─── Section hooks ────────────────────────────────────────────────────────────

/** State and actions for the list header / picker. */
export function useListNav() {
  return useListDetailStore(
    useShallow((s) => ({
      activeName: s.activeName,
      allLists: s.allLists,
      listPickerVisible: s.listPickerVisible,
      activeLocalId: s.activeLocalId,
      refreshing: s.refreshing,
      setListPickerVisible: s.setListPickerVisible,
      switchToList: s.switchToList,
      refresh: s.refresh,
    }))
  );
}

/** Item-level handlers passed to SwipeableItem and CategorySection. */
export function useItemActions() {
  return useListDetailStore(
    useShallow((s) => ({
      editingId: s.editingId,
      setEditingId: s.setEditingId,
      toggleDone: s.toggleDone,
      toggleImportant: s.toggleImportant,
      deleteItem: s.deleteItem,
      saveItem: s.saveItem,
      addItem: s.addItem,
      clearTrolley: s.clearTrolley,
    }))
  );
}
