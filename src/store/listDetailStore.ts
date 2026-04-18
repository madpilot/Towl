import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { getItemAsync, setItemAsync } from 'expo-secure-store';
import {
  clearExpiredCheckedItems,
  getItemsForList,
  upsertItemFromServer,
  removeItemsDeletedOnServer,
  clearCheckedItems,
} from '@/db/items';
import { getAllLists, upsertListFromServer, removeListsDeletedOnServer } from '@/db/lists';
import { useAuthStore } from '@/store/authStore';
import { matchItem } from '@/data/foodMatcher';
import { SECURE_STORE_KEYS } from '@/utils/constants';
import type { LocalItem } from '@/db/items';
import type { LocalList } from '@/db/lists';
import type { HouseholdCategory } from '@/api/households';
import {
  addItem as addItemOp,
  checkItem as checkItemOp,
  uncheckItem as uncheckItemOp,
  toggleImportant as toggleImportantOp,
  deleteItem as deleteItemOp,
  saveItem as saveItemOp,
  moveItemToCategory as moveItemToCategoryOp,
} from '@/items/itemOperations';

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
  syncLists: (householdId: number) => Promise<void>;
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
        const match = matchItem(apiItem.name);
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

    syncLists: async (householdId) => {
      let lists = await getAllLists(householdId);
      const api = useAuthStore.getState().shoppingListsApi;
      if (api) {
        try {
          const serverLists = await api.getShoppingLists(householdId);
          for (const sl of serverLists) {
            await upsertListFromServer(sl.id, householdId, sl.name);
          }
          await removeListsDeletedOnServer(householdId, serverLists.map((l) => l.id));
          lists = await getAllLists(householdId);
        } catch {
          // Offline — keep existing SQLite data.
        }
      }
      set({ allLists: lists });
    },

    bootstrap: async (householdId, restoreLastList) => {
      const { activeLocalId, activeServerId, allLists } = get();
      const activeListStillExists = activeLocalId != null && allLists.some((l) => l.localId === activeLocalId);
      if (activeListStillExists) {
        // Already loaded — refresh in background without disrupting the UI.
        void get().syncLists(householdId);
        void syncFromServer(activeLocalId, activeServerId, householdId);
        return;
      }

      set({ loading: true, items: [], activeLocalId: null, activeServerId: null, activeName: '' });

      let lists = await getAllLists(householdId);

      if (lists.length === 0) {
        // Nothing cached yet (first launch) — must wait for the server.
        await get().syncLists(householdId);
        lists = get().allLists;
      } else {
        // Cached data available — show it immediately, refresh in background.
        set({ allLists: lists });
        void get().syncLists(householdId);
      }

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
      if (!item || !activeLocalId) {
        return;
      }
      const listContext = { activeLocalId, activeServerId };

      if (!item.isChecked) {
        const updated = await checkItemOp({ listContext, item });
        set({ items: items.map((i) => (i.localId === localId ? updated : i)) });
      } else {
        const updated = await uncheckItemOp({ listContext, item });
        set({ items: items.map((i) => (i.localId === localId ? updated : i)) });
      }
    },

    toggleImportant: async (localId) => {
      const { items, activeLocalId, activeServerId } = get();
      const item = items.find((i) => i.localId === localId);
      if (!item || !activeLocalId) {
        return;
      }
      const updated = await toggleImportantOp({
        listContext: { activeLocalId, activeServerId },
        item,
      });
      set({ items: items.map((i) => (i.localId === localId ? updated : i)) });
    },

    deleteItem: async (localId) => {
      const { activeLocalId, activeServerId, items } = get();
      if (!activeLocalId) {
        return;
      }
      const item = items.find((i) => i.localId === localId);
      if (!item) {
        return;
      }
      await deleteItemOp({
        listContext: { activeLocalId, activeServerId },
        item,
      });
      set({ items: items.filter((i) => i.localId !== localId) });
    },

    saveItem: async (localId, name, description, iconKey) => {
      const { activeLocalId, activeServerId, items } = get();
      if (!activeLocalId) {
        return;
      }
      const item = items.find((i) => i.localId === localId);
      if (!item) {
        return;
      }
      const updated = await saveItemOp({
        listContext: { activeLocalId, activeServerId },
        item,
        name,
        description,
        iconKey,
      });
      set({ items: items.map((i) => (i.localId === localId ? updated : i)) });
    },

    addItem: async (name, description, iconKey, category) => {
      const { activeLocalId, activeServerId, items } = get();
      if (!activeLocalId) {
        return;
      }
      const result = await addItemOp({
        listContext: { activeLocalId, activeServerId },
        currentItems: items,
        name,
        description,
        iconKey,
        category,
      });
      if (result.action === 'merged') {
        set({ items: items.map((i) => (i.localId === result.item.localId ? result.item : i)) });
        return;
      }
      set({ items: [...items, result.item] });
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
      if (!activeLocalId) {
        return;
      }
      const item = items.find((i) => i.localId === localId);
      if (!item) {
        return;
      }
      const category =
        categoryId !== null ? (allCategories.find((c) => c.id === categoryId) ?? null) : null;

      const updated = await moveItemToCategoryOp({
        listContext: { activeLocalId, activeServerId },
        item,
        category,
      });
      set({ items: items.map((i) => (i.localId === localId ? updated : i)) });
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
